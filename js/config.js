/* ======================================================================
   Strikepoint — configuration: weapons, economy, round timings, names
   All weapons are original designs for this game.
   ====================================================================== */
window.SP = window.SP || {};

SP.CONFIG = {
  ROUNDS_TO_WIN: 7,
  BUY_TIME: 20,
  FIRST_BUY_TIME: 30,
  ROUND_TIME: 100,
  PLANT_TIME: 45,
  POST_ROUND_TIME: 6,
  PLANT_DURATION: 4.0,
  DEFUSE_DURATION: 7.0,
  START_CREDITS: 800,
  MAX_CREDITS: 9000,
  WIN_REWARD: 3000,
  LOSS_REWARD: 1900,
  LOSS_STREAK_BONUS: 500,
  LOSS_STREAK_MAX: 2,
  KILL_REWARD: 200,
  PLANT_REWARD: 300,
  PLAYER_HEIGHT: 1.75,
  CROUCH_HEIGHT: 1.15,
  PLAYER_RADIUS: 0.36,
  WALK_SPEED: 2.4,
  RUN_SPEED: 5.4,
  CROUCH_SPEED: 2.1,
  JUMP_VELOCITY: 5.2,
  GRAVITY: 16,
  BOT_NAMES_ALLY: ['Vex', 'Kilo', 'Dune', 'Sable'],
  BOT_NAMES_ENEMY: ['Rook', 'Talon', 'Ash', 'Nyx', 'Grim'],
  PLAYER_NAME: 'You'
};

/* Damage falloff: array of [maxRange, multiplier]. Damage is dmg * mult for the first range that contains dist. */
SP.WEAPONS = {
  knife: {
    id: 'knife', name: 'KNIFE', slot: 3, type: 'melee', price: 0,
    damage: { body: 50, head: 50, leg: 50 }, range: 1.9, fireRate: 1.6, auto: false,
    mag: Infinity, reserve: Infinity, reloadTime: 0,
    spread: { base: 0 }, recoil: { v: 0, h: 0 }, sound: 'knife', desc: 'Silent. Two hits, or one to the back.'
  },
  hawk9: {
    id: 'hawk9', name: 'HAWK-9', slot: 2, type: 'pistol', price: 0,
    damage: { body: 26, head: 78, leg: 22 }, falloff: [[30, 1], [50, 0.85], [Infinity, 0.7]],
    fireRate: 6.7, auto: false, mag: 12, reserve: 36, reloadTime: 1.75,
    spread: { base: 0.35, move: 2.4, crouch: 0.75, ads: 0.55, bloom: 0.45, decay: 6 },
    recoil: { v: 1.6, h: 0.5, recover: 9 }, adsZoom: 1.15, sound: 'pistol',
    desc: 'Standard-issue sidearm. Accurate, cheap, free every round.'
  },
  warden: {
    id: 'warden', name: 'WARDEN', slot: 2, type: 'pistol', price: 800,
    damage: { body: 55, head: 159, leg: 47 }, falloff: [[30, 1], [Infinity, 0.9]],
    fireRate: 4, auto: false, mag: 6, reserve: 24, reloadTime: 2.25,
    spread: { base: 0.25, move: 3.2, crouch: 0.75, ads: 0.5, bloom: 1.1, decay: 4 },
    recoil: { v: 3.8, h: 0.9, recover: 6 }, adsZoom: 1.15, sound: 'revolver',
    desc: 'Heavy-caliber sidearm. One headshot, any range.'
  },
  hornet: {
    id: 'hornet', name: 'HORNET', slot: 1, type: 'smg', price: 1100,
    damage: { body: 27, head: 67, leg: 23 }, falloff: [[20, 1], [Infinity, 0.85]],
    fireRate: 14, auto: true, mag: 25, reserve: 75, reloadTime: 2.25,
    spread: { base: 0.55, move: 1.35, crouch: 0.8, ads: 0.7, bloom: 0.22, decay: 9 },
    recoil: { v: 0.9, h: 0.6, recover: 10 }, adsZoom: 1.15, sound: 'smg',
    desc: 'Fast SMG. Run-and-gun accurate; shreds up close.'
  },
  breacher: {
    id: 'breacher', name: 'BREACHER', slot: 1, type: 'shotgun', price: 900,
    damage: { body: 13, head: 26, leg: 11 }, falloff: [[8, 1], [15, 0.55], [Infinity, 0.15]],
    pellets: 9, fireRate: 1.25, auto: false, mag: 5, reserve: 15, reloadTime: 0.7, reloadPerShell: true,
    spread: { base: 5.2, move: 1.15, crouch: 0.9, ads: 0.85, bloom: 0.4, decay: 5 },
    recoil: { v: 5.5, h: 1.6, recover: 5 }, adsZoom: 1.1, sound: 'shotgun',
    desc: 'Pump shotgun. Nine pellets — lethal inside 8 m.'
  },
  raptor: {
    id: 'raptor', name: 'RAPTOR', slot: 1, type: 'rifle', price: 2900,
    damage: { body: 39, head: 156, leg: 33 }, falloff: [[15, 1], [30, 0.9], [Infinity, 0.8]],
    fireRate: 11, auto: true, mag: 30, reserve: 60, reloadTime: 2.5,
    spread: { base: 0.22, move: 3.8, crouch: 0.75, ads: 0.6, bloom: 0.16, decay: 8 },
    recoil: { v: 1.25, h: 0.45, recover: 8 }, adsZoom: 1.25, sound: 'rifleQuiet',
    desc: 'Suppressed rifle. Tight spray, no tracers, slight falloff.'
  },
  kestrel: {
    id: 'kestrel', name: 'KESTREL', slot: 1, type: 'rifle', price: 2900,
    damage: { body: 40, head: 160, leg: 34 }, falloff: [[Infinity, 1]],
    fireRate: 9.75, auto: true, mag: 25, reserve: 50, reloadTime: 2.5,
    spread: { base: 0.25, move: 4.2, crouch: 0.75, ads: 0.6, bloom: 0.2, decay: 7 },
    recoil: { v: 1.7, h: 0.7, recover: 7 }, adsZoom: 1.25, sound: 'rifleLoud',
    desc: 'Battle rifle. Full damage at any range, one-tap headshot.'
  },
  bulwark: {
    id: 'bulwark', name: 'BULWARK', slot: 1, type: 'lmg', price: 1600,
    damage: { body: 32, head: 64, leg: 27 }, falloff: [[30, 1], [Infinity, 0.85]],
    fireRate: 12.5, auto: true, mag: 50, reserve: 100, reloadTime: 4.2,
    spread: { base: 0.7, move: 2.6, crouch: 0.6, ads: 0.75, bloom: 0.12, decay: 6 },
    recoil: { v: 1.1, h: 0.9, recover: 6 }, adsZoom: 1.15, sound: 'lmg', moveMult: 0.9,
    desc: 'Light machine gun. Fifty rounds — plant your feet.'
  },
  longbow: {
    id: 'longbow', name: 'LONGBOW', slot: 1, type: 'sniper', price: 4700,
    damage: { body: 150, head: 255, leg: 120 }, falloff: [[Infinity, 1]],
    fireRate: 1.2, auto: false, mag: 5, reserve: 10, reloadTime: 3.4, boltTime: 0.7,
    spread: { base: 4.5, move: 1.6, crouch: 0.8, ads: 0.0, bloom: 0, decay: 4 },
    recoil: { v: 6, h: 0.8, recover: 3 }, adsZoom: 4, adsZoom2: 8, scoped: true, sound: 'sniper', moveMult: 0.9,
    desc: 'Bolt-action sniper. One shot to body or head. Hip-fire is a prayer.'
  }
};

SP.ARMOR = {
  light: { id: 'light', name: 'LIGHT SHIELD', price: 400, hp: 25, desc: 'Absorbs 66% of damage until depleted.' },
  heavy: { id: 'heavy', name: 'HEAVY SHIELD', price: 1000, hp: 50, desc: 'Absorbs 66% of damage until depleted.' }
};

SP.BUY_LAYOUT = {
  side: ['hawk9', 'warden'],
  mid: ['hornet', 'breacher'],
  rifle: ['raptor', 'kestrel'],
  heavy: ['bulwark', 'longbow']
};

/* Kill streak tiers (kills within one round) */
SP.STREAKS = [
  null,
  { title: 'KILL', sub: 'FIRST BLOOD OF THE ROUND', voice: '' },
  { title: 'DOUBLE KILL', sub: 'TWO DOWN', voice: 'Double kill' },
  { title: 'TRIPLE KILL', sub: 'THREE DOWN — KEEP GOING', voice: 'Triple kill' },
  { title: 'QUADRA KILL', sub: 'ONE MORE FOR THE ACE', voice: 'Quadra kill' },
  { title: 'ACE', sub: 'ALL FIVE — FLAWLESS ROUND', voice: 'Ace!' }
];

SP.util = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  deg: d => d * Math.PI / 180,
  fmtTime: s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  falloff: (weapon, dist) => {
    if (!weapon.falloff) return 1;
    for (const [r, m] of weapon.falloff) if (dist <= r) return m;
    return 1;
  }
};
