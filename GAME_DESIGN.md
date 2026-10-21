# Froggy Golf — Game Design

Reference for every future change. If code and this document disagree, update one of them on purpose.

## 1. Pitch and story

A hopping frog golf game. **Froggy** (the existing Tode model) is the golf ball. He hops home to his wife across **5 levels**, which are floating garden terraces over water. Each level ends at a **lily pad**; reach it in as few strokes as possible.

- **Intro cutscene:** Froggy sets off for home.
- **Levels 1–5:** one terrace course each (§8).
- **Outro cutscene:** Froggy arrives home to his wife.

### Cutscenes

- **Intro** (plays when **Play** starts level 1): a slow camera sweep over level 1's route, from the lily pad back to Froggy, with short text boxes: Froggy is far from home, and his wife is waiting by the garden pond with dinner. It ends where the chase camera starts, so play begins seamlessly.
- **Outro** (after level 5's **Finish**): the camera orbits Froggy's garden pond. His wife waits on the lily pad (the frog model in pink, with a small red bow). Froggy hops on beside her, they both break into a grin with love hearts floating up around them, they do three happy hops together, and then the total stars across all levels are shown, with **Play again** and **Level Select**.
- **Skipping:** both cutscenes can be skipped with a click or Space.

## 2. Conventions

- **Z is up.** The ground is the XY plane at z = 0.
- glTF models are Y-up. Stand them up with `model.rotation.x = Math.PI / 2`, then turn them around world Z through `model.rotation.y`.
- Lift every model by its bounding box so it sits on its surface (`model.position.z = -box.min.z`).
- Grid unit: `CELL_SIZE = 40` world units.
- Each object lives in its own module in `src/components/`. Game systems (physics, input, state) live in `src/`. `main.js` only wires things together and runs the loop.
- Tunable numbers are named constants at the top of their module.

## 3. Core loop: one stroke

1. **Aim.** Press on Froggy and drag *backwards*, like a slingshot.
   - Drag direction gives the hop direction, opposite to the drag.
   - Drag length gives power, capped at a maximum.
   - While aiming, show a power indicator and a predicted arc. The arc preview shows only the **first 40%** of the arc (`ARC_PREVIEW_FRACTION = 0.4`). Later levels can shorten it.
2. **Release.** Froggy launches in a ballistic arc: speed comes from power, at a **fixed launch angle**, with gravity pulling along −z. This costs **1 stroke**.
3. **Land.** What happens next depends on the surface Froggy lands on (§4).
4. **Slide.** Froggy slides along the ground, slowed by that surface's friction, until he stops.
5. **Rest.** Froggy is ready for the next stroke. This spot becomes his **last safe spot**.

**Water:** if Froggy lands in water or falls off a terrace, he goes back to his last safe spot. There is **no penalty stroke**: only the hop itself counts. Falling off means Froggy's z drops below **−20** (`FALL_LIMIT_Z = -20`).

**Hole out:** **landing on the lily pad** completes the level. The pad has high friction, so Froggy barely slides on it.

## 4. Surfaces

| Surface | On landing / sliding | Notes |
|---|---|---|
| Grass | Short slide (medium friction) | Default terrace surface |
| Mud | Stops dead, no slide | **Next** hop has 60% power |
| Wet pavement | Long slide (low friction) | Can carry Froggy over an edge |
| Slime | Hitting its **side** bounces Froggy back. Landing on **top** gives a free bounce (an extra hop that costs no stroke), again on each new slime pad | Raised block |
| Water | Back to last safe spot (no extra stroke) | Surrounds every terrace; puddles on the Rainy Street |
| Lily pad | Very short slide (high friction) | Landing anywhere in its little pool (the whole tile) completes the level. The pad floats in a stone-rimmed pool with a red golf flag beside it, so it's easy to spot from across the level; the pad bobs on the water, and Froggy bobs with it while he celebrates |
| Flower bed | Like mud: stops dead, next hop 60% | A raised bed (9 high); landing in it is soft, its sides block like a step |

## 5. Scoring

Each level has a **par** (strokes) and a **time target** (seconds). It earns up to 3 stars:

- ★ for finishing the level
- ★ for finishing at or under par (every hop counts, including ones that splash)
- ★ for finishing under the time target

The HUD shows: level number, strokes vs. par, elapsed time vs. target, and the powerup Froggy is holding.

## 6. Flies (powerups)

The existing bugs become **flies**. Each fly type has its own colour (colour-blind-safe palette) and its own flight pattern. Every fly has a **dark outline and a soft glow**, so it stands out against any surface. Hopping through a fly collects it.

- Froggy holds **one powerup at a time**. Collecting a new fly **replaces** the held powerup.
- **E** uses it. Tapping the powerup panel (right edge of the screen) does the same on touch screens.

| Powerup | Colour | Fly motion | Icon | Effect |
|---|---|---|---|---|
| Double Hop | Magenta `#CC79A7` | Bouncing | ⬆⬆ | Use mid-air: one extra hop from where Froggy is |
| Glide | Deep blue `#0072B2` | Slow drifting | Wide wings | **Hold E** in mid-air: falls slowly while held (up to **2 seconds**), steerable slightly with the mouse; letting go ends it |
| Super Leap | Orange-gold `#E69F00` | Fast darting | Single ⬆, sparkle trail | Use before a shot: next hop has **1.5× power** |

Glide's fall speed, its steering strength and Double Hop's power are still to be tuned.

## 7. Moving obstacles

| Obstacle | Behaviour | Effect on Froggy |
|---|---|---|
| Rotating sprinkler | Spins; the spray sweeps a sector | Wind pushes Froggy sideways **while in the air** |
| Garden hose jet | Straight water stream that turns on and off on a timer | Knocks Froggy sideways when hit (in the air or on the ground) |
| Washing line | Real laundry (T-shirts, trousers, shorts, dresses, striped towels, pairs of socks, with clothespins) swings back and forth; each line hangs its own mix, chosen from its position | Passable when the clothes are lifted; when they hang straight, each garment knocks Froggy (in the direction it's swinging) if it reaches down to him, so short items like socks and shorts leave gaps he can slip under |

Each obstacle is a component with its own `update(delta)` and collision test, so levels can place any number of them.

## 8. Levels

There are 5 levels. Each is a set of floating terraces (platforms at possibly different heights) over a water plane. Each level is plain data in `src/levels/levelN.js`, built by `levelBuilder.js`. The data gives:
- terraces and their surfaces
- start position and lily pad
- flies, obstacles and props
- par, time target, and how much of the arc the aim guide shows

### Cumulative structure

The levels build on each other. Each one:

1. **Introduces** its new mechanics somewhere they can be tried with little risk, usually on a wide terrace near the start with solid ground all round.
2. **Combines** them later in the same level with everything learned before, in new ways, so earlier skills stay useful.
3. **Offers at least two routes:** a **safe, longer route** that needs no powerups, and a **riskier shortcut** that uses a powerup or a surface cleverly.
4. **Gets a little harder:** tighter combinations, more hazards at once, and a shorter arc preview.

| # | Level | Introduces (safe spot first) | Mixes in | Safe route | Shortcut | Par | Target | Arc preview |
|---|---|---|---|---|---|---|---|---|
| 1 | Front Lawn | Grass sliding, terrace gaps, Double Hop (fly over the start lawn) | — | West around the pond on wide lawns, 1-tile gaps | Straight across the pond via a stepping-stone lawn; a Double Hop fly over the pond | 5 | 1:10 | 40% |
| 2 | Garden | Mud (patio patch), sprinkler (wide lawn), Super Leap (fly on the patio) | Grass slides, gaps, Double Hop | Through the vegetable plot's mud rows | Super Leap from the lawn over the whole plot | 5 | 1:25 | 37% |
| 3 | Rainy Street | Wet pavement (street ends in a mud strip), puddles, hose jets, Glide (fly at the street start) | Mud strips as safe stops between slides, sprinklers, Double Hop, Super Leap | Up the street, along the side alley's mud stops, into the front garden | Hop from the far curb through the Glide fly high over the middle of the flooded crossing, then hold E to Glide across | 7 | 1:50 | 34% |
| 4 | Backyard | Slime (two blocks on the patio), washing line (across a wide lawn) | Wet patio sliding into a slime wall, hose, mud, sprinkler, all three flies | Lawn → wet patio → vegetable patch → deck | A chain of single slime stepping stones; each top landing gives a free bounce to the next | 6 | 2:00 | 31% |
| 5 | Home Street | Nothing new | Everything, in the hardest combinations: a wide wet street with puddles and two hose jets out of step, a yard with slime, mud and a washing line, a wet side path between slime posts | Through every section in turn | Super Leap over the side path, or Glide across the gap after the yard | 7 | 2:20 | 28% |

Level 2's combination example: a sprinkler on the finish deck's edge blows Froggy back over the last gap, and a Double Hop fly hovers over that gap to beat it.

Level 5 ends at Froggy's garden pond by his house. The lily pad floats in the pond, and missing it is a splash. The outro starts from there.

**Par and time targets** come from a route check: the fewest strokes along the safe route with careful hops of at most 5 tiles. There is no extra stroke for hazards, since splashing costs no penalty. Time allows roughly 12–20 s per stroke, more where you have to wait for obstacles. Retune both after playtesting.

**Route check (perfect play):** a physics simulation of the game's hops (all directions and powers, with and without each powerup, slime bounces and slides included; moving obstacles left out as they depend on timing) confirms that in every level the harder route takes fewer strokes than the easier one: level 1 3 vs 2, level 2 4 vs 2, level 3 4 vs 2, level 4 4 vs 2, level 5 3 vs 2.

### Props

Levels are dressed with neighbourhood props as **static obstacles** (`components/Props.js`, built from simple geometry): picket fences, mailboxes, bins, flower beds and birdbaths, plus houses (`small_house.glb`).
- Every prop registers a collision shape in `Props.js`, using `collision.js`: a bounding-box footprint for houses, fences, mailboxes and flower beds, and a circle for bins and birdbaths.
- Froggy bounces off a prop in the air, stops against it when sliding, and clears it by hopping higher than its top.
- **Flower beds** are the exception: their tiles become a raised, mud-like surface, so landing in one stops Froggy dead (next hop 60%) instead of bouncing him off.

## 9. Camera

A **third-person chase camera**. It's added to the scene directly, **not** as a child of the player.

| Setting | Value |
|---|---|
| Field of view | 55° |
| Position | about 150 units behind Froggy and 90 above, relative to the **aim direction** |
| Look target | about 100 units ahead of Froggy, along the aim direction |
| Follow | smooth lerp each frame towards the target position and look point (factor ≈ 0.08) |
| Mid-hop | direction locked to the launch direction until Froggy lands, so the camera doesn't swing |

- **Look around:** while Froggy is waiting to be aimed, **right-drag** turns the camera around him to see the surroundings. Froggy doesn't turn. The view stays turned; when the player then presses and pulls with the left button, the aim is read relative to that view, so Froggy turns to face where they were looking and the camera carries on smoothly from there (the camera keeps a single view direction, so nothing is rotated twice).
- **While aiming:** the camera turns with the aim direction, and pulls back, rises and looks further ahead as the slingshot is pulled (up to 80 back, 40 up, 140 further ahead at full power), showing more of the landing area. It also rumbles, building from 35% power to strongest at full power.
- **Level intro:** while the level title shows ("Level X – Name" in the middle of the screen, par and target time in smaller text below, about 3 s), the camera starts close in front of Froggy's face and sweeps round his side to its usual place behind him, arriving exactly at the chase view. The level timer starts when the title disappears (Space or a click skips it).
- **Victory:** on landing on the lily pad the camera swoops in to a low close-up of Froggy (52 back, 18 up, 20 to the side), framing him in the upper half of the screen above the stars screen.
- **Cutscenes:** the camera follows scripted paths instead.

## 10. Game states

`title` → `intro` → `levelIntro` → `aiming` ↔ `flying` → `sliding` → `aiming` … → `levelComplete` (stars screen) → next level … → `outro` → `title`

- `levelSelect` can be reached from `title`, `paused` and `levelComplete`.
- `paused` can be entered from any playing state.

## 11. Menus

All menus are HTML overlays on top of the canvas.

- **Title screen** (its own scene, `components/TitleScene.js`): Froggy sits on a lily pad in a pond on the right (above the menu on tall, narrow screens), bobbing on the water and every few seconds waving, grinning or doing a little hop. The menu on the left has a **name** field (remembered in saved progress; used on the stars and outro screens) and wooden buttons: **Start** (enabled once a name is entered) continues from the first unfinished level (the intro plays whenever that is level 1), **Tutorial** opens How to Play, **Level Select** and **Leaderboard**. All four buttons are the same size.
- **Leaderboard:** every player's best finish on each level (fewest strokes, then fastest), with an **Overall** tab adding them up (strokes against par, total time) for players who have finished all 5 levels. Opened from the title screen or the outro (centred below **Play Again** and **Level Select**, which sit side by side). Shared online through a Netlify Function (`netlify/functions/leaderboard.mjs`, stored in Netlify Blobs, par taken from the level data); finishes are also kept in localStorage, which the board falls back to when the API can't be reached (e.g. plain `vite dev`; use `netlify dev` to run the function locally).
- **Tutorial (How to Play):** a card for every mechanic, grouped into Playing, Ground, Obstacles and Powerup flies, each with its signpost drawing and its tip text.
- **Level select:** all 5 levels, each showing its best stars (0–3) and par, plus the total. A level **unlocks when the one before it is completed**; level 1 is always unlocked. **Back** returns to wherever it was opened from (title or pause menu).
- **Pause menu** (Esc, or a pause button): **Resume**, **Restart** (the current level, with strokes and timer reset) and **Level Select**.
- **Saved progress** (`progress.js`): best stars per level (unlocks follow from them) and the mute setting are saved in `localStorage` under `froggy-golf-progress`. Every read and write is wrapped in `try/catch`. If storage isn't available (private mode, blocked), the game still works and just doesn't remember progress.
- **Mute button:** top right, next to pause, available on every screen.

## 12. Implementation status

The arcade prototype (enemies, attack, score-based difficulty, Game Over) has been fully replaced. All five levels exist.

| Area | Status | Notes |
|---|---|---|
| Core loop (§3) | Done | Slingshot drag, fixed-angle arc, landing, sliding, last safe spot, splash reset |
| Surfaces (§4) | Done | Grass, mud, wet pavement, slime, puddles/ponds (water tiles) and lily pad |
| Scoring (§5) | Done | HUD plus a stars screen with Retry and Next Level. Best stars aren't saved yet |
| Flies (§6) | Done | All three powerups, collect by hopping through, E (or tap the panel) to use |
| Obstacles (§7) | Done | Sprinkler, hose jet, washing line, all placed from level data |
| Levels (§8) | Done | All 5 levels, cumulative, each with a safe route and a shortcut; neighbourhood props. Par and time targets need playtesting |
| Camera (§9) | Done | Chase camera with resize handling. Cutscene camera paths not built yet |
| Game states (§10) | Done | All states have screens; the game boots to the title. `body[data-state]` mirrors the state so CSS can hide the HUD in menus and cutscenes |
| Menus (§11) | Done | Title, level select, pause menu, saved progress, mute |
| Cutscenes (§1) | Done | Intro sweep and outro with the wife, both skippable (click or Space) |
| Polish | Done | See below |

### Polish

- **Idle:** standing still, Froggy breathes slowly (about 3% wider), and every 2.5–4.5 s croaks: a quick double puff of his throat ("rib-bit", up to 18% wider) with a soft synthesized croak.
- **Launch shake:** a camera kick that grows steeply with power (strongest at full power).
- **Wind-up:** while the slingshot is pulled back he crouches (down to 68% height at full power, puffing out wider), leans back away from the aim, and trembles near full power, ready to spring.
- **Hop shadow:** a soft blob under Froggy while he's in the air, fading with height (`components/Effects.js`).
- **Landing dust:** a puff tinted by the surface; mud has its own splat.
- **Fly sparkle:** stars in the powerup's colour when Froggy eats a fly.
- **Victory on the lily pad** (every finish): Froggy does a backflip around his own middle that carries him to the exact centre of the pad, turns round to face the camera, then grins with closed happy eyes (^ ^) and waves an arm. The camera swoops in low and close for a three-quarter close-up of his face. The stars screen waits until he's done (about 2.4 s), then shows "Level complete!" above him and the stars, results and buttons below him, so he stays in view in the middle.
- **Celebration** (hole in one or under par): confetti and a "Hole in one!" / "Under par!" message on top of the victory.
- **Screen shake:** gentle shake when an obstacle knocks Froggy, smaller when he bumps a wall or prop (`shakeCamera` in `Camera.js`).
- **Sounds:** launch, landing, splash, mud splat, gulp, slime boing, obstacle thump, washing-line whoosh, powerup use, level complete fanfare, and chirps in the outro. All are synthesized in `sound.js` (original, no audio files) and respect the mute setting.

### How the pieces fit

- **Each frame** (`main.js`):
  1. `updateGameState` handles the level banner, pausing and screens.
  2. In a playing state (`aiming`, `flying`, `sliding`), `updatePhysics` and `updateHud` run.
  3. Unless paused, `updateLevel` animates the slime, flies and obstacles, followed by the splash effects and `updateModel` (facing, squash and stretch).
  4. `updateCamera` runs, then the scene is rendered.
- **Game state vs. physics state:** `game.state` in `gameState.js` is the single source of truth for aiming, flying and sliding. `physics.js` changes it only through `setState`, and invalid changes are ignored with a console warning. Details that aren't states, such as the splash pause, glide time and held powerup, live in `hop` in `physics.js`.
- **Obstacles** all share one interface: `{ object, update(delta, frog), collide(frog, delta) }`. `frog` is `{ position, velocity, radius, height, airborne }`. `collide` changes the velocity and returns `null`, `"pushed"` (wind) or `"knocked"`. A knock sends Froggy flying from any state and costs no stroke.
- **Surfaces:** `surfaceAt(x, y)` in `levelBuilder.js` returns the tile under a point (`{ type, z, ... }`), the lily pad, or `null` over water.
  - Mud tiles sit 1.5 lower than the ground around them, puddle tiles 2.5 lower, and slime tiles 16 higher.
  - Landing in (or sliding into) a puddle tile sends Froggy back, the same as the lake.
  - Slime tiles have `poke()`, which makes their block wobble.
- **Restarting** a level rebuilds it from its data, which respawns the flies and resets the obstacles.
- **Aiming direction:** a drag is turned into a ground direction using the camera's direction at the moment the press started. That keeps the aim steady while the camera turns to follow it.
- **Sounds** are synthesized with Web Audio in `sound.js`; there are no audio files. They stay silent until the first user interaction.

### Level data format (`src/levels/levelN.js`)

```js
export default {
    name: "Front Lawn", par: 3, timeTarget: 45,     // seconds
    start: { col, row }, lilyPad: { col, row },     // tiles; tile (0,0) = world origin, +row = +y
    arcPreview: 0.34,                               // share of the arc the aim guide shows
    terraces: [{ col, row, z, rows: ["GGMM.", ...] }], // rows far→near; G grass, M mud, W wet
                                                    // pavement, S slime, P puddle/pond, . none
    flies: [{ type, col, row, height, pattern }],   // col/row may be fractional (over water)
    obstacles: [
        { type: "sprinkler", col, row, startAngle },
        { type: "hoseJet", col, row, direction: [dx, dy], length /* tiles */, offset /* s */ },
        { type: "washingLine", from: { col, row }, to: { col, row }, offset },
    ],
    props: [
        { type: "fence", from: { col, row }, to: { col, row } },
        { type: "mailbox" | "bin" | "birdbath", col, row },
        { type: "flowerBed", col, row, width, depth },  // tiles, from the bottom-left tile
    ],
    houses: [{ col, row, quarterTurns }],
};
```

New levels are added to `LEVELS` in `src/levels/index.js`.

### Assets

Froggy, his wife and the flies are built from smooth shapes in code (`components/FrogModel.js`, the fly model in `components/Fly.js`), in a soft cartoon style. `small_house.glb` is used for houses. `tode.glb` and `enemy.glb` are no longer used.

Everything else is built from Three.js geometry: terraces, water, puddles and the pond, lily pad, sprinkler, hose, washing line, props, the wife's bow, effects and the aim guide.

## 13. Module layout

Current files:

```
src/
  main.js              wiring + animation loop
  gameState.js         state machine (§10), level start/complete, stars, pause and outro screens
  input.js             pointer drag (aim), right-drag (look around), E (powerups), Space (skip), Esc (pause), pointer x (glide steering)
  physics.js           launch, arc, landing, surfaces, slide, splash reset, powerups, fly pickup, obstacle effects
  collision.js         computeRadius, circle–circle, circle–box, footprint (bounding box)
  hud.js               level, strokes/par, time/target (top), powerup panel with E badge (right), messages
  powerups.js          powerup definitions + icon drawing (shared by flies and HUD)
  sound.js             synthesized sound effects + mute
  menus.js             title and level select screens
  progress.js          localStorage save/load (best stars, mute), try/catch
  cutscenes.js         intro sweep and outro, skippable
  levels/
    index.js           LEVELS list
    levelBuilder.js    builds a level from data; surfaceAt, updateLevel
    level1-5.js        Front Lawn, Garden, Rainy Street, Backyard, Home Street
  components/
    Renderer.js  Camera.js  Player.js
    Terrace.js   Water.js   LilyPad.js   House.js
    Fly.js       Sprinkler.js  HoseJet.js  WashingLine.js
    Props.js     (fences, mailboxes, bins, flower beds, birdbaths + the collision registry houses use too)
    AimGuide.js  (arc preview + power bar)
    Splash.js    (water splash, mud splat)
    Effects.js   (hop shadow, dust, sparkles, confetti)
    FrogModel.js (rounded cartoon frog: Froggy's green and the wife's pink colours)
    Wife.js      (Froggy's wife: pink FrogModel with a bow)
    TitleScene.js (title screen: Froggy on his lily pad, waving and grinning)
```

## 14. Decisions and tuning

Decided:

- **Launch angle** is fixed; only direction and power come from the drag.
- **Landing on the lily pad** completes the level, and the pad has high friction. The timer stops on landing.
- **A new fly** replaces the held powerup.
- **Glide** lasts only while E (or the powerup panel) is held, up to 2 s.
- **Stars** on the level-complete screen fill from the left; the list below them shows which goals were met.
- **Falling off** means Froggy's z drops below −20 (or he reaches the water).
- **Slime** gives a free bounce on each slime pad (a touching cluster of slime tiles) Froggy lands on; landing back on the pad he just bounced off sticks. Landings slower than a minimum speed just stick.
- **Obstacle knocks** cost no stroke; only water and falls do.
- **The washing line** knocks Froggy in the direction the clothes are swinging at that moment, not back to the side he came from.

Current values, all constants at the top of the named file. These are first guesses, to be tuned while playtesting:

| What | Value | File |
|---|---|---|
| Launch angle / max launch speed / gravity | 50° / 470 (≈ 9 tiles on flat ground) / 600 | `physics.js` |
| Speed kept on landing | 50% | `physics.js` |
| Slide friction: grass / wet pavement / slime / lily pad | 600 / 60 / 400 / 3000; mud stops dead | `physics.js` |
| Mud next-hop power | 60% | `physics.js` |
| Slime side bounce / free bounce | 80% of speed / 85% of fall speed, at least 250, if falling faster than 50 | `physics.js` |
| Splash pause before returning | 0.8 s | `physics.js` |
| Double Hop / Glide / Super Leap | 65% power / while E is held, up to 2 s, max fall speed 45, steer 1.2 rad/s / 1.5× | `physics.js` |
| Full-power drag / cancel distance / pick radius | 220 px (≤ 35% of the screen) / 15 px / 80 px | `input.js` |
| Arc preview | first 40% of the arc (levels lower it to 28%); 75% while Super Leap is armed | `components/AimGuide.js`, `physics.js` |
| Chase camera | 55°, 150 behind, 90 above, 100 ahead, lerp 0.08; aiming at full power adds 80 back, 40 up, 140 ahead | `components/Camera.js` |
| Idle / wind-up | breath 3% every ~2 s; croak every 2.5–4.5 s, 0.45 s, 18% wider; crouch 32%, lean 0.35 rad, tremble from 60% power | `physics.js` |
| Launch shake / aim rumble / look-around | 4 × power³ / up to 1.6 from 35% power / 0.008 rad per pixel of right-drag | `physics.js`, `Camera.js`, `input.js` |
| Sprinkler | spin 1.2 rad/s, 50° sector, radius 170, wind 520 | `components/Sprinkler.js` |
| Hose jet | off 2.2 s, warning 0.8 s, on 1.4 s; knock 260 sideways + 170 up | `components/HoseJet.js` |
| Washing line | line at 60; 3.2 s swing, lifted past 1.0 rad; garments 20–48 long (longer than ~36 reach Froggy); knock 230 along the swing + 150 up | `components/WashingLine.js` |
| Fly patterns | bounce 18 high; drift radius 30; dart radius 45 every 0.9 s | `components/Fly.js` |

Still open:

- Par and time targets were set from a route check, not playtesting; retune after real play.
