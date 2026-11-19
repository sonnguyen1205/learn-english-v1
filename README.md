# Learn English

Learn English from YouTube videos: each video is split into parts, with an EN/VI transcript and a vocabulary list.
Node.js only, no dependencies.

## Pages

- **Home (`index.html`):** list of videos with watch progress and words learned, plus "Tiếp tục xem" to resume the last video.
- **Video (`watch.html?v=<video>`):**
  - Left column: player (full / 1/2 / hidden), with the list of parts below.
  - Right column: transcript with **EN / VI / Ẩn** tabs; hover a line to see the other language.
  - Loop a line, loop a part, speed slider 0.5×–2×.
  - Remembers the position in every part.
- **Vocabulary (`vocab.html?v=<video>`):**
  - Words with IPA, meaning, and the example sentence from the video.
  - 🔊 pronunciation, and "▶ Xem trong video" to jump to the moment the word is used.
  - List or flashcard view; mark words as known.

## Run

```bash
npm run build
```
```bash
npm start
```

Then open http://localhost:8000.

## Cut a video

```bat
cut.bat <video> <source file>
cut.bat what-world-class What-World-Class-SnapYT.App.mp4
```

- Creates `web/media/<video>/<video>-01.mp4 …`.
- Home page thumbnail: put the image at `web/media/<video>/thumbnail.jpg`; if it is missing, the YouTube thumbnail is used.
- Uses `bin\ffmpeg.exe` if it exists, otherwise `ffmpeg` from PATH, or the one given with `--ffmpeg <path>`.
- `--part 3` cuts only part 3. `--dry-run` only prints the ffmpeg commands.
- `cut.bat` with no arguments lists the available videos.
- On macOS or Linux, use `./cut.sh` instead.

> `-c copy` cuts on keyframes, so a part may start a little before the timestamp.

## Add a video

Create `data/videos/<video>/`, for example `data/videos/my-talk/`:

| File | Content |
|---|---|
| `video.json` | `{ "videoId": "<YouTube id>", "title": "...", "channel": "...", "tail": 5 }` (`tail` = seconds after the last line) |
| `transcript_*.txt` | `## Part title`, then `m:ss\|English line\|Vietnamese line` |
| `vocab.txt` | `word\|IPA\|part of speech\|Vietnamese meaning\|m:ss`, where `m:ss` is the time of the transcript line that uses the word |

Then:

```bash
npm run build
```
```bat
cut.bat my-talk my-talk-source.mp4
```

Progress is saved in the browser's `localStorage`, keyed by YouTube id.
