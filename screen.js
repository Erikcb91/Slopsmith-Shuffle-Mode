/**
 * slopsmith-plugin-shuffle — screen.js
 * Detecta fin de canción vía song:ended y popup .nd-summary-overlay (note_detect).
 */

(function () {
  const HISTORY_MAX = 20;
  const AVOID_MAX   = 5;
  const LANG_KEY    = "shuffle.lang";

  const STRINGS = {
    es: {
      subtitle: "Reproducción aleatoria de tu biblioteca",
      pressToStart: "Pulsa Shuffle para empezar",
      nextSong: "⬇️ PRÓXIMA CANCIÓN",
      shuffleBtn: "🔀 Shuffle",
      repeatBtn: "↩ Repetir",
      repeatTitle: "Repetir canción actual",
      autoAdvance: "Avance automático al terminar la canción",
      delayWait: "⏱️ Esperar antes de siguiente (segundos)",
      antiRepeat: "Evitar repetir las últimas 5 canciones",
      filterArtist: "Filtrar por artista",
      allArtists: "— Todos los artistas —",
      langLabel: "Idioma",
      recentHistory: "Historial reciente",
      noHistory: "Sin historial todavía",
      noTitle: "Sin título",
      unknownArtist: "Artista desconocido",
      tuningPrefix: "Afinación: ",
      searching: "Buscando canción…",
      noSongs: "⚠ No hay canciones.",
      networkError: "❌ Error de red",
      popupNext: "Siguiente",
      popupShuffle: "Shuffle",
      libBtnTitle: "Reproducir canción aleatoria",
    },
    en: {
      subtitle: "Random playback from your library",
      pressToStart: "Press Shuffle to start",
      nextSong: "⬇️ UP NEXT",
      shuffleBtn: "🔀 Shuffle",
      repeatBtn: "↩ Repeat",
      repeatTitle: "Replay current song",
      autoAdvance: "Auto-advance when song ends",
      delayWait: "⏱️ Wait before next (seconds)",
      antiRepeat: "Avoid repeating last 5 songs",
      filterArtist: "Filter by artist",
      allArtists: "— All artists —",
      langLabel: "Language",
      recentHistory: "Recent history",
      noHistory: "No history yet",
      noTitle: "Untitled",
      unknownArtist: "Unknown artist",
      tuningPrefix: "Tuning: ",
      searching: "Finding a song…",
      noSongs: "⚠ No songs found.",
      networkError: "❌ Network error",
      popupNext: "Up next",
      popupShuffle: "Shuffle",
      libBtnTitle: "Play a random song",
    },
  };

  let currentLang = "es";
  let history      = [];
  let currentSong  = null;
  let nextSong     = null;
  let advanceTimer = null;
  let isAdvancing  = false;
  let popupElement = null;
  let buttonInjected = false;
  let pendingAutoplay = false;
  let autoplaySongReadyHandler = null;
  let songEndedHandler = null;
  let accuracyObserver = null;
  let lastEndHandledAt = 0;

  function log(msg) { console.log("[Shuffle]", msg); }
  function error(msg) { console.error("[Shuffle]", msg); }

  const $ = (id) => document.getElementById(id);

  function t(key) {
    return STRINGS[currentLang]?.[key] ?? STRINGS.es[key] ?? key;
  }

  function loadLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "en" || saved === "es") currentLang = saved;
    } catch (_) {}
  }

  function setLang(lang) {
    currentLang = lang === "en" ? "en" : "es";
    try { localStorage.setItem(LANG_KEY, currentLang); } catch (_) {}
    applyUiLanguage();
  }

  function applyUiLanguage() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (key) el.title = t(key);
    });
    const langSel = $("shuffle-lang");
    if (langSel) langSel.value = currentLang;
    const allOpt = $("shuffle-artist-filter")?.querySelector('option[value=""]');
    if (allOpt) allOpt.textContent = t("allArtists");
    document.querySelectorAll(".shuffle-lib-btn").forEach((btn) => {
      btn.title = t("libBtnTitle");
    });
    if (currentSong) refreshNowPlaying(currentSong);
    else {
      const nowEl = $("shuffle-now-playing");
      if (nowEl?.classList.contains("empty")) {
        nowEl.innerHTML = `<span style="color:#444">${esc(t("pressToStart"))}</span>`;
      }
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

  function setStatus(msg, isErr) {
    const el = $("shuffle-status");
    if (el) {
      el.innerHTML = msg || "";
      el.className = "shuffle-status" + (isErr ? " error" : "");
    }
  }

  function esc(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function removeNextSongPopup() {
    if (!popupElement) return;
    if (popupElement._countdownInterval) clearInterval(popupElement._countdownInterval);
    if (popupElement._dismissTimeout) clearTimeout(popupElement._dismissTimeout);
    popupElement.remove();
    popupElement = null;
  }

  function songArtUrl(filename) {
    if (!filename) return "";
    return `/api/song/${encodeURIComponent(filename)}/art`;
  }

  function ensureShuffleLibStyles() {
    if (document.getElementById("shuffle-lib-styles")) return;
    const style = document.createElement("style");
    style.id = "shuffle-lib-styles";
    style.textContent = `
      .shuffle-lib-btn {
        background: rgba(160, 120, 255, 0.12);
        border: 1px solid rgba(160, 120, 255, 0.3);
        color: #e9d5ff;
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.15s;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .shuffle-lib-btn:hover { background: rgba(160, 120, 255, 0.22); }
    `;
    document.head.appendChild(style);
  }

  function getDelaySeconds() {
    const el = $("shuffle-delay-seconds");
    if (el) return parseFloat(el.value || "5");
    try {
      const saved = localStorage.getItem("shuffle.delaySeconds");
      if (saved != null) return parseFloat(saved) || 5;
    } catch (_) {}
    return 5;
  }

  function saveDelaySeconds() {
    const el = $("shuffle-delay-seconds");
    if (!el) return;
    try { localStorage.setItem("shuffle.delaySeconds", el.value); } catch (_) {}
  }

  function ensurePopupStyles() {
    if (document.getElementById("shuffle-popup-styles")) return;
    const style = document.createElement("style");
    style.id = "shuffle-popup-styles";
    style.textContent = `
      @keyframes shuffle-popup-in {
        from { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.96); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
      }
      @keyframes shuffle-count-pulse {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.06); }
      }
      #shuffle-next-popup {
        position: fixed;
        top: 96px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10050;
        pointer-events: none;
        font-family: system-ui, -apple-system, sans-serif;
        min-width: 440px;
        max-width: 540px;
        border-radius: 20px;
        overflow: hidden;
        animation: shuffle-popup-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        box-shadow:
          0 0 0 1px rgba(139, 92, 246, 0.35),
          0 20px 60px rgba(0, 0, 0, 0.55),
          0 0 80px rgba(91, 79, 255, 0.15);
        transition: opacity 0.3s ease;
      }
      #shuffle-next-popup .shuffle-popup-bg {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        filter: blur(28px) saturate(1.4);
        transform: scale(1.15);
        opacity: 0.45;
      }
      #shuffle-next-popup .shuffle-popup-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(18, 16, 32, 0.92) 0%, rgba(28, 22, 48, 0.88) 100%);
      }
      #shuffle-next-popup .shuffle-popup-inner {
        position: relative;
        padding: 22px 28px 20px;
      }
      #shuffle-next-popup .shuffle-popup-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #a78bfa;
        margin-bottom: 14px;
        opacity: 0.9;
      }
      #shuffle-next-popup .shuffle-popup-row {
        display: flex;
        align-items: center;
        gap: 22px;
        margin-bottom: 18px;
      }
      #shuffle-next-popup .shuffle-popup-art {
        flex-shrink: 0;
        width: 104px;
        height: 104px;
        border-radius: 14px;
        overflow: hidden;
        background: #0d0d14;
        box-shadow: 0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #shuffle-next-popup .shuffle-popup-art img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      #shuffle-next-popup .shuffle-popup-text {
        flex: 1;
        min-width: 0;
      }
      #shuffle-next-popup .shuffle-popup-title {
        font-size: 30px;
        font-weight: 800;
        color: #fff;
        letter-spacing: -0.03em;
        line-height: 1.15;
        margin-bottom: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #shuffle-next-popup .shuffle-popup-artist {
        font-size: 18px;
        font-weight: 500;
        color: rgba(255,255,255,0.72);
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #shuffle-next-popup .shuffle-popup-album {
        font-size: 15px;
        color: rgba(255,255,255,0.42);
        margin-bottom: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #shuffle-next-popup .shuffle-popup-tuning {
        display: inline-block;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: #c4b5fd;
        background: rgba(139, 92, 246, 0.18);
        border: 1px solid rgba(139, 92, 246, 0.35);
        border-radius: 20px;
        padding: 3px 10px;
      }
      #shuffle-next-popup .shuffle-popup-countdown-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        padding-top: 4px;
        border-top: 1px solid rgba(255,255,255,0.07);
      }
      #shuffle-next-popup .shuffle-popup-countdown {
        font-size: 64px;
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.04em;
        background: linear-gradient(180deg, #e9d5ff 0%, #8b5cf6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: shuffle-count-pulse 1s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }

  // --- Popup arriba-centro (cuenta atrás opcional) ---
  function showNextSongPopup(song, opts) {
    const options = typeof opts === "number"
      ? { countdownSec: opts }
      : (opts || {});
    const countdownSec = options.countdownSec ?? null;
    const onComplete = options.onComplete || null;

    removeNextSongPopup();
    ensurePopupStyles();

    const artUrl = songArtUrl(song.filename);

    popupElement = document.createElement("div");
    popupElement.id = "shuffle-next-popup";

    const bg = document.createElement("div");
    bg.className = "shuffle-popup-bg";
    if (artUrl) bg.style.backgroundImage = `url("${artUrl}")`;

    const overlay = document.createElement("div");
    overlay.className = "shuffle-popup-overlay";

    const inner = document.createElement("div");
    inner.className = "shuffle-popup-inner";

    const label = document.createElement("div");
    label.className = "shuffle-popup-label";
    label.textContent = options.label || t("popupNext");

    const row = document.createElement("div");
    row.className = "shuffle-popup-row";

    const artWrap = document.createElement("div");
    artWrap.className = "shuffle-popup-art";
    const artImg = document.createElement("img");
    artImg.src = artUrl;
    artImg.alt = "";
    artImg.onerror = () => {
      artWrap.innerHTML = '<span style="font-size:40px;opacity:0.45">🎸</span>';
    };
    artWrap.appendChild(artImg);

    const textCol = document.createElement("div");
    textCol.className = "shuffle-popup-text";

    const titleDiv = document.createElement("div");
    titleDiv.className = "shuffle-popup-title";
    titleDiv.textContent = song.title || t("noTitle");

    textCol.appendChild(titleDiv);
    if (song.artist) {
      const artistDiv = document.createElement("div");
      artistDiv.className = "shuffle-popup-artist";
      artistDiv.textContent = song.artist;
      textCol.appendChild(artistDiv);
    }
    if (song.album) {
      const albumDiv = document.createElement("div");
      albumDiv.className = "shuffle-popup-album";
      albumDiv.textContent = song.album;
      textCol.appendChild(albumDiv);
    }
    if (song.tuning) {
      const tuningDiv = document.createElement("div");
      tuningDiv.className = "shuffle-popup-tuning";
      tuningDiv.textContent = song.tuning;
      textCol.appendChild(tuningDiv);
    }

    row.appendChild(artWrap);
    row.appendChild(textCol);
    inner.appendChild(label);
    inner.appendChild(row);

    if (countdownSec) {
      const countWrap = document.createElement("div");
      countWrap.className = "shuffle-popup-countdown-wrap";
      const countdownDiv = document.createElement("div");
      countdownDiv.className = "shuffle-popup-countdown";
      let remaining = Math.ceil(countdownSec);
      countdownDiv.textContent = String(remaining);
      countWrap.appendChild(countdownDiv);
      inner.appendChild(countWrap);

      const countdownInterval = setInterval(() => {
        remaining--;
        if (remaining >= 0) {
          countdownDiv.textContent = String(remaining);
        } else {
          clearInterval(countdownInterval);
        }
      }, 1000);
      popupElement._countdownInterval = countdownInterval;

      popupElement._dismissTimeout = setTimeout(() => {
        if (!popupElement) return;
        clearInterval(popupElement._countdownInterval);
        popupElement.style.opacity = "0";
        setTimeout(() => {
          removeNextSongPopup();
          if (onComplete) onComplete();
        }, 300);
      }, countdownSec * 1000);
    }

    popupElement.appendChild(bg);
    popupElement.appendChild(overlay);
    popupElement.appendChild(inner);
    document.body.appendChild(popupElement);
  }

  function findAccuracyOverlay() {
    return document.querySelector(".nd-summary-overlay");
  }

  function isAccuracyOverlayVisible(overlay) {
    if (!overlay) return false;
    if (overlay.style.display === "none") return false;
    return overlay.getBoundingClientRect().height > 0;
  }

  // --- Cerrar popup de Accuracy (note_detect) ---
  function closeAccuracyScreen() {
    const overlay = findAccuracyOverlay();
    if (overlay && isAccuracyOverlayVisible(overlay)) {
      const closeBtn = overlay.querySelector(".nd-summary-close");
      if (closeBtn) {
        closeBtn.click();
        log("Accuracy cerrada (nd-summary-close).");
        return true;
      }
      overlay.remove();
      log("Accuracy eliminada (nd-summary-overlay).");
      return true;
    }
    return false;
  }

  function tryAutoPlay(attempt) {
    if (window.slopsmith?.isPlaying) {
      log("Autoplay: ya reproduciendo.");
      return;
    }
    log(`Autoplay intento ${attempt + 1}…`);
    if (typeof window.togglePlay === "function") {
      Promise.resolve(window.togglePlay()).catch(() => {});
    } else {
      document.getElementById("btn-play")?.click();
    }
    if (attempt < 4 && !window.slopsmith?.isPlaying) {
      setTimeout(() => tryAutoPlay(attempt + 1), 400);
    }
  }

  function setupAutoplayListener() {
    if (!window.slopsmith || autoplaySongReadyHandler) return;
    autoplaySongReadyHandler = () => {
      if (!pendingAutoplay) return;
      pendingAutoplay = false;
      log("song:ready recibido — iniciando autoplay.");
      setTimeout(() => tryAutoPlay(0), 150);
    };
    window.slopsmith.on("song:ready", autoplaySongReadyHandler);
  }

  // --- Abrir canción con autoplay ---
  function openSong(song, options) {
    if (!song || !song.filename) return;
    log(`Abriendo: ${song.filename}`);
    if (advanceTimer) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
      isAdvancing = false;
    }
    if (!options?.keepPopup) removeNextSongPopup();
    if (typeof window.playSong === "function") {
      pendingAutoplay = true;
      setupAutoplayListener();
      window.playSong(song.filename);
      setTimeout(() => syncCurrentSongFromPlayer(), 1000);
    } else {
      pendingAutoplay = false;
      error("window.playSong no disponible");
    }
  }

  // --- Obtener canción actual ---
  function getCurrentlyPlayingSong() {
    if (window.player && window.player.currentSong) return window.player.currentSong;
    if (window.currentSong) return window.currentSong;
    return null;
  }

  function syncCurrentSongFromPlayer() {
    const playing = getCurrentlyPlayingSong();
    if (playing && playing.filename && (!currentSong || currentSong.filename !== playing.filename)) {
      currentSong = playing;
      refreshNowPlaying(currentSong);
      if (!history.some(s => s.filename === currentSong.filename)) {
        addToHistory(currentSong);
      }
    }
  }

  // --- Backend ---
  function getShuffleSettings() {
    const artistEl = $("shuffle-artist-filter");
    const antiEl = $("shuffle-anti-repeat");
    let artist = "";
    let antiRepeat = true;
    try {
      artist = localStorage.getItem("shuffle.artistFilter") || "";
      const savedAnti = localStorage.getItem("shuffle.antiRepeat");
      if (savedAnti != null) antiRepeat = savedAnti !== "false";
    } catch (_) {}
    if (artistEl) artist = artistEl.value || "";
    if (antiEl) antiRepeat = antiEl.checked !== false;
    return { artist, antiRepeat };
  }

  function saveShuffleSettings() {
    const artistEl = $("shuffle-artist-filter");
    const antiEl = $("shuffle-anti-repeat");
    try {
      if (artistEl) localStorage.setItem("shuffle.artistFilter", artistEl.value || "");
      if (antiEl) localStorage.setItem("shuffle.antiRepeat", String(antiEl.checked));
    } catch (_) {}
  }
  function fetchNextSong() {
    const { artist, antiRepeat } = getShuffleSettings();
    let avoidIds = antiRepeat ? history.slice(-AVOID_MAX).map(s => s.filename) : [];
    if (currentSong && currentSong.filename) avoidIds.push(currentSong.filename);
    const params = new URLSearchParams();
    if (artist) params.set("artist", artist);
    if (avoidIds.length) params.set("avoid", avoidIds.join(","));
    log(`Solicitando siguiente canción...`);
    return fetch(`/api/plugins/shuffle/next?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          error(`Error siguiente: ${data.error}`);
          nextSong = null;
        } else {
          nextSong = data;
          log(`Siguiente cargada: ${nextSong.title}`);
        }
        updateNextSongDisplay();
      })
      .catch(err => {
        error(`Fetch next falló: ${err}`);
        nextSong = null;
        updateNextSongDisplay();
      });
  }

  function updateNextSongDisplay() {
    const titleEl = $("shuffle-next-title");
    const artistEl = $("shuffle-next-artist");
    const tuningEl = $("shuffle-next-tuning");
    if (!titleEl) return;
    if (!nextSong) {
      titleEl.innerText = "—";
      artistEl.innerText = "—";
      if (tuningEl) tuningEl.innerText = "";
      return;
    }
    titleEl.innerText = nextSong.title || t("noTitle");
    artistEl.innerText = nextSong.artist || t("unknownArtist");
    if (tuningEl) tuningEl.innerText = nextSong.tuning ? `${t("tuningPrefix")}${nextSong.tuning}` : "";
  }

  function pickRandom() {
    if (isAdvancing) {
      log("pickRandom ignorado: ya avanzando");
      return;
    }
    setStatus(`<span class="shuffle-spinner"></span>${esc(t("searching"))}`);
    const { artist, antiRepeat } = getShuffleSettings();
    let avoidIds = antiRepeat ? history.slice(-AVOID_MAX).map(s => s.filename) : [];
    const params = new URLSearchParams();
    if (artist) params.set("artist", artist);
    if (avoidIds.length) params.set("avoid", avoidIds.join(","));
    log(`Pidiendo canción aleatoria...`);
    fetch(`/api/plugins/shuffle/random?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.error === "no_songs") {
          setStatus(t("noSongs"), true);
          return;
        }
        if (data.error) {
          setStatus(`❌ ${esc(data.error)}`, true);
          return;
        }
        setStatus("");
        navigateTo(data, { showPopup: true });
        fetchNextSong();
      })
      .catch(() => setStatus(t("networkError"), true));
  }

  function navigateTo(song, options) {
    if (!song) return;
    log(`Navegando a: ${song.title}`);
    currentSong = song;
    addToHistory(song);
    refreshNowPlaying(song);
    const btn = $("shuffle-btn-again");
    if (btn) btn.disabled = false;

    if (options?.showPopup) {
      const delaySec = getDelaySeconds();
      if (delaySec <= 0) {
        openSong(song);
      } else {
        showNextSongPopup(song, {
          label: t("popupShuffle"),
          countdownSec: delaySec,
          onComplete: () => openSong(song),
        });
      }
    } else {
      openSong(song);
    }
  }

  function addToHistory(song) {
    if (!song || !song.filename) return;
    history = history.filter(s => s.filename !== song.filename);
    history.push(song);
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    renderHistory();
    fetchNextSong();
  }

  function renderHistory() {
    const list = $("shuffle-history");
    const empty = $("shuffle-history-empty");
    if (!list) return;
    Array.from(list.children).forEach(c => {
      if (c.id !== "shuffle-history-empty") c.remove();
    });
    const reversed = history.slice().reverse();
    if (reversed.length === 0) {
      if (empty) {
        empty.style.display = "";
        empty.textContent = t("noHistory");
      }
      return;
    }
    if (empty) empty.style.display = "none";
    reversed.forEach((song, idx) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="shuffle-hist-title">${esc(song.title || t("noTitle"))}</span>
                      <span class="shuffle-hist-artist">${esc(song.artist || "")}</span>`;
      if (idx === 0) li.style.borderColor = "#5b4fff";
      li.addEventListener("click", () => openSong(song));
      list.appendChild(li);
    });
  }

  function refreshNowPlaying(song) {
    const el = $("shuffle-now-playing");
    if (!el) return;
    el.classList.remove("empty");
    el.innerHTML = `<div class="shuffle-song-title">${esc(song.title || t("noTitle"))}</div>
                    <div class="shuffle-song-artist">${esc(song.artist || t("unknownArtist"))}</div>
                    <div class="shuffle-song-album">${esc(song.album || "")}</div>`;
  }

  function populateArtists() {
    const sel = $("shuffle-artist-filter");
    if (!sel) return;
    fetch("/api/plugins/shuffle/artists")
      .then(r => r.json())
      .then(data => {
        (data.artists || []).forEach(artist => {
          const opt = document.createElement("option");
          opt.value = artist;
          opt.textContent = artist;
          sel.appendChild(opt);
        });
      })
      .catch(err => error("Error artistas: " + err));
  }

  function beginAutoAdvanceSequence() {
    const autoAdvance = $("shuffle-auto-advance");
    if (!autoAdvance || !autoAdvance.checked) return;
    if (isAdvancing) return;

    const now = Date.now();
    if (now - lastEndHandledAt < 1500) return;
    lastEndHandledAt = now;

    log("Fin de canción — iniciando secuencia de avance automático.");

    const run = () => {
      if (isAdvancing) return;
      if (!nextSong) {
        fetchNextSong().then(() => {
          if (nextSong) triggerAutoAdvance();
          else error("No se pudo obtener la siguiente canción.");
        });
      } else {
        triggerAutoAdvance();
      }
    };

    run();
  }

  function setupSongEndedListener() {
    if (!window.slopsmith || songEndedHandler) return;
    songEndedHandler = () => {
      // Mismo evento que note_detect usa para crear .nd-summary-overlay
      requestAnimationFrame(() => beginAutoAdvanceSequence());
    };
    window.slopsmith.on("song:ended", songEndedHandler);
    log("Listener song:ended registrado.");
  }

  function setupAccuracyObserver() {
    if (accuracyObserver) return;
    accuracyObserver = new MutationObserver((mutations) => {
      if (isAdvancing) return;
      const autoAdvance = $("shuffle-auto-advance");
      if (!autoAdvance || !autoAdvance.checked) return;

      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          const overlay = node.classList?.contains("nd-summary-overlay")
            ? node
            : node.querySelector?.(".nd-summary-overlay");
          if (overlay && isAccuracyOverlayVisible(overlay)) {
            log("Popup Accuracy (note_detect) visible — sincronizando cuenta atrás.");
            beginAutoAdvanceSequence();
            return;
          }
        }
      }
    });
    accuracyObserver.observe(document.body, { childList: true, subtree: true });
  }

  function triggerAutoAdvance() {
    if (isAdvancing) return;
    isAdvancing = true;
    const delaySec = parseFloat($("shuffle-delay-seconds")?.value || "5");
    const delayMs = delaySec * 1000;
    const songToPlay = nextSong;

    log(`Avance automático: ${delaySec}s de cuenta atrás.`);
    setStatus("");

    if (songToPlay) {
      showNextSongPopup(songToPlay, { label: t("popupNext"), countdownSec: delaySec });
    } else {
      log("No hay nextSong para mostrar en popup.");
    }

    if (advanceTimer) clearTimeout(advanceTimer);
    advanceTimer = setTimeout(() => {
      log("Cerrando Accuracy y avanzando a la siguiente canción.");
      closeAccuracyScreen();
      removeNextSongPopup();
      if (songToPlay) {
        const played = songToPlay;
        nextSong = null;
        navigateTo(played);
      } else {
        pickRandom();
      }
      isAdvancing = false;
      setStatus("");
    }, delayMs);
  }

  // --- INYECCIÓN DEL BOTÓN EN LA BARRA DE LA BIBLIOTECA ---
  function injectShuffleButtonBefore(viewGridBtnId) {
    const viewGridBtn = document.getElementById(viewGridBtnId);
    if (!viewGridBtn) return false;
    const viewToggle = viewGridBtn.parentElement;
    const toolbar = viewToggle?.parentElement;
    if (!toolbar) return false;

    ensureShuffleLibStyles();

    let btn = toolbar.querySelector(":scope > .shuffle-lib-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shuffle-lib-btn";
      btn.innerHTML = t("shuffleBtn");
      btn.title = t("libBtnTitle");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        pickRandom();
      });
      toolbar.insertBefore(btn, viewToggle);
    } else if (btn.nextElementSibling !== viewToggle) {
      toolbar.insertBefore(btn, viewToggle);
    } else {
      btn.innerHTML = t("shuffleBtn");
      btn.title = t("libBtnTitle");
    }
    return true;
  }

  function bindScreenControls() {
    const btnMain = $("shuffle-btn-main");
    const btnAgain = $("shuffle-btn-again");
    const delayEl = $("shuffle-delay-seconds");
    const artistEl = $("shuffle-artist-filter");
    const antiEl = $("shuffle-anti-repeat");

    if (btnMain && !btnMain.dataset.shuffleBound) {
      btnMain.dataset.shuffleBound = "1";
      btnMain.addEventListener("click", pickRandom);
    }
    if (btnAgain && !btnAgain.dataset.shuffleBound) {
      btnAgain.dataset.shuffleBound = "1";
      btnAgain.addEventListener("click", () => {
        if (currentSong) openSong(currentSong);
      });
    }
    if (delayEl && !delayEl.dataset.shuffleBound) {
      delayEl.dataset.shuffleBound = "1";
      try {
        const saved = localStorage.getItem("shuffle.delaySeconds");
        if (saved != null) delayEl.value = saved;
      } catch (_) {}
      delayEl.addEventListener("change", saveDelaySeconds);
      delayEl.addEventListener("input", saveDelaySeconds);
    }
    if (artistEl && !artistEl.dataset.shuffleBound) {
      artistEl.dataset.shuffleBound = "1";
      try {
        const saved = localStorage.getItem("shuffle.artistFilter");
        if (saved) artistEl.value = saved;
      } catch (_) {}
      artistEl.addEventListener("change", saveShuffleSettings);
    }
    if (antiEl && !antiEl.dataset.shuffleBound) {
      antiEl.dataset.shuffleBound = "1";
      try {
        const saved = localStorage.getItem("shuffle.antiRepeat");
        if (saved != null) antiEl.checked = saved !== "false";
      } catch (_) {}
      antiEl.addEventListener("change", saveShuffleSettings);
    }
  }

  function injectLibraryButton() {
    const libOk = injectShuffleButtonBefore("view-grid-btn");
    const favOk = injectShuffleButtonBefore("fav-view-grid-btn");
    if (libOk || favOk) {
      if (!buttonInjected) log("✅ Botón Shuffle añadido en la barra de la biblioteca.");
      buttonInjected = true;
    } else {
      log("No se encontró la barra de herramientas. Reintentando en 1s...");
      setTimeout(injectLibraryButton, 1000);
    }
  }

  function ensureGlobalListeners() {
    if (window.slopsmith) {
      setupSongEndedListener();
      setupAccuracyObserver();
    }
  }

  // --- INICIALIZACIÓN ---
  function initScreen() {
    log("Inicializando pantalla Shuffle");
    setupLangSelector();
    setupAutoplayListener();
    setupSongEndedListener();
    setupAccuracyObserver();
    populateArtists();
    bindScreenControls();
    renderHistory();
    if (currentSong) refreshNowPlaying(currentSong);
    fetchNextSong();
    injectLibraryButton();
    if (!window._shuffleSyncInterval) {
      window._shuffleSyncInterval = setInterval(syncCurrentSongFromPlayer, 3000);
    }
  }

  function bootstrap() {
    loadLang();
    ensureGlobalListeners();
    injectLibraryButton();
  }

  window.shufflePluginPickRandom = pickRandom;

  bootstrap();

  if (window.slopsmith && typeof window.slopsmith.onScreenLoad === "function") {
    window.slopsmith.onScreenLoad("shuffle", initScreen);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bootstrap();
      initScreen();
    });
  } else {
    initScreen();
  }
})();