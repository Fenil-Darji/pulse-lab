module.exports = (VX, ok) => {
  const C = VX.cough;
  const match = (found, truth, tol = 0.25) => {
    let hit = 0; const used = new Set();
    for (const t of truth) {
      const k = found.findIndex((c, i) => !used.has(i) && Math.abs(c.t - t) < tol);
      if (k >= 0) { used.add(k); hit++; }
    }
    return { hit, extra: found.length - used.size };
  };

  const mixed = C.synth({ seconds: 1800, seed: 3 });
  const r = C.analyze(mixed.frames);
  const m = match(r.coughs, mixed.events.coughs);
  const sens = m.hit / mixed.events.coughs.length;
  ok('cough: finds most coughs in mixed sound', sens >= 0.85, m.hit + ' of ' + mixed.events.coughs.length + ' (' + Math.round(100 * sens) + '%)');
  ok('cough: few false coughs in mixed sound', m.extra <= Math.max(3, 0.08 * mixed.events.coughs.length), m.extra + ' extra; rejected ' + JSON.stringify(r.why));

  const speech = C.synth({ seconds: 1800, seed: 9, kinds: ['speech'], gap: 1.5 });
  const rs = C.analyze(speech.frames);
  ok('cough: 30 minutes of talking gives almost no coughs', rs.count <= 4, rs.count + ' false coughs in ' + speech.events.speech + ' phrases');

  const other = C.synth({ seconds: 1200, seed: 4, kinds: ['clap', 'snore'] });
  const ro = C.analyze(other.frames);
  ok('cough: claps, knocks and snores are not coughs', ro.count <= 2, ro.count + ' false coughs in ' + other.events.other + ' sounds');

  const bouts = C.synth({ seconds: 1200, seed: 12, kinds: ['bout'], gap: 8 });
  const rb = C.analyze(bouts.frames);
  const mb = match(rb.coughs, bouts.events.coughs);
  ok('cough: coughs inside bouts are counted separately', mb.hit / bouts.events.coughs.length >= 0.8, mb.hit + ' of ' + bouts.events.coughs.length + ', ' + rb.bouts + ' bouts');

  const quiet = C.analyze(new Float32Array(2 * 50 * 600).fill(0.002));
  ok('cough: silence gives no coughs', quiet.count === 0);
  ok('cough: empty input does not crash', C.analyze(new Float32Array(0)).count === 0);
};
