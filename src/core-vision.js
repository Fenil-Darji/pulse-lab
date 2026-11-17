  // ================= Vision: tumbling E sizes and steps, colour plates =================
  api.vision = (() => {
    const r1 = (x) => Math.round(x * 10) / 10;
    const LEVELS = []; for (let v = 10; v >= -1; v--) LEVELS.push(v / 10);   // logMAR 1.0 (6/60) to -0.1 (6/4.8)
    const SNELLEN = { '1': '6/60', '0.9': '6/48', '0.8': '6/38', '0.7': '6/30', '0.6': '6/24', '0.5': '6/19', '0.4': '6/15', '0.3': '6/12', '0.2': '6/9.5', '0.1': '6/7.5', '0': '6/6', '-0.1': '6/4.8' };
    const snellen = (lm) => (lm == null ? 'worse than 6/60' : SNELLEN[String(r1(lm))] || '6/' + Math.round(6 * Math.pow(10, lm)));
    // Letter height: 5 minutes of arc at logMAR 0, scaled by 10^logMAR.
    const heightMm = (lm, distM) => distM * 1000 * Math.tan((5 / 60) * Math.pow(10, lm) * Math.PI / 180);
    // N-point print size at 40 cm (1 M ≈ N8): N ≈ 8 × M, M = 0.4 m × 10^logMAR.
    const NS = [5, 6, 8, 10, 12, 14, 18, 24, 36, 48];
    const nPoint = (lm) => {
      if (lm == null) return 'larger than N48';
      const n = 3.2 * Math.pow(10, lm);
      if (n < 4.5) return 'N5 or smaller';
      let best = NS[0]; for (const v of NS) if (Math.abs(Math.log(v / n)) < Math.abs(Math.log(best / n))) best = v;
      return 'N' + best;
    };

    // Bracketing: step down 0.2 while lines pass, then 0.1, until the line below the smallest passed line has failed.
    function nextLevel(res, start = 0.6, min = -0.1) {
      const lv = Object.keys(res).map(Number);
      if (!lv.length) return { next: start };
      const passed = lv.filter((l) => res[l]), failed = lv.filter((l) => !res[l]);
      if (!passed.length) {
        const top = Math.max(...failed);
        if (top >= 1 - 1e-9) return { done: true, result: null };
        return { next: r1(Math.min(1, top + 0.2)) };
      }
      const P = Math.min(...passed);
      if (P <= min + 1e-9) return { done: true, result: P };
      const below = failed.filter((l) => l < P - 1e-9);
      if (below.length) {
        const F = Math.max(...below);
        if (r1(P - 0.1) <= F + 1e-9) return { done: true, result: P };
        return { next: r1(P - 0.1) };
      }
      return { next: r1(Math.max(min, P - 0.2)) };
    }
    // One line: up to five Es; three right passes, three wrong fails.
    function Line() {
      let right = 0, wrong = 0;
      return { answer(ok) { if (ok) right++; else wrong++; return right >= 3 ? 'pass' : wrong >= 3 ? 'fail' : null; }, shown: () => right + wrong };
    }
    function simulate(T, o = {}) {
      const r = U.rng(o.seed || 1), slope = o.slope || 0.04;
      const res = {};
      let shown = 0, step;
      while (!(step = nextLevel(res, o.start, o.min)).done) {
        const L = step.next, line = Line();
        let out = null;
        while (!out) { shown++; out = line.answer(r() < 0.25 + 0.75 / (1 + Math.exp(-(L - T) / slope))); }
        res[L] = out === 'pass';
      }
      return { result: step.result, shown };
    }

    // WHO distance vision impairment, by the better eye (ICD-11 categories).
    function whoDistance(better) {
      if (better === undefined) return null;
      if (better == null || better > 1.0 + 1e-9) return { name: 'Severe vision impairment or worse', q: 'poor' };
      if (better > 0.5 + 1e-9) return { name: 'Moderate vision impairment', q: 'poor' };
      if (better > 0.3 + 1e-9) return { name: 'Mild vision impairment', q: 'fair' };
      return { name: 'No distance vision impairment', q: 'good' };
    }
    // Screening referral: worse than 6/12 for adults, worse than 6/9 for school children (WHO school eye health guidance).
    const refer = (lm, child) => lm == null || lm > (child ? 0.2 : 0.3) + 1e-9;

    // ---------- Colour ----------
    const dec = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const enc = (c) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
    // Viénot, Brettel and Mollon (1999)
    const toLMS = ([r, g, b]) => [17.8824 * r + 43.5161 * g + 4.11935 * b, 3.45565 * r + 27.1554 * g + 3.86714 * b, 0.0299566 * r + 0.184309 * g + 1.46709 * b];
    const toRGB = ([l, m, s]) => [0.0809444479 * l - 0.130504409 * m + 0.116721066 * s, -0.0102485335 * l + 0.0540193266 * m - 0.113614708 * s, -0.000365296938 * l - 0.00412161469 * m + 0.693511405 * s];
    function dichromat(rgb, type) {
      const [l, m, s] = toLMS(rgb);
      if (type === 'protan') return toRGB([2.02344 * m - 2.52581 * s, m, s]);
      if (type === 'deutan') return toRGB([l, 0.494207 * l + 1.24827 * s, s]);
      return rgb;
    }
    function lab(rgb) {
      const [r, g, b] = rgb;
      const X = 0.4124 * r + 0.3576 * g + 0.1805 * b, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
      const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      const fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
      return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
    }
    const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
    const inGamut = (c) => c.every((v) => v >= 0.02 && v <= 0.98);
    // A figure colour that differs from the background only in what one cone type sees, so that cone type's absence hides it.
    function confusion(base, type, target) {
      const lms = toLMS(base), k = type === 'protan' ? 0 : 1;
      let best = null;
      for (const sign of [1, -1]) {
        let lo = 0, hi = 0.6;
        for (let i = 0; i < 30; i++) {
          const mid = (lo + hi) / 2, x = lms.slice(); x[k] *= 1 + sign * mid;
          const c = toRGB(x);
          if (inGamut(c) && dE(c, base) <= target) lo = mid; else hi = mid;
        }
        const x = lms.slice(); x[k] *= 1 + sign * lo;
        const c = toRGB(x), d = dE(c, base);
        if (!best || d > best.d) best = { fig: c, d };
      }
      return best;
    }
    // The plates: one everyone should see, then red-green plates of two strengths for each cone type.
    const PLATES = [
      { type: 'demo', base: [0.55, 0.42, 0.18], target: 0, digit: 7 },
      { type: 'protan', base: [0.42, 0.36, 0.14], target: 22, digit: 5 },
      { type: 'deutan', base: [0.40, 0.38, 0.13], target: 22, digit: 3 },
      { type: 'protan', base: [0.36, 0.30, 0.16], target: 12, digit: 8 },
      { type: 'deutan', base: [0.34, 0.32, 0.15], target: 12, digit: 6 },
      { type: 'deutan', base: [0.45, 0.33, 0.20], target: 30, digit: 2 }
    ];
    function plateColours(p) {
      if (p.type === 'demo') return { bg: p.base, fig: [0.08, 0.16, 0.38] };
      return { bg: p.base, fig: confusion(p.base, p.type, p.target).fig };
    }
    function colourResult(answers) {
      // answers: [{type, ok}]
      const demo = answers.find((a) => a.type === 'demo');
      const rg = answers.filter((a) => a.type !== 'demo'), miss = rg.filter((a) => !a.ok);
      const pm = miss.filter((a) => a.type === 'protan').length, dm = miss.filter((a) => a.type === 'deutan').length;
      return {
        demoOk: !!(demo && demo.ok), right: rg.length - miss.length, total: rg.length,
        suspect: miss.length >= 2, kind: miss.length < 2 ? null : (pm > dm ? 'red (protan)' : dm > pm ? 'green (deutan)' : 'red-green')
      };
    }

    return { LEVELS, snellen, heightMm, nPoint, nextLevel, Line, simulate, whoDistance, refer, dec, enc, dichromat, dE, confusion, PLATES, plateColours, colourResult };
  })();

