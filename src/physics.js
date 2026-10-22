import * as THREE from "three";
import { player, model } from "./components/Player.js";
import { aimGuide } from "./components/AimGuide.js";
import { splash, mudSplat } from "./components/Splash.js";
import { WATER_Z } from "./components/Water.js";
import { collidesWithProp } from "./components/Props.js";
import { getAim, takeLaunch, cancelAim, powerupInput, pointer } from "./input.js";
import { level, surfaceAt, getLilyPadBob } from "./levels/levelBuilder.js";
import { CELL_SIZE } from "./components/Terrace.js";
import { addStroke, showMessage, setPowerupSlot, stopTimer } from "./hud.js";
import { game, setState, completeLevel } from "./gameState.js";
import { POWERUPS } from "./powerups.js";
import { dust, sparkles, frogShadow } from "./components/Effects.js";
import { shakeCamera } from "./components/Camera.js";
import { setFrogExpression, updateFrogBlink } from "./components/FrogModel.js";
import { showTip, showTipAlways } from "./tips.js";
import {
    playSplash,
    playSplat,
    playBoing,
    playGulp,
    playLaunch,
    playLand,
    playThump,
    playPowerup,
    playCroak,
} from "./sound.js";

export const GRAVITY = 600; // units/s², along -z
const LAUNCH_ANGLE = THREE.MathUtils.degToRad(50); // fixed (§3)
const MAX_LAUNCH_SPEED = 470; // at full power: about 9 tiles on flat ground
export const FALL_LIMIT_Z = -20; // below this Froggy has fallen off (§3)

const FROG_HEIGHT = 24; // rough height of the model, for obstacle hits
const FROG_CENTER_HEIGHT = 12; // centre of his body above his feet

const LANDING_SPEED_KEEP = 0.5; // share of horizontal speed kept on landing
const SIDE_BOUNCE = 0.3; // speed kept (reversed) after hitting a wall
const STOP_SPEED = 3; // slower than this while sliding = stopped
const STEP_TOLERANCE = 0.5; // height gap still treated as level ground
const MAX_STEP = 1 / 30; // longest physics step, so a slow frame can't tunnel
const SPLASH_PAUSE = 0.8; // seconds to watch the splash before returning

// Sliding deceleration per surface (units/s²); higher = shorter slide
const SURFACE_FRICTION = {
    grass: 600, // medium: about half a tile after a full-power hop
    mud: Infinity, // stops dead
    wetPavement: 60, // long slide, can carry Froggy over an edge
    slime: 400,
    lilyPad: 3000, // stops almost at once
};

// Surfaces (§4)
const MUD_POWER = 0.6; // the hop after landing in mud has 60% power
const SLIME_SIDE_BOUNCE = 0.8; // slime walls are much bouncier than soil
const SLIME_BOUNCE_KEEP = 0.85; // share of falling speed returned by a free bounce
const SLIME_MIN_FALL_SPEED = 50; // slower landings just stick
const SLIME_MIN_BOUNCE_SPEED = 250; // a free bounce is at least this strong

// Powerups (§6)
const DOUBLE_HOP_POWER = 0.65;
const GLIDE_TIME = 2; // longest glide in seconds; letting go of E ends it sooner
const GLIDE_FALL_SPEED = 45; // units/s while gliding
const GLIDE_STEER_RATE = 1.2; // radians/s of turn with the pointer at the screen edge
const SUPER_LEAP_POWER = 1.5;
const SUPER_LEAP_PREVIEW = 0.75; // share of the arc the aim guide shows while Super Leap is armed

// Squash & stretch: extra height scale at the start, easing back to 1
const STRETCH_AMOUNT = 0.35;
const STRETCH_TIME = 0.25; // seconds
const SQUASH_AMOUNT = -0.35;
const SQUASH_TIME = 0.25;
const GULP_AMOUNT = -0.2;
const GULP_TIME = 0.2;

// Victory on the lily pad: a backflip, a turn to face the camera, then a
// big grin and a wave
const VICTORY_FLIP_TIME = 0.8; // seconds
const VICTORY_FLIP_HEIGHT = 30;
const VICTORY_TURN_TIME = 0.45;
const VICTORY_SMILE_TIME = 0.25; // to grow into the grin
export const VICTORY_TIME = VICTORY_FLIP_TIME + VICTORY_TURN_TIME + 0.9; // until the pose is held
const BODY_MIDDLE = 6.5; // height of his middle, which the flip turns around

// Standing still: slow breathing, and every few seconds a croak, a quick
// double puff of the throat ("rib-bit") with a little sound
const BREATH_SPEED = 3; // radians per second (about one breath every 2 s)
const BREATH_SWELL = 0.03; // how much wider at the top of a breath
const CROAK_INTERVAL_MIN = 2.5; // seconds between croaks…
const CROAK_INTERVAL_MAX = 4.5; // …picked at random in this range
const CROAK_TIME = 0.45; // length of the double puff
const CROAK_PUFF = 0.18; // how much wider at the biggest puff
const CROAK_SHORTEN = 0.07; // and how much shorter

// Winding up while the slingshot is pulled back (scaled by power):
// crouch down (and puff out wider), lean back, tremble near full power
const CROUCH_SQUASH = 0.32; // height lost at full power
const CROUCH_SPEED = 12; // how quickly he follows the pull
const LEAN_BACK = 0.35; // radians at full power
const TREMBLE_FROM = 0.6; // power where trembling starts
const TREMBLE_AMOUNT = 0.7; // world units at full power
const TREMBLE_SPEED = 55; // radians per second

// Knocked over by a hose jet: he tips back onto his butt in the air, lands
// sitting and slides off butt-first, then gets back up once he stops
const TUMBLE_TILT = 1.0; // radians tipped back
const TUMBLE_RAISE = 4; // lifts him so he sits on his butt, not his back
const TUMBLE_SPEED = 8; // how quickly he tips over / gets back up (per second)
const TUMBLE_LANDING_KEEP = 0.85; // share of horizontal speed kept landing on his butt
const TUMBLE_FRICTION = 0.6; // share of the surface's friction while sliding on his butt (not on wet pavement)

// Screen shake strengths (world units)
const OBSTACLE_SHAKE = 5;
const LAUNCH_SHAKE = 4; // at full power; falls off steeply for softer hops
const BUMP_SHAKE = 2;

// Landing dust colour per surface
const DUST_COLORS = {
    grass: "#D8CFA8",
    wetPavement: "#CFE8FF",
    slime: "#B8F07A",
    lilyPad: "#CFE8FF",
};

// Movement state that isn't the game state itself (aiming / flying /
// sliding live in gameState.js). `heading` is the aim / launch direction.
export const hop = {
    heading: new THREE.Vector2(0, 1),
    velocity: new THREE.Vector3(),
    lastSafe: new THREE.Vector3(),
    lastSafePower: 1, // powerMultiplier at the last safe spot (60% on mud)
    powerup: null, // held powerup type
    powerMultiplier: 1, // < 1 after landing in mud
    superLeapArmed: false,
    lastSlimePad: null, // slime pad just bounced off: landing on it again sticks
    tumbling: false, // knocked onto his butt by a hose jet, until he stops
    glideTime: 0, // seconds of glide left
    splashTimer: 0, // > 0 while watching a splash
    completeOnStop: false, // landed on the lily pad
    aimPower: 0, // 0–1 while the slingshot is being pulled back, else 0
    powerupsUsed: 0, // this attempt (for the controls walkthrough)
};

// What obstacles see of Froggy
const frog = {
    position: player.position,
    velocity: hop.velocity,
    radius: 0,
    height: FROG_HEIGHT,
    airborne: false,
};

const deform = { amount: 0, time: 0, duration: 1 };
// Infinity when not celebrating; the flip carries him from `from` to the
// middle of the lily pad (`to`)
const victory = { time: Infinity, fromAngle: 0, from: new THREE.Vector3(), to: new THREE.Vector3() };
const flipAxis = new THREE.Vector3();
const flipQuaternion = new THREE.Quaternion();
const flipMiddle = new THREE.Vector3();
const flipMiddleTurned = new THREE.Vector3();
// Wind-up crouch, idle croak and knocked-over (tumble, 0–1) state
const pose = { crouch: 0, time: 0, nextCroak: CROAK_INTERVAL_MIN, croakTime: CROAK_TIME, tumble: 0 };

function randomCroakInterval() {
    return CROAK_INTERVAL_MIN + Math.random() * (CROAK_INTERVAL_MAX - CROAK_INTERVAL_MIN);
}
const leanAxis = new THREE.Vector3();

const previous = new THREE.Vector3();
const frogCenter = new THREE.Vector3();
const flyCenter = new THREE.Vector3();
const launchVelocityTemp = new THREE.Vector3();

export function isMidHop() {
    return game.state === "flying" || game.state === "sliding";
}

// Froggy can only aim once he has fully stopped
export function canAim() {
    return game.state === "aiming";
}

export function getFrog() {
    frog.radius = player.userData.radius;
    frog.airborne = game.state === "flying";
    return frog;
}

function effectivePower(power) {
    return power * hop.powerMultiplier * (hop.superLeapArmed ? SUPER_LEAP_POWER : 1);
}

function launchVelocity(direction, power, target) {
    const speed = MAX_LAUNCH_SPEED * power;
    const ground = speed * Math.cos(LAUNCH_ANGLE);
    return target.set(
        direction.x * ground,
        direction.y * ground,
        speed * Math.sin(LAUNCH_ANGLE)
    );
}

// Turn the model to face (x, y). It starts facing -y; because of its x
// rotation, turning it around the world z-axis means changing rotation.y.
function face(x, y) {
    if (model && (x !== 0 || y !== 0)) model.rotation.y = Math.atan2(x, -y);
}

function startDeform(amount, duration) {
    deform.amount = amount;
    deform.duration = duration;
    deform.time = 0;
}

// Per-frame model pose. Outside a hop Froggy faces his heading (this also
// covers the model finishing loading during the level banner).
//
// Squash & stretch scale the model inside the player group: taller/thinner
// when stretched, flatter/wider when squashed, keeping its volume about the
// same. The ground offset is scaled too, so his feet stay on the ground.
//
// Also places the soft shadow under Froggy while he's in the air, and plays
// the victory animation on the lily pad.
export function updateModel(delta) {
    const airborne = game.state === "flying" && hop.splashTimer <= 0;
    const ground = surfaceAt(player.position.x, player.position.y);
    frogShadow.update(delta, player.position, ground && ground.type !== "water" ? ground.z : null, airborne);

    if (!model) return;
    if (!isMidHop()) face(hop.heading.x, hop.heading.y);
    deform.time += delta;
    pose.time += delta;
    const progress = Math.min(1, deform.time / deform.duration);
    let height = 1 + deform.amount * (1 - progress) ** 2;

    // Wind-up: crouch follows how far the slingshot is pulled back
    const pull = game.state === "aiming" ? hop.aimPower : 0;
    pose.crouch += (pull - pose.crouch) * Math.min(1, CROUCH_SPEED * delta);
    height *= 1 - CROUCH_SQUASH * pose.crouch;

    // Idle while standing still and not aiming: breathe, and croak now
    // and then. Any other activity cuts a croak short.
    let swell = 0;
    const standingStill = (game.state === "aiming" || game.state === "levelIntro") && pull === 0;
    if (standingStill && pose.crouch < 0.05) {
        swell = BREATH_SWELL * (0.5 + 0.5 * Math.sin(pose.time * BREATH_SPEED));
        pose.nextCroak -= delta;
        if (pose.nextCroak <= 0) {
            pose.nextCroak = randomCroakInterval();
            pose.croakTime = 0;
            playCroak();
        }
    } else {
        pose.nextCroak = randomCroakInterval();
        pose.croakTime = CROAK_TIME;
    }
    if (pose.croakTime < CROAK_TIME) {
        pose.croakTime += delta;
        const progress = Math.min(1, pose.croakTime / CROAK_TIME);
        // Two puffs, the second ("bit") a little bigger than the first ("rib")
        const puff = Math.abs(Math.sin(progress * Math.PI * 2)) * (progress < 0.5 ? 0.75 : 1);
        swell += CROAK_PUFF * puff;
        height *= 1 - CROAK_SHORTEN * puff;
    }

    const width = (1 / Math.sqrt(height)) * (1 + swell);
    const base = model.userData.baseScale;
    // The model's local y is world up (it was turned upright around x)
    model.scale.set(base * width, base * height, base * width);
    model.position.z = model.userData.groundOffset * height;

    // Near full power he trembles, ready to spring
    const tremble = Math.max(0, (pose.crouch - TREMBLE_FROM) / (1 - TREMBLE_FROM));
    model.position.x = tremble * TREMBLE_AMOUNT * Math.sin(pose.time * TREMBLE_SPEED);

    // Lean back, away from the aim direction (tilting the whole player
    // group around the axis to his right). Knocked over, he tips much
    // further back, onto his butt, away from the way he's facing.
    pose.tumble += ((hop.tumbling ? 1 : 0) - pose.tumble) * Math.min(1, TUMBLE_SPEED * delta);
    if (pose.tumble > 0.001) {
        const facing = model.rotation.y; // see face()
        leanAxis.set(-Math.cos(facing), -Math.sin(facing), 0);
        player.quaternion.setFromAxisAngle(leanAxis, TUMBLE_TILT * pose.tumble);
        model.position.z += TUMBLE_RAISE * pose.tumble;
    } else {
        leanAxis.set(hop.heading.y, -hop.heading.x, 0);
        if (pose.crouch > 0.001 && leanAxis.lengthSq() > 0) {
            player.quaternion.setFromAxisAngle(leanAxis.normalize(), LEAN_BACK * pose.crouch);
        } else {
            player.quaternion.identity();
        }
    }

    // Upright, facing his heading (set above); the victory flip changes this,
    // so reset the other axes every frame
    model.rotation.x = Math.PI / 2;
    model.rotation.z = 0;
    updateVictory(delta);

    // On the lily pad he bobs up and down with it on the water
    if (game.state === "levelComplete") model.position.z += getLilyPadBob();

    updateFrogBlink(model, delta); // whether moving or standing still
}

const smooth = (t) => t * t * (3 - 2 * t);

// Victory on the lily pad (see VICTORY_*). The flip turns the model around
// his middle, about the axis to his right, so it's a true backflip
// whichever way he faces.
function updateVictory(delta) {
    if (victory.time === Infinity) {
        setFrogExpression(model, 0);
        return;
    }
    victory.time += delta;
    const t = victory.time;

    // 1. Backflip, travelling to land in the middle of the lily pad
    if (t < VICTORY_FLIP_TIME) {
        const progress = t / VICTORY_FLIP_TIME;
        player.position.lerpVectors(victory.from, victory.to, smooth(progress));
        flipAxis.set(hop.heading.y, -hop.heading.x, 0).normalize();
        flipQuaternion.setFromAxisAngle(flipAxis, Math.PI * 2 * smooth(progress));
        model.quaternion.premultiply(flipQuaternion);
        // Keep his middle in place while turning, and lift him into the air
        flipMiddle.set(0, 0, BODY_MIDDLE);
        flipMiddleTurned.copy(flipMiddle).applyQuaternion(flipQuaternion);
        model.position.add(flipMiddle).sub(flipMiddleTurned);
        model.position.z += Math.sin(progress * Math.PI) * VICTORY_FLIP_HEIGHT;
        setFrogExpression(model, 0);
        return;
    }

    player.position.copy(victory.to);

    // 2. Turn round to face the camera (behind him, opposite his heading)
    const turn = Math.min(1, (t - VICTORY_FLIP_TIME) / VICTORY_TURN_TIME);
    model.rotation.y = victory.fromAngle + Math.PI * smooth(turn);

    // 3. Grin and wave once he's facing us
    const happy = turn < 1 ? 0 : Math.min(1, (t - VICTORY_FLIP_TIME - VICTORY_TURN_TIME) / VICTORY_SMILE_TIME);
    setFrogExpression(model, smooth(happy), smooth(happy), t);
}

// Victory animation on reaching the lily pad
export function startVictory() {
    victory.time = 0;
    victory.from.copy(player.position);
    victory.to.set(level.lilyPad.col * CELL_SIZE, level.lilyPad.row * CELL_SIZE, level.lilyPad.z);
    victory.fromAngle = Math.atan2(hop.heading.x, -hop.heading.y); // his current facing (see face())
}

// Put Froggy at the level start with a clean slate
export function placeAtStart() {
    player.position.copy(level.start);
    player.visible = true;
    hop.lastSafe.copy(level.start);
    hop.lastSafePower = 1;
    hop.velocity.set(0, 0, 0);
    hop.heading.set(0, 1);
    hop.powerup = null;
    hop.powerMultiplier = 1;
    hop.superLeapArmed = false;
    hop.lastSlimePad = null;
    hop.tumbling = false;
    pose.tumble = 0;
    hop.glideTime = 0;
    hop.splashTimer = 0;
    hop.completeOnStop = false;
    hop.aimPower = 0;
    hop.powerupsUsed = 0;
    deform.time = deform.duration;
    victory.time = Infinity;
    pose.crouch = 0;
    aimGuide.hide();
    face(hop.heading.x, hop.heading.y);
}

function launch({ direction, power }) {
    aimGuide.hide();
    hop.aimPower = 0;
    hop.heading.copy(direction);
    launchVelocity(direction, effectivePower(power), hop.velocity);
    hop.powerMultiplier = 1;
    if (hop.superLeapArmed) {
        hop.superLeapArmed = false;
        setPowerupSlot(hop.powerup);
    }
    hop.lastSlimePad = null;
    hop.tumbling = false;
    addStroke();
    startDeform(STRETCH_AMOUNT, STRETCH_TIME);
    shakeCamera(LAUNCH_SHAKE * power ** 3); // a kick you feel mostly on big hops
    playLaunch();
    setState("flying");
}

function rest() {
    hop.velocity.set(0, 0, 0);
    hop.tumbling = false; // gets back up
    if (hop.completeOnStop) {
        completeLevel();
        return;
    }
    hop.lastSafe.copy(player.position);
    hop.lastSafePower = hop.powerMultiplier;
    setState("aiming");
}

// Landed in water or fell off: splash, then back to the last safe spot
// (no extra stroke: the hop that splashed already counted)
function fallInWater() {
    // Splash on the puddle's surface, or down on the lake around the level
    const puddle = surfaceAt(player.position.x, player.position.y);
    const waterZ = puddle?.type === "water" ? puddle.z : WATER_Z;
    splash.play(player.position.x, player.position.y, waterZ);
    playSplash();
    showTip(puddle?.type === "water" ? "puddle" : "water");
    player.visible = false;
    hop.velocity.set(0, 0, 0);
    hop.glideTime = 0;
    hop.tumbling = false;
    hop.splashTimer = SPLASH_PAUSE;
    showMessage("Splash! Try again");
}

function returnToSafeSpot() {
    hop.splashTimer = 0;
    player.position.copy(hop.lastSafe);
    hop.powerMultiplier = hop.lastSafePower;
    player.visible = true;
    setState("aiming");
}

// --- Powerups ---

function usePowerup() {
    const type = hop.powerup;
    if (!type) return;

    if (type === "superLeap") {
        if (game.state !== "aiming") {
            showMessage(POWERUPS[type].hint);
            return;
        }
        hop.powerup = null;
        hop.superLeapArmed = true;
        setPowerupSlot("superLeap", true);
        playPowerup();
        hop.powerupsUsed++;
        showMessage("Super Leap ready! 1.5×");
        return;
    }

    // Double Hop and Glide work in mid-air
    if (game.state !== "flying" || hop.splashTimer > 0) {
        showMessage(POWERUPS[type].hint);
        return;
    }
    hop.powerup = null;
    setPowerupSlot(null);
    playPowerup();
    hop.powerupsUsed++;

    if (type === "doubleHop") {
        const direction = new THREE.Vector2(hop.velocity.x, hop.velocity.y);
        if (direction.lengthSq() < 1) direction.copy(hop.heading);
        launchVelocity(direction.normalize(), DOUBLE_HOP_POWER, hop.velocity);
        hop.glideTime = 0;
        startDeform(STRETCH_AMOUNT, STRETCH_TIME);
        showMessage("Double Hop!");
    } else if (type === "glide") {
        hop.glideTime = GLIDE_TIME;
        showMessage("Gliding: keep holding E");
    }
}

// Hopping through a fly gulps it; the new powerup replaces any held one
function collectFlies() {
    frogCenter.copy(player.position);
    frogCenter.z += FROG_CENTER_HEIGHT;
    const radius = player.userData.radius;

    for (const fly of level.flies) {
        if (fly.collected) continue;
        if (fly.getCenter(flyCenter).distanceTo(frogCenter) > fly.radius + radius) continue;

        fly.gulp(player.position);
        playGulp();
        sparkles.play(frogCenter.x, frogCenter.y, frogCenter.z, POWERUPS[fly.type].color);
        showTipAlways(fly.type); // what it does, on the left
        startDeform(GULP_AMOUNT, GULP_TIME);
        hop.powerup = fly.type;
        setPowerupSlot(fly.type, false);
    }
}

// Obstacles push or knock Froggy; a knock sends him flying from anywhere
function applyObstacles(delta) {
    const frogView = getFrog();
    let knocked = false;
    for (const obstacle of level.obstacles) {
        const result = obstacle.collide(frogView, delta);
        if (result) showTip(obstacle.kind);
        if (result === "knocked") {
            knocked = true;
            // A hose jet knocks him onto his butt, facing the jet as he's
            // pushed away from it
            if (obstacle.kind === "hoseJet") {
                hop.tumbling = true;
                face(-hop.velocity.x, -hop.velocity.y);
            }
        }
    }
    if (!knocked) return;

    hop.glideTime = 0;
    hop.completeOnStop = false;
    startDeform(STRETCH_AMOUNT, STRETCH_TIME);
    shakeCamera(OBSTACLE_SHAKE);
    playThump();
    if (game.state !== "flying") {
        cancelAim();
        aimGuide.hide();
        hop.aimPower = 0;
        hop.lastSlimePad = null;
        setState("flying");
    }
}

// --- States ---

function updateAiming(delta) {
    applyObstacles(delta);
    if (game.state !== "aiming") return;

    const aim = getAim();
    hop.aimPower = aim ? aim.power : 0;
    if (aim) {
        hop.heading.copy(aim.direction);
        aimGuide.show(
            player.position,
            launchVelocity(aim.direction, effectivePower(aim.power), launchVelocityTemp),
            GRAVITY,
            aim.power,
            hop.superLeapArmed ? SUPER_LEAP_PREVIEW : undefined
        );
    } else {
        aimGuide.hide();
    }
    face(hop.heading.x, hop.heading.y);

    const released = takeLaunch();
    if (released) launch(released);
}

function bounceBack(factor) {
    shakeCamera(BUMP_SHAKE);
    player.position.x = previous.x;
    player.position.y = previous.y;
    hop.velocity.x *= -factor;
    hop.velocity.y *= -factor;
}

function land(surface) {
    const position = player.position;
    hop.glideTime = 0;

    // Slime top: a free bounce, costing no stroke, on each new pad (so
    // Froggy can bounce along a row of pads, but not forever on one)
    if (surface.type === "slime" && surface.slimePad !== hop.lastSlimePad && -hop.velocity.z > SLIME_MIN_FALL_SPEED) {
        position.z = surface.z;
        hop.velocity.z = Math.max(-hop.velocity.z * SLIME_BOUNCE_KEEP, SLIME_MIN_BOUNCE_SPEED);
        hop.lastSlimePad = surface.slimePad;
        surface.poke?.();
        playBoing();
        startDeform(SQUASH_AMOUNT, SQUASH_TIME);
        showMessage("Boing! Free bounce");
        showTip("slime");
        return;
    }

    position.z = surface.z;
    hop.velocity.z = 0;
    // On his butt he keeps more of his speed, to slide off
    const keep = hop.tumbling ? TUMBLE_LANDING_KEEP : LANDING_SPEED_KEEP;
    hop.velocity.x *= keep;
    hop.velocity.y *= keep;
    startDeform(SQUASH_AMOUNT, SQUASH_TIME);
    if (surface.type !== "mud") {
        dust.play(position.x, position.y, position.z + 2, DUST_COLORS[surface.type] ?? DUST_COLORS.grass);
        playLand();
    }

    if (surface.type === "mud") {
        showTip(surface.flowerBed ? "flowerBed" : "mud");
        hop.powerMultiplier = MUD_POWER;
        mudSplat.play(position.x, position.y, position.z);
        playSplat();
        showMessage(surface.flowerBed ? "In the flowers! Next hop 60%" : "Muddy! Next hop 60%");
        rest();
        return;
    }
    if (surface.type === "slime") {
        surface.poke?.();
        showTip("slime");
    }
    if (surface.type === "grass" || surface.type === "wetPavement") showTip(surface.type);
    if (surface.type === "lilyPad") {
        hop.completeOnStop = true; // landing completes the level (§3)
        stopTimer();
    }
    setState("sliding");
}

function updateFlight(delta) {
    if (hop.splashTimer > 0) {
        hop.splashTimer -= delta;
        if (hop.splashTimer <= 0) returnToSafeSpot();
        return;
    }

    const position = player.position;
    previous.copy(position);

    // Glide lasts only while E (or the powerup panel) is held
    if (hop.glideTime > 0 && !powerupInput.held) {
        hop.glideTime = 0;
        showMessage("Glide over");
    }
    if (hop.glideTime > 0) {
        // Slow fall, steered gently by the pointer's left/right position
        hop.glideTime -= delta;
        hop.velocity.z = Math.max(hop.velocity.z - GRAVITY * delta, -GLIDE_FALL_SPEED);
        const turn = -pointer.x * GLIDE_STEER_RATE * delta;
        const { x, y } = hop.velocity;
        hop.velocity.x = x * Math.cos(turn) - y * Math.sin(turn);
        hop.velocity.y = x * Math.sin(turn) + y * Math.cos(turn);
    } else {
        hop.velocity.z -= GRAVITY * delta;
    }

    applyObstacles(delta);
    position.addScaledVector(hop.velocity, delta);
    face(hop.velocity.x, hop.velocity.y);
    collectFlies();

    if (position.z < FALL_LIMIT_Z || position.z <= WATER_Z) {
        fallInWater();
        return;
    }

    const radius = player.userData.radius;
    if (collidesWithProp(position.x, position.y, position.z, radius)) {
        bounceBack(SIDE_BOUNCE);
        return;
    }

    const surface = surfaceAt(position.x, position.y);
    if (!surface || position.z > surface.z) return;

    if (surface.type === "water") {
        fallInWater(); // a puddle or pond
        return;
    }
    if (previous.z >= surface.z - STEP_TOLERANCE) {
        land(surface); // came down onto the top
    } else if (surface.type === "slime") {
        // Hit the side of a slime block: boing back
        bounceBack(SLIME_SIDE_BOUNCE);
        surface.poke?.();
        playBoing();
    } else {
        bounceBack(SIDE_BOUNCE); // hit the side of a higher terrace
    }
}

function updateSlide(delta) {
    applyObstacles(delta);
    if (game.state !== "sliding") return;

    const position = player.position;
    const surface = surfaceAt(position.x, position.y);

    const speed = Math.hypot(hop.velocity.x, hop.velocity.y);
    let friction = SURFACE_FRICTION[surface?.type] ?? SURFACE_FRICTION.grass;
    if (hop.tumbling && surface?.type !== "wetPavement") friction *= TUMBLE_FRICTION;
    const newSpeed = Math.max(0, speed - friction * delta);
    if (newSpeed < STOP_SPEED) {
        rest();
        return;
    }
    hop.velocity.x *= newSpeed / speed;
    hop.velocity.y *= newSpeed / speed;
    // Butt first when knocked over, else facing the way he slides
    if (hop.tumbling) face(-hop.velocity.x, -hop.velocity.y);
    else face(hop.velocity.x, hop.velocity.y);

    const nextX = position.x + hop.velocity.x * delta;
    const nextY = position.y + hop.velocity.y * delta;
    const next = surfaceAt(nextX, nextY);

    if (collidesWithProp(nextX, nextY, position.z, player.userData.radius)) {
        rest();
    } else if (next?.type === "water") {
        // Slid into a puddle
        position.x = nextX;
        position.y = nextY;
        setState("flying");
        fallInWater();
    } else if (!next || next.z < position.z - STEP_TOLERANCE) {
        // Slid off an edge: fall
        position.x = nextX;
        position.y = nextY;
        hop.velocity.z = 0;
        hop.lastSlimePad = null;
        setState("flying");
    } else if (next.z > position.z + STEP_TOLERANCE) {
        // Slid into the side of a higher terrace or slime block
        if (next.type === "slime") {
            hop.velocity.x *= -SLIME_SIDE_BOUNCE;
            hop.velocity.y *= -SLIME_SIDE_BOUNCE;
            next.poke?.();
            playBoing();
        } else {
            rest();
        }
    } else {
        position.set(nextX, nextY, next.z);
        collectFlies();
        if (next.type === "lilyPad" && !hop.completeOnStop) {
            hop.completeOnStop = true;
            stopTimer();
        }
    }
}

// Runs while the game is in a playing state (aiming / flying / sliding)
export function updatePhysics(delta) {
    const step = Math.min(delta, MAX_STEP);

    if (powerupInput.requested) {
        powerupInput.requested = false;
        usePowerup();
    }

    if (game.state === "aiming") updateAiming(step);
    else if (game.state === "flying") updateFlight(step);
    else if (game.state === "sliding") updateSlide(step);
}
