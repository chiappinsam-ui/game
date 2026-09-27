/* ======================================================================
   Strikepoint — bootstrap: renderer, scene, input, UI wiring, main loop
   ====================================================================== */
SP.Main = (function () {
  const $ = id => document.getElementById(id);
  let renderer, scene, camera, player, sun, clock, running = false, paused = false, locked = false, buyOpen = false, sbOpen = false;
  const settings = { sens: 1, fov: 90, vol: 0.8, rounds: 7, diff: 1, shadows: true, announcer: true };

  function init() {
    const canvas = $('game');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    scene = new THREE.Scene();
    scene.background = SP.Textures.skyDome(); scene.environment = null;
    scene.fog = new THREE.FogExp2(0xb8b4a8, 0.006);
    camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.03, 500); scene.add(camera);
    // lights
    const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x6b5a45, 0.55); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffe7c4, 1.35); sun.position.set(-38, 62, 24); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 10; sun.shadow.camera.far = 160;
    sun.shadow.camera.left = -60; sun.shadow.camera.right = 60; sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0x9fb8d8, 0.25); fill.position.set(30, 20, -40); scene.add(fill);
    // world
    SP.Map.build(scene); SP.Effects.init(scene, camera); SP.HUD.init();
    player = new SP.Player(camera, scene); SP.Game.init(scene, camera, player);
    clock = new THREE.Clock();
    wireUI(); wireInput();
    window.addEventListener('resize', onResize);
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || !window.matchMedia('(pointer:fine)').matches) $('mobile-warning').hidden = false;
    // idle render (menu background)
    camera.position.set(0, 14, 52); camera.lookAt(0, 0, 0);
    requestAnimationFrame(loop);
  }
  function onResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }

  /* ---------- UI ---------- */
  function bindRange(id, valId, key, fmt, apply) {
    const r = $(id), v = $(valId); r.addEventListener('input', () => { settings[key] = parseFloat(r.value); v.textContent = fmt(settings[key]); apply && apply(settings[key]); syncSettings(); });
  }
  function syncSettings() {
    $('opt-sens').value = $('opt-sens2').value = settings.sens; $('sens-val').textContent = $('sens-val2').textContent = settings.sens.toFixed(2);
    $('opt-fov').value = $('opt-fov2').value = settings.fov; $('fov-val').textContent = $('fov-val2').textContent = settings.fov;
    $('opt-vol').value = $('opt-vol2').value = settings.vol; $('vol-val').textContent = $('vol-val2').textContent = Math.round(settings.vol * 100) + '%';
    player.sensitivity = settings.sens; player.baseFov = settings.fov; SP.Audio.setVolume(settings.vol);
  }
  function wireUI() {
    try { const s = JSON.parse(localStorage.getItem('strikepoint-settings') || 'null'); if (s) Object.assign(settings, s); } catch (e) { }
    const save = () => { try { localStorage.setItem('strikepoint-settings', JSON.stringify(settings)); } catch (e) { } };
    for (const sfx of ['', '2']) {
      bindRange('opt-sens' + sfx, 'sens-val' + sfx, 'sens', v => v.toFixed(2), save);
      bindRange('opt-fov' + sfx, 'fov-val' + sfx, 'fov', v => v, v => { save(); });
      bindRange('opt-vol' + sfx, 'vol-val' + sfx, 'vol', v => Math.round(v * 100) + '%', v => { SP.Audio.setVolume(v); save(); });
    }
    $('opt-rounds').addEventListener('change', e => { settings.rounds = parseInt(e.target.value, 10); $('start-rounds-label').textContent = settings.rounds; save(); });
    $('opt-diff').addEventListener('change', e => { settings.diff = parseFloat(e.target.value); save(); });
    $('opt-shadows').addEventListener('change', e => { settings.shadows = e.target.checked; renderer.shadowMap.enabled = settings.shadows; sun.castShadow = settings.shadows; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); save(); });
    $('opt-announcer').addEventListener('change', e => { settings.announcer = e.target.checked; SP.Audio.setAnnouncer(settings.announcer); save(); });
    $('opt-rounds').value = settings.rounds; $('opt-diff').value = settings.diff; $('opt-shadows').checked = settings.shadows; $('opt-announcer').checked = settings.announcer; $('start-rounds-label').textContent = settings.rounds;
    syncSettings(); SP.Audio.setAnnouncer(settings.announcer);
    $('btn-play').addEventListener('click', startGame);
    $('btn-resume').addEventListener('click', () => { resume(); });
    $('btn-quit').addEventListener('click', () => { quitToMenu(); });
    $('btn-again').addEventListener('click', () => { $('end-screen').hidden = true; startGame(); });
  }
  function startGame() {
    SP.Audio.init(); SP.Audio.resume(); SP.Audio.setVolume(settings.vol);
    $('start-screen').hidden = true; $('end-screen').hidden = true; SP.HUD.show(true);
    running = true; paused = false; player.sensitivity = settings.sens; player.baseFov = settings.fov;
    SP.Game.startMatch({ rounds: settings.rounds, difficulty: settings.diff });
    requestLock();
  }
  function quitToMenu() {
    running = false; paused = false; SP.Game.running = false; SP.Game.phase = 'idle'; document.exitPointerLock && document.exitPointerLock();
    $('pause-screen').hidden = true; SP.HUD.show(false); SP.HUD.showBuy(false, SP.Game); SP.HUD.showScoreboard(false, SP.Game); $('start-screen').hidden = false;
    camera.position.set(0, 14, 52); camera.rotation.set(0, 0, 0); camera.lookAt(0, 0, 0); player.viewmodel.root.visible = false;
    SP.Game.chargeMesh.visible = false; for (const b of SP.Game.bots) b.model.visible = false;
  }
  function showEndScreen(won) {
    document.exitPointerLock && document.exitPointerLock(); SP.HUD.show(false);
    $('end-title').textContent = won ? 'VICTORY' : 'DEFEAT'; $('end-title').style.color = won ? 'var(--ally)' : 'var(--enemy)';
    $('end-score').textContent = SP.Game.score.ally + ' — ' + SP.Game.score.enemy;
    const p = player, st = SP.Game.matchStats;
    $('end-stats').innerHTML = [['KILLS', p.kills], ['DEATHS', p.deaths], ['ASSISTS', p.assists], ['HEADSHOTS', st.headshots], ['ACES', st.aces], ['PLANTS', st.plants], ['DEFUSES', st.defuses], ['DAMAGE', Math.round(p.damageDealt)]]
      .map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
    $('end-screen').hidden = false; SP.Audio.roundEnd(won); SP.Audio.say(won ? 'Victory.' : 'Defeat.');
    running = false;
  }
  function pause() { if (!running || paused) return; paused = true; $('pause-screen').hidden = false; SP.HUD.showBuy(false, SP.Game); buyOpen = false; document.exitPointerLock && document.exitPointerLock(); }
  function resume() { paused = false; $('pause-screen').hidden = true; requestLock(); }

  /* ---------- input ---------- */
  function requestLock() { const c = $('game'); if (c.requestPointerLock) { try { const r = c.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => { try { c.requestPointerLock(); } catch (e) { } }); } catch (e) { try { c.requestPointerLock(); } catch (e2) { } } } }
  function wireInput() {
    const canvas = $('game');
    document.addEventListener('pointerlockchange', () => {
      locked = document.pointerLockElement === canvas;
      // lock released (Esc) during play → pause, unless a menu that releases the mouse on purpose is open
      if (!locked && running && !paused && !buyOpen && $('end-screen').hidden && SP.Game.phase !== 'matchend') pause();
    });
    canvas.addEventListener('mousedown', e => {
      if (!running) return; SP.Audio.resume();
      if (!locked && !paused && !buyOpen) { requestLock(); return; }
      if (e.button === 0) { player.input.fire = true; if (!player.alive) SP.Game.nextSpectate(); }
      if (e.button === 2) { player.input.aim = true; const vm = player.viewmodel; if (vm.inst && vm.inst.def.scoped && vm.ads > 0.5) vm.zoomLevel = vm.zoomLevel === 1 ? 2 : 1; }
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) player.input.fire = false; if (e.button === 2) { player.input.aim = false; } });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('mousemove', e => { if (locked && running && !paused && player.alive) player.applyLook(e.movementX, e.movementY); });
    window.addEventListener('wheel', e => { if (!locked || !running || !player.alive) return; player.cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
    window.addEventListener('keydown', e => {
      if (!running) return;
      if (e.code === 'Tab') { e.preventDefault(); sbOpen = true; SP.HUD.showScoreboard(true, SP.Game); return; }
      if (e.code === 'Escape') { return; } // browser exits pointer lock → pointerlockchange handles pause
      if (paused) return;
      player.keys[e.code] = true;
      if (e.repeat) return;
      switch (e.code) {
        case 'KeyB': if (SP.Game.phase === 'buy') { buyOpen = !buyOpen; SP.HUD.showBuy(buyOpen, SP.Game); SP.Audio.ui('open'); if (buyOpen) document.exitPointerLock && document.exitPointerLock(); else requestLock(); } break;
        case 'KeyR': if (player.alive) player.viewmodel.startReload(); break;
        case 'Digit1': player.switchSlot(1); break; case 'Digit2': player.switchSlot(2); break; case 'Digit3': player.switchSlot(3); break; case 'Digit4': player.switchSlot(4); break;
        case 'KeyQ': if (player.weapons[player.lastSlot]) player.switchSlot(player.lastSlot); break;
        case 'KeyG': if (player.alive) player.dropWeapon(); break;
        case 'KeyM': SP.HUD.toggleMinimap(); break;
        case 'Space': e.preventDefault(); break;
      }
    });
    window.addEventListener('keyup', e => { player.keys[e.code] = false; if (e.code === 'Tab') { sbOpen = false; SP.HUD.showScoreboard(false, SP.Game); } });
    window.addEventListener('blur', () => { for (const k in player.keys) player.keys[k] = false; player.input.fire = false; player.input.aim = false; });
    // clicking a buy item should not fire
    $('buy-menu').addEventListener('mousedown', e => e.stopPropagation());
  }

  /* ---------- loop ---------- */
  let acc = 0;
  function loop() {
    requestAnimationFrame(loop);
    let dt = Math.min(0.05, clock.getDelta());
    if (running && !paused) {
      SP.Game.update(dt, player.input);
      SP.Effects.update(dt);
      if (buyOpen && SP.Game.phase !== 'buy') { buyOpen = false; SP.HUD.showBuy(false, SP.Game); requestLock(); }
    } else if (!running) {
      // menu: slow orbit
      const t = performance.now() * 0.00008; camera.position.set(Math.sin(t) * 55, 16, Math.cos(t) * 55); camera.lookAt(0, 0, 0);
      if (Math.abs(camera.fov - 70) > 0.1) { camera.fov = 70; camera.updateProjectionMatrix(); }
      SP.Effects.update(dt);
    }
    // keep the sun's shadow frustum around the camera
    sun.target.position.set(camera.position.x, 0, camera.position.z); sun.position.set(camera.position.x - 38, 62, camera.position.z + 24);
    renderer.render(scene, camera);
  }
  return { init, showEndScreen, get settings() { return settings; } };
})();
window.addEventListener('DOMContentLoaded', () => SP.Main.init());
