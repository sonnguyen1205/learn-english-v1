# Learn English v1

A one-page app for learning English from the video
[What World Class Software Engineers Do That You Don't](https://www.youtube.com/watch?v=OkXuLNAjrSg) (Beyond Coding).

- **Left column:** video player, with the 18 parts listed below it (a progress bar for each part)
- **Right column:** transcript of the current part, with **EN / VI** tabs; the current line is highlighted, and clicking a line jumps to it
- **EN / VI / Ẩn** tabs; "Ẩn" blurs the transcript for listening practice
- Hover a line to see a tooltip in the other language (in "Ẩn" mode the tooltip shows both EN and VI)
- Video size: full / 1/2 / hidden; when hidden, a "now playing" bar shows with play/pause
- Speed slider from 0.5× to 2× (double-click to reset to 1×)
- Previous / replay / next line, loop a line, `Space` to play/pause
- **Remembers** (in `localStorage`): the current part, the position in each part, the tab, the speed and the video size

Node.js only, no dependencies.

## 1. Cut the video

Put `What-World-Class-SnapYT.App.mp4` and `bin\ffmpeg.exe` in the repo folder, then run:

```bat
cut.bat
```

This creates `web\media\What-World-Class-01.mp4` … `-18.mp4`. On macOS or Linux, use `./cut.sh` instead.

## 2. Run

```bash
npm start
```

Then open http://localhost:8000. `server.js` supports HTTP Range requests, which the browser needs to seek in the video.

## Editing the transcript

The transcript (EN + VI) is in `data/transcript_*.txt`:

```
## Part title
m:ss|English line|Vietnamese line
```

After editing, run `npm run build` to regenerate `web/data/lesson.json`, `cut.bat` and `cut.sh`.
To change the source file name or output prefix, edit `CONFIG` in `scripts/build.js`.

> `-c copy` cuts on keyframes, so a part may start a little before the timestamp.
