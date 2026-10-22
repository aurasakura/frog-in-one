import { hasSeenTip, markTipSeen } from "./progress.js";

// First-touch tips: a short card the first time Froggy meets each mechanic,
// shown once and remembered (saved progress). Powerups show theirs on every
// pickup. They back up the signposts at each mechanic's intro spot.

const TIP_TIME = 5; // seconds a tip stays up

export const TIPS = {
    water: ["Splash!", "Froggy goes back to where he last stood. No extra hop is added, but the one that splashed still counts."],
    puddle: ["Puddles", "Puddles are water too: landing in one is a splash."],
    grass: ["Grass", "Froggy slides a little after landing. Aim a bit short!"],
    mud: ["Mud", "Sticky! Froggy stops dead, and his next hop has only 60% power."],
    flowerBed: ["Flower beds", "Soft soil, like mud: you stop dead and your next hop is weaker."],
    wetPavement: ["Wet pavement", "Slippery! Froggy slides a long way and can slide right off an edge."],
    slime: ["Slime", "Land on top for a free bounce that doesn't count as a hop, and keep bouncing from pad to pad. Hit the side and you bounce back."],
    sprinkler: ["Sprinkler", "Its spray blows Froggy off course while he's in the air."],
    hoseJet: ["Hose", "Watch for the drip, then the jet. It knocks Froggy sideways."],
    washingLine: ["Laundry", "Pass under when it's swung up. Hanging down, it knocks you away."],
    doubleHop: ["Double Hop", "Press E in mid-air for an extra hop."],
    glide: ["Glide", "Hold E in mid-air to float down slowly. Steer with the mouse."],
    superLeap: ["Super Leap", "Press E before a shot, then hop: 1.5× the power."],
};

const card = document.querySelector(".tip-card");
const titleElement = card.querySelector(".tip-title");
const textElement = card.querySelector(".tip-text");
let hideTimer = null;
const queue = []; // tips waiting for the current one to finish

// Show a tip the first time only; one that comes up while another is
// showing waits its turn
export function showTip(id) {
    if (!TIPS[id] || hasSeenTip(id)) return;
    markTipSeen(id);
    queue.push(id);
    if (card.hidden) showNext();
}

// Show a tip every time (e.g. on each powerup pickup), not just the first;
// it goes to the front of the queue
export function showTipAlways(id) {
    if (!TIPS[id]) return;
    markTipSeen(id);
    if (queue.includes(id)) return;
    queue.unshift(id);
    if (card.hidden) showNext();
}

function showNext() {
    const id = queue.shift();
    if (!id) return;
    const [title, text] = TIPS[id];
    titleElement.textContent = title;
    textElement.textContent = text;
    card.hidden = false;
    card.classList.remove("show");
    void card.offsetWidth; // restart the slide-in
    card.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideTip, TIP_TIME * 1000);
}

function hideTip() {
    clearTimeout(hideTimer);
    card.hidden = true;
    showNext();
}

card.addEventListener("click", hideTip);
