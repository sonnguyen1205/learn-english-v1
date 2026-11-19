# Learn English v1

A one-page app for learning English from the video
[What World Class Software Engineers Do That You Don't](https://www.youtube.com/watch?v=OkXuLNAjrSg) (Beyond Coding).

- **Left column:** video player, with the 18 parts listed below it (a progress bar for each part)
- **Right column:** transcript of the current part, with **EN / VI** tabs; the current line is highlighted, and clicking a line jumps to it
- **EN / VI / Ẩn** tabs; "Ẩn" blurs the transcript for listening practice
- Hover a line to see a tooltip in the other language (in "Ẩn" mode the tooltip shows both EN and VI)
- Video size: full / 1/2 / hidden; when hidden, a "now playing" bar shows with play/pause
- Speed slider from 0.5× to 2× (double-click to reset to 1×)
- Previous / replay / next line, **loop a line**, **loop a part**, `Space` to play/pause
- **Remembers** (in `localStorage`): the current part, the position in each part, the tab, the speed and the video size

**Vocabulary page** (`vocab.html`, 167 words/phrases from the video):
- List view grouped by part: IPA, part of speech, Vietnamese meaning, and the example sentence from the video (EN + VI, word highlighted)
- 🔊 pronunciation of the word and the example sentence (browser text-to-speech)
- "▶ Xem trong video" jumps to the exact moment in the video page
- Flashcards: flip, mark as known or not yet known, shuffle; shortcuts are Space, ← →, 1, 2 and S
- Filter by part, by status (known / not yet known), or by search; known words are remembered

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

Vocabulary is in `data/vocab.txt`: `word|IPA|part of speech|Vietnamese meaning|m:ss`, where `m:ss` is the time of the transcript line that uses the word. The example sentence and the part are filled in automatically.

After editing, run `npm run build` to regenerate `web/data/lesson.json`, `web/data/vocab.json`, `cut.bat` and `cut.sh`.
To change the source file name or output prefix, edit `CONFIG` in `scripts/build.js`.

> `-c copy` cuts on keyframes, so a part may start a little before the timestamp.
