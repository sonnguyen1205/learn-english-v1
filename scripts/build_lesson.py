#!/usr/bin/env python3
"""
Build web/data/lesson.json from data/transcript_*.txt

Transcript format:
  ## Part title
  m:ss|English line|Vietnamese line

  python scripts/build_lesson.py                       # parts use web/media/part_XX.mp4
  python scripts/build_lesson.py --cut full.mp4        # also cut full.mp4 into those part files (ffmpeg)
  python scripts/build_lesson.py --youtube             # no local files; play from the YouTube embed
"""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
META = {"videoId": "OkXuLNAjrSg", "title": "What World Class Software Engineers Do That You Don't",
        "channel": "Beyond Coding"}


def secs(ts):
    s = 0
    for x in ts.split(":"):
        s = s * 60 + int(x)
    return s


def parse():
    parts = []
    for f in sorted((ROOT / "data").glob("transcript_*.txt")):
        for raw in f.read_text(encoding="utf-8").splitlines():
            if not raw.strip():
                continue
            if raw.startswith("## "):
                parts.append({"title": raw[3:].strip(), "lines": []})
                continue
            ts, en, vi = raw.split("|", 2)
            parts[-1]["lines"].append({"t": secs(ts.strip()), "en": en.strip(), "vi": vi.strip()})
    return parts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cut", help="full video file to cut into web/media/part_XX.mp4")
    ap.add_argument("--youtube", action="store_true")
    ap.add_argument("--tail", type=float, default=5, help="seconds after the last line (last part end)")
    a = ap.parse_args()

    parts = parse()
    out = {**META, "parts": []}
    for i, p in enumerate(parts):
        start = p["lines"][0]["t"]
        end = parts[i + 1]["lines"][0]["t"] if i + 1 < len(parts) else p["lines"][-1]["t"] + a.tail
        lines = []
        for k, l in enumerate(p["lines"]):
            nxt = p["lines"][k + 1]["t"] if k + 1 < len(p["lines"]) else end
            lines.append({"start": l["t"] - start, "end": nxt - start, "en": l["en"], "vi": l["vi"]})
        out["parts"].append({"id": i + 1, "title": p["title"], "start": start, "end": end,
                             "file": None if a.youtube else f"media/part_{i+1:02d}.mp4", "lines": lines})

    dst = ROOT / "web" / "data" / "lesson.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(parts)} parts, {sum(len(p['lines']) for p in parts)} lines -> {dst.relative_to(ROOT)}")
    for p in out["parts"]:
        print(f"  {p['id']:2d}. {p['start']:5.0f}s-{p['end']:5.0f}s  {p['file'] or '(youtube)'}  {p['title']}")

    if a.cut:
        media = ROOT / "web" / "media"
        media.mkdir(parents=True, exist_ok=True)
        for p in out["parts"]:
            dst = media / f"part_{p['id']:02d}.mp4"
            print(f"cutting {dst.name}")
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(p["start"]), "-i", a.cut,
                            "-t", str(p["end"] - p["start"]), "-c:v", "libx264", "-preset", "veryfast",
                            "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
                            str(dst)], check=True)


if __name__ == "__main__":
    main()
