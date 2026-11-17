// ================= Movement tab =================
(() => {
  const { $, esc, stamp, store, openMotion, Live, chart, renderReadout, onShow, showError, beep, buzz, sleepMs } = window.VXUI;
  const M = VX.movement, U = VX.U;
  const panel = $('#panelMovement');
  let data = store.get('movement', {}) || {};
  const save = () => store.set('movement', data);
  const EXAMPLE = {
    age: 72, sex: 'f',
    chair: { count: 9, auto: 9, taps: null, age: 72, sex: 'f', when: '' },
    balance: { stages: [{ name: 'Feet side by side', held: 10 }, { name: 'Half step forward', held: 10 }, { name: 'Heel to toe', held: 6.4 }], when: '' },
    walk: { steps: 48, cadence: 98, strideReg: 0.71, when: '' },
    tug: { secs: 13.2, when: '' },
    tremor: { 'R-out': { hz: 8.6, dispMm: 0.08, level: 'none', when: '' } },
    kq: [true, false, true],
    last: { kind: 'chair', trace: null }
  };
  const real = () => !!(data.chair || data.balance || data.walk || data.tug || data.tremor);
  const say = (t) => { try { if (!window.speechSynthesis) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.rate = 0.95; u.lang = 'en-IN'; speechSynthesis.speak(u); } catch (e) {} };

  // Age, sex and key questions are kept so the person doesn't retype them.
  if (data.age) $('#mvAge').value = data.age;
  if (data.sex) $('#mvSex').value = data.sex;
  $('#mvAge').addEventListener('change', () => { const v = +$('#mvAge').value; data.age = v >= 18 && v <= 110 ? v : null; save(); render(); });
  $('#mvSex').addEventListener('change', () => { data.sex = $('#mvSex').value; save(); render(); });
  const kqBoxes = [...panel.querySelectorAll('[data-kq]')];
  (data.kq || []).forEach((v, i) => { if (kqBoxes[i]) kqBoxes[i].checked = !!v; });
  kqBoxes.forEach((b) => b.addEventListener('change', () => { data.kq = kqBoxes.map((x) => x.checked); save(); render(); }));

  // ---------- Summary ----------
  function render() {
    const ex = !real(), d = ex ? EXAMPLE : data;
    const age = d.age || (d.chair && d.chair.age), sex = d.sex || 'f';
    const signs = [], notes = [];
    let checks = 0;
    const st = [];
    if (d.chair) {
      checks++;
      const norm = M.chairNorm(d.chair.age || age, d.chair.sex || sex);
      const n = d.chair.count;
      if (norm != null && n != null && n < norm) signs.push('fewer chair stands than average for the age (' + n + ', below-average is under ' + norm + ')');
      st.push(['Chair stand', n == null ? 'Not counted' : n + ' in 30 s' + (norm != null ? ' <span class="footnote">(below average: under ' + norm + ')</span>' : '')]);
    } else st.push(['Chair stand', '–']);
    if (d.balance) {
      checks++;
      const s = d.balance.stages, tandem = s[2];
      if (!tandem || tandem.held < 10) signs.push('heel-to-toe stance not held for 10 seconds');
      const held = s.filter((x) => x.held >= 10).length;
      st.push(['Balance', held + ' of 4 stances held' + (tandem ? ' <span class="footnote">(heel to toe ' + tandem.held.toFixed(1) + ' s)</span>' : '')]);
    } else st.push(['Balance', '–']);
    if (d.tug) {
      checks++;
      if (d.tug.secs >= 12) signs.push('Timed Up and Go took ' + d.tug.secs.toFixed(1) + ' seconds (12 or more is a risk sign)');
      st.push(['Timed Up and Go', d.tug.secs.toFixed(1) + ' s']);
    } else st.push(['Timed Up and Go', '–']);
    if (d.walk) {
      const reg = d.walk.strideReg;
      if (reg < 0.5) notes.push('Walking rhythm was uneven (stride evenness ' + reg.toFixed(2) + ' of 1). Unsteady walking is worth mentioning to a doctor, especially with other fall-risk signs.');
      st.push(['Walking', Math.round(d.walk.cadence) + ' steps a minute · evenness ' + reg.toFixed(2)]);
    } else st.push(['Walking', '–']);
    const trem = d.tremor || {};
    for (const h of ['R', 'L']) {
      const t = trem[h + '-out'] || trem[h + '-rest'];
      const which = trem[h + '-out'] ? 'arm out' : 'at rest';
      st.push([(h === 'R' ? 'Right' : 'Left') + ' hand tremor', t ? (t.level === 'none' ? 'None clear' : t.dispMm.toFixed(1) + ' mm at ' + t.hz.toFixed(1) + ' Hz') + ' <span class="footnote">(' + which + ')</span>' : '–']);
      for (const pos of ['out', 'rest']) {
        const x = trem[h + '-' + pos];
        if (x && x.level !== 'none') notes.push('A ' + (x.level === 'marked' ? 'clear' : 'small but noticeable') + ' tremor in the ' + (h === 'R' ? 'right' : 'left') + ' hand (' + (pos === 'out' ? 'arm held out' : 'resting') + '): about ' + x.dispMm.toFixed(1) + ' mm at ' + x.hz.toFixed(1) + ' Hz. Many tremors are harmless, but a slow tremor at rest (4 to 6 Hz), or one that is getting worse, should be checked by a doctor.');
      }
    }
    const kq = (d.kq || []).filter(Boolean).length;
    if (kq) signs.push('yes to ' + kq + ' of the 3 key questions');
    st.push(['Key questions', kq + ' of 3 answered yes']);
    let verdict = null;
    if (signs.length) verdict = { q: 'poor', text: 'Signs of higher fall risk: ' + signs.join('; ') + '. Talk to a doctor or health worker. Strength and balance exercises, a review of medicines and eyesight, and removing trip hazards at home all reduce falls.' };
    else if (checks) verdict = { q: 'good', text: 'No fall-risk signs in the checks that were run.' };
    if (notes.length) verdict = { q: verdict && verdict.q === 'poor' ? 'poor' : 'fair', text: ((verdict ? verdict.text + ' ' : '') + notes.join(' ')) };
    if (verdict) verdict.text += ' This is a screening check, not a diagnosis.';
    renderReadout($('#mvReadout'), {
      label: 'Fall risk',
      value: !checks && !kq ? 'Not checked yet' : signs.length ? 'Higher fall risk' : 'No signs found',
      small: true, unit: '',
      sub: checks ? signs.length + ' risk sign' + (signs.length === 1 ? '' : 's') + ' across ' + checks + ' timed check' + (checks === 1 ? '' : 's') + (age ? ' · age ' + age : '') : 'Run any check below',
      stats: st, verdict, example: ex,
      source: ex ? 'A made-up result for a 72-year-old woman, shown until you run a check.' : 'Your latest result for each check, kept on this phone only.',
      warnings: !ex && d.chair && !(d.chair.age || age) ? ['Enter the age above to compare the chair stand with the CDC averages for people aged 60 and over.'] : [],
      extra: ex ? '' : '<p class="source"><button type="button" class="textbtn" id="mvClearBtn">Clear movement results</button></p>',
      share: ex ? '' : ['Phone Vitals Lab: movement and fall-risk check, ' + stamp() + (age ? ', age ' + age : '')].concat(st.map(([k, v]) => k + ': ' + v.replace(/<[^>]+>/g, ''))).concat([verdict ? verdict.text : '']).filter(Boolean).join('\n')
    });
    const b = $('#mvClearBtn');
    if (b) b.addEventListener('click', () => { data = { age: data.age, sex: data.sex, kq: data.kq }; save(); render(); draw(); });
  }

  function draw() {
    const last = real() ? data.last : null, el = $('#mvPlot');
    const note = (t, s) => { $('#mvPlotTitle').textContent = t; $('#mvPlotNote').textContent = s; };
    if (!last || (!last.trace && !last.spec)) { note('Last recording', 'The motion recorded in your last check appears here.'); chart(el, { height: 170, x0: 0, x1: 1, y0: 0, y1: 1, empty: 'Run a check to see its recording' }); return; }
    if (last.kind === 'tremor') {
      note('Tremor by frequency', 'How strong the shake was at each rate. A tall, narrow peak is a true tremor; a low, flat line means no clear tremor.');
      const f = last.spec.f, p = last.spec.p;
      chart(el, { height: 180, x0: 2, x1: 14, y0: 0, y1: 1, xTicks: [2, 4, 6, 8, 10, 12, 14].map((v) => [v, v + (v === 14 ? ' Hz' : '')]), series: [{ x: f, y: p, color: 'trace', width: 2 }], marks: [{ x: last.hz, y: p[f.indexOf(last.hz)] || 1 }] });
      return;
    }
    const y = last.trace, x = y.map((_, i) => i / 10), dur = x[x.length - 1] || 1;
    const xt = []; for (let t = 0; t <= dur + 1e-6; t += dur > 20 ? 5 : 2) xt.push([t, t ? t + ' s' : '0']);
    const lo = Math.min(...y), hi = Math.max(...y), pad = (hi - lo) * 0.1 || 1;
    const opt = { height: 180, x0: 0, x1: dur, y0: lo - pad, y1: hi + pad, xTicks: xt, series: [{ x, y, color: 'trace', width: 1.6 }] };
    if (last.kind === 'chair') { note('Thigh angle during the chair stand', 'Up is standing, down is sitting. Each dot is one counted stand.'); opt.y0 = 0; opt.y1 = Math.max(90, hi); opt.yTicks = [[0, '0°'], [45, '45°'], [90, '90°']]; opt.marks = (last.marks || []).map((t) => ({ x: t, y: y[Math.min(y.length - 1, Math.round(t * 10))] })); }
    else if (last.kind === 'walk') { note('Walking rhythm', 'Each bump is a step. Even bumps mean even steps.'); opt.marks = (last.marks || []).map((t) => ({ x: t, y: y[Math.min(y.length - 1, Math.round(t * 10))] })); }
    else if (last.kind === 'balance') { note('Body sway in the last stance', 'Tilt of the chest away from the starting position. A sudden rise means a step out.'); opt.y0 = 0; opt.yTicks = [[0, '0°'], [Math.round(hi / 2), Math.round(hi / 2) + '°'], [Math.round(hi), Math.round(hi) + '°']]; }
    chart(el, opt);
  }

  // ---------- Live helpers ----------
  function session(chip) {
    const s = { alive: true, motion: null };
    s.quit = (msg) => {
      if (!s.alive) return;
      s.alive = false;
      if (s.motion) s.motion.stop();
      try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
      Live.close();
      if (msg) showError($('#mvError'), msg);
    };
    Live.open({ chip, status: '', noBar: true, onStop: () => s.quit(), onHidden: () => s.quit('The check stopped because the page went to the background.') });
    s.choose = (html, buttons) => new Promise((resolve) => {
      Live.stage.innerHTML = html + '<div class="btn-row">' + buttons.map((b, i) => '<button type="button" class="bigbtn' + (b.quiet ? ' quiet' : '') + '" data-i="' + i + '" style="min-height: 72px; font-size: 18px">' + esc(b.label) + '</button>').join('') + '</div>';
      Live.stage.querySelectorAll('[data-i]').forEach((el) => el.addEventListener('click', () => resolve(buttons[+el.dataset.i].value)));
      const iv = setInterval(() => { if (!s.alive) { clearInterval(iv); resolve(null); } }, 200);
    });
    s.wait = async (ms) => { const end = performance.now() + ms; while (s.alive && performance.now() < end) await sleepMs(Math.min(100, end - performance.now())); return s.alive; };
    return s;
  }
  // Starts the motion sensors at once (so the permission prompt belongs to the tap), buffering everything.
  async function motion(s) {
    const b = { t: [], ax: [], ay: [], az: [], lx: [], ly: [], lz: [] };
    s.motion = await openMotion((t, ax, ay, az, lx, ly, lz) => { b.t.push(t); b.ax.push(ax); b.ay.push(ay); b.az.push(az); b.lx.push(lx); b.ly.push(ly); b.lz.push(lz); });
    return {
      now: () => (b.t.length ? b.t[b.t.length - 1] : 0),
      count: () => b.t.length,
      since(t0, t1 = Infinity) {
        let i = 0; while (i < b.t.length && b.t[i] < t0) i++;
        let j = i; while (j < b.t.length && b.t[j] <= t1) j++;
        const o = {}; for (const k in b) o[k] = b[k].slice(i, j);
        o.t = o.t.map((v) => v - t0);
        return o;
      }
    };
  }
  async function begin(s) {
    let m;
    try { m = await motion(s); } catch (e) { s.quit(e.message); return null; }
    if (!(await s.wait(1200))) return null;
    if (m.count() < 10) { s.quit('No motion readings came from this device. Most laptops have no motion sensors; try on a phone.'); return null; }
    return m;
  }
  async function go(s, n, words) {
    for (let k = n; k > 0; k--) {
      if (!s.alive) return false;
      Live.status(words + ' ' + k);
      beep(660, 0.09);
      await sleepMs(1000);
    }
    if (!s.alive) return false;
    beep([880, 1175], 0.14); buzz(200); say('Go');
    return true;
  }
  const finish = (s, key, rec, last) => { s.quit(); data[key] = rec; if (last) data.last = last; save(); render(); draw(); $('#mvReadout').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const age = () => { const v = +$('#mvAge').value; return v >= 18 && v <= 110 ? v : null; };

  // ---------- Chair stand ----------
  $('#mvChairStart').addEventListener('click', async () => {
    showError($('#mvError'), '');
    const pocket = $('#mvChairWhere').value === 'pocket';
    const s = session('Chair stand');
    const m = await begin(s);
    if (!m) return;
    say('Sit in the middle of the chair, feet flat, arms crossed over your chest.');
    if ((await s.choose('<p class="live-note" style="font-size: 16px">Sit in the middle of the chair, back straight, feet flat, <strong>arms crossed over the chest</strong>.' + (pocket ? ' Phone in the front trouser pocket.' : '') + ' On "Go", stand up fully and sit back down, as many times as possible in 30 seconds. The helper presses Ready.</p>', [{ label: 'Ready', value: 1 }])) == null) return;
    let taps = 0;
    Live.stage.innerHTML = '<div class="live-hero"><span class="hero-val"><span class="hero-num" id="mvChairN">0</span><span class="hero-unit">stands</span></span></div>' +
      '<button type="button" class="bigbtn quiet" id="mvChairTap">Helper: tap at each full stand<br><span class="footnote" id="mvChairTapN">Taps: 0</span></button>';
    $('#mvChairTap').addEventListener('click', () => { taps++; $('#mvChairTapN').textContent = 'Taps: ' + taps; buzz(10); if (!pocket) $('#mvChairN').textContent = taps; });
    if (!(await go(s, 3, 'Starting in'))) return;
    const t0 = m.now();
    let half = false;
    while (s.alive) {
      const el = m.now() - t0;
      if (el >= 30) break;
      Live.timer(Math.ceil(30 - el) + ' s');
      Live.status('Stand up and sit down, as fast as is safe.');
      if (pocket && el > 2) { const c = M.chairStand(m.since(t0 - 0.8), 30); if (c.count != null) $('#mvChairN').textContent = c.count; }
      if (!half && el >= 15) { half = true; say('Halfway'); }
      await sleepMs(250);
    }
    if (!s.alive) return;
    beep([1175, 880], 0.2); say('Stop. Sit down and rest.');
    const seg = m.since(t0 - 0.8, t0 + 30.2), c = pocket ? M.chairStand(seg, 30.8) : { count: null };
    // The count includes the 0.8 s seated lead-in before Go.
    const auto = c.count, count = pocket && auto != null ? auto : (taps || null);
    finish(s, 'chair', { count, auto, taps: taps || null, pocket, age: age(), sex: $('#mvSex').value, when: stamp() },
      c.trace ? { kind: 'chair', trace: c.trace, marks: (c.stands || []) } : null);
    if (pocket && auto == null) showError($('#mvError'), 'The phone did not swing between sitting and standing, so stands could not be counted from it' + (taps ? '; the helper\'s taps were used instead.' : '. Was it in a front trouser pocket?'));
  });

  // ---------- Balance ----------
  const STANCES = [
    { name: 'Feet side by side', say: 'Stand with your feet side by side, touching.' },
    { name: 'Half step forward', say: 'Move one foot forward so its instep touches the big toe of the other foot.' },
    { name: 'Heel to toe', say: 'Put one foot directly in front of the other, heel touching toe.' },
    { name: 'One leg', say: 'Stand on one leg.' }
  ];
  $('#mvBalStart').addEventListener('click', async () => {
    showError($('#mvError'), '');
    const s = session('Balance');
    const m = await begin(s);
    if (!m) return;
    if ((await s.choose('<p class="live-note" style="font-size: 16px">Hold the phone <strong>flat against your chest with both hands</strong>. The helper stands close by, ready to steady you. Listen for each instruction; get into position, then hold still until you hear the high beep.</p>', [{ label: 'Start', value: 1 }])) == null) return;
    const stages = [];
    let lastTrace = null;
    for (let k = 0; k < STANCES.length && s.alive; k++) {
      const S = STANCES[k];
      let lostByHelper = null;
      Live.stage.innerHTML = '<div class="live-hero"><span class="hero-val"><span class="hero-num sm" id="mvBalName">' + esc(S.name) + '</span></span></div>' +
        '<button type="button" class="bigbtn quiet" id="mvBalLost">Helper: tap if they step or grab</button>';
      say(S.say + ' Get ready.');
      Live.status('Stance ' + (k + 1) + ' of 4: get into position');
      if (!(await s.wait(5500))) return;
      if (!(await go(s, 3, 'Hold still in'))) return;
      const t0 = m.now();
      $('#mvBalLost').addEventListener('click', () => { if (lostByHelper == null) { lostByHelper = m.now() - t0; buzz(80); } });
      let res = null;
      while (s.alive) {
        const el = m.now() - t0;
        Live.timer(Math.max(0, 10 - el).toFixed(0) + ' s');
        Live.status('Stance ' + (k + 1) + ' of 4: hold still');
        if (el > 1) { res = M.balance(m.since(t0, t0 + 10)); if (res.lost != null) break; }
        if (lostByHelper != null || el >= 10) break;
        await sleepMs(200);
      }
      if (!s.alive) return;
      res = M.balance(m.since(t0, t0 + 10));
      const held = Math.min(10, lostByHelper != null ? lostByHelper : res.held);
      stages.push({ name: S.name, held, sway: res.swayDeg });
      lastTrace = res.trace;
      if (held < 10) { beep(330, 0.4); say('Stop. Stand normally.'); break; }
      beep([880, 1175], 0.14); say('Good. Relax.');
      if (!(await s.wait(1500))) return;
    }
    if (!s.alive) return;
    finish(s, 'balance', { stages, when: stamp() }, lastTrace ? { kind: 'balance', trace: lastTrace } : null);
  });

  // ---------- Walking ----------
  $('#mvWalkStart').addEventListener('click', async () => {
    showError($('#mvError'), '');
    const s = session('Walking');
    const m = await begin(s);
    if (!m) return;
    if ((await s.choose('<p class="live-note" style="font-size: 16px">Press Start, then put the phone in a <strong>trouser pocket</strong>, or hold it in one hand at your side. After the countdown, walk at your usual pace for 30 seconds, turning when you need to. Two beeps mean stop.</p>', [{ label: 'Start', value: 1 }])) == null) return;
    say('Put the phone in your pocket. Start walking when you hear go.');
    if (!(await go(s, 6, 'Walk in'))) return;
    const t0 = m.now();
    while (s.alive) { const el = m.now() - t0; if (el >= 30) break; Live.timer(Math.ceil(30 - el) + ' s'); Live.status('Walk at your usual pace'); await sleepMs(250); }
    if (!s.alive) return;
    beep([1175, 880], 0.2); buzz([200, 100, 200]); say('Stop.');
    const w = M.walking(m.since(t0, t0 + 30));
    if (!w || w.still || w.steps < 10) { s.quit('Hardly any steps were picked up. Keep the phone in a pocket or firmly in your hand, and walk for the whole 30 seconds.'); return; }
    finish(s, 'walk', { steps: w.steps, cadence: w.cadence, strideReg: w.strideReg, when: stamp() }, { kind: 'walk', trace: w.trace.slice(0, 150), marks: w.stepTimes.filter((t) => t < 15) });
  });

  // ---------- Timed Up and Go ----------
  $('#mvTugStart').addEventListener('click', async () => {
    showError($('#mvError'), '');
    const s = session('Timed Up and Go');
    if ((await s.choose('<p class="live-note" style="font-size: 16px">The person sits back in the chair, with the 3-metre mark ready. Tap Go and say "Go". Tap Stop the moment they are seated again.</p>', [{ label: 'Go', value: 1 }])) == null) return;
    beep([880, 1175], 0.14); say('Go');
    const t0 = performance.now();
    let stopped = false;
    Live.stage.innerHTML = '<div class="live-hero"><span class="hero-val"><span class="hero-num" id="mvTugT">0.0</span><span class="hero-unit">seconds</span></span></div><button type="button" class="bigbtn" id="mvTugStop" style="min-height: 40vh">Seated again: stop</button>';
    $('#mvTugStop').addEventListener('click', () => { stopped = true; });
    while (s.alive && !stopped) { $('#mvTugT').textContent = ((performance.now() - t0) / 1000).toFixed(1); Live.status('Walk to the mark, turn, come back and sit'); await sleepMs(50); }
    if (!s.alive) return;
    const secs = (performance.now() - t0) / 1000;
    beep(660, 0.15);
    finish(s, 'tug', { secs, when: stamp() }, null);
  });

  // ---------- Tremor ----------
  $('#mvTremStart').addEventListener('click', async () => {
    showError($('#mvError'), '');
    const hand = panel.querySelector('[name="mvHand"]:checked').value, pos = panel.querySelector('[name="mvPos"]:checked').value;
    const s = session('Tremor');
    const m = await begin(s);
    if (!m) return;
    const how = pos === 'out' ? 'Hold the phone in your ' + (hand === 'R' ? 'right' : 'left') + ' hand with the arm straight out in front, at shoulder height.' : 'Rest your ' + (hand === 'R' ? 'right' : 'left') + ' forearm on your lap with the phone in your relaxed palm.';
    say(how);
    if ((await s.choose('<p class="live-note" style="font-size: 16px">' + how + ' Keep still and breathe normally for 20 seconds. Don\'t grip hard.</p>', [{ label: 'Start', value: 1 }])) == null) return;
    if (!(await go(s, 3, 'Hold still in'))) return;
    const t0 = m.now() + 1;
    Live.stage.innerHTML = '<p class="live-note" style="font-size: 16px">' + esc(how) + '</p>';
    while (s.alive) { const el = m.now() - t0; if (el >= 20) break; Live.timer(Math.ceil(Math.min(21, 20 - el)) + ' s'); Live.status('Hold still'); await sleepMs(250); }
    if (!s.alive) return;
    beep([1175, 880], 0.2); say('Done. Relax.');
    const r = M.tremor(m.since(t0, t0 + 20));
    if (!r) { s.quit('Too few motion readings to measure a tremor. Try again.'); return; }
    data.tremor = data.tremor || {};
    const rec = { hz: r.hz, dispMm: r.dispMm, rms: r.rms, level: r.level, when: stamp() };
    s.quit();
    data.tremor[hand + '-' + pos] = rec;
    data.last = { kind: 'tremor', spec: r.spec, hz: r.hz };
    save(); render(); draw();
    $('#mvReadout').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  render();
  onShow('movement', panel, draw);
})();
