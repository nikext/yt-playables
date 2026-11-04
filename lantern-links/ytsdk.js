/*
 * ytsdk.js: a small wrapper around the YouTube Playables SDK (window.ytgame).
 *
 * Canonical copy: /shared/ytsdk.js. Every game directory ships its own copy,
 * so each game is a self-contained bundle. Keep the copies identical.
 *
 * Load order in index.html:
 *   <script src="https://www.youtube.com/game_api/v1"></script>   (first!)
 *   <script src="ytsdk.js"></script>
 *   <script src="game.js"></script>
 *
 * Outside YouTube (local dev, itch, etc.) the SDK is missing or reports
 * IN_PLAYABLES_ENV=false. The wrapper then falls back to localStorage and
 * document visibility for pause/resume.
 */
(function () {
  'use strict';

  var yt = window.ytgame || null;
  var inEnv = !!(yt && yt.IN_PLAYABLES_ENV);

  var storageKey = 'playable_save';
  var firstFrameDone = false;
  var gameReadyDone = false;
  var pauseCbs = [];
  var resumeCbs = [];
  var audioCbs = [];
  var paused = false;
  var audioEnabled = true;

  function safe(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  function firePause() {
    if (paused) return;
    paused = true;
    pauseCbs.forEach(function (cb) { safe(cb); });
  }
  function fireResume() {
    if (!paused) return;
    paused = false;
    resumeCbs.forEach(function (cb) { safe(cb); });
  }
  function fireAudio(enabled) {
    audioEnabled = !!enabled;
    audioCbs.forEach(function (cb) { safe(function () { cb(audioEnabled); }); });
  }

  // Wire SDK system events once.
  if (yt && yt.system) {
    safe(function () { audioEnabled = !!yt.system.isAudioEnabled(); });
    safe(function () { yt.system.onAudioEnabledChange(fireAudio); });
    safe(function () { yt.system.onPause(firePause); });
    safe(function () { yt.system.onResume(fireResume); });
  }
  if (!inEnv) {
    // Outside YouTube, pause when the tab is hidden.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) firePause(); else fireResume();
    });
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
      Promise.resolve(promise).then(
        function (v) { clearTimeout(t); resolve(v); },
        function (e) { clearTimeout(t); reject(e); }
      );
    });
  }

  function isWellFormed(str) {
    if (typeof str.isWellFormed === 'function') return str.isWellFormed();
    // Fallback: detect lone surrogates.
    return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(str);
  }

  var MAX_SAVE_CHARS = 1024 * 1024; // keep far below the 3 MiB hard limit

  var PlayablesSDK = {
    /** true when running inside YouTube Playables */
    inPlayables: inEnv,

    /** Call once at start-up. opts.storageKey = localStorage key for the fallback. */
    init: function (opts) {
      if (opts && opts.storageKey) storageKey = String(opts.storageKey);
    },

    /** Call as soon as the first frame (loading/title screen) has been drawn. */
    firstFrameReady: function () {
      if (firstFrameDone) return;
      firstFrameDone = true;
      if (yt && yt.game) safe(function () { yt.game.firstFrameReady(); });
    },

    /** Call once the game is interactable (no loading screen visible). */
    gameReady: function () {
      if (gameReadyDone) return;
      if (!firstFrameDone) this.firstFrameReady(); // ordering guarantee
      gameReadyDone = true;
      if (yt && yt.game) safe(function () { yt.game.gameReady(); });
    },

    isAudioEnabled: function () { return audioEnabled; },
    onAudioChange: function (cb) { audioCbs.push(cb); },
    onPause: function (cb) { pauseCbs.push(cb); },
    onResume: function (cb) { resumeCbs.push(cb); },
    isPaused: function () { return paused; },

    /** Resolves to the parsed save object, or null when there is none or it is invalid. Never rejects. */
    load: function () {
      var readLocal = function () {
        return safe(function () { return window.localStorage.getItem(storageKey); }, null);
      };
      var p;
      if (inEnv && yt.game && yt.game.loadData) {
        p = withTimeout(yt.game.loadData(), 1000).catch(function () { return null; });
      } else {
        p = Promise.resolve(readLocal());
      }
      return p.then(function (str) {
        if (!str || typeof str !== 'string') return null;
        return safe(function () {
          var obj = JSON.parse(str);
          return obj && typeof obj === 'object' ? obj : null;
        }, null);
      });
    },

    /** Saves a JSON-serialisable object. Resolves true on success. Never rejects. */
    save: function (obj) {
      var str = safe(function () { return JSON.stringify(obj); }, null);
      if (!str || !isWellFormed(str) || str.length > MAX_SAVE_CHARS) return Promise.resolve(false);
      if (inEnv && yt.game && yt.game.saveData) {
        return withTimeout(yt.game.saveData(str), 3000)
          .then(function () { return true; }, function () { return false; });
      }
      return Promise.resolve(safe(function () {
        window.localStorage.setItem(storageKey, str);
        return true;
      }, false));
    },

    /** Reports a (best) score to YouTube. Integer, >= 0. */
    sendScore: function (value) {
      var v = Math.max(0, Math.floor(Number(value) || 0));
      if (v > Number.MAX_SAFE_INTEGER) v = Number.MAX_SAFE_INTEGER;
      if (yt && yt.engagement && yt.engagement.sendScore) {
        safe(function () {
          var r = yt.engagement.sendScore({ value: v });
          if (r && r.catch) r.catch(function () {});
        });
      }
    },

    /** Resolves to a BCP-47 tag such as "en" or "de-DE". Defaults to navigator.language. */
    getLanguage: function () {
      var fallback = (navigator.language || 'en');
      if (yt && yt.system && yt.system.getLanguage) {
        return withTimeout(Promise.resolve(safe(function () { return yt.system.getLanguage(); }, fallback)), 1000)
          .then(function (l) { return l || fallback; }, function () { return fallback; });
      }
      return Promise.resolve(fallback);
    },

    logError: function () {
      if (yt && yt.health && yt.health.logError) safe(function () { yt.health.logError(); });
    }
  };

  window.PlayablesSDK = PlayablesSDK;
})();
