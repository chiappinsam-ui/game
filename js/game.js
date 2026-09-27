/* ======================================================================
   Strikepoint — match flow: rounds, economy, plant/defuse, kill streaks
   ====================================================================== */
SP.Game = (function () {
  const C = SP.CONFIG, U = SP.util;
  const G = {
    scene: null, camera: null, player: null, bots: [], sites: null,
    phase: 'idle', phaseTimeLeft: 0, roundNumber: 0, score: { ally: 0, enemy: 0 }, attackingTeam: 'ally', roundsToWin: 7,
    planted: false, plantedSite: null, chargePos: null, chargeMesh: null, defuser: null, attackPlan: { site: 'A' }, chargeCarrier: null,
    noiseBlips: [], time: 0, roundStartTime: 0, lossStreak: { ally: 0, enemy: 0 }, lastRoundResult: '', difficulty: 1,
    pickups: [], droppedCharge: null, running: false, roundWinner: null, matchStats: { headshots: 0, aces: 0, plants: 0, defuses: 0 }, beepT: 0, spectateIdx: 0, playerInteract: 0
  };

  G.init = function (scene, camera, player) {
    G.scene = scene; G.camera = camera; G.player = player; G.sites = SP.Map.sites;
    G.bots = [];
    C.BOT_NAMES_ALLY.forEach((n, i) => G.bots.push(new SP.Bot(n, 'ally', scene, i)));
    C.BOT_NAMES_ENEMY.forEach((n, i) => G.bots.push(new SP.Bot(n, 'enemy', scene, i)));
    // charge (bomb) mesh
    const cg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.36, 10), new THREE.MeshStandardMaterial({ color: 0x2a2e35, metalness: 0.6, roughness: 0.4 })); body.position.y = 0.18; body.castShadow = true; cg.add(body);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xffb347, emissiveIntensity: 2 })); core.position.y = 0.42; cg.add(core);
    for (let i = 0; i < 3; i++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.24), new THREE.MeshStandardMaterial({ color: 0x3f454d, metalness: 0.5, roughness: 0.5 })); fin.position.set(Math.cos(i * 2.094) * 0.24, 0.2, Math.sin(i * 2.094) * 0.24); fin.rotation.y = -i * 2.094; cg.add(fin); }
    const light = new THREE.PointLight(0xffb347, 0, 8, 2); light.position.y = 0.6; cg.add(light); cg.userData.light = light; cg.userData.core = core;
    cg.visible = false; scene.add(cg); G.chargeMesh = cg;
  };

  /* ---------- team helpers ---------- */
  G.getCombatants = () => [G.player].concat(G.bots);
  G.getTeam = t => G.getCombatants().filter(c => c.team === t);
  G.playerTeamIsAttacking = () => G.attackingTeam === 'ally';
  G.aliveCount = t => G.getTeam(t).filter(c => c.alive).length;
  G.halfLength = () => G.roundsToWin - 1;

  /* ---------- match ---------- */
  G.startMatch = function (opts) {
    G.roundsToWin = opts.rounds || 7; G.difficulty = opts.difficulty || 1;
    G.score = { ally: 0, enemy: 0 }; G.roundNumber = 0; G.attackingTeam = 'ally'; G.lossStreak = { ally: 0, enemy: 0 }; G.running = true;
    G.matchStats = { headshots: 0, aces: 0, plants: 0, defuses: 0 };
    const p = G.player; p.credits = C.START_CREDITS; p.kills = p.deaths = p.assists = 0; p.weapons[1] = null; p.weapons[2] = SP.Weapons.makeInstance('hawk9'); p.shield = 0; p.shieldMax = 0;
    for (const b of G.bots) { b.credits = C.START_CREDITS; b.kills = b.deaths = b.assists = 0; b.primary = null; b.armor = 0; b.difficulty = G.difficulty; }
    G.startRound(true);
  };
  G.startRound = function (freshHalf) {
    G.roundNumber++;
    const half = G.halfLength();
    if (G.roundNumber === half + 1) { G.attackingTeam = 'enemy'; freshHalf = true; SP.HUD.announce('SIDES SWAP — YOU NOW ' + (G.playerTeamIsAttacking() ? 'ATTACK' : 'DEFEND'), 4000); }
    G.planted = false; G.plantedSite = null; G.chargePos = null; G.defuser = null; G.chargeMesh.visible = false; G.roundWinner = null; G.lastRoundResult = '';
    G.attackPlan = { site: Math.random() < 0.5 ? 'A' : 'B' }; G.noiseBlips.length = 0; G.clearPickups(); G.droppedCharge = null; if (G.chargePickupMesh) G.chargePickupMesh.visible = false;
    const attSpawns = SP.Map.spawns.att.slice(), defSpawns = SP.Map.spawns.def.slice();
    const p = G.player; const pAtt = G.playerTeamIsAttacking();
    // player
    const ps = pAtt ? attSpawns.shift() : defSpawns.shift();
    if (freshHalf) { p.weapons[1] = null; p.weapons[2] = SP.Weapons.makeInstance('hawk9'); p.shield = 0; p.shieldMax = 0; if (G.roundNumber > 1) p.credits = C.START_CREDITS; }
    else if (!p.survivedLast) { p.weapons[1] = null; p.weapons[2] = SP.Weapons.makeInstance('hawk9'); p.shield = 0; p.shieldMax = 0; }
    p.respawn({ x: ps[0], z: ps[1] }, pAtt ? 0 : Math.PI); p.setCharge(false);
    // bots
    for (const b of G.bots) {
      const isAtt = (b.team === G.attackingTeam); const s = isAtt ? attSpawns.shift() : defSpawns.shift();
      const keep = !freshHalf && b.survivedLast; if (freshHalf && G.roundNumber > 1) b.credits = C.START_CREDITS;
      b.resetForRound({ x: s[0], z: s[1] }, isAtt ? 0 : Math.PI, keep); b.difficulty = G.difficulty;
      G.botBuy(b);
    }
    // charge carrier: player 45% of the time when attacking, else a random attacking bot
    const attackers = G.getTeam(G.attackingTeam);
    const carrier = (pAtt && Math.random() < 0.45) ? p : U.pick(attackers.filter(c => c.isBot));
    if (carrier.isPlayer) p.setCharge(true); else carrier.hasCharge = true; G.chargeCarrier = carrier;
    // phase
    G.phase = 'buy'; G.phaseTimeLeft = (G.roundNumber === 1 || G.roundNumber === half + 1) ? C.FIRST_BUY_TIME : C.BUY_TIME;
    SP.HUD.roundBanner('ROUND ' + G.roundNumber, pAtt ? (carrier.isPlayer ? 'YOU CARRY THE CHARGE — PLANT AT A OR B' : 'ATTACK · PLANT THE CHARGE AT A OR B') : 'DEFEND · STOP THE PLANT OR DEFUSE', '', 3200);
    SP.HUD.buyHint(true); SP.HUD.spikeStatus(false); SP.HUD.spectate(false); SP.HUD.refreshVitals(p); SP.HUD.refreshWeapon(p);
    SP.Audio.roundStart();
    if (G.roundNumber === 1) SP.Audio.say(pAtt ? 'Attackers. Plant the charge.' : 'Defenders. Hold the sites.');
  };
  G.goLive = function () {
    G.phase = 'live'; G.phaseTimeLeft = C.ROUND_TIME; G.roundStartTime = G.time; SP.HUD.buyHint(false); SP.HUD.showBuy(false, G);
    SP.HUD.announce(G.playerTeamIsAttacking() ? 'GO — PLANT AT ' + G.attackPlan.site + ' (TEAM PLAN)' : 'HOLD THE SITES', 2500);
    for (const b of G.bots) { b.state = 'idle'; b.nextThink = G.time + Math.random() * 0.5; }
  };
  G.endRound = function (winner, reason) {
    if (G.phase !== 'live') return;
    G.phase = 'ending'; G.phaseTimeLeft = C.POST_ROUND_TIME; G.roundWinner = winner; G.score[winner]++;
    const playerWon = winner === 'ally'; G.lastRoundResult = playerWon ? 'ROUND WON' : 'ROUND LOST';
    SP.HUD.roundBanner(playerWon ? 'ROUND WON' : 'ROUND LOST', reason, playerWon ? 'win' : 'loss', 4000);
    SP.Audio.roundEnd(playerWon); SP.Audio.say(playerWon ? 'Round won.' : 'Round lost.');
    // economy
    for (const t of ['ally', 'enemy']) {
      const won = t === winner;
      if (won) G.lossStreak[t] = 0; else G.lossStreak[t] = Math.min(C.LOSS_STREAK_MAX, G.lossStreak[t] + 1);
      const reward = won ? C.WIN_REWARD : C.LOSS_REWARD + (G.lossStreak[t] - (G.lossStreak[t] > 0 ? 1 : 0)) * C.LOSS_STREAK_BONUS;
      for (const c of G.getTeam(t)) { c.credits = Math.min(C.MAX_CREDITS, c.credits + reward); c.survivedLast = c.alive; }
    }
    if (G.planted && winner === G.attackingTeam) for (const c of G.getTeam(G.attackingTeam)) c.credits = Math.min(C.MAX_CREDITS, c.credits + C.PLANT_REWARD);
    SP.HUD.refreshVitals(G.player);
    if (G.score[winner] >= G.roundsToWin) { G.phaseTimeLeft = 4; G.matchOver = true; }
  };
  G.endMatch = function () {
    G.phase = 'matchend'; G.running = false; SP.Main.showEndScreen(G.score.ally > G.score.enemy);
  };

  /* ---------- economy: buying ---------- */
  G.buyWeapon = function (id) {
    const p = G.player; const w = SP.WEAPONS[id]; if (G.phase !== 'buy') return;
    if (p.weapons[w.slot] && p.weapons[w.slot].id === id) { SP.Audio.ui('deny'); return; }
    if (p.credits < w.price) { SP.Audio.ui('deny'); SP.HUD.announce('NOT ENOUGH CREDITS', 1200); return; }
    // refund the weapon currently in that slot (full price)
    if (p.weapons[w.slot] && p.weapons[w.slot].def.price) p.credits += p.weapons[w.slot].def.price;
    p.credits -= w.price; p.giveWeapon(id); SP.Audio.ui('buy'); SP.HUD.refreshVitals(p); SP.HUD.buildBuyMenu(G);
  };
  G.buyArmor = function (id) {
    const p = G.player; const a = SP.ARMOR[id]; if (G.phase !== 'buy') return;
    if (p.shieldMax === a.hp && p.shield === a.hp) { SP.Audio.ui('deny'); return; }
    let price = a.price; if (id === 'heavy' && p.shieldMax === 25) price -= 400;
    if (p.credits < price) { SP.Audio.ui('deny'); SP.HUD.announce('NOT ENOUGH CREDITS', 1200); return; }
    p.credits -= price; p.shield = a.hp; p.shieldMax = a.hp; SP.Audio.ui('buy'); SP.HUD.refreshVitals(p); SP.HUD.buildBuyMenu(G);
  };
  G.botBuy = function (b) {
    let cr = b.credits; const buy = (id) => { cr -= SP.WEAPONS[id].price; b.equip(id); }; const armor = hp => { cr -= hp === 50 ? 1000 : 400; b.armor = hp; b.shield = hp; };
    const hasRifle = b.primary && (b.primary.def.type === 'rifle' || b.primary.def.type === 'sniper' || b.primary.def.type === 'lmg');
    if (!hasRifle) {
      if (cr >= 5700 && Math.random() < 0.25) { buy('longbow'); if (cr >= 400) armor(cr >= 1000 ? 50 : 25); }
      else if (cr >= 3900) { buy(Math.random() < 0.5 ? 'raptor' : 'kestrel'); armor(50); }
      else if (cr >= 2900 && Math.random() < 0.6) { buy(Math.random() < 0.5 ? 'raptor' : 'kestrel'); if (cr >= 400) armor(25); }
      else if (cr >= 2000) { buy(Math.random() < 0.6 ? 'hornet' : 'bulwark'); if (cr >= 400) armor(cr >= 1000 ? 50 : 25); }
      else if (cr >= 1300) { buy(Math.random() < 0.6 ? 'hornet' : 'breacher'); if (cr >= 400) armor(25); }
      else if (cr >= 1200 && Math.random() < 0.5) { cr -= 800; b.equipSidearm('warden'); armor(25); }
      else if (cr >= 800 && Math.random() < 0.5) { cr -= 800; b.equipSidearm('warden'); }
      else if (cr >= 400) armor(25);
    } else { if (b.armor < 50 && cr >= 1000) armor(50); else if (!b.armor && cr >= 400) armor(25); }
    b.credits = Math.max(0, cr); b.weapon = b.primary || b.sidearm; b.setGunModel(b.weapon.id); b.shield = b.armor;
  };

  /* ---------- charge ---------- */
  G.carrierAlive = function () { return G.getTeam(G.attackingTeam).some(c => c.alive && c.hasCharge); };
  G.dropCharge = function (pos) {
    if (!G.chargePickupMesh) {
      const m = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.2), new THREE.MeshStandardMaterial({ color: 0x2a2e35, metalness: 0.6, roughness: 0.4 })); body.position.y = 0.2; body.castShadow = true; m.add(body);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xffb347, emissiveIntensity: 2.5 })); core.position.set(0, 0.28, 0.11); m.add(core);
      const light = new THREE.PointLight(0xffb347, 1.2, 6, 2); light.position.y = 0.6; m.add(light);
      G.scene.add(m); G.chargePickupMesh = m;
    }
    const gy = SP.Map.groundHeight(pos.x, pos.z, 0.2, pos.y + 0.5);
    G.chargePickupMesh.position.set(pos.x, gy, pos.z); G.chargePickupMesh.visible = true;
    G.droppedCharge = { pos: new THREE.Vector3(pos.x, gy, pos.z) }; G.chargeCarrier = null;
    if (G.playerTeamIsAttacking()) SP.HUD.announce('CHARGE DROPPED', 2000);
  };
  G.pickupCharge = function (who) {
    if (!G.droppedCharge) return;
    if (who.isPlayer) who.setCharge(true); else who.hasCharge = true;
    G.chargeCarrier = who; G.droppedCharge = null; if (G.chargePickupMesh) G.chargePickupMesh.visible = false;
    if (who.isPlayer) { SP.HUD.announce('YOU HAVE THE CHARGE', 2000); SP.Audio.ui('buy'); } else if (G.playerTeamIsAttacking()) SP.HUD.announce(who.name.toUpperCase() + ' PICKED UP THE CHARGE', 2000);
  };
  G.plantCharge = function (who) {
    if (G.planted || G.phase !== 'live') return;
    G.planted = true; G.plantedSite = SP.Map.inZone(G.sites.A.zone, who.pos.x, who.pos.z) ? 'A' : 'B'; G.chargePos = who.pos.clone();
    G.chargeMesh.position.copy(G.chargePos); G.chargeMesh.visible = true; G.phaseTimeLeft = C.PLANT_TIME; G.defuser = null;
    if (who.isPlayer) { who.setCharge(false); G.matchStats.plants++; who.credits = Math.min(C.MAX_CREDITS, who.credits + C.PLANT_REWARD); SP.HUD.refreshVitals(who); } else who.hasCharge = false;
    G.chargeCarrier = null;
    SP.HUD.announce('CHARGE PLANTED AT ' + G.plantedSite, 3000); SP.HUD.spikeStatus(true, C.PLANT_TIME); SP.Audio.stinger('planted'); SP.Audio.say('Charge planted at ' + G.plantedSite + '.');
    for (const b of G.bots) if (b.alive) { b.state = 'idle'; b.goal = null; }
  };
  G.defuseCharge = function (who) {
    if (!G.planted) return; G.planted = false; G.chargeMesh.visible = false; SP.HUD.spikeStatus(false);
    if (who.isPlayer) G.matchStats.defuses++;
    SP.Audio.stinger('defused'); SP.Audio.say('Charge defused.');
    G.endRound(G.attackingTeam === 'ally' ? 'enemy' : 'ally', 'CHARGE DEFUSED BY ' + who.name.toUpperCase());
  };
  G.detonate = function () {
    G.planted = false; G.chargeMesh.visible = false; SP.HUD.spikeStatus(false);
    SP.Effects.explosion(G.chargePos.clone().add(new THREE.Vector3(0, 0.5, 0))); SP.Audio.explosion(G.chargePos);
    for (const c of G.getCombatants()) { if (!c.alive) continue; const d = c.pos.distanceTo(G.chargePos); if (d < 12) { c.takeDamage(999, 'body', null, { type: 'explosion', name: 'CHARGE' }, c.pos, null); } }
    if (G.player.alive && G.player.pos.distanceTo(G.chargePos) < 40) SP.HUD.flashbang(Math.max(0.2, 1 - G.player.pos.distanceTo(G.chargePos) / 45));
    G.endRound(G.attackingTeam, 'CHARGE DETONATED');
  };

  /* ---------- events ---------- */
  G.onDeath = function (victim, killer, weaponDef, headshot) {
    const p = G.player;
    if (killer && killer !== victim && killer.team !== victim.team) {
      killer.kills++; killer.roundKills = (killer.roundKills || 0) + 1; killer.credits = Math.min(C.MAX_CREDITS, killer.credits + C.KILL_REWARD);
      // assists
      for (const c of G.getTeam(killer.team)) { if (c !== killer && (victim.damagedBy[c.name] || 0) >= 40) c.assists++; }
    }
    SP.HUD.killfeed(killer, victim, weaponDef, headshot, (killer && killer.isPlayer) || victim.isPlayer);
    if (killer && killer.isPlayer) {
      if (headshot) G.matchStats.headshots++;
      const tier = Math.min(5, killer.roundKills);
      SP.Audio.killSound(tier, headshot); SP.HUD.streak(tier); SP.HUD.refreshVitals(p);
      const s = SP.STREAKS[tier]; if (s && s.voice) setTimeout(() => SP.Audio.say(s.voice, { pitch: tier >= 5 ? 0.5 : 0.6, rate: tier >= 5 ? 0.8 : 0.95 }), tier >= 5 ? 450 : 200);
      if (tier === 5) { G.matchStats.aces++; SP.Effects.addShake(0.6); }
    }
    if (victim.isPlayer) {
      SP.HUD.announce(killer ? 'KILLED BY ' + killer.name.toUpperCase() + (headshot ? ' — HEADSHOT' : '') : 'KILLED BY THE CHARGE', 3000);
      G.spectateIdx = 0; SP.HUD.setScoped(false);
    }
    // drop the charge if the carrier died
    if (victim.hasCharge && !G.planted) { if (victim.isPlayer) victim.setCharge(false); else victim.hasCharge = false; G.dropCharge(victim.pos); }
    // drop weapon pickup
    if (victim.isBot && victim.weapon && victim.weapon.def.type !== 'melee' && victim.weapon.def.price > 0) G.dropWeaponPickup(victim.weapon, victim.pos, victim.yaw);
    // last alive callouts
    const aliveA = G.aliveCount('ally'), aliveE = G.aliveCount('enemy');
    if (p.alive && aliveA === 1 && aliveE > 0 && victim.team === 'ally' && G.phase === 'live') { SP.Audio.stinger('lastalive'); SP.HUD.announce('YOU ARE THE LAST ONE STANDING — ' + aliveE + ' ENEMIES LEFT', 3000); }
    if (aliveE === 1 && aliveA > 1 && victim.team === 'enemy' && G.phase === 'live') SP.HUD.announce('ONE ENEMY REMAINING', 2000);
    G.checkRoundEnd();
  };
  G.checkRoundEnd = function () {
    if (G.phase !== 'live') return;
    const att = G.attackingTeam, def = att === 'ally' ? 'enemy' : 'ally';
    if (G.aliveCount(def) === 0) { G.endRound(att, 'ALL DEFENDERS ELIMINATED'); return; }
    if (G.aliveCount(att) === 0 && !G.planted) { G.endRound(def, 'ALL ATTACKERS ELIMINATED'); return; }
  };
  G.onNoise = function (source, radius) {
    for (const b of G.bots) { if (b === source || !b.alive) continue; const d = b.pos.distanceTo(source.pos); if (d < radius) b.hearNoise(source, source.pos); }
    if (source.team !== 'ally' && source.pos.distanceTo(G.player.pos) < 32) G.noiseBlips.push({ x: source.pos.x, z: source.pos.z, t: 1 });
  };
  G.onPlayerShot = function (origin, def) { G.onNoise(G.player, def.sound === 'rifleQuiet' ? 22 : 50); };

  /* ---------- weapon pickups ---------- */
  G.dropWeaponPickup = function (inst, pos, yaw) {
    const m = SP.Weapons.buildModel(inst.id); m.position.set(pos.x + U.rand(-0.3, 0.3), SP.Map.groundHeight(pos.x, pos.z, 0.2, pos.y + 0.5) + 0.06, pos.z + U.rand(-0.3, 0.3));
    m.rotation.set(Math.PI / 2, 0, yaw + U.rand(-0.5, 0.5)); m.scale.set(1.15, 1.15, 1.15); G.scene.add(m);
    G.pickups.push({ inst, mesh: m });
  };
  G.clearPickups = function () { for (const p of G.pickups) G.scene.remove(p.mesh); G.pickups.length = 0; };
  G.nearestPickup = function () { const p = G.player; let best = null, bd = 1.6; for (const pk of G.pickups) { const d = pk.mesh.position.distanceTo(p.pos); if (d < bd) { bd = d; best = pk; } } return best; };
  G.pickUp = function (pk) {
    const p = G.player; const slot = pk.inst.def.slot;
    if (p.weapons[slot]) { G.dropWeaponPickup(p.weapons[slot], p.pos, p.yaw); }
    p.weapons[slot] = pk.inst; p.activeSlot = slot; p.viewmodel.setWeapon(pk.inst); SP.HUD.refreshWeapon(p);
    G.scene.remove(pk.mesh); G.pickups.splice(G.pickups.indexOf(pk), 1); SP.Audio.ui('switch');
  };

  /* ---------- per-frame ---------- */
  G.update = function (dt, input) {
    if (!G.running && G.phase !== 'matchend') return;
    G.time += dt; const p = G.player;
    // phase timers
    if (G.phase === 'buy') { G.phaseTimeLeft -= dt; if (G.phaseTimeLeft <= 0) G.goLive(); }
    else if (G.phase === 'live') {
      G.phaseTimeLeft -= dt;
      if (G.planted) { SP.HUD.spikeStatus(true, G.phaseTimeLeft); G.updateChargeFx(dt); if (G.phaseTimeLeft <= 0) G.detonate(); }
      else if (G.phaseTimeLeft <= 0) G.endRound(G.attackingTeam === 'ally' ? 'enemy' : 'ally', 'TIME EXPIRED');
      if (G.phaseTimeLeft <= 10 && G.phaseTimeLeft + dt > 10 && !G.planted) SP.HUD.announce('10 SECONDS', 1500);
    }
    else if (G.phase === 'ending') { G.phaseTimeLeft -= dt; if (G.phaseTimeLeft <= 0) { if (G.matchOver) { G.matchOver = false; G.endMatch(); return; } G.startRound(false); } }
    // player
    if (p.alive) { p.viewmodel.root.visible = true; p.update(dt, G.time, G); G.handleInteraction(dt); }
    else { G.updateSpectate(dt); }
    // bots
    for (const b of G.bots) b.update(dt, G);
    // spotting for minimap: enemies visible from player's view
    if (p.alive) { const eye = p.camera.position; for (const b of G.bots) { if (b.team === 'enemy' && b.alive) { const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z; const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); const d = Math.hypot(dx, dz); if (d < 60 && (fx * dx + fz * dz) / d > 0.3 && SP.Map.hasLOS(eye, new THREE.Vector3(b.pos.x, b.pos.y + 1.2, b.pos.z))) b.lastSpottedT = G.time; } } }
    for (const b of G.bots) if (b.team === 'ally' && b.alive) for (const e of G.bots) if (e.team === 'enemy' && e.alive && b.state === 'engage' && b.target === e) e.lastSpottedT = G.time;
    // noise blips decay
    for (let i = G.noiseBlips.length - 1; i >= 0; i--) { G.noiseBlips[i].t -= dt * 0.9; if (G.noiseBlips[i].t <= 0) G.noiseBlips.splice(i, 1); }
    // pickups: gentle bob
    for (const pk of G.pickups) pk.mesh.rotation.z += dt * 0.3;
    SP.HUD.update(dt, G);
  };
  G.updateChargeFx = function (dt) {
    const t = G.phaseTimeLeft; const rate = t > 25 ? 1 : t > 10 ? 0.5 : t > 5 ? 0.25 : 0.12;
    G.beepT -= dt; if (G.beepT <= 0) { G.beepT = rate; SP.Audio.beep(G.chargePos, t > 10 ? 1400 : 1900, 0.8); G.chargeMesh.userData.light.intensity = 3; }
    G.chargeMesh.userData.light.intensity *= Math.max(0, 1 - dt * 8); G.chargeMesh.userData.core.material.emissiveIntensity = 1 + G.chargeMesh.userData.light.intensity;
    G.chargeMesh.rotation.y += dt * 0.6;
  };
  G.handleInteraction = function (dt) {
    const p = G.player; const isAtt = G.playerTeamIsAttacking();
    if (G.phase !== 'live') { SP.HUD.interact(null); G.playerInteract = 0; return; }
    // plant
    if (isAtt && p.hasCharge && !G.planted) {
      const inA = SP.Map.inZone(G.sites.A.zone, p.pos.x, p.pos.z), inB = SP.Map.inZone(G.sites.B.zone, p.pos.x, p.pos.z);
      if (inA || inB) {
        if (p.input.interact) { G.playerInteract += dt; if (Math.floor(G.playerInteract * 4) !== Math.floor((G.playerInteract - dt) * 4)) SP.Audio.plantProgress(Math.floor(G.playerInteract * 4)); if (G.playerInteract >= C.PLANT_DURATION) { G.plantCharge(p); G.playerInteract = 0; SP.HUD.interact(null); return; } }
        else G.playerInteract = Math.max(0, G.playerInteract - dt * 3);
        SP.HUD.interact(p.input.interact ? 'PLANTING…' : 'HOLD E TO PLANT THE CHARGE', G.playerInteract / C.PLANT_DURATION); return;
      }
    }
    // defuse
    if (!isAtt && G.planted && G.chargePos && p.pos.distanceTo(G.chargePos) < 1.9) {
      if (p.input.interact) { G.playerInteract += dt; if (Math.floor(G.playerInteract * 3) !== Math.floor((G.playerInteract - dt) * 3)) SP.Audio.plantProgress(Math.floor(G.playerInteract * 2)); if (G.playerInteract >= C.DEFUSE_DURATION) { G.defuseCharge(p); G.playerInteract = 0; SP.HUD.interact(null); return; } }
      else G.playerInteract = Math.max(0, G.playerInteract - dt * 2);
      SP.HUD.interact(p.input.interact ? 'DEFUSING…' : 'HOLD E TO DEFUSE (7s)', G.playerInteract / C.DEFUSE_DURATION); return;
    }
    // charge pickup
    if (isAtt && !G.planted && G.droppedCharge && p.pos.distanceTo(G.droppedCharge.pos) < 1.9) {
      SP.HUD.interact('E — PICK UP THE CHARGE', 0); if (p.input.interact && !G.pickupHeld) { G.pickupCharge(p); G.pickupHeld = true; } if (!p.input.interact) G.pickupHeld = false; return;
    }
    // weapon pickup
    const pk = G.nearestPickup();
    if (pk) { SP.HUD.interact('E — PICK UP ' + pk.inst.def.name, 0); if (p.input.interact && !G.pickupHeld) { G.pickUp(pk); G.pickupHeld = true; } if (!p.input.interact) G.pickupHeld = false; return; }
    G.playerInteract = 0; SP.HUD.interact(null);
  };
  G.updateSpectate = function (dt) {
    const p = G.player; const allies = G.getTeam('ally').filter(c => c.isBot && c.alive);
    if (!allies.length) { SP.HUD.spectate(true, '—', G.phase === 'live' ? 'Your team has been eliminated' : ''); // free cam: hover over the map centre
      p.camera.position.lerp(new THREE.Vector3(p.pos.x, 12, p.pos.z + 6), Math.min(1, dt * 2)); p.camera.rotation.order = 'YXZ'; p.camera.rotation.set(-1.0, 0, 0); p.viewmodel.root.visible = false; return; }
    const t = allies[G.spectateIdx % allies.length]; p.spectating = t; p.updateSpectate(dt, t);
    SP.HUD.spectate(true, t.name, G.aliveCount('enemy') + ' enemies left · click to switch');
  };
  G.nextSpectate = function () { G.spectateIdx++; };
  return G;
})();
