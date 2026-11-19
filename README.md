# Learn English v1

A one-page web app for learning English from a YouTube video
(default: https://www.youtube.com/watch?v=OkXuLNAjrSg).

- **Left column:** video player, with the list of cut parts below it (progress bar per part)
- **Right column:** transcript of the current part, with **EN / VI** tabs; the current line is highlighted, click a line to jump to it
- Line tools: previous / replay / next line, loop a line, playback speed
- **Remembers playback:** the current part, the position in each part, the language tab and the speed are saved in `localStorage`. Reopen the page and it continues where you left off.

## Setup (run on your own machine)

Requires Python 3.9+ and `ffmpeg`.

```bash
pip install -r requirements.txt
python scripts/prepare.py https://www.youtube.com/watch?v=OkXuLNAjrSg
python scripts/serve.py
```

Open http://localhost:8000

`prepare.py` will:
1. Download the video (≤720p) to `web/media/full.mp4`
2. Fetch the English transcript and merge caption fragments into sentences
3. Make the Vietnamese transcript (YouTube auto-translate, or Google Translate as a fallback)
4. Split the video into parts: by YouTube chapters if the video has them, otherwise every ~3 minutes (`--chunk-minutes N`) on sentence boundaries
5. Cut each part with ffmpeg → `web/media/part_XX.mp4`
6. Write `web/data/lesson.json`

Options:
- `--no-download`: don't download or cut the video; the app plays parts straight from a YouTube embed (start/end per part)
- `--cookies cookies.txt`: if YouTube asks you to "Sign in to confirm you're not a bot"

> Use `scripts/serve.py` instead of `python -m http.server`: it supports HTTP Range requests, which the browser needs to seek in the video.

Keyboard shortcuts: `Shift+←` / `Shift+→` previous/next line, `R` replay line.

## Lesson data from a transcript you provide

The transcript (with Vietnamese translations) lives in `data/transcript_*.txt`:

```
## Part title
m:ss|English line|Vietnamese line
```

Build `web/data/lesson.json` from it:

```bash
python scripts/build_lesson.py                 # parts play web/media/part_01.mp4 … part_18.mp4
python scripts/build_lesson.py --cut full.mp4  # also cut your full video into those files
python scripts/build_lesson.py --youtube       # no local files, play from the YouTube embed
```
