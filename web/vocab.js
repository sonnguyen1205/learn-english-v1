(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  let lesson, words = [], view = [], idx = 0;
  let state = {};  // { known: {id: true}, mode, part, status, order: [ids] }
  let KEY = "";

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const isKnown = (w) => !!(state.known || {})[w.id];

  // ---------------------------------------------------------------- speech
  let voice = null;
  function pickVoice() {
    const vs = speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
    voice = vs.find((v) => /en[-_]US/i.test(v.lang) && /Google|Natural|Samantha|Aria|Jenny/i.test(v.name))
         || vs.find((v) => /en[-_]US/i.test(v.lang)) || vs[0] || null;
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text, rate = 0.9) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = rate; if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  // ---------------------------------------------------------------- helpers
  const STOP = new Set(["the", "and", "for", "with", "you", "your", "its", "out", "off"]);
  function highlight(sentence, word) {
    // wrap the words of the headword (prefix match, e.g. "outsource" -> "outsourced") in <mark>
    const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const stems = word.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.slice(0, Math.min(w.length, 5)));
    return esc(sentence).replace(/[A-Za-z']+/g, (tok) =>
      stems.some((s) => tok.toLowerCase().startsWith(s)) ? `<mark>${tok}</mark>` : tok);
  }
  const watchUrl = (w) => `watch.html?v=${lesson.slug}#t=${w.t}`;
  const partName = (id) => { const p = lesson.parts.find((x) => x.id === id); return p ? `Phần ${id}: ${p.title}` : `Phần ${id}`; };

  function setKnown(w, known) {
    state.known = state.known || {};
    if (known) { state.known[w.id] = true; LE.markStudyDay(); } else delete state.known[w.id];
    store();
    updateProgress();
  }

  function updateProgress() {
    const n = words.filter(isKnown).length;
    $("#progress-text").textContent = `Đã thuộc ${n} / ${words.length} từ`;
    $("#progress-bar").style.width = `${(n / words.length) * 100}%`;
  }

  // ---------------------------------------------------------------- filtering
  function applyFilters() {
    const part = $("#f-part").value, status = $("#f-status").value, q = $("#f-search").value.trim().toLowerCase();
    state.part = part; state.status = status; store();
    view = words.filter((w) =>
      (!part || String(w.part) === part) &&
      (!status || (status === "known") === isKnown(w)) &&
      (!q || w.word.toLowerCase().includes(q) || w.vi.toLowerCase().includes(q)));
    if (state.order && state.mode === "cards") {
      const pos = new Map(state.order.map((id, i) => [id, i]));
      view.sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
    }
    $("#empty-list").hidden = view.length > 0;
    render();
  }

  // ---------------------------------------------------------------- list mode
  function renderList() {
    const box = $("#list");
    box.innerHTML = "";
    let lastPart = null;
    for (const w of view) {
      if (w.part !== lastPart) {
        const h = document.createElement("h2");
        h.className = "section-title vocab-part";
        h.textContent = partName(w.part);
        box.appendChild(h);
        lastPart = w.part;
      }
      const el = document.createElement("article");
      el.className = "word-card" + (isKnown(w) ? " known" : "");
      el.innerHTML = `
        <div class="wc-head">
          <button class="speak" aria-label="Nghe phát âm" title="Nghe phát âm">${LE.icon("speaker", 18)}</button>
          <div class="wc-word"></div>
          <span class="pos"></span>
          <label class="known-toggle" title="Đánh dấu đã thuộc"><input type="checkbox"><span>${LE.icon("check", 14)} Đã thuộc</span></label>
        </div>
        <div class="wc-ipa muted"></div>
        <div class="wc-vi"></div>
        <p class="wc-ex"><button class="speak small" aria-label="Nghe câu ví dụ" title="Nghe câu ví dụ">${LE.icon("speaker", 14)}</button> <span></span></p>
        <p class="wc-ex-vi muted"></p>
        <a class="watch" href="${watchUrl(w)}">${LE.icon("play", 14)} Xem trong video · ${fmt(w.t)}</a>`;
      el.querySelector(".wc-word").textContent = w.word;
      el.querySelector(".pos").textContent = w.pos;
      el.querySelector(".wc-ipa").textContent = w.ipa;
      el.querySelector(".wc-vi").textContent = w.vi;
      el.querySelector(".wc-ex span").innerHTML = highlight(w.example.en, w.word);
      el.querySelector(".wc-ex-vi").textContent = w.example.vi;
      el.querySelector(".wc-head .speak").onclick = () => speak(w.word, 0.8);
      el.querySelector(".wc-ex .speak").onclick = () => speak(w.example.en, 0.95);
      const cb = el.querySelector(".known-toggle input");
      cb.checked = isKnown(w);
      cb.onchange = () => { setKnown(w, cb.checked); el.classList.toggle("known", cb.checked); };
      box.appendChild(el);
    }
  }

  // ---------------------------------------------------------------- flashcard mode
  function renderCard() {
    const fc = $("#flashcard");
    fc.classList.remove("flipped");
    if (!view.length) { $("#cards").classList.add("is-empty"); return; }
    $("#cards").classList.remove("is-empty");
    idx = Math.max(0, Math.min(idx, view.length - 1));
    const w = view[idx];
    $("#card-count").textContent = `${idx + 1} / ${view.length} · ${partName(w.part)}`;
    $("#fc-word").textContent = w.word;
    $("#fc-ipa").textContent = w.ipa;
    $("#fc-pos").textContent = w.pos;
    $("#fc-vi").textContent = w.vi;
    $("#fc-ex").innerHTML = highlight(w.example.en, w.word);
    $("#fc-ex-vi").textContent = w.example.vi;
    $("#fc-watch").href = watchUrl(w);
    fc.classList.toggle("known", isKnown(w));
  }
  function go(d) { if (view.length) { idx = (idx + d + view.length) % view.length; renderCard(); } }
  function mark(known) {
    const w = view[idx];
    if (!w) return;
    setKnown(w, known);
    // when filtering by status the card leaves the deck; otherwise move on
    if ($("#f-status").value) { applyFilters(); } else go(1);
  }
  function shuffle() {
    const ids = words.map((w) => w.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    state.order = ids; idx = 0; store(); applyFilters();
  }

  // ---------------------------------------------------------------- mode
  function setMode(m) {
    state.mode = m; store();
    document.querySelectorAll("#mode button").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    $("#list").hidden = m !== "list";
    $("#cards").hidden = m !== "cards";
    applyFilters();
  }
  function render() { state.mode === "cards" ? renderCard() : renderList(); }

  function bind() {
    document.querySelectorAll("#mode button").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
    ["#f-part", "#f-status"].forEach((s) => ($(s).onchange = () => { idx = 0; applyFilters(); }));
    $("#f-search").oninput = () => { idx = 0; applyFilters(); };
    $("#flashcard").onclick = (e) => { if (!e.target.closest("a")) $("#flashcard").classList.toggle("flipped"); };
    $("#fc-prev").onclick = () => go(-1);
    $("#fc-next").onclick = () => go(1);
    $("#fc-known").onclick = () => mark(true);
    $("#fc-new").onclick = () => mark(false);
    $("#fc-shuffle").onclick = shuffle;
    $("#fc-speak").onclick = () => view[idx] && speak(view[idx].word, 0.8);
    document.addEventListener("keydown", (e) => {
      if (state.mode !== "cards" || e.target.matches("input, select, textarea")) return;
      if (e.key === " ") { $("#flashcard").classList.toggle("flipped"); e.preventDefault(); }
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "1") mark(false);
      else if (e.key === "2") mark(true);
      else if (e.key === "s" || e.key === "S") view[idx] && speak(view[idx].word, 0.8);
    });
  }

  async function boot() {
    const slug = new URLSearchParams(location.search).get("v");
    if (!slug) { location.replace("index.html"); return; }
    const get = (f) => fetch(`data/${encodeURIComponent(slug)}/${f}`, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(r.status); return r.json(); });
    try { [lesson, words] = await Promise.all([get("lesson.json"), get("vocab.json")]); }
    catch { location.replace("index.html"); return; }
    $("#nav-watch").href = `watch.html?v=${slug}`;
    $("#nav-vocab").href = `vocab.html?v=${slug}`;
    KEY = `learn-english-vocab:${lesson.videoId}`;
    state = load();
    $("#lesson-title").textContent = lesson.title;
    document.title = `Từ vựng · ${lesson.title}`;
    for (const p of lesson.parts) {
      const n = words.filter((w) => w.part === p.id).length;
      if (!n) continue;
      const o = document.createElement("option");
      o.value = p.id; o.textContent = `${p.id}. ${p.title} (${n})`;
      $("#f-part").appendChild(o);
    }
    $("#f-part").value = state.part || "";
    $("#f-status").value = state.status || "";
    bind();
    updateProgress();
    setMode(state.mode || "list");
  }
  boot();
})();
