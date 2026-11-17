// A made-up person in 3D, seen by a made-up phone camera, checks the posture geometry.
// Person frame: x to the person's left, y up, z forward. Metres, origin between the shoulders.
module.exports = (VX, ok) => {
  const P = VX.posture;
  const rad = (d) => d * Math.PI / 180;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const rotX = (v, ang) => { const c = Math.cos(rad(ang)), s = Math.sin(rad(ang)); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };

  // o: posture { phi: head bent down (deg), fwd: head pushed forward (m), lean: trunk forward (deg) }
  function person(o = {}) {
    const pivot0 = [0, 0.06, -0.03];
    const nz = o.nose || 0.115;
    const headRel = { 7: [0.075, 0.13, 0], 8: [-0.075, 0.13, 0], 2: [0.032, 0.145, 0.09], 5: [-0.032, 0.145, 0.09], 0: [0, 0.13, nz] };
    const pts = { 11: [0.19, 0, 0], 12: [-0.19, 0, 0], 23: [0.14, -0.5, -0.03], 24: [-0.14, -0.5, -0.03] };
    const pivot = add(pivot0, [0, -0.3 * (o.fwd || 0), o.fwd || 0]);
    // Bending the head down turns its points about the neck so the nose drops and the crown moves forward.
    for (const k in headRel) pts[k] = add(pivot, rotX(headRel[k], o.phi || 0));
    if (o.lean) {
      const hip = [0, -0.5, -0.03];
      for (const k of [0, 2, 5, 7, 8, 11, 12]) pts[k] = add(hip, rotX(sub(pts[k], hip), o.lean));
    }
    return pts;
  }
  // Camera: pos (m), looking toward `look` with elevation applied, roll about its axis. Returns landmarks and the phone's up vector.
  function shoot(pts, cam) {
    const w = cam.w || 960, h = cam.h || 1280, f = cam.f || 0.65 * Math.max(w, h);
    const e = rad(cam.elev || 0);
    const fl = cam.look;                                  // horizontal unit vector the camera faces
    const o = [fl[0] * Math.cos(e), Math.sin(e), fl[2] * Math.cos(e)];
    let u = [-fl[0] * Math.sin(e), Math.cos(e), -fl[2] * Math.sin(e)];
    let r = cross(o, u);
    const q = rad(cam.roll || 0);
    const r2 = [0, 1, 2].map(i => r[i] * Math.cos(q) + u[i] * Math.sin(q)), u2 = [0, 1, 2].map(i => -r[i] * Math.sin(q) + u[i] * Math.cos(q));
    r = r2; u = u2;
    const lm = [];
    for (let i = 0; i < 33; i++) lm.push({ x: -5, y: -5, visibility: 0 });
    for (const k in pts) {
      const v = sub(pts[k], cam.pos), zc = dot(v, o);
      const vis = cam.hide && cam.hide.includes(+k) ? 0.2 : 0.99;
      lm[k] = { x: (w / 2 + f * dot(v, r) / zc) / w, y: (h / 2 - f * dot(v, u) / zc) / h, visibility: vis };
    }
    // Phone axes: z out of the screen = camera direction; y = picture up; x = minus picture right (front camera).
    const up = [0, 1, 0], xd = r.map(v => -v);
    return { lm, w, h, f, up: [dot(up, xd), dot(up, u), dot(up, o)] };
  }
  // Camera in front at eye level, d metres away, raised by dh (m) and pointed at the face.
  const front = (o) => ({ pos: [0, 0.19 + (o.dh || 0), o.d || 0.8], look: [0, 0, -1], elev: o.elev || 0, roll: o.roll || 0, w: o.w, h: o.h });
  const run = (posture, cam, mode = 'front') => {
    const s = shoot(person(posture), cam);
    const pose = P.cameraPose(s.up, 0);
    return P.features(s.lm, s.w, s.h, pose, mode, s.f);
  };
  const calib = (mode, cam) => P.makeBaseline(Array.from({ length: 12 }, () => run({}, cam, mode)), mode);

  // Camera angles from the phone's tilt
  const upright = shoot(person(), front({}));
  const p0 = P.cameraPose(upright.up, 0);
  ok('posture: upright phone at eye level reads level', Math.abs(p0.elev) < 0.5 && Math.abs(p0.roll) < 0.5, 'elev ' + p0.elev.toFixed(1) + '°, roll ' + p0.roll.toFixed(1) + '°');
  const p1 = P.cameraPose(shoot(person(), front({ elev: 35, dh: -0.4 })).up, 0);
  ok('posture: phone held low and tilted back reads camera looking up', Math.abs(p1.elev - 35) < 0.5, p1.elev.toFixed(1) + '°');
  const p2 = P.cameraPose(P.upFromAngles(60, 0), 0);
  ok('posture: deviceorientation beta 60 means camera 30° up', Math.abs(p2.elev - 30) < 0.5 && Math.abs(p2.roll) < 0.5, p2.elev.toFixed(1) + '°');
  const fr = run({}, front({ roll: 12 }));
  ok('posture: a slanted phone does not make level shoulders look uneven', Math.abs(fr.sTilt) < 0.5, 'shoulder line ' + fr.sTilt.toFixed(2) + '° after correction');

  // Front view: calibrate properly, then move the phone and the head
  const base = calib('front', front({}));
  ok('posture: calibration learns the nose offset', base && base.ear && base.ear.c != null, base && base.ear ? 'c = ' + base.ear.c.toFixed(3) : '');
  const cases = [
    ['phone at eye level, head level', { phi: 0 }, { }, 0],
    ['phone at eye level, head bent 25°', { phi: 25 }, { }, 25],
    ['phone held low and tilted back, looking down at it 35°', { phi: 35 }, { elev: 35, dh: -0.45, d: 0.55 }, 35],
    ['phone held low, head level (camera sees the ceiling)', { phi: 0 }, { elev: 35, dh: -0.45, d: 0.55 }, 0],
    ['phone on the desk below, looking down 45°', { phi: 45 }, { elev: 20, dh: -0.5, d: 0.6 }, 45],
    ['phone held high, chin up 10°', { phi: -10 }, { elev: -15, dh: 0.2, d: 0.6 }, -10],
    ['slanted phone held low, looking down 30°', { phi: 30 }, { elev: 30, dh: -0.4, d: 0.55, roll: 15 }, 30]
  ];
  for (const [name, post, cam, want] of cases) {
    const f = run(post, front(cam));
    const phi = P.headPitch(f, base);
    ok('posture: ' + name + ' gives the true head angle', phi != null && Math.abs(phi - want) <= 5, (phi == null ? 'none' : phi.toFixed(1)) + '° vs ' + want + '°');
  }
  const bad = P.scores(run({ phi: 35 }, front({ elev: 35, dh: -0.45, d: 0.55 })), base, 'normal', { moved: true });
  ok('posture: looking down at a hand-held phone is flagged', bad.s.down >= 1 && !isFinite(bad.s.close), 'down score ' + bad.s.down.toFixed(2) + ', neck load ' + bad.info.load.toFixed(0) + ' kg');
  const good = P.scores(run({ phi: 0 }, front({ elev: 35, dh: -0.45, d: 0.55 })), base, 'normal', { moved: true });
  const goodWorst = Math.max(...Object.values(good.s).filter(isFinite));
  ok('posture: head level with a low phone raises no warning at all', goodWorst < 1 && !isFinite(good.s.slouch), 'down score ' + good.s.down.toFixed(2) + ', worst ' + goodWorst.toFixed(2) + '; proportion checks paused');
  const same = P.scores(run({}, front({})), base, 'normal', {});
  const worst = Math.max(...Object.values(same.s).filter(isFinite));
  ok('posture: upright at calibration scores well inside every limit', worst < 0.3, 'worst ' + worst.toFixed(2));
  const sl = P.scores(run({ lean: 15 }, front({ d: 1.1 })), calib('front', front({ d: 1.1 })), 'normal', {});
  ok('posture: trunk slumped 15° shows when the hips are in view', sl.s.slump >= 0.8 || sl.s.slouch >= 1 || sl.s.down >= 1, 'slump ' + sl.s.slump.toFixed(2) + ', slouch ' + sl.s.slouch.toFixed(2));

  // Side view: camera at the person's right, looking at them side-on
  const sideCam = (o) => ({ pos: [-(o.d || 1.0), 0.1 + (o.dh || 0), -0.05], look: [1, 0, 0], elev: o.elev || 0, roll: o.roll || 0, hide: [7, 11, 23, 2] });
  const sb = calib('side', sideCam({}));
  ok('posture: side calibration works', sb && isFinite(sb.fwd), sb ? 'ear ' + sb.fwd.toFixed(1) + '° ahead of shoulder, head ' + sb.down.toFixed(1) + '°, trunk ' + sb.lean.toFixed(1) + '°' : '');
  const sf = P.scores(run({ fwd: 0.06 }, sideCam({}), 'side'), sb, 'normal', {});
  ok('posture: side view catches head pushed 6 cm forward', sf.s.forward >= 1, 'ear ' + sf.info.fwd.toFixed(1) + '° ahead, score ' + sf.s.forward.toFixed(2));
  const sd = P.scores(run({ phi: 25 }, sideCam({}), 'side'), sb, 'normal', {});
  ok('posture: side view catches head bent 25°', sd.s.down >= 1, 'head ' + sd.info.downRel.toFixed(1) + '° lower than calibrated, score ' + sd.s.down.toFixed(2));
  const sr = P.scores(run({}, sideCam({ roll: 10, elev: 10, dh: -0.25 }), 'side'), sb, 'normal', {});
  const sworst = Math.max(...Object.values(sr.s).filter(isFinite));
  ok('posture: side view is not fooled by a slanted, low phone', sworst < 1, 'worst ' + sworst.toFixed(2) + ' (ear ' + sr.info.fwd.toFixed(1) + '°)');
  const sl2 = P.scores(run({ lean: 20 }, sideCam({}), 'side'), sb, 'normal', {});
  ok('posture: side view catches leaning forward 20°', sl2.s.lean >= 1, 'trunk ' + sl2.info.leanRel.toFixed(1) + '° more forward than calibrated');

  // Real faces differ from the model: a nose 20% shorter or longer than assumed, and landmarks that jitter by a few pixels.
  const tests3 = [[25, {}], [35, { elev: 35, dh: -0.45, d: 0.55 }], [0, { elev: 35, dh: -0.45, d: 0.55 }], [45, { elev: 20, dh: -0.5, d: 0.6 }]];
  for (const nose of [0.092, 0.138]) {
    const which = nose < 0.115 ? 'shorter' : 'longer';
    const cal = Array.from({ length: 12 }, () => run({ nose }, front({})));
    const one = P.makeBaseline(cal, 'front');
    const e1 = tests3.map(([phi, cam]) => P.headPitch(run({ phi, nose }, front(cam)), one) - phi);
    ok('posture: nose 20% ' + which + ' than average, one-step calibration: within 15°', e1.every((e) => Math.abs(e) <= 15), e1.map((e) => (e > 0 ? '+' : '') + e.toFixed(1) + '°').join(', '));
    // Second step: head level, phone lowered 40 cm and pointed up at the face.
    const low = Array.from({ length: 10 }, () => run({ nose }, front({ elev: 32, dh: -0.4, d: 0.6 })));
    const two = P.makeBaseline(cal, 'front', low);
    const e2 = tests3.map(([phi, cam]) => P.headPitch(run({ phi, nose }, front(cam)), two) - phi);
    ok('posture: nose 20% ' + which + ', two-step calibration learns it: within 3°', e2.every((e) => Math.abs(e) <= 3), 'nose depth learned ' + two.ear.K.toFixed(2) + ' (true ' + (nose / 0.15).toFixed(2) + '); ' + e2.map((e) => (e > 0 ? '+' : '') + e.toFixed(1) + '°').join(', '));
  }
  {
    const r = VX.U.rng(4), shots = [];
    for (let i = 0; i < 60; i++) {
      const s = shoot(person({ phi: 30 }), front({ elev: 30, dh: -0.4, d: 0.55 }));
      for (const p of s.lm) { p.x += 2.5 * VX.U.gauss(r) / s.w; p.y += 2.5 * VX.U.gauss(r) / s.h; }
      shots.push(P.headPitch(P.features(s.lm, s.w, s.h, P.cameraPose(s.up, 0), 'front', s.f), base));
    }
    const sd = VX.U.sd(shots);
    ok('posture: 2.5-pixel landmark jitter moves the head angle by only a few degrees', sd < 4, 'spread ' + sd.toFixed(1) + '° per frame (smoothed over half a second in use)');
  }
  ok('posture: neck load table', Math.abs(P.neckLoad(30) - 18.1) < 0.01 && Math.abs(P.neckLoad(22.5) - 15.15) < 0.01);
  // Without a tilt sensor (laptop), checks still work against the calibration.
  const lap = (post) => { const s = shoot(person(post), front({})); return P.features(s.lm, s.w, s.h, null, 'front', s.f); };
  const lb = P.makeBaseline(Array.from({ length: 10 }, () => lap({})), 'front');
  const ls = P.scores(lap({ phi: 25 }), lb, 'normal', {});
  ok('posture: laptop without tilt sensor still catches looking down', ls.s.down >= 1 && ls.info.phi === null, 'score ' + ls.s.down.toFixed(2));
};
