// ================= Shared helpers for the Sleep, Cough, Hearing, Vision and Movement tabs =================
(() => {
  const { prep, tokens, ICONS, niceTicks, dot } = window.FPLUI;
  const $ = (s, root) => (root || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pill = (q, text) => '<span class="pill" data-q="' + q + '">' + ICONS[q] + '<span>' + esc(text) + '</span></span>';
  const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
  const stamp = () => new Date().toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem('phone-vitals-' + k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('phone-vitals-' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };

  // ---------- Sound ----------
  let actx = null;
  function audio() {
    try {
      if (!actx || actx.state === 'closed') actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
    return actx;
  }
  function beep(freqs, dur = 0.16, gain = 0.12) {
    const ctx = audio();
    if (!ctx) return;
    try {
      let t = ctx.currentTime + 0.01;
      for (const f of [].concat(freqs)) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + dur + 0.02);
        t += dur * 0.9;
      }
    } catch (e) { /* sound is optional */ }
  }
  function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {} }

  // ---------- Microphone ----------
  function micError(e) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'Microphone access was blocked. Allow the microphone for this site in the browser settings, then try again.';
    if (n === 'NotFoundError') return 'No microphone was found.';
    if (n === 'NotReadableError') return 'The microphone is busy in another app.';
    return 'The microphone could not start' + (e && e.message ? ' (' + e.message + ')' : '') + '.';
  }
  let workletURL = null;
  // Calls onFrames with interleaved [low band, high band] loudness, 50 frames a second.
  async function openMic(onFrames) {
    const ctx = audio();
    if (!ctx || !ctx.audioWorklet) throw new Error(window.isSecureContext ? 'This browser cannot analyse sound.' : 'The microphone only works when the page is opened from its https:// address.');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser cannot use the microphone.');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    } catch (e) { throw new Error(micError(e)); }
    try {
      if (!ctx.vxBands) {
        if (!workletURL) workletURL = URL.createObjectURL(new Blob([VX.audio.workletSource()], { type: 'application/javascript' }));
        await ctx.audioWorklet.addModule(workletURL);
        ctx.vxBands = true;
      }
      const src = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'vx-bands', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      const mute = ctx.createGain(); mute.gain.value = 0;
      node.port.onmessage = (ev) => onFrames(ev.data);
      src.connect(node); node.connect(mute); mute.connect(ctx.destination);
      return {
        stream, ctx,
        stop() {
          node.port.onmessage = null;
          try { src.disconnect(); node.disconnect(); mute.disconnect(); } catch (e) {}
          stream.getTracks().forEach((t) => t.stop());
        }
      };
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error(micError(e));
    }
  }

  // ---------- Motion sensors ----------
  // onSample(t seconds, gravity-included x y z, gravity-free x y z or NaN, rotation alpha beta gamma or NaN)
  async function openMotion(onSample) {
    if (!('DeviceMotionEvent' in window)) throw new Error('This browser cannot read the motion sensors.');
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      let ok = false;
      try { ok = (await DeviceMotionEvent.requestPermission()) === 'granted'; } catch (e) {}
      if (!ok) throw new Error('Motion sensor access was not allowed. Allow "Motion & Orientation" for this site, then try again.');
    }
    const t0 = performance.now();
    let n = 0;
    const num = (o, k) => (o && o[k] != null ? o[k] : NaN);
    const h = (e) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null) return;
      let now = e.timeStamp;
      if (!(now > 0) || Math.abs(now - performance.now()) > 5000) now = performance.now();
      const a = e.acceleration, r = e.rotationRate;
      n++;
      onSample((now - t0) / 1000, g.x, g.y, g.z, num(a, 'x'), num(a, 'y'), num(a, 'z'), num(r, 'alpha'), num(r, 'beta'), num(r, 'gamma'));
    };
    window.addEventListener('devicemotion', h);
    return { count: () => n, stop() { window.removeEventListener('devicemotion', h); } };
  }

  // ---------- Full-screen view while a test runs ----------
  const liveEl = $('#vxLive');
  let live = null;
  const Live = {
    stage: $('#vxStage'),
    open(o) {
      live = { onStop: o.onStop, onHidden: o.onHidden, wl: null };
      liveEl.toggleAttribute('data-dark', !!o.dark);
      $('#vxChip').textContent = o.chip || '';
      $('#vxTimer').textContent = '';
      $('#vxStatus').textContent = o.status || '';
      $('#vxNote').textContent = '';
      $('#vxBar').style.width = '0%';
      $('#vxBar').parentNode.hidden = !!o.noBar;
      $('#vxStop').textContent = o.stopLabel || 'Stop';
      Live.stage.innerHTML = '';
      liveEl.hidden = false;
      liveEl.scrollTop = 0;
      document.body.style.overflow = 'hidden';
      Live.lock();
    },
    async lock() {
      try { if (navigator.wakeLock && live && !document.hidden) live.wl = await navigator.wakeLock.request('screen'); } catch (e) {}
    },
    close() {
      if (!live) return;
      try { if (live.wl) live.wl.release(); } catch (e) {}
      live = null;
      liveEl.hidden = true;
      liveEl.removeAttribute('data-dark');
      Live.stage.innerHTML = '';
      document.body.style.overflow = '';
    },
    isOpen: () => !!live,
    status(t) { const el = $('#vxStatus'); if (el.textContent !== t) el.textContent = t; },
    timer(t) { $('#vxTimer').textContent = t; },
    note(t) { $('#vxNote').textContent = t; },
    bar(f) { $('#vxBar').style.width = (100 * Math.min(1, Math.max(0, f))).toFixed(1) + '%'; },
    stopLabel(t) { $('#vxStop').textContent = t; }
  };
  $('#vxStop').addEventListener('click', () => { if (live && live.onStop) live.onStop(); });
  document.addEventListener('visibilitychange', () => {
    if (!live) return;
    if (document.hidden) { if (live.onHidden) live.onHidden(); } else Live.lock();
  });

  // Counts down with beeps so the phone can go into a pocket first. Resolves false if the test was stopped meanwhile.
  async function countdown(sec, text, alive) {
    for (let s = sec; s > 0; s--) {
      if (!alive()) return false;
      Live.status(text + ' ' + s);
      Live.timer('Starts in ' + s + ' s');
      if (s <= 3) beep(660, 0.09);
      await sleepMs(1000);
    }
    return alive();
  }

  // ---------- Charts ----------
  // o: { height, x0, x1, y0, y1, flipY, xTicks: [[value, label]], yTicks: [[value, label]], bands: [{x0, x1, color, alpha}],
  //      series: [{x, y, color, width}], marks: [{x, y, color}], empty }
  function chart(el, o) {
    const W = Math.max(240, el.clientWidth), H = o.height || 170;
    const m = { l: o.yTicks ? 46 : 10, r: 12, t: 12, b: 26 };
    const ctx = prep(el.querySelector('canvas'), W, H), T = tokens();
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const xs = (v) => m.l + ((v - o.x0) / ((o.x1 - o.x0) || 1)) * pw;
    const fy = (v) => (Math.min(o.y1, Math.max(o.y0, v)) - o.y0) / ((o.y1 - o.y0) || 1);
    const ys = (v) => (o.flipY ? m.t + fy(v) * ph : m.t + ph - fy(v) * ph);
    const col = (c) => T[c] || c || T.trace;
    ctx.font = T.mono; ctx.lineWidth = 1;
    if (o.empty) {
      ctx.strokeStyle = T.rule; ctx.strokeRect(m.l + 0.5, m.t + 0.5, pw - 1, ph - 1);
      ctx.fillStyle = T.ink3; ctx.font = '14px ' + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.empty, W / 2, m.t + ph / 2);
      return { ctx, T, xs, ys, W, H, m };
    }
    for (const b of o.bands || []) {
      ctx.globalAlpha = b.alpha == null ? 1 : b.alpha;
      ctx.fillStyle = col(b.color || 'shade');
      const a = Math.max(m.l, xs(b.x0)), z = Math.min(m.l + pw, xs(b.x1));
      if (z > a) ctx.fillRect(a, m.t, Math.max(1, z - a), ph);
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    for (const [v, label] of o.yTicks || []) {
      const y = Math.round(ys(v)) + 0.5;
      ctx.strokeStyle = T.rule; ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke();
      ctx.fillStyle = T.ink3; ctx.fillText(label, m.l - 7, y);
    }
    ctx.textBaseline = 'top';
    for (const [v, label] of o.xTicks || []) {
      const x = xs(v);
      ctx.strokeStyle = T.rule; ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, m.t); ctx.lineTo(Math.round(x) + 0.5, m.t + ph); ctx.stroke();
      ctx.fillStyle = T.ink3;
      ctx.textAlign = x < m.l + 16 ? 'left' : (x > W - m.r - 16 ? 'right' : 'center');
      ctx.fillText(label, x, H - m.b + 7);
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const s of o.series || []) {
      ctx.strokeStyle = col(s.color); ctx.lineWidth = s.width || 2;
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < s.y.length; i++) {
        if (!isFinite(s.y[i])) { pen = false; continue; }
        const x = xs(s.x[i]), y = ys(s.y[i]);
        if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
      }
      ctx.stroke();
    }
    for (const k of o.marks || []) dot(ctx, xs(k.x), ys(k.y), col(k.color || 'accent'), T.surface);
    return { ctx, T, xs, ys, W, H, m };
  }
  const ticks = (min, max, count, fmt) => niceTicks(min, max, count).map((v) => [v, fmt ? fmt(v) : String(v)]);

  // ---------- Result card ----------
  // r: { label, value, unit, small, sub, stats: [[label, html]], example, source, warnings: [html], verdict: {q, text}, share: text }
  const shareText = new WeakMap();
  function renderReadout(el, r) {
    shareText.set(el, r.share || '');
    el.innerHTML =
      '<div class="readout-top"><div class="hero"><span class="label">' + esc(r.label) + '</span>' +
      '<span class="hero-val"><span class="hero-num' + (r.small ? ' sm' : '') + '">' + esc(r.value) + '</span><span class="hero-unit">' + esc(r.unit || '') + '</span></span>' +
      '<span class="hero-sub">' + esc(r.sub || '') + '</span></div>' +
      '<dl class="stats">' + (r.stats || []).map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd class="dd-flex">' + v + '</dd></div>').join('') + '</dl></div>' +
      (r.verdict ? '<p class="verdict" data-q="' + r.verdict.q + '">' + esc(r.verdict.text) + '</p>' : '') +
      '<p class="source"><span class="chip" data-kind="' + (r.example ? 'example' : 'live') + '">' + (r.example ? 'Example result' : 'Your result') + '</span><span>' + esc(r.source || '') + '</span></p>' +
      '<ul class="warnings">' + (r.warnings || []).map((w) => '<li>' + ICONS.warn + '<span>' + w + '</span></li>').join('') + '</ul>' +
      (r.example || !r.share ? '' : '<div class="copyrow"><button type="button" class="btn-quiet" data-share>Share result</button><span class="copy-msg"></span></div>');
  }
  async function share(text, msgEl, file) {
    try {
      if (navigator.share) {
        const d = { title: 'Phone Vitals Lab', text };
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) d.files = [file];
        await navigator.share(d);
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); if (msgEl) msgEl.textContent = 'Copied. Paste it into a message.'; }
    catch (e) { if (msgEl) msgEl.textContent = text; }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-share]');
    if (!b) return;
    const card = b.closest('.readout');
    if (card && shareText.get(card)) share(shareText.get(card), b.parentNode.querySelector('.copy-msg'));
  });

  // Runs draw whenever a tab is opened, resized or re-themed.
  function onShow(hash, panel, draw) {
    let raf = 0;
    const go = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (!panel.hidden) draw(); }); };
    document.addEventListener('vx:tab', (e) => { if (e.detail === hash) go(); });
    if ('ResizeObserver' in window) new ResizeObserver(go).observe(panel); else window.addEventListener('resize', go);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', go);
    new MutationObserver(go).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
    go();
    return go;
  }
  const showError = (el, msg) => { el.textContent = msg || ''; el.hidden = !msg; };

  window.VXUI = { $, esc, pill, sleepMs, stamp, store, audio, beep, buzz, openMic, openMotion, Live, countdown, chart, ticks, renderReadout, share, onShow, showError };
})();
