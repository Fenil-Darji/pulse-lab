// ================= Sleep tab =================
(() => {
  const { $, esc, stamp, store, openMic, Live, chart, renderReadout, onShow, showError, beep } = window.VXUI;
  const S = VX.sleep, U = VX.U;
  const panel = $('#panelSleep');
  const st = { r: null, example: true, when: '' };
  const pad2 = (v) => String(v).padStart(2, '0');
  const hm = (sec) => Math.floor(sec / 3600) + ':' + pad2(Math.floor((sec % 3600) / 60));

  function showExample() { st.r = S.analyze(S.makeExample().env); st.example = true; st.when = ''; }
  const saved = store.get('sleep-last', null);
  if (saved && saved.r && saved.r.timeline) { st.r = saved.r; st.example = false; st.when = saved.when || ''; } else showExample();

  const VERDICT = {
    quiet: { q: 'fair', text: 'Too little snoring or breathing sound was heard to judge pauses. This does not mean breathing was normal. Try the phone closer to your head, with fans off.' },
    few: { q: 'good', text: 'Few pauses were heard in the snoring. If you still feel very sleepy in the day, mention it to a doctor.' },
    some: { q: 'fair', text: 'Some pauses were heard: snoring that stopped and restarted with loud breaths. Worth mentioning to a doctor, especially with daytime sleepiness or high blood pressure.' },
    many: { q: 'poor', text: 'Many pauses were heard, each followed by loud breaths. This pattern is common in obstructive sleep apnoea. Please see a doctor; a sleep study confirms it.' }
  };

  function render() {
    const r = st.r;
    const warn = [];
    if (!st.example) {
      if (r.dur < 7200) warn.push('Less than 2 hours was recorded, so the pause rate can swing a lot. A full night gives a fairer picture.');
      if (r.gapSec > 60) warn.push('About ' + U.fmtDur(r.gapSec) + ' was missed, probably while the screen was off or another app was open.');
      if (r.noiseFrac > 0.1) warn.push('There was a lot of other noise (' + Math.round(100 * r.noiseFrac) + '% of the night). Fans, talking and traffic can hide pauses.');
    }
    const v = VERDICT[r.band];
    renderReadout($('#slReadout'), {
      label: 'Breathing pauses per hour',
      value: r.assessable ? r.pph.toFixed(1) : '--',
      unit: r.assessable ? 'per hour' : '',
      sub: st.example ? '' : (st.when ? 'Night of ' + st.when : ''),
      stats: [
        ['Recorded', esc(U.fmtDur(r.dur))],
        ['Snoring or loud breathing', esc(U.fmtDur(r.snoreSec)) + ' <span class="footnote">(' + Math.round(100 * r.snoreFrac) + '%)</span>'],
        ['Pauses heard', String(r.pauses.length)],
        ['Longest pause', r.pauses.length ? Math.round(r.longest) + ' s' : '–'],
        ['Other noise', Math.round(100 * r.noiseFrac) + '% of the time'],
        ['Coughs heard', r.coughs == null ? '–' : String(r.coughs)],
        ['Missed', r.gapSec > 60 ? esc(U.fmtDur(r.gapSec)) : 'Nothing']
      ],
      verdict: { q: v.q, text: v.text + ' This is a screening hint, not a diagnosis.' },
      example: st.example,
      source: st.example ? 'A made-up 6.5-hour night with snoring and pauses, shown until you record your own.' : 'Your overnight recording, kept on this phone only.',
      warnings: warn,
      extra: st.example ? '' : '<p class="source"><button type="button" class="textbtn" id="slExampleBtn">Show the example night</button></p>',
      share: st.example ? '' : [
        'Phone Vitals Lab: overnight snoring check' + (st.when ? ', ' + st.when : ''),
        'Recorded: ' + U.fmtDur(r.dur),
        'Snoring or loud breathing: ' + U.fmtDur(r.snoreSec) + ' (' + Math.round(100 * r.snoreFrac) + '%)',
        'Pauses of 10 s or more: ' + r.pauses.length + (r.assessable ? ' (' + r.pph.toFixed(1) + ' per hour)' : ' (too little sound to judge)'),
        r.pauses.length ? 'Longest pause: ' + Math.round(r.longest) + ' s' : '',
        r.coughs != null ? 'Coughs heard: ' + r.coughs : '',
        sbSummary(),
        'Phone screening only, not a sleep study.'
      ].filter(Boolean).join('\n')
    });
    const b = $('#slExampleBtn');
    if (b) b.addEventListener('click', () => { showExample(); render(); draw(); });
  }

  function timeTicks(dur) {
    const step = [60, 300, 600, 900, 1800, 3600, 7200].find((s) => dur / s <= 8) || 7200;
    const out = [];
    for (let t = 0; t <= dur + 1e-6; t += step) out.push([t, t === 0 ? '0' : (dur >= 3600 ? (step >= 3600 ? t / 3600 + ' h' : hm(t)) : Math.round(t / 60) + ' min')]);
    return out;
  }

  function draw() {
    const r = st.r, tl = r.timeline;
    if (!tl.t.length) { chart($('#slPlot'), { height: 190, x0: 0, x1: 1, y0: 0, y1: 1, empty: 'Recording too short to chart' }); return; }
    const y1 = Math.max(24, Math.ceil(U.pct(tl.y, 0.99) / 10) * 10);
    const yt = [];
    for (let v = 0; v <= y1; v += 10) yt.push([v, v ? v + ' dB' : '0']);
    chart($('#slPlot'), {
      height: 200, x0: 0, x1: r.dur, y0: 0, y1,
      xTicks: timeTicks(r.dur), yTicks: yt,
      bands: r.segs.map((g) => ({ x0: g.t0, x1: g.t1, color: '--warn-bg' })),
      series: [{ x: tl.t, y: tl.y, color: 'trace', width: 1.5 }],
      marks: r.pauses.map((p) => ({ x: (p.t0 + p.t1) / 2, y: y1 * 0.06, color: 'accent' }))
    });
  }

  // ---------- STOP-Bang ----------
  function sbScore() {
    const box = [...panel.querySelectorAll('[data-sb]')];
    const on = (k) => box.filter((b) => b.dataset.sb === k && b.checked).length;
    return { total: box.filter((b) => b.checked).length, stop: on('stop'), body: on('body') };
  }
  function sbBand(s) {
    // Chung et al. 2012: 5 or more, or 2+ of the first four plus male, BMI over 35 or neck over 40 cm, means high risk.
    if (s.total >= 5 || (s.stop >= 2 && s.body >= 1)) return { q: 'poor', name: 'High risk' };
    if (s.total >= 3) return { q: 'fair', name: 'Intermediate risk' };
    return { q: 'good', name: 'Low risk' };
  }
  function sbSummary() {
    const s = sbScore();
    return s.total ? 'STOP-Bang score: ' + s.total + ' of 8 (' + sbBand(s).name.toLowerCase() + ')' : '';
  }
  function sbRender() {
    const s = sbScore(), b = sbBand(s), out = $('#slSbOut');
    out.dataset.q = b.q;
    out.textContent = 'Score ' + s.total + ' of 8: ' + b.name.toLowerCase() + ' of obstructive sleep apnoea. ' +
      (b.q === 'poor' ? 'Please see a doctor about a sleep study.' : b.q === 'fair' ? 'Worth mentioning to a doctor, together with the overnight recording.' : 'Tick every answer that applies.');
    if (!st.example) render();
  }
  panel.querySelectorAll('[data-sb]').forEach((b) => b.addEventListener('change', sbRender));

  // ---------- Overnight recording ----------
  const R = { on: false, mic: null, env: [], acc: 0, accN: 0, skip: 0, frames: 0, tWall: 0, delay: 0, timer: 0, lastAna: 0 };

  function onFrames(d) {
    if (!R.on) return;
    for (let k = 0; k + 1 < d.length; k += 2) {
      R.frames++;
      if (R.skip > 0) { R.skip--; continue; }
      R.cd.push(d[k], d[k + 1]);
      R.acc += d[k] * d[k] + d[k + 1] * d[k + 1];
      if (++R.accN === 5) { R.env.push(Math.sqrt(R.acc / 5)); R.acc = 0; R.accN = 0; }
    }
  }
  const missed = () => Math.max(0, (performance.now() - R.tWall) / 1000 - R.frames / 50);

  function tick() {
    if (!R.on) return;
    Live.timer(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    if (R.skip > 0) {
      const s = Math.ceil(R.skip / 50);
      Live.status('Listening starts in ' + Math.floor(s / 60) + ':' + pad2(s % 60) + '. Go to sleep.');
    } else {
      const n = R.env.length, rec = n / S.FS;
      Live.status('Listening. Sleep well.');
      $('#slLiveTime').textContent = hm(rec);
      if (n > 20) {
        const floor = U.db(U.pct(R.env.slice(Math.max(0, n - 600)), 0.15));
        let now = 0; for (let i = n - 10; i < n; i++) now = Math.max(now, R.env[i]);
        $('#slLiveLvl').style.width = (100 * Math.min(1, Math.max(0, (U.db(now) - floor) / 30))).toFixed(0) + '%';
      }
      const wall = (performance.now() - R.tWall) / 1000;
      if (rec > 120 && wall - R.lastAna > 60) {
        R.lastAna = wall;
        const r = S.analyze(Float32Array.from(R.env));
        $('#slLiveStats').textContent = 'So far: snoring or loud breathing ' + U.fmtDur(r.snoreSec) + ', pauses heard ' + r.pauses.length + ', coughs ' + R.cd.coughs.length + '.';
      }
    }
    const m = missed();
    Live.note('Keep this page open and the phone on charge.' + (m > 60 ? ' About ' + U.fmtDur(m) + ' has been missed so far, probably while the screen was off.' : ''));
  }

  async function start() {
    showError($('#slError'), '');
    if (R.on) return;
    R.delay = +$('#slDelay').value || 0;
    Live.open({ chip: 'Overnight recording', status: 'Starting the microphone…', dark: true, noBar: true, stopLabel: 'End and see results', onStop: finish });
    Live.stage.innerHTML =
      '<div class="live-hero"><span class="hero-val"><span class="hero-num" id="slLiveTime">0:00</span><span class="hero-unit">listened</span></span></div>' +
      '<span class="label">Sound right now, above the room background</span>' +
      '<div class="track" aria-hidden="true"><div class="bar" id="slLiveLvl"></div></div>' +
      '<p class="live-note" id="slLiveStats">The first summary appears after a few minutes of listening.</p>';
    let mic;
    try { mic = await openMic(onFrames); }
    catch (e) { Live.close(); showError($('#slError'), e.message); return; }
    if (!Live.isOpen()) { mic.stop(); return; }
    Object.assign(R, { on: true, mic, cd: new VX.cough.Detector(), env: [], acc: 0, accN: 0, skip: R.delay * 50, frames: 0, tWall: performance.now(), lastAna: 0 });
    beep([523, 784]);
    R.timer = setInterval(tick, 1000);
    tick();
  }

  function finish() {
    if (!R.on) { Live.close(); return; }
    R.on = false;
    clearInterval(R.timer);
    if (R.mic) R.mic.stop();
    R.mic = null;
    const gap = missed(), env = Float32Array.from(R.env);
    R.env = [];
    Live.close();
    if (env.length < 120 * S.FS) {
      showError($('#slError'), env.length ? 'Less than 2 minutes was heard, so there is nothing to show yet. Leave it running through the night.' : 'Ended before listening started.');
      return;
    }
    const r = S.analyze(env);
    r.gapSec = gap;
    r.coughs = R.cd.coughs.length;
    Object.assign(st, { r, example: false, when: stamp() });
    if (!store.set('sleep-last', { r, when: st.when })) {
      // Too big to keep: drop the detail, keep the summary.
      store.set('sleep-last', { r: Object.assign({}, r, { segs: [], pauses: r.pauses.slice(0, 200) }), when: st.when });
    }
    render(); draw();
    $('#slReadout').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#slStart').addEventListener('click', start);
  sbRender();
  render();
  onShow('sleep', panel, draw);
})();
