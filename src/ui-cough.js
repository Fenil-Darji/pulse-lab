// ================= Cough tab =================
(() => {
  const { $, esc, stamp, store, openMic, Live, chart, renderReadout, onShow, showError, beep, buzz, share, countdown, sleepMs } = window.VXUI;
  const C = VX.cough, U = VX.U;
  const panel = $('#panelCough');
  const pad2 = (v) => String(v).padStart(2, '0');
  const clock = (sec) => { const s = Math.floor(sec); return (s >= 3600 ? Math.floor(s / 3600) + ':' + pad2(Math.floor((s % 3600) / 60)) : Math.floor(s / 60)) + ':' + pad2(s % 60); };
  const st = { r: null, example: true, when: '', taps: null };
  let exampleR = null;

  function showExample() {
    if (!exampleR) exampleR = C.analyze(C.synth({ seconds: 1200, seed: 21, gap: 14, kinds: ['cough', 'bout', 'speech', 'speech', 'speech', 'speech', 'clap'] }).frames);
    Object.assign(st, { r: exampleR, example: true, when: '', taps: null });
  }
  const saved = store.get('cough-last', null);
  if (saved && saved.r && saved.r.coughs) Object.assign(st, { r: saved.r, example: false, when: saved.when || '', taps: saved.taps == null ? null : saved.taps }); else showExample();
  const history = () => store.get('cough-history', []);

  function timeTicks(dur) {
    const step = [60, 120, 300, 600, 900, 1800, 3600, 7200].find((s) => dur / s <= 7) || 7200;
    const out = [];
    for (let t = 0; t <= dur + 1e-6; t += step) out.push([t, t === 0 ? '0' : (step >= 3600 ? t / 3600 + ' h' : (dur >= 3600 ? Math.floor(t / 3600) + ':' + pad2(Math.floor((t % 3600) / 60)) : Math.round(t / 60) + ' min'))]);
    return out;
  }

  function trend() {
    const h = history();
    if (st.example || h.length < 2) return null;
    const a = h[h.length - 2], b = h[h.length - 1];
    if (a.dur < 300 || b.dur < 300) return null;
    const change = (b.rate - a.rate) / Math.max(a.rate, 1);
    const txt = Math.round(a.rate) + ' per hour last time (' + a.when + '), ' + Math.round(b.rate) + ' per hour now.';
    if (change < -0.2) return { q: 'good', text: 'Fewer coughs than the previous session: ' + txt };
    if (change > 0.2) return { q: 'poor', text: 'More coughs than the previous session: ' + txt + ' If the cough keeps getting worse, see a doctor.' };
    return { q: 'fair', text: 'About the same as the previous session: ' + txt };
  }

  function render() {
    const r = st.r, warn = [];
    if (!st.example) {
      if (r.dur < 300) warn.push('Less than 5 minutes was heard, so the rate per hour can swing a lot.');
      if (r.gapSec > 60) warn.push('About ' + U.fmtDur(r.gapSec) + ' was missed, probably while the screen was off or another app was open.');
      if (st.taps != null && Math.abs(r.count - st.taps) > Math.max(2, 0.25 * st.taps)) warn.push('The page counted ' + r.count + ' coughs and you tapped ' + st.taps + '. Background talking, laughing or other people coughing can explain the difference.');
    }
    const shareLines = [
      'Phone Vitals Lab: cough count' + (st.when ? ', ' + st.when : ''),
      'Listened: ' + U.fmtDur(r.dur),
      'Coughs heard: ' + r.count + ' (' + Math.round(r.rate) + ' per hour), in ' + r.bouts + ' bouts',
      st.taps != null ? 'Counted by hand: ' + st.taps : '',
      'Phone estimate only.'
    ];
    renderReadout($('#cgReadout'), {
      label: 'Coughs per hour',
      value: r.dur >= 60 ? String(Math.round(r.rate)) : '--',
      unit: 'per hour',
      sub: st.example ? '' : st.when,
      stats: [
        ['Coughs heard', String(r.count)],
        ['Listened', esc(U.fmtDur(r.dur))],
        ['Cough bouts', String(r.bouts)],
        ['Busiest 10 minutes', r.count ? r.busiest + ' coughs' : '–'],
        ['Your own count', st.taps == null ? '–' : String(st.taps)],
        ['Missed', r.gapSec > 60 ? esc(U.fmtDur(r.gapSec)) : 'Nothing']
      ],
      verdict: trend(),
      example: st.example,
      source: st.example ? 'A made-up 20-minute session with coughs, talking and other noises, shown until you run your own.' : 'Your session, kept on this phone only.',
      warnings: warn,
      extra: st.example ? '' : '<p class="source"><button type="button" class="textbtn" id="cgExampleBtn">Show the example</button></p>',
      share: st.example ? '' : shareLines.filter(Boolean).join('\n')
    });
    const b = $('#cgExampleBtn');
    if (b) b.addEventListener('click', () => { showExample(); render(); draw(); });
  }

  function draw() {
    const r = st.r;
    if (!r.count) chart($('#cgPlot'), { height: 170, x0: 0, x1: 1, y0: 0, y1: 1, empty: 'No coughs heard in this session' });
    else {
      const y1 = Math.max(30, Math.ceil(Math.max(...r.coughs.map((c) => c.peak)) / 10) * 10), yt = [];
      for (let v = 10; v <= y1; v += 10) yt.push([v, v + ' dB']);
      chart($('#cgPlot'), { height: 180, x0: 0, x1: Math.max(r.dur, 60), y0: 0, y1, xTicks: timeTicks(r.dur), yTicks: yt, marks: r.coughs.map((c) => ({ x: c.t, y: c.peak })) });
    }
    const h = history();
    $('#cgHistShare').disabled = !h.length; $('#cgHistClear').disabled = !h.length;
    if (!h.length) { chart($('#cgHist'), { height: 160, x0: 0, x1: 1, y0: 0, y1: 1, empty: 'Your sessions appear here' }); return; }
    const ys = h.map((e) => e.rate), y1 = Math.max(10, Math.ceil(Math.max(...ys) * 1.15 / 10) * 10);
    const every = Math.max(1, Math.ceil(h.length / 6));
    chart($('#cgHist'), {
      height: 170, x0: -0.5, x1: h.length - 0.5, y0: 0, y1,
      xTicks: h.map((e, i) => [i, new Date(e.ts).toLocaleDateString([], { day: 'numeric', month: 'short' })]).filter((_, i) => i % every === 0 || i === h.length - 1),
      yTicks: [[0, '0'], [y1 / 2, String(y1 / 2)], [y1, String(y1)]],
      series: h.length > 1 ? [{ x: h.map((_, i) => i), y: ys, color: 'trace', width: 2 }] : [],
      marks: h.map((e, i) => ({ x: i, y: e.rate }))
    });
  }

  $('#cgHistShare').addEventListener('click', () => {
    const lines = ['Phone Vitals Lab: cough count history'].concat(history().map((e) => e.when + ': ' + e.count + ' coughs in ' + U.fmtDur(e.dur) + ' (' + Math.round(e.rate) + ' per hour)'));
    share(lines.join('\n'), $('#cgHistMsg'));
  });
  $('#cgHistClear').addEventListener('click', () => { store.set('cough-history', []); $('#cgHistMsg').textContent = 'History cleared.'; draw(); render(); });

  // ---------- Live counting ----------
  const R = { on: false, mic: null, det: null, taps: 0, frames: 0, tWall: 0, want: 0, timer: 0, lastN: 0 };
  function onFrames(d) {
    if (!R.on) return;
    for (let k = 0; k + 1 < d.length; k += 2) { R.frames++; R.det.push(d[k], d[k + 1]); }
  }
  function tick() {
    if (!R.on) return;
    const sec = R.frames / 50, n = R.det.coughs.length;
    if (n !== R.lastN) {
      R.lastN = n;
      const el = $('#cgLiveN');
      el.textContent = n;
      el.style.color = 'var(--accent)'; setTimeout(() => { el.style.color = ''; }, 350);
    }
    $('#cgLiveLast').textContent = n ? 'Last cough ' + U.fmtDur(Math.max(1, sec - R.det.coughs[n - 1].t)) + ' ago.' : 'Listening for coughs.';
    Live.status(sec < 2 ? 'Measuring the room background…' : 'Listening.');
    if (R.want) {
      Live.timer(clock(sec) + ' / ' + clock(R.want));
      Live.bar(sec / R.want);
      if (sec >= R.want) { beep([784, 523]); finish(); return; }
    } else Live.timer(clock(sec));
    const missed = Math.max(0, (performance.now() - R.tWall) / 1000 - sec);
    Live.note((R.want ? 'Keep this page open.' : 'Keep this page open and the phone on charge.') + (missed > 60 ? ' About ' + U.fmtDur(missed) + ' has been missed so far.' : ''));
  }
  async function start() {
    showError($('#cgError'), '');
    if (R.on) return;
    R.want = +$('#cgDur').value || 0;
    Live.open({ chip: 'Cough counter', status: 'Starting the microphone…', dark: !R.want, noBar: !R.want, stopLabel: 'End and see results', onStop: finish });
    Live.stage.innerHTML =
      '<div class="live-hero"><span class="hero-val"><span class="hero-num" id="cgLiveN">0</span><span class="hero-unit">coughs heard</span></span></div>' +
      '<p class="live-note" id="cgLiveLast">Listening for coughs.</p>' +
      '<button type="button" class="bigbtn quiet" id="cgTap">Tap when you hear a cough<br><span class="footnote" id="cgTapN">Your count: 0</span></button>';
    $('#cgTap').addEventListener('click', () => { if (!R.on) return; R.taps++; $('#cgTapN').textContent = 'Your count: ' + R.taps; buzz(15); });
    let mic;
    try { mic = await openMic(onFrames); }
    catch (e) { Live.close(); showError($('#cgError'), e.message); return; }
    if (!Live.isOpen()) { mic.stop(); return; }
    Object.assign(R, { on: true, mic, det: new C.Detector(), taps: 0, frames: 0, tWall: performance.now(), lastN: 0 });
    beep([523, 784]);
    R.timer = setInterval(tick, 250);
    tick();
  }
  function finish() {
    if (!R.on) { Live.close(); return; }
    R.on = false;
    clearInterval(R.timer);
    if (R.mic) R.mic.stop();
    R.mic = null;
    const dur = R.frames / 50, gap = Math.max(0, (performance.now() - R.tWall) / 1000 - dur);
    Live.close();
    if (dur < 30) { showError($('#cgError'), 'Less than 30 seconds was heard, so there is nothing to show yet.'); return; }
    const r = Object.assign(C.summarize(R.det.coughs, dur), { coughs: R.det.coughs, why: R.det.why, gapSec: gap });
    const taps = R.taps > 0 ? R.taps : null, when = stamp();
    Object.assign(st, { r, example: false, when, taps });
    store.set('cough-last', { r, when, taps });
    const h = history();
    h.push({ ts: Date.now(), when, dur: Math.round(dur), count: r.count, rate: +r.rate.toFixed(1), taps });
    store.set('cough-history', h.slice(-60));
    render(); draw();
    $('#cgReadout').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('#cgStart').addEventListener('click', start);

  // ---------- TB symptom check ----------
  const tbBoxes = [...panel.querySelectorAll('[data-tb]')];
  function tbState() {
    const n = (k) => tbBoxes.filter((b) => b.dataset.tb === k && b.checked).length;
    const main = n('main'), risk = n('risk'), cough = n('cough'), any = main + risk + cough;
    if (main) return { q: 'poor', text: 'These are signs of possible TB. Get a sputum (phlegm) test soon at the nearest government health centre, or ask your ASHA worker to arrange it. TB treatment is free at government health facilities. Ni-kshay Sampark helpline: 1800-11-6666 (toll-free).' };
    if (risk && cough) return { q: 'fair', text: 'With these higher-risk answers, even a short cough is worth asking a health worker about a TB test. Ni-kshay Sampark helpline: 1800-11-6666 (toll-free).' };
    if (!any) return { q: 'good', text: 'Tick everything that applies. Anyone with a cough for 2 weeks or more should get tested for TB.' };
    return { q: 'good', text: 'No TB warning signs ticked. If the cough lasts 2 weeks or more, or fever, weight loss or night sweats start, get tested for TB.' };
  }
  function tbRender() { const s = tbState(), out = $('#cgTbOut'); out.dataset.q = s.q; out.textContent = s.text; }
  tbBoxes.forEach((b) => b.addEventListener('change', tbRender));
  $('#cgTbShare').addEventListener('click', (e) => {
    const ticked = tbBoxes.filter((b) => b.checked).map((b) => '- ' + b.closest('label').textContent.trim());
    share(['Phone Vitals Lab: TB symptom check, ' + stamp()].concat(ticked.length ? ticked : ['- Nothing ticked'], ['', tbState().text]).join('\n'), e.target.parentNode.querySelector('.copy-msg'));
  });

  // ---------- Child breathing count ----------
  let rr = null;
  const dsBoxes = [...panel.querySelectorAll('[data-ds]')];
  function rrState() {
    const ds = dsBoxes.filter((b) => b.checked).length;
    const parts = [];
    let q = 'good';
    if (ds) { q = 'poor'; parts.push('Danger sign ticked: take the child to a hospital or health centre now.'); }
    if (rr) {
      const head = rr.count + ' breaths in 60 seconds (' + rr.age + '). ';
      const fast = rr.count >= rr.thr;
      if (rr.thr === 30) {
        if (fast) { q = 'poor'; parts.push(head + 'At rest, 30 or more breaths a minute is a sign of severe illness in an adult with cough or fever. See a doctor today.'); }
        else if (rr.count > 20) { if (q !== 'poor') q = 'fair'; parts.push(head + 'A little faster than the usual 12 to 20 at rest. Rest for 10 minutes and count again.'); }
        else if (rr.count < 10) { if (q !== 'poor') q = 'fair'; parts.push(head + 'Slower than the usual 12 to 20. Count again; if breathing really is this slow, see a doctor.'); }
        else parts.push(head + 'Within the usual 12 to 20 breaths a minute at rest.');
      } else if (fast) {
        q = 'poor';
        parts.push(head + (rr.thr === 60
          ? 'Fast breathing for a baby under 2 months. Count once more to be sure; if it is still 60 or more, this can be a serious infection. Take the baby to a doctor or hospital today.'
          : 'Fast breathing for this age. With a cough or difficult breathing, this is a sign of pneumonia. See a doctor or health worker today.'));
      } else parts.push(head + 'Not fast breathing for this age (fast is ' + rr.thr + ' or more). If there is a cough or fever, keep watching and count again if breathing looks faster.');
    }
    if (!parts.length) parts.push('Press Start, then tap once for every breath in, for 60 seconds.');
    return { q, text: parts.join(' ') };
  }
  function rrRender() {
    const s = rrState(), out = $('#cgRrOut');
    out.dataset.q = s.q; out.textContent = s.text;
    $('#cgRrShareRow').hidden = !rr && !dsBoxes.some((b) => b.checked);
  }
  dsBoxes.forEach((b) => b.addEventListener('change', rrRender));
  $('#cgRrShare').addEventListener('click', (e) => {
    const ticked = dsBoxes.filter((b) => b.checked).map((b) => '- ' + b.closest('label').textContent.trim());
    share(['Phone Vitals Lab: breathing count, ' + stamp(), rrState().text].concat(ticked.length ? ['Danger signs:'].concat(ticked) : []).join('\n'), e.target.parentNode.querySelector('.copy-msg'));
  });
  $('#cgRrStart').addEventListener('click', async () => {
    const sel = panel.querySelector('[name="cgAge"]:checked');
    const thr = +sel.value, age = sel.nextElementSibling.querySelector('b').textContent.toLowerCase();
    let count = 0, running = false, alive = true;
    const quit = () => { alive = false; Live.close(); };
    Live.open({ chip: 'Breathing count', status: 'Get ready: watch the belly or chest.', onStop: quit, onHidden: quit });
    Live.stage.innerHTML =
      '<div class="live-hero"><span class="hero-val"><span class="hero-num" id="cgRrN">0</span><span class="hero-unit">breaths</span></span></div>' +
      '<button type="button" class="bigbtn" id="cgRrTap">Tap for each breath in</button>';
    $('#cgRrTap').addEventListener('click', () => { if (!running) return; count++; $('#cgRrN').textContent = count; buzz(10); });
    if (!(await countdown(3, 'Starting in', () => alive))) return;
    running = true;
    beep(880, 0.25);
    Live.status('Tap every time the belly or chest rises.');
    const t0 = performance.now();
    while (alive) {
      const el = (performance.now() - t0) / 1000;
      if (el >= 60) break;
      Live.timer(Math.ceil(60 - el) + ' s left');
      Live.bar(el / 60);
      await sleepMs(100);
    }
    if (!alive) return;
    running = false;
    beep([880, 660], 0.2);
    Live.close();
    rr = { count, thr, age };
    rrRender();
    $('#cgRr').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  tbRender();
  rrRender();
  render();
  onShow('cough', panel, draw);
})();
