const icefileService = require('../services/icefileService');
const cache = require('../services/cacheService');
const { decrypt } = require('../utils/encrypt');

const CACHE_KEY_PREFIX = 'icefile_play_';

const escapeHtml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// aman untuk ditaruh di dalam <script>
const safeJson = (obj) =>
  JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

const buildPlayerHtml = (data, baseUrl) => {
  const sources = [...(data.hls || [])]
    .sort((a, b) => (b.height || 0) - (a.height || 0))
    .map((item) => ({
      src: item.url,
      label: item.label || `${item.height}p`,
      height: item.height,
    }));

  const title = escapeHtml(data.title || 'Video');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title></title>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js"></script>
<style>
  :root { --accent: #ff0046; --text: #fff; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { width: 100%; height: 100%; background: #000; overflow: hidden;
    font-family: Arial, Helvetica, sans-serif; }
  #player { position: relative; width: 100%; height: 100vh; background: #000; user-select: none; overflow: hidden; }
  video { width: 100%; height: 100%; object-fit: contain; display: block; background: #000; }
  #player.idle.playing { cursor: none; }

  /* big play */
  .big-play { position: absolute; top: 50%; left: 50%; width: 80px; height: 80px; margin: -40px 0 0 -40px;
    border-radius: 50%; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: transform .15s, background .15s; z-index: 3; }
  .big-play:hover { transform: scale(1.1); background: rgba(0,0,0,.75); }
  .big-play svg { width: 36px; height: 36px; fill: #fff; margin-left: 4px; }
  #player.playing .big-play, #player.loading .big-play { display: none; }

  /* spinner */
  .spinner { position: absolute; top: 50%; left: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px;
    border: 4px solid rgba(255,255,255,.25); border-top-color: #fff; border-radius: 50%;
    animation: spin .8s linear infinite; display: none; z-index: 3; pointer-events: none; }
  #player.loading .spinner { display: block; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* controls */
  .controls { position: absolute; left: 0; right: 0; bottom: 0; padding: 40px 12px 6px;
    background: linear-gradient(transparent, rgba(0,0,0,.85)); z-index: 4; transition: opacity .25s; }
  #player.idle.playing .controls { opacity: 0; pointer-events: none; }

  .progress { position: relative; height: 16px; display: flex; align-items: center; cursor: pointer; margin: 0 6px; }
  .rail { position: relative; width: 100%; height: 4px; background: rgba(255,255,255,.3); border-radius: 2px;
    transition: height .1s; }
  .progress:hover .rail { height: 6px; }
  .buffer, .played { position: absolute; left: 0; top: 0; height: 100%; border-radius: 2px; }
  .buffer { background: rgba(255,255,255,.35); width: 0; }
  .played { background: var(--accent); width: 0; }
  .knob { position: absolute; top: 50%; width: 13px; height: 13px; margin: -6.5px 0 0 -6.5px; border-radius: 50%;
    background: var(--accent); left: 0; transform: scale(0); transition: transform .1s; }
  .progress:hover .knob, .progress.drag .knob { transform: scale(1); }
  .tip { position: absolute; bottom: 22px; padding: 4px 8px; background: rgba(0,0,0,.85); color: #fff;
    font-size: 12px; border-radius: 3px; transform: translateX(-50%); display: none; pointer-events: none; }
  .progress:hover .tip { display: block; }

  .row { display: flex; align-items: center; height: 40px; }
  .btn { background: none; border: 0; width: 38px; height: 38px; display: flex; align-items: center;
    justify-content: center; cursor: pointer; color: #fff; opacity: .85; flex-shrink: 0; }
  .btn:hover { opacity: 1; }
  .btn svg { width: 22px; height: 22px; fill: #fff; }
  .time { color: #fff; font-size: 13px; margin: 0 8px; white-space: nowrap; }
  .spacer { flex: 1; }

  .vol { display: flex; align-items: center; }
  .vol input { width: 0; opacity: 0; transition: width .2s, opacity .2s; accent-color: var(--accent); height: 4px; cursor: pointer; }
  .vol:hover input, .vol input:focus { width: 70px; opacity: 1; margin-right: 8px; }

  .qbtn { width: auto; padding: 0 10px; font-size: 13px; font-weight: bold; gap: 4px; }
  .qbtn .q-label { color: #fff; }

  /* quality menu */
  .menu { position: absolute; right: 56px; bottom: 58px; min-width: 150px; background: rgba(20,20,20,.95);
    border-radius: 4px; padding: 6px 0; display: none; z-index: 6; box-shadow: 0 4px 16px rgba(0,0,0,.6); }
  .menu.open { display: block; }
  .menu h4 { color: #aaa; font-size: 11px; font-weight: normal; letter-spacing: .5px; text-transform: uppercase;
    padding: 6px 16px 8px; border-bottom: 1px solid rgba(255,255,255,.1); margin-bottom: 4px; }
  .menu .item { color: #fff; font-size: 14px; padding: 9px 16px 9px 34px; cursor: pointer; position: relative; }
  .menu .item:hover { background: rgba(255,255,255,.12); }
  .menu .item.sel::before { content: ""; position: absolute; left: 14px; top: 50%; width: 6px; height: 11px;
    border: solid var(--accent); border-width: 0 2px 2px 0; transform: translateY(-65%) rotate(45deg); }

  .toast { position: absolute; top: 18%; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,.7);
    color: #fff; padding: 8px 16px; border-radius: 4px; font-size: 14px; opacity: 0; transition: opacity .2s;
    z-index: 5; pointer-events: none; }
  .toast.show { opacity: 1; }
  .error { position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
    color: #fff; font-size: 15px; background: rgba(0,0,0,.85); z-index: 7; text-align: center; padding: 20px; }
  #player.err .error { display: flex; }

  @media (max-width: 520px) { .vol, .pip { display: none; } .time { margin: 0 4px; font-size: 12px; } }
</style>
</head>
<body>
<div id="player" class="paused">
  <video id="v" playsinline preload="auto"></video>
  <div class="spinner"></div>
  <div class="big-play" id="bigPlay"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
  <div class="toast" id="toast"></div>
  <div class="error" id="error">Video tidak dapat diputar.</div>

  <div class="menu" id="menu"></div>

  <div class="controls" id="controls">
    <div class="progress" id="progress">
      <div class="rail">
        <div class="buffer" id="buffer"></div>
        <div class="played" id="played"></div>
        <div class="knob" id="knob"></div>
      </div>
      <div class="tip" id="tip">0:00</div>
    </div>
    <div class="row">
      <button class="btn" id="playBtn" title="Play/Pause"></button>
      <button class="btn" id="rewBtn" title="Mundur 10 detik">
        <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8zm-1.1 11h-.9v-4.4l-1 .3v-.7l1.8-.6h.1V16zm4.2-2.2c0 .5-.1.9-.2 1.2-.1.3-.3.5-.5.7-.2.2-.4.3-.7.3-.3 0-.5-.1-.7-.3-.2-.2-.4-.4-.5-.7-.1-.3-.2-.7-.2-1.2v-.6c0-.5.1-.9.2-1.2.1-.3.3-.5.5-.7.2-.2.4-.3.7-.3.3 0 .5.1.7.3.2.2.4.4.5.7.1.3.2.7.2 1.2v.6zm-.9-.7c0-.3 0-.6-.1-.8-.1-.2-.1-.4-.2-.5-.1-.1-.2-.1-.4-.1s-.3 0-.4.1c-.1.1-.2.3-.2.5-.1.2-.1.5-.1.8v.8c0 .3 0 .6.1.8.1.2.1.4.2.5.1.1.2.1.4.1s.3 0 .4-.1c.1-.1.2-.3.2-.5.1-.2.1-.5.1-.8v-.8z"/></svg>
      </button>
      <div class="vol">
        <button class="btn" id="muteBtn" title="Mute"></button>
        <input type="range" id="vol" min="0" max="1" step="0.05" value="1">
      </div>
      <span class="time"><span id="cur">0:00</span> / <span id="dur">0:00</span></span>
      <div class="spacer"></div>
      <button class="btn qbtn" id="qBtn" title="Kualitas">
        <svg viewBox="0 0 24 24"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6a7.3 7.3 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.2.4.5.4h4c.3 0 .5-.2.5-.4l.4-2.6c.6-.3 1.200-.6 1.700-1l2.500 1c.2.1.5 0 .6-.2l2-3.500a.5.5 0 0 0-.1-.6L19.400 13zM12 15.500a3.500 3.500 0 1 1 0-7 3.500 3.500 0 0 1 0 7z"/></svg>
        <span class="q-label" id="qLabel"></span>
      </button>
      <button class="btn pip" id="pipBtn" title="Picture in Picture">
        <svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H3V5h18v14z"/></svg>
      </button>
      <button class="btn" id="fsBtn" title="Layar penuh"></button>
    </div>
  </div>
</div>

<script>
(function () {
  var SOURCES = ${safeJson(sources)};
  var \$ = function (id) { return document.getElementById(id); };
  var player = $('player'), v = $('v');
  var hls = null, cur = 0, idleTimer = null, dragging = false;

  var ICON = {
    play:  '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    vol:   '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.400v2.100a9 9 0 0 0 0-17.600z"/></svg>',
    mute:  '<svg viewBox="0 0 24 24"><path d="M16.500 12A4.500 4.500 0 0 0 14 8v2.200l2.400 2.400c.1-.2.1-.4.1-.6zm2.500 0c0 .9-.2 1.800-.5 2.600l1.500 1.500A9 9 0 0 0 21 12a9 9 0 0 0-7-8.800v2.100c2.900.9 5 3.500 5 6.700zM4.300 3L3 4.300 7.700 9H3v6h4l5 5v-6.700l4.300 4.300c-.7.500-1.400.9-2.300 1.200v2.100a9 9 0 0 0 3.700-1.800l2 2 1.300-1.300L4.300 3zM12 4L9.900 6.100 12 8.200V4z"/></svg>',
    fs:    '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
    fsx:   '<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>'
  };

  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 1200);
  }

  function load(i, keepTime) {
    if (!SOURCES.length) { player.classList.add('err'); return; }
    var t = keepTime ? v.currentTime : 0;
    var autoplay = false;
    cur = i;
    player.classList.remove('err');
    player.classList.add('loading');
    if (hls) { hls.destroy(); hls = null; }

    var url = SOURCES[i].src;
    function resume() {
      if (t > 0) v.currentTime = t;
      if (autoplay) v.play().catch(function () {});
    }
    if (window.Hls && Hls.isSupported()) {
      hls = new Hls({ startPosition: t > 0 ? t : -1, maxBufferLength: 30 });
      hls.loadSource(url);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        player.classList.remove('loading');
        if (autoplay) v.play().catch(function () {});
      });
      hls.on(Hls.Events.ERROR, function (e, d) {
        player.classList.remove('loading');
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else { player.classList.add('err'); }
      });
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = url;
      v.addEventListener('loadedmetadata', function f() {
        v.removeEventListener('loadedmetadata', f);
        player.classList.remove('loading');
        resume();
      }, { once: true });
    } else {
      player.classList.remove('loading');
      player.classList.add('err');
    }
    $('qLabel').textContent = SOURCES[i].label;
    renderMenu();
  }

  function renderMenu() {
    var m = $('menu');
    m.innerHTML = '<h4>Kualitas</h4>';
    SOURCES.forEach(function (s, i) {
      var d = document.createElement('div');
      d.className = 'item' + (i === cur ? ' sel' : '');
      d.textContent = s.label;
      d.onclick = function (e) {
        e.stopPropagation();
        m.classList.remove('open');
        if (i !== cur) { load(i, true); toast('Kualitas: ' + s.label); }
      };
      m.appendChild(d);
    });
  }

  function toggle() { v.paused ? v.play().catch(function () {}) : v.pause(); }
  function seek(d) { v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d)); }
  function setVol(x) { v.volume = x; v.muted = x === 0; }
  function isFs() { return document.fullscreenElement || document.webkitFullscreenElement; }
  function toggleFs() {
    if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (player.requestFullscreen || player.webkitRequestFullscreen || v.webkitEnterFullscreen).call(player.requestFullscreen ? player : (player.webkitRequestFullscreen ? player : v));
  }

  $('playBtn').onclick = toggle;
  $('bigPlay').onclick = toggle;
  $('rewBtn').onclick = function () { seek(-10); };
  $('fsBtn').onclick = toggleFs;
  $('muteBtn').onclick = function () { v.muted = !v.muted; };
  $('vol').oninput = function (e) { setVol(parseFloat(e.target.value)); };
  $('qBtn').onclick = function (e) { e.stopPropagation(); $('menu').classList.toggle('open'); };
  $('pipBtn').onclick = function () {
    if (document.pictureInPictureElement) document.exitPictureInPicture();
    else if (document.pictureInPictureEnabled) v.requestPictureInPicture().catch(function () {});
  };
  if (!document.pictureInPictureEnabled) $('pipBtn').style.display = 'none';

  var clickT = null;
  v.addEventListener('click', function () {
    $('menu').classList.remove('open');
    if (clickT) { clearTimeout(clickT); clickT = null; toggleFs(); return; }
    clickT = setTimeout(function () { clickT = null; toggle(); }, 220);
  });
  document.addEventListener('click', function (e) {
    if (!$('menu').contains(e.target) && e.target !== $('qBtn')) $('menu').classList.remove('open');
  });

  var prog = $('progress');
  function ratio(e) {
    var r = prog.getBoundingClientRect(), x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    return Math.max(0, Math.min(1, x / r.width));
  }
  prog.addEventListener('mousemove', function (e) {
    var r = ratio(e), tip = $('tip');
    tip.textContent = fmt(r * (v.duration || 0));
    tip.style.left = (r * 100) + '%';
  });
  function startDrag(e) { dragging = true; prog.classList.add('drag'); doDrag(e); }
  function doDrag(e) {
    if (!dragging) return;
    var r = ratio(e);
    $('played').style.width = (r * 100) + '%';
    $('knob').style.left = (r * 100) + '%';
    if (v.duration) v.currentTime = r * v.duration;
  }
  function endDrag() { dragging = false; prog.classList.remove('drag'); }
  prog.addEventListener('mousedown', startDrag);
  prog.addEventListener('touchstart', startDrag, { passive: true });
  window.addEventListener('mousemove', doDrag);
  window.addEventListener('touchmove', doDrag, { passive: true });
  window.addEventListener('mouseup', endDrag);
  window.addEventListener('touchend', endDrag);

  function updateProgress() {
    if (dragging) return;
    var d = v.duration || 0, p = d ? v.currentTime / d * 100 : 0;
    $('played').style.width = p + '%';
    $('knob').style.left = p + '%';
    $('cur').textContent = fmt(v.currentTime);
    if (v.buffered.length && d) {
      var end = 0;
      for (var i = 0; i < v.buffered.length; i++) {
        if (v.buffered.start(i) <= v.currentTime && v.buffered.end(i) >= v.currentTime) end = v.buffered.end(i);
      }
      $('buffer').style.width = (end / d * 100) + '%';
    }
  }
  v.addEventListener('timeupdate', updateProgress);
  v.addEventListener('progress', updateProgress);
  v.addEventListener('durationchange', function () { $('dur').textContent = fmt(v.duration); });
  v.addEventListener('play', function () { player.classList.add('playing'); player.classList.remove('paused'); $('playBtn').innerHTML = ICON.pause; });
  v.addEventListener('pause', function () { player.classList.remove('playing'); player.classList.add('paused'); $('playBtn').innerHTML = ICON.play; });
  v.addEventListener('ended', function () { player.classList.remove('playing'); player.classList.remove('idle'); $('playBtn').innerHTML = ICON.play; });
  v.addEventListener('waiting', function () { player.classList.add('loading'); });
  ['playing', 'canplay', 'seeked'].forEach(function (ev) {
    v.addEventListener(ev, function () { player.classList.remove('loading'); });
  });
  v.addEventListener('volumechange', function () {
    $('muteBtn').innerHTML = (v.muted || v.volume === 0) ? ICON.mute : ICON.vol;
    $('vol').value = v.muted ? 0 : v.volume;
  });
  document.addEventListener('fullscreenchange', function () { $('fsBtn').innerHTML = isFs() ? ICON.fsx : ICON.fs; });
  document.addEventListener('webkitfullscreenchange', function () { $('fsBtn').innerHTML = isFs() ? ICON.fsx : ICON.fs; });

  function wake() {
    player.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { player.classList.add('idle'); }, 2800);
  }
  ['mousemove', 'touchstart', 'keydown'].forEach(function (ev) { player.addEventListener(ev, wake, { passive: true }); });
  player.addEventListener('mouseleave', function () { if (!v.paused) player.classList.add('idle'); });

  document.addEventListener('keydown', function (e) {
    switch (e.key) {
      case ' ': case 'k': e.preventDefault(); toggle(); break;
      case 'ArrowLeft': seek(-10); toast('-10 detik'); break;
      case 'ArrowRight': seek(10); toast('+10 detik'); break;
      case 'ArrowUp': e.preventDefault(); setVol(Math.min(1, v.volume + 0.1)); toast('Volume ' + Math.round(v.volume * 100) + '%'); break;
      case 'ArrowDown': e.preventDefault(); setVol(Math.max(0, v.volume - 0.1)); toast('Volume ' + Math.round(v.volume * 100) + '%'); break;
      case 'm': v.muted = !v.muted; break;
      case 'f': toggleFs(); break;
    }
  });

  $('playBtn').innerHTML = ICON.play;
  $('muteBtn').innerHTML = ICON.vol;
  $('fsBtn').innerHTML = ICON.fs;
  if (SOURCES.length < 2) $('qBtn').style.display = SOURCES.length ? '' : 'none';

  // Default ke kualitas 720p jika tersedia, jika tidak pakai yang paling dekat di bawahnya,
  // jika tidak ada pakai yang paling rendah
  let defaultIndex = 0;
  for (let i = 0; i < SOURCES.length; i++) {
    if (SOURCES[i].height <= 720) {
      defaultIndex = i;
      break;
    }
  }
  load(defaultIndex, false);
  wake();
})();
</script>
</body>
</html>`;
};

const getPlay = async (req, res, next) => {
  try {
    const { driveId: encryptedDriveId } = req.params;

    let driveId;
    try {
      driveId = decrypt(encryptedDriveId);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: 'Link play tidak valid atau expired' },
      });
    }

    const cacheKey = `${CACHE_KEY_PREFIX}${driveId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const normalized = {
        ...cached,
        fromCache: true,
        hls: cached.hls || (cached.encoded?.hls || []).map((item) => ({
          url: item.url,
          width: item.width,
          height: item.height,
          label: `${item.height}p`,
        })),
      };
      return res.status(200)
        .type('html')
        .set('Cache-Control', 'no-cache, no-store, must-revalidate')
        .set('Pragma', 'no-cache')
        .set('Expires', '0')
        .send(buildPlayerHtml(normalized, baseUrl));
    }

    const raw = await icefileService.getMediaByFileId(driveId);

    const hlsList = Array.isArray(raw.encoded?.hls)
      ? raw.encoded.hls.map((item) => ({
          url: item.url,
          width: item.width,
          height: item.height,
          label: `${item.height}p`,
        }))
      : [];

    const responseData = {
      success: true,
      driveId: raw.id,
      title: raw.name,
      duration: raw.duration,
      thumbnail: raw.thumbnail,
      hls: hlsList,
      hlsCount: hlsList.length,
      source: 'icefile.my.id',
      fromCache: false,
      timestamp: new Date().toISOString(),
    };

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    cache.set(cacheKey, responseData);

    return res.status(200)
      .type('html')
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .send(buildPlayerHtml(responseData, baseUrl));
  } catch (error) {
    next(error);
  }
};

module.exports = { getPlay };
