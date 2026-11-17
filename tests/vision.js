module.exports = (VX, ok) => {
  const V = VX.vision, U = VX.U;
  ok('vision: 6/6 letter at 6 m is 8.7 mm tall', Math.abs(V.heightMm(0, 6) - 8.73) < 0.02, V.heightMm(0, 6).toFixed(2) + ' mm');
  ok('vision: 6/60 letter at 3 m is 43.6 mm tall', Math.abs(V.heightMm(1, 3) - 43.6) < 0.2, V.heightMm(1, 3).toFixed(1) + ' mm');
  ok('vision: print sizes at 40 cm', V.nPoint(0.3) === 'N6' && V.nPoint(0.4) === 'N8' && V.nPoint(1) === 'N36' && V.nPoint(0) === 'N5 or smaller', [0, 0.3, 0.4, 1].map(V.nPoint).join(' '));
  ok('vision: Snellen labels', V.snellen(0.3) === '6/12' && V.snellen(0) === '6/6' && V.snellen(null) === 'worse than 6/60');
  const r = U.rng(8), errs = [], shown = [];
  for (let i = 0; i < 400; i++) {
    const T = -0.1 + 1.05 * r();
    const s = V.simulate(T, { seed: 50 + i });
    if (s.result != null) errs.push(s.result - T);
    shown.push(s.shown);
  }
  const abs = errs.map(Math.abs);
  ok('vision: acuity found within one line on average', U.mean(abs) <= 0.1, 'mean error ' + U.mean(abs).toFixed(3) + ' logMAR, bias ' + U.mean(errs).toFixed(3));
  ok('vision: 9 in 10 within 0.15 logMAR', U.pct(abs, 0.9) <= 0.151, U.pct(abs, 0.9).toFixed(2));
  ok('vision: about 20 Es per eye', U.mean(shown) <= 24, 'mean ' + U.mean(shown).toFixed(1) + ', max ' + Math.max(...shown));
  ok('vision: cannot see the largest line', V.simulate(1.6, { seed: 2 }).result === null);
  ok('vision: excellent eye stops at the smallest line', V.simulate(-0.5, { seed: 3 }).result === -0.1);
  ok('vision: WHO categories', V.whoDistance(0.2).q === 'good' && V.whoDistance(0.4).name === 'Mild vision impairment' && V.whoDistance(0.7).name === 'Moderate vision impairment' && V.whoDistance(null).q === 'poor');
  ok('vision: referral 6/12 adult, 6/9 child', !V.refer(0.3, false) && V.refer(0.4, false) && V.refer(0.3, true) && !V.refer(0.2, true));

  for (const p of V.PLATES.filter((p) => p.type !== 'demo')) {
    const c = V.plateColours(p);
    const seenNormal = V.dE(c.fig, c.bg), seenBy = V.dE(V.dichromat(c.fig, p.type), V.dichromat(c.bg, p.type));
    ok('vision: ' + p.type + ' plate (target ' + p.target + ') visible to normal colour vision, hidden from ' + p.type + 'opes',
      seenNormal >= 0.75 * p.target && seenBy < 1.5 && c.fig.every((v) => v >= 0 && v <= 1), 'normal ΔE ' + seenNormal.toFixed(1) + ', dichromat ΔE ' + seenBy.toFixed(2));
  }
  const cr = V.colourResult([{ type: 'demo', ok: true }, { type: 'protan', ok: true }, { type: 'deutan', ok: false }, { type: 'protan', ok: true }, { type: 'deutan', ok: false }, { type: 'deutan', ok: false }]);
  ok('vision: deutan misses read as green deficiency', cr.suspect && cr.kind.startsWith('green'), cr.kind);
};
