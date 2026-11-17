  // ================= Hearing: pure-tone thresholds by the ascending method =================
  api.hearing = (() => {
    const FREQS = [1000, 2000, 4000, 6000, 500];   // test order, starting at 1 kHz as audiologists do
    const PTA = [500, 1000, 2000, 4000];            // the four frequencies WHO averages
    const MIN = -100, MAX = -15;                    // dB relative to full volume
    // WHO World Report on Hearing (2021): grade by the better ear's average over 500, 1000, 2000 and 4000 Hz.
    const GRADES = [[20, 'Normal hearing', 'good'], [35, 'Mild hearing loss', 'fair'], [50, 'Moderate hearing loss', 'poor'],
      [65, 'Moderately severe hearing loss', 'poor'], [80, 'Severe hearing loss', 'poor'], [95, 'Profound hearing loss', 'poor'], [Infinity, 'Complete hearing loss', 'poor']];

    // Down 10 dB after each tone heard, up 5 dB after each miss; the threshold is the quietest level heard twice on the way up.
    function Staircase(start) {
      let lvl = Math.max(MIN, Math.min(MAX, Math.round(start / 5) * 5)), up = false, trials = 0, done = false, thr = null, topMiss = 0;
      const asc = [];
      const end = (v) => { done = true; thr = v; };
      return {
        level: () => lvl, done: () => done, threshold: () => thr, trials: () => trials,
        answer(heard) {
          if (done) return;
          trials++;
          if (!up) {
            if (heard) { if (lvl <= MIN) return end(MIN); lvl = Math.max(MIN, lvl - 10); }
            else { up = true; lvl = Math.min(MAX, lvl + 5); }
          } else if (heard) {
            asc.push(lvl);
            if (asc.filter((v) => v === lvl).length >= 2) return end(lvl);
            if (asc.length >= 3) return end(U.median(asc));
            lvl = Math.max(MIN, lvl - 10);
          } else {
            if (lvl >= MAX && ++topMiss >= 2) return end(null);
            lvl = Math.min(MAX, lvl + 5);
          }
          if (trials >= 18) end(asc.length ? U.median(asc) : null);
        }
      };
    }

    function grade(pta) { for (const g of GRADES) if (pta < g[0]) return { name: g[1], q: g[2] }; return null; }
    const avg = (ear, fs) => { const v = fs.map((f) => ear[f]); return v.some((x) => x == null) ? null : U.mean(v); };

    // res: { R: {freq: dB or null}, L: {...} }  ref: {freq: dB} from a listener with good hearing, or null
    function summarize(res, ref) {
      const out = { ears: {}, diffs: {}, flags: [] };
      for (const e of ['R', 'L']) {
        const raw = res[e] || {};
        const rel = {};
        if (ref) for (const f of FREQS) rel[f] = raw[f] == null || ref[f] == null ? null : Math.max(0, raw[f] - ref[f]);
        out.ears[e] = { raw, rel: ref ? rel : null, pta: ref ? avg(rel, PTA) : null, notHeard: FREQS.filter((f) => f in raw && raw[f] == null) };
      }
      let big = 0;
      const ds = [];
      for (const f of FREQS) {
        const a = res.R && res.R[f], b = res.L && res.L[f];
        const ta = a == null ? MAX + 10 : a, tb = b == null ? MAX + 10 : b;
        if ((res.R && f in res.R) && (res.L && f in res.L)) { out.diffs[f] = ta - tb; ds.push(ta - tb); if (Math.abs(ta - tb) >= 20) big++; }
      }
      const pd = PTA.filter((f) => f in out.diffs).map((f) => out.diffs[f]);
      out.earDiff = pd.length ? U.mean(pd) : null;                   // positive: right ear needs louder tones
      out.asym = out.earDiff != null && (Math.abs(out.earDiff) >= 15 || big >= 2);
      out.worseEar = out.earDiff == null ? null : (out.earDiff > 0 ? 'R' : 'L');
      if (ref) {
        const pr = out.ears.R.pta, pl = out.ears.L.pta;
        const anyNotHeard = out.ears.R.notHeard.length || out.ears.L.notHeard.length;
        const better = pr == null ? pl : pl == null ? pr : Math.min(pr, pl);
        const worse = pr == null || pl == null ? null : Math.max(pr, pl);
        out.better = better; out.worse = worse;
        out.grade = better != null ? grade(better) : (anyNotHeard ? { name: 'Some tones not heard at full volume', q: 'poor' } : null);
        out.unilateral = better != null && worse != null && better < 20 && worse >= 35;
      }
      return out;
    }

    // Reference from a listener with good hearing: the average of both ears at each frequency.
    function makeRef(res) {
      const ref = {}, warn = [];
      for (const f of FREQS) {
        const a = res.R && res.R[f], b = res.L && res.L[f];
        if (a == null || b == null) { warn.push(f); continue; }
        if (Math.abs(a - b) >= 15) warn.push(f);
        ref[f] = (a + b) / 2;
      }
      return { ref, ok: Object.keys(ref).length === FREQS.length && warn.length === 0, warn };
    }

    // Simulated listener, for tests and the example.
    function listener(T, o = {}) {
      const r = U.rng(o.seed || 1), s = o.slope || 1.5, fa = o.fa == null ? 0.03 : o.fa, lapse = o.lapse == null ? 0.03 : o.lapse;
      return (lvl) => (r() < fa ? true : r() < lapse ? false : r() < 1 / (1 + Math.exp(-(lvl - T) / s)));
    }
    function runSim(T, start, o) {
      const sc = Staircase(start), hear = listener(T, o);
      while (!sc.done()) sc.answer(hear(sc.level()));
      return { thr: sc.threshold(), trials: sc.trials() };
    }

    return { FREQS, PTA, MIN, MAX, GRADES, Staircase, grade, summarize, makeRef, listener, runSim };
  })();

