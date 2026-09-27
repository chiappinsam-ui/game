/* ======================================================================
   Strikepoint — "FOUNDRY": map geometry, collision, navigation graph
   Coordinates: X right, Z toward attackers (+), defenders at -Z.
   ====================================================================== */
SP.Map = (function () {
  const T = SP.Textures;
  const colliders = [];      // { min:{x,y,z}, max:{x,y,z}, material, mesh, walkTop }
  const meshes = [];         // raycastable meshes
  const minimapRects = [];   // { x, z, w, d, kind }
  let scene = null;
  const mats = {};

  function mat(kind, color) {
    const key = kind + (color || '');
    if (mats[key]) return mats[key];
    let m;
    switch (kind) {
      case 'concrete': m = new THREE.MeshStandardMaterial({ map: T.concrete(color || '#8d8f8a'), roughness: 0.95, metalness: 0.02 }); break;
      case 'plaster': m = new THREE.MeshStandardMaterial({ map: T.plaster(color || '#c9b89a'), roughness: 0.9 }); break;
      case 'metal': m = new THREE.MeshStandardMaterial({ map: T.metal(color || '#5c6670'), roughness: 0.45, metalness: 0.7 }); break;
      case 'wood': m = new THREE.MeshStandardMaterial({ map: T.crate(), roughness: 0.85 }); break;
      case 'tiles': m = new THREE.MeshStandardMaterial({ map: T.floorTiles(color || '#6e6f6a'), roughness: 0.8 }); break;
      case 'ground': m = new THREE.MeshStandardMaterial({ map: T.ground(), roughness: 1 }); break;
      case 'hazard': m = new THREE.MeshStandardMaterial({ map: T.hazard(), roughness: 0.7 }); break;
      case 'emissive': m = new THREE.MeshStandardMaterial({ color: color || '#ffb347', emissive: color || '#ffb347', emissiveIntensity: 1.6, roughness: 0.4 }); break;
      default: m = new THREE.MeshStandardMaterial({ color: color || '#888', roughness: 0.9 });
    }
    return (mats[key] = m);
  }

  /* Axis-aligned box from min corner (x0,z0) to max (x1,z1), from y0 up to y1 */
  function box(x0, x1, y0, y1, z0, z1, material, opts) {
    opts = opts || {};
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = mat(material, opts.color);
    // UV scale so textures tile per ~2.5m
    if (m.map && !opts.noUV) {
      const uv = geo.attributes.uv; const s = opts.uvScale || 0.4;
      // Faces order: +x,-x,+y,-y,+z,-z ; each face 4 verts
      const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] * s, uv.getY(i) * dims[f][1] * s); }
      uv.needsUpdate = true;
    }
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.castShadow = opts.castShadow !== false; mesh.receiveShadow = true;
    mesh.userData.material = material === 'metal' ? 'metal' : (material === 'wood' ? 'wood' : 'concrete');
    scene.add(mesh); meshes.push(mesh);
    if (!opts.noCollide) colliders.push({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, material: mesh.userData.material, mesh });
    if (!opts.noMinimap && y1 > 0.5) minimapRects.push({ x: x0, z: z0, w: w, d: d, kind: opts.mmKind || (h > 2.5 ? 'wall' : 'cover') });
    return mesh;
  }
  function cylinder(x, z, r, y0, y1, material, opts) {
    const geo = new THREE.CylinderGeometry(r, r, y1 - y0, 14);
    const mesh = new THREE.Mesh(geo, mat(material, opts && opts.color)); mesh.position.set(x, (y0 + y1) / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.material = material === 'metal' ? 'metal' : 'concrete';
    scene.add(mesh); meshes.push(mesh);
    colliders.push({ min: { x: x - r, y: y0, z: z - r }, max: { x: x + r, y: y1, z: z + r }, material: mesh.userData.material, mesh });
    minimapRects.push({ x: x - r, z: z - r, w: r * 2, d: r * 2, kind: 'cover' });
    return mesh;
  }
  function crate(x, z, size, stack) {
    size = size || 1.2; stack = stack || 1;
    for (let i = 0; i < stack; i++) box(x - size / 2, x + size / 2, i * size, (i + 1) * size, z - size / 2, z + size / 2, 'wood', { uvScale: 1 / size });
  }
  function lowWall(x0, x1, z0, z1, h, color) { box(x0, x1, 0, h || 1.2, z0, z1, 'concrete', { color: color || '#7d7f7a' }); }
  function floorPatch(x0, x1, z0, z1, material, color) {
    box(x0, x1, -0.02, 0.02, z0, z1, material || 'tiles', { color, noCollide: true, noMinimap: true, castShadow: false, uvScale: 0.5 });
  }
  function emissiveStrip(x0, x1, y, z0, z1, color) { box(x0, x1, y, y + 0.08, z0, z1, 'emissive', { color, noCollide: true, noMinimap: true, castShadow: false, noUV: true }); }

  const sites = {
    A: { name: 'A', center: new THREE.Vector3(24, 0, -16), zone: { x0: 18, x1: 31, z0: -23, z1: -11 }, holds: [[31, -14], [15, -21], [24, -24]] },
    B: { name: 'B', center: new THREE.Vector3(-24, 0, -16), zone: { x0: -31, x1: -18, z0: -23, z1: -11 }, holds: [[-31, -14], [-15, -21], [-24, -24]] }
  };
  const spawns = {
    att: [[0, 40], [-8, 40], [8, 40], [-16, 41], [16, 41]],
    def: [[0, -40], [-8, -40], [8, -40], [-16, -41], [16, -41]]
  };
  const bounds = { x0: -40, x1: 40, z0: -46, z1: 46 };

  function build(targetScene) {
    scene = targetScene;
    // ---- Ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('ground'));
    ground.material.map.repeat.set(80, 80); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.userData.material = 'concrete';
    scene.add(ground); meshes.push(ground);
    colliders.push({ min: { x: -1000, y: -1, z: -1000 }, max: { x: 1000, y: 0, z: 1000 }, material: 'concrete', mesh: ground, isGround: true });

    // ---- Outer walls (concrete, 6m)
    const W = 'concrete';
    box(bounds.x0 - 1, bounds.x0, 0, 6, bounds.z0 - 1, bounds.z1 + 1, W); box(bounds.x1, bounds.x1 + 1, 0, 6, bounds.z0 - 1, bounds.z1 + 1, W);
    box(bounds.x0 - 1, bounds.x1 + 1, 0, 6, bounds.z0 - 1, bounds.z0, W); box(bounds.x0 - 1, bounds.x1 + 1, 0, 6, bounds.z1, bounds.z1 + 1, W);

    // ---- Big interior buildings (plaster) separating lanes
    const P = 'plaster';
    box(-22, -5, 0, 5, -8, 30, P, { color: '#c9b89a' });           // between B main and mid
    box(5, 22, 0, 5, -8, 30, P, { color: '#b8a98a' });             // between mid and A main
    box(-12, -5, 0, 5, -26, -12, P, { color: '#a89a80' });         // B side of mid-top (leaves B link z -12..-8)
    box(5, 12, 0, 5, -26, -12, P, { color: '#a89a80' });           // A side of mid-top (leaves A link)
    // ---- Defender wall row z -30..-26 with three doors
    box(-40, -26, 0, 5, -30, -26, W); box(-20, -2, 0, 5, -30, -26, W); box(2, 20, 0, 5, -30, -26, W); box(26, 40, 0, 5, -30, -26, W);
    // door frames / lintels (roofs over doors)
    box(-26, -20, 3.2, 3.6, -30, -26, 'metal'); box(-2, 2, 2.6, 3.0, -30, -26, 'metal'); box(20, 26, 3.2, 3.6, -30, -26, 'metal');
    // ---- Roofs over the links to give interior feel
    box(-12, -5, 3.4, 3.8, -12, -8, 'metal', { color: '#4a5560' }); box(5, 12, 3.4, 3.8, -12, -8, 'metal', { color: '#4a5560' });
    // Mid roof section (partial) between z -20..-12
    box(-5, 5, 4.2, 4.6, -22, -14, 'metal', { color: '#4a5560' });

    // ---- Site floors & markers
    floorPatch(12, 40, -26, -8, 'tiles', '#6e6f6a'); floorPatch(-40, -12, -26, -8, 'tiles', '#6a6d72');
    floorPatch(-5, 5, -26, 30, 'tiles', '#5f6160'); floorPatch(-40, 40, 30, 46, 'concrete', '#7d7f7a'); floorPatch(-40, 40, -46, -30, 'concrete', '#7d7f7a');
    // plant zone hazard borders
    for (const s of Object.values(sites)) {
      const z = s.zone;
      box(z.x0, z.x1, 0.0, 0.05, z.z0, z.z0 + 0.3, 'hazard', { noCollide: true, noMinimap: true, castShadow: false, uvScale: 0.5 });
      box(z.x0, z.x1, 0.0, 0.05, z.z1 - 0.3, z.z1, 'hazard', { noCollide: true, noMinimap: true, castShadow: false, uvScale: 0.5 });
      box(z.x0, z.x0 + 0.3, 0.0, 0.05, z.z0, z.z1, 'hazard', { noCollide: true, noMinimap: true, castShadow: false, uvScale: 0.5 });
      box(z.x1 - 0.3, z.x1, 0.0, 0.05, z.z0, z.z1, 'hazard', { noCollide: true, noMinimap: true, castShadow: false, uvScale: 0.5 });
      // big site letter on wall
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: T.siteMarker(s.name, '#ffb347'), transparent: true }));
      sign.position.set(s.center.x, 3.6, -25.95); scene.add(sign);
      emissiveStrip(s.center.x - 6, s.center.x + 6, 4.6, -25.98, -25.9, '#ffb347');
    }
    // ---- Cover: A site
    crate(27, -13, 1.3, 1); crate(27, -14.4, 1.3, 1); crate(28.3, -13, 1.3, 2);          // crate cluster near A main entrance
    lowWall(17, 22, -18.5, -17.7, 1.25); crate(19, -21.5, 1.2, 1);                       // low wall facing link
    cylinder(34, -10, 0.7, 0, 1.6, 'metal', { color: '#6b3b2a' }); cylinder(35.6, -10.4, 0.7, 0, 1.6, 'metal', { color: '#3b5a6b' });
    box(35, 39, 0, 2.4, -24, -18, 'metal', { color: '#4a5560' });                        // heaven box (jumpable via crates)
    crate(34, -16.5, 1.2, 1); crate(34, -17.7, 1.2, 2);
    lowWall(12.2, 12.8, -20, -14, 2.6, '#8d8f8a');                                       // pillar wall
    // ---- Cover: B site
    crate(-27, -13, 1.3, 1); crate(-28.3, -13, 1.3, 2); crate(-27, -14.4, 1.3, 1);
    lowWall(-22, -17, -18.5, -17.7, 1.25); crate(-19, -21.5, 1.2, 1);
    cylinder(-34, -10, 0.7, 0, 1.6, 'metal', { color: '#6b3b2a' });
    box(-39, -35, 0, 2.4, -24, -18, 'metal', { color: '#4a5560' }); crate(-34, -16.5, 1.2, 1); crate(-34, -17.7, 1.2, 2);
    lowWall(-12.8, -12.2, -20, -14, 2.6, '#8d8f8a');
    // ---- Cover: lanes
    // chicane walls in the lanes (break the spawn-to-door sightlines)
    box(22, 29.5, 0, 3.4, 12, 13, W, { color: '#7a7c78' }); box(26.5, 34, 0, 3.4, 4, 5, W, { color: '#7a7c78' });      // A main
    box(-29.5, -22, 0, 3.4, 12, 13, W, { color: '#7a7c78' }); box(-34, -26.5, 0, 3.4, 4, 5, W, { color: '#7a7c78' });  // B main
    box(-5, 1, 0, 3.4, 8, 9, W, { color: '#7a7c78' }); box(-1, 5, 0, 3.4, -2, -1, W, { color: '#7a7c78' });            // mid
    crate(-31.5, 17, 1.4, 1); crate(-33, 0, 1.2, 2); crate(-24.5, -2.5, 1.2, 1);            // B main
    crate(31.5, 17, 1.4, 1); crate(33, 0, 1.2, 2); crate(24.5, -2.5, 1.2, 1);               // A main
    crate(0, 18, 1.3, 1); crate(3.5, -6, 1.2, 1);                                            // mid
    cylinder(-3.5, 3, 0.6, 0, 1.4, 'metal', { color: '#3b5a6b' }); cylinder(4, -16, 0.6, 0, 1.4, 'metal', { color: '#6b3b2a' });
    // ---- Spawn cover
    crate(-6, 34, 1.2, 1); crate(6, 34, 1.2, 1); lowWall(-14, -10, 33, 34, 1.2); lowWall(10, 14, 33, 34, 1.2);
    crate(-6, -34, 1.2, 1); crate(6, -34, 1.2, 1); lowWall(-14, -10, -34, -33, 1.2); lowWall(10, 14, -34, -33, 1.2);
    // ---- Decorative: pipes & lights along buildings
    for (const [x0, x1, z] of [[-22, -5, 30.05], [5, 22, 30.05]]) emissiveStrip(x0 + 1, x1 - 1, 4.4, z, z + 0.08, '#2ee6c8');
    for (const [x0, x1, z] of [[-22, -5, -8.08], [5, 22, -8.08]]) emissiveStrip(x0 + 1, x1 - 1, 4.4, z, z + 0.08, '#ff4b5c');
    cylinder(-5.4, 20, 0.25, 0, 5, 'metal', { color: '#3a3f45' }); cylinder(5.4, 20, 0.25, 0, 5, 'metal', { color: '#3a3f45' });
    cylinder(-5.4, 0, 0.25, 0, 5, 'metal', { color: '#3a3f45' }); cylinder(5.4, 0, 0.25, 0, 5, 'metal', { color: '#3a3f45' });

    buildNav();
    return { colliders, meshes, sites, spawns, bounds, minimapRects, nav };
  }

  /* ---------------- collision helpers ---------------- */
  function overlapsXZ(c, x, z, r) { return x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z; }
  /* Resolve a vertical cylinder (feet at pos.y, radius r, height h) against colliders, moving horizontally. */
  function collideCylinder(pos, r, h, stepHeight) {
    stepHeight = stepHeight == null ? 0.45 : stepHeight;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const c of colliders) {
        if (c.isGround) continue;
        if (!overlapsXZ(c, pos.x, pos.z, r)) continue;
        // vertical overlap? (allow stepping onto low tops)
        if (pos.y + h <= c.min.y || pos.y + stepHeight >= c.max.y) continue;
        // push out along the axis of least penetration
        const dxL = (pos.x + r) - c.min.x, dxR = c.max.x - (pos.x - r);
        const dzL = (pos.z + r) - c.min.z, dzR = c.max.z - (pos.z - r);
        const m = Math.min(dxL, dxR, dzL, dzR);
        if (m === dxL) pos.x -= dxL + 0.001; else if (m === dxR) pos.x += dxR + 0.001;
        else if (m === dzL) pos.z -= dzL + 0.001; else pos.z += dzR + 0.001;
        moved = true;
      }
      if (!moved) break;
    }
  }
  /* Highest surface under a cylinder footprint at (x,z), not higher than maxY */
  function groundHeight(x, z, r, maxY) {
    let best = 0;
    for (const c of colliders) {
      if (c.isGround) continue;
      if (c.max.y <= maxY + 0.001 && c.max.y > best && overlapsXZ(c, x, z, r * 0.7)) best = c.max.y;
    }
    return best;
  }
  /* Ceiling above head */
  function ceilingHeight(x, z, r, y) {
    let best = Infinity;
    for (const c of colliders) { if (c.isGround) continue; if (c.min.y >= y && c.min.y < best && overlapsXZ(c, x, z, r * 0.7)) best = c.min.y; }
    return best;
  }

  const _ray = new THREE.Raycaster();
  function raycast(origin, dir, maxDist, extraTargets) {
    _ray.set(origin, dir); _ray.far = maxDist || 300;
    const targets = extraTargets ? meshes.concat(extraTargets) : meshes;
    const hits = _ray.intersectObjects(targets, false);
    return hits.length ? hits[0] : null;
  }
  /* 2D segment vs. blocking colliders (taller than minH), expanded by radius */
  function segmentBlocked(x0, z0, x1, z1, radius, minH) {
    minH = minH == null ? 0.6 : minH;
    for (const c of colliders) {
      if (c.isGround || c.max.y < minH || c.min.y > 1.2) continue;
      const bx0 = c.min.x - radius, bx1 = c.max.x + radius, bz0 = c.min.z - radius, bz1 = c.max.z + radius;
      // Liang–Barsky clip
      let t0 = 0, t1 = 1; const dx = x1 - x0, dz = z1 - z0;
      const clip = (p, q) => { if (p === 0) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
      if (clip(-dx, x0 - bx0) && clip(dx, bx1 - x0) && clip(-dz, z0 - bz0) && clip(dz, bz1 - z0)) return true;
    }
    return false;
  }
  /* Line of sight between two points (3D) against static geometry */
  const _dir = new THREE.Vector3();
  function hasLOS(a, b) {
    _dir.subVectors(b, a); const d = _dir.length(); if (d < 0.001) return true; _dir.divideScalar(d);
    const hit = raycast(a, _dir, d);
    return !hit;
  }

  /* ---------------- navigation graph ---------------- */
  const nav = { nodes: [], findPath: null, nearest: null };
  function buildNav() {
    const pts = [
      // attacker spawn
      [-20, 38], [0, 38], [20, 38], [-28, 33], [-12, 36], [12, 36], [0, 32], [28, 33],
      // B main (chicane)
      [-28, 26], [-25, 19], [-32, 14], [-32, 9], [-24, 7], [-24, 2], [-30, -3], [-25, -6],
      // mid (chicane)
      [0, 26], [0, 20], [3, 13], [3, 6], [-1, 2], [-3.5, -5], [0, -10], [0, -17], [0, -24], [0, -28], [0, -33],
      // A main (chicane)
      [28, 26], [25, 19], [32, 14], [32, 9], [24, 7], [24, 2], [30, -3], [25, -6],
      // B link / site
      [-8.5, -10], [-14, -10], [-20, -12], [-24, -16], [-29, -16], [-22, -23], [-15, -19], [-24, -22], [-31, -22], [-33, -12], [-16, -14],
      // A link / site
      [8.5, -10], [14, -10], [20, -12], [24, -16], [29, -16], [22, -23], [15, -19], [24, -22], [31, -22], [33, -12], [16, -14],
      // defender spawn
      [-23, -28], [23, -28], [-23, -33], [23, -33], [-16, -38], [0, -38], [16, -38], [-8, -42], [8, -42], [-30, -38], [30, -38]
    ];
    nav.nodes = pts.map((p, i) => ({ id: i, x: p[0], z: p[1], edges: [] }));
    for (let i = 0; i < nav.nodes.length; i++) for (let j = i + 1; j < nav.nodes.length; j++) {
      const a = nav.nodes[i], b = nav.nodes[j]; const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > 16) continue;
      if (segmentBlocked(a.x, a.z, b.x, b.z, 0.5)) continue;
      a.edges.push({ to: j, cost: d }); b.edges.push({ to: i, cost: d });
    }
    nav.nearest = function (x, z) {
      let best = null, bd = Infinity;
      for (const n of nav.nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd && !segmentBlocked(x, z, n.x, n.z, 0.4)) { bd = d; best = n; } }
      if (!best) for (const n of nav.nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } }
      return best;
    };
    nav.findPath = function (fx, fz, tx, tz) {
      const start = nav.nearest(fx, fz), goal = nav.nearest(tx, tz);
      if (!start || !goal) return [{ x: tx, z: tz }];
      const open = [start.id]; const came = {}; const g = { [start.id]: 0 };
      const f = { [start.id]: Math.hypot(start.x - goal.x, start.z - goal.z) }; const closed = new Set();
      while (open.length) {
        let bi = 0; for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
        const cur = open.splice(bi, 1)[0]; if (cur === goal.id) break; closed.add(cur);
        for (const e of nav.nodes[cur].edges) {
          if (closed.has(e.to)) continue;
          const ng = g[cur] + e.cost;
          if (g[e.to] == null || ng < g[e.to]) { came[e.to] = cur; g[e.to] = ng; const n = nav.nodes[e.to]; f[e.to] = ng + Math.hypot(n.x - goal.x, n.z - goal.z); if (!open.includes(e.to)) open.push(e.to); }
        }
      }
      const path = []; let c = goal.id;
      if (came[c] == null && c !== start.id) return [{ x: start.x, z: start.z }, { x: tx, z: tz }];
      while (c != null) { path.unshift({ x: nav.nodes[c].x, z: nav.nodes[c].z }); if (c === start.id) break; c = came[c]; }
      // skip the first node if we can go straight to the second
      if (path.length > 1 && !segmentBlocked(fx, fz, path[1].x, path[1].z, 0.45)) path.shift();
      path.push({ x: tx, z: tz });
      return path;
    };
  }

  nav.unreachable = function () { const seen = new Set([0]); const q = [0]; while (q.length) { const n = nav.nodes[q.shift()]; for (const e of n.edges) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); } } return nav.nodes.filter(n => !seen.has(n.id)).map(n => [n.x, n.z]); };
  function inZone(zone, x, z) { return x >= zone.x0 && x <= zone.x1 && z >= zone.z0 && z <= zone.z1; }
  function randomInZone(zone) { return { x: SP.util.rand(zone.x0 + 1.5, zone.x1 - 1.5), z: SP.util.rand(zone.z0 + 1.5, zone.z1 - 1.5) }; }

  return { build, collideCylinder, groundHeight, ceilingHeight, raycast, hasLOS, segmentBlocked, inZone, randomInZone, nav, sites, spawns, bounds, get colliders() { return colliders; }, get meshes() { return meshes; }, get minimapRects() { return minimapRects; } };
})();
