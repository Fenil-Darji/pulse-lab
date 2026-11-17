  // ================= Movement: tremor, balance, chair stands and walking from the motion sensors =================
  api.movement = (() => {
    const FS = 50, G = 9.81;
    // ---------- Uniform sampling and filters ----------
    function resample(t, v, fs = FS) {
      const n = t.length < 2 ? 0 : Math.floor((t[t.length - 1] - t[0]) * fs) + 1, out = new Float64Array(n);
      let j = 0;
      for (let i = 0; i < n; i++) {
        const ti = t[0] + i / fs;
        while (j < t.length - 2 && t[j + 1] < ti) j++;
        const a = t[j], b = t[j + 1], w = b > a ? Math.min(1, Math.max(0, (ti - a) / (b - a))) : 0;
        const va = v[j], vb = v[j + 1];
        out[i] = isFinite(va) && isFinite(vb) ? va + (vb - va) * w : (isFinite(va) ? va : vb);
      }
      return out;
    }
    function bq(type, f0, fs) {
      const w = 2 * Math.PI * f0 / fs, c = Math.cos(w), al = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + al;
      const b0 = (type === 'lp' ? (1 - c) / 2 : (1 + c) / 2), b1 = (type === 'lp' ? 1 - c : -(1 + c));
      return [b0 / a0, b1 / a0, b0 / a0, -2 * c / a0, (1 - al) / a0];
    }
    function run(q, x) {
      const y = new Float64Array(x.length);
      let x1 = x[0], x2 = x[0];
      const dc = (q[0] + q[1] + q[2]) / (1 + q[3] + q[4]);
      let y1 = x[0] * dc, y2 = y1;
      for (let i = 0; i < x.length; i++) { const v = q[0] * x[i] + q[1] * x1 + q[2] * x2 - q[3] * y1 - q[4] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
      return y;
    }
    // Zero-phase: each filter forward and backward.
    function filt(x, lo, hi, fs = FS) {
      if (x.length < 4) return Float64Array.from(x);
      const qs = []; if (lo) qs.push(bq('hp', lo, fs)); if (hi) qs.push(bq('lp', hi, fs));
      let y = Float64Array.from(x);
      for (const q of qs) { y = run(q, y); y.reverse(); y = run(q, y); y.reverse(); }
      return y;
    }
    function uniform(s) {
      const has = (k) => s[k] && s[k].filter((v) => isFinite(v)).length > 0.8 * s[k].length;
      const o = { n: 0 };
      for (const k of ['ax', 'ay', 'az', 'lx', 'ly', 'lz']) o[k] = has(k) ? resample(s.t, s[k]) : null;
      o.n = o.ax ? o.ax.length : 0;
      return o;
    }
    const tilt = (u, hi = 1.5) => {
      const gx = filt(u.ax, 0, hi), gy = filt(u.ay, 0, hi), gz = filt(u.az, 0, hi);
      return { gx, gy, gz, ang(ref) { const out = new Float64Array(gx.length); for (let i = 0; i < out.length; i++) { const m = Math.hypot(gx[i], gy[i], gz[i]) || 1; out[i] = Math.acos(Math.max(-1, Math.min(1, (gx[i] * ref[0] + gy[i] * ref[1] + gz[i] * ref[2]) / m))) * 180 / Math.PI; } return out; } };
    };
    const meanDir = (T, a, b) => { let x = 0, y = 0, z = 0; for (let i = a; i < b; i++) { x += T.gx[i]; y += T.gy[i]; z += T.gz[i]; } const m = Math.hypot(x, y, z) || 1; return [x / m, y / m, z / m]; };
    const down = (x, k) => { const o = []; for (let i = 0; i < x.length; i += k) o.push(+x[i].toFixed(3)); return o; };

    // ---------- Tremor ----------
    function tremor(s) {
      const u = uniform(s);
      if (u.n < FS * 8) return null;
      const axes = u.lx ? [u.lx, u.ly, u.lz] : [u.ax, u.ay, u.az];
      const skip = FS;
      const bp = axes.map((x) => filt(x, 2.5, 14).subarray(skip, x.length - skip));
      const n = bp[0].length, f = [], p = [];
      for (let fr = 2; fr <= 14.0001; fr += 0.1) {
        const om = 2 * Math.PI * fr / FS;
        let pw = 0;
        for (const y of bp) {
          let re = 0, im = 0;
          for (let i = 0; i < n; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)); re += w * y[i] * Math.cos(om * i); im -= w * y[i] * Math.sin(om * i); }
          pw += re * re + im * im;
        }
        f.push(+fr.toFixed(1)); p.push(pw);
      }
      let k = 0; for (let i = 1; i < p.length; i++) if (p[i] > p[k]) k = i;
      const peak = f[k];
      let near = 0, tot = 0;
      for (let i = 0; i < f.length; i++) { tot += p[i]; if (Math.abs(f[i] - peak) <= 1) near += p[i]; }
      let ss = 0; for (let i = 0; i < n; i++) ss += bp[0][i] ** 2 + bp[1][i] ** 2 + bp[2][i] ** 2;
      const rms = Math.sqrt(ss / n), conc = tot ? near / tot : 0;
      const dispMm = Math.SQRT2 * rms / Math.pow(2 * Math.PI * peak, 2) * 1000;
      const level = conc < 0.3 || dispMm < 0.15 ? 'none' : dispMm < 1 ? 'mild' : 'marked';
      const pm = Math.max(...p) || 1;
      return { hz: peak, rms, dispMm, conc, level, spec: { f, p: p.map((v) => +(v / pm).toFixed(4)) } };
    }

    // ---------- Balance (one stance) ----------
    function balance(s, limit = 10) {
      const u = uniform(s);
      if (u.n < FS) return { held: 0, swayDeg: null, lost: null };
      const T = tilt(u, 3), ref = meanDir(T, 0, Math.min(u.n, FS)), ang = T.ang(ref);
      const mag = new Float64Array(u.n); for (let i = 0; i < u.n; i++) mag[i] = Math.hypot(u.ax[i], u.ay[i], u.az[i]) - G;
      const jolt = filt(mag, 0, 5);
      let lost = null;
      for (let i = Math.round(0.5 * FS); i < u.n; i++) if (ang[i] > 20 || Math.abs(jolt[i]) > 5) { lost = i / FS; break; }
      const end = lost == null ? u.n : Math.round(lost * FS);
      const seg = Array.from(ang.subarray(0, end));
      return { held: Math.min(limit, lost == null ? u.n / FS : lost), lost, swayDeg: seg.length > FS / 2 ? U.rms(seg) : null, trace: down(ang, 5) };
    }

    // ---------- Chair stands: thigh tilt with the phone in a front trouser pocket ----------
    function chairStand(s, secs = 30) {
      const u = uniform(s);
      if (u.n < FS * 3) return { count: null, why: 'short' };
      const T = tilt(u, 1.5), ref = meanDir(T, 0, Math.round(0.8 * FS)), ang = T.ang(ref);
      const A = U.pct(Array.from(ang), 0.95);
      if (A < 35) return { count: null, why: 'flat', maxDeg: A, trace: down(ang, 5) };
      const hi = 0.6 * A, lo = 0.35 * A, stands = [];
      let armed = true;
      for (let i = 0; i < u.n && i / FS <= secs + 0.05; i++) {
        if (armed && ang[i] > hi) { stands.push(i / FS); armed = false; }
        else if (!armed && ang[i] < lo) armed = true;
      }
      return { count: stands.length, stands, maxDeg: A, trace: down(ang, 5) };
    }
    // CDC STEADI 30-second chair stand: below-average scores by age band.
    const CHAIR_NORMS = [[60, 14, 12], [65, 12, 11], [70, 12, 10], [75, 11, 10], [80, 10, 9], [85, 8, 8], [90, 7, 4]];
    function chairNorm(age, sex) {
      if (!(age >= 60)) return null;
      let row = CHAIR_NORMS[0]; for (const r of CHAIR_NORMS) if (age >= r[0]) row = r;
      return sex === 'f' ? row[2] : row[1];
    }

    // ---------- Walking: steps and regularity from overall acceleration (works in any pocket) ----------
    function walking(s) {
      const u = uniform(s);
      if (u.n < FS * 10) return null;
      const mag = new Float64Array(u.n); for (let i = 0; i < u.n; i++) mag[i] = Math.hypot(u.ax[i], u.ay[i], u.az[i]);
      const y = filt(mag, 0.6, 3.5);
      const amp = U.pct(Array.from(y, Math.abs), 0.95);
      if (amp < 0.4) return { steps: 0, still: true, trace: down(y, 5) };
      const minD = Math.round(0.28 * FS), cand = [];
      for (let i = 1; i < u.n - 1; i++) if (y[i] > y[i - 1] && y[i] >= y[i + 1] && y[i] > 0.35 * amp) cand.push(i);
      const steps = [];
      for (const i of cand) { if (steps.length && i - steps[steps.length - 1] < minD) { if (y[i] > y[steps[steps.length - 1]]) steps[steps.length - 1] = i; } else steps.push(i); }
      const iv = []; for (let k = 1; k < steps.length; k++) iv.push((steps[k] - steps[k - 1]) / FS);
      const step = U.median(iv) || 0.55;
      // Autocorrelation: how alike each step and each stride (two steps) are.
      const ac = (lag) => { let a = 0, b = 0, c = 0; for (let i = 0; i + lag < u.n; i++) { a += y[i] * y[i + lag]; b += y[i] * y[i]; c += y[i + lag] * y[i + lag]; } return a / Math.sqrt(b * c || 1); };
      const peakNear = (L) => { let best = -1; for (let lag = Math.round(L * 0.8); lag <= Math.round(L * 1.2); lag++) best = Math.max(best, ac(lag)); return best; };
      const stepReg = peakNear(step * FS), strideReg = peakNear(2 * step * FS);
      const cv = iv.length > 3 ? U.sd(iv.filter((v) => v < 2 * step && v > 0.5 * step)) / step : null;
      return { steps: steps.length, cadence: 60 / step, stepReg, strideReg, cv, stepTimes: steps.map((i) => i / FS), trace: down(y, 5) };
    }

    // ---------- Made-up recordings, for tests and the example ----------
    function synth(kind, o = {}) {
      const r = U.rng(o.seed || 1), dur = o.dur || 30, rate = o.rate || 60, n = Math.round(dur * rate);
      const s = { t: [], ax: [], ay: [], az: [], lx: [], ly: [], lz: [] };
      let ph = 0, wrap = 0, sf = 1;
      for (let i = 0; i < n; i++) {
        const t = i / rate + 0.002 * r();
        let g = [0, 0, G], lin = [0.02 * U.gauss(r), 0.02 * U.gauss(r), 0.02 * U.gauss(r)];
        if (kind === 'tremor') {
          const a = Math.pow(2 * Math.PI * o.hz, 2) * (o.mm || 0) / 1000;
          lin[0] += a * Math.sin(2 * Math.PI * o.hz * t); lin[1] += 0.4 * a * Math.sin(2 * Math.PI * o.hz * t + 1);
          lin[2] += 0.3 * Math.sin(2 * Math.PI * 0.4 * t);
        } else if (kind === 'chair') {
          // Thigh swings from flat (sitting) to upright (standing) once per cycle.
          const cyc = 30 / (o.stands || 12);
          // Starts seated, as the test does: the first stand begins after 40% of a cycle.
          const x = ((t + 0.6 * cyc) % cyc) / cyc, up = x < 0.15 ? x / 0.15 : x < 0.45 ? 1 : x < 0.6 ? 1 - (x - 0.45) / 0.15 : 0;
          const th = (5 + 75 * (0.5 - 0.5 * Math.cos(Math.PI * up))) * Math.PI / 180;
          g = [G * Math.sin(th), 0, G * Math.cos(th)];
          lin[0] += 1.2 * Math.sin(2 * Math.PI * t / cyc * 2) * up;
        } else if (kind === 'walk') {
          // Each step gets its own length, as in real walking.
          if (ph >= wrap) { wrap += Math.PI; sf = Math.max(0.5, 1 + (o.jitter || 0.03) * U.gauss(r)); }
          ph += (2 * Math.PI * (o.cadence || 108) / 60 / rate) / 2 * sf;
          lin[2] += 2.2 * Math.sin(2 * ph) + 0.8 * Math.sin(4 * ph + 0.5) + (o.limp || 0.3) * Math.sin(ph);
          lin[0] += 0.8 * Math.sin(ph);
        } else if (kind === 'balance') {
          const sway = (o.sway || 1) * Math.PI / 180;
          const th = sway * Math.sin(2 * Math.PI * 0.3 * t) + (o.stepAt != null && t > o.stepAt ? 0.6 : 0);
          g = [G * Math.sin(th), 0, G * Math.cos(th)];
          if (o.stepAt != null && Math.abs(t - o.stepAt) < 0.15) lin[2] += 7;
        }
        s.t.push(t); s.ax.push(g[0] + lin[0]); s.ay.push(g[1] + lin[1]); s.az.push(g[2] + lin[2]);
        s.lx.push(kind === 'tremor' ? lin[0] : NaN); s.ly.push(kind === 'tremor' ? lin[1] : NaN); s.lz.push(kind === 'tremor' ? lin[2] : NaN);
      }
      return s;
    }

    return { FS, uniform, filt, tremor, balance, chairStand, chairNorm, walking, synth };
  })();

