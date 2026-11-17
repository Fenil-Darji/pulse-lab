module.exports = (VX, ok) => {
  const H = VX.hearing, U = VX.U;
  const errs = [], trials = [];
  const r = U.rng(5);
  for (let i = 0; i < 400; i++) {
    const T = -95 + 75 * r();
    // The first tone starts at -40 dB; later tones start 15 dB above the previous threshold, as the page does.
    const s = H.runSim(T, i % 6 === 0 ? -40 : T + 15 + 8 * (r() - 0.5), { seed: 100 + i });
    if (T < H.MAX - 3 && s.thr != null) errs.push(s.thr - T);
    trials.push(s.trials);
  }
  const abs = errs.map(Math.abs);
  ok('hearing: threshold found within 5 dB on average', U.mean(abs) < 5, 'mean error ' + U.mean(abs).toFixed(1) + ' dB, bias ' + U.mean(errs).toFixed(1));
  ok('hearing: 9 in 10 thresholds within 8 dB', U.pct(abs, 0.9) <= 8, '90th percentile ' + U.pct(abs, 0.9).toFixed(1) + ' dB');
  ok('hearing: about 9 presentations per tone, as in clinic', U.mean(trials) <= 10, 'mean ' + U.mean(trials).toFixed(1) + ', max ' + Math.max(...trials));
  const deaf = H.runSim(0, -40, { seed: 3, fa: 0 });
  ok('hearing: tone never heard gives no threshold', deaf.thr === null, deaf.trials + ' presentations');
  const sharp = H.runSim(-120, -40, { seed: 4, fa: 0, lapse: 0 });
  ok('hearing: very good ear stops at the quietest level', sharp.thr === H.MIN);
  const guesser = H.runSim(-60, -40, { seed: 6, fa: 0.5 });
  ok('hearing: frequent guessing still ends', guesser.trials <= 18);

  const norm = { R: { 500: -80, 1000: -85, 2000: -85, 4000: -80, 6000: -70 }, L: { 500: -80, 1000: -85, 2000: -80, 4000: -80, 6000: -75 } };
  const ref = H.makeRef(norm);
  ok('hearing: good listener makes a valid reference', ref.ok);
  const same = H.summarize(norm, ref.ref);
  ok('hearing: reference listener grades as normal', same.grade.name === 'Normal hearing' && !same.asym, same.better.toFixed(1) + ' dB');
  const oneSide = { R: { 500: -80, 1000: -85, 2000: -85, 4000: -80, 6000: -70 }, L: { 500: -40, 1000: -45, 2000: -40, 4000: -35, 6000: -30 } };
  const s2 = H.summarize(oneSide, ref.ref);
  ok('hearing: one bad ear is flagged as uneven', s2.asym && s2.worseEar === 'L' && s2.unilateral, 'difference ' + s2.earDiff.toFixed(0) + ' dB');
  const both = { R: { 500: -40, 1000: -45, 2000: -45, 4000: -35, 6000: null }, L: { 500: -40, 1000: -40, 2000: -45, 4000: -40, 6000: null } };
  const s3 = H.summarize(both, ref.ref);
  ok('hearing: loss in both ears is graded', s3.grade.name === 'Moderate hearing loss' && !s3.asym, s3.better.toFixed(1) + ' dB, ' + s3.grade.name);
  const noRef = H.summarize(oneSide, null);
  ok('hearing: without a reference, the ear difference still works', noRef.asym && !noRef.grade);
};
