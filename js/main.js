(function () {
  "use strict";

  var C = window.CONTENT;
  var WEDDING = new Date(2032, 9, 16, 0, 0, 0); // 16 Oct 2032, midnight local time
  var DAY_MS = 864e5;
  var ME_KEY = "jj-me"; // who is holding this phone; stays on the phone
  var S = window.JJStore; // everything we save, and its sync (js/store.js)
  var NOTE_MAX = 800;

  var SONG = {
    title: "Goodness of God",
    artist: "Bethel Music",
    youtubeId: "SuPCTBmISzQ",
    start: 12, // seconds into the song where playback (and every loop) begins
    // Our own copy of the song. The site plays this file, and the visualiser listens to it.
    // If it can't play, the site falls back to the YouTube video below.
    file: "audio/song.mp3",
    // Used only for the YouTube fallback, where browsers do not let a page hear the audio:
    // the visualiser pulses on this beat, locked to the song's playback time.
    bpm: 63, // "Goodness of God" is 63 BPM in 4/4
    beatOffset: 0 // seconds; nudge so the pulses land on the downbeat
  };

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(sel) { return document.querySelector(sel); }
  function noop() {}

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function verseNode(v, className) {
    var q = el("blockquote", "verse" + (className ? " " + className : ""));
    q.appendChild(el("p", null, v.text));
    q.appendChild(el("cite", null, v.ref));
    return q;
  }

  function verseList(verses) {
    var list = el("div", "verse-list");
    verses.forEach(function (v) { list.appendChild(verseNode(v)); });
    return list;
  }

  function dateKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // Whole days since 1970 for the viewer's calendar date, so both phones agree on "today".
  function dayNumber(d) {
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
  }

  function readStore(key) {
    try { return JSON.parse(window.localStorage.getItem(key)); } catch (e) { return null; }
  }

  function writeStore(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  function fmtNum(n) { return n.toLocaleString("en-GB"); }

  // Calendar date for a whole-day number (see dayNumber)
  function fmtDay(n, opts) {
    return new Date(n * DAY_MS).toLocaleDateString("en-GB", Object.assign({ timeZone: "UTC" }, opts));
  }

  function fmtKey(key) {
    var p = String(key || "").split("-");
    if (p.length !== 3) return "";
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function bibleLink(ref) {
    return "https://www.biblegateway.com/passage/?search=" + encodeURIComponent(ref.replace("–", "-")) + "&version=NKJV";
  }

  /* ---------- Content sections ---------- */

  function renderPillars() {
    var root = $("#pillars-list");
    C.pillars.forEach(function (p) {
      var card = el("article", "card card--pillar");
      card.appendChild(el("p", "card__numeral", p.numeral));
      card.appendChild(el("h3", "card__title", p.title));
      card.appendChild(el("p", "card__subtitle", p.subtitle));
      card.appendChild(el("p", "card__body", p.body));
      card.appendChild(el("div", "card__rule"));
      card.appendChild(verseList(p.verses));
      root.appendChild(card);
    });
  }

  function renderRoles() {
    var root = $("#roles-list");
    C.roles.forEach(function (r) {
      var card = el("article", "card card--role");
      card.appendChild(el("p", "card__label", r.title));
      card.appendChild(el("h3", "card__script gold-text", r.name));
      card.appendChild(el("p", "card__body", r.body));
      card.appendChild(el("div", "card__rule"));
      card.appendChild(verseList(r.verses));
      root.appendChild(card);
    });
  }

  function renderPromises() {
    var root = $("#promises-list");
    C.promises.forEach(function (group) {
      var card = el("article", "card card--promises");
      card.appendChild(el("p", "card__numeral", group.icon));
      card.appendChild(el("h3", "card__title", group.title));
      var list = el("ul", "promise-list");
      group.items.forEach(function (item) {
        var li = el("li", null, item.text);
        li.setAttribute("data-icon", group.icon);
        if (item.ref) li.appendChild(el("small", null, item.ref));
        list.appendChild(li);
      });
      card.appendChild(list);
      root.appendChild(card);
    });
  }

  function renderLibrary() {
    var tabs = $("#verse-tabs");
    var panels = $("#verse-panels");
    var buttons = [];

    C.library.forEach(function (group, i) {
      var tab = el("button", "tab", group.title);
      tab.type = "button";
      tab.id = "tab-" + i;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", "panel-" + i);

      var panel = el("div", "library");
      panel.id = "panel-" + i;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      group.verses.forEach(function (v) {
        var card = el("article", "card");
        card.appendChild(verseNode(v));
        panel.appendChild(card);
      });

      tab.addEventListener("click", function () { select(i); });
      tab.addEventListener("keydown", function (e) {
        var next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
        if (next === null) return;
        e.preventDefault();
        next = (next + buttons.length) % buttons.length;
        select(next);
        buttons[next].focus();
      });

      buttons.push(tab);
      tabs.appendChild(tab);
      panels.appendChild(panel);
    });

    function select(index) {
      buttons.forEach(function (b, i) {
        var on = i === index;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        document.getElementById("panel-" + i).hidden = !on;
      });
    }

    select(0);
  }

  // Every verse on the page, without repeats, for the verse of the day.
  function allVerses() {
    var seen = {};
    var out = [];
    function add(v) {
      if (seen[v.ref]) return;
      seen[v.ref] = true;
      out.push(v);
    }
    C.pillars.forEach(function (p) { p.verses.forEach(add); });
    C.roles.forEach(function (r) { r.verses.forEach(add); });
    C.library.forEach(function (g) { g.verses.forEach(add); });
    return out;
  }

  function allPromises() {
    var out = [];
    C.promises.forEach(function (g) { out = out.concat(g.items); });
    return out;
  }

  function renderDaily() {
    var now = new Date();
    var n = dayNumber(now);
    var verses = allVerses();
    var promises = allPromises();
    // Step through each list by a large prime so consecutive days jump between themes.
    var verse = verses[(n * 7919) % verses.length];
    var promise = promises[(n * 104729) % promises.length];
    var question = C.questions[(n * 15485863) % C.questions.length];
    var prayer = C.prayers[(n * 32452843) % C.prayers.length];
    var proverb = "Proverbs " + now.getDate();

    $("#today-date").textContent = now.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    var holder = $("#verse-of-day");
    holder.appendChild(el("p", null, verse.text));
    holder.appendChild(el("cite", null, verse.ref));
    $("#verse-link").href = bibleLink(verse.ref);
    $("#promise-of-day").textContent = promise.text;
    $("#promise-of-day-ref").textContent = promise.ref || "";
    $("#question-of-day").textContent = question;
    $("#prayer-of-day").textContent = prayer;
    $("#proverb-link").textContent = proverb;
    $("#proverb-link").href = bibleLink(proverb);
  }

  /* ---------- Countdown ---------- */

  function startCountdown() {
    var nums = {};
    document.querySelectorAll("[data-unit]").forEach(function (node) { nums[node.getAttribute("data-unit")] = node; });
    var clock = $("#countdown-clock");
    var done = $("#countdown-done");
    var caption = $("#countdown-caption");
    var topDays = $("#topbar-days");

    caption.textContent = WEDDING.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });

    function pad(v) { return String(v).padStart(2, "0"); }

    function tick() {
      var now = new Date();
      var diff = WEDDING - now;
      if (diff <= 0) {
        clock.hidden = true;
        done.hidden = false;
        var married = dayNumber(now) - dayNumber(WEDDING);
        if (married === 0) {
          done.textContent = "Today is our wedding day!";
          caption.textContent = "What God has joined together, let not man separate.";
        } else {
          done.textContent = "Married in Christ";
          caption.textContent = "for " + plural(married, "day") + ", and counting";
        }
        return false;
      }
      var s = Math.floor(diff / 1000);
      var days = Math.floor(s / 86400);
      nums.days.textContent = fmtNum(days);
      topDays.textContent = plural(days, "day").replace(/^\d+/, fmtNum(days)) + " to go";
      nums.hours.textContent = pad(Math.floor((s % 86400) / 3600));
      nums.minutes.textContent = pad(Math.floor((s % 3600) / 60));
      nums.seconds.textContent = pad(s % 60);
      return true;
    }

    if (tick()) {
      var timer = setInterval(function () { if (!tick()) clearInterval(timer); }, 1000);
    }
    renderStats();
  }

  function renderStats() {
    var now = new Date();
    var today = dayNumber(now);
    var wedding = dayNumber(WEDDING);
    var left = wedding - today;
    var top = $("#topbar-days");

    if (left <= 0) {
      $("#stats").hidden = true;
      top.textContent = left === 0 ? "Our wedding day" : "Married in Christ";
      return;
    }

    var months = (WEDDING.getFullYear() - now.getFullYear()) * 12 + (WEDDING.getMonth() - now.getMonth());
    if (WEDDING.getDate() < now.getDate()) months -= 1;
    var sundays = 0;
    for (var d = today; d < wedding; d++) if ((d + 4) % 7 === 0) sundays++; // day 0 (1 Jan 1970) was a Thursday

    $("#stat-months").textContent = fmtNum(Math.max(0, months));
    $("#stat-weeks").textContent = fmtNum(Math.floor(left / 7));
    $("#stat-sundays").textContent = fmtNum(sundays);
  }

  /* ---------- "Yes" days ---------- */

  function yesState() {
    var today = dateKey(new Date());
    return { days: S.yesCount(), last: S.yesOn(today) ? today : null };
  }

  function recordYes() {
    return S.addYes(dateKey(new Date()));
  }

  function showTally(days) {
    $("#yes-tally").textContent = days ? "♥ You have said yes on " + plural(days, "day") + " ♥" : "";
  }

  /* ---------- Music ----------
   * Starts playing muted as soon as the page loads (the only autoplay browsers allow),
   * then the sound comes on with the first tap anywhere, usually the wax seal.
   */

  var music = {
    kind: null, // "file" | "yt"
    ready: false,
    playing: false,
    muted: true,
    wantSound: false,
    userPaused: false,
    failed: false,
    yt: null,
    audio: null,
    ctx: null,
    analyser: null,
    bins: null,
    anchorT: 0,
    anchorWall: 0,
    lastRaw: -1
  };
  var musicBtn = $("#music-btn");
  var musicLink = $("#music-link");
  var musicTitle = $("#music-title");
  var musicSub = $("#music-sub");
  var collapseTimer = null;

  function updateMusicUI() {
    var audible = music.playing && !music.muted;
    var waiting = !music.failed && !audible && !music.userPaused;
    musicBtn.classList.toggle("is-playing", audible);
    musicBtn.classList.toggle("is-muted", waiting);
    musicBtn.setAttribute("aria-pressed", audible ? "true" : "false");
    musicBtn.setAttribute("aria-label", (audible ? "Pause our song, " : "Play our song, ") + SONG.title);

    var title = audible ? SONG.title : music.userPaused ? "Paused" : "Tap for our song";
    var sub = audible ? "Now playing · " + SONG.artist : music.userPaused ? "Tap to play " + SONG.title : SONG.title;
    if (musicTitle.textContent !== title) {
      musicTitle.textContent = title;
      musicSub.textContent = sub;
      // Show the label for a moment whenever the state changes, then tuck it away.
      musicBtn.classList.add("is-expanded");
      clearTimeout(collapseTimer);
      collapseTimer = setTimeout(function () {
        if (!musicBtn.classList.contains("is-muted")) musicBtn.classList.remove("is-expanded");
      }, 5000);
    }
    if (waiting) musicBtn.classList.add("is-expanded");
  }

  function musicFallback() {
    if (music.kind === "file") {
      // The file could not play; try YouTube before giving up.
      music.kind = null;
      startYouTube();
      return;
    }
    music.failed = true;
    musicBtn.hidden = true;
    musicLink.hidden = false;
  }

  function soundOn() {
    music.wantSound = true;
    music.userPaused = false;
    if (music.failed || !music.ready) { updateMusicUI(); return; }
    if (music.kind === "file") {
      connectAnalyser();
      music.audio.muted = false;
      music.muted = false;
      var p = music.audio.play();
      if (p && p.catch) p.catch(noop);
    } else {
      music.yt.unMute();
      music.yt.setVolume(85);
      music.yt.playVideo();
      music.muted = false;
    }
    updateMusicUI();
  }

  function pauseSong() {
    music.userPaused = true;
    if (music.kind === "file") music.audio.pause();
    else if (music.ready) music.yt.pauseVideo();
    music.playing = false;
    updateMusicUI();
  }

  function startFile() {
    var a = new Audio();
    music.kind = "file";
    music.audio = a;
    a.preload = "auto";
    a.muted = true;
    a.playsInline = true;
    a.setAttribute("playsinline", "");
    a.addEventListener("loadedmetadata", function () {
      if (a.duration > SONG.start) a.currentTime = SONG.start;
    });
    a.addEventListener("ended", function () {
      a.currentTime = SONG.start;
      a.play().catch(noop);
    });
    a.addEventListener("playing", function () { music.playing = true; updateMusicUI(); });
    a.addEventListener("pause", function () { music.playing = false; updateMusicUI(); });
    a.addEventListener("error", musicFallback);
    a.src = SONG.file;
    music.ready = true;
    // Browsers block even silent autoplay of an audio file, so the song starts
    // at the first tap (usually the wax seal), always from SONG.start.
    if (music.wantSound) soundOn();
  }

  function connectAnalyser() {
    if (music.ctx) {
      if (music.ctx.state === "suspended") music.ctx.resume();
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      var ctx = new AC();
      var src = ctx.createMediaElementSource(music.audio);
      var an = ctx.createAnalyser();
      an.fftSize = 512;
      an.smoothingTimeConstant = 0.78;
      src.connect(an);
      an.connect(ctx.destination);
      music.ctx = ctx;
      music.analyser = an;
      music.bins = new Uint8Array(an.frequencyBinCount);
    } catch (e) { /* visualiser falls back to the beat */ }
  }

  function startYouTube() {
    music.kind = "yt";
    window.onYouTubeIframeAPIReady = function () {
      music.yt = new window.YT.Player("yt-player", {
        width: "200",
        height: "200",
        videoId: SONG.youtubeId,
        playerVars: { start: SONG.start, autoplay: 1, mute: 1, controls: 0, disablekb: 1, playsinline: 1, rel: 0, fs: 0 },
        events: {
          onReady: function () {
            music.ready = true;
            clearTimeout(music.timer);
            music.failed = false;
            musicBtn.hidden = false;
            musicLink.hidden = true;
            music.yt.mute();
            music.yt.playVideo();
            if (music.wantSound) soundOn();
          },
          onStateChange: function (e) {
            var S = window.YT.PlayerState;
            if (e.data === S.ENDED) {
              // Loop from the chosen moment rather than the very start.
              music.yt.seekTo(SONG.start, true);
              music.yt.playVideo();
            } else if (e.data === S.PLAYING) {
              music.playing = true;
              music.muted = music.yt.isMuted();
            } else if (e.data === S.PAUSED) {
              music.playing = false;
            }
            updateMusicUI();
          },
          // 101 / 150: the video owner does not allow embedding; 2 / 5 / 100: invalid or unavailable.
          onError: musicFallback
        }
      });
    };

    var script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = musicFallback;
    document.head.appendChild(script);

    // If YouTube never answers (blocked network), offer the direct link instead.
    music.timer = setTimeout(function () { if (!music.ready) musicFallback(); }, 15000);
  }

  // Current position in the song, smoothed between YouTube's coarse updates.
  function songTime(now) {
    if (music.kind === "file") return music.audio.currentTime;
    if (!music.yt || !music.yt.getCurrentTime) return 0;
    var raw = music.yt.getCurrentTime() || 0;
    if (raw !== music.lastRaw) {
      music.lastRaw = raw;
      music.anchorT = raw;
      music.anchorWall = now;
    }
    var t = music.anchorT + (music.playing ? (now - music.anchorWall) / 1000 : 0);
    return Math.abs(t - raw) > 1 ? raw : t;
  }

  function initMusic() {
    musicBtn.addEventListener("click", function () {
      if (music.playing && !music.muted) pauseSong();
      else soundOn();
    });

    // The first tap or key press anywhere turns the sound on.
    var gestures = ["click", "touchend", "keydown"];
    function firstGesture(e) {
      if (musicBtn.contains(e.target) || musicLink.contains(e.target)) return;
      if (music.userPaused) return;
      soundOn();
      if (!music.muted) gestures.forEach(function (g) { document.removeEventListener(g, firstGesture, true); });
    }
    gestures.forEach(function (g) { document.addEventListener(g, firstGesture, true); });

    fetch(SONG.file, { method: "HEAD", cache: "no-store" })
      .then(function (r) {
        var type = r.headers.get("content-type") || "";
        if (r.ok && type.indexOf("audio") === 0) startFile();
        else startYouTube();
      })
      .catch(startYouTube);

    updateMusicUI();
  }

  /* ---------- Visualiser: drifting candle-light and a glow on the beat ---------- */

  var BANDS = 24;
  var viz = {
    levels: new Float32Array(BANDS),
    target: new Float32Array(BANDS),
    bass: 0,
    energy: 0,
    pulse: 0,
    prev: new Float32Array(BANDS),
    ref: 0.2,
    avgFlux: 0.3,
    lastBeatAt: 0,
    lastBeatIdx: null,
    sparkles: []
  };

  function synthLevels(t) {
    var spb = 60 / SONG.bpm;
    var b = (t - SONG.beatOffset) / spb;
    var idx = Math.floor(b);
    var ph = b - idx;
    var bar = ((idx % 4) + 4) % 4;
    var accent = bar === 0 ? 1 : bar === 2 ? 0.82 : 0.62;
    var kick = Math.exp(-ph * 5.5) * accent;
    var h = b * 2 - Math.floor(b * 2);
    var shimmer = Math.exp(-h * 8);
    var swell = 0.78 + 0.22 * Math.sin((2 * Math.PI * t) / (spb * 16));
    for (var i = 0; i < BANDS; i++) {
      var f = i / (BANDS - 1);
      var v = (1 - f) * (0.22 + 0.78 * kick) + f * (0.18 + 0.45 * shimmer);
      v += 0.16 * (0.5 + 0.5 * Math.sin(t * (0.9 + i * 0.41) + i * 1.7));
      viz.target[i] = Math.min(1, v * swell);
    }
    if (viz.lastBeatIdx !== null && idx !== viz.lastBeatIdx) onBeat(accent);
    viz.lastBeatIdx = idx;
  }

  function analysedLevels(now) {
    var an = music.analyser;
    var bins = music.bins;
    an.getByteFrequencyData(bins);
    var maxBin = Math.min(bins.length, 170);
    for (var i = 0; i < BANDS; i++) {
      var lo = Math.floor(Math.pow(maxBin, i / BANDS));
      var hi = Math.max(lo + 1, Math.floor(Math.pow(maxBin, (i + 1) / BANDS)));
      var peak = 0;
      for (var k = lo; k < hi && k < bins.length; k++) if (bins[k] > peak) peak = bins[k];
      viz.target[i] = Math.pow(peak / 255, 1.4);
    }

    // Gentle music is quiet: scale everything to the loudest moment heard recently.
    var loudest = 0;
    for (var j = 0; j < BANDS; j++) if (viz.target[j] > loudest) loudest = viz.target[j];
    viz.ref = Math.max(viz.ref * 0.997, loudest, 0.05);

    // A new note anywhere in the spectrum (piano, strings) shows up as a sudden rise.
    var flux = 0;
    var sum = 0;
    for (var b = 0; b < BANDS; b++) {
      var v = Math.min(1, viz.target[b] / viz.ref);
      viz.target[b] = v;
      sum += v;
      if (v > viz.prev[b]) flux += v - viz.prev[b];
      viz.prev[b] = v;
    }
    viz.avgFlux = viz.avgFlux * 0.95 + flux * 0.05;
    if (flux > viz.avgFlux * 1.6 + 0.15 && now - viz.lastBeatAt > 280) {
      viz.lastBeatAt = now;
      onBeat(Math.min(1, 0.45 + flux * 0.3));
    }
    // Between notes the glow breathes with how full the music is.
    viz.pulse = Math.max(viz.pulse, (sum / BANDS) * 0.4);
  }

  function idleLevels(now) {
    for (var i = 0; i < BANDS; i++) {
      viz.target[i] = 0.12 + 0.06 * Math.sin(now / 1400 + i * 0.6);
    }
  }

  function onBeat(strength) {
    viz.pulse = Math.max(viz.pulse, strength);
    if (strength > 0.8) spawnSparkles(2);
  }

  function updateLevels(now) {
    if (music.playing && music.kind === "file" && music.analyser && !music.muted) analysedLevels(now);
    else if (music.playing) synthLevels(songTime(now));
    else idleLevels(now);

    var sumB = 0;
    var sumE = 0;
    for (var i = 0; i < BANDS; i++) {
      var cur = viz.levels[i];
      var tgt = viz.target[i];
      viz.levels[i] = cur + (tgt - cur) * (tgt > cur ? 0.45 : 0.12);
      sumE += viz.levels[i];
      if (i < 4) sumB += viz.levels[i];
    }
    viz.bass = sumB / 4;
    viz.energy = sumE / BANDS;
    viz.pulse *= 0.93;
  }

  function fitCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  // Drifting lights like candles seen through a veil
  var orbs = [];
  var orbSprite = null;

  function makeOrbSprite() {
    var s = document.createElement("canvas");
    s.width = s.height = 64;
    var g = s.getContext("2d");
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 244, 210, 1)");
    grad.addColorStop(0.35, "rgba(240, 210, 140, 0.55)");
    grad.addColorStop(1, "rgba(230, 199, 122, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return s;
  }

  function initOrbs(w, h) {
    orbs = [];
    var count = w < 600 ? 16 : 28;
    for (var i = 0; i < count; i++) {
      orbs.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 8 + Math.random() * 26,
        vy: 0.08 + Math.random() * 0.22,
        sway: Math.random() * Math.PI * 2,
        band: Math.floor(Math.random() * BANDS),
        base: 0.12 + Math.random() * 0.2
      });
    }
  }

  function spawnSparkles(n) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    for (var i = 0; i < n; i++) {
      viz.sparkles.push({ x: Math.random() * w, y: Math.random() * h * 0.9, born: performance.now(), size: 6 + Math.random() * 8 });
    }
  }

  function star(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.closePath();
  }

  function drawAmbient(canvas, now) {
    var c = fitCanvas(canvas);
    var ctx = c.ctx;
    if (!orbs.length) initOrbs(c.w, c.h);
    ctx.clearRect(0, 0, c.w, c.h);

    for (var i = 0; i < orbs.length; i++) {
      var o = orbs[i];
      o.y -= o.vy * (1 + viz.energy * 2);
      o.sway += 0.004;
      if (o.y < -o.r * 2) { o.y = c.h + o.r * 2; o.x = Math.random() * c.w; }
      var lvl = viz.levels[o.band];
      var size = o.r * (1 + 0.5 * lvl + 0.3 * viz.pulse);
      ctx.globalAlpha = Math.min(0.75, o.base + 0.35 * lvl + 0.15 * viz.pulse);
      ctx.drawImage(orbSprite, o.x + Math.sin(o.sway) * 20 - size, o.y - size, size * 2, size * 2);
    }

    for (var s = viz.sparkles.length - 1; s >= 0; s--) {
      var sp = viz.sparkles[s];
      var p = (now - sp.born) / 1100;
      if (p >= 1) { viz.sparkles.splice(s, 1); continue; }
      var k = Math.sin(p * Math.PI);
      ctx.globalAlpha = k * 0.9;
      ctx.drawImage(orbSprite, sp.x - sp.size * 2, sp.y - sp.size * 2, sp.size * 4, sp.size * 4);
      star(ctx, sp.x, sp.y, sp.size * k);
      ctx.fillStyle = "#E9C77B";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function initVisualiser() {
    var ambient = $("#ambient");
    var clock = $("#countdown-clock");
    var bars = musicBtn.querySelectorAll(".music__bars i");

    if (reduceMotion) return;

    orbSprite = makeOrbSprite();
    window.addEventListener("resize", function () { orbs = []; });

    var lastPulse = -1;
    function frame(now) {
      updateLevels(now);
      drawAmbient(ambient, now);

      var pulse = Math.round(viz.pulse * 50) / 50;
      if (pulse !== lastPulse) {
        clock.style.setProperty("--pulse", pulse);
        lastPulse = pulse;
      }
      if (musicBtn.classList.contains("is-playing")) {
        for (var b = 0; b < bars.length; b++) {
          bars[b].style.transform = "scaleY(" + (0.25 + 0.75 * viz.levels[2 + b * 5]).toFixed(2) + ")";
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Petals ---------- */

  function initPetals() {
    if (reduceMotion) return;
    var root = $("#petals");
    var count = window.innerWidth < 600 ? 10 : 18;
    for (var i = 0; i < count; i++) {
      var p = el("span", "petal");
      p.style.left = Math.random() * 100 + "%";
      p.style.setProperty("--size", (8 + Math.random() * 8).toFixed(1) + "px");
      p.style.setProperty("--dur", (12 + Math.random() * 12).toFixed(1) + "s");
      p.style.setProperty("--delay", (-Math.random() * 20).toFixed(1) + "s");
      p.style.setProperty("--drift", (Math.random() * 160 - 80).toFixed(0) + "px");
      root.appendChild(p);
    }
  }

  function burst(x, y, count) {
    if (reduceMotion) return;
    for (var i = 0; i < (count || 40); i++) {
      var s = el("span", "spark");
      var angle = Math.random() * Math.PI * 2;
      var dist = 80 + Math.random() * 200;
      s.style.left = x + "px";
      s.style.top = y + "px";
      s.style.setProperty("--x", (Math.cos(angle) * dist).toFixed(0) + "px");
      s.style.setProperty("--y", (Math.sin(angle) * dist).toFixed(0) + "px");
      s.style.setProperty("--r", (Math.random() * 720 - 360).toFixed(0) + "deg");
      document.body.appendChild(s);
      s.addEventListener("animationend", function () { this.remove(); });
    }
  }

  /* ---------- Love letters ----------
   * A letter travels inside the link itself (after the #), so nothing is stored on a server.
   * Opening the link shows it inside the sealed envelope on the other phone.
   */

  function bytesToB64Url(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function b64UrlToBytes(code) {
    var b64 = code.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function toB64Url(str) { return bytesToB64Url(new TextEncoder().encode(str)); }
  function fromB64Url(code) { return new TextDecoder().decode(b64UrlToBytes(code)); }

  // Share a link through the phone's share sheet, or copy it where sharing isn't available.
  function shareLink(opts) {
    function copy() {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(opts.url).then(
          function () { opts.done(opts.copied); },
          function () { opts.status.textContent = opts.url; });
      } else {
        opts.status.textContent = opts.url;
      }
    }
    if (navigator.share) {
      navigator.share({ title: opts.title, text: opts.text, url: opts.url })
        .then(function () { opts.done(opts.shared); }, function (err) {
          if (!err || err.name !== "AbortError") copy();
        });
    } else {
      copy();
    }
  }

  function otherOf(name) { return name === "Joel" ? "Jemimah" : "Joel"; }

  function decodeNote(code) {
    try {
      var o = JSON.parse(fromB64Url(code));
      if (!o || (o.f !== "Jemimah" && o.f !== "Joel") || typeof o.m !== "string" || !o.m.trim()) return null;
      return {
        id: code,
        from: o.f,
        to: otherOf(o.f),
        msg: o.m.slice(0, NOTE_MAX),
        date: /^\d{4}-\d{2}-\d{2}$/.test(o.d) ? o.d : null
      };
    } catch (e) {
      return null;
    }
  }

  function readNoteFromLink() {
    var m = location.hash.match(/^#note=([A-Za-z0-9_-]{4,6000})$/);
    if (!m) return null;
    var note = decodeNote(m[1]);
    // Tidy the address so a reload shows the normal page; the letter is kept below.
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
    if (note) keepLetter(note);
    return note;
  }

  function letters() { return S.letters(); }

  function keepLetter(note) {
    return S.addLetter({ from: note.from, to: note.to, msg: note.msg, date: note.date });
  }

  function renderKept() {
    var root = $("#kept-list");
    var list = letters().slice().reverse();
    root.textContent = "";
    $("#kept-empty").hidden = list.length > 0;
    var me = readStore(ME_KEY);
    list.forEach(function (l) {
      var kind = l.from === me ? "sent" : l.to === me ? "received" : "kept";
      var item = el("article", "letter letter--" + kind);
      item.appendChild(el("p", "letter__meta",
        (kind === "sent" ? "Sent · " : kind === "received" ? "Received · " : "") + "From " + l.from + " to " + l.to + (l.date ? " · " + fmtKey(l.date) : "")));
      item.appendChild(el("p", "letter__msg", l.msg));
      var remove = el("button", "letter__remove", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", "Remove this letter from this phone");
      remove.addEventListener("click", function () {
        confirmDelete({
          title: "Remove this letter?",
          text: "This letter from " + l.from + " will be removed" + (S.sync.configured() ? " from both phones." : " from this phone.")
        }).then(function (r) {
          if (!r.ok) return;
          S.removeLetter(l.id);
          renderKept();
        });
      });
      item.appendChild(remove);
      root.appendChild(item);
    });
  }

  function initLetters() {
    var form = $("#compose");
    var text = $("#note-text");
    var count = $("#note-count");
    var status = $("#compose-status");
    var me = readStore(ME_KEY);

    function setFrom(name) {
      form.querySelectorAll('input[name="from"]').forEach(function (r) { r.checked = r.value === name; });
      $("#note-label").textContent = name ? "Your letter to " + otherOf(name) : "Your letter";
    }

    setFrom(me === "Jemimah" || me === "Joel" ? me : null);
    form.addEventListener("change", function (e) {
      if (e.target.name !== "from") return;
      writeStore(ME_KEY, e.target.value);
      setFrom(e.target.value);
    });
    text.addEventListener("input", function () { count.textContent = text.value.length + " / " + NOTE_MAX; });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var chosen = form.querySelector('input[name="from"]:checked');
      var msg = text.value.trim().slice(0, NOTE_MAX);
      if (!chosen) { status.textContent = "Choose who the letter is from ♥"; return; }
      if (!msg) { status.textContent = "Write a few words first ♥"; text.focus(); return; }

      var from = chosen.value;
      var to = otherOf(from);
      var date = dateKey(new Date());
      var code = toB64Url(JSON.stringify({ f: from, m: msg, d: date }));
      var url = location.origin + location.pathname + "#note=" + code;
      keepLetter({ from: from, to: to, msg: msg, date: date });
      renderKept();

      shareLink({
        url: url,
        title: "A sealed letter for " + to,
        text: "I sealed a letter for you, " + to + " 💌",
        status: status,
        shared: "Sealed and sent to " + to + " ♥",
        copied: "Sealed! The link is copied. Paste it to " + to + " ♥",
        done: function (note) {
          status.textContent = note;
          text.value = "";
          count.textContent = "0 / " + NOTE_MAX;
        }
      });
    });

    renderKept();
  }

  /* ---------- Bible plan together ----------
   * Self-paced: the next reading is the first one not yet ticked.
   * Progress is kept on each phone and can be sent to the other phone as a link.
   */

  var PLANS = C.plans.map(function (p) {
    var days = p.days ? p.days.slice() : [];
    (p.books || []).forEach(function (b) {
      // A single psalm is "Psalm 23", the book is "Psalms"
      var name = b[0] === "Psalms" ? "Psalm" : b[0];
      for (var ch = 1; ch <= b[1]; ch++) days.push({ ref: name + " " + ch, book: b[0] });
    });
    return { id: p.id, title: p.title, about: p.about, days: days, byBook: !!p.books };
  });

  function planById(id) {
    return PLANS.filter(function (p) { return p.id === id; })[0] || PLANS[0];
  }

  var plan = { track: null, done: {}, view: null, settling: false, timer: null };

  function loadPlan() {
    plan.track = planById(S.planTrack()).id;
    PLANS.forEach(function (p) {
      var set = S.planDone(p.id);
      plan.done[p.id] = new Set(Array.from(set).filter(function (i) { return i >= 0 && i < p.days.length; }));
    });
  }
  loadPlan();

  function savePlan() {
    S.setPlanTrack(plan.track);
    PLANS.forEach(function (p) { S.setPlanDone(p.id, plan.done[p.id]); });
  }

  function firstUnread(p) {
    var done = plan.done[p.id];
    for (var i = 0; i < p.days.length; i++) if (!done.has(i)) return i;
    return -1;
  }

  // "#plan=love~<bits>,gospels~<bits>,bible~<bits>", one bit per reading
  function planCode() {
    return PLANS.map(function (p) {
      var bytes = new Uint8Array(Math.ceil(p.days.length / 8));
      plan.done[p.id].forEach(function (i) { bytes[i >> 3] |= 1 << (i & 7); });
      return p.id + "~" + bytesToB64Url(bytes);
    }).join(",");
  }

  // Returns how many readings a progress link added, or null when there was no such link.
  function readPlanFromLink() {
    var m = location.hash.match(/^#plan=([a-z]+~[A-Za-z0-9_-]*(?:,[a-z]+~[A-Za-z0-9_-]*)*)$/);
    if (!m) return null;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
    var added = 0;
    m[1].split(",").forEach(function (part) {
      var bits = part.split("~");
      var p = PLANS.filter(function (x) { return x.id === bits[0]; })[0];
      if (!p) return;
      var bytes;
      try { bytes = b64UrlToBytes(bits[1]); } catch (e) { return; }
      for (var i = 0; i < p.days.length && (i >> 3) < bytes.length; i++) {
        if ((bytes[i >> 3] >> (i & 7)) & 1 && !plan.done[p.id].has(i)) {
          plan.done[p.id].add(i);
          added++;
        }
      }
    });
    if (added) savePlan();
    return added;
  }

  function renderPlan() {
    var p = planById(plan.track);
    var done = plan.done[p.id];
    var n = p.days.length;
    var next = firstUnread(p);
    var idx = plan.view !== null ? plan.view : next;

    $("#plan-tracks").querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-plan") === p.id ? "true" : "false");
    });

    var about = $("#plan-about");
    about.textContent = p.about;
    var left = n - done.size;
    if (left > 0) {
      var finish = dayNumber(new Date()) + left - 1;
      about.append(" At one a day, you will finish on " + fmtDay(finish, { day: "numeric", month: "long", year: "numeric" }) +
        (finish < dayNumber(WEDDING) ? ", before our wedding ♥" : "."));
    }

    var label = $("#plan-day");
    var title = $("#plan-day-title");
    var ref = $("#plan-day-ref");
    var ask = $("#plan-day-ask");
    var open = $("#plan-open");
    var btn = $("#plan-done");
    if (idx === -1) {
      label.textContent = p.title + " · complete";
      title.textContent = "Finished together ♥";
      ref.textContent = "All " + fmtNum(n) + " readings, read together";
      ask.textContent = "Praise God! Choose another plan above, or begin this one again.";
      open.hidden = true;
      btn.textContent = "Begin again";
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("data-mode", "restart");
    } else {
      var day = p.days[idx];
      var isDone = done.has(idx);
      label.textContent = "Day " + fmtNum(idx + 1) + " of " + fmtNum(n) + " · " + p.title;
      title.textContent = day.title || day.ref;
      ref.textContent = day.title ? day.ref : "";
      ask.textContent = day.ask || "Share one thing that stood out to you, then pray it back to God together.";
      open.hidden = false;
      open.href = bibleLink(day.ref);
      btn.textContent = isDone ? "Read together ✓" : "We read it together";
      btn.setAttribute("aria-pressed", isDone ? "true" : "false");
      btn.setAttribute("data-mode", "toggle");
    }
    $("#plan-back").hidden = plan.settling || plan.view === null || plan.view === next;

    $("#plan-bar").style.width = (done.size / n) * 100 + "%";
    $("#plan-count").textContent = fmtNum(done.size) + " of " + fmtNum(n) + " read together · " + Math.floor((done.size / n) * 100) + "%";

    var altar = $("#altar-plan");
    altar.textContent = "";
    if (next === -1) {
      altar.textContent = "You finished " + p.title + " together ♥";
    } else {
      altar.append(p.title + ", day " + fmtNum(next + 1) + ": ");
      altar.appendChild(el("strong", null, p.days[next].ref));
    }

    if ($("#plan-all").open) renderPlanList();
  }

  function renderPlanList() {
    var p = planById(plan.track);
    var done = plan.done[p.id];
    var current = plan.view !== null ? plan.view : firstUnread(p);
    var root = $("#plan-list");
    root.textContent = "";

    function dayButton(i, cls) {
      var b = el("button", cls + (done.has(i) ? " is-done" : "") + (i === current ? " is-current" : ""));
      b.type = "button";
      b.setAttribute("data-day", i);
      b.setAttribute("aria-label", "Day " + (i + 1) + ", " + p.days[i].ref + (done.has(i) ? ", read" : ""));
      return b;
    }

    if (!p.byBook) {
      var list = el("ol", "plan-days");
      p.days.forEach(function (d, i) {
        var b = dayButton(i, "plan-day");
        b.appendChild(el("span", "plan-day__num", done.has(i) ? "✓" : String(i + 1)));
        b.appendChild(el("span", "plan-day__title", d.title));
        b.appendChild(el("span", "plan-day__ref", d.ref));
        var li = el("li");
        li.appendChild(b);
        list.appendChild(li);
      });
      root.appendChild(list);
      return;
    }

    var books = [];
    p.days.forEach(function (d, i) {
      if (!books.length || books[books.length - 1].name !== d.book) books.push({ name: d.book, days: [] });
      books[books.length - 1].days.push(i);
    });
    // One folding row per book; the book with the current reading starts open.
    books.forEach(function (bk) {
      var read = bk.days.filter(function (i) { return done.has(i); }).length;
      var row = el("details", "plan-book" + (read === bk.days.length ? " is-done" : ""));
      row.open = bk.days.indexOf(current) !== -1;
      var head = el("summary", "plan-book__head");
      head.appendChild(el("span", "plan-book__name", bk.name));
      head.appendChild(el("span", "plan-book__count", read === bk.days.length ? "✓ " + plural(read, "chapter") : read + " of " + bk.days.length));
      row.appendChild(head);
      var pills = el("div", "plan-book__chapters");
      bk.days.forEach(function (i, k) {
        var b = dayButton(i, "plan-pill");
        b.textContent = String(k + 1);
        pills.appendChild(b);
      });
      row.appendChild(pills);
      root.appendChild(row);
    });
  }

  function initPlan() {
    var tracks = $("#plan-tracks");
    PLANS.forEach(function (p) {
      var b = el("button", "plan-track");
      b.type = "button";
      b.setAttribute("data-plan", p.id);
      b.appendChild(el("span", "plan-track__title", p.title));
      b.appendChild(el("span", "plan-track__len", fmtNum(p.days.length) + " days"));
      b.addEventListener("click", function () {
        plan.track = p.id;
        plan.view = null;
        savePlan();
        renderPlan();
      });
      tracks.appendChild(b);
    });

    $("#plan-done").addEventListener("click", function () {
      var p = planById(plan.track);
      var done = plan.done[p.id];
      if (this.getAttribute("data-mode") === "restart") {
        confirmDelete({
          title: "Begin " + p.title + " again?",
          text: "All the ticks for this plan will be cleared, and you start again from day 1.",
          withBackup: "Download backup, then begin again",
          yes: "Begin again without a backup"
        }).then(function (r) {
          if (!r.ok) return;
          done.clear();
          plan.view = null;
          savePlan();
          renderPlan();
        });
        return;
      }
      var idx = plan.view !== null ? plan.view : firstUnread(p);
      clearTimeout(plan.timer);
      if (done.has(idx)) {
        done.delete(idx);
        savePlan();
        renderPlan();
        return;
      }
      done.add(idx);
      savePlan();
      var r = this.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, 24);
      // Stay on the reading for a moment to show the tick, then move on to the next one.
      plan.view = idx;
      plan.settling = true;
      renderPlan();
      plan.timer = setTimeout(function () {
        plan.view = null;
        plan.settling = false;
        renderPlan();
      }, 1400);
    });

    $("#plan-back").addEventListener("click", function () {
      plan.view = null;
      renderPlan();
    });

    $("#plan-all").addEventListener("toggle", function () {
      if (this.open) renderPlanList();
    });

    $("#plan-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-day]");
      if (!b) return;
      clearTimeout(plan.timer);
      plan.settling = false;
      plan.view = +b.getAttribute("data-day");
      renderPlan();
      $(".plan-today").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });

    var me = readStore(ME_KEY);
    var other = me === "Jemimah" || me === "Joel" ? otherOf(me) : null;
    var shareBtn = $("#plan-share");
    if (other) shareBtn.textContent = "Send our progress to " + other;
    shareBtn.addEventListener("click", function () {
      var status = $("#plan-status");
      var where = other ? other + "’s phone" : "the other phone";
      shareLink({
        url: location.origin + location.pathname + "#plan=" + planCode(),
        title: "Our Bible plan",
        text: "Our Bible plan progress ♥ Open it to keep our readings in step.",
        status: status,
        shared: "Sent! Open the link on " + where + " ♥",
        copied: "Link copied. Open it on " + where + " ♥",
        done: function (msg) { status.textContent = msg; }
      });
    });

    renderPlan();
  }

  /* ---------- Envelope, letter and proposal ---------- */

  var proposal = {};

  function initProposal(note, afterClose) {
    var overlay = $("#proposal");
    var stage = $("#envelope-stage");
    var seal = $("#seal");
    var noteCard = $("#note-card");
    var card = $("#proposal-card");
    var question = $("#proposal-question");
    var tally = $("#proposal-tally");
    var buttons = card.querySelectorAll("[data-yes]");
    var timers = [];
    var pending = note;
    var replyAs = null;

    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

    function dressEnvelope() {
      var title = $("#envelope-title");
      title.textContent = "";
      if (pending) {
        $("#envelope-kicker").textContent = "Sealed with love";
        title.append("A letter from ");
        title.appendChild(el("span", "royal", pending.from));
        title.append(" for ");
        title.appendChild(el("span", "royal", pending.to));
        $("#envelope-letter-text").textContent = "For you, " + pending.to + " ♥";
      } else {
        // The daily proposal is always from Joel to Jemimah.
        $("#envelope-kicker").textContent = "The Holy Matrimony Celebration";
        title.append("A letter from ");
        title.appendChild(el("span", "royal", "Joel"));
        title.append(" to ");
        title.appendChild(el("span", "royal", "Jemimah"));
        $("#envelope-letter-text").textContent = "Will you marry me?";
      }
    }

    function reset() {
      timers.forEach(clearTimeout);
      timers = [];
      overlay.classList.remove("is-closing", "is-answered");
      stage.classList.remove("is-open", "is-gone");
      stage.hidden = false;
      noteCard.hidden = true;
      card.hidden = true;
      question.textContent = "Will you marry me?";
      dressEnvelope();
      var state = yesState();
      if (state.last === dateKey(new Date())) tally.textContent = "You already said yes today. Say it once more ♥";
      else if (state.days > 0) tally.textContent = "You have said yes on " + plural(state.days, "day") + " so far ♥";
      else tally.textContent = "";
      overlay.hidden = false;
      document.body.classList.add("is-locked");
      seal.focus({ preventScroll: true });
    }

    function showProposal() {
      noteCard.hidden = true;
      card.hidden = false;
      buttons[0].focus({ preventScroll: true });
    }

    function showNote() {
      $("#note-to").textContent = "My dearest " + pending.to + ",";
      $("#note-msg").textContent = pending.msg;
      $("#note-from").textContent = "— " + pending.from;
      $("#note-date").textContent = pending.date ? fmtKey(pending.date) : "";
      noteCard.hidden = false;
      $("#note-continue").focus({ preventScroll: true });
    }

    function openEnvelope() {
      if (stage.classList.contains("is-open")) return;
      soundOn(); // the seal tap is the gesture that lets the sound play
      stage.classList.add("is-open");
      var r = seal.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2);
      later(function () { stage.classList.add("is-gone"); }, reduceMotion ? 100 : 2100);
      later(function () {
        stage.hidden = true;
        if (pending) showNote();
        else showProposal();
      }, reduceMotion ? 200 : 2600);
    }

    function close() {
      overlay.classList.add("is-closing");
      document.body.classList.remove("is-locked");
      pending = null;
      later(function () {
        overlay.hidden = true;
        if (replyAs) {
          writeStore(ME_KEY, replyAs);
          var radio = document.querySelector('#compose input[value="' + replyAs + '"]');
          if (radio) { radio.checked = true; radio.dispatchEvent(new Event("change", { bubbles: true })); }
          replyAs = null;
          $("#letters").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
          $("#note-text").focus({ preventScroll: true });
        } else if (afterClose) {
          var fn = afterClose;
          afterClose = null;
          fn();
        }
      }, 900);
    }

    seal.addEventListener("click", openEnvelope);
    $("#note-continue").addEventListener("click", showProposal);
    $("#note-reply").addEventListener("click", function () {
      replyAs = pending.to;
      showProposal();
    });

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (overlay.classList.contains("is-answered")) return;
        overlay.classList.add("is-answered");
        soundOn();

        var days = recordYes();
        question.textContent = "Yes! Forever, in Christ ♥";
        tally.textContent = days ? "That makes " + plural(days, "day") + " of saying yes" : "Said yes again today";
        showTally(days);

        var rect = btn.getBoundingClientRect();
        burst(e.clientX || rect.left + rect.width / 2, e.clientY || rect.top + rect.height / 2);
        later(close, reduceMotion ? 300 : 1400);
      });
    });

    // Keep keyboard focus inside the overlay while it is open.
    overlay.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var focusables = !card.hidden ? Array.prototype.slice.call(buttons)
        : !noteCard.hidden ? [$("#note-continue"), $("#note-reply")] : [seal];
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    proposal.replay = function () {
      window.scrollTo({ top: 0 });
      reset();
    };

    reset();
  }

  /* ---------- Preparing together ---------- */

  var refreshPrep = function () {};

  function renderPrep() {
    var root = $("#prep-list");
    var ids = [];
    var inputs = [];

    C.preparation.forEach(function (group, gi) {
      var card = el("article", "card prep-group");
      card.appendChild(el("h3", "card__title", group.title));
      group.items.forEach(function (text, ii) {
        var id = "prep-" + gi + "-" + ii;
        ids.push(id);
        var label = el("label", "check");
        var input = document.createElement("input");
        input.type = "checkbox";
        input.checked = S.prepOn(id);
        input.addEventListener("change", function () {
          S.setPrep(id, input.checked);
          update();
        });
        inputs.push({ id: id, input: input });
        label.appendChild(input);
        label.appendChild(el("span", null, text));
        card.appendChild(label);
      });
      root.appendChild(card);
    });

    function update() {
      var n = ids.filter(function (id) { return S.prepOn(id); }).length;
      $("#prep-bar").style.width = (n / ids.length) * 100 + "%";
      $("#prep-count").textContent = n === ids.length
        ? "All " + ids.length + " done. Praise God! ♥"
        : n + " of " + ids.length + " prepared";
    }
    update();
    refreshPrep = function () {
      inputs.forEach(function (x) { x.input.checked = S.prepOn(x.id); });
      update();
    };
  }

  /* ---------- Top bar, menu and gentle reveal ---------- */

  function initTopbar() {
    var bar = $("#topbar");
    var hero = $(".hero");
    var menu = $("#menu");
    var menuBtn = $("#menu-btn");
    var ticking = false;

    function check() {
      ticking = false;
      bar.classList.toggle("is-visible", window.scrollY > hero.offsetHeight * 0.6);
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(check); }
    }, { passive: true });
    check();

    function openMenu() {
      menu.hidden = false;
      menuBtn.setAttribute("aria-expanded", "true");
      document.body.classList.add("is-locked");
      menu.querySelector("a").focus();
    }
    function closeMenu(restoreFocus) {
      menu.hidden = true;
      menuBtn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("is-locked");
      if (restoreFocus) menuBtn.focus();
    }

    menuBtn.addEventListener("click", openMenu);
    $("#menu-close").addEventListener("click", function () { closeMenu(true); });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) closeMenu(true);
    });
  }

  function initReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var targets = [];
    document.querySelectorAll("main .container").forEach(function (box) {
      Array.prototype.forEach.call(box.children, function (child) {
        if (child.matches(".grid, .altar, .letters, .stats")) {
          Array.prototype.forEach.call(child.children, function (item, i) {
            item.style.setProperty("--delay", Math.min(i, 4) * 0.08 + "s");
            targets.push(item);
          });
        } else {
          targets.push(child);
        }
      });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
    targets.forEach(function (t) {
      t.classList.add("reveal");
      io.observe(t);
    });
  }

  /* ---------- Footer actions ---------- */

  function initFooter() {
    var toast = $("#toast");
    function say(msg) {
      toast.textContent = msg;
      setTimeout(function () { if (toast.textContent === msg) toast.textContent = ""; }, 3500);
    }

    $("#share-btn").addEventListener("click", function () {
      var data = { title: document.title, text: "Jemimah & Joel · United in Christ, bound in eternal love", url: location.href.split("#")[0] };
      if (navigator.share) {
        navigator.share(data).catch(noop);
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(data.url).then(function () { say("Link copied ♥"); }, function () { say(data.url); });
      } else {
        say(data.url);
      }
    });

    $("#replay-btn").addEventListener("click", function () { proposal.replay(); });
  }

  /* ---------- Sync & backup ---------- */

  var sheetsOpen = 0;
  function sheetLock(on) {
    sheetsOpen = Math.max(0, sheetsOpen + (on ? 1 : -1));
    document.documentElement.classList.toggle("has-sheet", sheetsOpen > 0);
  }

  // Ask before deleting anything, and offer a backup first. Resolves { ok, remote }.
  function confirmDelete(opts) {
    return new Promise(function (resolve) {
      var sheet = $("#confirm-sheet");
      var remote = $("#confirm-remote");
      var back = document.activeElement;
      $("#confirm-title").textContent = opts.title;
      $("#confirm-text").textContent = opts.text;
      $("#confirm-backup").textContent = opts.withBackup || "Download backup, then delete";
      $("#confirm-yes").textContent = opts.yes || "Delete without a backup";
      $("#confirm-remote-wrap").hidden = !opts.remote;
      remote.checked = false;
      sheet.hidden = false;
      sheetLock(true);
      $("#confirm-backup").focus();

      function finish(ok, backup) {
        sheet.hidden = true;
        sheetLock(false);
        sheet.removeEventListener("click", onClick);
        sheet.removeEventListener("keydown", onKey);
        if (ok && backup) S.downloadBackup();
        if (back && back.focus) back.focus({ preventScroll: true });
        resolve({ ok: ok, remote: ok && remote.checked });
      }
      function onClick(e) {
        if (e.target === sheet || e.target.id === "confirm-no") finish(false);
        else if (e.target.id === "confirm-backup") finish(true, true);
        else if (e.target.id === "confirm-yes") finish(true, false);
      }
      function onKey(e) { if (e.key === "Escape") finish(false); }
      sheet.addEventListener("click", onClick);
      sheet.addEventListener("keydown", onKey);
    });
  }

  function ago(iso) {
    var mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return plural(mins, "minute") + " ago";
    var hours = Math.round(mins / 60);
    if (hours < 24) return plural(hours, "hour") + " ago";
    return "on " + fmtKey(dateKey(new Date(iso)));
  }

  function initSync() {
    var btn = $("#sync-btn");
    var sheet = $("#sync-sheet");
    var status = $("#sync-status");
    var connectBtn = $("#sync-connect");
    var note = null; // a short message that stays for a few seconds

    function say(text, isError) {
      note = { text: text, error: !!isError, until: Date.now() + 6000 };
      render();
    }

    function render() {
      var st = S.sync.status();
      var on = S.sync.configured();
      btn.setAttribute("data-status", st);
      btn.setAttribute("aria-label", "Sync and backup" + (st === "syncing" ? ", syncing" : st === "error" ? ", needs attention" : on ? ", synced" : ""));
      $("#sync-setup").hidden = on;
      $("#sync-connected").hidden = !on;
      $("#sync-auto").checked = S.sync.auto();
      status.classList.toggle("is-error", st === "error" || (st === "off" && !!S.sync.message()));
      if (note && note.until > Date.now() && st !== "syncing" && st !== "error") {
        status.classList.toggle("is-error", note.error);
        status.textContent = note.text;
      } else status.textContent = st === "syncing" ? "Syncing…"
        : st === "error" || (st === "off" && S.sync.message()) ? S.sync.message()
        : on ? (S.sync.last() ? "Both phones are in step ♥" : "Ready to sync")
        : "Saved on this phone only, for now.";
      $("#sync-last").textContent = S.sync.last()
        ? "Last synced " + ago(S.sync.last()) + (S.sync.auto() ? ". It syncs by itself whenever something changes." : ".")
        : "Not synced yet.";

      var sum = S.summary();
      var list = $("#sync-summary");
      list.textContent = "";
      [
        "Said yes on " + plural(sum.yes, "day"),
        fmtNum(sum.plan) + " Bible " + (sum.plan === 1 ? "reading" : "readings") + " read together",
        plural(sum.letters, "love letter"),
        sum.prep + " of 19 preparations done"
      ].forEach(function (t) { list.appendChild(el("li", null, t)); });
    }

    function open() {
      if (!sheet.hidden) return;
      render();
      sheet.hidden = false;
      sheetLock(true);
      $("#sync-close").focus();
    }
    function close() {
      if (sheet.hidden) return;
      sheet.hidden = true;
      sheetLock(false);
      btn.focus({ preventScroll: true });
    }

    S.sync.onStatus(render);
    S.onChange(function () { if (!sheet.hidden) render(); });
    btn.addEventListener("click", open);
    $("#sync-close").addEventListener("click", close);
    sheet.addEventListener("click", function (e) { if (e.target === sheet) close(); });
    sheet.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("#confirm-sheet").hidden) close(); });
    document.querySelectorAll("[data-open-sync]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); setTimeout(open, 50); });
    });

    connectBtn.addEventListener("click", function () {
      var token = $("#sync-token").value.trim();
      var secret = $("#sync-secret").value;
      if (!/^(github_pat_|ghp_)/.test(token)) { say("Paste our GitHub key. It starts with github_pat_.", true); return; }
      if (secret.length < 6) { say("Choose a secret word of at least 6 letters, the same on both phones.", true); return; }
      connectBtn.disabled = true;
      S.sync.connect(token, secret).then(function (ok) {
        connectBtn.disabled = false;
        if (ok) { $("#sync-token").value = ""; $("#sync-secret").value = ""; }
        render();
      });
    });
    $("#sync-now").addEventListener("click", function () { S.sync.now(); });
    $("#sync-auto").addEventListener("change", function () { S.sync.setAuto(this.checked); render(); });
    $("#sync-disconnect").addEventListener("click", function () {
      if (!window.confirm("Stop syncing on this phone? Everything stays saved here.")) return;
      S.sync.disconnect();
      render();
    });

    $("#backup-download").addEventListener("click", function () {
      S.downloadBackup();
      say("Backup downloaded ♥ Keep it somewhere safe.");
    });
    $("#backup-file").addEventListener("change", function () {
      var file = this.files && this.files[0];
      var input = this;
      if (!file) return;
      file.text().then(function (text) {
        S.restoreBackup(text);
        say("Backup restored ♥");
      }).catch(function (err) {
        say(err && err.message ? err.message : "That file couldn’t be read.", true);
      }).then(function () { input.value = ""; });
    });

    $("#site-update").addEventListener("click", function () {
      say("Loading the latest version…");
      var go = function () { location.reload(); };
      if (S.sync.configured()) S.sync.now().then(go, go);
      else go();
    });

    $("#data-delete").addEventListener("click", function () {
      var synced = S.sync.configured();
      confirmDelete({
        title: "Delete everything on this phone?",
        text: "Your yes days, Bible plan, checklist and love letters will be removed from this phone." +
          (synced ? " Syncing will also be turned off here." : ""),
        remote: synced
      }).then(function (r) {
        if (!r.ok) return;
        var removeRemote = r.remote ? S.sync.deleteRemote() : Promise.resolve();
        return removeRemote.catch(function () { /* still delete on this phone */ }).then(function () {
          S.sync.disconnect();
          S.wipe();
          // Give the backup download a moment to start before reloading.
          setTimeout(function () { location.reload(); }, 1200);
        });
      });
    });

    render();
  }

  /* ---------- Start ---------- */

  S.onChange(function (external) {
    if (!external) return;
    loadPlan();
    renderPlan();
    refreshPrep();
    renderKept();
    showTally(yesState().days);
  });

  renderPillars();
  renderRoles();
  renderPromises();
  var incoming = readNoteFromLink(); // before the letters list is drawn, so it is kept there
  var planAdded = readPlanFromLink();
  renderLibrary();
  renderPrep();
  renderDaily();
  initPlan();
  startCountdown();
  showTally(yesState().days);
  initLetters();
  initMusic();
  initPetals();
  initVisualiser();
  initTopbar();
  initReveal();
  initProposal(incoming, planAdded === null ? null : function () {
    $("#plan-status").textContent = planAdded
      ? "Added " + plural(planAdded, "reading") + " from the other phone ♥"
      : "Both phones are already in step ♥";
    $("#plan").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });
  initFooter();
  initSync();
})();
