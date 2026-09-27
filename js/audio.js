/* ======================================================================
   Strikepoint — procedural audio engine (Web Audio API, no asset files)
   ====================================================================== */
SP.Audio = (function () {
  let ctx = null, master = null, sfxBus = null, comp = null;
  let announcerOn = true;
  let volume = 0.8;
  const listener = { pos: { x: 0, y: 0, z: 0 }, fwd: { x: 0, z: -1 }, right: { x: 1, z: 0 } };

  function init() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = volume;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 20; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1;
    sfxBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
    return ctx;
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function setVolume(v) { volume = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.02); }
  function setAnnouncer(v) { announcerOn = v; }
  function now() { return ctx ? ctx.currentTime : 0; }

  /* ---------- building blocks ---------- */
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    return src;
  }
  function env(g, t, a, peak, d, sustain = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(sustain, t + a + d);
  }
  function outNode(opts) {
    // Returns a gain node routed via pan/filters to the bus, according to spatial opts
    const g = ctx.createGain();
    let node = g;
    if (opts && opts.pos) {
      const dx = opts.pos.x - listener.pos.x, dz = opts.pos.z - listener.pos.z, dy = (opts.pos.y || 0) - listener.pos.y;
      const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
      const ref = opts.ref || 6, maxD = opts.maxDist || 80;
      let vol = dist < ref ? 1 : Math.max(0, 1 - (dist - ref) / (maxD - ref));
      vol = Math.pow(vol, 1.4);
      if (vol <= 0.002) return null;
      const pan = ctx.createStereoPanner();
      const nx = dist > 0.001 ? dx / dist : 0, nz = dist > 0.001 ? dz / dist : 0;
      pan.pan.value = SP.util.clamp(nx * listener.right.x + nz * listener.right.z, -1, 1) * 0.85;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.value = Math.max(600, 16000 - dist * 220);
      g.gain.value = vol * (opts.gain == null ? 1 : opts.gain);
      g.connect(lp); lp.connect(pan); pan.connect(sfxBus);
      node = g;
    } else {
      g.gain.value = (opts && opts.gain != null) ? opts.gain : 1;
      g.connect(sfxBus);
    }
    return node;
  }
  function tone(out, type, f0, f1, t, a, d, peak, detune) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + d);
    if (detune) o.detune.value = detune;
    env(g, t, a, peak, d);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + a + d + 0.05);
    return o;
  }
  function burst(out, t, dur, peak, filterType, f0, f1, q) {
    const n = noise(); const g = ctx.createGain(); const f = ctx.createBiquadFilter();
    f.type = filterType || 'lowpass'; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    if (q) f.Q.value = q;
    env(g, t, 0.002, peak, dur);
    n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + dur + 0.05);
  }

  /* ---------- weapon sounds ---------- */
  const GUN = {
    pistol:     { crack: 0.9, crackF: 3200, boom: 0.5, boomF: 160, dur: 0.16, tail: 0.25 },
    revolver:   { crack: 1.0, crackF: 2200, boom: 1.0, boomF: 110, dur: 0.24, tail: 0.5 },
    smg:        { crack: 0.7, crackF: 3800, boom: 0.45, boomF: 180, dur: 0.11, tail: 0.18 },
    shotgun:    { crack: 1.0, crackF: 1800, boom: 1.2, boomF: 90, dur: 0.30, tail: 0.6 },
    rifleQuiet: { crack: 0.5, crackF: 1400, boom: 0.35, boomF: 140, dur: 0.12, tail: 0.15, suppressed: true },
    rifleLoud:  { crack: 1.0, crackF: 2900, boom: 0.8, boomF: 130, dur: 0.18, tail: 0.4 },
    lmg:        { crack: 0.9, crackF: 2600, boom: 0.8, boomF: 120, dur: 0.17, tail: 0.35 },
    sniper:     { crack: 1.2, crackF: 1900, boom: 1.4, boomF: 70, dur: 0.45, tail: 0.9 }
  };
  function gunshot(kind, opts) {
    if (!ctx) return; const p = GUN[kind] || GUN.pistol; const t = now();
    const out = outNode(Object.assign({ ref: 8, maxDist: 110 }, opts || {})); if (!out) return;
    const own = !(opts && opts.pos);
    const scale = own ? 1 : 0.8;
    // crack (high transient)
    burst(out, t, p.dur * 0.5, 0.9 * p.crack * scale, 'bandpass', p.crackF, p.crackF * 0.4, 0.7);
    // body (mid)
    burst(out, t, p.dur, 0.55 * p.crack * scale, 'lowpass', p.suppressed ? 900 : 2400, 300);
    // boom (low thump)
    tone(out, 'sine', p.boomF * 1.6, p.boomF * 0.5, t, 0.004, p.dur * 0.9, 0.8 * p.boom * scale);
    // tail / reverb-ish
    if (!p.suppressed || !own) burst(out, t + 0.02, p.tail, 0.18 * scale, 'lowpass', 1200, 200);
    if (p.suppressed && own) burst(out, t, 0.08, 0.35, 'highpass', 4000);
    // mechanical click for own weapon
    if (own) burst(out, t + p.dur * 0.6, 0.03, 0.25, 'highpass', 5000);
  }
  function dryFire() { if (!ctx) return; const t = now(); const out = outNode({ gain: 0.6 }); burst(out, t, 0.03, 0.8, 'highpass', 3000); }
  function reload(stage) {
    if (!ctx) return; const t = now(); const out = outNode({ gain: 0.5 });
    if (stage === 'out') { burst(out, t, 0.05, 0.9, 'bandpass', 1800, 900, 2); tone(out, 'square', 300, 120, t, 0.002, 0.05, 0.15); }
    else if (stage === 'in') { burst(out, t, 0.04, 1.0, 'bandpass', 2600, 1200, 2); tone(out, 'triangle', 500, 260, t, 0.002, 0.07, 0.25); }
    else if (stage === 'bolt') { burst(out, t, 0.05, 0.9, 'bandpass', 3200, 1400, 3); burst(out, t + 0.09, 0.05, 0.9, 'bandpass', 2400, 1000, 3); }
    else if (stage === 'shell') { burst(out, t, 0.03, 0.9, 'bandpass', 2200, 1000, 3); }
    else if (stage === 'pump') { burst(out, t, 0.06, 1, 'bandpass', 1500, 700, 2); burst(out, t + 0.12, 0.06, 1, 'bandpass', 2000, 900, 2); }
  }
  function knife(hit) {
    if (!ctx) return; const t = now(); const out = outNode({ gain: 0.7 });
    burst(out, t, 0.12, 0.6, 'bandpass', 3000, 6000, 1);
    if (hit) { burst(out, t + 0.02, 0.1, 0.9, 'lowpass', 900, 200); tone(out, 'sine', 200, 60, t + 0.02, 0.002, 0.12, 0.6); }
  }
  function footstep(pos, surface, walk) {
    if (!ctx) return; const t = now();
    const out = outNode(pos ? { pos, ref: 3, maxDist: 28, gain: walk ? 0.25 : 0.6 } : { gain: walk ? 0.12 : 0.3 }); if (!out) return;
    const f = surface === 'metal' ? 1800 : 700;
    burst(out, t, 0.07, 0.9, 'lowpass', f, 150);
    if (surface === 'metal') tone(out, 'sine', 900, 500, t, 0.001, 0.08, 0.15);
  }
  function impact(pos, material) {
    if (!ctx) return; const t = now(); const out = outNode({ pos, ref: 4, maxDist: 40, gain: 0.9 }); if (!out) return;
    if (material === 'metal') { burst(out, t, 0.08, 0.8, 'bandpass', 3200, 1200, 4); tone(out, 'sine', 2200 + Math.random() * 800, 1200, t, 0.001, 0.14, 0.2); }
    else if (material === 'wood') { burst(out, t, 0.07, 0.9, 'lowpass', 1400, 400); }
    else { burst(out, t, 0.06, 0.9, 'bandpass', 1800, 500, 1.5); burst(out, t, 0.12, 0.3, 'lowpass', 500, 100); }
  }
  function whiz(pan) {
    if (!ctx) return; const t = now(); const out = outNode({ gain: 0.5 });
    const p = ctx.createStereoPanner(); p.pan.value = SP.util.clamp(pan || 0, -1, 1); out.disconnect(); out.connect(p); p.connect(sfxBus);
    burst(out, t, 0.14, 0.9, 'bandpass', 4200, 900, 6);
  }
  function hitFlesh(own) {
    if (!ctx) return; const t = now(); const out = outNode({ gain: own ? 0.9 : 0.6 });
    burst(out, t, 0.09, 0.9, 'lowpass', 1100, 250); tone(out, 'sine', 180, 90, t, 0.001, 0.1, 0.5);
  }
  function hitMarker(head) {
    if (!ctx) return; const t = now(); const out = outNode({ gain: 0.45 });
    tone(out, 'square', head ? 2600 : 1900, head ? 2200 : 1500, t, 0.001, 0.05, 0.25);
    if (head) tone(out, 'sine', 3400, 3200, t, 0.001, 0.09, 0.3);
  }
  function damageTaken(big) {
    if (!ctx) return; const t = now(); const out = outNode({ gain: 1 });
    burst(out, t, 0.12, 0.7, 'lowpass', 800, 200); tone(out, 'sine', 120, 50, t, 0.002, big ? 0.35 : 0.2, big ? 0.9 : 0.6);
  }
  function death() {
    if (!ctx) return; const t = now(); const out = outNode({ gain: 1 });
    tone(out, 'sawtooth', 220, 40, t, 0.01, 1.4, 0.4); burst(out, t, 1.2, 0.5, 'lowpass', 600, 80);
  }
  function ui(kind) {
    if (!ctx) return; const t = now(); const out = outNode({ gain: 0.5 });
    if (kind === 'buy') { tone(out, 'triangle', 880, 1320, t, 0.005, 0.12, 0.5); tone(out, 'triangle', 1320, 1760, t + 0.06, 0.005, 0.12, 0.4); }
    else if (kind === 'deny') { tone(out, 'square', 220, 180, t, 0.005, 0.15, 0.3); }
    else if (kind === 'open') { tone(out, 'sine', 600, 900, t, 0.005, 0.08, 0.3); }
    else if (kind === 'switch') { burst(out, t, 0.04, 0.8, 'bandpass', 2500, 1200, 2); }
    else if (kind === 'tick') { tone(out, 'square', 1600, 1600, t, 0.001, 0.03, 0.2); }
  }
  function beep(pos, freq, gain) {
    if (!ctx) return; const t = now(); const out = outNode({ pos, ref: 10, maxDist: 90, gain: gain || 0.7 }); if (!out) return;
    tone(out, 'square', freq || 1400, freq || 1400, t, 0.002, 0.08, 0.4);
  }
  function plantProgress(step) {
    if (!ctx) return; const t = now(); const out = outNode({ gain: 0.4 });
    tone(out, 'square', 900 + step * 120, 900 + step * 120, t, 0.002, 0.05, 0.35);
  }
  function explosion(pos) {
    if (!ctx) return; const t = now(); const out = outNode(pos ? { pos, ref: 30, maxDist: 400, gain: 1.2 } : { gain: 1.2 }); if (!out) return;
    tone(out, 'sine', 120, 25, t, 0.01, 2.2, 1.2); burst(out, t, 1.6, 1.2, 'lowpass', 2500, 80);
    burst(out, t, 0.25, 0.9, 'bandpass', 3000, 800, 0.8); burst(out, t + 0.3, 2.5, 0.25, 'lowpass', 600, 60);
  }
  function roundStart() {
    if (!ctx) return; const t = now(); const out = outNode({ gain: 0.6 });
    [440, 554, 659].forEach((f, i) => tone(out, 'triangle', f, f, t + i * 0.1, 0.01, 0.5, 0.35));
    tone(out, 'sine', 110, 110, t, 0.01, 0.8, 0.4);
  }
  function roundEnd(win) {
    if (!ctx) return; const t = now(); const out = outNode({ gain: 0.7 });
    const notes = win ? [523, 659, 784, 1046] : [392, 349, 311, 261];
    notes.forEach((f, i) => tone(out, win ? 'triangle' : 'sawtooth', f, f, t + i * 0.16, 0.01, 0.7, win ? 0.35 : 0.22));
    tone(out, 'sine', win ? 130 : 65, win ? 130 : 55, t, 0.02, 1.4, 0.5);
  }
  function stinger(kind) { // 'planted', 'defused', 'lastalive'
    if (!ctx) return; const t = now(); const out = outNode({ gain: 0.6 });
    if (kind === 'planted') { [220, 220, 330].forEach((f, i) => tone(out, 'sawtooth', f, f * 0.98, t + i * 0.18, 0.01, 0.35, 0.3)); }
    else if (kind === 'defused') { [660, 880, 1320].forEach((f, i) => tone(out, 'triangle', f, f, t + i * 0.12, 0.01, 0.5, 0.35)); }
    else { tone(out, 'sine', 330, 320, t, 0.02, 0.9, 0.35); tone(out, 'sine', 165, 160, t, 0.02, 1.2, 0.35); }
  }

  /* ---------- KILL SOUNDS: 1 → 5 (ACE) ---------- */
  function killSound(tier, headshot) {
    if (!ctx) return; const t = now(); const out = outNode({ gain: 1 });
    // delay/echo send for tiers 3+
    let echo = null;
    if (tier >= 3) {
      echo = ctx.createDelay(1); echo.delayTime.value = tier >= 5 ? 0.19 : 0.15;
      const fb = ctx.createGain(); fb.gain.value = tier >= 5 ? 0.42 : 0.3;
      const eg = ctx.createGain(); eg.gain.value = 0.5;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      out.connect(echo); echo.connect(fb); fb.connect(echo); echo.connect(hp); hp.connect(eg); eg.connect(sfxBus);
    }
    const hit = (f, when, len, vol, type) => { tone(out, type || 'sine', f, f, t + when, 0.004, len, vol); tone(out, 'triangle', f * 2, f * 2, t + when, 0.004, len * 0.5, vol * 0.35); };
    switch (Math.min(5, Math.max(1, tier))) {
      case 1: // clean confirm "tink"
        hit(1245, 0, 0.28, 0.55); burst(out, t, 0.03, 0.5, 'highpass', 6000);
        if (headshot) hit(1865, 0.05, 0.22, 0.35);
        break;
      case 2: // two rising notes
        hit(988, 0, 0.22, 0.5); hit(1480, 0.11, 0.34, 0.55); burst(out, t, 0.03, 0.5, 'highpass', 6000);
        tone(out, 'sine', 98, 98, t, 0.005, 0.3, 0.45);
        break;
      case 3: // triad arpeggio
        [1047, 1319, 1568].forEach((f, i) => hit(f, i * 0.09, 0.4, 0.5));
        tone(out, 'sine', 131, 131, t, 0.005, 0.5, 0.5); burst(out, t, 0.04, 0.6, 'highpass', 5000);
        break;
      case 4: // four-note run + shimmer
        [1047, 1319, 1568, 2093].forEach((f, i) => hit(f, i * 0.08, 0.5, 0.5));
        [523, 659, 784].forEach(f => tone(out, 'sawtooth', f, f * 1.003, t + 0.3, 0.05, 0.7, 0.08, 6));
        tone(out, 'sine', 131, 65, t, 0.005, 0.7, 0.6); burst(out, t, 0.05, 0.7, 'highpass', 4500);
        break;
      case 5: // ACE: impact, riser, big chord, sparkle
        tone(out, 'sine', 160, 30, t, 0.005, 1.6, 1.1); burst(out, t, 0.8, 0.8, 'lowpass', 3000, 100);
        tone(out, 'sawtooth', 200, 1600, t, 0.4, 0.35, 0.18);
        [523, 659, 784, 988, 1319].forEach((f, i) => { tone(out, 'sawtooth', f, f * 1.002, t + 0.42 + i * 0.03, 0.03, 1.6, 0.12, -5); tone(out, 'triangle', f, f, t + 0.42 + i * 0.03, 0.03, 1.8, 0.16, 5); });
        [2093, 2637, 3136, 3951, 4186].forEach((f, i) => hit(f, 0.45 + i * 0.07, 0.6, 0.28));
        tone(out, 'sine', 65, 65, t + 0.42, 0.02, 2.2, 0.55);
        break;
    }
  }

  /* ---------- announcer (speech synthesis) ---------- */
  let voice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices(); if (!vs.length) return;
    const prefs = ['Google UK English Male', 'Daniel', 'Microsoft Guy', 'Microsoft David', 'Alex', 'Google US English'];
    for (const p of prefs) { const v = vs.find(v => v.name.indexOf(p) === 0); if (v) { voice = v; return; } }
    voice = vs.find(v => v.lang && v.lang.indexOf('en') === 0) || vs[0];
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function say(text, opts) {
    if (!announcerOn || !text || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = (opts && opts.rate) || 0.92; u.pitch = (opts && opts.pitch) || 0.6; u.volume = Math.min(1, volume * 1.1);
      if (voice) u.voice = voice;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  function setListener(pos, fwd) {
    listener.pos.x = pos.x; listener.pos.y = pos.y; listener.pos.z = pos.z;
    const l = Math.hypot(fwd.x, fwd.z) || 1;
    listener.fwd.x = fwd.x / l; listener.fwd.z = fwd.z / l;
    listener.right.x = -listener.fwd.z; listener.right.z = listener.fwd.x;
  }

  return { init, resume, setVolume, setAnnouncer, setListener, gunshot, dryFire, reload, knife, footstep, impact, whiz, hitFlesh, hitMarker, damageTaken, death, ui, beep, plantProgress, explosion, roundStart, roundEnd, stinger, killSound, say, get ctx() { return ctx; } };
})();
