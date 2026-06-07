/**
 * slopsmith-plugin-shuffle — screen.js  (v3)
 *
 * v3 plugin-api compatibility:
 *   - Uses window.slopsmith.on("song:ended"|"song:ready") for all event listeners
 *   - song:ended payload includes { audioT, chartT, perfNow } (v3 enriched)
 *   - Reads window.slopsmith.isPlaying for autoplay guard
 *   - MutationObserver fallback for nd-summary-overlay (note_detect)
 *
 * New in v3: tuning filter (reads /api/plugins/shuffle/tunings, lets user pick)
 */
(function () {
  "use strict";

  const HISTORY_MAX = 20;
  const AVOID_MAX   = 5;
  const LANG_KEY    = "shuffle.lang";

  const STRINGS = {
    es: {
      subtitle:     "Reproducción aleatoria de tu biblioteca",
      pressToStart: "Pulsa Shuffle para empezar",
      nextSong:     "⬇️ PRÓXIMA CANCIÓN",
      shuffleBtn:   "🔀 Shuffle",
      repeatBtn:    "↩ Repetir",
      repeatTitle:  "Repetir canción actual",
      autoAdvance:  "Avance automático al terminar la canción",
      delayWait:    "⏱️ Esperar antes de siguiente (segundos)",
      antiRepeat:   "Evitar repetir las últimas 5 canciones",
      filterArtist: "Filtrar por artista",
      filterTuning: "Filtrar por afinación",
      allArtists:   "— Todos los artistas —",
      allTunings:   "— Todas las afinaciones —",
      langLabel:    "Idioma",
      recentHistory:"Historial reciente",
      noHistory:    "Sin historial todavía",
      noTitle:      "Sin título",
      unknownArtist:"Artista desconocido",
      tuningPrefix: "Afinación: ",
      searching:    "Buscando canción…",
      noSongs:      "⚠ No hay canciones con esa afinación/artista.",
      networkError: "❌ Error de red",
      popupNext:    "Siguiente",
      popupShuffle: "Shuffle",
      libBtnTitle:  "Reproducir canción aleatoria",
    },
    en: {
      subtitle:     "Random playback from your library",
      pressToStart: "Press Shuffle to start",
      nextSong:     "⬇️ UP NEXT",
      shuffleBtn:   "🔀 Shuffle",
      repeatBtn:    "↩ Repeat",
      repeatTitle:  "Replay current song",
      autoAdvance:  "Auto-advance when song ends",
      delayWait:    "⏱️ Wait before next (seconds)",
      antiRepeat:   "Avoid repeating last 5 songs",
      filterArtist: "Filter by artist",
      filterTuning: "Filter by tuning",
      allArtists:   "— All artists —",
      allTunings:   "— All tunings —",
      langLabel:    "Language",
      recentHistory:"Recent history",
      noHistory:    "No history yet",
      noTitle:      "Untitled",
      unknownArtist:"Unknown artist",
      tuningPrefix: "Tuning: ",
      searching:    "Finding a song…",
      noSongs:      "⚠ No songs with that tuning/artist.",
      networkError: "❌ Network error",
      popupNext:    "Up next",
      popupShuffle: "Shuffle",
      libBtnTitle:  "Play a random song",
    },
  };

  let currentLang = "es";
  let history      = [];
  let currentSong  = null;
  let nextSong     = null;
  let advanceTimer = null;
  let isAdvancing  = false;
  let popupElement = null;
  let buttonInjected     = false;
  let pendingAutoplay    = false;
  let songReadyHandler   = null;
  let songEndedHandler   = null;
  let accuracyObserver   = null;
  let lastEndHandledAt   = 0;

  const log   = (m) => console.log("[Shuffle]", m);
  const error = (m) => console.error("[Shuffle]", m);
  const $     = (id) => document.getElementById(id);
  const t     = (k)  => STRINGS[currentLang]?.[k] ?? STRINGS.es[k] ?? k;

  // ── i18n ──────────────────────────────────────────────────────────────
  function loadLang() {
    try { const s = localStorage.getItem(LANG_KEY); if (s === "en" || s === "es") currentLang = s; } catch (_) {}
  }
  function setLang(lang) {
    currentLang = lang === "en" ? "en" : "es";
    try { localStorage.setItem(LANG_KEY, currentLang); } catch (_) {}
    applyUiLanguage();
  }
  function applyUiLanguage() {
    document.querySelectorAll("[data-i18n]").forEach(el => { const k = el.getAttribute("data-i18n"); if (k) el.textContent = t(k); });
    document.querySelectorAll("[data-i18n-title]").forEach(el => { const k = el.getAttribute("data-i18n-title"); if (k) el.title = t(k); });
    const langSel = $("shuffle-lang");
    if (langSel) langSel.value = currentLang;
    const allArtOpt = $("shuffle-artist-filter")?.querySelector('option[value=""]');
    if (allArtOpt) allArtOpt.textContent = t("allArtists");
    const allTunOpt = $("shuffle-tuning-filter")?.querySelector('option[value=""]');
    if (allTunOpt) allTunOpt.textContent = t("allTunings");
    document.querySelectorAll(".shuffle-lib-btn").forEach(b => { b.title = t("libBtnTitle"); });
    if (currentSong) refreshNowPlaying(currentSong);
    else {
      const el = $("shuffle-now-playing");
      if (el?.classList.contains("empty")) el.innerHTML = `<span style="color:#444">${esc(t("pressToStart"))}</span>`;
    }
    updateNextSongDisplay();
    renderHistory();
  }
  function setupLangSelector() {
    loadLang();
    const sel = $("shuffle-lang");
    if (!sel) return;
    sel.value = currentLang;
    sel.addEventListener("change", () => setLang(sel.value));
    applyUiLanguage();
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function esc(str) {
    return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function setStatus(msg, isErr) {
    const el = $("shuffle-status");
    if (el) { el.innerHTML = msg || ""; el.className = "shuffle-status" + (isErr ? " error" : ""); }
  }
  function getDelaySeconds() {
    const el = $("shuffle-delay-seconds");
    if (el) return parseFloat(el.value || "5");
    try { const s = localStorage.getItem("shuffle.delaySeconds"); if (s != null) return parseFloat(s) || 5; } catch (_) {}
    return 5;
  }
  function saveDelaySeconds() {
    const el = $("shuffle-delay-seconds");
    if (!el) return;
    try { localStorage.setItem("shuffle.delaySeconds", el.value); } catch (_) {}
  }

  // ── Settings persistence ──────────────────────────────────────────────
  function getShuffleSettings() {
    const artistEl = $("shuffle-artist-filter");
    const tuningEl = $("shuffle-tuning-filter");
    const antiEl   = $("shuffle-anti-repeat");
    let artist = "", tuning = "", antiRepeat = true;
    try {
      artist    = localStorage.getItem("shuffle.artistFilter") || "";
      tuning    = localStorage.getItem("shuffle.tuningFilter") || "";
      const sa  = localStorage.getItem("shuffle.antiRepeat");
      if (sa != null) antiRepeat = sa !== "false";
    } catch (_) {}
    if (artistEl) artist    = artistEl.value || "";
    if (tuningEl) tuning    = tuningEl.value || "";
    if (antiEl)   antiRepeat = antiEl.checked !== false;
    return { artist, tuning, antiRepeat };
  }
  function saveShuffleSettings() {
    const artistEl = $("shuffle-artist-filter");
    const tuningEl = $("shuffle-tuning-filter");
    const antiEl   = $("shuffle-anti-repeat");
    try {
      if (artistEl) localStorage.setItem("shuffle.artistFilter", artistEl.value || "");
      if (tuningEl) localStorage.setItem("shuffle.tuningFilter", tuningEl.value || "");
      if (antiEl)   localStorage.setItem("shuffle.antiRepeat", String(antiEl.checked));
    } catch (_) {}
  }

  // ── Popup ─────────────────────────────────────────────────────────────
  function removeNextSongPopup() {
    if (!popupElement) return;
    if (popupElement._countdownInterval) clearInterval(popupElement._countdownInterval);
    if (popupElement._dismissTimeout) clearTimeout(popupElement._dismissTimeout);
    popupElement.remove();
    popupElement = null;
  }
  function songArtUrl(filename) { return filename ? `/api/song/${encodeURIComponent(filename)}/art` : ""; }

  function ensurePopupStyles() {
    if ($("shuffle-popup-styles")) return;
    const style = document.createElement("style");
    style.id = "shuffle-popup-styles";
    style.textContent = `
      @keyframes shuffle-popup-in { from{opacity:0;transform:translateX(-50%) translateY(-12px) scale(0.96)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
      @keyframes shuffle-count-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
      #shuffle-next-popup { position:fixed;top:96px;left:50%;transform:translateX(-50%);z-index:10050;pointer-events:none;font-family:system-ui,-apple-system,sans-serif;min-width:440px;max-width:540px;border-radius:20px;overflow:hidden;animation:shuffle-popup-in 0.35s cubic-bezier(0.22,1,0.36,1) forwards;box-shadow:0 0 0 1px rgba(139,92,246,.35),0 20px 60px rgba(0,0,0,.55),0 0 80px rgba(91,79,255,.15);transition:opacity .3s ease }
      #shuffle-next-popup .sp-bg { position:absolute;inset:0;background-size:cover;background-position:center;filter:blur(28px) saturate(1.4);transform:scale(1.15);opacity:.45 }
      #shuffle-next-popup .sp-overlay { position:absolute;inset:0;background:linear-gradient(135deg,rgba(18,16,32,.92) 0%,rgba(28,22,48,.88) 100%) }
      #shuffle-next-popup .sp-inner { position:relative;padding:22px 28px 20px }
      #shuffle-next-popup .sp-label { font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#a78bfa;margin-bottom:14px;opacity:.9 }
      #shuffle-next-popup .sp-row { display:flex;align-items:center;gap:22px;margin-bottom:18px }
      #shuffle-next-popup .sp-art { flex-shrink:0;width:104px;height:104px;border-radius:14px;overflow:hidden;background:#0d0d14;box-shadow:0 8px 24px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center }
      #shuffle-next-popup .sp-art img { width:100%;height:100%;object-fit:cover }
      #shuffle-next-popup .sp-text { flex:1;min-width:0 }
      #shuffle-next-popup .sp-title { font-size:30px;font-weight:800;color:#fff;letter-spacing:-.03em;line-height:1.15;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap }
      #shuffle-next-popup .sp-artist { font-size:18px;font-weight:500;color:rgba(255,255,255,.72);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap }
      #shuffle-next-popup .sp-album { font-size:15px;color:rgba(255,255,255,.42);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap }
      #shuffle-next-popup .sp-tuning { display:inline-block;font-size:12px;font-weight:600;letter-spacing:.04em;color:#c4b5fd;background:rgba(139,92,246,.18);border:1px solid rgba(139,92,246,.35);border-radius:20px;padding:3px 10px }
      #shuffle-next-popup .sp-count-wrap { display:flex;align-items:center;justify-content:center;padding-top:4px;border-top:1px solid rgba(255,255,255,.07) }
      #shuffle-next-popup .sp-count { font-size:64px;font-weight:800;line-height:1;letter-spacing:-.04em;background:linear-gradient(180deg,#e9d5ff 0%,#8b5cf6 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shuffle-count-pulse 1s ease-in-out infinite }
    `;
    document.head.appendChild(style);
  }

  function showNextSongPopup(song, opts = {}) {
    const countdownSec = opts.countdownSec ?? null;
    const onComplete   = opts.onComplete   || null;
    removeNextSongPopup();
    ensurePopupStyles();
    const artUrl = songArtUrl(song.filename);
    popupElement = document.createElement("div");
    popupElement.id = "shuffle-next-popup";
    const bg = document.createElement("div"); bg.className = "sp-bg";
    if (artUrl) bg.style.backgroundImage = `url("${artUrl}")`;
    const overlay = document.createElement("div"); overlay.className = "sp-overlay";
    const inner   = document.createElement("div"); inner.className   = "sp-inner";
    const label   = document.createElement("div"); label.className   = "sp-label"; label.textContent = opts.label || t("popupNext");
    const row     = document.createElement("div"); row.className     = "sp-row";
    const artWrap = document.createElement("div"); artWrap.className = "sp-art";
    const artImg  = document.createElement("img"); artImg.src = artUrl; artImg.alt = "";
    artImg.onerror = () => { artWrap.innerHTML = '<span style="font-size:40px;opacity:.45">🎸</span>'; };
    artWrap.appendChild(artImg);
    const textCol = document.createElement("div"); textCol.className = "sp-text";
    const titleEl = document.createElement("div"); titleEl.className = "sp-title"; titleEl.textContent = song.title || t("noTitle");
    textCol.appendChild(titleEl);
    if (song.artist) { const a = document.createElement("div"); a.className = "sp-artist"; a.textContent = song.artist; textCol.appendChild(a); }
    if (song.album)  { const a = document.createElement("div"); a.className = "sp-album";  a.textContent = song.album;  textCol.appendChild(a); }
    if (song.tuning) { const a = document.createElement("div"); a.className = "sp-tuning"; a.textContent = `🎸 ${song.tuning}`; textCol.appendChild(a); }
    row.appendChild(artWrap); row.appendChild(textCol);
    inner.appendChild(label); inner.appendChild(row);
    if (countdownSec) {
      const cw = document.createElement("div"); cw.className = "sp-count-wrap";
      const cd = document.createElement("div"); cd.className = "sp-count";
      let rem = Math.ceil(countdownSec); cd.textContent = String(rem);
      cw.appendChild(cd); inner.appendChild(cw);
      const iv = setInterval(() => { rem--; if (rem >= 0) cd.textContent = String(rem); else clearInterval(iv); }, 1000);
      popupElement._countdownInterval = iv;
      popupElement._dismissTimeout = setTimeout(() => {
        if (!popupElement) return;
        clearInterval(popupElement._countdownInterval);
        popupElement.style.opacity = "0";
        setTimeout(() => { removeNextSongPopup(); if (onComplete) onComplete(); }, 300);
      }, countdownSec * 1000);
    }
    popupElement.appendChild(bg); popupElement.appendChild(overlay); popupElement.appendChild(inner);
    document.body.appendChild(popupElement);
  }

  // ── note_detect overlay detection ────────────────────────────────────
  function findAccuracyOverlay() { return document.querySelector(".nd-summary-overlay"); }
  function isAccuracyOverlayVisible(o) { if (!o || o.style.display === "none") return false; return o.getBoundingClientRect().height > 0; }
  function closeAccuracyScreen() {
    const o = findAccuracyOverlay();
    if (o && isAccuracyOverlayVisible(o)) {
      const btn = o.querySelector(".nd-summary-close");
      if (btn) { btn.click(); return true; }
      o.remove(); return true;
    }
    return false;
  }

  // ── Autoplay (v3: uses window.slopsmith.on("song:ready")) ─────────────
  function tryAutoPlay(attempt) {
    if (window.slopsmith?.isPlaying) { log("Autoplay: already playing."); return; }
    log(`Autoplay attempt ${attempt + 1}…`);
    if (typeof window.togglePlay === "function") Promise.resolve(window.togglePlay()).catch(() => {});
    else document.getElementById("btn-play")?.click();
    if (attempt < 4 && !window.slopsmith?.isPlaying) setTimeout(() => tryAutoPlay(attempt + 1), 400);
  }

  function setupAutoplayListener() {
    if (!window.slopsmith || songReadyHandler) return;
    songReadyHandler = () => {
      if (!pendingAutoplay) return;
      pendingAutoplay = false;
      log("song:ready — starting autoplay.");
      setTimeout(() => tryAutoPlay(0), 150);
    };
    window.slopsmith.on("song:ready", songReadyHandler);
  }

  // ── Open song ─────────────────────────────────────────────────────────
  function openSong(song, opts = {}) {
    if (!song?.filename) return;
    log(`Opening: ${song.filename}`);
    if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; isAdvancing = false; }
    if (!opts.keepPopup) removeNextSongPopup();
    if (typeof window.playSong === "function") {
      pendingAutoplay = true;
      setupAutoplayListener();
      window.playSong(song.filename);
      setTimeout(syncCurrentSongFromPlayer, 1000);
    } else {
      pendingAutoplay = false;
      error("window.playSong not available");
    }
  }

  function syncCurrentSongFromPlayer() {
    const playing = window.player?.currentSong || window.currentSong;
    if (playing?.filename && (!currentSong || currentSong.filename !== playing.filename)) {
      currentSong = playing;
      refreshNowPlaying(currentSong);
      if (!history.some(s => s.filename === currentSong.filename)) addToHistory(currentSong);
    }
  }

  // ── Fetch random song ─────────────────────────────────────────────────
  function _buildFetchParams(extra = {}) {
    const { artist, tuning, antiRepeat } = getShuffleSettings();
    let avoid = antiRepeat ? history.slice(-AVOID_MAX).map(s => s.filename) : [];
    if (currentSong?.filename) avoid.push(currentSong.filename);
    const params = new URLSearchParams();
    if (artist)      params.set("artist", artist);
    if (tuning)      params.set("tuning", tuning);
    if (avoid.length) params.set("avoid", avoid.join(","));
    return params;
  }

  function fetchNextSong() {
    const params = _buildFetchParams();
    log("Prefetching next song…");
    return fetch(`/api/plugins/shuffle/next?${params}`)
      .then(r => r.json())
      .then(d => { nextSong = d.error ? null : d; updateNextSongDisplay(); })
      .catch(() => { nextSong = null; updateNextSongDisplay(); });
  }

  function pickRandom() {
    if (isAdvancing) { log("pickRandom ignored: already advancing"); return; }
    setStatus(`<span class="shuffle-spinner"></span>${esc(t("searching"))}`);
    const params = _buildFetchParams();
    log("Requesting random song…");
    fetch(`/api/plugins/shuffle/random?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error === "no_songs") { setStatus(t("noSongs"), true); return; }
        if (d.error)                { setStatus(`❌ ${esc(d.error)}`, true); return; }
        setStatus("");
        navigateTo(d, { showPopup: true });
        fetchNextSong();
      })
      .catch(() => setStatus(t("networkError"), true));
  }

  function navigateTo(song, opts = {}) {
    if (!song) return;
    log(`Navigating to: ${song.title}`);
    currentSong = song;
    addToHistory(song);
    refreshNowPlaying(song);
    const btn = $("shuffle-btn-again");
    if (btn) btn.disabled = false;
    if (opts.showPopup) {
      const delaySec = getDelaySeconds();
      if (delaySec <= 0) openSong(song);
      else showNextSongPopup(song, { label: t("popupShuffle"), countdownSec: delaySec, onComplete: () => openSong(song) });
    } else {
      openSong(song);
    }
  }

  // ── History ───────────────────────────────────────────────────────────
  function addToHistory(song) {
    if (!song?.filename) return;
    history = history.filter(s => s.filename !== song.filename);
    history.push(song);
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    renderHistory();
    fetchNextSong();
  }
  function renderHistory() {
    const list = $("shuffle-history"), empty = $("shuffle-history-empty");
    if (!list) return;
    Array.from(list.children).forEach(c => { if (c.id !== "shuffle-history-empty") c.remove(); });
    const rev = history.slice().reverse();
    if (!rev.length) { if (empty) { empty.style.display = ""; empty.textContent = t("noHistory"); } return; }
    if (empty) empty.style.display = "none";
    rev.forEach((song, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="shuffle-hist-title">${esc(song.title || t("noTitle"))}</span><span class="shuffle-hist-artist">${esc(song.artist || "")}</span>`;
      if (i === 0) li.style.borderColor = "#5b4fff";
      li.addEventListener("click", () => openSong(song));
      list.appendChild(li);
    });
  }

  // ── Now Playing ───────────────────────────────────────────────────────
  function refreshNowPlaying(song) {
    const el = $("shuffle-now-playing");
    if (!el) return;
    el.classList.remove("empty");
    el.innerHTML = `
      <div class="shuffle-song-title">${esc(song.title || t("noTitle"))}</div>
      <div class="shuffle-song-artist">${esc(song.artist || t("unknownArtist"))}</div>
      <div class="shuffle-song-album">${esc(song.album || "")}</div>
      ${song.tuning ? `<div style="font-size:.78rem;color:#a78bfa;margin-top:2px">🎸 ${esc(song.tuning)}</div>` : ""}
    `;
  }
  function updateNextSongDisplay() {
    const titleEl  = $("shuffle-next-title");
    const artistEl = $("shuffle-next-artist");
    const tuningEl = $("shuffle-next-tuning");
    if (!titleEl) return;
    if (!nextSong) { titleEl.innerText = "—"; artistEl.innerText = "—"; if (tuningEl) tuningEl.innerText = ""; return; }
    titleEl.innerText  = nextSong.title  || t("noTitle");
    artistEl.innerText = nextSong.artist || t("unknownArtist");
    if (tuningEl) tuningEl.innerText = nextSong.tuning ? `${t("tuningPrefix")}${nextSong.tuning}` : "";
  }

  // ── Populate dropdowns ────────────────────────────────────────────────
  function populateArtists() {
    const sel = $("shuffle-artist-filter");
    if (!sel) return;
    fetch("/api/plugins/shuffle/artists")
      .then(r => r.json())
      .then(d => {
        (d.artists || []).forEach(a => { const o = document.createElement("option"); o.value = a; o.textContent = a; sel.appendChild(o); });
        try { const s = localStorage.getItem("shuffle.artistFilter"); if (s) sel.value = s; } catch (_) {}
      })
      .catch(e => error("Artists fetch error: " + e));
  }

  function populateTunings() {
    const sel = $("shuffle-tuning-filter");
    if (!sel) return;
    fetch("/api/plugins/shuffle/tunings")
      .then(r => r.json())
      .then(d => {
        (d.tunings || []).forEach(tu => { const o = document.createElement("option"); o.value = tu; o.textContent = tu; sel.appendChild(o); });
        try { const s = localStorage.getItem("shuffle.tuningFilter"); if (s) sel.value = s; } catch (_) {}
      })
      .catch(e => error("Tunings fetch error: " + e));
  }

  // ── Auto-advance ──────────────────────────────────────────────────────
  function beginAutoAdvanceSequence() {
    const autoAdvance = $("shuffle-auto-advance");
    if (!autoAdvance?.checked) return;
    if (isAdvancing) return;
    const now = Date.now();
    if (now - lastEndHandledAt < 1500) return;
    lastEndHandledAt = now;
    log("Song ended — starting auto-advance sequence.");
    if (!nextSong) fetchNextSong().then(() => { if (nextSong) triggerAutoAdvance(); else error("Could not prefetch next song."); });
    else triggerAutoAdvance();
  }

  // v3: window.slopsmith.on("song:ended", handler)
  // payload includes { audioT, chartT, perfNow } — we don't need them but
  // accept the full payload to be forward-compatible
  function setupSongEndedListener() {
    if (!window.slopsmith || songEndedHandler) return;
    songEndedHandler = (_payload) => {
      requestAnimationFrame(beginAutoAdvanceSequence);
    };
    window.slopsmith.on("song:ended", songEndedHandler);
    log("song:ended listener registered (v3 API).");
  }

  function setupAccuracyObserver() {
    if (accuracyObserver) return;
    accuracyObserver = new MutationObserver(mutations => {
      if (isAdvancing) return;
      if (!$("shuffle-auto-advance")?.checked) return;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          const overlay = node.classList?.contains("nd-summary-overlay") ? node : node.querySelector?.(".nd-summary-overlay");
          if (overlay && isAccuracyOverlayVisible(overlay)) { beginAutoAdvanceSequence(); return; }
        }
      }
    });
    accuracyObserver.observe(document.body, { childList: true, subtree: true });
  }

  function triggerAutoAdvance() {
    if (isAdvancing) return;
    isAdvancing = true;
    const delaySec = getDelaySeconds();
    const songToPlay = nextSong;
    log(`Auto-advance: ${delaySec}s countdown.`);
    setStatus("");
    if (songToPlay) showNextSongPopup(songToPlay, { label: t("popupNext"), countdownSec: delaySec });
    if (advanceTimer) clearTimeout(advanceTimer);
    advanceTimer = setTimeout(() => {
      log("Closing accuracy screen and advancing.");
      closeAccuracyScreen();
      removeNextSongPopup();
      if (songToPlay) { const played = songToPlay; nextSong = null; navigateTo(played); }
      else pickRandom();
      isAdvancing = false;
      setStatus("");
    }, delaySec * 1000);
  }

  // ── Library button injection ──────────────────────────────────────────
  function ensureShuffleLibStyles() {
    if ($("shuffle-lib-styles")) return;
    const s = document.createElement("style"); s.id = "shuffle-lib-styles";
    s.textContent = `.shuffle-lib-btn{background:rgba(160,120,255,.12);border:1px solid rgba(160,120,255,.3);color:#e9d5ff;padding:8px 12px;border-radius:12px;font-size:13px;cursor:pointer;transition:background .15s;display:inline-flex;align-items:center;gap:6px}.shuffle-lib-btn:hover{background:rgba(160,120,255,.22)}`;
    document.head.appendChild(s);
  }

  function injectShuffleButtonBefore(viewGridBtnId) {
    const viewGridBtn = document.getElementById(viewGridBtnId);
    if (!viewGridBtn) return false;
    const viewToggle = viewGridBtn.parentElement;
    const toolbar    = viewToggle?.parentElement;
    if (!toolbar) return false;
    ensureShuffleLibStyles();
    let btn = toolbar.querySelector(":scope > .shuffle-lib-btn");
    if (!btn) {
      btn = document.createElement("button"); btn.type = "button"; btn.className = "shuffle-lib-btn";
      btn.innerHTML = t("shuffleBtn"); btn.title = t("libBtnTitle");
      btn.addEventListener("click", e => { e.stopPropagation(); pickRandom(); });
      toolbar.insertBefore(btn, viewToggle);
    } else if (btn.nextElementSibling !== viewToggle) {
      toolbar.insertBefore(btn, viewToggle);
    } else {
      btn.innerHTML = t("shuffleBtn"); btn.title = t("libBtnTitle");
    }
    return true;
  }

  function injectLibraryButton() {
    const ok = injectShuffleButtonBefore("view-grid-btn") | injectShuffleButtonBefore("fav-view-grid-btn");
    if (ok) {
      if (!buttonInjected) log("✅ Shuffle button injected in library toolbar.");
      buttonInjected = true;
    } else {
      log("Toolbar not found yet. Retrying in 1s…");
      setTimeout(injectLibraryButton, 1000);
    }
  }

  // ── Screen controls ───────────────────────────────────────────────────
  function bindScreenControls() {
    const bind = (id, fn) => { const el = $(id); if (el && !el.dataset.shuffleBound) { el.dataset.shuffleBound = "1"; fn(el); } };
    bind("shuffle-btn-main",  el => el.addEventListener("click", pickRandom));
    bind("shuffle-btn-again", el => el.addEventListener("click", () => { if (currentSong) openSong(currentSong); }));
    bind("shuffle-delay-seconds", el => {
      try { const s = localStorage.getItem("shuffle.delaySeconds"); if (s) el.value = s; } catch (_) {}
      el.addEventListener("change", saveDelaySeconds);
      el.addEventListener("input",  saveDelaySeconds);
    });
    bind("shuffle-artist-filter", el => el.addEventListener("change", saveShuffleSettings));
    bind("shuffle-tuning-filter", el => el.addEventListener("change", saveShuffleSettings));
    bind("shuffle-anti-repeat", el => {
      try { const s = localStorage.getItem("shuffle.antiRepeat"); if (s) el.checked = s !== "false"; } catch (_) {}
      el.addEventListener("change", saveShuffleSettings);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────
  function initScreen() {
    log("Initialising Shuffle screen (v3)");
    setupLangSelector();
    setupAutoplayListener();
    setupSongEndedListener();
    setupAccuracyObserver();
    populateArtists();
    populateTunings();
    bindScreenControls();
    renderHistory();
    if (currentSong) refreshNowPlaying(currentSong);
    fetchNextSong();
    injectLibraryButton();
    if (!window._shuffleSyncInterval) window._shuffleSyncInterval = setInterval(syncCurrentSongFromPlayer, 3000);
  }

  function bootstrap() {
    loadLang();
    if (window.slopsmith) { setupSongEndedListener(); setupAccuracyObserver(); }
    injectLibraryButton();
  }

  window.shufflePluginPickRandom = pickRandom;

  bootstrap();

  if (window.slopsmith?.onScreenLoad) {
    window.slopsmith.onScreenLoad("shuffle", initScreen);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { bootstrap(); initScreen(); });
  } else {
    initScreen();
  }
})();
