/*
 * mock-ytgame.js: a fake YouTube Playables SDK, for local testing only.
 * Never shipped in a game bundle.
 *
 * Playwright usage: intercept the SDK URL and serve this file instead:
 *   await page.route('https://www.youtube.com/game_api/v1', r =>
 *     r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync('tools/mock-ytgame.js','utf8') }));
 *
 * Afterwards, inspect window.__ytCalls (an ordered list of call names) and drive
 * events with window.__yt.pause() / resume() / setAudio(bool).
 */
(function () {
  var calls = [];
  var store = null;
  var cbs = { pause: [], resume: [], audio: [] };
  var audio = true;
  function log(name, arg) { calls.push(arg === undefined ? name : name + ':' + JSON.stringify(arg)); }
  function sub(list, cb) { list.push(cb); return function () { var i = list.indexOf(cb); if (i >= 0) list.splice(i, 1); }; }

  window.__ytCalls = calls;
  window.__yt = {
    pause: function () { cbs.pause.forEach(function (c) { c(); }); },
    resume: function () { cbs.resume.forEach(function (c) { c(); }); },
    setAudio: function (v) { audio = v; cbs.audio.forEach(function (c) { c(v); }); },
    getStore: function () { return store; }
  };
  window.ytgame = {
    SDK_VERSION: 'mock',
    IN_PLAYABLES_ENV: true,
    game: {
      firstFrameReady: function () { log('firstFrameReady'); },
      gameReady: function () { log('gameReady'); },
      loadData: function () { log('loadData'); return Promise.resolve(store || ''); },
      saveData: function (s) { log('saveData'); store = s; return Promise.resolve(); }
    },
    system: {
      isAudioEnabled: function () { return audio; },
      onAudioEnabledChange: function (cb) { return sub(cbs.audio, cb); },
      onPause: function (cb) { return sub(cbs.pause, cb); },
      onResume: function (cb) { return sub(cbs.resume, cb); },
      getLanguage: function () { return Promise.resolve('en'); }
    },
    engagement: {
      sendScore: function (s) { log('sendScore', s.value); return Promise.resolve(); }
    },
    health: { logError: function () { log('logError'); }, logWarning: function () { log('logWarning'); } }
  };
})();
