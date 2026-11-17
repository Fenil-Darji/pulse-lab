module.exports = (VX, ok) => {
  const M = VX.movement;
  const t1 = M.tremor(M.synth('tremor', { hz: 5, mm: 0.5, dur: 20 }));
  ok('movement: 5 Hz tremor found at the right rate', Math.abs(t1.hz - 5) <= 0.2, t1.hz + ' Hz');
  ok('movement: tremor size close to true', Math.abs(t1.dispMm - 0.5) < 0.12 && t1.level === 'mild', t1.dispMm.toFixed(2) + ' mm, ' + t1.level);
  const t2 = M.tremor(M.synth('tremor', { hz: 9, mm: 2, dur: 20, seed: 2 }));
  ok('movement: large 9 Hz tremor is marked', Math.abs(t2.hz - 9) <= 0.2 && t2.level === 'marked', t2.hz + ' Hz, ' + t2.dispMm.toFixed(2) + ' mm');
  const t3 = M.tremor(M.synth('tremor', { hz: 6, mm: 0, dur: 20, seed: 3 }));
  ok('movement: steady hand shows no clear tremor', t3.level === 'none', t3.dispMm.toFixed(3) + ' mm, concentration ' + t3.conc.toFixed(2));
  const t4 = M.tremor(M.synth('tremor', { hz: 6, mm: 0.6, dur: 20, rate: 100, seed: 4 }));
  ok('movement: works at 100 samples a second too', Math.abs(t4.hz - 6) <= 0.2);

  for (const n of [8, 12, 15]) {
    const c = M.chairStand(M.synth('chair', { stands: n, seed: n }));
    ok('movement: ' + n + ' chair stands counted', c.count === n, c.count + ' counted, thigh swing ' + Math.round(c.maxDeg) + '°');
  }
  const flat = M.chairStand(M.synth('balance', { sway: 1 }));
  ok('movement: phone not in a pocket gives no count, not zero', flat.count === null && flat.why === 'flat');
  ok('movement: STEADI chair norms', M.chairNorm(72, 'f') === 10 && M.chairNorm(66, 'm') === 12 && M.chairNorm(95, 'f') === 4 && M.chairNorm(50, 'm') === null);

  const w = M.walking(M.synth('walk', { cadence: 108, dur: 30 }));
  ok('movement: walking cadence', Math.abs(w.cadence - 108) < 4, Math.round(w.cadence) + ' steps/min, ' + w.steps + ' steps');
  ok('movement: steady walking is regular', w.strideReg > 0.7, 'stride regularity ' + w.strideReg.toFixed(2));
  const wi = M.walking(M.synth('walk', { cadence: 96, dur: 30, jitter: 0.25, seed: 5 }));
  ok('movement: unsteady walking is less regular', wi.strideReg < w.strideReg - 0.15, wi.strideReg.toFixed(2) + ' vs ' + w.strideReg.toFixed(2));
  const still = M.walking(M.synth('balance', { sway: 0.5 }));
  ok('movement: standing still is not walking', still.still === true);

  const b1 = M.balance(M.synth('balance', { sway: 1, dur: 10 }));
  ok('movement: steady stance held 10 s', b1.held >= 9.9 && b1.lost == null, 'sway ' + b1.swayDeg.toFixed(2) + '°');
  const b2 = M.balance(M.synth('balance', { sway: 1.5, dur: 10, stepAt: 6.2, seed: 2 }));
  ok('movement: stepping out ends the stance', b2.lost != null && Math.abs(b2.lost - 6.2) < 0.4, 'lost at ' + (b2.lost || 0).toFixed(2) + ' s');
};
