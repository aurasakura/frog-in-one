import * as THREE from "three";
import { getViewHeading } from "./components/Camera.js";

const MAX_DRAG_PX = 220; // drag length for full power (less on small screens)
const MAX_DRAG_SCREEN_SHARE = 0.35; // ...at most this share of the shorter screen side
const CANCEL_DRAG_PX = 15; // released closer than this to the start = cancelled
const PICK_RADIUS_PX = 80; // how close to Froggy a press must start
const PICK_HEIGHT = 12; // aim the pick at Froggy's body, not his feet
const TURN_PER_PIXEL = 0.008; // right-drag view turn, radians per pixel

// --- Keys ---

// Each flag is set here and cleared once the game handles it.
// Space: skip (e.g. the level banner)
export const actionInput = { requested: false };
// E (or pressing the powerup panel): use the held powerup (§6).
// `held` stays true while the key/panel is held down (Glide needs it).
export const powerupInput = { requested: false, held: false };
// Esc: pause / resume
export const pauseInput = { requested: false };

window.addEventListener("keydown", (event) => {
    if (event.target.closest?.("input, textarea")) return; // typing, e.g. the player's name
    if (event.code === "Space") {
        event.preventDefault(); // stop Space from scrolling the page
        if (!event.repeat) actionInput.requested = true; // once per key press
    } else if (event.code === "KeyE") {
        powerupInput.held = true;
        if (!event.repeat) powerupInput.requested = true;
    } else if (event.code === "Escape") {
        if (!event.repeat) pauseInput.requested = true;
    }
});

window.addEventListener("keyup", (event) => {
    if (event.code === "KeyE") powerupInput.held = false;
});

// A key released while the window is in the background never sends keyup
window.addEventListener("blur", () => {
    powerupInput.held = false;
});

// Pointer position across the screen, -1 (left edge) to 1 (right edge);
// used to steer while gliding
export const pointer = { x: 0 };

window.addEventListener("pointermove", (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
});

// --- Slingshot drag (mouse and touch, via pointer events) ---

const drag = {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    // Camera's ground directions, frozen when the drag starts so the aim
    // doesn't shift while the camera turns to follow it
    forward: new THREE.Vector2(),
    right: new THREE.Vector2(),
};
let pendingLaunch = null;

// Right-drag turns the camera around Froggy to look at the surroundings
const turnDrag = { active: false, pointerId: null, lastX: 0 };
let pendingTurn = 0; // radians, collected until the game takes them

let canvas = null;
let camera = null;
let target = null;
let canAim = () => true;

const projected = new THREE.Vector3();

function maxDragPx() {
    const shorterSide = Math.min(window.innerWidth, window.innerHeight);
    return Math.min(MAX_DRAG_PX, shorterSide * MAX_DRAG_SCREEN_SHARE);
}

function isNearFroggy(clientX, clientY) {
    projected.copy(target.position);
    projected.z += PICK_HEIGHT;
    projected.project(camera);

    const rect = canvas.getBoundingClientRect();
    const screenX = rect.left + ((projected.x + 1) / 2) * rect.width;
    const screenY = rect.top + ((1 - projected.y) / 2) * rect.height;
    return Math.hypot(clientX - screenX, clientY - screenY) <= PICK_RADIUS_PX;
}

// Aim for the drag so far: { direction: Vector2 on the ground, power 0–1 },
// or null when the drag is too short to count
function aimFromDrag() {
    const dx = drag.x - drag.startX;
    const dy = drag.y - drag.startY; // screen y points down
    const length = Math.hypot(dx, dy);
    if (length < CANCEL_DRAG_PX) return null;

    // Screen drag → ground drag; the hop goes the opposite way
    const direction = new THREE.Vector2()
        .addScaledVector(drag.right, -dx)
        .addScaledVector(drag.forward, dy)
        .normalize();
    const power = Math.min(1, length / maxDragPx());
    return { direction, power };
}

function onPointerDown(event) {
    if (event.button === 2) {
        startTurn(event);
        return;
    }
    if (event.button !== 0) return;
    if (drag.active || !canAim() || !isNearFroggy(event.clientX, event.clientY)) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);

    drag.forward.copy(getViewHeading(camera)).normalize();
    drag.right.set(drag.forward.y, -drag.forward.x); // forward turned 90° clockwise

    drag.active = true;
    drag.pointerId = event.pointerId;
    drag.startX = drag.x = event.clientX;
    drag.startY = drag.y = event.clientY;
}

function startTurn(event) {
    if (drag.active || turnDrag.active || !canAim()) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    turnDrag.active = true;
    turnDrag.pointerId = event.pointerId;
    turnDrag.lastX = event.clientX;
}

function onPointerMove(event) {
    if (turnDrag.active && event.pointerId === turnDrag.pointerId) {
        // Dragging right turns the view to the right (clockwise from above)
        pendingTurn -= (event.clientX - turnDrag.lastX) * TURN_PER_PIXEL;
        turnDrag.lastX = event.clientX;
        return;
    }
    if (!drag.active || event.pointerId !== drag.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
}

function onPointerUp(event) {
    if (turnDrag.active && event.pointerId === turnDrag.pointerId) {
        turnDrag.active = false;
        return;
    }
    if (!drag.active || event.pointerId !== drag.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.active = false;

    pendingLaunch = aimFromDrag(); // null if released near the start = cancelled
}

function onPointerCancel(event) {
    if (event.pointerId === drag.pointerId) drag.active = false;
    if (event.pointerId === turnDrag.pointerId) turnDrag.active = false;
}

// `player` is what the drag must start on; `canAimCheck` says whether
// aiming is allowed right now (e.g. only when Froggy has stopped)
export function initInput(canvasElement, activeCamera, player, canAimCheck) {
    canvas = canvasElement;
    camera = activeCamera;
    target = player;
    canAim = canAimCheck;

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    // Right-click is for turning the view, not the browser's menu
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
}

// View turn from right-dragging since the last call (radians, once)
export function takeViewTurn() {
    const turn = pendingTurn;
    pendingTurn = 0;
    return turn;
}

// Current aim while dragging, or null
export function getAim() {
    return drag.active ? aimFromDrag() : null;
}

// The aim from the last completed drag (once), or null
export function takeLaunch() {
    const launch = pendingLaunch;
    pendingLaunch = null;
    return launch;
}

export function cancelAim() {
    drag.active = false;
    turnDrag.active = false;
    pendingLaunch = null;
    pendingTurn = 0;
}
