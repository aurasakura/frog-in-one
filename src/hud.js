import { POWERUPS, powerupIconCanvas } from "./powerups.js";
import { powerupInput } from "./input.js";
import { getMuted, toggleMuted } from "./sound.js";

// In-game HUD (§5): level, hops (strokes) vs par and time vs target along the top,
// the powerup panel on the right, plus short messages like "Splash! Try again"
const levelElement = document.querySelector(".hud-level");
const strokesElement = document.querySelector(".hud-strokes");
const timeElement = document.querySelector(".hud-time");
const panelElement = document.querySelector(".powerup-panel");
const slotElement = panelElement.querySelector(".powerup-slot");
const nameElement = panelElement.querySelector(".powerup-name");
const messageElement = document.querySelector(".message");

let strokes = 0;
let par = 0;
let timeTarget = 0;
let elapsed = 0;
let timerRunning = false;

export function formatTime(seconds) {
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

// Reset for a new attempt at a level
export function startHud(levelNumber, data) {
    strokes = 0;
    par = data.par;
    timeTarget = data.timeTarget;
    elapsed = 0;
    timerRunning = false;
    levelElement.textContent = `Level ${levelNumber} · ${data.name}`;
    setPowerupSlot(null);
    updateHud(0);
}

export function startTimer() {
    timerRunning = true;
}

export function stopTimer() {
    timerRunning = false;
}

export function addStroke() {
    strokes++;
}

export function getStrokes() {
    return strokes;
}

export function getElapsedTime() {
    return elapsed;
}

export function updateHud(delta) {
    if (timerRunning) elapsed += delta;

    strokesElement.textContent = `Hops ${strokes} / Par ${par}`;
    strokesElement.classList.toggle("over", strokes > par);
    timeElement.textContent = `${formatTime(elapsed)} / ${formatTime(timeTarget)}`;
    timeElement.classList.toggle("over", elapsed >= timeTarget);
}

// Show the held powerup in the panel on the right (or an empty slot), with
// its E key badge. `armed` marks a powerup that has been used and is
// waiting for the next shot (Super Leap).
export function setPowerupSlot(type, armed = false) {
    panelElement.classList.toggle("empty", !type);
    panelElement.classList.toggle("armed", armed);
    slotElement.style.background = type ? POWERUPS[type].color : "";
    nameElement.textContent = !type ? "No powerup" : armed ? `${POWERUPS[type].name} ready` : POWERUPS[type].name;

    slotElement.querySelector("img")?.remove();
    if (type) {
        const icon = document.createElement("img");
        icon.src = powerupIconCanvas(type, 64).toDataURL();
        icon.alt = POWERUPS[type].name;
        slotElement.prepend(icon);
    }
}

// Pressing (and holding) the panel works like E, for touch screens
panelElement.addEventListener("pointerdown", (event) => {
    event.preventDefault(); // don't take keyboard focus, or Space would "click" the panel
    panelElement.setPointerCapture(event.pointerId); // keep the hold if the finger slides off
    powerupInput.requested = true;
    powerupInput.held = true;
});
for (const type of ["pointerup", "pointercancel"]) {
    panelElement.addEventListener(type, () => {
        powerupInput.held = false;
    });
}

// Brief message under the HUD, e.g. "Splash! Try again"
export function showMessage(text) {
    messageElement.textContent = text;
    // Restart the CSS fade animation even if the same message is showing
    messageElement.classList.remove("show");
    void messageElement.offsetWidth;
    messageElement.classList.add("show");
}

// --- Mute button (top right, next to pause) ---

const muteButton = document.querySelector(".mute-button");

function showMuteState() {
    const muted = getMuted();
    muteButton.classList.toggle("muted", muted);
    muteButton.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
    muteButton.title = muted ? "Unmute sound" : "Mute sound";
}

muteButton.addEventListener("pointerdown", (event) => event.preventDefault()); // keep focus off it
muteButton.addEventListener("click", () => {
    toggleMuted();
    showMuteState();
});
showMuteState();
