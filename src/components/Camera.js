import * as THREE from "three";

const FOV = 55; // degrees
const FOLLOW_DISTANCE = 150; // behind Froggy, along the aim direction
const FOLLOW_HEIGHT = 90; // above Froggy
const LOOK_AHEAD = 100; // look at a point this far in front of Froggy
// While the slingshot is pulled back the camera pulls back with it, rises
// and looks further ahead, to show more of where he'll land (at full power)
const AIM_PULL_BACK = 80;
const AIM_RAISE = 40;
const AIM_LOOK_FURTHER = 140;
const FOLLOW_LERP = 0.08; // share of the remaining gap closed each frame
const SHAKE_DECAY = 6; // per second: how quickly a shake dies away
const SHAKE_SPEED = 45; // wobble frequency (radians per second)
// Rumble while the slingshot is pulled back: starts at AIM_RUMBLE_FROM of
// full power and grows to AIM_RUMBLE at full power (world units)
const AIM_RUMBLE_FROM = 0.35;
const AIM_RUMBLE = 1.6;
// Victory close-up: the camera swoops in low and close, a little to one
// side, looking at Froggy's face (he turns round to face it)
const CLOSE_DISTANCE = 52;
const CLOSE_HEIGHT = 18;
const CLOSE_SIDE = 20; // off to his side, for a three-quarter view
const CLOSE_LOOK_HEIGHT = 1; // look low, so he sits in the upper half (the stars screen fills the lower half)
const CLOSE_SWOOP_SPEED = 1.6; // how quickly the swoop blends in (per second)
// Level intro: the camera starts close in front of Froggy's face and sweeps
// round his side to its usual place behind him
const INTRO_START_DISTANCE = 45;
const INTRO_START_HEIGHT = 16;
const INTRO_START_LOOK_HEIGHT = 24; // above his head, so he sits below the centred title

// Third-person chase camera. It lives in the scene (not inside the player)
// and is moved by updateCamera every frame.
export function Camera() {
    const camera = new THREE.PerspectiveCamera(
        FOV,
        window.innerWidth / window.innerHeight,
        1, // near plane
        9000 // far plane
    );
    camera.up.set(0, 0, 1); // z-axis points up

    camera.userData = {
        // The one direction the camera looks along (on the ground). It follows
        // Froggy's heading, except while the player is looking around.
        viewHeading: new THREE.Vector2(0, 1),
        lookingAround: false, // turned with right-drag, not yet handed to an aim
        lookAt: new THREE.Vector3(),
        followPosition: new THREE.Vector3(), // where the follow puts it, before shake
        snapped: false, // jump straight into place on the first update
        shake: 0, // current shake strength (world units)
        shakeTime: 0,
        time: 0,
        closeUp: 0, // 0 = normal chase view, 1 = victory close-up
    };

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    return camera;
}

const desiredPosition = new THREE.Vector3();
const desiredLookAt = new THREE.Vector3();
const ORIGIN = new THREE.Vector2();

// Follow `target` from behind, along `aimDirection` (Froggy's heading, a
// Vector2 on the ground). `aimPull` (0–1) is how far the slingshot is
// pulled back.
//   - Aiming: the view follows the aim. The aim is read relative to the
//     view, so after looking around it continues smoothly from there.
//   - Looking around (right-drag): the view stays where it was turned.
//   - Mid-hop (`locked`): the view keeps its direction.
//   - Otherwise it sits behind Froggy's heading.
// `victory` swoops into a close-up of Froggy (see CLOSE_*). `intro` (0–1,
// or null) is how far through the level intro sweep (see INTRO_*) we are.
export function updateCamera(camera, target, aimDirection, locked, delta, aimPull = 0, victory = false, intro = null) {
    const state = camera.userData;
    state.time += delta;
    if (aimPull > 0) {
        state.viewHeading.copy(aimDirection).normalize();
        state.lookingAround = false;
    } else if (!locked && !state.lookingAround && aimDirection.lengthSq() > 0) {
        state.viewHeading.copy(aimDirection).normalize();
    }
    const heading = state.viewHeading;

    // Blend towards the victory close-up (eased), or straight back out of it
    state.closeUp = victory ? Math.min(1, state.closeUp + CLOSE_SWOOP_SPEED * delta) : 0;
    const close = state.closeUp * state.closeUp * (3 - 2 * state.closeUp);
    const blend = (normal, closeUp) => normal + (closeUp - normal) * close;

    const distance = blend(FOLLOW_DISTANCE + AIM_PULL_BACK * aimPull, CLOSE_DISTANCE);
    const height = blend(FOLLOW_HEIGHT + AIM_RAISE * aimPull, CLOSE_HEIGHT);
    const lookAhead = blend(LOOK_AHEAD + AIM_LOOK_FURTHER * aimPull, 0);
    const side = CLOSE_SIDE * close; // along his right: (heading.y, -heading.x)
    desiredPosition.set(
        target.x - heading.x * distance + heading.y * side,
        target.y - heading.y * distance - heading.x * side,
        target.z + height
    );
    desiredLookAt.set(
        target.x + heading.x * lookAhead,
        target.y + heading.y * lookAhead,
        target.z + CLOSE_LOOK_HEIGHT * close
    );

    if (intro !== null) {
        // Level intro: from his face, round his side, to behind him. Placed
        // exactly (no lag), and it ends exactly at the chase view.
        const e = intro * intro * (3 - 2 * intro);
        const angle = Math.PI * e; // 0 = in front of him, π = behind
        const dirX = heading.x * Math.cos(angle) - heading.y * Math.sin(angle);
        const dirY = heading.x * Math.sin(angle) + heading.y * Math.cos(angle);
        const distance = INTRO_START_DISTANCE + (FOLLOW_DISTANCE - INTRO_START_DISTANCE) * e;
        state.followPosition.set(
            target.x + dirX * distance,
            target.y + dirY * distance,
            target.z + INTRO_START_HEIGHT + (FOLLOW_HEIGHT - INTRO_START_HEIGHT) * e
        );
        state.lookAt.set(
            target.x + heading.x * LOOK_AHEAD * e,
            target.y + heading.y * LOOK_AHEAD * e,
            target.z + INTRO_START_LOOK_HEIGHT * (1 - e)
        );
        state.snapped = true;
    } else if (state.snapped) {
        state.followPosition.lerp(desiredPosition, FOLLOW_LERP);
        state.lookAt.lerp(desiredLookAt, FOLLOW_LERP);
    } else {
        state.followPosition.copy(desiredPosition);
        state.lookAt.copy(desiredLookAt);
        state.snapped = true;
    }

    // Shake: a quick decaying wobble on top of the smooth follow
    if (pendingShake > 0) {
        state.shake = Math.max(state.shake, pendingShake);
        state.shakeTime = 0;
        pendingShake = 0;
    }
    camera.position.copy(state.followPosition);
    if (state.shake > 0.05) {
        state.shakeTime += delta;
        state.shake *= Math.exp(-SHAKE_DECAY * delta);
        const t = state.shakeTime * SHAKE_SPEED;
        camera.position.x += Math.sin(t) * state.shake;
        camera.position.y += Math.sin(t * 1.3 + 1) * state.shake;
        camera.position.z += Math.sin(t * 0.7 + 2) * state.shake * 0.6;
    }

    // Rumble that builds as the slingshot is pulled back further
    const rumble = AIM_RUMBLE * Math.max(0, (aimPull - AIM_RUMBLE_FROM) / (1 - AIM_RUMBLE_FROM)) ** 2;
    if (rumble > 0) {
        const t = state.time * SHAKE_SPEED * 1.2;
        camera.position.x += Math.sin(t) * rumble;
        camera.position.y += Math.sin(t * 1.37 + 2) * rumble;
        camera.position.z += Math.sin(t * 0.83 + 4) * rumble * 0.5;
    }
    camera.lookAt(state.lookAt);
}

// Turn the view around Froggy (right-drag) by `radians`, without turning him
export function turnCamera(camera, radians) {
    if (radians === 0) return;
    camera.userData.viewHeading.rotateAround(ORIGIN, radians);
    camera.userData.lookingAround = true;
}

// The ground direction the camera is turning to look along (what aiming is
// read relative to; unlike the camera itself it doesn't lag behind)
export function getViewHeading(camera) {
    return camera.userData.viewHeading;
}

let pendingShake = 0;

// Gentle screen shake, e.g. when an obstacle knocks Froggy; applied by the
// next updateCamera
export function shakeCamera(strength = 4) {
    pendingShake = Math.max(pendingShake, strength);
}

// Jump straight into place on the next update, e.g. after a restart
export function snapCamera(camera) {
    camera.userData.snapped = false;
    camera.userData.lookingAround = false;
    camera.userData.closeUp = 0;
}
