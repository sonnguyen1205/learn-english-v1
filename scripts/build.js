// Build the web data for every video in data/videos/<slug>/
//
//   data/videos/<slug>/video.json        { videoId, title, channel, tail? }
//   data/videos/<slug>/transcript_*.txt  "## Part title" then "m:ss|English|Vietnamese"
//   data/videos/<slug>/vocab.txt         "word|IPA|pos|Vietnamese meaning|m:ss"
//
// Output:
//   web/data/videos.json                 list for the home page
//   web/data/<slug>/lesson.json
//   web/data/<slug>/vocab.json
//
// Usage: node scripts/build.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data", "videos");
const OUT = path.join(ROOT, "web", "data");

const secs = (ts) => ts.trim().split(":").reduce((s, x) => s * 60 + Number(x), 0);
const lines = (file) => fs.readFileSync(file, "utf8").split(/\r?\n/);

function buildLesson(slug, dir, meta) {
  const parts = [];
  for (const f of fs.readdirSync(dir).filter((f) => /^transcript_.*\.txt$/.test(f)).sort()) {
    for (const raw of lines(path.join(dir, f))) {
      if (!raw.trim()) continue;
      if (raw.startsWith("## ")) { parts.push({ title: raw.slice(3).trim(), lines: [] }); continue; }
      const [ts, en, ...vi] = raw.split("|");
      if (!parts.length) throw new Error(`${slug}/${f}: line before the first "## Part title"`);
      parts[parts.length - 1].lines.push({ t: secs(ts), en: en.trim(), vi: vi.join("|").trim() });
    }
  }
  const tail = meta.tail ?? 5;
  const lesson = { slug, videoId: meta.videoId, title: meta.title, channel: meta.channel || "", parts: [] };
  parts.forEach((p, i) => {
    const start = p.lines[0].t;
    const end = i + 1 < parts.length ? parts[i + 1].lines[0].t : p.lines[p.lines.length - 1].t + tail;
    lesson.parts.push({
      id: i + 1, title: p.title, start, end,
      file: `media/${slug}/${slug}-${String(i + 1).padStart(2, "0")}.mp4`,
      lines: p.lines.map((l, k) => ({
        start: l.t - start,
        end: (k + 1 < p.lines.length ? p.lines[k + 1].t : end) - start,
        en: l.en, vi: l.vi,
      })),
    });
  });
  return lesson;
}

// each vocab word is linked to the transcript line at its timestamp (example sentence + part)
function buildVocab(slug, dir, lesson) {
  const file = path.join(dir, "vocab.txt");
  if (!fs.existsSync(file)) return [];
  const all = lesson.parts.flatMap((p) => p.lines.map((l) => ({ ...l, abs: p.start + l.start, part: p.id })));
  const hasWord = (text, word) => word.toLowerCase().split(/[^a-z]+/).filter(Boolean)
    .every((w) => text.toLowerCase().includes(w.slice(0, Math.min(w.length, 5))));
  const vocab = [];
  for (const raw of lines(file)) {
    if (!raw.trim() || raw.startsWith("#")) continue;
    const [word, ipa, pos, vi, ts] = raw.split("|").map((x) => x.trim());
    const t = secs(ts);
    const cands = all.filter((l) => l.abs === t);
    const line = cands.find((l) => hasWord(l.en, word)) || cands[0];
    if (!line) { console.warn(`  ! ${slug} vocab "${word}": no transcript line at ${ts}`); continue; }
    if (!hasWord(line.en, word)) console.warn(`  ! ${slug} vocab "${word}": not found in the line at ${ts}`);
    vocab.push({ id: word.toLowerCase().replace(/[^a-z0-9]+/g, "-"), word, ipa, pos, vi,
                 part: line.part, t, example: { en: line.en, vi: line.vi } });
  }
  return vocab;
}

const list = [];
for (const slug of fs.readdirSync(SRC).sort()) {
  const dir = path.join(SRC, slug);
  if (!fs.existsSync(path.join(dir, "video.json"))) continue;
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "video.json"), "utf8"));
  const lesson = buildLesson(slug, dir, meta);
  const vocab = buildVocab(slug, dir, lesson);
  fs.mkdirSync(path.join(OUT, slug), { recursive: true });
  fs.writeFileSync(path.join(OUT, slug, "lesson.json"), JSON.stringify(lesson, null, 1));
  fs.writeFileSync(path.join(OUT, slug, "vocab.json"), JSON.stringify(vocab, null, 1));
  const p = lesson.parts;
  list.push({
    slug, videoId: meta.videoId, title: meta.title, channel: meta.channel || "",
    parts: p.length, start: p[0].start, end: p[p.length - 1].end,
    duration: p.reduce((s, x) => s + x.end - x.start, 0),
    lines: p.reduce((s, x) => s + x.lines.length, 0), words: vocab.length,
    thumb: `media/${slug}/thumbnail.jpg`,
    partList: p.map((x) => ({ id: x.id, title: x.title, len: x.end - x.start })),
  });
  console.log(`${slug}: ${p.length} parts, ${list[list.length - 1].lines} lines, ${vocab.length} words`);
}
fs.writeFileSync(path.join(OUT, "videos.json"), JSON.stringify(list, null, 1));
console.log(`-> web/data/videos.json (${list.length} videos)`);
