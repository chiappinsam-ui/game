/* ======================================================================
   Strikepoint — visual effects: particles, tracers, muzzle flash, decals,
   shell casings, smoke, explosion, camera shake
   ====================================================================== */
SP.Effects = (function () {
  const T = SP.Textures;
  let scene, camera;
  const particles = [], tracers = [], decals = [], shells = [];
  const MAX_PARTICLES = 700, MAX_TRACERS = 60, MAX_DECALS = 160, MAX_SHELLS = 40;
  let pIndex = 0, tIndex = 0, dIndex = 0, sIndex = 0;
  let sparkMat, bloodMat, smokeMat, dustMat, flashMat, glowMat, holeMat, bloodDecalMat, tracerMat, shellMat;
  let flashLight, flashLightTime = 0;
  const shake = { amp: 0, t: 0 };
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);

  function init(s, cam) {
    scene = s; camera = cam;
    sparkMat = new THREE.SpriteMaterial({ map: T.spark(), color: 0xffd080, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    bloodMat = new THREE.SpriteMaterial({ map: T.blood(), color: 0xff3040, depthWrite: false, transparent: true });
    smokeMat = new THREE.SpriteMaterial({ map: T.smoke(), color: 0xbfc4c8, depthWrite: false, transparent: true, opacity: 0.85 });
    dustMat = new THREE.SpriteMaterial({ map: T.smoke(), color: 0xa89f90, depthWrite: false, transparent: true, opacity: 0.6 });
    flashMat = new THREE.SpriteMaterial({ map: T.muzzleFlash(), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    glowMat = new THREE.SpriteMaterial({ map: T.glow(), color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    holeMat = new THREE.MeshBasicMaterial({ map: T.bulletHole(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    bloodDecalMat = new THREE.MeshBasicMaterial({ map: T.blood(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, color: 0x8a0a14 });
    tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9, depthWrite: false });
    shellMat = new THREE.MeshStandardMaterial({ color: 0xc9a44a, metalness: 0.9, roughness: 0.3 });
    // pools
    for (let i = 0; i < MAX_PARTICLES; i++) { const sp = new THREE.Sprite(sparkMat); sp.visible = false; sp.userData = { life: 0 }; scene.add(sp); particles.push({ s: sp, v: new THREE.Vector3(), life: 0, max: 1, size: 0.1, grow: 0, grav: 0, drag: 0, fade: 1 }); }
    const tGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 5, 1, true); tGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < MAX_TRACERS; i++) { const m = new THREE.Mesh(tGeo, tracerMat.clone()); m.visible = false; scene.add(m); tracers.push({ m, life: 0, max: 0.08 }); }
    const dGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < MAX_DECALS; i++) { const m = new THREE.Mesh(dGeo, holeMat); m.visible = false; m.renderOrder = 2; scene.add(m); decals.push({ m, life: 0 }); }
    const sGeo = new THREE.BoxGeometry(0.02, 0.02, 0.05);
    for (let i = 0; i < MAX_SHELLS; i++) { const m = new THREE.Mesh(sGeo, shellMat); m.visible = false; m.castShadow = false; scene.add(m); shells.push({ m, v: new THREE.Vector3(), rot: new THREE.Vector3(), life: 0 }); }
    flashLight = new THREE.PointLight(0xffb060, 0, 14, 2); scene.add(flashLight);
  }

  function spawnParticle(mat, pos, vel, life, size, opts) {
    const p = particles[pIndex]; pIndex = (pIndex + 1) % MAX_PARTICLES;
    // per-particle material clone (cached per base material) so opacity/rotation are independent
    p.mats = p.mats || {}; p.s.material = p.mats[mat.uuid] || (p.mats[mat.uuid] = mat.clone());
    p.baseOpacity = mat.opacity;
    p.s.position.copy(pos); p.v.copy(vel); p.life = life; p.max = life; p.size = size;
    p.grow = (opts && opts.grow) || 0; p.grav = (opts && opts.grav) != null ? opts.grav : 9.8; p.drag = (opts && opts.drag) || 0; p.fade = (opts && opts.fade) != null ? opts.fade : 1;
    p.s.scale.set(size, size, 1); p.s.visible = true; p.s.material.opacity = 1;
    if (opts && opts.rot != null) p.s.material.rotation = opts.rot;
    return p;
  }
  function randDir(normal, spread) {
    tmpV.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize().multiplyScalar(spread);
    return tmpV.add(normal).normalize();
  }

  /* ---------- public effects ---------- */
  function impact(point, normal, material) {
    const n = normal || UP;
    if (material === 'metal') {
      for (let i = 0; i < 12; i++) { const d = randDir(n, 0.9).multiplyScalar(SP.util.rand(2, 7)); spawnParticle(sparkMat, point, d, SP.util.rand(0.15, 0.45), SP.util.rand(0.04, 0.09), { grav: 12 }); }
      spawnParticle(glowMat, point, new THREE.Vector3(), 0.08, 0.5, { grav: 0 });
    } else if (material === 'wood') {
      for (let i = 0; i < 8; i++) { const d = randDir(n, 0.8).multiplyScalar(SP.util.rand(1, 4)); spawnParticle(dustMat, point, d, SP.util.rand(0.3, 0.7), SP.util.rand(0.05, 0.12), { grav: 6, grow: 0.3 }); }
      for (let i = 0; i < 4; i++) { const d = randDir(n, 1).multiplyScalar(SP.util.rand(2, 5)); spawnParticle(sparkMat, point, d, 0.25, 0.04, { grav: 12 }); }
    } else {
      for (let i = 0; i < 7; i++) { const d = randDir(n, 0.7).multiplyScalar(SP.util.rand(0.8, 3)); spawnParticle(dustMat, point, d, SP.util.rand(0.4, 0.9), SP.util.rand(0.12, 0.28), { grav: 1.5, grow: 0.6, drag: 3 }); }
      for (let i = 0; i < 3; i++) { const d = randDir(n, 1).multiplyScalar(SP.util.rand(2, 5)); spawnParticle(sparkMat, point, d, 0.2, 0.035, { grav: 12 }); }
    }
    decal(point, n, holeMat, SP.util.rand(0.08, 0.13), 40);
  }
  function decal(point, normal, mat, size, life) {
    const d = decals[dIndex]; dIndex = (dIndex + 1) % MAX_DECALS;
    d.m.material = mat; d.m.position.copy(point).addScaledVector(normal, 0.012);
    tmpV.copy(point).add(normal); d.m.lookAt(tmpV); d.m.rotateZ(Math.random() * Math.PI * 2);
    d.m.scale.set(size, size, 1); d.m.visible = true; d.life = life || 30;
  }
  function bloodHit(point, dir, big) {
    const n = dir ? dir.clone().negate() : UP;
    const count = big ? 18 : 9;
    for (let i = 0; i < count; i++) { const d = randDir(dir || UP, 1.2).multiplyScalar(SP.util.rand(0.5, big ? 4 : 2.5)); spawnParticle(bloodMat, point, d, SP.util.rand(0.25, 0.6), SP.util.rand(0.06, big ? 0.22 : 0.14), { grav: 9, grow: 0.5 }); }
    // ground splat
    const hit = SP.Map.raycast(point, new THREE.Vector3(0, -1, 0), 3);
    if (hit && Math.random() < 0.8) decal(hit.point, hit.face ? hit.face.normal : UP, bloodDecalMat, SP.util.rand(0.35, 0.7) * (big ? 1.4 : 1), 60);
    // wall splat behind
    if (dir) { const h2 = SP.Map.raycast(point, dir, 2.5); if (h2 && h2.face) decal(h2.point, h2.face.normal.clone().transformDirection(h2.object.matrixWorld), bloodDecalMat, SP.util.rand(0.25, 0.5), 60); }
  }
  function tracer(from, to, color) {
    const t = tracers[tIndex]; tIndex = (tIndex + 1) % MAX_TRACERS;
    tmpV.subVectors(to, from); const len = tmpV.length(); if (len < 0.3) return;
    t.m.position.copy(from).addScaledVector(tmpV, 0.5); t.m.scale.set(1, 1, len); t.m.lookAt(to);
    t.m.material.color.set(color || 0xffd9a0); t.m.material.opacity = 0.8; t.m.visible = true; t.life = t.max = 0.07;
  }
  function muzzleFlash(pos, dir, big) {
    const size = big ? SP.util.rand(0.5, 0.8) : SP.util.rand(0.25, 0.45);
    const f = spawnParticle(flashMat, pos, new THREE.Vector3(), 0.045, size, { grav: 0, rot: Math.random() * 6.28 });
    f.s.position.addScaledVector(dir, 0.05);
    for (let i = 0; i < 3; i++) { const d = randDir(dir, 0.5).multiplyScalar(SP.util.rand(3, 9)); spawnParticle(sparkMat, pos, d, SP.util.rand(0.08, 0.2), 0.04, { grav: 4 }); }
    spawnParticle(dustMat, pos, dir.clone().multiplyScalar(1.5), 0.5, 0.15, { grav: -0.4, grow: 0.6, drag: 3, fade: 0.5 });
    flashLight.position.copy(pos).addScaledVector(dir, 0.3); flashLight.intensity = big ? 3.5 : 2.2; flashLightTime = 0.05;
  }
  function shell(pos, right, up) {
    const s = shells[sIndex]; sIndex = (sIndex + 1) % MAX_SHELLS;
    s.m.position.copy(pos); s.m.visible = true; s.life = 3.5;
    s.v.copy(right).multiplyScalar(SP.util.rand(1.5, 2.5)).addScaledVector(up, SP.util.rand(1.5, 2.5)); s.v.x += SP.util.rand(-0.4, 0.4); s.v.z += SP.util.rand(-0.4, 0.4);
    s.rot.set(SP.util.rand(-12, 12), SP.util.rand(-12, 12), SP.util.rand(-12, 12));
  }
  function smokeCloud(pos, radius, duration) {
    radius = radius || 3.2; duration = duration || 15;
    for (let i = 0; i < 26; i++) {
      const off = new THREE.Vector3((Math.random() - 0.5) * radius * 1.6, Math.random() * radius * 1.2, (Math.random() - 0.5) * radius * 1.6);
      const p = spawnParticle(smokeMat, pos.clone().add(off.multiplyScalar(0.2)), off.multiplyScalar(0.6), duration + Math.random() * 2, SP.util.rand(1.5, 2.6), { grav: -0.05, grow: 0.9, drag: 1.2, fade: 0.35 });
      p.s.position.y += 0.5;
    }
  }
  function explosion(pos) {
    for (let i = 0; i < 40; i++) { const d = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.8 + 0.2, (Math.random() - 0.5)).normalize().multiplyScalar(SP.util.rand(6, 22)); spawnParticle(glowMat, pos, d, SP.util.rand(0.4, 1.1), SP.util.rand(0.8, 2.2), { grav: 3, grow: -0.6, drag: 2 }); }
    for (let i = 0; i < 90; i++) { const d = new THREE.Vector3((Math.random() - 0.5), Math.random(), (Math.random() - 0.5)).normalize().multiplyScalar(SP.util.rand(8, 30)); spawnParticle(sparkMat, pos, d, SP.util.rand(0.5, 1.6), SP.util.rand(0.06, 0.16), { grav: 12, drag: 0.5 }); }
    for (let i = 0; i < 60; i++) { const d = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.6 + 0.3, (Math.random() - 0.5)).normalize().multiplyScalar(SP.util.rand(3, 12)); spawnParticle(smokeMat, pos, d, SP.util.rand(3, 7), SP.util.rand(1.5, 3.5), { grav: -0.6, grow: 1.4, drag: 1.5, fade: 0.6 }); }
    spawnParticle(glowMat, pos, new THREE.Vector3(0, 0.2, 0), 0.5, 2, { grav: 0, grow: 60 });
    flashLight.position.copy(pos).add(new THREE.Vector3(0, 2, 0)); flashLight.intensity = 30; flashLight.distance = 60; flashLightTime = 0.6;
    addShake(1.6);
  }
  function addShake(a) { shake.amp = Math.min(2.5, shake.amp + a); }

  /* ---------- update ---------- */
  function update(dt) {
    for (const p of particles) {
      if (!p.s.visible) continue;
      p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; }
      p.v.y -= p.grav * dt; if (p.drag) p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.s.position.addScaledVector(p.v, dt);
      if (p.s.position.y < 0.02 && p.v.y < 0) { p.s.position.y = 0.02; p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; }
      const k = p.life / p.max; p.s.material.opacity = Math.min(1, k * (2 - p.fade)) * p.baseOpacity;
      if (p.grow) { const s = p.size * (1 + p.grow * (1 - k)); p.s.scale.set(Math.max(0.01, s), Math.max(0.01, s), 1); }
    }
    for (const t of tracers) { if (!t.m.visible) continue; t.life -= dt; if (t.life <= 0) { t.m.visible = false; continue; } t.m.material.opacity = 0.8 * t.life / t.max; }
    for (const d of decals) { if (!d.m.visible) continue; d.life -= dt; if (d.life <= 0) d.m.visible = false; }
    for (const s of shells) {
      if (!s.m.visible) continue; s.life -= dt; if (s.life <= 0) { s.m.visible = false; continue; }
      s.v.y -= 12 * dt; s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += s.rot.x * dt; s.m.rotation.y += s.rot.y * dt; s.m.rotation.z += s.rot.z * dt;
      const gy = SP.Map.groundHeight(s.m.position.x, s.m.position.z, 0.03, s.m.position.y + 0.1) + 0.01;
      if (s.m.position.y < gy && s.v.y < 0) { s.m.position.y = gy; s.v.y *= -0.35; s.v.x *= 0.5; s.v.z *= 0.5; s.rot.multiplyScalar(0.3); if (Math.abs(s.v.y) > 0.6) SP.Audio.impact(s.m.position, 'metal'); }
    }
    if (flashLightTime > 0) { flashLightTime -= dt; if (flashLightTime <= 0) { flashLight.intensity = 0; flashLight.distance = 14; } else if (flashLight.distance > 14) flashLight.intensity *= 0.92; }
    if (shake.amp > 0.001) { shake.t += dt * 40; shake.amp *= Math.max(0, 1 - dt * 6); } else shake.amp = 0;
  }
  function shakeOffset(out) { if (shake.amp <= 0) { out.set(0, 0, 0); return out; } out.set(Math.sin(shake.t * 1.3) * shake.amp * 0.02, Math.cos(shake.t * 1.7) * shake.amp * 0.015, 0); return out; }
  function shakeRoll() { return Math.sin(shake.t * 0.9) * shake.amp * 0.01; }

  return { init, update, impact, bloodHit, tracer, muzzleFlash, shell, smokeCloud, explosion, addShake, shakeOffset, shakeRoll, spawnParticle, get mats() { return { sparkMat, bloodMat, smokeMat, dustMat, flashMat, glowMat }; } };
})();
