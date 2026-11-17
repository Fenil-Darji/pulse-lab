// ================= Vision tab =================
(() => {
  const { $, esc, stamp, store, Live, renderReadout, onShow, showError, buzz, beep } = window.VXUI;
  const V = VX.vision, U = VX.U;
  const panel = $('#panelVision');
  const CARD_H = 85.6, CARD_W = 53.98;
  const DIRS = ['right', 'down', 'left', 'up'];
  let data = store.get('vision', {}) || {};
  const save = () => store.set('vision', data);
  const EXAMPLE = {
    dist: { R: 0.0, L: 0.4, distM: 3, child: false, glasses: false, when: '' },
    near: { lm: 0.5, when: '' },
    colour: { right: 5, total: 5, demoOk: true, suspect: false, kind: null },
    amsler: { R: [], L: [] }
  };
  const real = () => !!(data.dist || data.near || data.colour || data.amsler);

  // ---------- Screen size ----------
  const touch = matchMedia('(pointer: coarse)').matches;
  let pxmm = data.pxmm || (touch ? 6.3 : 3.78);
  function calDraw() {
    const r = $('#vsCardRect');
    r.style.width = (CARD_W * pxmm).toFixed(1) + 'px';
    r.style.height = (CARD_H * pxmm).toFixed(1) + 'px';
    r.style.borderRadius = (3.2 * pxmm).toFixed(1) + 'px';
    $('#vsCalRange').value = pxmm;
  }
  function calStatus() {
    const done = !!data.pxmm;
    $('#vsCalBody').hidden = done;
    $('#vsCalEdit').hidden = !done;
    $('#vsCalStatus').textContent = done
      ? 'Screen size saved for this phone (' + data.pxmm.toFixed(2) + ' screen points per millimetre).'
      : 'The letters must be an exact physical size, and every phone\'s screen is different. Do this once on each phone.';
    ['#vsDistStart', '#vsNearStart', '#vsAmslerStart'].forEach((s) => { $(s).title = done ? '' : 'Set the screen size first'; });
  }
  $('#vsCalRange').addEventListener('input', (e) => { pxmm = +e.target.value; calDraw(); });
  $('#vsCalMinus').addEventListener('click', () => { pxmm = Math.max(2.5, pxmm - 0.03); calDraw(); });
  $('#vsCalPlus').addEventListener('click', () => { pxmm = Math.min(14, pxmm + 0.03); calDraw(); });
  $('#vsCalSave').addEventListener('click', () => { data.pxmm = pxmm; save(); calStatus(); $('#vsCalMsg').textContent = ''; });
  $('#vsCalEdit').addEventListener('click', () => { $('#vsCalBody').hidden = false; $('#vsCalEdit').hidden = true; calDraw(); });
  const needCal = () => {
    if (data.pxmm) return false;
    showError($('#vsError'), 'Set the screen size first, using a bank or Aadhaar card (top of this section).');
    $('#vsCal').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  };

  // ---------- Results ----------
  function render() {
    const d = real() ? data : EXAMPLE, ex = !real();
    const dist = d.dist, near = d.near, col = d.colour, ams = d.amsler;
    const parts = [];
    let q = 'good';
    const bump = (x) => { if (x === 'poor' || (x === 'fair' && q === 'good')) q = x; };
    let worse;
    if (dist) {
      worse = dist.R == null || dist.L == null ? null : Math.max(dist.R, dist.L);
      const better = dist.R == null ? dist.L : dist.L == null ? dist.R : Math.min(dist.R, dist.L);
      const cut = dist.child ? '6/9' : '6/12';
      const bad = ['R', 'L'].filter((e) => V.refer(dist[e], dist.child)).map((e) => (e === 'R' ? 'right' : 'left'));
      if (bad.length) {
        bump('poor');
        const who = V.whoDistance(better);
        parts.push('Vision is below ' + cut + ' in the ' + bad.join(' and ') + ' eye' + (bad.length > 1 ? 's' : '') + '. See an eye doctor or optometrist. Quick check: look at the chart again through a pinhole made in a card; if it gets clearer, glasses will probably fix it.' + (who && who.q !== 'good' ? ' Better eye: ' + who.name.toLowerCase() + ' (WHO).' : ''));
      } else if (dist.R != null && dist.L != null && Math.abs(dist.R - dist.L) >= 0.2 - 1e-9) {
        bump('fair');
        parts.push('The two eyes differ by two lines or more.' + (dist.child ? ' In a child this can lead to a lazy eye, so an eye check is worthwhile.' : ' Worth mentioning at the next eye check.'));
      }
    }
    if (near && (near.lm == null || near.lm > 0.3 + 1e-9)) { bump('fair'); parts.push('Small print (N6) is hard to read at 40 cm. Reading glasses usually fix this, especially after age 40; they are inexpensive at eye camps and opticians.'); }
    if (col && (col.suspect || !col.demoOk)) {
      bump('fair');
      parts.push(col.suspect
        ? 'Some colour plates were missed, which can mean ' + (col.kind || 'red-green') + ' colour blindness. It is inherited, more common in men and has no treatment, but it is useful to know for jobs and driving. An eye doctor can confirm it with printed plates.'
        : 'The first colour plate, which everyone should see, was missed. Try again with full screen brightness and good light.');
    }
    const amN = ams ? (ams.R || []).length + (ams.L || []).length : 0;
    if (amN) { bump('poor'); parts.push('Areas of the Amsler grid looked wavy, blurred or missing. See an eye doctor soon, especially if this is new: it can be a sign of a problem in the centre of the retina, such as macular degeneration or diabetic eye disease.'); }
    if (!parts.length && (dist || near || col || ams)) parts.push('No problems found in the checks that were run.');
    const lmTxt = (v) => (v == null ? '' : ' <span class="footnote">(logMAR ' + v.toFixed(1) + ')</span>');
    const quad = (cells) => {
      if (!cells || !cells.length) return 'clear';
      const names = new Set(cells.map(([r, c, n]) => (r < n / 2 ? 'upper' : 'lower') + ' ' + (c < n / 2 ? 'left' : 'right')));
      return cells.length + ' squares, ' + [...names].join(', ');
    };
    const warn = [];
    if (!ex && dist && !data.pxmm) warn.push('The screen size has been cleared since this check, so redo it to be sure.');
    renderReadout($('#vsReadout'), {
      label: 'Distance vision, worse eye',
      value: dist ? V.snellen(worse) : '--', small: !!dist && worse == null,
      unit: '',
      sub: dist ? 'Right ' + V.snellen(dist.R) + ' · Left ' + V.snellen(dist.L) + ' · ' + dist.distM + ' m' + (dist.glasses ? ', with glasses' : ', without glasses') : 'Not tested yet',
      stats: [
        ['Right eye', dist ? esc(V.snellen(dist.R)) + lmTxt(dist.R) : '–'],
        ['Left eye', dist ? esc(V.snellen(dist.L)) + lmTxt(dist.L) : '–'],
        ['Near vision at 40 cm', near ? esc(V.nPoint(near.lm)) + ' print' : '–'],
        ['Colour plates', col ? col.right + ' of ' + col.total + ' red-green plates' : '–'],
        ['Amsler grid', ams ? 'Right ' + esc(quad(ams.R)) + ' · Left ' + esc(quad(ams.L)) : '–'],
        ['Person tested', dist ? (dist.child ? 'Child' : 'Adult') : '–']
      ],
      verdict: parts.length ? { q, text: parts.join(' ') + ' This is a screening check, not an eye examination.' } : null,
      example: ex,
      source: ex ? 'A made-up result, shown until you run a check: good right eye, weaker left eye, needs reading glasses.' : 'Your latest result for each check, kept on this phone only.',
      warnings: warn,
      extra: ex ? '' : '<p class="source"><button type="button" class="textbtn" id="vsClearBtn">Clear vision results</button></p>',
      share: ex ? '' : [
        'Phone Vitals Lab: eye check, ' + stamp(),
        dist ? 'Distance (' + dist.distM + ' m, ' + (dist.glasses ? 'with' : 'without') + ' glasses): right ' + V.snellen(dist.R) + ', left ' + V.snellen(dist.L) + ' (' + dist.when + ')' : '',
        near ? 'Near at 40 cm: ' + V.nPoint(near.lm) + ' (' + near.when + ')' : '',
        col ? 'Colour plates: ' + col.right + ' of ' + col.total + (col.suspect ? ', possible ' + col.kind + ' deficiency' : '') + ' (' + col.when + ')' : '',
        ams ? 'Amsler grid: right ' + quad(ams.R) + ', left ' + quad(ams.L) + ' (' + ams.when + ')' : '',
        'Phone screening only, not an eye examination.'
      ].filter(Boolean).join('\n')
    });
    const b = $('#vsClearBtn');
    if (b) b.addEventListener('click', () => { data = { pxmm: data.pxmm }; save(); render(); });
  }

  // ---------- Shared live helpers ----------
  function session(chip) {
    const s = { alive: true };
    s.quit = (msg) => { if (!s.alive) return; s.alive = false; Live.close(); if (msg) showError($('#vsError'), msg); };
    Live.open({ chip, status: '', noBar: true, onStop: () => s.quit(), onHidden: () => s.quit('The check stopped because the page went to the background.') });
    s.choose = (html, buttons) => new Promise((resolve) => {
      Live.stage.innerHTML = html + '<div class="btn-row">' + buttons.map((b, i) => '<button type="button" class="bigbtn' + (b.quiet ? ' quiet' : '') + '" data-i="' + i + '" style="min-height: 72px; font-size: 18px">' + esc(b.label) + '</button>').join('') + '</div>';
      Live.stage.querySelectorAll('[data-i]').forEach((el) => el.addEventListener('click', () => resolve(buttons[+el.dataset.i].value)));
      const iv = setInterval(() => { if (!s.alive) { clearInterval(iv); resolve(null); } }, 200);
    });
    return s;
  }
  function sizeCanvas(cv, cssW, cssH) {
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    return { ctx: cv.getContext('2d'), dpr };
  }

  // ---------- Tumbling E ----------
  function drawE(cv, lm, distM, dir) {
    const box = cv.parentNode.getBoundingClientRect();
    const { ctx, dpr } = sizeCanvas(cv, Math.floor(box.width), Math.floor(Math.min(window.innerHeight * 0.48, box.width * 1.1)));
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, cv.width, cv.height);
    const unit = Math.max(1, Math.round(V.heightMm(lm, distM) * data.pxmm * dpr / 5));
    ctx.save();
    ctx.translate(Math.round(cv.width / 2), Math.round(cv.height / 2));
    ctx.rotate(dir * Math.PI / 2);
    ctx.fillStyle = '#000000';
    const o = -2.5 * unit;
    ctx.fillRect(o, o, unit, 5 * unit);
    for (const row of [0, 2, 4]) ctx.fillRect(o, o + row * unit, 5 * unit, unit);
    ctx.restore();
  }
  function levelsFor(distM) {
    const dpr = window.devicePixelRatio || 1;
    let min = -0.1;
    while (min < 1 && V.heightMm(min, distM) * data.pxmm * dpr / 5 < 2) min = Math.round((min + 0.1) * 10) / 10;
    return min;
  }

  async function acuity(s, eyes, distM, intro) {
    const min = levelsFor(distM), out = {};
    for (const eye of eyes) {
      if ((await s.choose(intro(eye), [{ label: 'Start', value: 1 }])) == null) return null;
      Live.stage.innerHTML =
        '<div style="border-radius: 10px; overflow: hidden; background: #FFFFFF"><canvas id="vsE" aria-label="Tumbling E"></canvas></div>' +
        '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 360px; justify-self: center; width: 100%">' +
        '<span></span><button type="button" class="bigbtn" data-a="3" style="min-height: 64px" aria-label="Up">↑</button><span></span>' +
        '<button type="button" class="bigbtn" data-a="2" style="min-height: 64px" aria-label="Left">←</button><button type="button" class="bigbtn quiet" data-a="x" style="min-height: 64px; font-size: 15px">Can\'t see</button><button type="button" class="bigbtn" data-a="0" style="min-height: 64px" aria-label="Right">→</button>' +
        '<span></span><button type="button" class="bigbtn" data-a="1" style="min-height: 64px" aria-label="Down">↓</button><span></span></div>';
      let pending = null;
      Live.stage.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => { if (pending) { const p = pending; pending = null; buzz(10); p(b.dataset.a === 'x' ? -1 : +b.dataset.a); } }));
      const cv = $('#vsE'), res = {};
      let step, last = -1;
      while (s.alive && !(step = V.nextLevel(res, 0.6, min)).done) {
        const L = step.next, line = V.Line();
        let outcome = null;
        while (!outcome && s.alive) {
          let dir; do { dir = Math.floor(Math.random() * 4); } while (dir === last);
          last = dir;
          drawE(cv, L, distM, dir);
          Live.status((eye === 'B' ? 'Both eyes' : eye === 'R' ? 'Right eye' : 'Left eye') + ' · line ' + V.snellen(L) + ' · E ' + (line.shown() + 1));
          const a = await new Promise((resolve) => { pending = resolve; const iv = setInterval(() => { if (!s.alive) { clearInterval(iv); resolve(null); } else if (!pending) clearInterval(iv); }, 200); });
          if (a == null || !s.alive) return null;
          outcome = line.answer(a === dir);
        }
        res[L] = outcome === 'pass';
      }
      if (!s.alive) return null;
      out[eye] = step.result;
      beep([660, 880], 0.12);
    }
    return out;
  }

  $('#vsDistStart').addEventListener('click', async () => {
    showError($('#vsError'), '');
    if (needCal()) return;
    const distM = +$('#vsDist').value, child = $('#vsWho').value === 'child', glasses = $('#vsGlasses').checked;
    const s = session('Distance vision');
    Live.note('Screen brightness at full. Person at ' + distM + ' m, phone at their eye height.');
    const r = await acuity(s, ['R', 'L'], distM, (eye) =>
      '<p class="live-note" style="font-size: 16px"><strong>' + (eye === 'R' ? 'Right' : 'Left') + ' eye.</strong> The person stands ' + distM + ' m away and covers the <strong>' + (eye === 'R' ? 'left' : 'right') + ' eye</strong> with a palm, without pressing on it. They point the way the E\'s arms face, and you tap the same arrow. If they cannot tell, tap "Can\'t see". Guessing is fine.</p>');
    if (!r) return;
    s.quit();
    data.dist = { R: r.R, L: r.L, distM, child, glasses, when: stamp() };
    save(); render();
    $('#vsReadout').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('#vsNearStart').addEventListener('click', async () => {
    showError($('#vsError'), '');
    if (needCal()) return;
    const s = session('Near vision');
    Live.note('Hold the phone 40 cm away the whole time. Wear reading glasses if you have them.');
    const r = await acuity(s, ['B'], 0.4, () => '<p class="live-note" style="font-size: 16px"><strong>Both eyes open.</strong> Hold the phone 40 cm from your eyes, about a ruler and a third. Tap the arrow that matches the way the E\'s arms face. Tap "Can\'t see" when it is too small.</p>');
    if (!r) return;
    s.quit();
    data.near = { lm: r.B, when: stamp() };
    save(); render();
    $('#vsReadout').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- Colour plates ----------
  const maskCache = {};
  function digitMask(d) {
    if (maskCache[d]) return maskCache[d];
    const c = document.createElement('canvas'); c.width = c.height = 200;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 150px ' + getComputedStyle(document.body).fontFamily;
    x.fillText(String(d), 100, 106);
    return (maskCache[d] = x.getImageData(0, 0, 200, 200).data);
  }
  function drawPlate(cv, p, seed) {
    const box = cv.parentNode.getBoundingClientRect();
    const size = Math.floor(Math.min(box.width, window.innerHeight * 0.46));
    const { ctx } = sizeCanvas(cv, size, size);
    const W = cv.width, col = V.plateColours(p), mask = digitMask(p.digit), r = U.rng(seed);
    ctx.clearRect(0, 0, W, W);
    const R = 0.48, cell = 0.06, grid = new Map(), dots = [];
    for (let i = 0; i < 9000 && dots.length < 1400; i++) {
      const rad = 0.009 + 0.02 * r(), a = r() * 2 * Math.PI, dd = Math.sqrt(r()) * R;
      const x = 0.5 + dd * Math.cos(a), y = 0.5 + dd * Math.sin(a);
      if (dd + rad > R) continue;
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      let clash = false;
      for (let ix = gx - 1; ix <= gx + 1 && !clash; ix++) for (let iy = gy - 1; iy <= gy + 1 && !clash; iy++) {
        for (const o of grid.get(ix + ',' + iy) || []) if (Math.hypot(o.x - x, o.y - y) < o.rad + rad + 0.003) { clash = true; break; }
      }
      if (clash) continue;
      const dot = { x, y, rad };
      dots.push(dot);
      const k = gx + ',' + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(dot);
    }
    for (const o of dots) {
      const fig = mask[(Math.floor(o.y * 200) * 200 + Math.floor(o.x * 200)) * 4 + 3] > 100;
      const j = 0.78 + 0.37 * r(), c = (fig ? col.fig : col.bg).map((v) => Math.round(255 * V.enc(v * j)));
      ctx.fillStyle = 'rgb(' + c.join(',') + ')';
      ctx.beginPath(); ctx.arc(o.x * W, o.y * W, o.rad * W, 0, 2 * Math.PI); ctx.fill();
    }
  }
  $('#vsColourStart').addEventListener('click', async () => {
    showError($('#vsError'), '');
    const s = session('Colour plates');
    Live.note('Full screen brightness, normal room light, glasses on if you wear them. Answer within a few seconds; don\'t study the plate.');
    const answers = [];
    for (let i = 0; i < V.PLATES.length && s.alive; i++) {
      const p = V.PLATES[i];
      Live.status('Plate ' + (i + 1) + ' of ' + V.PLATES.length + ': which number do you see?');
      Live.stage.innerHTML = '<div style="display: grid; place-items: center"><canvas id="vsPlate" aria-label="Colour plate ' + (i + 1) + '"></canvas></div>' +
        '<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px">' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => '<button type="button" class="bigbtn" data-n="' + n + '" style="min-height: 52px; font-size: 20px">' + n + '</button>').join('') +
        '<button type="button" class="bigbtn quiet" data-n="0" style="min-height: 52px; font-size: 14px">None</button></div>';
      drawPlate($('#vsPlate'), p, 100 + i * 7);
      const a = await new Promise((resolve) => {
        Live.stage.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => resolve(+b.dataset.n)));
        const iv = setInterval(() => { if (!s.alive) { clearInterval(iv); resolve(null); } }, 200);
      });
      if (a == null) return;
      buzz(10);
      answers.push({ type: p.type, ok: a === p.digit });
    }
    if (!s.alive) return;
    s.quit();
    data.colour = Object.assign(V.colourResult(answers), { when: stamp() });
    save(); render();
    $('#vsReadout').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- Amsler grid ----------
  function drawGrid(cv, n, cellPx, marks) {
    const { ctx, dpr } = sizeCanvas(cv, n * cellPx + 2, n * cellPx + 2);
    const c = cellPx * dpr, o = dpr;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = 'rgba(179, 22, 60, 0.35)';
    for (const k of marks) { const [r, q] = k.split(',').map(Number); ctx.fillRect(o + q * c, o + r * c, c, c); }
    ctx.strokeStyle = '#000000'; ctx.lineWidth = Math.max(1, Math.round(dpr * 0.8));
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const p = Math.round(o + i * c) + 0.5; ctx.moveTo(p, o); ctx.lineTo(p, o + n * c); ctx.moveTo(o, p); ctx.lineTo(o + n * c, p); }
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.arc(o + n * c / 2, o + n * c / 2, Math.max(3, c * 0.18), 0, 2 * Math.PI); ctx.fill();
  }
  $('#vsAmslerStart').addEventListener('click', async () => {
    showError($('#vsError'), '');
    if (needCal()) return;
    const s = session('Amsler grid');
    const out = {};
    for (const eye of ['R', 'L']) {
      if ((await s.choose('<p class="live-note" style="font-size: 16px"><strong>' + (eye === 'R' ? 'Right' : 'Left') + ' eye.</strong> Glasses for reading on, if you use them. Hold the phone about 30 cm away. Cover your <strong>' + (eye === 'R' ? 'left' : 'right') + ' eye</strong>. Look only at the dot in the middle, then tap any squares that look wavy, bent, blurred, faded or missing.</p>', [{ label: 'Show the grid', value: 1 }])) == null) return;
      Live.status((eye === 'R' ? 'Right' : 'Left') + ' eye: keep looking at the centre dot');
      const width = Live.stage.getBoundingClientRect().width;
      const cellPx = 5 * data.pxmm;
      let n = Math.min(20, Math.floor(Math.min(width - 4, window.innerHeight * 0.55) / cellPx));
      if (n % 2) n--;
      n = Math.max(6, n);
      const marks = new Set();
      Live.stage.innerHTML = '<div style="display: grid; place-items: center"><canvas id="vsGrid" aria-label="Amsler grid: tap squares that look wrong" style="touch-action: manipulation"></canvas></div>' +
        '<div class="btn-row"><button type="button" class="bigbtn" id="vsGridDone" style="min-height: 64px; font-size: 18px">Done with this eye</button><button type="button" class="bigbtn quiet" id="vsGridClear" style="min-height: 64px; font-size: 18px">Clear marks</button></div>';
      const cv = $('#vsGrid');
      drawGrid(cv, n, cellPx, marks);
      cv.addEventListener('click', (e) => {
        const b = cv.getBoundingClientRect();
        const q = Math.floor((e.clientX - b.left - 1) / cellPx), r = Math.floor((e.clientY - b.top - 1) / cellPx);
        if (q < 0 || r < 0 || q >= n || r >= n) return;
        const k = r + ',' + q;
        if (marks.has(k)) marks.delete(k); else marks.add(k);
        buzz(8);
        drawGrid(cv, n, cellPx, marks);
      });
      $('#vsGridClear').addEventListener('click', () => { marks.clear(); drawGrid(cv, n, cellPx, marks); });
      const ok = await new Promise((resolve) => {
        $('#vsGridDone').addEventListener('click', () => resolve(true));
        const iv = setInterval(() => { if (!s.alive) { clearInterval(iv); resolve(false); } }, 200);
      });
      if (!ok) return;
      out[eye] = [...marks].map((k) => k.split(',').map(Number).concat([n]));
    }
    s.quit();
    data.amsler = { R: out.R, L: out.L, when: stamp() };
    save(); render();
    $('#vsReadout').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  calDraw();
  calStatus();
  render();
  onShow('vision', panel, () => {});
})();
