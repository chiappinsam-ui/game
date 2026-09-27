/* ======================================================================
   Strikepoint — weapon models, viewmodel controller, hitscan combat
   ====================================================================== */
SP.Weapons = (function () {
  const U = SP.util;
  const M = {
    gun: new THREE.MeshStandardMaterial({ color: 0x2b2f34, metalness: 0.85, roughness: 0.38 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.3, roughness: 0.8 }),
    poly: new THREE.MeshStandardMaterial({ color: 0x24272b, metalness: 0.1, roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8b9298, metalness: 0.95, roughness: 0.25 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5b3a1e, metalness: 0.0, roughness: 0.7 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a44a, metalness: 0.9, roughness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.6 }),
    tan: new THREE.MeshStandardMaterial({ color: 0x9a8a6a, metalness: 0.1, roughness: 0.85 }),
    accent: {}
  };
  function accent(hex) { return M.accent[hex] || (M.accent[hex] = new THREE.MeshStandardMaterial({ color: hex, metalness: 0.4, roughness: 0.5 })); }
  function part(g, w, h, d, mat, x, y, z, name) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; if (name) m.name = name; g.add(m); return m;
  }
  function cyl(g, r, len, mat, x, y, z, axis, name) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
    if (axis === 'z') m.rotation.x = Math.PI / 2; else if (axis === 'x') m.rotation.z = Math.PI / 2;
    m.position.set(x, y, z); m.castShadow = true; if (name) m.name = name; g.add(m); return m;
  }
  function muzzleAt(g, x, y, z) { const o = new THREE.Object3D(); o.name = 'muzzle'; o.position.set(x, y, z); g.add(o); g.userData.muzzle = o; }
  function ejectAt(g, x, y, z) { const o = new THREE.Object3D(); o.name = 'eject'; o.position.set(x, y, z); g.add(o); g.userData.eject = o; }

  /* Each builder returns a Group whose grip is near origin and barrel points -Z */
  const builders = {
    knife(g) {
      part(g, 0.025, 0.03, 0.11, M.dark, 0, 0, 0.02, 'handle'); part(g, 0.03, 0.012, 0.02, M.steel, 0, 0, -0.045);
      const blade = part(g, 0.006, 0.03, 0.17, M.steel, 0, 0.004, -0.14, 'blade'); blade.rotation.x = 0.03;
      part(g, 0.004, 0.012, 0.16, M.gun, 0, 0.012, -0.135); muzzleAt(g, 0, 0, -0.22);
    },
    hawk9(g) {
      part(g, 0.028, 0.045, 0.19, M.gun, 0, 0.065, -0.07, 'slide'); part(g, 0.03, 0.035, 0.2, M.poly, 0, 0.03, -0.065);
      part(g, 0.028, 0.1, 0.035, M.poly, 0, -0.04, 0.005, 'grip').rotation.x = 0.25;
      part(g, 0.02, 0.09, 0.028, M.dark, 0, -0.05, 0.003, 'mag').rotation.x = 0.25;
      part(g, 0.02, 0.035, 0.02, M.dark, 0, -0.005, -0.06, 'trigger'); part(g, 0.03, 0.006, 0.06, M.tan, 0, 0.012, -0.03);
      part(g, 0.006, 0.012, 0.01, M.dark, 0, 0.093, -0.155); part(g, 0.02, 0.012, 0.01, M.dark, 0, 0.093, 0.02);
      cyl(g, 0.006, 0.03, M.steel, 0, 0.068, -0.175, 'z'); muzzleAt(g, 0, 0.068, -0.19); ejectAt(g, 0.015, 0.08, -0.05);
    },
    warden(g) {
      part(g, 0.032, 0.05, 0.09, M.gun, 0, 0.055, 0.0, 'frame'); cyl(g, 0.028, 0.055, M.gun, 0, 0.055, -0.03, 'z', 'cylinder');
      cyl(g, 0.011, 0.19, M.steel, 0, 0.068, -0.15, 'z'); part(g, 0.014, 0.022, 0.19, M.gun, 0, 0.045, -0.15);
      part(g, 0.03, 0.11, 0.04, M.wood, 0, -0.045, 0.02, 'grip').rotation.x = 0.35;
      part(g, 0.006, 0.014, 0.01, M.dark, 0, 0.088, -0.24); part(g, 0.02, 0.014, 0.01, M.dark, 0, 0.088, 0.03);
      part(g, 0.02, 0.035, 0.015, M.dark, 0, 0.012, -0.03, 'trigger'); part(g, 0.01, 0.03, 0.025, M.dark, 0, 0.085, 0.04, 'hammer');
      muzzleAt(g, 0, 0.068, -0.25); ejectAt(g, 0.02, 0.07, -0.03);
    },
    hornet(g) {
      part(g, 0.05, 0.07, 0.34, M.gun, 0, 0.06, -0.1, 'receiver'); part(g, 0.045, 0.045, 0.16, M.poly, 0, 0.025, 0.02);
      cyl(g, 0.012, 0.16, M.steel, 0, 0.075, -0.33, 'z'); part(g, 0.04, 0.03, 0.12, M.gun, 0, 0.078, -0.28);
      part(g, 0.03, 0.1, 0.04, M.poly, 0, -0.03, 0.03, 'grip').rotation.x = 0.2;
      part(g, 0.028, 0.16, 0.05, M.dark, 0, -0.06, -0.13, 'mag').rotation.x = 0.08;
      part(g, 0.03, 0.03, 0.2, M.gun, 0, 0.06, 0.2, 'stock'); part(g, 0.04, 0.07, 0.02, M.poly, 0, 0.055, 0.3);
      part(g, 0.05, 0.012, 0.3, accent(0xc28a1a), 0, 0.105, -0.12); part(g, 0.02, 0.02, 0.02, M.dark, 0, 0.12, -0.26); part(g, 0.02, 0.02, 0.015, M.dark, 0, 0.12, 0.0);
      part(g, 0.02, 0.035, 0.015, M.dark, 0, 0.01, -0.06, 'trigger'); muzzleAt(g, 0, 0.075, -0.41); ejectAt(g, 0.03, 0.07, -0.08);
    },
    breacher(g) {
      cyl(g, 0.014, 0.5, M.steel, 0, 0.08, -0.35, 'z', 'barrel'); cyl(g, 0.018, 0.34, M.gun, 0, 0.04, -0.3, 'z', 'tube');
      part(g, 0.05, 0.075, 0.2, M.gun, 0, 0.055, -0.02, 'receiver'); part(g, 0.045, 0.04, 0.16, M.wood, 0, 0.04, -0.34, 'pump');
      part(g, 0.04, 0.1, 0.06, M.wood, 0, -0.02, 0.06, 'grip').rotation.x = 0.45;
      part(g, 0.04, 0.07, 0.24, M.wood, 0, 0.045, 0.2, 'stock'); part(g, 0.045, 0.09, 0.02, M.dark, 0, 0.045, 0.32);
      part(g, 0.006, 0.012, 0.01, M.dark, 0, 0.1, -0.58); part(g, 0.02, 0.035, 0.015, M.dark, 0, 0.005, -0.05, 'trigger');
      muzzleAt(g, 0, 0.08, -0.6); ejectAt(g, 0.03, 0.06, -0.06);
    },
    raptor(g) {
      part(g, 0.055, 0.075, 0.3, M.gun, 0, 0.06, -0.12, 'receiver'); part(g, 0.05, 0.045, 0.2, M.poly, 0, 0.02, 0.0);
      part(g, 0.06, 0.012, 0.3, accent(0x2ee6c8), 0, 0.105, -0.12);
      part(g, 0.05, 0.06, 0.24, M.poly, 0, 0.055, -0.37, 'handguard'); cyl(g, 0.011, 0.12, M.steel, 0, 0.07, -0.53, 'z');
      cyl(g, 0.02, 0.16, M.dark, 0, 0.07, -0.63, 'z', 'suppressor');
      part(g, 0.03, 0.1, 0.04, M.poly, 0, -0.03, 0.03, 'grip').rotation.x = 0.2;
      part(g, 0.03, 0.17, 0.06, M.dark, 0, -0.07, -0.1, 'mag').rotation.x = 0.15;
      part(g, 0.035, 0.035, 0.24, M.poly, 0, 0.065, 0.22, 'stock'); part(g, 0.045, 0.09, 0.03, M.poly, 0, 0.055, 0.34);
      part(g, 0.02, 0.025, 0.02, M.dark, 0, 0.125, -0.42); part(g, 0.025, 0.025, 0.02, M.dark, 0, 0.125, 0.0);
      part(g, 0.02, 0.035, 0.015, M.dark, 0, 0.005, -0.05, 'trigger'); muzzleAt(g, 0, 0.07, -0.72); ejectAt(g, 0.035, 0.07, -0.1);
    },
    kestrel(g) {
      part(g, 0.055, 0.08, 0.32, M.gun, 0, 0.06, -0.12, 'receiver'); part(g, 0.06, 0.012, 0.32, accent(0xff4b5c), 0, 0.108, -0.12);
      part(g, 0.05, 0.03, 0.18, M.wood, 0, 0.025, 0.02);
      part(g, 0.05, 0.06, 0.26, M.wood, 0, 0.05, -0.38, 'handguard'); cyl(g, 0.012, 0.28, M.steel, 0, 0.072, -0.62, 'z');
      cyl(g, 0.018, 0.06, M.gun, 0, 0.072, -0.74, 'z', 'brake');
      part(g, 0.03, 0.1, 0.04, M.wood, 0, -0.03, 0.03, 'grip').rotation.x = 0.2;
      part(g, 0.032, 0.18, 0.07, M.dark, 0, -0.07, -0.1, 'mag').rotation.x = 0.35;
      part(g, 0.04, 0.05, 0.28, M.wood, 0, 0.06, 0.24, 'stock'); part(g, 0.045, 0.09, 0.03, M.dark, 0, 0.055, 0.38);
      part(g, 0.006, 0.02, 0.01, M.dark, 0, 0.13, -0.5); part(g, 0.025, 0.025, 0.02, M.dark, 0, 0.128, 0.0);
      part(g, 0.02, 0.035, 0.015, M.dark, 0, 0.005, -0.05, 'trigger'); muzzleAt(g, 0, 0.072, -0.78); ejectAt(g, 0.035, 0.07, -0.1);
    },
    bulwark(g) {
      part(g, 0.065, 0.09, 0.36, M.gun, 0, 0.06, -0.12, 'receiver'); part(g, 0.06, 0.05, 0.2, M.poly, 0, 0.015, 0.02);
      part(g, 0.06, 0.07, 0.3, M.gun, 0, 0.05, -0.42, 'handguard'); cyl(g, 0.014, 0.3, M.steel, 0, 0.07, -0.7, 'z'); cyl(g, 0.024, 0.06, M.gun, 0, 0.07, -0.84, 'z');
      cyl(g, 0.075, 0.05, M.dark, 0, -0.03, -0.12, 'x', 'mag');
      part(g, 0.035, 0.1, 0.045, M.poly, 0, -0.03, 0.04, 'grip').rotation.x = 0.2;
      part(g, 0.045, 0.05, 0.26, M.poly, 0, 0.06, 0.25, 'stock'); part(g, 0.05, 0.1, 0.03, M.poly, 0, 0.05, 0.38);
      part(g, 0.07, 0.012, 0.36, accent(0x8a6a3e), 0, 0.11, -0.12);
      part(g, 0.02, 0.03, 0.02, M.dark, 0, 0.13, -0.5); part(g, 0.025, 0.03, 0.02, M.dark, 0, 0.13, 0.0);
      // bipod folded
      part(g, 0.01, 0.01, 0.16, M.dark, -0.03, 0.005, -0.5).rotation.z = 0.2; part(g, 0.01, 0.01, 0.16, M.dark, 0.03, 0.005, -0.5).rotation.z = -0.2;
      part(g, 0.02, 0.035, 0.015, M.dark, 0, 0.0, -0.05, 'trigger'); muzzleAt(g, 0, 0.07, -0.88); ejectAt(g, 0.04, 0.06, -0.1);
    },
    longbow(g) {
      part(g, 0.05, 0.07, 0.34, M.gun, 0, 0.06, -0.1, 'receiver'); part(g, 0.05, 0.05, 0.9, M.poly, 0, 0.03, -0.2);
      cyl(g, 0.013, 0.6, M.steel, 0, 0.075, -0.75, 'z', 'barrel'); cyl(g, 0.022, 0.08, M.gun, 0, 0.075, -1.06, 'z', 'brake');
      cyl(g, 0.02, 0.09, M.steel, 0.045, 0.09, 0.0, 'z', 'bolt'); part(g, 0.04, 0.012, 0.012, M.steel, 0.07, 0.09, 0.02);
      part(g, 0.03, 0.1, 0.045, M.poly, 0, -0.03, 0.06, 'grip').rotation.x = 0.2; part(g, 0.03, 0.12, 0.06, M.dark, 0, -0.06, -0.08, 'mag');
      part(g, 0.045, 0.07, 0.3, M.poly, 0, 0.05, 0.27, 'stock'); part(g, 0.05, 0.1, 0.03, M.poly, 0, 0.045, 0.42); part(g, 0.04, 0.05, 0.12, M.poly, 0, 0.005, 0.32, 'cheek');
      // scope
      cyl(g, 0.022, 0.26, M.gun, 0, 0.145, -0.1, 'z', 'scope'); cyl(g, 0.028, 0.06, M.gun, 0, 0.145, -0.24, 'z'); cyl(g, 0.026, 0.05, M.gun, 0, 0.145, 0.03, 'z');
      cyl(g, 0.02, 0.005, M.glass, 0, 0.145, -0.272, 'z'); part(g, 0.012, 0.04, 0.02, M.gun, 0, 0.115, -0.05); part(g, 0.012, 0.04, 0.02, M.gun, 0, 0.115, -0.2);
      part(g, 0.05, 0.012, 0.3, accent(0x7cc4ff), 0, 0.1, -0.1);
      part(g, 0.02, 0.035, 0.015, M.dark, 0, 0.0, -0.06, 'trigger'); muzzleAt(g, 0, 0.075, -1.1); ejectAt(g, 0.035, 0.08, -0.05);
    }
  };
  function buildModel(id) {
    const g = new THREE.Group(); (builders[id] || builders.hawk9)(g); g.userData.weaponId = id;
    g.traverse(o => { if (o.isMesh) { o.frustumCulled = false; } });
    return g;
  }

  /* ---------------- weapon instance ---------------- */
  function makeInstance(id) {
    const def = SP.WEAPONS[id];
    return { id, def, mag: def.mag, reserve: def.reserve, lastFire: -10, reloading: false, reloadT: 0, boltT: 0, bloom: 0, shotIndex: 0 };
  }

  /* ---------------- hitscan ----------------
     shooter: { team, isPlayer, name } ; returns { hit:'map'|'body'|null, point, part, target }
  */
  const _dir = new THREE.Vector3(), _o = new THREE.Vector3();
  function fireHitscan(origin, dir, inst, shooter, targets, opts) {
    opts = opts || {};
    const def = inst.def;
    const hitboxes = [];
    for (const t of targets) { if (t === shooter || !t.alive || !t.hitboxes || (shooter && t.team === shooter.team)) continue; for (const h of t.hitboxes) hitboxes.push(h); }
    const hit = SP.Map.raycast(origin, dir, def.type === 'melee' ? def.range : 400, hitboxes);
    const res = { hit: null, point: null, part: null, target: null, dist: 0, normal: null, material: 'concrete' };
    if (!hit) { res.point = _o.copy(origin).addScaledVector(dir, 400).clone(); res.dist = 400; return res; }
    res.point = hit.point.clone(); res.dist = hit.distance;
    if (hit.face) res.normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const ud = hit.object.userData;
    if (ud && ud.owner) {
      res.hit = 'body'; res.part = ud.part; res.target = ud.owner;
      let dmg = def.damage[ud.part] || def.damage.body; dmg *= U.falloff(def, hit.distance);
      if (def.type === 'melee' && ud.owner.facingAwayFrom && ud.owner.facingAwayFrom(origin)) dmg = 150;
      ud.owner.takeDamage(Math.round(dmg), ud.part, shooter, def, res.point, dir);
    } else { res.hit = 'map'; res.material = (ud && ud.material) || 'concrete'; }
    return res;
  }

  /* ---------------- VIEWMODEL (player's first-person gun) ---------------- */
  function Viewmodel(camera, player) {
    this.camera = camera; this.player = player;
    this.root = new THREE.Group(); this.root.scale.set(0.85, 0.85, 0.85); camera.add(this.root);
    this.models = {}; this.current = null; this.inst = null;
    this.ads = 0; this.adsTarget = 0; this.kick = new THREE.Vector3(); this.kickRot = new THREE.Vector3();
    this.swayX = 0; this.swayY = 0; this.bobT = 0; this.switchT = 0; this.lower = 0;
    this.trigger = false; this.triggerWasDown = false; this.knifeSwing = 0;
    this.zoomLevel = 1; this.onFire = null;
    this.basePos = new THREE.Vector3(0.24, -0.22, -0.45); this.adsPos = new THREE.Vector3(0, -0.13, -0.32);
    this.reloadPhase = 0; this.shellsToLoad = 0;
  }
  Viewmodel.prototype.setWeapon = function (inst) {
    if (this.current) this.root.remove(this.current);
    this.inst = inst; if (!inst) { this.current = null; return; }
    if (!this.models[inst.id]) this.models[inst.id] = buildModel(inst.id);
    this.current = this.models[inst.id]; this.root.add(this.current);
    this.switchT = 0.32; this.adsTarget = 0; this.zoomLevel = 1; this.reloadPhase = 0;
    this.current.traverse(o => { if (o.isMesh) o.visible = true; });
    const mag = this.current.getObjectByName('mag'); if (mag) { mag.userData.basePos = mag.userData.basePos || mag.position.clone(); mag.position.copy(mag.userData.basePos); }
    SP.Audio.ui('switch');
  };
  Viewmodel.prototype.startReload = function () {
    const i = this.inst; if (!i || i.reloading || i.mag >= i.def.mag || i.reserve <= 0 || i.def.type === 'melee' || this.switchT > 0) return false;
    i.reloading = true; i.reloadT = 0; this.adsTarget = 0; this.zoomLevel = 1; this.reloadPhase = 0;
    if (i.def.reloadPerShell) { this.shellsToLoad = Math.min(i.def.mag - i.mag, i.reserve); SP.Audio.reload('out'); } else SP.Audio.reload('out');
    return true;
  };
  Viewmodel.prototype.cancelReload = function () { if (this.inst) { this.inst.reloading = false; this.inst.reloadT = 0; } this.reloadPhase = 0; };
  Viewmodel.prototype.canFire = function (now) {
    const i = this.inst; if (!i || this.switchT > 0) return false;
    if (i.reloading) { if (i.def.reloadPerShell && i.mag > 0) { this.cancelReload(); return true; } return false; }
    if (i.boltT > 0) return false;
    return now - i.lastFire >= 1 / i.def.fireRate;
  };
  Viewmodel.prototype.currentSpread = function () {
    const i = this.inst; if (!i) return 0; const s = i.def.spread; const p = this.player;
    let sp = s.base;
    const speed = p.horizontalSpeed(); const moveFrac = U.clamp(speed / SP.CONFIG.RUN_SPEED, 0, 1);
    sp *= 1 + (s.move - 1) * moveFrac; if (!p.onGround) sp *= 3.5; if (p.crouching) sp *= s.crouch;
    if (this.ads > 0.5) sp *= (i.def.scoped ? 0.02 : s.ads);
    sp += i.bloom; return sp;
  };
  Viewmodel.prototype.update = function (dt, now, input) {
    const i = this.inst; const p = this.player; const cam = this.camera;
    if (!i || !this.current) return;
    const def = i.def;
    // --- switching
    if (this.switchT > 0) this.switchT = Math.max(0, this.switchT - dt);
    // --- ADS
    const wantAds = input.aim && !i.reloading && this.switchT <= 0 && def.type !== 'melee';
    this.adsTarget = wantAds ? 1 : 0;
    this.ads += (this.adsTarget - this.ads) * Math.min(1, dt * (def.scoped ? 9 : 14));
    if (!wantAds) this.zoomLevel = 1;
    // --- bolt / fire timers
    if (i.boltT > 0) { i.boltT -= dt; if (i.boltT <= 0 && def.boltTime) SP.Audio.reload('bolt'); }
    i.bloom = Math.max(0, i.bloom - def.spread.decay * dt * (i.bloom * 0.5 + 0.3));
    // --- reload state machine
    if (i.reloading) {
      i.reloadT += dt; const rt = def.reloadTime;
      if (def.reloadPerShell) {
        if (i.reloadT >= rt) { i.reloadT = 0; i.mag++; i.reserve--; SP.Audio.reload('shell'); this.shellsToLoad--; if (this.shellsToLoad <= 0 || i.mag >= def.mag || i.reserve <= 0) { i.reloading = false; SP.Audio.reload('pump'); } }
      } else {
        if (this.reloadPhase === 0 && i.reloadT > rt * 0.45) { this.reloadPhase = 1; SP.Audio.reload('in'); }
        if (this.reloadPhase === 1 && i.reloadT > rt * 0.8) { this.reloadPhase = 2; SP.Audio.reload('bolt'); }
        if (i.reloadT >= rt) { const need = def.mag - i.mag; const take = Math.min(need, i.reserve); i.mag += take; i.reserve -= take; i.reloading = false; this.reloadPhase = 0; }
      }
    }
    // --- firing
    const wantFire = input.fire && (def.auto || !this.triggerWasDown);
    this.triggerWasDown = input.fire;
    if (wantFire && this.canFire(now)) {
      if (def.type === 'melee') this.swingKnife(now);
      else if (i.mag <= 0) { if (!this.triggerWasDownEmpty) { SP.Audio.dryFire(); this.startReload(); } this.triggerWasDownEmpty = true; }
      else this.fire(now);
    }
    if (!input.fire) this.triggerWasDownEmpty = false;
    // --- visual: recoil recovery
    this.kick.multiplyScalar(Math.max(0, 1 - dt * 12)); this.kickRot.multiplyScalar(Math.max(0, 1 - dt * 10));
    // --- sway & bob
    const speed = p.horizontalSpeed();
    this.bobT += dt * (2.2 + speed * 1.4) * (speed > 0.3 && p.onGround ? 1 : 0);
    const bobAmt = (0.008 + speed * 0.0022) * (1 - this.ads * 0.85);
    const bobX = Math.sin(this.bobT * 2) * bobAmt, bobY = Math.abs(Math.cos(this.bobT * 2)) * bobAmt * 0.8;
    this.swayX += (-input.mouseDX * 0.00035 - this.swayX) * Math.min(1, dt * 10); this.swayY += (-input.mouseDY * 0.00035 - this.swayY) * Math.min(1, dt * 10);
    // --- compose transform
    const pos = new THREE.Vector3().lerpVectors(this.basePos, this.adsPos, this.ads);
    if (def.id === 'longbow') { pos.lerp(new THREE.Vector3(0, -0.07, -0.2), this.ads); }
    const sw = 1 - this.ads * 0.9;
    pos.x += (bobX + this.swayX) * sw; pos.y += (bobY + this.swayY) * sw - (this.switchT > 0 ? this.switchT * 1.2 : 0) - p.landDip * 0.3;
    pos.add(this.kick);
    const rot = new THREE.Euler(this.kickRot.x + this.swayY * 2 * sw + (this.switchT > 0 ? this.switchT * 1.6 : 0), this.kickRot.y + this.swayX * 2 * sw, this.kickRot.z + Math.sin(this.bobT) * 0.01 * sw);
    // reload animation
    if (i.reloading) {
      const k = def.reloadPerShell ? i.reloadT / def.reloadTime : i.reloadT / def.reloadTime;
      const dip = Math.sin(Math.min(1, k) * Math.PI);
      pos.y -= dip * 0.08; pos.x += dip * 0.03; rot.x -= dip * 0.35; rot.z += dip * 0.5;
      const mag = this.current.getObjectByName('mag');
      if (mag && !def.reloadPerShell && mag.userData.basePos) {
        if (k < 0.45) mag.position.copy(mag.userData.basePos).add(new THREE.Vector3(0, -k * 0.6, 0.05 * k));
        else if (k < 0.8) mag.position.copy(mag.userData.basePos).add(new THREE.Vector3(0, -(0.8 - k) * 0.7, 0));
        else mag.position.copy(mag.userData.basePos);
      }
    } else { const mag = this.current.getObjectByName('mag'); if (mag && mag.userData.basePos) mag.position.copy(mag.userData.basePos); }
    // sniper scope: hide model when fully aimed
    if (def.scoped) this.current.visible = this.ads < 0.85; else this.current.visible = true;
    // knife swing anim
    if (this.knifeSwing > 0) { this.knifeSwing -= dt * 3.2; const k = Math.max(0, this.knifeSwing); const sw2 = Math.sin(k * Math.PI); pos.x -= sw2 * 0.15; pos.z -= sw2 * 0.25; rot.y += sw2 * 1.2; rot.x -= sw2 * 0.4; }
    this.root.position.copy(pos); this.root.rotation.copy(rot);
    // slide/bolt movement after shot
    const slide = this.current.getObjectByName('slide') || this.current.getObjectByName('bolt');
    if (slide) { slide.userData.basePos = slide.userData.basePos || slide.position.clone(); const since = now - i.lastFire; slide.position.copy(slide.userData.basePos); if (since < 0.09) slide.position.z += 0.02 * Math.sin(since / 0.09 * Math.PI); }
    const pump = this.current.getObjectByName('pump');
    if (pump) { pump.userData.basePos = pump.userData.basePos || pump.position.clone(); const since = now - i.lastFire; pump.position.copy(pump.userData.basePos); if (since > 0.25 && since < 0.6) pump.position.z += 0.08 * Math.sin((since - 0.25) / 0.35 * Math.PI); }
  };
  Viewmodel.prototype.fire = function (now) {
    const i = this.inst, def = i.def, p = this.player, cam = this.camera;
    i.lastFire = now; i.mag--; i.shotIndex++;
    if (def.boltTime) i.boltT = def.boltTime;
    const spreadDeg = this.currentSpread();
    i.bloom = Math.min(def.spread.bloom * 6, i.bloom + def.spread.bloom);
    // recoil: pattern — first shots go up, then drift sideways
    const rec = def.recoil; const n = i.shotIndex;
    const vert = rec.v * (1 + Math.min(n, 6) * 0.06) * (this.ads > 0.5 ? 0.75 : 1) * (p.crouching ? 0.8 : 1);
    const horiz = (n < 4 ? U.rand(-0.3, 0.3) : Math.sin(n * 0.7) * 0.9 + U.rand(-0.3, 0.3)) * rec.h;
    p.addRecoil(vert, horiz);
    this.kick.z += 0.03 + rec.v * 0.008; this.kick.y += 0.004; this.kickRot.x += 0.03 + rec.v * 0.01; this.kickRot.z += U.rand(-0.02, 0.02);
    // camera-space origin & direction
    const origin = new THREE.Vector3(); cam.getWorldPosition(origin);
    const baseDir = new THREE.Vector3(); cam.getWorldDirection(baseDir);
    const muzzle = new THREE.Vector3(); const mz = this.current.userData.muzzle; if (mz) mz.getWorldPosition(muzzle); else muzzle.copy(origin).addScaledVector(baseDir, 0.5);
    const shots = def.pellets || 1;
    const targets = SP.Game.getCombatants();
    let anyBody = false, anyHead = false, anyKill = false;
    for (let s = 0; s < shots; s++) {
      const dir = spreadDir(baseDir, spreadDeg, cam);
      const res = fireHitscan(origin, dir, i, p, targets);
      if (res.hit === 'body') { anyBody = true; if (res.part === 'head') anyHead = true; if (res.target && !res.target.alive) anyKill = true; SP.Effects.bloodHit(res.point, dir, res.part === 'head'); }
      else if (res.hit === 'map') { SP.Effects.impact(res.point, res.normal, res.material); SP.Audio.impact(res.point, res.material); }
      if (def.sound !== 'rifleQuiet' || Math.random() < 0.3) SP.Effects.tracer(muzzle, res.point);
    }
    // effects & sound
    SP.Effects.muzzleFlash(muzzle, baseDir, def.type === 'shotgun' || def.type === 'sniper' || def.type === 'lmg');
    const ej = this.current.userData.eject; if (ej) { const ep = new THREE.Vector3(); ej.getWorldPosition(ep); const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion); const up = new THREE.Vector3(0, 1, 0); if (def.type !== 'sniper' || true) SP.Effects.shell(ep, right, up); }
    SP.Audio.gunshot(def.sound);
    if (anyBody) { SP.Audio.hitMarker(anyHead); SP.HUD.hitmarker(anyKill, anyHead); }
    SP.Game.onPlayerShot(origin, def);
    if (this.onFire) this.onFire();
  };
  Viewmodel.prototype.swingKnife = function (now) {
    const i = this.inst; i.lastFire = now; this.knifeSwing = 1;
    const origin = new THREE.Vector3(); this.camera.getWorldPosition(origin); const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
    const res = fireHitscan(origin, dir, i, this.player, SP.Game.getCombatants());
    if (res.hit === 'body') { SP.Effects.bloodHit(res.point, dir, false); SP.Audio.knife(true); SP.HUD.hitmarker(res.target && !res.target.alive, false); }
    else if (res.hit === 'map') { SP.Effects.impact(res.point, res.normal, res.material); SP.Audio.knife(true); }
    else SP.Audio.knife(false);
  };
  /* random direction within a cone of `deg` degrees (half-angle) around dir, using camera basis */
  const _right = new THREE.Vector3(), _up = new THREE.Vector3();
  function spreadDir(dir, deg, cam) {
    if (deg <= 0) return dir.clone();
    const r = U.deg(deg) * Math.sqrt(Math.random()); const a = Math.random() * Math.PI * 2;
    if (cam) { _right.set(1, 0, 0).applyQuaternion(cam.quaternion); _up.set(0, 1, 0).applyQuaternion(cam.quaternion); }
    else { _right.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(); _up.crossVectors(_right, dir).normalize(); }
    return dir.clone().addScaledVector(_right, Math.cos(a) * Math.tan(r)).addScaledVector(_up, Math.sin(a) * Math.tan(r)).normalize();
  }

  return { buildModel, makeInstance, fireHitscan, Viewmodel, spreadDir, materials: M };
})();
