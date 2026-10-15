(function () {
  "use strict";

  var C = window.CONTENT;
  var WEDDING = new Date(2032, 9, 16, 0, 0, 0); // 16 Oct 2032, midnight local time
  var DAY_MS = 864e5;
  var YES_KEY = "jj-said-yes";

  var SONG = {
    youtubeId: "SuPCTBmISzQ",
    start: 47, // seconds into the song where playback (and every loop) begins
    // Optional: put your own copy of the song at this path and the visualiser
    // will listen to the real audio instead of following the beat.
    file: "audio/song.mp3",
    // Used with YouTube, where browsers do not let a page hear the audio:
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

  function renderToday() {
    var now = new Date();
    var n = dayNumber(now);
    var verses = allVerses();
    var promises = allPromises();
    // Step through the lists by a large prime so consecutive days jump between themes.
    var verse = verses[(n * 7919) % verses.length];
    var promise = promises[(n * 104729) % promises.length];

    $("#today-date").textContent = now.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    var holder = $("#verse-of-day");
    holder.appendChild(el("p", null, verse.text));
    holder.appendChild(el("cite", null, verse.ref));
    $("#promise-of-day").textContent = promise.text;
    $("#promise-of-day-ref").textContent = promise.ref || "";
  }

  /* ---------- Countdown ---------- */

  function startCountdown() {
    var nums = {};
    document.querySelectorAll("[data-unit]").forEach(function (node) { nums[node.getAttribute("data-unit")] = node; });
    var clock = $("#countdown-clock");
    var done = $("#countdown-done");
    var caption = $("#countdown-caption");

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
      nums.days.textContent = Math.floor(s / 86400).toLocaleString("en-GB");
      nums.hours.textContent = pad(Math.floor((s % 86400) / 3600));
      nums.minutes.textContent = pad(Math.floor((s % 3600) / 60));
      nums.seconds.textContent = pad(s % 60);
      return true;
    }

    if (tick()) {
      var timer = setInterval(function () { if (!tick()) clearInterval(timer); }, 1000);
    }
  }

  /* ---------- "Yes" days ---------- */

  function yesState() {
    var data = readStore(YES_KEY);
    if (!data || typeof data.days !== "number") data = { days: 0, last: null };
    return data;
  }

  function recordYes() {
    var data = yesState();
    var today = dateKey(new Date());
    if (data.last !== today) {
      data.days += 1;
      data.last = today;
    }
    return writeStore(YES_KEY, data) ? data.days : null;
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

  function updateMusicUI() {
    var audible = music.playing && !music.muted;
    musicBtn.classList.toggle("is-playing", audible);
    musicBtn.classList.toggle("is-muted", !music.failed && !audible && !music.userPaused);
    musicBtn.setAttribute("aria-pressed", audible ? "true" : "false");
    musicBtn.setAttribute("aria-label", audible ? "Pause our song" : "Play our song");
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
    a.play().catch(noop); // muted autoplay
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
    avgBass: 0.2,
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
    var bass = (viz.target[0] + viz.target[1] + viz.target[2] + viz.target[3]) / 4;
    viz.avgBass = viz.avgBass * 0.96 + bass * 0.04;
    if (bass > viz.avgBass * 1.22 && bass > 0.25 && now - viz.lastBeatAt > 300) {
      viz.lastBeatAt = now;
      onBeat(Math.min(1, bass * 1.2));
    }
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

  function burst(x, y) {
    if (reduceMotion) return;
    for (var i = 0; i < 40; i++) {
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

  /* ---------- Envelope + proposal ---------- */

  var proposal = {};

  function initProposal() {
    var overlay = $("#proposal");
    var stage = $("#envelope-stage");
    var seal = $("#seal");
    var card = $("#proposal-card");
    var question = $("#proposal-question");
    var tally = $("#proposal-tally");
    var buttons = card.querySelectorAll("[data-yes]");
    var timers = [];

    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

    function reset() {
      timers.forEach(clearTimeout);
      timers = [];
      overlay.classList.remove("is-closing", "is-answered");
      stage.classList.remove("is-open", "is-gone");
      stage.hidden = false;
      card.hidden = true;
      question.textContent = "Will you marry me?";
      var state = yesState();
      if (state.last === dateKey(new Date())) tally.textContent = "You already said yes today. Say it once more ♥";
      else if (state.days > 0) tally.textContent = "You have said yes on " + plural(state.days, "day") + " so far ♥";
      else tally.textContent = "";
      overlay.hidden = false;
      document.body.classList.add("is-locked");
      seal.focus({ preventScroll: true });
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
        card.hidden = false;
        buttons[0].focus({ preventScroll: true });
      }, reduceMotion ? 200 : 2600);
    }

    function close() {
      overlay.classList.add("is-closing");
      document.body.classList.remove("is-locked");
      later(function () { overlay.hidden = true; }, 900);
    }

    seal.addEventListener("click", openEnvelope);

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
      var focusables = card.hidden ? [seal] : Array.prototype.slice.call(buttons);
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

  /* ---------- Start ---------- */

  renderPillars();
  renderRoles();
  renderPromises();
  renderLibrary();
  renderToday();
  startCountdown();
  showTally(yesState().days);
  initMusic();
  initPetals();
  initVisualiser();
  initProposal();
  initFooter();
})();
