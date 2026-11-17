// ================= Hearing tab =================
(() => {
  const { $, esc, stamp, store, audio, Live, chart, renderReadout, onShow, showError, sleepMs, buzz } = window.VXUI;
  const H = VX.hearing, U = VX.U;
  const panel = $('#panelHearing');
  const EAR = { R: 'right', L: 'left' };
  const ORDER = [500, 1000, 2000, 4000, 6000];
  const fLabel = (f) => (f >= 1000 ? f / 1000 + 'k' : String(f));
  const fText = (f) => f.toLocaleString('en-IN') + ' Hz';

  // ---------- Saved state ----------
  const EXAMPLE = {
    res: { R: { 1000: -80, 2000: -80, 4000: -70, 6000: -60, 500: -75 }, L: { 1000: -75, 2000: -70, 4000: -50, 6000: -45, 500: -75 } },
    ref: { 500: -80, 1000: -85, 2000: -85, 4000: -80, 6000: -72.5 },
    retest: -80, catchFalse: 0, catchTotal: 9, stray: 1, phones: ''
  };
  const st = { d: null, example: true, when: '' };
  let refRec = store.get('hearing-ref', null);
  const last = store.get('hearing-last', null);
  if (last && last.res) Object.assign(st, { d: last, example: false, when: last.when || '' }); else Object.assign(st, { d: EXAMPLE, example: true });
  try { $('#hrPhones').value = store.get('hearing-phones', ''); } catch (e) {}

  const refFor = () => (st.example ? st.d.ref : refRec && refRec.ref);

  function refStatus() {
    const el = $('#hrRefStatus');
    if (refRec) el.innerHTML = 'Reference saved ' + esc(refRec.when) + (refRec.phones ? ' with <strong>' + esc(refRec.phones) + '</strong>' : '') + '. Results are graded against it.';
    else el.innerHTML = '<strong>No reference yet.</strong> The check still compares your two ears, but needs a reference listener for a hearing grade. See "Reference listener" below.';
    $('#hrRefClear').disabled = !refRec;
    $('#hrRefSave').disabled = st.example;
  }

  function render() {
    const d = st.d, ref = refFor(), s = H.summarize(d.res, ref);
    const warn = [], verdict = [];
    let q = 'good';
    if (s.asym) {
      q = 'poor';
      verdict.push('The ' + EAR[s.worseEar] + ' ear needed beeps about ' + Math.round(Math.abs(s.earDiff)) + ' dB louder than the other. A difference this large is worth an ear check: it can be wax or an infection, and sometimes needs a specialist.');
    }
    if (s.grade) {
      if (s.grade.q === 'poor') q = 'poor'; else if (s.grade.q === 'fair' && q === 'good') q = 'fair';
      verdict.push({
        'Normal hearing': 'The better ear heard beeps about as quietly as the reference listener.',
        'Mild hearing loss': 'Mild hearing loss in the better ear: quiet speech and voices across a room may be hard to follow. A test at an ENT clinic can confirm it.',
        'Some tones not heard at full volume': 'Some beeps were not heard even at the loudest level. Please get a hearing test at an ENT clinic.'
      }[s.grade.name] || s.grade.name + ' in the better ear. Hearing aids help many people with this level of loss; please see an ENT doctor or audiologist.');
    } else if (!ref) {
      if (!s.asym) { q = 'fair'; verdict.push('Your left and right ears heard beeps at similar levels. For a hearing grade, save a reference listener (see below).'); }
    }
    if (!st.example) {
      if (d.retest != null && d.res.R && d.res.R[1000] != null && Math.abs(d.retest - d.res.R[1000]) > 10) warn.push('The repeat of the 1,000 Hz beep came out ' + Math.round(Math.abs(d.retest - d.res.R[1000])) + ' dB different, so the answers were unsteady. Try again somewhere quieter.');
      if ((d.catchTotal && d.catchFalse / d.catchTotal > 0.25) || d.stray > 8) warn.push('Quite a few taps came when no beep was playing. Tap only when you are sure you heard something.');
      if (ref && refRec && refRec.phones && d.phones && refRec.phones.toLowerCase() !== d.phones.toLowerCase()) warn.push('These earphones (' + esc(d.phones) + ') are not the reference earphones (' + esc(refRec.phones) + '), so the grade may be off.');
    }
    const earTxt = (e) => {
      const E = s.ears[e];
      if (!(d.res[e])) return '–';
      if (ref && E.pta != null) return Math.round(E.pta) + ' dB above reference' + ' <span class="footnote">(' + esc(H.grade(E.pta).name.replace(' hearing loss', '').replace(' hearing', '').toLowerCase()) + ')</span>';
      const v = H.PTA.map((f) => d.res[e][f]).filter((x) => x != null);
      return v.length ? Math.round(-U.mean(v)) + ' dB below full volume' : 'Not heard';
    };
    const notHeard = ['R', 'L'].flatMap((e) => s.ears[e].notHeard.map((f) => EAR[e] + ' ' + fText(f)));
    const hero = s.grade && ref
      ? { label: 'Hearing, better ear', value: s.grade.name, small: true, unit: '', sub: s.better != null ? 'Average ' + Math.round(s.better) + ' dB above the reference over 500 to 4,000 Hz' : '' }
      : { label: 'Difference between ears', value: s.earDiff == null ? '--' : String(Math.round(Math.abs(s.earDiff))), unit: 'dB', sub: s.earDiff == null ? '' : (s.asym ? 'The ' + EAR[s.worseEar] + ' ear needed louder beeps.' : 'Both ears heard beeps at similar levels.') };
    renderReadout($('#hrReadout'), Object.assign(hero, {
      stats: [
        ['Right ear', earTxt('R')], ['Left ear', earTxt('L')],
        ['Not heard at full volume', notHeard.length ? esc(notHeard.join(', ')) : 'None'],
        ['Repeat at 1,000 Hz', d.retest == null || !d.res.R || d.res.R[1000] == null ? '–' : (Math.abs(d.retest - d.res.R[1000]) <= 10 ? 'Steady (' + Math.round(Math.abs(d.retest - d.res.R[1000])) + ' dB apart)' : Math.round(Math.abs(d.retest - d.res.R[1000])) + ' dB apart')],
        ['Taps on blank turns', d.catchTotal ? d.catchFalse + ' of ' + d.catchTotal : '–'],
        ['Earphones', d.phones ? esc(d.phones) : '–']
      ],
      verdict: verdict.length ? { q, text: verdict.join(' ') + ' This is a screening check, not a diagnosis.' } : null,
      example: st.example,
      source: st.example ? 'A made-up result: normal right ear, a dip at high pitches in the left ear, graded against a made-up reference.' : 'Your check' + (st.when ? ' from ' + st.when : '') + ', kept on this phone only.',
      warnings: warn,
      extra: st.example ? '' : '<p class="source"><button type="button" class="textbtn" id="hrExampleBtn">Show the example</button></p>',
      share: st.example ? '' : [
        'Phone Vitals Lab: tone hearing check' + (st.when ? ', ' + st.when : ''),
        'Pitch (Hz): ' + ORDER.join(' / '),
        'Right ear (dB re full volume): ' + ORDER.map((f) => (d.res.R && d.res.R[f] != null ? d.res.R[f] : 'not heard')).join(' / '),
        'Left ear (dB re full volume): ' + ORDER.map((f) => (d.res.L && d.res.L[f] != null ? d.res.L[f] : 'not heard')).join(' / '),
        s.grade && ref ? 'Grade (better ear, vs reference listener): ' + s.grade.name + (s.better != null ? ', ' + Math.round(s.better) + ' dB' : '') : 'No reference listener, so no grade.',
        s.earDiff != null ? 'Ear difference: ' + Math.round(Math.abs(s.earDiff)) + ' dB' + (s.asym ? ' (' + EAR[s.worseEar] + ' worse)' : '') : '',
        d.phones ? 'Earphones: ' + d.phones : '',
        'Phone screening only, not an audiogram.'
      ].filter(Boolean).join('\n')
    }));
    const b = $('#hrExampleBtn');
    if (b) b.addEventListener('click', () => { Object.assign(st, { d: EXAMPLE, example: true, when: '' }); render(); draw(); refStatus(); });
  }

  function draw() {
    const d = st.d, ref = refFor(), s = H.summarize(d.res, ref);
    const xs = ORDER.map((_, i) => i), xTicks = ORDER.map((f, i) => [i, fLabel(f) + (i === ORDER.length - 1 ? ' Hz' : '')]);
    const val = (e, f) => {
      if (ref) { const v = s.ears[e].rel; return v && v[f] != null ? v[f] : NaN; }
      const r = d.res[e]; return r && r[f] != null ? -r[f] : NaN;
    };
    const series = ['R', 'L'].map((e) => ({ x: xs, y: ORDER.map((f) => val(e, f)), color: e === 'R' ? '--accent' : 'trace', width: 2 }));
    const marks = [];
    series.forEach((sr, k) => sr.y.forEach((y, i) => { if (isFinite(y)) marks.push({ x: i, y, color: k ? 'trace' : '--accent' }); }));
    const all = series.flatMap((sr) => sr.y).filter(isFinite);
    if (!all.length) { chart($('#hrPlot'), { height: 200, x0: 0, x1: 1, y0: 0, y1: 1, empty: 'No beeps were heard' }); return; }
    if (ref) {
      $('#hrChartNote').textContent = 'How much louder each ear needed the beeps than the reference listener. Higher on the chart is better: the top line, 0 dB, is the reference. Below the 20 dB line counts as hearing loss.';
      const y1 = Math.max(60, Math.ceil(Math.max(...all) / 20) * 20), yt = [];
      for (let v = 0; v <= y1; v += 20) yt.push([v, v + ' dB']);
      chart($('#hrPlot'), { height: 220, x0: -0.4, x1: ORDER.length - 0.6, y0: 0, y1, flipY: true, xTicks, yTicks: yt, series, marks });
    } else {
      $('#hrChartNote').textContent = 'How far below full volume each ear could still hear the beep. Higher on the chart means the ear heard quieter beeps. Without a reference listener, compare the two ears rather than the numbers.';
      const lo = Math.floor((Math.min(...all) - 5) / 10) * 10, hi = Math.ceil((Math.max(...all) + 5) / 10) * 10, yt = [];
      for (let v = lo; v <= hi; v += 10) yt.push([v, '−' + v]);
      chart($('#hrPlot'), { height: 220, x0: -0.4, x1: ORDER.length - 0.6, y0: lo, y1: hi, xTicks, yTicks: yt, series, marks });
    }
  }

  $('#hrRefSave').addEventListener('click', () => {
    if (st.example) return;
    const m = H.makeRef(st.d.res);
    if (!Object.keys(m.ref).length) { $('#hrRefMsg').textContent = 'This result cannot be a reference: too many beeps were not heard.'; return; }
    refRec = { ref: m.ref, when: st.d.when || stamp(), phones: st.d.phones || '' };
    store.set('hearing-ref', refRec);
    $('#hrRefMsg').textContent = m.ok ? 'Saved. Later checks are graded against this result.' : 'Saved, but the two ears differed at ' + m.warn.map(fText).join(', ') + '. A reference listener should have two equally good ears.';
    refStatus(); render(); draw();
  });
  $('#hrRefClear').addEventListener('click', () => { refRec = null; store.set('hearing-ref', null); $('#hrRefMsg').textContent = 'Reference removed.'; refStatus(); render(); draw(); });

  // ---------- The test ----------
  function playTone(ctx, merger, f, db, ear) {
    const t0 = ctx.currentTime + 0.06, A = Math.pow(10, db / 20);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t0);
    for (let k = 0; k < 3; k++) {
      const a = t0 + k * 0.4;
      g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(A, a + 0.02);
      g.gain.setValueAtTime(A, a + 0.23); g.gain.linearRampToValueAtTime(0, a + 0.25);
    }
    o.connect(g); g.connect(merger, 0, ear === 'L' ? 0 : 1);
    o.start(t0); o.stop(t0 + 1.15);
    const lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    return performance.now() + (t0 - ctx.currentTime + lat) * 1000;
  }

  async function run() {
    showError($('#hrError'), '');
    const phones = $('#hrPhones').value.trim();
    store.set('hearing-phones', phones);
    const ctx = audio();
    if (!ctx) { showError($('#hrError'), 'This browser cannot play the test beeps.'); return; }
    const merger = ctx.createChannelMerger(2);
    merger.connect(ctx.destination);
    let alive = true;
    const quit = (msg) => { if (!alive) return; alive = false; Live.close(); try { merger.disconnect(); } catch (e) {} if (msg) showError($('#hrError'), msg); };
    Live.open({ chip: 'Hearing check', status: 'Put on your earphones.', stopLabel: 'Stop', onStop: () => quit('The check was stopped.'), onHidden: () => quit('The check stopped because the page went to the background. Start again when ready.') });
    const wait = async (ms) => { const end = performance.now() + ms; while (alive && performance.now() < end) await sleepMs(Math.min(100, end - performance.now())); return alive; };
    const choose = (html, buttons) => new Promise((resolve) => {
      Live.stage.innerHTML = html + '<div class="btn-row">' + buttons.map((b, i) => '<button type="button" class="bigbtn' + (b.quiet ? ' quiet' : '') + '" data-i="' + i + '" style="min-height: 72px; font-size: 18px">' + esc(b.label) + '</button>').join('') + '</div>';
      Live.stage.querySelectorAll('[data-i]').forEach((el) => el.addEventListener('click', () => resolve(buttons[+el.dataset.i].value)));
      const iv = setInterval(() => { if (!alive) { clearInterval(iv); resolve(null); } }, 200);
    });

    // 1. Setup
    Live.bar(0);
    if (await choose('<p class="live-note">Right earphone in the right ear, left in the left. Media volume at maximum. Find a quiet spot.</p>', [{ label: 'Ready', value: 1 }]) == null) return;

    // 2. Ear check
    for (const ear of (Math.random() < 0.5 ? ['R', 'L'] : ['L', 'R'])) {
      let db = -35, answer = null;
      for (let attempt = 0; attempt < 3 && alive; attempt++) {
        Live.status('Ear check: listen…');
        Live.stage.innerHTML = '<p class="live-note">A beep is playing.</p>';
        playTone(ctx, merger, 1000, db, ear);
        if (!(await wait(1400))) return;
        Live.status('Ear check');
        answer = await choose('<p class="live-note">Where did you hear the beep?</p>', [{ label: 'Left ear', value: 'L' }, { label: 'Right ear', value: 'R' }, { label: 'Both ears', value: 'B', quiet: true }, { label: "Didn't hear it", value: 'N', quiet: true }]);
        if (answer == null) return;
        if (answer !== 'N') break;
        db += 10;
      }
      if (answer === 'N') return quit('No beep was heard in the ' + EAR[ear] + ' ear, even louder. Check the earphones are plugged in or connected, and the media volume is at maximum.');
      if (answer === 'B') return quit('The beep was heard in both ears. The earphones may be playing in mono: turn off "Mono audio" in the phone\'s accessibility settings, or try other earphones.');
      if (answer !== ear) return quit('The beep for the ' + EAR[ear] + ' ear was heard in the ' + EAR[answer] + ' ear. Swap the earphones round (look for L and R) and start again.');
    }

    // 3. Thresholds
    const conds = [];
    for (const e of ['R', 'L']) { for (const f of H.FREQS) conds.push({ e, f }); if (e === 'R') conds.push({ e, f: 1000, retest: true }); }
    const res = { R: {}, L: {} };
    let retest = null, catchFalse = 0, catchTotal = 0, stray = 0;
    const taps = [];
    Live.stage.innerHTML = '<button type="button" class="bigbtn" id="hrTap" style="min-height: 46vh">Tap when you hear a beep</button>';
    const tapBtn = $('#hrTap');
    tapBtn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); taps.push(performance.now()); buzz(8); tapBtn.style.background = 'var(--accent)'; setTimeout(() => { tapBtn.style.background = ''; }, 120); });
    tapBtn.addEventListener('keydown', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); taps.push(performance.now()); } });
    Live.note('Tap even for a very faint beep. Beeps come at random moments, and sometimes nothing plays.');
    for (let ci = 0; ci < conds.length && alive; ci++) {
      const c = conds[ci];
      const prev = res[c.e][H.FREQS[H.FREQS.indexOf(c.f) - 1]], other = c.e === 'L' ? res.R[c.f] : null;
      const start = ci === 0 ? -40 : (other != null ? other + 15 : prev != null ? prev + 15 : c.retest ? (res.R[1000] != null ? res.R[1000] + 15 : -40) : -40);
      const sc = H.Staircase(Math.min(-25, start));
      Live.status((c.e === 'R' ? 'Right' : 'Left') + ' ear · ' + fText(c.f) + (c.retest ? ' again' : ''));
      Live.timer((ci + 1) + ' of ' + conds.length);
      let n = 0;
      while (!sc.done() && alive) {
        if (!(await wait(700 + 1300 * Math.random()))) return;
        // Taps during the quiet gap are guesses.
        stray += taps.splice(0).length;
        const blank = n > 0 && Math.random() < 0.12;
        const onset = blank ? performance.now() + 60 : playTone(ctx, merger, c.f, sc.level(), c.e);
        if (!(await wait(onset - performance.now() + 1900))) return;
        const heard = taps.some((t) => t >= onset + 100 && t <= onset + 1900);
        taps.length = 0;
        if (blank) { catchTotal++; if (heard) catchFalse++; continue; }
        sc.answer(heard);
        n++;
        Live.bar((ci + Math.min(0.95, n / 9)) / conds.length);
      }
      if (!alive) return;
      if (c.retest) retest = sc.threshold(); else res[c.e][c.f] = sc.threshold();
    }
    if (!alive) return;
    alive = false;
    Live.close();
    try { merger.disconnect(); } catch (e) {}
    const d = { res, retest, catchFalse, catchTotal, stray, phones, when: stamp() };
    Object.assign(st, { d, example: false, when: d.when });
    store.set('hearing-last', d);
    refStatus(); render(); draw();
    $('#hrReadout').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('#hrStart').addEventListener('click', run);

  refStatus();
  render();
  onShow('hearing', panel, draw);
})();
