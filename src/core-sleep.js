  // ================= Sleep: snoring and pauses in breathing from loudness =================
  api.sleep = (() => {
    const FS = 10;                 // loudness values per second
    const ON = 6, OFF = 3;         // dB above the room's background to start and end a sound
    const BREATH = [0.3, 4];       // seconds: how long one snore or loud breath lasts
    const LINK = [2, 8];           // seconds between breaths that count as a steady rhythm
    const PAUSE = [10, 90];        // seconds of silence that count as a pause in breathing

    function analyze(env) {
      const n = env.length, dur = n / FS;
      const dB = new Float32Array(n);
      for (let i = 0; i < n; i++) dB[i] = U.db(env[i]);
      // Background level: the quiet end of each minute, smoothed over five minutes.
      const BL = 60 * FS, nb = Math.max(1, Math.ceil(n / BL));
      const raw = [];
      for (let b = 0; b < nb; b++) {
        const seg = dB.subarray(b * BL, Math.min(n, (b + 1) * BL));
        raw.push(seg.length >= 10 * FS || !raw.length ? U.pct(seg, 0.15) : raw[raw.length - 1]);
      }
      const floor = raw.map((_, b) => U.median(raw.slice(Math.max(0, b - 2), b + 3)));
      const lvl = new Float32Array(n);
      for (let i = 0; i < n; i++) lvl[i] = dB[i] - floor[Math.min(nb - 1, (i / BL) | 0)];

      // Sounds: stretches that rise above the background.
      const ev = [];
      let s = -1, peak = 0;
      for (let i = 0; i <= n; i++) {
        const v = i < n ? lvl[i] : -99;
        if (s < 0) { if (v >= ON) { s = i; peak = v; } }
        else if (v < OFF) {
          const last = ev[ev.length - 1];
          if (last && s - last.b <= 0.3 * FS) { last.b = i; last.peak = Math.max(last.peak, peak); }
          else ev.push({ a: s, b: i, peak });
          s = -1;
        } else if (v > peak) peak = v;
      }
      let noiseSec = 0;
      for (const e of ev) {
        const len = (e.b - e.a) / FS;
        e.kind = len > BREATH[1] ? 'noise' : (len >= BREATH[0] ? 'breath' : 'click');
        if (e.kind === 'noise') noiseSec += len;
      }

      // Rhythm: chains of breath sounds spaced like breathing. Anything long and loud breaks the chain.
      const chains = [];
      let cur = null;
      const close = () => { if (cur && cur.length >= 2) chains.push(cur); cur = null; };
      for (const e of ev) {
        if (e.kind === 'noise') { close(); continue; }
        if (e.kind !== 'breath') continue;
        if (cur) {
          const d = (e.a - cur[cur.length - 1].a) / FS;
          if (d >= LINK[0] && d <= LINK[1]) { cur.push(e); continue; }
          if (d < LINK[0]) continue;       // an extra sound inside one breath
          close();
        }
        cur = [e];
      }
      close();
      const strong = chains.filter((c) => c.length >= 3);
      const segs = strong.map((c) => ({ t0: c[0].a / FS, t1: c[c.length - 1].b / FS, breaths: c.length }));
      let snoreSec = 0;
      for (const g of segs) snoreSec += g.t1 - g.t0;

      // Pauses: steady breathing, then silence, then breathing again, with no other noise in between.
      const pauses = [];
      for (let k = 0; k + 1 < chains.length; k++) {
        const A = chains[k], B = chains[k + 1];
        if (A.length < 3) continue;
        const t0 = A[A.length - 1].b / FS, t1 = B[0].a / FS, len = t1 - t0;
        if (len < PAUSE[0] || len > PAUSE[1]) continue;
        if (ev.some((e) => e.kind === 'noise' && e.a / FS < t1 && e.b / FS > t0)) continue;
        pauses.push({ t0, t1, len });
      }
      const hours = dur / 3600;
      const assessable = snoreSec >= 30 && snoreSec >= Math.min(600, 0.2 * dur);
      const pph = hours > 0 ? pauses.length / hours : 0;
      const band = !assessable ? 'quiet' : (pph >= 15 ? 'many' : pph >= 5 ? 'some' : 'few');

      // Timeline for the chart: the loud end of every 30 seconds.
      const step = dur > 1800 ? 30 : (dur > 300 ? 5 : 1), W = step * FS;
      const tl = { t: [], y: [], step };
      for (let i = 0; i + W <= n; i += W) { tl.t.push((i + W / 2) / FS); tl.y.push(Math.max(0, U.pct(lvl.subarray(i, i + W), 0.9))); }

      return {
        dur, hours, snoreSec, snoreFrac: dur ? snoreSec / dur : 0, segs, pauses,
        pph, longest: pauses.reduce((m, p) => Math.max(m, p.len), 0),
        assessable, band, noiseFrac: dur ? noiseSec / dur : 0,
        floorDb: U.median(floor), floorSpread: U.pct(floor, 0.95) - U.pct(floor, 0.05), timeline: tl
      };
    }

    // A made-up night: stretches of quiet sleep and snoring, some with pauses followed by loud recovery breaths.
    function makeExample(o = {}) {
      const hours = o.hours || 6.5, n = Math.round(hours * 3600 * FS), r = U.rng(o.seed || 7);
      const p2 = new Float32Array(n), base = 0.0016;
      for (let i = 0; i < n; i++) { const a = base * (1 + 0.25 * Math.sin(i / (FS * 900))) * Math.exp(0.05 * U.gauss(r)); p2[i] = a * a; }
      const burst = (t, len, dB) => {
        const a = base * Math.pow(10, dB / 20), i0 = Math.round(t * FS), m = Math.max(2, Math.round(len * FS));
        for (let k = 0; k < m && i0 + k < n; k++) { const w = Math.sin(Math.PI * (k + 0.5) / m); p2[i0 + k] += a * a * w * w; }
      };
      const truth = { pauses: 0, snoreSec: 0, pauseSec: 0 };
      let t = o.quiet === false ? 5 : 20 * 60 * (0.6 + 0.6 * r());
      const end = hours * 3600 - 60;
      let segNo = 0;
      while (t < end) {
        const segEnd = Math.min(end, t + 60 * (8 + 32 * r()));
        const apnoeic = o.pauses !== false && (segNo % 2 === 0);
        const period = 3.4 + 1.2 * r(), loud = 12 + 9 * r();
        const start = t;
        let run = 0, runMax = 4 + Math.floor(6 * r());
        while (t < segEnd) {
          burst(t, 1.0 + 0.6 * r(), loud + 2 * U.gauss(r));
          t += period * (1 + 0.06 * U.gauss(r));
          if (apnoeic && ++run >= runMax && t + 60 < segEnd) {
            const pl = 12 + 28 * r(); t += pl; truth.pauses++; truth.pauseSec += pl;
            for (let j = 0; j < 3; j++) { burst(t, 1.3, loud + 7); t += period * 0.85; }
            run = 0; runMax = 4 + Math.floor(6 * r());
          }
        }
        truth.snoreSec += t - start;
        if (r() < 0.6) burst(t + 20, 6 + 8 * r(), 16);   // turning over in bed
        t += 60 * (o.quiet === false ? 1 : 5 + 25 * r());
        segNo++;
      }
      const env = new Float32Array(n);
      for (let i = 0; i < n; i++) env[i] = Math.sqrt(p2[i]);
      return { env, truth };
    }

    return { FS, analyze, makeExample };
  })();

