# Learn English v1

A one-page app for learning English from the video
[What World Class Software Engineers Do That You Don't](https://www.youtube.com/watch?v=OkXuLNAjrSg) (Beyond Coding).

- **Left column:** video player, with the 18 parts listed below it (a progress bar for each part)
- **Right column:** transcript of the current part, with **EN / VI** tabs; the current line is highlighted, and clicking a line jumps to it
- Previous / replay / next line, loop a line, playback speed
- **Remembers playback** (in `localStorage`): the current part, the position in each part, the language tab and the speed

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
