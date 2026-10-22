import { getSensitivity, setSensitivity, getMusicVolume } from "./progress.js";
import { getMuted, toggleMuted } from "./sound.js";
import { setMusicVolume } from "./music.js";

// Settings panel (top right, next to pause, on every screen): mouse/touch
// sensitivity, music volume and mute, all remembered between visits. The
// game carries on while it's open; a press anywhere else closes it.

const button = document.querySelector(".settings-button");
const panel = document.querySelector(".settings-panel");
const sensitivityInput = panel.querySelector(".sensitivity-input");
const sensitivityValue = panel.querySelector(".sensitivity-value");
const musicInput = panel.querySelector(".music-input");
const musicValue = panel.querySelector(".music-value");
const muteInput = panel.querySelector(".mute-input");

function showValues() {
    sensitivityValue.textContent = `${getSensitivity().toFixed(2)}×`;
    musicValue.textContent = `${Math.round(getMusicVolume() * 100)}%`;
}

function showSettings(visible) {
    // Keys go to a focused slider instead of the game (input.js), so hand
    // focus back on closing
    if (!visible && panel.contains(document.activeElement)) document.activeElement.blur();
    panel.hidden = !visible;
    button.setAttribute("aria-expanded", String(visible));
    button.classList.toggle("open", visible);
}

sensitivityInput.value = getSensitivity();
musicInput.value = Math.round(getMusicVolume() * 100);
muteInput.checked = getMuted();
showValues();

sensitivityInput.addEventListener("input", () => {
    setSensitivity(Number(sensitivityInput.value));
    showValues();
});
musicInput.addEventListener("input", () => {
    setMusicVolume(Number(musicInput.value) / 100);
    showValues();
});
muteInput.addEventListener("change", () => {
    if (muteInput.checked !== getMuted()) toggleMuted();
});

button.addEventListener("pointerdown", (event) => event.preventDefault()); // keep focus off it
button.addEventListener("click", () => showSettings(panel.hidden));

// A press outside the panel (and its button) closes it
document.addEventListener("pointerdown", (event) => {
    if (!panel.hidden && !event.target.closest(".settings-panel, .settings-button")) showSettings(false);
});

// Esc closes the panel (and only that: it doesn't also pause). Listening
// on the way down to the page means this runs before input.js's handler.
window.addEventListener("keydown", (event) => {
    if (event.code !== "Escape" || panel.hidden) return;
    event.stopImmediatePropagation();
    showSettings(false);
}, true);
