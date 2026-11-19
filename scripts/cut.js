// Cut a source video into the parts defined in web/data/<slug>/lesson.json
//
//   cut.bat <video> <source.mp4> [--part N] [--dry-run] [--ffmpeg path]
//   node scripts/cut.js what-world-class What-World-Class-SnapYT.App.mp4
//
// Output: web/media/<slug>/<slug>-01.mp4 ... + thumb.jpg (home page thumbnail)
// ffmpeg: --ffmpeg, else bin/ffmpeg(.exe) in this repo, else "ffmpeg" from PATH.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const dry = args.includes("--dry-run") && args.splice(args.indexOf("--dry-run"), 1);
const onlyPart = flag("--part");
let ffmpeg = flag("--ffmpeg");
const [slug, source] = args;

const videos = fs.existsSync(path.join(ROOT, "web/data/videos.json"))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, "web/data/videos.json"), "utf8")) : [];
if (!slug || !source) {
  console.log("Usage: cut.bat <video> <source.mp4> [--part N] [--dry-run] [--ffmpeg path]\n\nVideos:");
  for (const v of videos) console.log(`  ${v.slug.padEnd(24)} ${v.title}`);
  process.exit(1);
}
const lessonFile = path.join(ROOT, "web/data", slug, "lesson.json");
if (!fs.existsSync(lessonFile)) {
  console.error(`Unknown video "${slug}". Run "npm run build" first. Known: ${videos.map((v) => v.slug).join(", ")}`);
  process.exit(1);
}
if (!dry && !fs.existsSync(source)) { console.error(`Source not found: ${source}`); process.exit(1); }

if (!ffmpeg) {
  const local = path.join(ROOT, "bin", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  ffmpeg = fs.existsSync(local) ? local : "ffmpeg";
}

const hms = (s) => [s / 3600, (s % 3600) / 60, s % 60].map((x) => String(Math.floor(x)).padStart(2, "0")).join(":");
const lesson = JSON.parse(fs.readFileSync(lessonFile, "utf8"));
const outDir = path.join(ROOT, "web/media", slug);
fs.mkdirSync(outDir, { recursive: true });

function run(argv, label) {
  const shown = [ffmpeg, ...argv].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ");
  console.log(`\n# ${label}\n${shown}`);
  if (dry) return;
  const r = spawnSync(ffmpeg, argv, { stdio: "inherit" });
  if (r.error) { console.error(`Cannot run ffmpeg (${ffmpeg}): ${r.error.message}`); process.exit(1); }
  if (r.status !== 0) { console.error(`ffmpeg failed (${r.status})`); process.exit(r.status); }
}

for (const p of lesson.parts) {
  if (onlyPart && p.id !== Number(onlyPart)) continue;
  const out = path.relative(process.cwd(), path.join(ROOT, "web", p.file)) || ".";
  run(["-hide_banner", "-loglevel", "error", "-y", "-ss", hms(p.start), "-t", hms(p.end - p.start),
       "-i", source, "-c", "copy", out], `${p.id}. ${p.title}`);
}
if (!onlyPart) {
  run(["-hide_banner", "-loglevel", "error", "-y", "-ss", hms(lesson.parts[0].start + 5), "-i", source,
       "-frames:v", "1", "-vf", "scale=640:-2", path.relative(process.cwd(), path.join(outDir, "thumb.jpg"))], "thumbnail");
}
console.log(dry ? "\n(dry run, nothing was cut)" : `\nDone -> web/media/${slug}/`);
