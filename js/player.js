/* ======================================================================
   Strikepoint — first-person player controller
   ====================================================================== */
SP.Player = (function () {
  const C = SP.CONFIG, U = SP.util;

  function Player(camera, scene) {
    this.camera = camera; this.scene = scene;
    this.name = C.PLAYER_NAME; this.team = 'ally'; this.isPlayer = true; this.isBot = false;
    this.pos = new THREE.Vector3(0, 0, 40); this.vel = new THREE.Vector3();
    this.yaw = Math.PI; this.pitch = 0; this.pitchKick = 0; this.yawKick = 0;
    this.height = C.PLAYER_HEIGHT; this.crouching = false; this.onGround = true; this.landDip = 0;
    this.hp = 100; this.shield = 0; this.shieldMax = 0; this.alive = true; this.credits = C.START_CREDITS;
    this.kills = 0; this.deaths = 0; this.assists = 0; this.roundKills = 0; this.damageDealt = 0;
    this.weapons = { 1: null, 2: SP.Weapons.makeInstance('hawk9'), 3: SP.Weapons.makeInstance('knife'), 4: null };
    this.activeSlot = 2; this.lastSlot = 3; this.hasCharge = false;
    this.sensitivity = 1; this.baseFov = 90;
    this.input = { fwd: 0, side: 0, jump: false, crouch: false, walk: false, fire: false, aim: false, reload: false, interact: false, mouseDX: 0, mouseDY: 0 };
    this.keys = {}; this.stepDist = 0; this.spectating = null; this.recoverRate = 8;
    this.viewmodel = new SP.Weapons.Viewmodel(camera, this);
    this.viewmodel.setWeapon(this.weapons[2]);
    this.buildHitboxes();
    this.lastDamageFrom = null; this.lastDamageTime = -10; this.damagedBy = {};
  }
  Player.prototype.buildHitboxes = function () {
    const mk = (geo, part) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false })); m.userData = { owner: this, part }; m.visible = false; m.frustumCulled = false; this.scene.add(m); return m; };
    // Invisible hitboxes: bots raycast against these (visible=false meshes are skipped by raycaster, so we keep them visible with an invisible material)
    this.hitboxes = [mk(new THREE.SphereGeometry(0.14, 8, 6), 'head'), mk(new THREE.BoxGeometry(0.5, 0.75, 0.32), 'body'), mk(new THREE.BoxGeometry(0.45, 0.85, 0.3), 'leg')];
    this.hitboxes.forEach(h => { h.visible = true; h.material.visible = false; });
  };
  Player.prototype.updateHitboxes = function () {
    const h = this.height, p = this.pos; const on = this.alive;
    this.hitboxes[0].position.set(p.x, p.y + h - 0.12, p.z); this.hitboxes[1].position.set(p.x, p.y + h - 0.62, p.z); this.hitboxes[2].position.set(p.x, p.y + 0.43 * (h / C.PLAYER_HEIGHT), p.z);
    this.hitboxes.forEach(m => { m.visible = on; m.rotation.y = this.yaw; m.updateMatrixWorld(); });
  };
  Player.prototype.horizontalSpeed = function () { return Math.hypot(this.vel.x, this.vel.z); };
  Player.prototype.eyeHeight = function () { return this.height - 0.12; };
  Player.prototype.facingAwayFrom = function (origin) {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); const dx = origin.x - this.pos.x, dz = origin.z - this.pos.z;
    return (fx * dx + fz * dz) < 0;
  };
  Player.prototype.addRecoil = function (v, h) { this.pitchKick += U.deg(v); this.yawKick += U.deg(h); this.recoverRate = (this.activeWeapon() && this.activeWeapon().def.recoil.recover) || 8; };
  Player.prototype.activeWeapon = function () { return this.weapons[this.activeSlot]; };
  Player.prototype.applyLook = function (dx, dy) {
    const s = 0.0022 * this.sensitivity * (this.viewmodel.ads > 0.5 && this.viewmodel.inst && this.viewmodel.inst.def.scoped ? 1 / this.viewmodel.zoomLevel : 1);
    this.yaw -= dx * s; this.pitch -= dy * s; this.pitch = U.clamp(this.pitch, -1.5, 1.5);
    this.input.mouseDX = dx; this.input.mouseDY = dy;
  };
  Player.prototype.readKeys = function () {
    const k = this.keys, i = this.input;
    i.fwd = (k['KeyW'] ? 1 : 0) - (k['KeyS'] ? 1 : 0); i.side = (k['KeyD'] ? 1 : 0) - (k['KeyA'] ? 1 : 0);
    i.jump = !!k['Space']; i.crouch = !!(k['ControlLeft'] || k['ControlRight'] || k['KeyC']); i.walk = !!(k['ShiftLeft'] || k['ShiftRight']);
    i.interact = !!k['KeyE'];
  };
  Player.prototype.switchSlot = function (n) {
    if (!this.alive) return; if (n === this.activeSlot) return; const w = this.weapons[n]; if (!w) { return; }
    if (n === 4 && !this.hasCharge) return;
    this.viewmodel.cancelReload(); this.lastSlot = this.activeSlot; this.activeSlot = n; this.viewmodel.setWeapon(w); SP.HUD.refreshWeapon(this);
  };
  Player.prototype.cycleWeapon = function (dir) {
    const order = [1, 2, 3, 4].filter(s => this.weapons[s] && (s !== 4 || this.hasCharge)); let idx = order.indexOf(this.activeSlot);
    idx = (idx + dir + order.length) % order.length; this.switchSlot(order[idx]);
  };
  Player.prototype.giveWeapon = function (id) {
    const def = SP.WEAPONS[id]; const inst = SP.Weapons.makeInstance(id); this.weapons[def.slot] = inst;
    if (def.slot === 1 || this.activeSlot === def.slot) { this.activeSlot = def.slot; this.viewmodel.setWeapon(inst); }
    SP.HUD.refreshWeapon(this); return inst;
  };
  Player.prototype.dropWeapon = function () {
    const w = this.activeWeapon(); if (!w || w.def.type === 'melee' || this.activeSlot === 4) return;
    const slot = this.activeSlot; this.weapons[slot] = null; SP.Game.dropWeaponPickup(w, this.pos, this.yaw);
    this.activeSlot = this.weapons[2] ? 2 : 3; this.viewmodel.setWeapon(this.weapons[this.activeSlot]); SP.HUD.refreshWeapon(this);
  };
  Player.prototype.setCharge = function (has) {
    this.hasCharge = has; this.weapons[4] = has ? { id: 'charge', def: { id: 'charge', name: 'CHARGE', slot: 4, type: 'charge', fireRate: 0, mag: 1, reserve: 0, spread: { base: 0, decay: 1 }, recoil: { v: 0, h: 0 }, damage: {} }, mag: 1, reserve: 0, lastFire: -10, reloading: false, reloadT: 0, boltT: 0, bloom: 0, shotIndex: 0 } : null;
    if (!has && this.activeSlot === 4) this.switchSlot(this.weapons[1] ? 1 : 2);
    SP.HUD.refreshWeapon(this);
  };

  Player.prototype.update = function (dt, now, gameState) {
    if (!this.alive) { this.updateHitboxes(); return; }
    this.readKeys(); const i = this.input;
    const frozen = gameState.phase === 'buy' || gameState.phase === 'ending';
    // --- crouch
    const targetH = i.crouch ? C.CROUCH_HEIGHT : C.PLAYER_HEIGHT;
    if (targetH > this.height) { const ceil = SP.Map.ceilingHeight(this.pos.x, this.pos.z, C.PLAYER_RADIUS, this.pos.y + this.height); if (this.pos.y + targetH < ceil) this.height += (targetH - this.height) * Math.min(1, dt * 12); }
    else this.height += (targetH - this.height) * Math.min(1, dt * 12);
    this.crouching = this.height < C.PLAYER_HEIGHT - 0.2;
    // --- movement
    const wDef = this.activeWeapon() ? this.activeWeapon().def : null;
    let maxSpeed = this.crouching ? C.CROUCH_SPEED : (i.walk ? C.WALK_SPEED : C.RUN_SPEED);
    if (wDef && wDef.moveMult) maxSpeed *= wDef.moveMult;
    if (this.viewmodel.ads > 0.5) maxSpeed *= 0.7;
    if (frozen) maxSpeed = 0;
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    // forward is -Z when yaw = 0 (three.js camera looks down -Z)
    let wx = (-sinY * i.fwd) + (cosY * i.side), wz = (-cosY * i.fwd) + (-sinY * i.side);
    const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    const accel = this.onGround ? 40 : 6, friction = this.onGround ? 12 : 0.4;
    if (wl > 0) { this.vel.x += wx * accel * dt; this.vel.z += wz * accel * dt; }
    const sp = this.horizontalSpeed();
    if (sp > 0) { const drop = sp * friction * dt; const ns = Math.max(0, sp - (wl > 0 ? drop * 0.5 : drop)); this.vel.x *= ns / sp; this.vel.z *= ns / sp; }
    const sp2 = this.horizontalSpeed(); if (sp2 > maxSpeed) { this.vel.x *= maxSpeed / sp2; this.vel.z *= maxSpeed / sp2; }
    // --- jump / gravity
    if (i.jump && this.onGround && !frozen && !this.jumpHeld) { this.vel.y = C.JUMP_VELOCITY; this.onGround = false; this.jumpHeld = true; SP.Audio.footstep(null, 'concrete', false); }
    if (!i.jump) this.jumpHeld = false;
    this.vel.y -= C.GRAVITY * dt;
    // --- integrate with collision
    const wasGround = this.onGround;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    SP.Map.collideCylinder(this.pos, C.PLAYER_RADIUS, this.height, 0.45);
    this.pos.y += this.vel.y * dt;
    const gy = SP.Map.groundHeight(this.pos.x, this.pos.z, C.PLAYER_RADIUS, this.pos.y + 0.45);
    if (this.pos.y <= gy) { if (!wasGround && this.vel.y < -3) { this.landDip = Math.min(0.5, -this.vel.y * 0.05); SP.Audio.footstep(null, 'concrete', false); } this.pos.y = gy; this.vel.y = 0; this.onGround = true; }
    else if (this.pos.y > gy + 0.05) this.onGround = false;
    const ceil = SP.Map.ceilingHeight(this.pos.x, this.pos.z, C.PLAYER_RADIUS, this.pos.y + 0.2);
    if (this.pos.y + this.height > ceil) { this.pos.y = ceil - this.height; if (this.vel.y > 0) this.vel.y = 0; }
    // map bounds safety
    const b = SP.Map.bounds; this.pos.x = U.clamp(this.pos.x, b.x0 + 0.5, b.x1 - 0.5); this.pos.z = U.clamp(this.pos.z, b.z0 + 0.5, b.z1 - 0.5);
    this.landDip *= Math.max(0, 1 - dt * 6);
    // --- footsteps
    if (this.onGround) { this.stepDist += this.horizontalSpeed() * dt; const stride = this.crouching ? 1.6 : 2.3; if (this.stepDist > stride && this.horizontalSpeed() > 0.5) { this.stepDist = 0; SP.Audio.footstep(null, 'concrete', i.walk || this.crouching); if (!i.walk && !this.crouching) SP.Game.onNoise(this, 22); } }
    // --- recoil recovery
    const rr = this.recoverRate; this.pitchKick -= this.pitchKick * Math.min(1, dt * rr); this.yawKick -= this.yawKick * Math.min(1, dt * rr);
    // --- camera
    const cam = this.camera; const shake = SP.Effects.shakeOffset(new THREE.Vector3());
    cam.position.set(this.pos.x + shake.x, this.pos.y + this.eyeHeight() - this.landDip * 0.25 + shake.y, this.pos.z);
    cam.rotation.set(0, 0, 0); cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw + this.yawKick; cam.rotation.x = this.pitch + this.pitchKick; cam.rotation.z = SP.Effects.shakeRoll() + Math.sin(this.viewmodel.bobT) * 0.002;
    // fov / zoom
    const vm = this.viewmodel; let zoom = 1;
    if (vm.inst && vm.ads > 0.01) { const z = vm.inst.def.scoped ? (vm.zoomLevel === 2 ? vm.inst.def.adsZoom2 : vm.inst.def.adsZoom) : vm.inst.def.adsZoom; zoom = 1 + (z - 1) * vm.ads; }
    const targetFov = this.baseFov / zoom; if (Math.abs(cam.fov - targetFov) > 0.01) { cam.fov = targetFov; cam.updateProjectionMatrix(); }
    SP.HUD.setScoped(vm.inst && vm.inst.def.scoped && vm.ads > 0.85);
    // --- weapon
    const fireInput = Object.assign({}, i, { fire: i.fire && !frozen, aim: i.aim && !frozen });
    if (this.activeSlot !== 4) vm.update(dt, now, fireInput);
    else vm.update(dt, now, Object.assign(fireInput, { fire: false }));
    i.mouseDX = 0; i.mouseDY = 0;
    this.updateHitboxes();
    SP.Audio.setListener(cam.position, { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) });
  };

  Player.prototype.takeDamage = function (dmg, part, shooter, weaponDef, point, dir) {
    if (!this.alive) return;
    if (weaponDef.type !== 'melee' && this.shield > 0) { const absorbed = Math.min(this.shield, Math.round(dmg * 0.66)); this.shield -= absorbed; dmg -= absorbed; }
    this.hp -= dmg; this.lastDamageFrom = shooter; this.lastDamageTime = performance.now() / 1000;
    if (shooter) this.damagedBy[shooter.name] = (this.damagedBy[shooter.name] || 0) + dmg;
    SP.Audio.damageTaken(dmg > 40); SP.Effects.addShake(Math.min(1, dmg / 60));
    if (shooter && shooter.pos) SP.HUD.damageDirection(this, shooter.pos);
    SP.HUD.flashDamage(dmg);
    if (this.hp <= 0) { this.hp = 0; this.die(shooter, weaponDef, part === 'head'); }
    SP.HUD.refreshVitals(this);
  };
  Player.prototype.die = function (killer, weaponDef, headshot) {
    this.alive = false; this.deaths++; this.vel.set(0, 0, 0); this.viewmodel.cancelReload();
    SP.Audio.death(); this.updateHitboxes();
    SP.Game.onDeath(this, killer, weaponDef, headshot);
  };
  Player.prototype.respawn = function (spawn, yaw) {
    this.pos.set(spawn.x, 0, spawn.z); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = 0; this.pitchKick = 0; this.yawKick = 0;
    this.hp = 100; this.alive = true; this.roundKills = 0; this.damagedBy = {}; this.spectating = null; this.height = C.PLAYER_HEIGHT;
    for (const s of [1, 2]) { const w = this.weapons[s]; if (w) { w.mag = w.def.mag; w.reserve = w.def.reserve; w.reloading = false; w.boltT = 0; w.bloom = 0; w.shotIndex = 0; } }
    if (!this.weapons[2]) this.weapons[2] = SP.Weapons.makeInstance('hawk9');
    this.activeSlot = this.weapons[1] ? 1 : 2; this.viewmodel.setWeapon(this.weapons[this.activeSlot]);
    this.updateHitboxes(); SP.HUD.refreshVitals(this); SP.HUD.refreshWeapon(this);
  };
  /* Spectator camera: follow a teammate from behind their head */
  Player.prototype.updateSpectate = function (dt, target) {
    const cam = this.camera; if (!target) return;
    const eye = new THREE.Vector3(target.pos.x, target.pos.y + 1.75, target.pos.z);
    const back = new THREE.Vector3(Math.sin(target.yaw), 0.35, Math.cos(target.yaw)).multiplyScalar(1.6);
    const desired = eye.clone().add(back);
    cam.position.lerp(desired, Math.min(1, dt * 6)); cam.rotation.order = 'YXZ';
    cam.rotation.set(-0.15, target.yaw, 0);
    if (Math.abs(cam.fov - this.baseFov) > 0.1) { cam.fov = this.baseFov; cam.updateProjectionMatrix(); }
    this.viewmodel.root.visible = false;
    SP.Audio.setListener(cam.position, { x: -Math.sin(target.yaw), z: -Math.cos(target.yaw) });
  };
  return Player;
})();
