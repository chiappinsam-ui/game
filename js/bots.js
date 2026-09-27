/* ======================================================================
   Strikepoint — bots: humanoid models, animation, tactical AI
   ====================================================================== */
SP.Bot = (function () {
  const C = SP.CONFIG, U = SP.util;
  const suitMat = new THREE.MeshStandardMaterial({ color: 0x111417, roughness: 0.9 });
  const skinMats = [0xd9b48f, 0x8d5a3b, 0xf1d2b6, 0x5c3a21, 0xc68e5a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x0c1016, roughness: 0.2, metalness: 0.8 });
  const teamMats = { ally: new THREE.MeshStandardMaterial({ color: 0x0f8f7c, emissive: 0x2ee6c8, emissiveIntensity: 0.45, roughness: 0.5 }), enemy: new THREE.MeshStandardMaterial({ color: 0x9c1020, emissive: 0xff4b5c, emissiveIntensity: 0.45, roughness: 0.5 }) };
  const helmetColors = [0x1e2228, 0x2a2520, 0x1a2530, 0x2a1f24, 0x1f251d];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const ENGAGE_RANGE = { melee: 10, pistol: 34, smg: 36, shotgun: 20, rifle: 62, lmg: 55, sniper: 95 };

  function Bot(name, team, scene, index) {
    this.name = name; this.team = team; this.scene = scene; this.isBot = true; this.isPlayer = false; this.index = index;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.aimPitch = 0;
    this.hp = 100; this.shield = 0; this.alive = true; this.credits = C.START_CREDITS; this.kills = 0; this.deaths = 0; this.assists = 0; this.roundKills = 0;
    this.height = C.PLAYER_HEIGHT; this.radius = 0.36; this.onGround = true;
    this.weapon = SP.Weapons.makeInstance('hawk9'); this.sidearm = this.weapon; this.primary = null; this.armor = 0;
    this.state = 'idle'; this.path = []; this.pathIdx = 0; this.goal = null; this.target = null; this.lastSeen = 0; this.lastKnown = new THREE.Vector3();
    this.reaction = 0; this.nextThink = 0; this.burst = 0; this.burstPause = 0; this.strafe = 0; this.strafeT = 0; this.stuckT = 0; this.lastProgressPos = new THREE.Vector3(); this.lastProgressT = 0;
    this.hasCharge = false; this.planting = 0; this.defusing = 0; this.holdSpot = null; this.holdYaw = 0; this.deathT = 0; this.crouch = 0; this.walkT = 0;
    this.difficulty = 1; this.damagedBy = {}; this.lastDamageFrom = null; this.skill = U.rand(0.8, 1.2);
    this.buildModel(); this.setDead(false);
  }
  Bot.prototype.buildModel = function () {
    const g = new THREE.Group(); const tm = teamMats[this.team]; const skin = skinMats[this.index % skinMats.length];
    const helm = new THREE.MeshStandardMaterial({ color: helmetColors[this.index % helmetColors.length], roughness: 0.6, metalness: 0.2 });
    const box = (w, h, d, m, x, y, z, parent) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); mesh.castShadow = true; (parent || g).add(mesh); return mesh; };
    // torso pivot (rotates for aim pitch)
    this.torso = new THREE.Group(); this.torso.position.y = 0.95; g.add(this.torso);
    box(0.44, 0.56, 0.26, suitMat, 0, 0.3, 0, this.torso);                 // chest
    box(0.46, 0.22, 0.28, tm, 0, 0.42, 0, this.torso).scale.set(1, 1, 1.02); // team plate
    box(0.3, 0.1, 0.1, tm, 0, 0.2, -0.14, this.torso);                    // chest light
    box(0.5, 0.1, 0.3, suitMat, 0, 0.62, 0, this.torso);                  // shoulders
    box(0.38, 0.16, 0.24, suitMat, 0, -0.06, 0, g).position.y = 0.87;     // hips
    // head
    this.head = new THREE.Group(); this.head.position.set(0, 0.75, 0); this.torso.add(this.head);
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), skin); headM.castShadow = true; headM.position.y = 0.08; this.head.add(headM);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), helm); helmet.position.y = 0.1; helmet.castShadow = true; this.head.add(helmet);
    box(0.2, 0.06, 0.08, visorMat, 0, 0.08, -0.12, this.head); box(0.24, 0.02, 0.02, tm, 0, 0.12, -0.14, this.head);
    // arms
    this.armL = new THREE.Group(); this.armL.position.set(-0.3, 0.55, 0); this.torso.add(this.armL); box(0.12, 0.56, 0.12, suitMat, 0, -0.26, 0, this.armL); box(0.12, 0.12, 0.12, skin, 0, -0.56, 0, this.armL);
    this.armR = new THREE.Group(); this.armR.position.set(0.3, 0.55, 0); this.torso.add(this.armR); box(0.12, 0.56, 0.12, suitMat, 0, -0.26, 0, this.armR); box(0.12, 0.12, 0.12, skin, 0, -0.56, 0, this.armR);
    // legs
    this.legL = new THREE.Group(); this.legL.position.set(-0.12, 0.88, 0); g.add(this.legL); box(0.17, 0.85, 0.2, suitMat, 0, -0.44, 0, this.legL); box(0.18, 0.08, 0.28, visorMat, 0, -0.85, -0.03, this.legL);
    this.legR = new THREE.Group(); this.legR.position.set(0.12, 0.88, 0); g.add(this.legR); box(0.17, 0.85, 0.2, suitMat, 0, -0.44, 0, this.legR); box(0.18, 0.08, 0.28, visorMat, 0, -0.85, -0.03, this.legR);
    box(0.06, 0.2, 0.05, tm, -0.2, -0.3, 0.1, this.legL); // team stripe
    // weapon holder in right hand
    this.gunHolder = new THREE.Group(); this.gunHolder.position.set(-0.12, 0.42, -0.35); this.torso.add(this.gunHolder);
    this.setGunModel(this.weapon.id);
    // charge backpack (visible when carrying)
    this.chargeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.18), new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xffb347, emissiveIntensity: 0.4 })); this.chargeMesh.position.set(0, 0.3, 0.22); this.chargeMesh.visible = false; this.torso.add(this.chargeMesh);
    // hitboxes (kept visible with invisible material so raycasts work)
    const hb = (geo, part) => { const m = new THREE.Mesh(geo, hitMat); m.userData = { owner: this, part }; m.frustumCulled = false; this.scene.add(m); return m; };
    this.hitboxes = [hb(new THREE.SphereGeometry(0.17, 8, 6), 'head'), hb(new THREE.BoxGeometry(0.52, 0.62, 0.34), 'body'), hb(new THREE.BoxGeometry(0.46, 0.92, 0.3), 'leg')];
    // name tag
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = 'bold 40px Rajdhani, Arial'; x.textAlign = 'center'; x.fillStyle = this.team === 'ally' ? '#2ee6c8' : '#ff4b5c'; x.shadowColor = '#000'; x.shadowBlur = 8; x.fillText(this.name.toUpperCase(), 128, 46);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); tag.scale.set(1.0, 0.25, 1); tag.position.y = 2.05; this.tag = tag; g.add(tag);
    this.tag.visible = this.team === 'ally';
    this.model = g; this.scene.add(g);
  };
  Bot.prototype.setGunModel = function (id) {
    if (this.gunModel) this.gunHolder.remove(this.gunModel);
    this.gunModel = SP.Weapons.buildModel(id); this.gunModel.scale.set(1.1, 1.1, 1.1); this.gunHolder.add(this.gunModel);
  };
  Bot.prototype.setDead = function (dead) { this.model.visible = !dead || this.deathT < 6; this.hitboxes.forEach(h => { h.visible = !dead; }); };
  Bot.prototype.eye = function () { return new THREE.Vector3(this.pos.x, this.pos.y + 1.65 - this.crouch * 0.5, this.pos.z); };
  Bot.prototype.horizontalSpeed = function () { return Math.hypot(this.vel.x, this.vel.z); };
  Bot.prototype.facingAwayFrom = function (origin) { const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); return (fx * (origin.x - this.pos.x) + fz * (origin.z - this.pos.z)) < 0; };
  Bot.prototype.equip = function (id) { this.primary = SP.Weapons.makeInstance(id); this.weapon = this.primary; this.setGunModel(id); };
  Bot.prototype.equipSidearm = function (id) { this.sidearm = SP.Weapons.makeInstance(id); if (!this.primary) { this.weapon = this.sidearm; this.setGunModel(id); } };
  Bot.prototype.resetForRound = function (spawn, yaw, keepLoadout) {
    this.pos.set(spawn.x, 0, spawn.z); this.vel.set(0, 0, 0); this.yaw = yaw; this.aimPitch = 0; this.hp = 100; this.alive = true; this.deathT = 0; this.roundKills = 0; this.damagedBy = {};
    this.state = 'idle'; this.path = []; this.target = null; this.planting = 0; this.defusing = 0; this.holdSpot = null; this.hasCharge = false; this.chargeMesh.visible = false; this.crouch = 0;
    if (!keepLoadout) { this.primary = null; this.sidearm = SP.Weapons.makeInstance('hawk9'); this.armor = 0; this.shield = 0; }
    this.weapon = this.primary || this.sidearm; this.weapon.mag = this.weapon.def.mag; this.weapon.reserve = this.weapon.def.reserve; this.weapon.reloading = false; this.shield = this.armor;
    this.setGunModel(this.weapon.id); this.model.rotation.set(0, 0, 0); this.model.position.y = 0; this.model.visible = true; this.setDead(false);
    this.model.traverse(o => { if (o.isMesh && o.material.transparent) { o.material.opacity = 1; } });
  };

  /* ---------------- perception ---------------- */
  const _v = new THREE.Vector3();
  Bot.prototype.canSee = function (t) {
    if (!t.alive) return false;
    const eye = this.eye(); const th = t.height || 1.75;
    const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z; const dist = Math.hypot(dx, dz);
    const maxR = ENGAGE_RANGE[this.weapon.def.type] || 45; if (dist > maxR) return false;
    // field of view check (unless very close)
    if (dist > 2.5) { const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); const dot = (fx * dx + fz * dz) / dist; if (dot < Math.cos(U.deg(this.state === 'engage' ? 80 : 62))) return false; }
    // LOS to chest, then head
    _v.set(t.pos.x, t.pos.y + th * 0.65, t.pos.z); if (SP.Map.hasLOS(eye, _v)) return true;
    _v.set(t.pos.x, t.pos.y + th - 0.1, t.pos.z); return SP.Map.hasLOS(eye, _v);
  };
  Bot.prototype.hearNoise = function (source, pos) {
    if (!this.alive || source.team === this.team) return;
    if (this.state === 'engage' || this.state === 'plant' || this.state === 'defuse') return;
    this.lastKnown.copy(pos); this.lastSeen = SP.Game.time; this.alertT = SP.Game.time + 4;
    if (this.state === 'hold' && Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z) < 14) { this.faceTarget(pos); }
    else if (Math.random() < 0.35 * this.difficulty && Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z) < 22) { this.setGoal(pos.x, pos.z, 'investigate'); }
  };
  Bot.prototype.faceTarget = function (p) { this.desiredYaw = Math.atan2(-(p.x - this.pos.x), -(p.z - this.pos.z)); };

  /* ---------------- navigation ---------------- */
  Bot.prototype.setGoal = function (x, z, why) { this.goal = { x, z, why }; this.path = SP.Map.nav.findPath(this.pos.x, this.pos.z, x, z); this.pathIdx = 0; this.state = 'move'; this.lastProgressT = SP.Game.time; this.lastProgressPos.copy(this.pos); };
  Bot.prototype.atGoal = function () { return this.goal && Math.hypot(this.goal.x - this.pos.x, this.goal.z - this.pos.z) < 1.2; };
  Bot.prototype.followPath = function (dt, speed) {
    if (!this.path.length) return false;
    let wp = this.path[this.pathIdx]; let dx = wp.x - this.pos.x, dz = wp.z - this.pos.z; let d = Math.hypot(dx, dz);
    if (d < 0.7) { this.pathIdx++; if (this.pathIdx >= this.path.length) { this.path = []; this.vel.x *= 0.5; this.vel.z *= 0.5; return false; } wp = this.path[this.pathIdx]; dx = wp.x - this.pos.x; dz = wp.z - this.pos.z; d = Math.hypot(dx, dz); }
    const nx = dx / d, nz = dz / d;
    this.vel.x += (nx * speed - this.vel.x) * Math.min(1, dt * 8); this.vel.z += (nz * speed - this.vel.z) * Math.min(1, dt * 8);
    if (this.state !== 'engage') this.desiredYaw = Math.atan2(-nx, -nz);
    // stuck detection
    if (this.pos.distanceTo(this.lastProgressPos) > 0.6) { this.lastProgressPos.copy(this.pos); this.lastProgressT = SP.Game.time; }
    else if (SP.Game.time - this.lastProgressT > 1.6) {
      this.lastProgressT = SP.Game.time; this.stuckCount = (this.stuckCount || 0) + 1;
      this.vel.x += U.rand(-3, 3); this.vel.z += U.rand(-3, 3);
      if (this.goal) {
        if (this.stuckCount % 2 === 0) { const n = SP.Map.nav.nearest(this.pos.x + U.rand(-6, 6), this.pos.z + U.rand(-6, 6)); this.path = [{ x: n.x, z: n.z }].concat(SP.Map.nav.findPath(n.x, n.z, this.goal.x, this.goal.z)); }
        else this.path = SP.Map.nav.findPath(this.pos.x, this.pos.z, this.goal.x, this.goal.z);
        this.pathIdx = 0;
      }
    }
    return true;
  };

  /* ---------------- combat ---------------- */
  Bot.prototype.aimAndShoot = function (dt, t, game) {
    const w = this.weapon; const def = w.def; const now = game.time;
    const dist = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
    // aim point: chest, sometimes head for skilled bots
    const th = t.height || 1.75; const headChance = 0.12 * this.difficulty * this.skill;
    const aimY = t.pos.y + (Math.random() < headChance ? th - 0.12 : th * 0.62);
    const eye = this.eye(); const aim = new THREE.Vector3(t.pos.x, aimY, t.pos.z);
    this.faceTarget(t.pos); this.aimPitch = Math.atan2(aim.y - eye.y, dist);
    // turning speed limits accuracy right after acquiring
    if (this.reaction > 0) { this.reaction -= dt; return; }
    if (w.reloading) { w.reloadT += dt; if (w.reloadT >= def.reloadTime) { const take = Math.min(def.mag - w.mag, w.reserve); w.mag += take; w.reserve -= take; w.reloading = false; } return; }
    if (w.mag <= 0) { if (w.reserve > 0) { w.reloading = true; w.reloadT = 0; SP.Audio.reload('out'); } else { this.weapon = this.sidearm; this.setGunModel(this.sidearm.id); } return; }
    if (w.boltT > 0) { w.boltT -= dt; return; }
    // burst logic
    if (this.burstPause > 0) { this.burstPause -= dt; return; }
    if (now - w.lastFire < 1 / def.fireRate) return;
    if (def.type === 'melee') { if (dist > def.range) return; }
    // accuracy model: base error (deg) grows with distance & movement, shrinks with difficulty
    const moving = this.horizontalSpeed() > 1 ? 1.6 : 1; const targetMoving = (t.horizontalSpeed ? t.horizontalSpeed() : 0) > 2 ? 1.35 : 1;
    let err = (1.9 / (this.difficulty * this.skill)) * moving * targetMoving * (0.6 + dist / 40);
    if (def.type === 'sniper') err *= 0.5; if (def.type === 'shotgun') err *= 1.5;
    const dir = aim.sub(eye).normalize();
    const errDir = SP.Weapons.spreadDir(dir, err * (0.5 + Math.random()), null);
    const shots = def.pellets || 1; const targets = game.getCombatants();
    const muzzle = new THREE.Vector3(); if (this.gunModel && this.gunModel.userData.muzzle) this.gunModel.userData.muzzle.getWorldPosition(muzzle); else muzzle.copy(eye);
    for (let s = 0; s < shots; s++) {
      const sd = SP.Weapons.spreadDir(errDir, def.spread.base * (def.type === 'shotgun' ? 1 : 0.6) + w.bloom, null);
      const res = SP.Weapons.fireHitscan(eye, sd, w, this, targets);
      if (res.hit === 'body') SP.Effects.bloodHit(res.point, sd, res.part === 'head');
      else if (res.hit === 'map') { SP.Effects.impact(res.point, res.normal, res.material); SP.Audio.impact(res.point, res.material); if (res.target == null && game.player.alive && res.point.distanceTo(game.player.camera.position) < 2.5) SP.Audio.whiz((Math.random() - 0.5) * 2); }
      if (def.sound !== 'rifleQuiet' || Math.random() < 0.3) SP.Effects.tracer(muzzle, res.point, this.team === 'ally' ? 0xa0f0ff : 0xffb090);
    }
    w.lastFire = now; w.mag--; w.bloom = Math.min(def.spread.bloom * 5, w.bloom + def.spread.bloom); if (def.boltTime) w.boltT = def.boltTime;
    SP.Effects.muzzleFlash(muzzle, dir, def.type === 'shotgun' || def.type === 'sniper');
    SP.Audio.gunshot(def.sound, { pos: muzzle });
    game.onNoise(this, 45);
    this.burst++; const burstLen = def.auto ? U.randInt(3, 7) : 1;
    if (this.burst >= burstLen) { this.burst = 0; this.burstPause = def.auto ? U.rand(0.15, 0.4) / this.difficulty : U.rand(0.1, 0.3) / this.difficulty; }
  };

  Bot.prototype.takeDamage = function (dmg, part, shooter, weaponDef, point, dir) {
    if (!this.alive) return;
    if (weaponDef.type !== 'melee' && this.shield > 0) { const absorbed = Math.min(this.shield, Math.round(dmg * 0.66)); this.shield -= absorbed; dmg -= absorbed; }
    this.hp -= dmg; this.lastDamageFrom = shooter; if (shooter) this.damagedBy[shooter.name] = (this.damagedBy[shooter.name] || 0) + dmg;
    if (shooter && shooter.isPlayer) { shooter.damageDealt += dmg; }
    SP.Audio.hitFlesh(false);
    // react: turn toward shooter
    if (shooter && shooter.team !== this.team && this.alive) { this.target = shooter; this.lastKnown.copy(shooter.pos); this.lastSeen = SP.Game.time; if (this.state !== 'engage') { this.state = 'engage'; this.reaction = U.rand(0.1, 0.3) / this.difficulty; this.planting = 0; this.defusing = 0; } }
    if (this.hp <= 0) { this.hp = 0; this.die(shooter, weaponDef, part === 'head', dir); }
  };
  Bot.prototype.die = function (killer, weaponDef, headshot, dir) {
    this.alive = false; this.deaths++; this.deathT = 0.0001; this.state = 'dead'; this.planting = 0; this.defusing = 0; this.chargeMesh.visible = false;
    this.fallDir = dir ? Math.atan2(dir.x, dir.z) : this.yaw; this.setDead(true);
    SP.Audio.death && SP.Audio.hitFlesh(false);
    SP.Game.onDeath(this, killer, weaponDef, headshot);
  };

  /* ---------------- main think/update ---------------- */
  Bot.prototype.update = function (dt, game) {
    if (!this.alive) { this.updateDeath(dt); return; }
    const phase = game.phase; const now = game.time;
    const frozen = phase === 'buy' || phase === 'ending';
    if (this.desiredYaw == null) this.desiredYaw = this.yaw;
    if (!frozen) {
      // --- perception (throttled)
      if (now >= this.nextThink) {
        this.nextThink = now + 0.12 + Math.random() * 0.08;
        let best = null, bd = Infinity;
        for (const t of game.getCombatants()) { if (t.team === this.team || !t.alive) continue; const d = this.pos.distanceTo(t.pos); if (d < bd && this.canSee(t)) { bd = d; best = t; } }
        if (best) {
          if (this.target !== best || this.state !== 'engage') { this.reaction = U.rand(0.18, 0.42) / (this.difficulty * this.skill); this.burst = 0; }
          this.target = best; this.lastSeen = now; this.lastKnown.copy(best.pos);
          if (this.state !== 'engage') { this.prevState = this.state; this.state = 'engage'; this.planting = 0; this.defusing = 0; }
        } else if (this.state === 'engage' && now - this.lastSeen > 1.8) {
          // lost target: push toward last known position if it is close, otherwise resume the plan
          this.target = null;
          if (this.pos.distanceTo(this.lastKnown) < 20 && Math.random() < 0.6) this.setGoal(this.lastKnown.x, this.lastKnown.z, 'chase'); else { this.state = 'idle'; this.goal = null; }
        }
        this.think(game);
      }
      // --- behaviour
      let speed = C.RUN_SPEED * 0.92;
      if (this.state === 'engage' && this.target) {
        const visible = this.canSee(this.target);
        if (visible) {
          this.aimAndShoot(dt, this.target, game);
          // strafe / crouch micro-movement
          this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = U.rand(0.4, 1.2); this.strafe = U.pick([-1, 0, 0, 1]); this.crouchWant = Math.random() < 0.3 ? 1 : 0; }
          const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw); const sspd = this.weapon.def.type === 'sniper' ? 0 : 2.2 * this.strafe;
          this.vel.x += (rx * sspd - this.vel.x) * Math.min(1, dt * 6); this.vel.z += (rz * sspd - this.vel.z) * Math.min(1, dt * 6);
          this.path = [];
        } else {
          this.crouchWant = 0; if (!this.path.length) this.setGoal(this.lastKnown.x, this.lastKnown.z, 'chase'); this.state = 'engage'; this.followPath(dt, speed);
        }
      } else if (this.state === 'move' || this.state === 'investigate') {
        this.crouchWant = 0;
        if (!this.followPath(dt, speed)) { this.vel.x *= 0.7; this.vel.z *= 0.7; this.onArrive(game); }
      } else if (this.state === 'hold') {
        this.vel.x *= 0.8; this.vel.z *= 0.8; this.desiredYaw = this.holdYaw; this.crouchWant = this.holdCrouch ? 1 : 0;
      } else if (this.state === 'plant') {
        this.vel.x *= 0.7; this.vel.z *= 0.7; this.crouchWant = 1;
        this.planting += dt; if (this.planting >= C.PLANT_DURATION) { game.plantCharge(this); this.planting = 0; this.state = 'hold'; this.pickHold(game, game.plantedSite); }
      } else if (this.state === 'defuse') {
        this.vel.x *= 0.7; this.vel.z *= 0.7; this.crouchWant = 1; this.aimPitch = -0.5;
        this.defusing += dt; if (this.defusing >= C.DEFUSE_DURATION) { game.defuseCharge(this); this.defusing = 0; this.state = 'hold'; }
      } else { this.vel.x *= 0.8; this.vel.z *= 0.8; }
    } else { this.vel.set(0, 0, 0); }
    // --- physics
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    SP.Map.collideCylinder(this.pos, this.radius, this.height, 0.45);
    const gy = SP.Map.groundHeight(this.pos.x, this.pos.z, this.radius, this.pos.y + 0.5); this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 10);
    // --- separation from other bots
    for (const o of game.bots) { if (o === this || !o.alive) continue; const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z; const d = Math.hypot(dx, dz); if (d < 0.9 && d > 0.001) { this.pos.x += dx / d * (0.9 - d) * 0.5; this.pos.z += dz / d * (0.9 - d) * 0.5; } }
    // --- turning
    let dy = this.desiredYaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    const turnRate = this.state === 'engage' ? 9 * this.difficulty : 6; this.yaw += U.clamp(dy, -turnRate * dt, turnRate * dt);
    if (this.state !== 'engage' && this.state !== 'defuse') this.aimPitch += (0 - this.aimPitch) * Math.min(1, dt * 4);
    this.crouch += ((this.crouchWant || 0) - this.crouch) * Math.min(1, dt * 8);
    // --- footsteps
    const sp = this.horizontalSpeed(); if (sp > 0.8) { this.stepDist = (this.stepDist || 0) + sp * dt; if (this.stepDist > 2.3) { this.stepDist = 0; SP.Audio.footstep(this.pos, 'concrete', false); game.onNoise(this, 20); } }
    this.animate(dt);
  };
  Bot.prototype.think = function (game) {
    if (this.state === 'engage') return;
    const isAtt = this.team === game.attackingTeam;
    if (isAtt) {
      if (game.planted) { if (this.state !== 'hold') { this.pickHold(game, game.plantedSite); } return; }
      // charge on the ground and nobody carrying it → nearest attacker fetches it
      if (!this.hasCharge && game.droppedCharge && !game.carrierAlive()) {
        const dc = game.droppedCharge.pos;
        if (this.pos.distanceTo(dc) < 1.6) { game.pickupCharge(this); this.state = 'idle'; return; }
        if (!this.goal || this.goal.why !== 'charge') this.setGoal(dc.x, dc.z, 'charge');
        return;
      }
      if (this.hasCharge) {
        const site = game.sites[game.attackPlan.site];
        if (SP.Map.inZone(site.zone, this.pos.x, this.pos.z) && this.state !== 'plant') { this.state = 'plant'; this.planting = 0; this.vel.set(0, 0, 0); SP.Audio.beep(this.pos, 1200, 0.5); return; }
        if (this.state !== 'plant' && (!this.goal || this.goal.why !== 'plant' || this.atGoal())) { if (!SP.Map.inZone(site.zone, this.pos.x, this.pos.z)) { const p = SP.Map.randomInZone(site.zone); this.setGoal(p.x, p.z, 'plant'); } }
      } else if (this.state === 'idle') { this.pickHold(game, game.attackPlan.site, true); }
      else if (this.state === 'hold' && game.time - game.roundStartTime > 25 && Math.random() < 0.01) { this.pickHold(game, game.attackPlan.site, true); }
    } else {
      if (game.planted) {
        const site = game.sites[game.plantedSite];
        if (SP.Map.inZone(site.zone, this.pos.x, this.pos.z) && game.chargePos && this.pos.distanceTo(game.chargePos) < 1.6 && this.state !== 'defuse' && !game.defuser) { this.state = 'defuse'; this.defusing = 0; game.defuser = this; this.vel.set(0, 0, 0); return; }
        if (this.state !== 'defuse' && (!this.goal || this.goal.why !== 'defuse')) { this.setGoal(game.chargePos.x + U.rand(-0.6, 0.6), game.chargePos.z + U.rand(-0.6, 0.6), 'defuse'); }
      } else if (this.state === 'idle') { const site = this.index % 2 === 0 ? 'A' : 'B'; this.pickHold(game, this.index === 4 ? 'mid' : site); }
      else if (this.state === 'hold' && game.time - game.roundStartTime > 35 && Math.random() < 0.006) { this.pickHold(game, U.pick(['A', 'B', 'mid'])); }
    }
  };
  Bot.prototype.pickHold = function (game, siteKey, attacker) {
    let spot, yaw;
    if (siteKey === 'mid') { spot = U.pick([[0, -22], [-2, -17], [2.5, -12]]); yaw = 0; }
    else {
      const site = game.sites[siteKey]; const opts = attacker ? (siteKey === 'A' ? [[28, -10], [23, -14], [31, -19], [17, -15]] : [[-28, -10], [-23, -14], [-31, -19], [-17, -15]]) : site.holds;
      spot = opts[(this.index + U.randInt(0, 1)) % opts.length];
      yaw = attacker ? Math.PI : (siteKey === 'A' ? Math.atan2(-(28 - spot[0]), -(-4 - spot[1])) : Math.atan2(-(-28 - spot[0]), -(-4 - spot[1])));
    }
    this.holdSpot = { x: spot[0] + U.rand(-0.8, 0.8), z: spot[1] + U.rand(-0.8, 0.8) }; this.holdYaw = yaw; this.holdCrouch = Math.random() < 0.35;
    this.setGoal(this.holdSpot.x, this.holdSpot.z, 'hold');
  };
  Bot.prototype.onArrive = function (game) {
    if (this.goal && this.goal.why === 'charge') { if (game.droppedCharge && this.pos.distanceTo(game.droppedCharge.pos) < 2.2) game.pickupCharge(this); this.state = 'idle'; }
    else if (this.goal && this.goal.why === 'hold') { this.state = 'hold'; }
    else if (this.goal && this.goal.why === 'plant') { if (SP.Map.inZone(game.sites[game.attackPlan.site].zone, this.pos.x, this.pos.z)) { this.state = 'plant'; this.planting = 0; } else { const p = SP.Map.randomInZone(game.sites[game.attackPlan.site].zone); this.setGoal(p.x, p.z, 'plant'); } }
    else if (this.goal && this.goal.why === 'defuse') { if (game.planted && game.chargePos && this.pos.distanceTo(game.chargePos) < 1.8 && !game.defuser) { this.state = 'defuse'; this.defusing = 0; game.defuser = this; } else if (game.planted) { this.setGoal(game.chargePos.x, game.chargePos.z, 'defuse'); } else this.state = 'idle'; }
    else { this.state = 'idle'; this.holdYaw = this.yaw; }
  };
  Bot.prototype.animate = function (dt) {
    const m = this.model; m.position.copy(this.pos); m.rotation.y = this.yaw;
    const sp = this.horizontalSpeed(); this.walkT += dt * sp * 2.6;
    const amp = Math.min(0.7, sp * 0.16); const s = Math.sin(this.walkT);
    this.legL.rotation.x = s * amp; this.legR.rotation.x = -s * amp;
    const aiming = this.state === 'engage' || this.state === 'hold';
    this.armL.rotation.x = aiming ? -1.35 : -s * amp * 0.6; this.armR.rotation.x = aiming ? -1.4 : s * amp * 0.6;
    this.armL.rotation.y = aiming ? 0.6 : 0; this.armL.position.x = aiming ? -0.22 : -0.3; this.armL.position.z = aiming ? -0.08 : 0;
    this.torso.rotation.x = aiming ? -this.aimPitch : 0; this.torso.rotation.y = aiming ? -0.25 : 0;
    this.gunHolder.rotation.x = 0; this.gunHolder.position.set(aiming ? 0.02 : 0.28, aiming ? 0.42 : 0.1, aiming ? -0.35 : -0.15);
    this.gunHolder.rotation.set(aiming ? 0 : 0.5, 0, 0);
    // crouch: lower body
    const cr = this.crouch; m.position.y = this.pos.y - cr * 0.45; this.legL.rotation.x += cr * 1.1; this.legR.rotation.x += cr * 1.1; this.torso.rotation.x += cr * 0.15;
    m.position.y += Math.abs(Math.cos(this.walkT)) * amp * 0.05;
    this.height = C.PLAYER_HEIGHT - cr * 0.55;
    // hitboxes
    const h = this.height; this.hitboxes[0].position.set(this.pos.x, this.pos.y + h - 0.13, this.pos.z); this.hitboxes[1].position.set(this.pos.x, this.pos.y + h - 0.58, this.pos.z); this.hitboxes[2].position.set(this.pos.x, this.pos.y + 0.46, this.pos.z);
    this.hitboxes.forEach(hb => { hb.rotation.y = this.yaw; hb.updateMatrixWorld(); });
    this.chargeMesh.visible = this.hasCharge;
    m.updateMatrixWorld();
  };
  Bot.prototype.updateDeath = function (dt) {
    this.deathT += dt; const m = this.model; const k = Math.min(1, this.deathT / 0.6);
    const ease = 1 - Math.pow(1 - k, 3);
    m.rotation.set(0, this.yaw, 0); m.rotateOnAxis(new THREE.Vector3(Math.cos(this.fallDir - this.yaw), 0, -Math.sin(this.fallDir - this.yaw)).normalize(), ease * Math.PI / 2 * 0.98);
    m.position.copy(this.pos); m.position.y = this.pos.y + 0.12 * ease;
    this.legL.rotation.x += (0 - this.legL.rotation.x) * dt * 4; this.legR.rotation.x += (0 - this.legR.rotation.x) * dt * 4; this.armL.rotation.x += (-0.5 - this.armL.rotation.x) * dt * 3; this.armR.rotation.x += (0.6 - this.armR.rotation.x) * dt * 3;
    if (this.deathT > 5) { m.position.y -= dt * 0.4; if (this.deathT > 8) m.visible = false; }
  };
  return Bot;
})();
