  // ================= Cough: explosive sounds in the two-band loudness stream =================
  api.cough = (() => {
    const FR = 50;                       // loudness frames per second (from audio.BandSplitter)
    const ON = 12, OFF = 6;              // dB above background to start and end a sound
    const MERGE = 4;                     // frames of quiet (80 ms) that end a sound
    const PRE = 10, PRE_MAX = 9;         // the 0.2 s before a cough must stay below 9 dB
    const DUR = [0.14, 0.75];            // seconds
    const PEAK_BY = 2;                   // from first sound to loudest frame in at most 2 frames (40 ms)
    const RISE = 12;                     // dB jump from just before the sound to its peak
        const HF_MIN = -13;                  // high band within 13 dB of the low band at the peak: rough, noisy sound
    const BOUT = 2;                      // coughs less than 2 s apart form one bout

    // Streaming, so it can run all night inside the Sleep recording without keeping the frames.
    function Detector(log) {
      const RING = 1500, ring = new Float32Array(RING);
      let rn = 0, floor = 0, ev = null, quiet = 0, n = 0, lastCough = -99, top = 0;
      const hist = [];
      const coughs = [], why = { short: 0, long: 0, slow: 0, dull: 0, busy: 0 };
      // A sound starts: walk back to the quiet point where its rise began.
      const start = (lvl, hf) => {
        let j = hist.length - 1, back = 0;
        while (j >= 0 && hist[j] >= 3 && hist[j] < (j === hist.length - 1 ? lvl : hist[j + 1])) { j--; back++; }
        const before = hist.slice(Math.max(0, j - PRE + 1), j + 1);
        ev = { a: n - 1 - back, lv: [lvl], hf: [hf], back, pre0: j >= 0 ? hist[j] : 0, preMax: before.length ? Math.max(...before) : 99, long: false };
        quiet = 0; top = lvl;
      };
      const finish = () => {
        const len = ev.lv.length - quiet, dur = (len + ev.back) / FR;
        let pk = 0;
        for (let i = 1; i < len; i++) if (ev.lv[i] > ev.lv[pk]) pk = i;
        const peak = ev.lv[pk];
        let tail = 0, tn = 0;
        for (let i = Math.ceil(len / 2); i < len; i++) { tail += ev.lv[i]; tn++; }
        tail = tn ? tail / tn : peak;
        let r;
        if (ev.long || dur > DUR[1]) r = 'long';
        else if (dur < DUR[0]) r = 'short';
        // A cough straight after another cough (a bout) may start on the first one's fading tail.
        else if (ev.preMax >= PRE_MAX && ev.a / FR - lastCough > 1.2) r = 'busy';
        else if (ev.back + pk > PEAK_BY || peak - ev.pre0 < RISE || tail > peak - 5) r = 'slow';
        else if (ev.hf[pk] < HF_MIN) r = 'dull';
        if (r) why[r]++;
        else { coughs.push({ t: ev.a / FR, peak, dur }); lastCough = (ev.a + ev.back + len) / FR; }
        if (log) log.push({ t: ev.a / FR, r: r || 'COUGH', dur: +dur.toFixed(2), rise: ev.back + pk, peak: +peak.toFixed(1), from: +ev.pre0.toFixed(1), tailDrop: +(peak - tail).toFixed(1), hf: +ev.hf[pk].toFixed(1), preMax: +ev.preMax.toFixed(1) });
        ev = null; quiet = 0;
      };
      this.coughs = coughs; this.why = why;
      this.frames = () => n;
      this.push = (lo, hi) => {
        const tot = U.db(Math.sqrt(lo * lo + hi * hi)), hf = U.db(hi) - U.db(lo);
        ring[rn % RING] = tot; rn++; n++;
        if (rn === 1 || rn % 50 === 0) { const srt = ring.slice(0, Math.min(rn, RING)).sort(); floor = srt[Math.floor(0.15 * (srt.length - 1))]; }
        const lvl = tot - floor;
        if (!ev) {
          if (lvl >= ON && n > FR) start(lvl, hf);
        } else {
          const L = ev.lv.length;
          // A second sharp burst inside one sound, as in a cough bout: close the first, start the second.
          if (!ev.long && L >= 5) {
            const m = Math.min(ev.lv[L - 1], ev.lv[L - 2]);
            if (lvl - m >= 10 && m <= top - 8) {
              quiet = ev.lv[L - 1] < ev.lv[L - 2] ? 0 : 1;
              finish();
              start(lvl, hf);
              hist.push(lvl); if (hist.length > 60) hist.shift();
              return;
            }
          }
          if (L < DUR[1] * FR + MERGE + 2) { ev.lv.push(lvl); ev.hf.push(hf); top = Math.max(top, lvl); } else ev.long = true;
          if (lvl < OFF) { if (++quiet >= MERGE) finish(); } else quiet = 0;
        }
        hist.push(lvl); if (hist.length > 60) hist.shift();
      };
    }

    function summarize(coughs, dur) {
      let bouts = 0, last = -99;
      for (const c of coughs) { if (c.t - last > BOUT) bouts++; last = c.t; }
      // Busiest 10 minutes
      let best = 0, bestT = 0, j = 0;
      for (let i = 0; i < coughs.length; i++) {
        while (coughs[i].t - coughs[j].t > 600) j++;
        if (i - j + 1 > best) { best = i - j + 1; bestT = coughs[j].t; }
      }
      return { dur, count: coughs.length, bouts, rate: dur > 0 ? coughs.length / (dur / 3600) : 0, busiest: best, busiestT: bestT };
    }

    function analyze(frames) {
      const d = new Detector();
      for (let k = 0; k + 1 < frames.length; k += 2) d.push(frames[k], frames[k + 1]);
      return Object.assign(summarize(d.coughs, d.frames() / FR), { coughs: d.coughs, why: d.why });
    }

    // ---------- Made-up sound, as the detector sees it (two-band loudness at 50 frames a second) ----------
    function synth(o = {}) {
      const sec = o.seconds || 600, n = Math.round(sec * FR), r = U.rng(o.seed || 1);
      const pl = new Float64Array(n), ph = new Float64Array(n), base = 0.002;
      for (let i = 0; i < n; i++) { const a = base * Math.exp(0.12 * U.gauss(r)); pl[i] = a * a * 0.8; ph[i] = a * a * 0.2; }
      // Adds a sound whose amplitude follows env(t) (t in seconds from start, null when over), with a high/low band ratio in dB.
      const add = (t0, env, hfDb) => {
        const g = Math.pow(10, hfDb / 20), fl = 1 / (1 + g * g), fh = g * g / (1 + g * g);
        for (let i = Math.floor(t0 * FR); i < n; i++) {
          let e2 = 0, cnt = 0, over = true;
          for (let s = 0; s < 20; s++) {
            const t = (i + s / 20) / FR - t0;
            if (t < 0) { cnt++; continue; }
            const a = env(t);
            if (a !== null) { over = false; e2 += a * a; } cnt++;
          }
          if (over && (i + 1) / FR - t0 > 0) break;
          const p = base * base * e2 / cnt;
          pl[i] += p * fl; ph[i] += p * fh;
        }
      };
      const amp = (dB) => Math.pow(10, dB / 20);
      const events = { coughs: [], speech: 0, other: 0 };
      const cough = (t0, dB) => {
        const A = amp(dB), tau = 0.08 + 0.08 * r(), voiced = r() < 0.5, hf = -5 + 3 * U.gauss(r);
        add(t0, (t) => (t > 0.6 ? null : (t < 0.025 ? A * t / 0.025 : A * Math.exp(-(t - 0.025) / tau))), hf);
        if (voiced) add(t0 + 0.08, (t) => (t > 0.25 ? null : A * 0.35 * Math.sin(Math.PI * t / 0.25)), -16);
        events.coughs.push(t0);
      };
      const syllable = (t0, len, dB, hf, rise) => {
        const A = amp(dB);
        add(t0, (t) => (t > len ? null : A * Math.pow(Math.sin(Math.PI * Math.min(t / rise, 1, (len - t) / 0.06) / 2), 2)), hf);
      };
      const phrase = (t0) => {
        let t = t0;
        const end = t0 + 0.6 + 3.4 * r(), dB = 15 + 10 * r();
        while (t < end) {
          const fric = r() < 0.2, len = 0.12 + 0.14 * r();
          syllable(t, len, dB + 4 * U.gauss(r), fric ? -3 + 2 * U.gauss(r) : -16 + 4 * U.gauss(r), fric ? 0.09 : 0.05 + 0.04 * r());
          t += len + 0.03 + 0.06 * r();
        }
        events.speech++;
        return t;
      };
      let t = 2;
      const kinds = o.kinds || ['cough', 'bout', 'speech', 'speech', 'speech', 'clap', 'snore'];
      while (t < sec - 6) {
        const k = kinds[Math.floor(r() * kinds.length)];
        if (k === 'cough') { cough(t, 18 + 14 * r()); t += 1; }
        else if (k === 'bout') { const m = 2 + Math.floor(4 * r()); for (let j = 0; j < m; j++) { cough(t, 18 + 14 * r()); t += 0.45 + 0.35 * r(); } }
        else if (k === 'speech') { const m = 1 + Math.floor(4 * r()); for (let j = 0; j < m; j++) t = phrase(t) + 0.3 + 1.2 * r(); }
        else if (k === 'clap') { const A = amp(25 + 10 * r()); add(t, (x) => (x > 0.05 ? null : A * Math.exp(-x / 0.012)), -2); events.other++; t += 0.5; }
        else if (k === 'snore') { const A = amp(14 + 8 * r()); add(t, (x) => (x > 1.1 ? null : A * Math.sin(Math.PI * x / 1.1)), -18); events.other++; t += 1.5; }
        t += (o.gap || 4) * (0.3 + 1.4 * r());
      }
      const frames = new Float32Array(2 * n);
      for (let i = 0; i < n; i++) { frames[2 * i] = Math.sqrt(pl[i]); frames[2 * i + 1] = Math.sqrt(ph[i]); }
      return { frames, events };
    }

    return { FR, Detector, analyze, summarize, synth, BOUT };
  })();

