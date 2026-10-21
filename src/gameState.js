import { LEVELS } from "./levels/index.js";
import { buildLevel, level } from "./levels/levelBuilder.js";
import { placeAtStart, startVictory, VICTORY_TIME, hop } from "./physics.js";
import { player } from "./components/Player.js";
import { confetti } from "./components/Effects.js";
import { snapCamera } from "./components/Camera.js";
import {
    startHud,
    startTimer,
    stopTimer,
    getStrokes,
    getElapsedTime,
    formatTime,
    showMessage,
} from "./hud.js";
import { actionInput, powerupInput, pauseInput, cancelAim } from "./input.js";
import { recordStars, totalStars, firstUnfinishedLevel, getPlayerName } from "./progress.js";
import { initMenus, showTitle, showLevelSelect } from "./menus.js";
import { startIntro, startOutro, skipCutscene, stopCutscene } from "./cutscenes.js";
import { playLevelComplete } from "./sound.js";
import { startTutorial } from "./tutorial.js";
import { recordFinish, showLeaderboard } from "./leaderboard.js";

// Game states (§10)
export const STATES = {
    TITLE: "title",
    INTRO: "intro",
    LEVEL_INTRO: "levelIntro",
    AIMING: "aiming",
    FLYING: "flying",
    SLIDING: "sliding",
    LEVEL_COMPLETE: "levelComplete",
    OUTRO: "outro",
    PAUSED: "paused",
    LEVEL_SELECT: "levelSelect",
};

// Which states each state may move to. levelIntro is also how a level
// (re)starts, so playing states can go back to it for Restart.
const TRANSITIONS = {
    title: ["intro", "levelIntro", "levelSelect"],
    intro: ["levelIntro"],
    levelIntro: ["aiming", "paused", "levelIntro"],
    aiming: ["flying", "paused", "levelIntro"],
    flying: ["sliding", "aiming", "paused", "levelIntro"],
    sliding: ["aiming", "flying", "levelComplete", "paused", "levelIntro"],
    levelComplete: ["levelIntro", "outro", "levelSelect"],
    outro: ["title", "levelSelect"],
    paused: ["levelIntro", "aiming", "flying", "sliding", "levelSelect"],
    levelSelect: ["levelIntro", "title", "paused"],
};

const PLAYING = ["aiming", "flying", "sliding"];
const LEVEL_INTRO_TIME = 3; // seconds the level banner shows while the camera sweeps (Space/click skips)
// Extra seconds after Froggy's victory (backflip, turn and wave) on the
// lily pad before the stars screen
const STARS_EXTRA_DELAY = 0.2;

export const game = {
    state: STATES.TITLE,
    levelIndex: 0,
    pausedFrom: null, // state to resume after pausing
    levelSelectFrom: null, // where Back returns to from level select
    stateTime: 0, // seconds in the current state
    starsDelay: 0,
};

const banner = document.querySelector(".level-banner");
const completeScreen = document.querySelector(".level-complete");
const pauseScreen = document.querySelector(".pause");
const outroScreen = document.querySelector(".outro");

let scene = null;
let camera = null;

export function isPlaying() {
    return PLAYING.includes(game.state);
}

// How far through the level intro (0–1), or null outside it; drives the
// camera's sweep from Froggy's face to behind him
export function getIntroProgress() {
    return game.state === "levelIntro" ? Math.min(1, game.stateTime / LEVEL_INTRO_TIME) : null;
}

export function isCutscene() {
    return game.state === "intro" || game.state === "outro";
}

export function setState(next) {
    const previous = game.state;
    if (!TRANSITIONS[previous].includes(next)) {
        console.warn(`Ignored state change ${previous} → ${next}`);
        return false;
    }
    game.state = next;
    game.stateTime = 0;
    document.body.dataset.state = next; // lets CSS hide the HUD in menus/cutscenes
    onExit(previous, next);
    onEnter(next, previous);
    return true;
}

function onExit(state, next) {
    if (state === "title") showTitle(false);
    if (state === "levelSelect") showLevelSelect(false);
    if (state === "levelIntro") banner.hidden = true;
    if (state === "paused") {
        pauseScreen.hidden = true;
        // The clock stays stopped once Froggy has landed on the lily pad
        if (PLAYING.includes(next) && !hop.completeOnStop) startTimer();
    }
    if (state === "levelComplete") completeScreen.hidden = true;
    if (state === "outro") {
        outroScreen.hidden = true;
        stopCutscene();
    }
}

function onEnter(state, previous) {
    if (state === "title") showTitle(true);
    if (state === "levelSelect") {
        game.levelSelectFrom = previous;
        showLevelSelect(true);
    }
    if (state === "levelIntro") showBanner();
    if (state === "aiming" && previous === "levelIntro") startTimer();
    if (state === "paused") {
        stopTimer();
        cancelAim();
        pauseScreen.hidden = false;
    }
    if (state === "levelComplete") finishLevel();
    // A key press belongs to the state it was made in
    actionInput.requested = false;
    powerupInput.requested = false;
}

// --- Levels ---

// Boot: show the title screen over level 1 as a backdrop
export function initGameState(activeScene, activeCamera) {
    scene = activeScene;
    camera = activeCamera;
    initMenus({
        onPlay: play,
        onLevelSelect: () => setState("levelSelect"),
        onPickLevel: startLevel,
        onBack: () => setState(game.levelSelectFrom === "paused" ? "paused" : "title"),
    });
    prepareLevel(0);
    document.body.dataset.state = game.state;
    showTitle(true);
}

// Build (or rebuild) a level with Froggy at its start. Rebuilding also
// respawns the flies.
function prepareLevel(index) {
    stopCutscene();
    game.levelIndex = index;
    buildLevel(LEVELS[index], scene);
    cancelAim();
    placeAtStart();
    startHud(index + 1, LEVELS[index]);
    snapCamera(camera);
    startTutorial(index);
}

// (Re)start a level from its intro banner
export function startLevel(index) {
    prepareLevel(index);
    setState("levelIntro");
}

// Play continues from the first level not yet completed; the story intro
// plays before level 1
function play() {
    const index = firstUnfinishedLevel(LEVELS.length);
    if (index !== 0) {
        startLevel(index);
        return;
    }
    prepareLevel(0);
    setState("intro");
    startIntro(() => startLevel(0));
}

// Called by the physics once Froggy has stopped on the lily pad
export function completeLevel() {
    setState("levelComplete");
}

function nextLevel() {
    if (game.levelIndex + 1 < LEVELS.length) {
        startLevel(game.levelIndex + 1);
        return;
    }
    setState("outro");
    startOutro(scene, () => {
        const name = getPlayerName();
        outroScreen.querySelector("h1").textContent = name ? `${name} got Froggy home!` : "Froggy made it home!";
        outroScreen.querySelector(".outro-total").textContent =
            `Total ★ ${totalStars(LEVELS.length)} / ${LEVELS.length * 3}`;
        outroScreen.hidden = false;
    });
}

function pause() {
    game.pausedFrom = game.state;
    setState("paused");
}

function resume() {
    setState(game.pausedFrom);
}

// --- Screens ---

function showBanner() {
    const data = level.data;
    banner.querySelector(".banner-title").textContent = `Level ${game.levelIndex + 1} – ${data.name}`;
    banner.querySelector(".banner-info").textContent =
        `Par ${data.par} · Target time ${formatTime(data.timeTarget)}`;
    banner.hidden = false;
}

// Stars (§5): finishing, at or under par (penalties count), under the time
// target. Saved as the level's best; a hole in one or finishing under par
// also gets confetti. Froggy does his victory backflip and wave first,
// then the stars screen follows.
function finishLevel() {
    stopTimer();
    const strokes = getStrokes();
    const time = getElapsedTime();
    const { par, timeTarget } = level.data;
    const earned = [true, strokes <= par, time < timeTarget];
    const earnedCount = earned.filter(Boolean).length;
    recordStars(game.levelIndex, earnedCount);
    recordFinish(getPlayerName(), game.levelIndex, strokes, par, time);

    playLevelComplete();
    startVictory();
    game.starsDelay = VICTORY_TIME + STARS_EXTRA_DELAY;
    const holeInOne = strokes === 1;
    if (holeInOne || strokes < par) {
        confetti.play(player.position.x, player.position.y, player.position.z);
        showMessage(holeInOne ? "Hole in one!" : "Under par!");
    }

    // The big stars fill from the left, whichever ones were earned
    completeScreen.querySelectorAll(".star").forEach((star, i) => {
        star.classList.toggle("earned", i < earnedCount);
    });
    const reasons = completeScreen.querySelectorAll(".star-reasons li");
    reasons[0].textContent = "Finished the level";
    reasons[1].textContent = `${strokes} / ${par} strokes`;
    reasons[2].textContent = `Time ${formatTime(time)} / ${formatTime(timeTarget)}`;
    reasons.forEach((reason, i) => reason.classList.toggle("earned", earned[i]));

    const name = getPlayerName();
    completeScreen.querySelector("h1").textContent = name ? `Well done, ${name}!` : "Level complete!";

    const isLast = game.levelIndex + 1 >= LEVELS.length;
    completeScreen.querySelector(".next").textContent = isLast ? "Finish" : "Next Level";
}

completeScreen.querySelector(".retry").addEventListener("click", () => startLevel(game.levelIndex));
completeScreen.querySelector(".next").addEventListener("click", nextLevel);
pauseScreen.querySelector(".resume").addEventListener("click", resume);
pauseScreen.querySelector(".restart").addEventListener("click", () => startLevel(game.levelIndex));
pauseScreen.querySelector(".open-level-select").addEventListener("click", () => setState("levelSelect"));
outroScreen.querySelector(".play-again").addEventListener("click", () => {
    setState("title");
    prepareLevel(0);
});
outroScreen.querySelector(".open-level-select").addEventListener("click", () => setState("levelSelect"));
outroScreen.querySelector(".open-leaderboard").addEventListener("click", () => showLeaderboard(outroScreen));
document.querySelector(".pause-button").addEventListener("click", () => {
    if (isPlaying()) pause();
});
banner.addEventListener("click", () => {
    if (game.state === "levelIntro") setState("aiming");
});

// --- Per frame ---

export function updateGameState(delta) {
    game.stateTime += delta;

    if (pauseInput.requested) {
        pauseInput.requested = false;
        if (isPlaying()) pause();
        else if (game.state === "paused") resume();
    }

    if (game.state === "levelIntro" && (game.stateTime > LEVEL_INTRO_TIME || actionInput.requested)) {
        setState("aiming");
    }

    if (game.state === "levelComplete" && completeScreen.hidden && game.stateTime > game.starsDelay) {
        completeScreen.hidden = false;
    }

    // Space skips cutscenes
    if (isCutscene() && actionInput.requested) skipCutscene();

    // Outside play, Space and E have no other use
    if (!isPlaying()) {
        actionInput.requested = false;
        powerupInput.requested = false;
    }
}
