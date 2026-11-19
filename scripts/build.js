// Build web/data/lesson.json + cut.bat (Windows) + cut.sh from data/transcript_*.txt
//
// Transcript format:
//   ## Part title
//   m:ss|English line|Vietnamese line
//
// Usage: node scripts/build.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONFIG = {
  videoId: "OkXuLNAjrSg",
  title: "What World Class Software Engineers Do That You Don't",
  channel: "Beyond Coding",
  source: "What-World-Class-SnapYT.App.mp4", // full video, next to cut.bat / cut.sh
  prefix: "What-World-Class-",                // -> What-World-Class-01.mp4 ...
  tail: 5,                                    // seconds after the last line (end of last part)
};

const secs = (ts) => ts.split(":").reduce((s, x) => s * 60 + Number(x), 0);
const hms = (s) => [s / 3600, (s % 3600) / 60, s % 60].map((x) => String(Math.floor(x)).padStart(2, "0")).join(":");

// ---- parse
const parts = [];
for (const f of fs.readdirSync(path.join(ROOT, "data")).filter((f) => /^transcript_.*\.txt$/.test(f)).sort()) {
  for (const raw of fs.readFileSync(path.join(ROOT, "data", f), "utf8").split(/\r?\n/)) {
    if (!raw.trim()) continue;
    if (raw.startsWith("## ")) { parts.push({ title: raw.slice(3).trim(), lines: [] }); continue; }
    const [ts, en, ...vi] = raw.split("|");
    parts[parts.length - 1].lines.push({ t: secs(ts.trim()), en: en.trim(), vi: vi.join("|").trim() });
  }
}

// ---- lesson.json
const lesson = { videoId: CONFIG.videoId, title: CONFIG.title, channel: CONFIG.channel, parts: [] };
parts.forEach((p, i) => {
  const start = p.lines[0].t;
  const end = i + 1 < parts.length ? parts[i + 1].lines[0].t : p.lines[p.lines.length - 1].t + CONFIG.tail;
  const num = String(i + 1).padStart(2, "0");
  lesson.parts.push({
    id: i + 1, title: p.title, start, end,
    file: `media/${CONFIG.prefix}${num}.mp4`,
    lines: p.lines.map((l, k) => ({
      start: l.t - start,
      end: (k + 1 < p.lines.length ? p.lines[k + 1].t : end) - start,
      en: l.en, vi: l.vi,
    })),
  });
});
fs.mkdirSync(path.join(ROOT, "web", "data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "web", "data", "lesson.json"), JSON.stringify(lesson, null, 1));

// ---- cut scripts
const cmd = (ffmpeg, sep) => lesson.parts.map((p) =>
  `${ffmpeg} -ss ${hms(p.start)} -t ${hms(p.end - p.start)} -i ${CONFIG.source} -c copy web${sep}media${sep}${CONFIG.prefix}${String(p.id).padStart(2, "0")}.mp4`);
fs.writeFileSync(path.join(ROOT, "cut.bat"),
  ["@echo off", "if not exist web\\media mkdir web\\media", ...lesson.parts.map((p, i) => `REM ${p.id}. ${p.title}\r\n` + cmd(".\\bin\\ffmpeg.exe", "\\")[i])].join("\r\n") + "\r\n");
fs.writeFileSync(path.join(ROOT, "cut.sh"),
  ["#!/usr/bin/env bash", "set -e", "mkdir -p web/media", ...lesson.parts.map((p, i) => `# ${p.id}. ${p.title}\n` + cmd("ffmpeg -y", "/")[i])].join("\n") + "\n");
fs.chmodSync(path.join(ROOT, "cut.sh"), 0o755);

console.log(`${lesson.parts.length} parts, ${lesson.parts.reduce((n, p) => n + p.lines.length, 0)} lines`);
console.log("-> web/data/lesson.json, cut.bat, cut.sh");
