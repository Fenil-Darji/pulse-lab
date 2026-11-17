// Signal processing for the Sleep, Cough, Hearing, Vision and Movement tabs. No page access in here, so it can be tested on its own.
const VX = (() => {
  const U = {};
  U.median = (a) => { if (!a.length) return 0; const s = Array.from(a).sort((x, y) => x - y); return s[s.length >> 1]; };
  U.pct = (a, p) => { if (!a.length) return 0; const s = Array.from(a).sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
  U.mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; };
  U.sd = (a) => { const m = U.mean(a); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return a.length > 1 ? Math.sqrt(s / (a.length - 1)) : 0; };
  U.rms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return a.length ? Math.sqrt(s / a.length) : 0; };
  U.db = (x) => 20 * Math.log10(Math.max(x, 1e-7));
  U.rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  U.gauss = (r) => Math.sqrt(-2 * Math.log(Math.max(1e-12, r()))) * Math.cos(2 * Math.PI * r());
  U.fmtDur = (sec) => {
    const s = Math.round(sec);
    if (s < 90) return s + ' s';
    if (s < 5400) return Math.round(s / 60) + ' min';
    return Math.floor(s / 3600) + ' h ' + String(Math.round((s % 3600) / 60)).padStart(2, '0') + ' min';
  };

  // ================= Microphone: loudness in two bands, 50 times a second =================
  // Self-contained on purpose: the page runs it through toString() inside an audio worklet.
  function BandSplitter(sr) {
    const bq = (type, f, q) => {
      const w = 2 * Math.PI * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
      const b0 = (type === 'lp' ? (1 - c) / 2 : (1 + c) / 2), b1 = (type === 'lp' ? 1 - c : -(1 + c));
      return { b0: b0 / a0, b1: b1 / a0, b2: b0 / a0, a1: -2 * c / a0, a2: (1 - al) / a0, z1: 0, z2: 0 };
    };
    const run = (f, x) => { const y = f.b0 * x + f.z1; f.z1 = f.b1 * x - f.a1 * y + f.z2; f.z2 = f.b2 * x - f.a2 * y; return y; };
    const hp = bq('hp', 120, 0.707), lo = bq('lp', 1000, 0.707), hi1 = bq('hp', 1000, 0.707), hi2 = bq('lp', Math.min(4000, sr * 0.45), 0.707);
    const N = Math.max(1, Math.round(sr / 50));
    let k = 0, sl = 0, sh = 0;
    this.push = (x, out) => {
      const v = run(hp, x), a = run(lo, v), b = run(hi2, run(hi1, v));
      sl += a * a; sh += b * b;
      if (++k >= N) { out.push(Math.sqrt(sl / k), Math.sqrt(sh / k)); k = 0; sl = 0; sh = 0; }
    };
  }
  const audio = {
    RATE: 50,
    BandSplitter,
    // Whole recording in, interleaved [low, high] loudness frames out.
    bands(samples, sr) { const s = new BandSplitter(sr), out = []; for (let i = 0; i < samples.length; i++) s.push(samples[i], out); return Float32Array.from(out); },
    workletSource() {
      return BandSplitter.toString() + `
class VXBands extends AudioWorkletProcessor {
  constructor() { super(); this.s = new BandSplitter(sampleRate); this.out = []; }
  process(inputs) {
    const x = inputs[0] && inputs[0][0];
    if (x) for (let i = 0; i < x.length; i++) this.s.push(x[i], this.out);
    if (this.out.length >= 50) { this.port.postMessage(new Float32Array(this.out)); this.out = []; }
    return true;
  }
}
registerProcessor('vx-bands', VXBands);`;
    }
  };

  const api = { U, audio };
  //@@SECTIONS@@
  return api;
})();
if (typeof module !== 'undefined') module.exports = VX;
