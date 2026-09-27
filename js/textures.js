/* ======================================================================
   Strikepoint — procedural textures (canvas → THREE.CanvasTexture)
   ====================================================================== */
SP.Textures = (function () {
  const cache = {};
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function noiseFill(ctx, w, h, base, amount, grain) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h); const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amount;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    if (grain) {
      for (let k = 0; k < grain; k++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
        const r = Math.random() * 6 + 1; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, r, 0, 6.283); ctx.fill();
      }
    }
  }
  function tex(c, repeatX, repeatY, aniso) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX || 1, repeatY || 1);
    t.anisotropy = aniso || 4; t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function concrete(shade) {
    const key = 'concrete' + shade; if (cache[key]) return cache[key];
    const w = 512, h = 512, c = canvas(w, h), x = c.getContext('2d');
    noiseFill(x, w, h, shade || '#8d8f8a', 28, 260);
    // cracks / streaks
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 1;
    for (let i = 0; i < 12; i++) { x.beginPath(); let px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py); for (let j = 0; j < 8; j++) { px += (Math.random() - 0.5) * 60; py += Math.random() * 30; x.lineTo(px, py); } x.stroke(); }
    // panel seams
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; x.strokeRect(1, 1, w / 2 - 2, h / 2 - 2); x.strokeRect(w / 2 + 1, 1, w / 2 - 2, h / 2 - 2); x.strokeRect(1, h / 2 + 1, w / 2 - 2, h / 2 - 2); x.strokeRect(w / 2 + 1, h / 2 + 1, w / 2 - 2, h / 2 - 2);
    return (cache[key] = tex(c, 1, 1));
  }
  function plaster(color) {
    const key = 'plaster' + color; if (cache[key]) return cache[key];
    const w = 512, h = 512, c = canvas(w, h), x = c.getContext('2d');
    noiseFill(x, w, h, color || '#c9b89a', 18, 120);
    // dirt at bottom
    const g = x.createLinearGradient(0, h * 0.6, 0, h); g.addColorStop(0, 'rgba(60,40,20,0)'); g.addColorStop(1, 'rgba(60,40,20,0.35)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // stripe
    x.fillStyle = 'rgba(30,30,30,0.45)'; x.fillRect(0, h * 0.42, w, 10);
    return (cache[key] = tex(c, 1, 1));
  }
  function metal(color) {
    const key = 'metal' + color; if (cache[key]) return cache[key];
    const w = 256, h = 256, c = canvas(w, h), x = c.getContext('2d');
    noiseFill(x, w, h, color || '#5c6670', 14, 0);
    // brushed lines
    for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; x.fillRect(0, Math.random() * h, w, 1); }
    // rivets and panel edges
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4);
    x.fillStyle = 'rgba(0,0,0,0.45)';
    [[14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14]].forEach(([px, py]) => { x.beginPath(); x.arc(px, py, 5, 0, 6.283); x.fill(); });
    x.fillStyle = 'rgba(255,255,255,0.25)';
    [[12, 12], [w - 16, 12], [12, h - 16], [w - 16, h - 16]].forEach(([px, py]) => { x.beginPath(); x.arc(px, py, 2, 0, 6.283); x.fill(); });
    return (cache[key] = tex(c, 1, 1));
  }
  function crate() {
    if (cache.crate) return cache.crate;
    const w = 256, h = 256, c = canvas(w, h), x = c.getContext('2d');
    noiseFill(x, w, h, '#8a6a3e', 22, 40);
    // planks
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(0,0,0,${0.12 + Math.random() * 0.1})`; x.fillRect(0, i * (h / 6), w, 3); }
    for (let i = 0; i < 40; i++) { x.strokeStyle = 'rgba(40,20,0,0.25)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, Math.random() * h); x.lineTo(w, Math.random() * h); x.stroke(); }
    // frame
    x.fillStyle = 'rgba(60,35,10,0.8)'; x.fillRect(0, 0, w, 18); x.fillRect(0, h - 18, w, 18); x.fillRect(0, 0, 18, h); x.fillRect(w - 18, 0, 18, h);
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 6; x.beginPath(); x.moveTo(18, 18); x.lineTo(w - 18, h - 18); x.stroke();
    // stencil
    x.fillStyle = 'rgba(20,20,20,0.5)'; x.font = 'bold 26px monospace'; x.fillText('SP-' + (100 + Math.floor(Math.random() * 900)), 40, 60);
    return (cache.crate = tex(c, 1, 1));
  }
  function floorTiles(color) {
    const key = 'tiles' + color; if (cache[key]) return cache[key];
    const w = 512, h = 512, c = canvas(w, h), x = c.getContext('2d');
    noiseFill(x, w, h, color || '#6e6f6a', 20, 80);
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      x.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},0.035)`; x.fillRect(i * s, j * s, s, s);
      x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3; x.strokeRect(i * s + 1, j * s + 1, s - 2, s - 2);
    }
    return (cache[key] = tex(c, 1, 1, 8));
  }
  function ground() {
    if (cache.ground) return cache.ground;
    const w = 512, h = 512, c = canvas(w, h), x = c.getContext('2d');
    noiseFill(x, w, h, '#7d7566', 26, 400);
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 4 + Math.random() * 12, Math.random() * 3, 0, 6.283); x.fill(); }
    return (cache.ground = tex(c, 1, 1, 8));
  }
  function hazard() {
    if (cache.hazard) return cache.hazard;
    const w = 256, h = 256, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = '#e0a11c'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#151515'; for (let i = -h; i < w + h; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 32, 0); x.lineTo(i + 32 + h, h); x.lineTo(i + h, h); x.fill(); }
    noiseFill(x, w, h, 'rgba(0,0,0,0)', 0, 0);
    const img = x.getImageData(0, 0, w, h); const d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 30; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(img, 0, 0);
    return (cache.hazard = tex(c, 1, 1));
  }
  function siteMarker(letter, color) {
    const key = 'site' + letter; if (cache[key]) return cache[key];
    const w = 256, h = 256, c = canvas(w, h), x = c.getContext('2d');
    x.clearRect(0, 0, w, h);
    x.strokeStyle = color || '#ffb347'; x.lineWidth = 10; x.strokeRect(14, 14, w - 28, h - 28);
    x.fillStyle = color || '#ffb347'; x.font = 'bold 150px Rajdhani, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(letter, w / 2, h / 2 + 10);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (cache[key] = t);
  }
  /* --- sprites (non-repeating) --- */
  function sprite(key, draw, size) {
    if (cache[key]) return cache[key];
    const s = size || 128, c = canvas(s, s), x = c.getContext('2d'); draw(x, s);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (cache[key] = t);
  }
  const muzzleFlash = () => sprite('muzzle', (x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.25, 'rgba(255,210,120,0.95)'); g.addColorStop(0.6, 'rgba(255,120,30,0.35)'); g.addColorStop(1, 'rgba(255,80,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    // star spikes
    x.strokeStyle = 'rgba(255,230,160,0.9)'; x.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; x.beginPath(); x.moveTo(s / 2, s / 2); x.lineTo(s / 2 + Math.cos(a) * s * 0.48, s / 2 + Math.sin(a) * s * 0.48); x.stroke(); }
  });
  const smoke = () => sprite('smoke', (x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`; x.beginPath(); x.arc(s / 2 + (Math.random() - 0.5) * s * 0.6, s / 2 + (Math.random() - 0.5) * s * 0.6, Math.random() * s * 0.2, 0, 6.283); x.fill(); }
  });
  const spark = () => sprite('spark', (x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,220,120,0.9)'); g.addColorStop(1, 'rgba(255,150,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  }, 32);
  const bulletHole = () => sprite('hole', (x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(10,10,10,1)'); g.addColorStop(0.35, 'rgba(20,20,20,0.9)'); g.addColorStop(0.55, 'rgba(60,60,60,0.5)'); g.addColorStop(1, 'rgba(90,90,90,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    x.strokeStyle = 'rgba(30,30,30,0.6)'; x.lineWidth = 2;
    for (let i = 0; i < 7; i++) { const a = Math.random() * 6.283; x.beginPath(); x.moveTo(s / 2, s / 2); x.lineTo(s / 2 + Math.cos(a) * s * 0.45, s / 2 + Math.sin(a) * s * 0.45); x.stroke(); }
  }, 64);
  const blood = () => sprite('blood', (x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(160,10,20,0.95)'); g.addColorStop(0.5, 'rgba(120,5,15,0.6)'); g.addColorStop(1, 'rgba(90,0,10,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(130,5,15,0.85)'; x.beginPath(); x.arc(s / 2 + (Math.random() - 0.5) * s * 0.8, s / 2 + (Math.random() - 0.5) * s * 0.8, Math.random() * s * 0.08 + 1, 0, 6.283); x.fill(); }
  }, 64);
  const glow = () => sprite('glow', (x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  }, 64);
  const skyDome = () => {
    if (cache.sky) return cache.sky;
    const w = 1024, h = 512, c = canvas(w, h), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1b2a44'); g.addColorStop(0.45, '#5b7fa8'); g.addColorStop(0.62, '#c9b79a'); g.addColorStop(0.75, '#e0c39c'); g.addColorStop(1, '#3a3a3a');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // clouds
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; x.beginPath(); x.ellipse(Math.random() * w, h * 0.3 + Math.random() * h * 0.25, 40 + Math.random() * 140, 8 + Math.random() * 18, 0, 0, 6.283); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.mapping = THREE.EquirectangularReflectionMapping;
    return (cache.sky = t);
  };
  return { concrete, plaster, metal, crate, floorTiles, ground, hazard, siteMarker, muzzleFlash, smoke, spark, bulletHole, blood, glow, skyDome };
})();
