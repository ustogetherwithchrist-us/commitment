(function () {
  "use strict";

  var C = window.CONTENT;
  var WEDDING = new Date(2032, 9, 16, 0, 0, 0); // 16 Oct 2032, midnight local time
  var DAY_MS = 864e5;
  var SONG_ID = "SuPCTBmISzQ";
  var SONG_START = 47; // seconds
  var YES_KEY = "jj-said-yes";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(sel) { return document.querySelector(sel); }

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

    caption.textContent = "until " + WEDDING.toLocaleDateString("en-GB", {
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
    var tally = $("#yes-tally");
    tally.textContent = days ? "♥ You have said yes on " + plural(days, "day") + " ♥" : "";
  }

  /* ---------- Music (YouTube IFrame API) ---------- */

  var music = { player: null, ready: false, wantPlay: false, failed: false, timer: null };
  var musicBtn = $("#music-btn");
  var musicLink = $("#music-link");

  function setPlaying(on) {
    musicBtn.classList.toggle("is-playing", on);
    musicBtn.setAttribute("aria-pressed", on ? "true" : "false");
    musicBtn.setAttribute("aria-label", on ? "Pause our song" : "Play our song");
  }

  function musicFallback() {
    music.failed = true;
    musicBtn.hidden = true;
    musicLink.hidden = false;
  }

  function musicRestore() {
    music.failed = false;
    musicBtn.hidden = false;
    musicLink.hidden = true;
  }

  function playSong() {
    music.wantPlay = true;
    if (!music.ready || music.failed) return;
    music.player.unMute();
    music.player.playVideo();
  }

  function pauseSong() {
    music.wantPlay = false;
    if (music.ready) music.player.pauseVideo();
    setPlaying(false);
  }

  function initMusic() {
    musicBtn.addEventListener("click", function () {
      if (musicBtn.classList.contains("is-playing")) pauseSong();
      else playSong();
    });

    window.onYouTubeIframeAPIReady = function () {
      music.player = new window.YT.Player("yt-player", {
        width: "200",
        height: "200",
        videoId: SONG_ID,
        playerVars: { start: SONG_START, autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, fs: 0 },
        events: {
          onReady: function () {
            music.ready = true;
            clearTimeout(music.timer);
            musicRestore();
            music.player.setVolume(85);
            if (music.wantPlay) playSong();
          },
          onStateChange: function (e) {
            var S = window.YT.PlayerState;
            if (e.data === S.ENDED) {
              // Loop from the chosen moment rather than the very start.
              music.player.seekTo(SONG_START, true);
              music.player.playVideo();
            } else if (e.data === S.PLAYING) {
              setPlaying(true);
            } else if (e.data === S.PAUSED) {
              setPlaying(false);
            }
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
    for (var i = 0; i < 36; i++) {
      var s = el("span", "spark");
      var angle = Math.random() * Math.PI * 2;
      var dist = 80 + Math.random() * 180;
      s.style.left = x + "px";
      s.style.top = y + "px";
      s.style.setProperty("--x", (Math.cos(angle) * dist).toFixed(0) + "px");
      s.style.setProperty("--y", (Math.sin(angle) * dist).toFixed(0) + "px");
      s.style.setProperty("--r", (Math.random() * 720 - 360).toFixed(0) + "deg");
      document.body.appendChild(s);
      s.addEventListener("animationend", function () { this.remove(); });
    }
  }

  /* ---------- The proposal ---------- */

  function initProposal() {
    var overlay = $("#proposal");
    var question = $("#proposal-question");
    var tally = $("#proposal-tally");
    var buttons = overlay.querySelectorAll("[data-yes]");
    var state = yesState();
    var today = dateKey(new Date());

    if (state.last === today) tally.textContent = "You already said yes today. Say it once more ♥";
    else if (state.days > 0) tally.textContent = "You have said yes on " + plural(state.days, "day") + " so far ♥";

    function close() {
      overlay.classList.add("is-closing");
      document.body.classList.remove("is-locked");
      setTimeout(function () { overlay.hidden = true; }, 900);
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (overlay.classList.contains("is-answered")) return;
        overlay.classList.add("is-answered");

        // Start the song inside the tap itself: browsers only allow sound after a user gesture.
        playSong();

        var days = recordYes();
        question.textContent = "Yes! Forever, in Christ ♥";
        tally.textContent = days ? "That makes " + plural(days, "day") + " of saying yes" : "Said yes again today";
        showTally(days);

        var rect = btn.getBoundingClientRect();
        burst(e.clientX || rect.left + rect.width / 2, e.clientY || rect.top + rect.height / 2);
        setTimeout(close, reduceMotion ? 300 : 1400);
      });
    });

    // Keep keyboard focus inside the pop-up while it is open.
    overlay.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var first = buttons[0];
      var last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    buttons[0].focus({ preventScroll: true });
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
  initProposal();
})();
