// Shared by all pages: inline SVG icons + the daily study streak.
(() => {
  "use strict";
  const S = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
  const F = 'fill="currentColor"';
  const ICONS = {
    play: `<path ${F} d="M8 5v14l11-7z"/>`,
    pause: `<path ${F} d="M6 5h4v14H6zM14 5h4v14h-4z"/>`,
    prev: `<path ${F} d="M6 5h2.5v14H6zM20 5v14L9.5 12z"/>`,
    next: `<path ${F} d="M15.5 5H18v14h-2.5zM4 5v14l10.5-7z"/>`,
    replay: `<g ${S}><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/></g>`,
    back: `<path ${S} d="M15 5l-7 7 7 7"/>`,
    forward: `<path ${S} d="M9 5l7 7-7 7"/>`,
    check: `<path ${S} d="M5 12l5 5 9-10"/>`,
    x: `<path ${S} d="M6 6l12 12M18 6L6 18"/>`,
    plus: `<path ${S} d="M12 5v14M5 12h14"/>`,
    book: `<g ${S}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M9 8h6"/></g>`,
    video: `<g ${S}><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/></g>`,
    speaker: `<g ${S}><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></g>`,
    shuffle: `<g ${S}><path d="M3 7h3c5 0 7 10 12 10h3M3 17h3c1.6 0 2.9-1 4-2.4M14 9.400C15.100 8 16.400 7 18 7h3"/><path d="M18.500 4.500L21 7l-2.500 2.500M18.500 14.500L21 17l-2.500 2.500"/></g>`,
    list: `<path ${S} d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>`,
    cards: `<g ${S}><rect x="3" y="7" width="13" height="13" rx="2.5"/><path d="M8 4h10a3 3 0 0 1 3 3v10"/></g>`,
    flame: `<path fill="#FF8A3D" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-2 1-3.500 2-4.500.5 2 1.500 2.500 2 2.500C10 9 10 5 12 2z"/>`,
    star: `<path fill="#FFCB45" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 2.500l2.900 6 6.600.900-4.800 4.600 1.200 6.500L12 17.400l-5.900 3.100 1.200-6.500L2.500 9.400l6.600-.900z"/>`,
  };
  const icon = (name, size = 18) =>
    `<svg class="ic" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24">${ICONS[name] || ""}</svg>`;

  // <i data-icon="play" data-size="20"></i> -> inline SVG
  function hydrate(root = document) {
    root.querySelectorAll("i[data-icon]").forEach((el) => { el.outerHTML = icon(el.dataset.icon, +el.dataset.size || 18); });
  }

  // ---- streak: days on which the user studied (played a video or marked a word)
  const KEY = "learn-english:days";
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const readDays = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  function markStudyDay() {
    const days = readDays(), k = dayKey(new Date());
    if (days[k]) return;
    days[k] = 1;
    try { localStorage.setItem(KEY, JSON.stringify(days)); } catch {}
  }
  // consecutive days ending today (or yesterday, if today has no study yet)
  function streak() {
    const days = readDays(), d = new Date();
    const today = !!days[dayKey(d)];
    if (!today) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return { days: n, today };
  }

  window.LE = { icon, hydrate, markStudyDay, streak };
  document.addEventListener("DOMContentLoaded", () => hydrate());
})();
