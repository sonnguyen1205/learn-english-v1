#!/usr/bin/env python3
"""
Prepare an English lesson from a YouTube video.

  1. Download the video (yt-dlp)
  2. Get the English transcript (youtube-transcript-api, fallback: yt-dlp subtitles)
  3. Get a Vietnamese transcript (YouTube auto-translate, fallback: Google Translate via deep-translator)
  4. Split into parts (video chapters if present, otherwise ~N-minute chunks on sentence boundaries)
  5. Cut each part with ffmpeg -> web/media/part_XX.mp4
  6. Write web/data/lesson.json for the web app

Usage:
  python scripts/prepare.py https://www.youtube.com/watch?v=OkXuLNAjrSg
  python scripts/prepare.py URL --chunk-minutes 3
  python scripts/prepare.py URL --no-download     # skip download/cut, the app plays via YouTube embed
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
MEDIA = WEB / "media"
DATA = WEB / "data"


def log(msg):
    print(f"[prepare] {msg}", flush=True)


def video_id(url):
    m = re.search(r"(?:v=|youtu\.be/|shorts/|embed/)([A-Za-z0-9_-]{11})", url)
    if not m:
        sys.exit(f"Cannot find a video id in {url}")
    return m.group(1)


# ---------------------------------------------------------------- download
def fetch_info(url, cookies=None):
    import yt_dlp
    opts = {"quiet": True, "skip_download": True}
    if cookies:
        opts["cookiefile"] = cookies
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=False)


def download_video(url, out, cookies=None):
    import yt_dlp
    opts = {
        "format": "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/b",
        "merge_output_format": "mp4",
        "outtmpl": str(out.with_suffix("")) + ".%(ext)s",
        "quiet": False,
    }
    if cookies:
        opts["cookiefile"] = cookies
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])
    if not out.exists():
        cands = list(out.parent.glob(out.stem + ".*"))
        if not cands:
            sys.exit("Download failed")
        cands[0].rename(out)
    return out


# ---------------------------------------------------------------- transcript
def clean(text):
    text = re.sub(r"\s+", " ", text.replace("\n", " ")).strip()
    return re.sub(r"\[(?:Music|Applause|Laughter)\]", "", text, flags=re.I).strip()


def get_transcripts(vid):
    """Return (en_segments, vi_segments or None). Segment = {start, end, text}."""
    from youtube_transcript_api import YouTubeTranscriptApi
    api = YouTubeTranscriptApi()
    tlist = api.list(vid)
    try:
        tr = tlist.find_manually_created_transcript(["en", "en-US", "en-GB"])
    except Exception:
        tr = tlist.find_transcript(["en", "en-US", "en-GB"])
    log(f"English transcript: {tr.language} ({'auto' if tr.is_generated else 'manual'})")

    def to_segs(fetched):
        out = []
        for s in fetched:
            t = clean(s.text)
            if t:
                out.append({"start": round(s.start, 2), "end": round(s.start + s.duration, 2), "text": t})
        return out

    en = to_segs(tr.fetch())
    vi = None
    if tr.is_translatable:
        try:
            vi_raw = to_segs(tr.translate("vi").fetch())
            if len(vi_raw) == len(en):
                vi = vi_raw
        except Exception as e:
            log(f"YouTube auto-translate failed: {e}")
    return en, vi


def merge_sentences(segs, max_len=220):
    """Auto captions are fragments; merge them into sentence-like lines."""
    out, cur = [], None
    for s in segs:
        if cur is None:
            cur = dict(s)
        else:
            cur["text"] += " " + s["text"]
            cur["end"] = s["end"]
        if re.search(r"[.?!][\"')\]]?$", cur["text"]) or len(cur["text"]) >= max_len:
            out.append(cur)
            cur = None
    if cur:
        out.append(cur)
    # fix overlapping end times (auto captions overlap)
    for a, b in zip(out, out[1:]):
        a["end"] = min(a["end"], b["start"]) if b["start"] > a["start"] else a["end"]
    return out


def translate_lines(lines, target="vi"):
    from deep_translator import GoogleTranslator
    tr = GoogleTranslator(source="en", target=target)
    out, batch = [], []
    SEP = "\n"

    def flush():
        if not batch:
            return
        res = tr.translate(SEP.join(batch))
        parts = res.split(SEP) if res else []
        if len(parts) != len(batch):  # fallback one by one
            parts = [tr.translate(x) or "" for x in batch]
        out.extend(p.strip() for p in parts)
        batch.clear()

    size = 0
    for t in lines:
        if size + len(t) > 4000:
            flush()
            size = 0
        batch.append(t)
        size += len(t) + 1
    flush()
    return out


# ---------------------------------------------------------------- parts
def make_parts(info, segs, duration, chunk_minutes):
    chapters = info.get("chapters") or []
    if chapters:
        log(f"Using {len(chapters)} YouTube chapters")
        return [{"title": c.get("title") or f"Part {i+1}", "start": float(c["start_time"]),
                 "end": float(c["end_time"])} for i, c in enumerate(chapters)]
    log(f"No chapters -> splitting every ~{chunk_minutes} min on sentence boundaries")
    target = chunk_minutes * 60
    parts, start = [], 0.0
    for s in segs:
        if s["start"] - start >= target:
            parts.append({"start": start, "end": s["start"]})
            start = s["start"]
    parts.append({"start": start, "end": duration})
    if len(parts) > 1 and parts[-1]["end"] - parts[-1]["start"] < target * 0.35:
        parts[-2]["end"] = parts.pop()["end"]
    for i, p in enumerate(parts):
        first = next((s["text"] for s in segs if s["start"] >= p["start"]), "")
        p["title"] = f"Part {i+1}: " + (first[:50] + "…" if len(first) > 50 else first)
    return parts


def cut(src, dst, start, end):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.2f}", "-i", str(src),
           "-t", f"{end - start:.2f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
           "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(dst)]
    subprocess.run(cmd, check=True)


def build_lesson(meta, parts, en, vi, files):
    lesson = {**meta, "parts": []}
    for i, p in enumerate(parts):
        idx = [k for k, s in enumerate(en) if p["start"] <= s["start"] < p["end"]]
        lines = [{
            "start": round(en[k]["start"] - p["start"], 2),
            "end": round(min(en[k]["end"], p["end"]) - p["start"], 2),
            "en": en[k]["text"],
            "vi": vi[k] if vi else "",
        } for k in idx]
        lesson["parts"].append({
            "id": i + 1,
            "title": p["title"],
            "start": round(p["start"], 2),
            "end": round(p["end"], 2),
            "file": files[i] if files else None,
            "lines": lines,
        })
    return lesson


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--chunk-minutes", type=float, default=3.0)
    ap.add_argument("--no-download", action="store_true", help="don't download/cut; play from YouTube embed")
    ap.add_argument("--cookies", help="cookies.txt (if YouTube asks to sign in)")
    a = ap.parse_args()

    vid = video_id(a.url)
    log("Fetching video info…")
    info = fetch_info(a.url, a.cookies)
    duration = float(info.get("duration") or 0)

    log("Fetching transcripts…")
    en_raw, vi_raw = get_transcripts(vid)
    if vi_raw:
        # translated captions are aligned 1:1 with English fragments: merge both with same grouping
        merged, cur_en, cur_vi, cur = [], [], [], None
        for e, v in zip(en_raw, vi_raw):
            if cur is None:
                cur = {"start": e["start"], "end": e["end"]}
            cur_en.append(e["text"]); cur_vi.append(v["text"]); cur["end"] = e["end"]
            joined = " ".join(cur_en)
            if re.search(r"[.?!][\"')\]]?$", joined) or len(joined) >= 220:
                merged.append({**cur, "text": joined, "vi": " ".join(cur_vi)})
                cur, cur_en, cur_vi = None, [], []
        if cur:
            merged.append({**cur, "text": " ".join(cur_en), "vi": " ".join(cur_vi)})
        en = merged
        vi = [m["vi"] for m in merged]
        # if auto-captions have no punctuation, lines are huge chunks -> re-translate properly instead
        if not any(re.search(r"[.?!]$", s["text"]) for s in en_raw):
            log("Captions have no punctuation; Vietnamese via Google Translate per line")
            vi = translate_lines([s["text"] for s in en])
    else:
        en = merge_sentences(en_raw)
        log(f"Translating {len(en)} lines to Vietnamese…")
        vi = translate_lines([s["text"] for s in en])
    for a_, b_ in zip(en, en[1:]):
        if b_["start"] > a_["start"]:
            a_["end"] = min(a_["end"], b_["start"])

    parts = make_parts(info, en, duration or en[-1]["end"], a.chunk_minutes)

    files = None
    if not a.no_download:
        MEDIA.mkdir(parents=True, exist_ok=True)
        full = MEDIA / "full.mp4"
        if not full.exists():
            log("Downloading video…")
            download_video(a.url, full, a.cookies)
        files = []
        for i, p in enumerate(parts):
            name = f"part_{i+1:02d}.mp4"
            log(f"Cutting {name}  {p['start']:.1f}s → {p['end']:.1f}s")
            cut(full, MEDIA / name, p["start"], p["end"])
            files.append(f"media/{name}")

    meta = {"videoId": vid, "title": info.get("title") or vid, "channel": info.get("uploader") or "",
            "duration": duration}
    lesson = build_lesson(meta, parts, en, vi, files)
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "lesson.json").write_text(json.dumps(lesson, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"Done: {len(parts)} parts, {len(en)} lines → web/data/lesson.json")
    log("Run:  python scripts/serve.py   then open http://localhost:8000")


if __name__ == "__main__":
    if not shutil.which("ffmpeg") and "--no-download" not in sys.argv:
        sys.exit("ffmpeg is required (or use --no-download)")
    main()
