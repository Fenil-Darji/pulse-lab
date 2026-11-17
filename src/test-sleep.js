module.exports = (VX, ok) => {
  const S = VX.sleep, U = VX.U;
  let t0 = Date.now();
  const ex = S.makeExample();
  const r = S.analyze(ex.env);
  ok('sleep: example night analysed quickly', Date.now() - t0 < 3000, (Date.now() - t0) + ' ms');
  ok('sleep: pauses found match pauses planted', Math.abs(r.pauses.length - ex.truth.pauses) <= 0.1 * ex.truth.pauses + 1, r.pauses.length + ' found, ' + ex.truth.pauses + ' planted');
  const want = ex.truth.snoreSec - ex.truth.pauseSec;
  ok('sleep: snoring time (pauses excluded) close to planted', Math.abs(r.snoreSec - want) < 0.15 * want, Math.round(r.snoreSec) + ' s vs ' + Math.round(want) + ' s');
  ok('sleep: pause lengths inside 10 to 90 s', r.pauses.every((p) => p.len >= 10 && p.len <= 90));
  ok('sleep: assessable', r.assessable && r.band !== 'quiet', r.band + ', ' + r.pph.toFixed(1) + '/h');

  const snoreOnly = S.makeExample({ pauses: false, seed: 11 });
  const r2 = S.analyze(snoreOnly.env);
  ok('sleep: steady snoring gives few pauses', r2.pph < 1.5 && r2.band === 'few', r2.pauses.length + ' pauses, ' + r2.pph.toFixed(2) + '/h');

  const rng = U.rng(3), n = 2 * 3600 * S.FS, quiet = new Float32Array(n);
  for (let i = 0; i < n; i++) quiet[i] = 0.002 * Math.exp(0.08 * U.gauss(rng));
  const r3 = S.analyze(quiet);
  ok('sleep: silent room is reported as too quiet, not as healthy', r3.band === 'quiet' && r3.pauses.length === 0, 'snore ' + Math.round(r3.snoreSec) + ' s');

  // A fan that switches on (background jumps 15 dB) must not create pauses or snoring.
  const fan = new Float32Array(n);
  for (let i = 0; i < n; i++) fan[i] = (i > n / 2 ? 0.011 : 0.002) * Math.exp(0.08 * U.gauss(rng));
  const r4 = S.analyze(fan);
  ok('sleep: fan switching on is not snoring', r4.pauses.length === 0 && r4.snoreSec < 60, 'snore ' + Math.round(r4.snoreSec) + ' s');

  // Talking: irregular bursts of 0.2 to 3 s with irregular gaps.
  const talk = new Float32Array(n);
  for (let i = 0; i < n; i++) talk[i] = 0.002 * Math.exp(0.08 * U.gauss(rng));
  for (let t = 60; t < 1500;) { const len = 0.2 + 2.8 * rng(); for (let k = Math.round(t * S.FS); k < (t + len) * S.FS; k++) talk[k] = 0.03; t += len + 0.2 + 1.2 * rng(); }
  const r5 = S.analyze(talk);
  ok('sleep: 24 minutes of talking is not a night of apnoea', r5.pauses.length <= 1, r5.pauses.length + ' pauses, snore ' + Math.round(r5.snoreSec) + ' s');

  const short = S.analyze(S.makeExample({ hours: 0.05, quiet: false, seed: 5 }).env);
  ok('sleep: three-minute recording does not crash', short.dur > 100 && isFinite(short.pph), short.pauses.length + ' pauses');
  ok('sleep: empty recording does not crash', S.analyze(new Float32Array(0)).pauses.length === 0);
};
