import { isTutorialDone, markTutorialDone } from "./progress.js";
import { isTouchScreen } from "./input.js";

// Controls walkthrough in Level 1 (until finished once, or skipped). Each
// step stays up until the player has done it; play carries on normally.

const LOOK_TURN_NEEDED = 0.6; // radians of view turning to count as "looked around"

// Each step: text, and a check that's true once it's done. `state` is
// { aimPower, strokes, turned, powerupsUsed, levelComplete }.
const STEPS = [
    { text: "Press on Froggy and drag back to aim", done: (s) => s.aimPower > 0.15 || s.strokes > 0 },
    { text: "Let go to hop! Drag further back for a bigger jump", done: (s) => s.strokes > 0 },
    { text: "Drag anywhere away from Froggy to look around", done: (s) => s.turned >= LOOK_TURN_NEEDED },
    {
        text: isTouchScreen
            ? "Hop through a glowing fly, then tap the powerup button in mid-air to use it"
            : "Hop through a glowing fly, then press E in mid-air to use it",
        done: (s) => s.powerupsUsed > 0 },
    { text: "Land on the lily pad by the red flag to finish!", done: (s) => s.levelComplete },
];

const panel = document.querySelector(".tutorial");
const textElement = panel.querySelector(".tutorial-text");
const stepElement = panel.querySelector(".tutorial-step");

let step = -1; // -1 = not running
let turned = 0;

export function isTutorialRunning() {
    return step >= 0;
}

// Called when a level starts: the walkthrough runs in level 1 until done
export function startTutorial(levelIndex) {
    turned = 0;
    step = levelIndex === 0 && !isTutorialDone() ? 0 : -1;
    show();
}

function finish() {
    step = -1;
    markTutorialDone();
    show();
}

function show() {
    const running = step >= 0;
    panel.hidden = !running;
    if (!running) return;
    textElement.textContent = STEPS[step].text;
    stepElement.textContent = `${step + 1} / ${STEPS.length}`;
    panel.classList.remove("next");
    void panel.offsetWidth; // restart the little pop
    panel.classList.add("next");
}

// Per frame while playing. `turn` is this frame's view turn.
export function updateTutorial({ aimPower, strokes, powerupsUsed, levelComplete, turn }) {
    if (step < 0) return;
    turned += Math.abs(turn);
    const state = { aimPower, strokes, turned, powerupsUsed, levelComplete };
    // Skip ahead past anything already done (e.g. a powerup used early)
    let advanced = false;
    while (step < STEPS.length && STEPS[step].done(state)) {
        step++;
        advanced = true;
    }
    if (step >= STEPS.length) finish();
    else if (advanced) show();
}

panel.querySelector(".tutorial-skip").addEventListener("click", finish);
// Don't take keyboard focus, or Space would "click" Skip
panel.querySelector(".tutorial-skip").addEventListener("pointerdown", (e) => e.preventDefault());
