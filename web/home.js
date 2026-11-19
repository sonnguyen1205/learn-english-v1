(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const { icon, streak } = window.LE;
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
  const fmtDur = (s) => {
    s = Math.round(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`;
  };

  // progress saved by watch.html / vocab.html (keyed by YouTube id)
  function progress(v) {
    const st = read(`learn-english:${v.videoId}`);
    const times = st.times || {}, done = st.done || {};
    const watched = v.partList.reduce((s, p) => s + (done[p.id] ? p.len : Math.min(times[p.id] || 0, p.len)), 0);
    const known = Object.keys(read(`learn-english-vocab:${v.videoId}`).known || {}).length;
    const partIdx = Math.min(st.part || 0, v.partList.length - 1);
    const part = v.partList[partIdx];
    return { pct: Math.round((watched / v.duration) * 100), known, started: watched > 0 || st.part != null,
             part, partTime: times[part.id] || 0 };
  }

  // web/media/<video>/thumbnail.jpg; if missing, fall back to the YouTube thumbnail
  function thumb(img, v) {
    img.src = v.thumb;
    img.onerror = () => { img.onerror = null; img.src = `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`; };
  }

  function card(v) {
    const pr = progress(v);
    const el = document.createElement("article");
    el.className = "video-card";
    el.innerHTML = `
      <a class="vc-thumb" href="watch.html?v=${v.slug}" tabindex="-1" aria-hidden="true"><img alt="" loading="lazy"><span class="dur">${fmtDur(v.duration)}</span>
        ${pr.pct >= 99 ? `<span class="badge-done">${icon("check", 14)} Đã xem</span>` : ""}</a>
      <div class="vc-body">
        <h3><a href="watch.html?v=${v.slug}"></a></h3>
        <div class="vc-meta"><span class="ch"></span><span>${v.parts} phần</span><span>${v.words} từ</span></div>
        <div class="vc-stats">
          <div><span>Đã xem</span><b>${pr.pct}%</b><div class="bar"><i style="width:${pr.pct}%"></i></div></div>
          <div><span>Từ vựng</span><b>${pr.known}/${v.words}</b><div class="bar vocab"><i style="width:${v.words ? (pr.known / v.words) * 100 : 0}%"></i></div></div>
        </div>
        <div class="actions">
          <a class="btn primary" href="watch.html?v=${v.slug}">${icon("play", 16)} ${pr.started ? "Tiếp tục" : "Bắt đầu"}</a>
          <a class="btn" href="vocab.html?v=${v.slug}">${icon("book", 16)} Từ vựng</a>
        </div>
      </div>`;
    thumb(el.querySelector("img"), v);
    el.querySelector("h3 a").textContent = v.title;
    el.querySelector(".ch").textContent = v.channel;
    return el;
  }

  function addCard() {
    const el = document.createElement("article");
    el.className = "add-card";
    el.innerHTML = `<div class="plus">${icon("plus", 24)}</div><b>Video tiếp theo</b>
      <div>Thêm thư mục vào <code>data/videos</code> rồi chạy <code>npm run build</code></div>`;
    return el;
  }

  function renderContinue(videos) {
    const last = read("learn-english:last");
    const v = videos.find((x) => x.slug === last.slug);
    if (!v) { $("#hello-title").textContent = "Chào bạn! Bắt đầu học thôi"; return; }
    const pr = progress(v);
    $("#continue").hidden = false;
    thumb($("#c-img"), v);
    $("#c-title").textContent = v.title;
    $("#c-where").textContent = `Phần ${pr.part.id}/${v.parts} · ${pr.part.title} · ${fmtDur(pr.partTime)} / ${fmtDur(pr.part.len)}`;
    $("#c-bar").style.width = pr.pct + "%";
    $("#c-link").href = $("#c-watch").href = `watch.html?v=${v.slug}`;
    $("#c-vocab").href = `vocab.html?v=${v.slug}`;
  }

  function renderChips(videos) {
    const s = streak();
    const el = $("#streak");
    el.innerHTML = `${icon("flame")} ${s.days ? `Chuỗi ${s.days} ngày` : "Bắt đầu chuỗi ngày học"}`;
    el.classList.toggle("idle", !s.today);
    el.title = s.today ? "Hôm nay bạn đã học rồi" : s.days ? "Học hôm nay để giữ chuỗi" : "Xem video hoặc đánh dấu từ để bắt đầu chuỗi";
    const known = videos.reduce((n, v) => n + progress(v).known, 0);
    $("#known-total").innerHTML = `${icon("star")} ${known} từ đã thuộc`;
  }

  async function boot() {
    let videos = [];
    try { videos = await fetch("data/videos.json", { cache: "no-cache" }).then((r) => r.json()); } catch {}
    $("#count").textContent = `${videos.length} video`;
    renderChips(videos);
    renderContinue(videos);
    const grid = $("#videos");
    videos.forEach((v) => grid.appendChild(card(v)));
    grid.appendChild(addCard());
  }
  boot();
})();
