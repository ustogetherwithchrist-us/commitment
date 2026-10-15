/*
 * Everything the two of us save (yes days, Bible plan, checklist, love letters) lives here,
 * in one small "database" on each phone. It can be synced through a file in the GitHub repo,
 * locked with a secret word (AES-GCM) so only we can read it, and backed up as a file.
 *
 * Merging is conflict-free: each choice remembers when it was made, and the latest wins.
 * Ticks are stored as a timestamp: +t means "done at t", -t means "undone at t".
 */
window.JJStore = (function () {
  "use strict";

  var DB_KEY = "jj-db";
  var SYNC_KEY = "jj-sync";
  var REPO = { owner: "ustogetherwithchrist-us", repo: "commitment", branch: "sync-data", path: "us.json" };
  var API = "https://api.github.com";
  var FORMAT = "jemimah-joel-sync";

  function now() { return Date.now(); }
  function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }

  function emptyDb() {
    return { v: 1, yes: { dates: {}, legacy: 0 }, plan: { track: null, done: {} }, prep: {}, letters: {} };
  }

  // Short, stable id for a letter (FNV-1a), so ids stay small however long the letter is.
  function hashId(str) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619);
      h2 = Math.imul(h2 ^ c, 2246822519);
    }
    return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
  }

  /* ---------- Load, and move the older separate keys into the database once ---------- */

  function normalise(db) {
    var d = emptyDb();
    if (!db || typeof db !== "object") return d;
    if (db.yes) {
      if (db.yes.dates && typeof db.yes.dates === "object") d.yes.dates = db.yes.dates;
      d.yes.legacy = +db.yes.legacy || 0;
    }
    if (db.plan) {
      if (db.plan.track && typeof db.plan.track.v === "string") d.plan.track = { v: db.plan.track.v, t: +db.plan.track.t || 0 };
      if (db.plan.done && typeof db.plan.done === "object") d.plan.done = db.plan.done;
    }
    if (db.prep && typeof db.prep === "object") d.prep = db.prep;
    if (db.letters && typeof db.letters === "object") d.letters = db.letters;
    return d;
  }

  function migrate() {
    var d = emptyDb();
    var t = now();
    var yes = read("jj-said-yes");
    if (yes && typeof yes.days === "number") {
      d.yes.legacy = yes.days;
      if (yes.last) d.yes.dates[yes.last] = 1;
    }
    var plan = read("jj-plan");
    if (plan) {
      if (plan.track) d.plan.track = { v: plan.track, t: 1 };
      Object.keys(plan.done || {}).forEach(function (pid) {
        d.plan.done[pid] = {};
        (plan.done[pid] || []).forEach(function (i) { d.plan.done[pid][i] = t; });
      });
    }
    var prep = read("jj-prep");
    Object.keys(prep || {}).forEach(function (id) { if (prep[id]) d.prep[id] = t; });
    var list = read("jj-letters");
    (Array.isArray(list) ? list : []).forEach(function (l, i) {
      if (!l || !l.msg) return;
      var id = hashId(l.from + "|" + l.to + "|" + l.date + "|" + l.msg);
      d.letters[id] = { from: l.from, to: l.to, msg: l.msg, date: l.date || null, t: t - (list.length - i) };
    });
    return d;
  }

  var db = read(DB_KEY) ? normalise(read(DB_KEY)) : migrate();
  write(DB_KEY, db);

  var listeners = [];
  function changed(fromRemote) {
    write(DB_KEY, db);
    listeners.forEach(function (fn) { try { fn(fromRemote); } catch (e) { /* keep going */ } });
    if (!fromRemote) scheduleSync();
  }

  /* ---------- Merging two copies ---------- */

  function lww(a, b) { // signed timestamps: the most recent decision wins
    if (a === undefined) return b;
    if (b === undefined) return a;
    if (Math.abs(b) > Math.abs(a)) return b;
    if (Math.abs(b) === Math.abs(a)) return Math.max(a, b);
    return a;
  }

  function mergeMap(a, b) {
    var out = {};
    Object.keys(a || {}).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b || {}).forEach(function (k) { out[k] = lww(out[k], b[k]); });
    return out;
  }

  function merge(a, b) {
    a = normalise(a);
    b = normalise(b);
    var m = emptyDb();
    Object.keys(a.yes.dates).concat(Object.keys(b.yes.dates)).forEach(function (k) { m.yes.dates[k] = 1; });
    m.yes.legacy = Math.max(a.yes.legacy, b.yes.legacy);
    var ta = a.plan.track, tb = b.plan.track;
    m.plan.track = !ta ? tb : !tb ? ta : (tb.t > ta.t ? tb : ta);
    Object.keys(a.plan.done).concat(Object.keys(b.plan.done)).forEach(function (pid) {
      m.plan.done[pid] = mergeMap(a.plan.done[pid], b.plan.done[pid]);
    });
    m.prep = mergeMap(a.prep, b.prep);
    Object.keys(a.letters).concat(Object.keys(b.letters)).forEach(function (id) {
      var x = a.letters[id], y = b.letters[id];
      m.letters[id] = !x ? y : !y ? x : ((y.t || 0) > (x.t || 0) ? y : x);
    });
    return m;
  }

  // Same data in, same text out, so two copies can be compared.
  function canonical(v) {
    if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
    if (v && typeof v === "object") {
      return "{" + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ":" + canonical(v[k]); }).join(",") + "}";
    }
    return JSON.stringify(v);
  }

  /* ---------- What the page uses ---------- */

  var api = {
    onChange: function (fn) { listeners.push(fn); },

    yesCount: function () { return Math.max(db.yes.legacy, Object.keys(db.yes.dates).length); },
    yesOn: function (day) { return !!db.yes.dates[day]; },
    addYes: function (day) {
      if (!db.yes.dates[day]) { db.yes.dates[day] = 1; changed(false); }
      return api.yesCount();
    },

    planTrack: function () { return db.plan.track ? db.plan.track.v : null; },
    setPlanTrack: function (id) {
      if (api.planTrack() === id) return;
      db.plan.track = { v: id, t: now() };
      changed(false);
    },
    planDone: function (pid) {
      var set = new Set();
      var m = db.plan.done[pid] || {};
      Object.keys(m).forEach(function (k) { if (m[k] > 0) set.add(+k); });
      return set;
    },
    // Bring the store in line with a whole set of ticked readings.
    setPlanDone: function (pid, set) {
      var m = db.plan.done[pid] || (db.plan.done[pid] = {});
      var t = now();
      var dirty = false;
      set.forEach(function (i) { if (!(m[i] > 0)) { m[i] = t; dirty = true; } });
      Object.keys(m).forEach(function (k) { if (m[k] > 0 && !set.has(+k)) { m[k] = -t; dirty = true; } });
      if (dirty) changed(false);
    },

    prepOn: function (id) { return db.prep[id] > 0; },
    setPrep: function (id, on) {
      db.prep[id] = on ? now() : -now();
      changed(false);
    },

    letterId: function (l) { return hashId(l.from + "|" + l.to + "|" + l.date + "|" + l.msg); },
    letters: function () {
      return Object.keys(db.letters)
        .map(function (id) { var l = db.letters[id]; return { id: id, from: l.from, to: l.to, msg: l.msg, date: l.date, t: l.t, del: l.del }; })
        .filter(function (l) { return !l.del && l.msg; })
        .sort(function (x, y) { return x.t - y.t; });
    },
    addLetter: function (l) {
      var id = api.letterId(l);
      if (db.letters[id]) return id;
      db.letters[id] = { from: l.from, to: l.to, msg: l.msg, date: l.date || null, t: now() };
      changed(false);
      return id;
    },
    removeLetter: function (id) {
      if (!db.letters[id]) return;
      db.letters[id] = { del: true, t: now() };
      changed(false);
    },

    summary: function () {
      return {
        yes: api.yesCount(),
        letters: api.letters().length,
        prep: Object.keys(db.prep).filter(function (k) { return db.prep[k] > 0; }).length,
        plan: Object.keys(db.plan.done).reduce(function (n, pid) {
          var m = db.plan.done[pid];
          return n + Object.keys(m).filter(function (k) { return m[k] > 0; }).length;
        }, 0)
      };
    },

    /* ---------- Backup ---------- */

    backupText: function () {
      return JSON.stringify({ format: FORMAT + "-backup", v: 1, saved: new Date().toISOString(), data: db }, null, 1);
    },
    downloadBackup: function () {
      var blob = new Blob([api.backupText()], { type: "application/json" });
      var a = document.createElement("a");
      var d = new Date();
      a.href = URL.createObjectURL(blob);
      a.download = "jemimah-joel-backup-" + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    },
    restoreBackup: function (text) {
      var file = JSON.parse(text);
      if (!file || file.format !== FORMAT + "-backup" || !file.data) throw new Error("This isn’t one of our backup files.");
      db = merge(db, file.data);
      changed(true); // redraw everything from the restored data...
      scheduleSync(500); // ...and share it with the other phone
    },
    wipe: function () {
      db = emptyDb();
      ["jj-said-yes", "jj-plan", "jj-prep", "jj-letters"].forEach(remove);
      write(DB_KEY, db);
    }
  };

  /* ---------- Encryption: a key made from our secret word ---------- */

  var enc = new TextEncoder();
  var dec = new TextDecoder();

  function toB64(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function fromB64(s) {
    var bin = atob(s.replace(/\s/g, ""));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  var keyCache = {};
  function deriveKey(secret, salt) {
    var id = secret + "|" + toB64(salt);
    if (keyCache[id]) return keyCache[id];
    keyCache[id] = crypto.subtle.importKey("raw", enc.encode(secret.normalize("NFC")), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: 150000, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      });
    return keyCache[id];
  }

  function encrypt(data, secret, salt) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(secret, salt).then(function (key) {
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(JSON.stringify(data)));
    }).then(function (ct) {
      return { format: FORMAT, v: 1, salt: toB64(salt), iv: toB64(iv), data: toB64(new Uint8Array(ct)) };
    });
  }

  function decrypt(file, secret) {
    if (!file || file.format !== FORMAT) return Promise.reject(new Error("The synced file isn’t in our format."));
    var salt = fromB64(file.salt);
    return deriveKey(secret, salt).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(file.iv) }, key, fromB64(file.data));
    }).then(function (pt) {
      return { db: JSON.parse(dec.decode(pt)), salt: salt };
    }, function () {
      throw new Error("Our secret word doesn’t match the one used on the other phone.");
    });
  }

  /* ---------- Sync through GitHub ---------- */

  var cfg = read(SYNC_KEY) || {};
  var state = { busy: false, again: false, timer: null, status: cfg.token ? "idle" : "off", message: "", salt: null };

  function saveCfg() { write(SYNC_KEY, cfg); }
  function setStatus(status, message) {
    state.status = status;
    state.message = message || "";
    statusListeners.forEach(function (fn) { try { fn(); } catch (e) { /* keep going */ } });
  }
  var statusListeners = [];

  function gh(path, opts) {
    opts = opts || {};
    var headers = { "Accept": "application/vnd.github+json", "Authorization": "Bearer " + cfg.token };
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch(API + path, {
      method: opts.method || "GET",
      cache: "no-store",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  }

  function repoPath(rest) { return "/repos/" + REPO.owner + "/" + REPO.repo + rest; }

  function explain(res) {
    if (res.status === 401) return "GitHub didn’t accept our key. It may have expired. Please add a new one.";
    if (res.status === 403) return "Our GitHub key can’t write to the repository. It needs Contents: Read and write.";
    if (res.status === 404) return "GitHub can’t find the repository with this key. Check that the key includes the “commitment” repository.";
    return "GitHub answered with an error (" + res.status + "). Please try again.";
  }

  function utf8ToB64(text) { return toB64(enc.encode(text)); }
  function b64ToUtf8(b64) { return dec.decode(fromB64(b64)); }

  function ensureBranch() {
    return gh(repoPath("/branches/" + REPO.branch)).then(function (res) {
      if (res.ok) return;
      if (res.status !== 404) throw new Error(explain(res));
      return gh(repoPath("")).then(function (r) {
        if (!r.ok) throw new Error(explain(r));
        return r.json();
      }).then(function (info) {
        return gh(repoPath("/git/ref/heads/" + encodeURIComponent(info.default_branch)));
      }).then(function (r) {
        if (!r.ok) throw new Error(explain(r));
        return r.json();
      }).then(function (ref) {
        return gh(repoPath("/git/refs"), { method: "POST", body: { ref: "refs/heads/" + REPO.branch, sha: ref.object.sha } });
      }).then(function (r) {
        if (!r.ok && r.status !== 422) throw new Error(explain(r));
      });
    });
  }

  function pull() {
    return gh(repoPath("/contents/" + REPO.path + "?ref=" + REPO.branch)).then(function (res) {
      if (res.status === 404) return ensureBranch().then(function () { return { db: null, sha: null }; });
      if (!res.ok) throw new Error(explain(res));
      return res.json().then(function (j) {
        var file = JSON.parse(b64ToUtf8(j.content || ""));
        return decrypt(file, cfg.secret).then(function (out) {
          state.salt = out.salt;
          return { db: out.db, sha: j.sha };
        });
      });
    });
  }

  function push(data, sha) {
    var salt = state.salt || crypto.getRandomValues(new Uint8Array(16));
    state.salt = salt;
    var who = read("jj-me");
    return encrypt(data, cfg.secret, salt).then(function (file) {
      var body = {
        message: "Sync our data" + (who === "Joel" || who === "Jemimah" ? " from " + who + "’s phone" : "") + " ♥",
        content: utf8ToB64(JSON.stringify(file)),
        branch: REPO.branch
      };
      if (sha) body.sha = sha;
      return gh(repoPath("/contents/" + REPO.path), { method: "PUT", body: body });
    }).then(function (res) {
      if (res.ok) return true;
      if (res.status === 409 || res.status === 422) return false; // the other phone saved first: pull and try again
      throw new Error(explain(res));
    });
  }

  function syncNow() {
    if (!cfg.token || !cfg.secret) { setStatus("off"); return Promise.resolve(false); }
    if (state.busy) { state.again = true; return Promise.resolve(false); }
    state.busy = true;
    clearTimeout(state.timer);
    setStatus("syncing");

    var attempt = 0;
    function round() {
      attempt++;
      return pull().then(function (remote) {
        var before = canonical(db);
        var merged = remote.db ? merge(db, remote.db) : db;
        if (canonical(merged) !== before) {
          db = merged;
          changed(true);
        }
        if (remote.db && canonical(normalise(remote.db)) === canonical(db)) return true;
        return push(db, remote.sha).then(function (ok) {
          if (ok || attempt >= 4) return ok;
          return round();
        });
      });
    }

    return round().then(function (ok) {
      cfg.last = new Date().toISOString();
      saveCfg();
      setStatus(ok ? "ok" : "error", ok ? "" : "The other phone kept saving at the same moment. Please tap Sync now.");
      return ok;
    }, function (err) {
      setStatus("error", err && err.message ? err.message : "Couldn’t reach GitHub. We’ll try again soon.");
      return false;
    }).then(function (ok) {
      state.busy = false;
      if (state.again) { state.again = false; scheduleSync(1500); }
      return ok;
    });
  }

  function scheduleSync(delay) {
    if (!cfg.token || !cfg.secret || cfg.auto === false) return;
    clearTimeout(state.timer);
    state.timer = setTimeout(syncNow, delay || 4000);
  }

  api.sync = {
    configured: function () { return !!(cfg.token && cfg.secret); },
    auto: function () { return cfg.auto !== false; },
    setAuto: function (on) { cfg.auto = !!on; saveCfg(); if (on) scheduleSync(500); },
    last: function () { return cfg.last || null; },
    status: function () { return state.status; },
    message: function () { return state.message; },
    onStatus: function (fn) { statusListeners.push(fn); },
    connect: function (token, secret) {
      cfg = { token: token.trim(), secret: secret, auto: true };
      state.salt = null;
      saveCfg();
      return syncNow().then(function (ok) {
        if (!ok && state.status === "error") { // keep nothing that didn't work
          var msg = state.message;
          cfg = {};
          remove(SYNC_KEY);
          setStatus("off", msg);
        }
        return ok;
      });
    },
    disconnect: function () {
      cfg = {};
      state.salt = null;
      remove(SYNC_KEY);
      setStatus("off");
    },
    now: syncNow,
    deleteRemote: function () {
      if (!cfg.token) return Promise.resolve();
      return gh(repoPath("/contents/" + REPO.path + "?ref=" + REPO.branch)).then(function (res) {
        if (res.status === 404) return;
        if (!res.ok) throw new Error(explain(res));
        return res.json().then(function (j) {
          return gh(repoPath("/contents/" + REPO.path), { method: "DELETE", body: { message: "Delete our synced data", sha: j.sha, branch: REPO.branch } });
        }).then(function (r) { if (!r.ok) throw new Error(explain(r)); });
      });
    }
  };

  // Stay in step: on opening, on coming back to the page, and when the connection returns.
  if (api.sync.configured() && api.sync.auto()) setTimeout(syncNow, 1200);
  var lastWake = 0;
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && api.sync.configured() && api.sync.auto() && now() - lastWake > 30000) {
      lastWake = now();
      syncNow();
    }
  });
  window.addEventListener("online", function () { scheduleSync(1000); });

  // Exposed for tests of the merge rules.
  api._merge = merge;
  api._canonical = canonical;
  return api;
})();
