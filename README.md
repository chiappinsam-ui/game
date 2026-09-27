# Strikepoint

A browser-based 5v5 tactical shooter in the Valorant/CS style, built from scratch with **Three.js** and vanilla JavaScript. No build step, no assets to download — every model, texture and sound is generated in code.

## Run it

1. Open the `strikepoint` folder in VS Code.
2. Double-click `index.html` (or right-click → *Open with Live Server* if you have that extension). Any desktop browser works — Chrome or Edge give the best performance.
3. Click **DEPLOY**, then click the game once to lock the mouse.

Three.js loads from a CDN; if you're offline it falls back to the copy in `js/vendor/`.

`dist/strikepoint.html` is the same game bundled into one file (needs internet for Three.js).

## Controls

| Key | Action |
| --- | --- |
| `W A S D` | Move · `Shift` walk silently · `Ctrl` crouch · `Space` jump |
| `LMB` / `RMB` | Fire / aim down sights (sniper: right-click again for 8× zoom) |
| `R` | Reload |
| `1` `2` `3` `4` | Primary · sidearm · knife · charge  —  `Q` last weapon · scroll to cycle |
| `E` (hold) | Plant / defuse the charge · pick up dropped weapons |
| `G` | Drop weapon |
| `B` | Buy menu (buy phase only) |
| `Tab` | Scoreboard · `M` minimap · `Esc` pause |

## How a match works

- **Attackers** plant the charge in site A or B (4 s). It detonates after 45 s unless a defender defuses it (7 s).
- **Defenders** win by killing all attackers or running out the 100 s clock.
- First to 7 rounds (configurable: 4 / 7 / 13). Sides swap at half-time.
- Economy: 800 start · win 3000 · loss 1900 (+500 per consecutive loss) · kill 200 · plant 300. Survive the round and you keep your weapons and remaining shield.
- Damage by hitbox: head / body / legs, with range falloff. Shields absorb 66 % of damage until depleted.

## Kill streak sounds

Every kill you get in a round plays a distinct synthesized confirm, escalating 1 → 5:

| Kills | Banner | Sound |
| --- | --- | --- |
| 1 | KILL | clean metallic tink (brighter on headshot) |
| 2 | DOUBLE KILL | two rising notes + sub hit |
| 3 | TRIPLE KILL | triad arpeggio with echo |
| 4 | QUADRA KILL | four-note run + shimmer chord |
| 5 | **ACE** | impact, riser, five-note stinger, sparkle tail + big red banner |

Tiers 2–5 also get a voice call-out ("Double kill" … "Ace!") through the browser's speech synthesis (toggle in settings).

## Weapons (all original)

| Weapon | Type | Cost | Body / Head |
| --- | --- | --- | --- |
| Hawk-9 | pistol | free | 26 / 78 |
| Warden | heavy pistol | 800 | 55 / 159 |
| Hornet | SMG | 1100 | 27 / 67 |
| Breacher | pump shotgun | 900 | 9 × 13 / 26 |
| Bulwark | LMG | 1600 | 32 / 64 |
| Raptor | suppressed rifle | 2900 | 39 / 156 |
| Kestrel | battle rifle | 2900 | 40 / 160 |
| Longbow | bolt-action sniper | 4700 | 150 / 255 |

## Project layout

```
index.html        page + HUD markup
css/style.css     HUD, menus, banners
js/config.js      weapon stats, economy, timings, names
js/audio.js       Web Audio synth: gunshots, footsteps, reloads, kill sounds, announcer
js/textures.js    procedural canvas textures & sprites
js/map.js         the "Foundry" map, AABB collision, raycasts, nav graph + A*
js/effects.js     muzzle flash, tracers, sparks, blood, decals, shells, smoke, explosion, camera shake
js/weapons.js     3D gun models, first-person viewmodel (recoil/ADS/reload), hitscan damage
js/player.js      first-person controller, hitboxes, damage
js/bots.js        humanoid bot models, animation, tactical AI (perception, pathing, plant/defuse)
js/hud.js         HUD, buy menu, scoreboard, minimap, killfeed
js/game.js        rounds, economy, plant/defuse, kill streaks, spectating
js/main.js        renderer, lights, input, menus, main loop
build.js          bundles everything into dist/
```

Tweak balance in `js/config.js`; the map is plain code in `js/map.js` (`box()` calls plus a list of nav nodes).
