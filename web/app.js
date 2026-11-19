(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const video = $("#video");
  const partsEl = $("#parts");
  const transcriptEl = $("#transcript");

  let lesson = null;
  let current = 0;            // current part index
  let lang = "en";
  let activeLine = -1;
  let player = null;          // abstraction over <video> / YouTube iframe
  let saveTimer = 0;
  let ready = false;          // true once the current part has been loaded at its saved time

  // ---------------------------------------------------------------- storage
  const KEY = () => `learn-english:${lesson.videoId}`;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY())) || {}; } catch { return {}; } };
  const store = (s) => { try { localStorage.setItem(KEY(), JSON.stringify(s)); } catch {} };
  let state = {};             // { part, lang, speed, times: {partId: seconds}, done: {partId: true} }

  function saveNow() {
    if (!lesson || !player || !ready) return;
    const t = player.time();
    const p = lesson.parts[current];
    state.part = current;
    state.lang = lang;
    state.times = state.times || {};
    state.times[p.id] = Math.max(0, t);
    store(state);
    updatePartProgress(current);
  }

  // ---------------------------------------------------------------- utils
  const fmt = (s) => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`;
  };
  const partLen = (p) => p.end - p.start;

  // ---------------------------------------------------------------- players
  function localPlayer() {
    video.hidden = false;
    return {
      load(p, at, autoplay) {
        const src = p.file;
        const go = () => { video.currentTime = at || 0; ready = true; if (autoplay) video.play().catch(() => {}); };
        if (video.getAttribute("src") !== src) {
          video.src = src;
          video.addEventListener("loadedmetadata", go, { once: true });
        } else go();
      },
      time: () => video.currentTime,
      seek: (t) => { video.currentTime = t; },
      play: () => video.play().catch(() => {}),
      paused: () => video.paused,
      setRate: (r) => { video.playbackRate = r; },
    };
  }

  function youtubePlayer(onReady) {
    // Fallback when parts were not downloaded: play the original video with start/end.
    video.hidden = true;
    $("#yt-player").hidden = false;
    let yt, part, ytReady = false, rate = 1, pending = null;
    window.onYouTubeIframeAPIReady = () => {
      yt = new YT.Player("yt-player", {
        videoId: lesson.videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => { ytReady = true; yt.setPlaybackRate(rate); if (pending) api.load(...pending); onReady(); },
        },
      });
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
    const api = {
      load(p, at, autoplay) {
        part = p;
        if (!ytReady) { pending = [p, at, autoplay]; return; }
        const opts = { videoId: lesson.videoId, startSeconds: p.start + (at || 0), endSeconds: p.end };
        autoplay ? yt.loadVideoById(opts) : yt.cueVideoById(opts);
        setTimeout(() => { ready = true; }, 1500);
      },
      time: () => (ytReady && part ? Math.max(0, (yt.getCurrentTime() || 0) - part.start) : 0),
      seek: (t) => { if (ytReady) yt.seekTo(part.start + t, true); },
      play: () => ytReady && yt.playVideo(),
      paused: () => !ytReady || yt.getPlayerState() !== 1,
      setRate: (r) => { rate = r; if (ytReady) yt.setPlaybackRate(r); },
    };
    return api;
  }

  // ---------------------------------------------------------------- render
  function renderParts() {
    partsEl.innerHTML = "";
    lesson.parts.forEach((p, i) => {
      const li = document.createElement("li");
      li.className = "part";
      li.innerHTML = `<span class="num">${i + 1}</span><span class="title"></span>
        <span class="meta">${fmt(p.start)} · ${fmt(partLen(p))}</span><span class="bar"><i></i></span>`;
      li.querySelector(".title").textContent = p.title;
      li.title = p.title;
      li.addEventListener("click", () => selectPart(i, true));
      partsEl.appendChild(li);
      updatePartProgress(i);
    });
  }

  function updatePartProgress(i) {
    const p = lesson.parts[i];
    const li = partsEl.children[i];
    if (!li) return;
    const t = (state.times || {})[p.id] || 0;
    const done = (state.done || {})[p.id];
    li.querySelector(".bar i").style.width = done ? "100%" : `${Math.min(100, (t / partLen(p)) * 100)}%`;
    li.classList.toggle("done", !!done);
    li.classList.toggle("active", i === current);
  }

  function renderTranscript() {
    const p = lesson.parts[current];
    transcriptEl.innerHTML = "";
    const frag = document.createDocumentFragment();
    p.lines.forEach((l, i) => {
      const div = document.createElement("div");
      div.className = "line";
      div.dataset.i = i;
      div.innerHTML = `<span class="t">${fmt(p.start + l.start)}</span><span class="text"></span>`;
      div.querySelector(".text").textContent = (lang === "vi" ? l.vi : l.en) || l.en;
      div.addEventListener("click", () => { player.seek(l.start); player.play(); });
      frag.appendChild(div);
    });
    transcriptEl.appendChild(frag);
    activeLine = -1;
    syncLine(true);
  }

  function lineAt(t) {
    const lines = lesson.parts[current].lines;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) { if (lines[i].start <= t + 0.05) idx = i; else break; }
    return idx;
  }

  function syncLine(force) {
    const idx = lineAt(player.time());
    if (idx === activeLine && !force) return;
    const prev = transcriptEl.querySelector(".line.active");
    if (prev) prev.classList.remove("active");
    activeLine = idx;
    const el = transcriptEl.children[idx];
    if (el) {
      el.classList.add("active");
      const r = el.getBoundingClientRect(), c = transcriptEl.getBoundingClientRect();
      if (r.top < c.top + 40 || r.bottom > c.bottom - 40) el.scrollIntoView({ block: "center", behavior: force ? "auto" : "smooth" });
    }
  }

  function selectPart(i, autoplay) {
    saveNow();
    ready = false;
    current = i;
    const p = lesson.parts[i];
    let at = (state.times || {})[p.id] || 0;
    if (at >= partLen(p) - 1) at = 0; // finished → start over
    player.load(p, at, autoplay);
    [...partsEl.children].forEach((li, k) => li.classList.toggle("active", k === i));
    partsEl.children[i].scrollIntoView({ block: "nearest" });
    state.part = i; store(state);
    renderTranscript();
  }

  function setLang(l) {
    lang = l;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.lang === l));
    state.lang = l; store(state);
    renderTranscript();
  }

  // ---------------------------------------------------------------- loop / tick
  function tick() {
    if (!player) return;
    const p = lesson.parts[current];
    const t = player.time();
    const lines = p.lines;
    if ($("#loop-line").checked && activeLine >= 0 && !player.paused()) {
      const l = lines[activeLine];
      const end = lines[activeLine + 1] ? lines[activeLine + 1].start : l.end;
      if (t >= end - 0.05) { player.seek(l.start); return; }
    }
    syncLine(false);
    if (t >= partLen(p) - 0.5 && !(state.done || {})[p.id]) {
      state.done = state.done || {}; state.done[p.id] = true; saveNow();
    }
  }

  function jumpLine(delta) {
    const lines = lesson.parts[current].lines;
    const i = Math.min(lines.length - 1, Math.max(0, (activeLine < 0 ? 0 : activeLine) + delta));
    if (lines[i]) { player.seek(lines[i].start); player.play(); }
  }

  function bindUI() {
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
    $("#prev-line").onclick = () => jumpLine(-1);
    $("#next-line").onclick = () => jumpLine(1);
    $("#replay-line").onclick = () => jumpLine(0);
    $("#speed").onchange = (e) => { player.setRate(+e.target.value); state.speed = +e.target.value; store(state); };
    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, select, textarea")) return;
      if (e.key === "ArrowLeft" && e.shiftKey) { jumpLine(-1); e.preventDefault(); }
      else if (e.key === "ArrowRight" && e.shiftKey) { jumpLine(1); e.preventDefault(); }
      else if (e.key === "r" || e.key === "R") jumpLine(0);
    });
    video.addEventListener("pause", saveNow);
    video.addEventListener("seeked", saveNow);
    video.addEventListener("ended", () => {
      saveNow();
      if (current < lesson.parts.length - 1) selectPart(current + 1, true);
    });
    setInterval(tick, 200);
    saveTimer = setInterval(saveNow, 3000);
    window.addEventListener("pagehide", saveNow);
    document.addEventListener("visibilitychange", () => document.hidden && saveNow());
  }

  // ---------------------------------------------------------------- boot
  async function boot() {
    try {
      const res = await fetch("data/lesson.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      lesson = await res.json();
    } catch (e) {
      $("#empty").hidden = false;
      return;
    }
    document.title = lesson.title;
    $("#lesson-title").textContent = lesson.title;
    $("#lesson-channel").textContent = lesson.channel || "";
    state = load();
    lang = state.lang || "en";
    current = Math.min(state.part || 0, lesson.parts.length - 1);

    const useLocal = lesson.parts.every((p) => p.file);
    renderParts();
    bindUI();
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
    const speed = state.speed || 1;
    $("#speed").value = String(speed);

    if (useLocal) {
      player = localPlayer();
      player.setRate(speed);
      video.addEventListener("ratechange", () => { /* keep the select in sync with native controls */
        $("#speed").value = String(video.playbackRate); });
      selectPart(current, false);
      video.addEventListener("loadedmetadata", () => { video.playbackRate = state.speed || 1; });
    } else {
      player = youtubePlayer(() => {});
      player.setRate(speed);
      selectPart(current, false);
    }
  }
  boot();
})();
