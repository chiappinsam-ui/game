/* ======================================================================
   Strikepoint — HUD, buy menu, scoreboard, minimap, banners
   ====================================================================== */
SP.HUD = (function () {
  const $ = id => document.getElementById(id);
  const el = {};
  let vignetteT = 0, hitT = 0, streakTimer = null, announceTimer = null, roundBannerTimer = null;
  let minimapOn = true, mm, mmCtx;
  const dmgArrows = [];

  function init() {
    ['hud', 'crosshair', 'hitmarker', 'scope', 'vignette', 'flashbang', 'dmg-dir', 'score-ally', 'score-enemy', 'round-phase', 'round-timer', 'round-num', 'alive-ally', 'alive-enemy', 'minimap', 'hp-val', 'sh-val', 'hp-bar', 'sh-bar', 'cred-val', 'weapon-name', 'ammo', 'ammo-mag', 'ammo-res', 'slot-primary', 'slot-secondary', 'slot-charge', 'reload-hint', 'killfeed', 'announce', 'streak-banner', 'round-banner', 'interact-prompt', 'spike-status', 'spike-timer', 'spectate', 'spec-name', 'spec-hint', 'buy-hint', 'buy-menu', 'buy-cred', 'scoreboard', 'sb-score', 'sb-ally', 'sb-enemy', 'buy-team']
      .forEach(id => el[id] = $(id));
    mm = el.minimap; mmCtx = mm.getContext('2d');
    for (let i = 0; i < 5; i++) { el['alive-ally'].appendChild(document.createElement('i')); el['alive-enemy'].appendChild(document.createElement('i')); }
  }
  function show(on) { el.hud.hidden = !on; }

  /* ---------- vitals / weapon ---------- */
  function refreshVitals(p) {
    el['hp-val'].textContent = Math.max(0, Math.round(p.hp)); el['hp-bar'].style.width = Math.max(0, p.hp) + '%';
    el['sh-val'].textContent = Math.round(p.shield); el['sh-bar'].style.width = (p.shieldMax ? (p.shield / p.shieldMax) * 100 : 0) + '%';
    el['hp-val'].parentElement.classList.toggle('low', p.hp <= 30);
    el['cred-val'].textContent = p.credits; el['buy-cred'].textContent = p.credits;
  }
  function refreshWeapon(p) {
    const w = p.activeWeapon(); if (!w) return;
    el['weapon-name'].textContent = w.def.name;
    if (w.def.type === 'melee' || w.def.type === 'charge') { el['ammo-mag'].textContent = w.def.type === 'melee' ? '—' : '1'; el['ammo-res'].textContent = ''; el.ammo.classList.remove('low'); }
    else { el['ammo-mag'].textContent = w.mag; el['ammo-res'].textContent = w.reserve; el.ammo.classList.toggle('low', w.mag <= Math.ceil(w.def.mag * 0.25)); }
    el['slot-primary'].textContent = p.weapons[1] ? p.weapons[1].def.name : '—'; el['slot-secondary'].textContent = p.weapons[2] ? p.weapons[2].def.name : '—';
    el['slot-charge'].hidden = !p.hasCharge;
    document.querySelectorAll('#weapon-slots .slot').forEach(s => s.classList.toggle('active', +s.dataset.slot === p.activeSlot));
    el['reload-hint'].hidden = !w.reloading;
  }
  function updateCrosshair(p) {
    const vm = p.viewmodel; const w = p.activeWeapon(); if (!w) return;
    const spread = vm.currentSpread ? vm.currentSpread() : 0;
    const gap = 4 + spread * 9; el.crosshair.style.setProperty('--gap', gap.toFixed(1) + 'px');
    const hideCH = (w.def.scoped && vm.ads > 0.5) || w.def.type === 'charge' || (vm.ads > 0.6 && !w.def.scoped && false);
    el.crosshair.style.opacity = hideCH ? 0 : 1;
    el['reload-hint'].hidden = !w.reloading;
    if (w.def.type !== 'melee' && w.def.type !== 'charge') { el['ammo-mag'].textContent = w.mag; el['ammo-res'].textContent = w.reserve; el.ammo.classList.toggle('low', w.mag <= Math.ceil(w.def.mag * 0.25)); }
  }
  function setScoped(on) { el.scope.hidden = !on; }
  function hitmarker(kill, head) {
    el.hitmarker.className = 'show' + (kill ? ' kill' : '') + (head ? ' head' : ''); hitT = 0.12;
  }
  function flashDamage(dmg) { vignetteT = Math.min(1, vignetteT + dmg / 60); el.vignette.style.opacity = Math.min(0.95, vignetteT); }
  function damageDirection(p, fromPos) {
    const dx = fromPos.x - p.pos.x, dz = fromPos.z - p.pos.z; const ang = Math.atan2(dx, -dz) - (-p.yaw);
    const a = document.createElement('div'); a.className = 'arrow'; a.style.transform = `rotate(${ang}rad)`; el['dmg-dir'].appendChild(a);
    dmgArrows.push({ a, t: 1.2 });
  }
  function flashbang(intensity) { el.flashbang.style.transition = 'none'; el.flashbang.style.opacity = intensity; requestAnimationFrame(() => { el.flashbang.style.transition = 'opacity 1.8s ease-in'; el.flashbang.style.opacity = 0; }); }

  /* ---------- feed / banners ---------- */
  function killfeed(killer, victim, weaponDef, headshot, involvesPlayer) {
    const row = document.createElement('div'); row.className = 'kf' + (involvesPlayer ? ' me' : '');
    const kc = killer ? (killer.team === 'ally' ? 'a' : 'e') : 'e', vc = victim.team === 'ally' ? 'a' : 'e';
    row.innerHTML = `<span class="${kc}">${killer ? killer.name : 'CHARGE'}</span><span class="w">${weaponDef ? weaponDef.name : 'EXPLOSION'}</span>${headshot ? '<span class="hs">◎ HS</span>' : ''}<span class="${vc}">${victim.name}</span>`;
    el.killfeed.prepend(row); while (el.killfeed.children.length > 6) el.killfeed.lastChild.remove();
    setTimeout(() => { row.style.opacity = 0; row.style.transition = 'opacity .6s'; setTimeout(() => row.remove(), 650); }, 6000);
  }
  function announce(text, ms) { el.announce.textContent = text; el.announce.style.opacity = 1; clearTimeout(announceTimer); announceTimer = setTimeout(() => { el.announce.style.opacity = 0; }, ms || 2200); }
  function streak(tier) {
    const s = SP.STREAKS[tier]; if (!s) return;
    const b = el['streak-banner']; b.className = 't' + tier; b.querySelector('.streak-title').textContent = s.title; b.querySelector('.streak-sub').textContent = s.sub;
    void b.offsetWidth; b.classList.add('pop'); clearTimeout(streakTimer);
    streakTimer = setTimeout(() => b.classList.add('hide'), tier >= 5 ? 3800 : 1800);
  }
  function roundBanner(title, sub, cls, ms) {
    const b = el['round-banner']; b.className = cls || ''; b.querySelector('.rb-title').textContent = title; b.querySelector('.rb-sub').textContent = sub || '';
    clearTimeout(roundBannerTimer); roundBannerTimer = setTimeout(() => b.classList.add('hide'), ms || 3000);
  }
  function interact(text, frac) { const ip = el['interact-prompt']; if (text == null) { ip.hidden = true; return; } ip.hidden = false; ip.querySelector('.ip-text').textContent = text; ip.querySelector('i').style.width = Math.round((frac || 0) * 100) + '%'; }
  function spikeStatus(on, t) { el['spike-status'].hidden = !on; if (on) el['spike-timer'].textContent = Math.ceil(t); }
  function spectate(on, name, hint) { el.spectate.hidden = !on; if (on) { el['spec-name'].textContent = name || ''; el['spec-hint'].textContent = hint || ''; } }
  function buyHint(on) { el['buy-hint'].hidden = !on; }

  /* ---------- top bar ---------- */
  function topbar(g) {
    el['score-ally'].textContent = g.score.ally; el['score-enemy'].textContent = g.score.enemy;
    const names = { buy: 'BUY PHASE', live: g.planted ? 'CHARGE PLANTED' : 'ROUND LIVE', ending: g.lastRoundResult || 'ROUND OVER', matchend: 'MATCH OVER' };
    el['round-phase'].textContent = names[g.phase] || ''; el['round-phase'].style.color = g.planted && g.phase === 'live' ? 'var(--enemy)' : 'var(--gold)';
    el['round-timer'].textContent = SP.util.fmtTime(g.phaseTimeLeft); el['round-timer'].classList.toggle('low', g.phase === 'live' && g.phaseTimeLeft <= 10);
    el['round-num'].textContent = 'ROUND ' + g.roundNumber + ' · ' + (g.playerTeamIsAttacking() ? 'ATTACK' : 'DEFEND');
    const allies = g.getTeam('ally'), enemies = g.getTeam('enemy');
    [...el['alive-ally'].children].forEach((i, k) => i.classList.toggle('on', !!(allies[k] && allies[k].alive)));
    [...el['alive-enemy'].children].forEach((i, k) => i.classList.toggle('on', !!(enemies[k] && enemies[k].alive)));
  }

  /* ---------- minimap ---------- */
  function drawMinimap(g) {
    if (!minimapOn) { mm.style.display = 'none'; return; } mm.style.display = '';
    const ctx = mmCtx, W = mm.width, H = mm.height; const b = SP.Map.bounds; const sx = W / (b.x1 - b.x0), sz = H / (b.z1 - b.z0);
    const tx = x => (x - b.x0) * sx, tz = z => (z - b.z0) * sz;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(20,28,38,0.9)'; ctx.fillRect(0, 0, W, H);
    for (const r of SP.Map.minimapRects) { ctx.fillStyle = r.kind === 'wall' ? 'rgba(150,170,190,0.55)' : 'rgba(150,170,190,0.28)'; ctx.fillRect(tx(r.x), tz(r.z), Math.max(1.5, r.w * sx), Math.max(1.5, r.d * sz)); }
    // sites
    for (const k of ['A', 'B']) { const z = SP.Map.sites[k].zone; ctx.strokeStyle = 'rgba(255,179,71,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(tx(z.x0), tz(z.z0), (z.x1 - z.x0) * sx, (z.z1 - z.z0) * sz); ctx.fillStyle = 'rgba(255,179,71,0.9)'; ctx.font = 'bold 11px Rajdhani, Arial'; ctx.fillText(k, tx((z.x0 + z.x1) / 2) - 3, tz((z.z0 + z.z1) / 2) + 4); }
    if (g.droppedCharge) { ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(tx(g.droppedCharge.pos.x), tz(g.droppedCharge.pos.z), 3.5, 0, 6.283); ctx.fill(); }
    if (g.planted && g.chargePos) { ctx.fillStyle = (Math.floor(g.time * 4) % 2) ? '#ff4b5c' : '#fff'; ctx.beginPath(); ctx.arc(tx(g.chargePos.x), tz(g.chargePos.z), 4, 0, 6.283); ctx.fill(); }
    // combatants
    for (const c of g.getCombatants()) {
      if (!c.alive) continue; const isAlly = c.team === 'ally';
      if (!isAlly && !(g.time - (c.lastSpottedT || -10) < 2.5)) continue; // enemies only if recently spotted
      ctx.save(); ctx.translate(tx(c.pos.x), tz(c.pos.z)); ctx.rotate(-c.yaw + Math.PI);
      ctx.fillStyle = c.isPlayer ? '#ffffff' : (isAlly ? '#2ee6c8' : '#ff4b5c');
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(4, 4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // noise blips
    for (const n of g.noiseBlips) { const a = Math.max(0, n.t); ctx.strokeStyle = `rgba(255,80,90,${a})`; ctx.beginPath(); ctx.arc(tx(n.x), tz(n.z), (1.2 - a) * 10 + 3, 0, 6.283); ctx.stroke(); }
    ctx.fillStyle = 'rgba(138,155,176,0.9)'; ctx.font = '10px Barlow, Arial'; ctx.fillText('FOUNDRY', 6, H - 6);
  }
  function toggleMinimap() { minimapOn = !minimapOn; }

  /* ---------- buy menu ---------- */
  function buildBuyMenu(g) {
    const p = g.player;
    const cols = { side: 'buy-side', mid: 'buy-mid', rifle: 'buy-rifle', heavy: 'buy-heavy' };
    for (const [key, id] of Object.entries(cols)) {
      const c = $(id); c.innerHTML = '';
      for (const wid of SP.BUY_LAYOUT[key]) {
        const w = SP.WEAPONS[wid]; const owned = (p.weapons[w.slot] && p.weapons[w.slot].id === wid);
        const b = document.createElement('button'); b.className = 'buy-item' + (owned ? ' owned' : (p.credits < w.price ? ' cant' : '')); b.type = 'button';
        b.innerHTML = `<span class="n">${w.name}</span><span class="p">${owned ? 'OWNED' : (w.price ? '◆ ' + w.price : 'FREE')}</span><span class="d">${w.desc} · ${w.damage.body}/${w.damage.head} dmg · ${w.mag} rds</span>`;
        const cv = document.createElement('canvas'); cv.width = 240; cv.height = 44; drawWeaponIcon(cv, wid); b.appendChild(cv);
        b.onclick = () => g.buyWeapon(wid); c.appendChild(b);
      }
    }
    const ac = $('buy-armor'); ac.innerHTML = '';
    for (const a of Object.values(SP.ARMOR)) {
      const owned = p.shieldMax === a.hp && p.shield > 0;
      const b = document.createElement('button'); b.className = 'buy-item' + (owned ? ' owned' : (p.credits < a.price ? ' cant' : '')); b.type = 'button';
      b.innerHTML = `<span class="n">${a.name}</span><span class="p">${owned ? 'OWNED' : '◆ ' + a.price}</span><span class="d">+${a.hp} shield · ${a.desc}</span>`; b.onclick = () => g.buyArmor(a.id); ac.appendChild(b);
    }
    const tl = el['buy-team']; tl.innerHTML = g.getTeam('ally').filter(c => c.isBot).map(b => `<div><b>${b.name}</b> — ${(b.primary || b.sidearm).def.name}${b.armor ? ' + ' + (b.armor === 50 ? 'heavy' : 'light') : ''} · ◆ ${b.credits}</div>`).join('');
  }
  function drawWeaponIcon(cv, wid) {
    const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); x.fillStyle = '#c9d4e0'; x.strokeStyle = '#c9d4e0'; x.lineWidth = 2;
    const W = cv.width, H = cv.height, y = H / 2;
    const rect = (a, b, c, d) => x.fillRect(a, b, c, d);
    switch (wid) {
      case 'hawk9': rect(150, y - 8, 50, 10); rect(160, y + 2, 12, 20); break;
      case 'warden': rect(140, y - 8, 70, 8); x.beginPath(); x.arc(160, y + 2, 8, 0, 6.283); x.fill(); rect(150, y + 4, 12, 18); break;
      case 'hornet': rect(60, y - 8, 120, 12); rect(30, y - 5, 32, 6); rect(180, y - 6, 30, 6); rect(110, y + 4, 10, 20); rect(150, y + 4, 10, 14); break;
      case 'breacher': rect(40, y - 5, 60, 12); rect(100, y - 7, 130, 8); rect(140, y + 1, 40, 8); rect(110, y + 5, 10, 14); break;
      case 'raptor': rect(50, y - 8, 120, 12); rect(20, y - 5, 32, 8); rect(170, y - 6, 60, 6); rect(210, y - 8, 28, 10); rect(105, y + 4, 12, 20); rect(140, y + 4, 8, 14); rect(90, y - 12, 50, 3); break;
      case 'kestrel': rect(50, y - 8, 120, 12); rect(20, y - 6, 32, 10); rect(170, y - 6, 66, 6); rect(105, y + 4, 12, 22); rect(140, y + 4, 8, 14); rect(80, y - 13, 30, 4); break;
      case 'bulwark': rect(40, y - 9, 140, 14); rect(14, y - 6, 28, 10); rect(180, y - 6, 56, 6); x.beginPath(); x.arc(120, y + 12, 10, 0, 6.283); x.fill(); rect(150, y + 4, 8, 14); break;
      case 'longbow': rect(30, y - 5, 90, 10); rect(120, y - 6, 116, 5); rect(70, y - 15, 60, 6); rect(95, y + 4, 10, 18); rect(130, y + 3, 8, 12); break;
    }
  }
  function showBuy(on, g) { el['buy-menu'].hidden = !on; if (on) buildBuyMenu(g); }
  function showScoreboard(on, g) {
    el.scoreboard.hidden = !on; if (!on) return;
    el['sb-score'].textContent = g.score.ally + ' — ' + g.score.enemy;
    const row = c => `<tr class="${c.alive ? '' : 'dead'}${c.isPlayer ? ' me' : ''}"><td>${c.name}</td><td>${c.isPlayer ? (c.activeWeapon() ? c.activeWeapon().def.name : '') : c.weapon.def.name}</td><td>${c.kills}</td><td>${c.deaths}</td><td>${c.assists}</td><td>${c.credits}</td></tr>`;
    el['sb-ally'].innerHTML = g.getTeam('ally').map(row).join(''); el['sb-enemy'].innerHTML = g.getTeam('enemy').map(row).join('');
  }

  function update(dt, g) {
    if (hitT > 0) { hitT -= dt; if (hitT <= 0) el.hitmarker.classList.remove('show'); }
    if (vignetteT > 0) { vignetteT = Math.max(0, vignetteT - dt * 0.9); el.vignette.style.opacity = Math.min(0.95, vignetteT); }
    for (let i = dmgArrows.length - 1; i >= 0; i--) { const d = dmgArrows[i]; d.t -= dt; d.a.style.opacity = Math.max(0, d.t); if (d.t <= 0) { d.a.remove(); dmgArrows.splice(i, 1); } }
    topbar(g); drawMinimap(g);
    if (g.player.alive) updateCrosshair(g.player);
  }
  return { init, show, refreshVitals, refreshWeapon, updateCrosshair, setScoped, hitmarker, flashDamage, damageDirection, flashbang, killfeed, announce, streak, roundBanner, interact, spikeStatus, spectate, buyHint, topbar, drawMinimap, toggleMinimap, showBuy, showScoreboard, buildBuyMenu, update };
})();
