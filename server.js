// Static server for web/ with HTTP Range support (so the browser can seek in videos).
// Usage: node server.js [port]   ->  http://localhost:8000
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "web");
const PORT = Number(process.argv[2]) || 8000;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".mp4": "video/mp4", ".webm": "video/webm", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404).end("Not found"); return; }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (!range) {
      res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" });
      fs.createReadStream(file).pipe(res);
      return;
    }
    let start = range[1] === "" ? Math.max(0, st.size - Number(range[2])) : Number(range[1]);
    let end = range[1] !== "" && range[2] !== "" ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start >= st.size || start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${st.size}` }).end();
      return;
    }
    res.writeHead(206, {
      "Content-Type": type, "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1,
    });
    fs.createReadStream(file, { start, end }).pipe(res);
  });
}).listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT}`));
