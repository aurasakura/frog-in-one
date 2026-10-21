// Saved progress (§11): the player's name, best stars per level, the mute
// setting, which first-touch tips have been shown and whether the controls
// walkthrough is done. Stored in localStorage; every read and write is
// wrapped in try/catch, so with storage unavailable (private mode, blocked)
// the game still works and simply doesn't remember anything.

const STORAGE_KEY = "froggy-golf-progress";
export const MAX_NAME_LENGTH = 16;

const progress = load();

function load() {
    const fresh = { playerName: "", best: [], muted: false, tipsSeen: [], tutorialDone: false };
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!saved || typeof saved !== "object") return fresh;
        return {
            playerName: typeof saved.playerName === "string" ? saved.playerName.slice(0, MAX_NAME_LENGTH) : "",
            best: Array.isArray(saved.best)
                ? saved.best.map((stars) => Math.max(0, Math.min(3, Math.floor(Number(stars) || 0))))
                : [],
            muted: saved.muted === true,
            tipsSeen: Array.isArray(saved.tipsSeen) ? saved.tipsSeen.filter((id) => typeof id === "string") : [],
            tutorialDone: saved.tutorialDone === true,
        };
    } catch {
        return fresh;
    }
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
        // Storage unavailable: progress lasts for this visit only
    }
}

export function getPlayerName() {
    return progress.playerName;
}

export function setPlayerName(name) {
    progress.playerName = name.trim().slice(0, MAX_NAME_LENGTH);
    save();
}

export function getBestStars(levelIndex) {
    return progress.best[levelIndex] ?? 0;
}

// Level 1 is always open; each later level opens once the one before it
// has been completed (any stars)
export function isUnlocked(levelIndex) {
    return levelIndex === 0 || getBestStars(levelIndex - 1) > 0;
}

export function recordStars(levelIndex, stars) {
    if (stars <= getBestStars(levelIndex)) return;
    progress.best[levelIndex] = stars;
    save();
}

export function totalStars(levelCount) {
    let total = 0;
    for (let i = 0; i < levelCount; i++) total += getBestStars(i);
    return total;
}

// Where Play continues: the first level not yet completed (or level 1)
export function firstUnfinishedLevel(levelCount) {
    for (let i = 0; i < levelCount; i++) {
        if (getBestStars(i) === 0) return i;
    }
    return 0;
}

export function isMuted() {
    return progress.muted;
}

export function setMuted(muted) {
    progress.muted = muted;
    save();
}

export function hasSeenTip(id) {
    return progress.tipsSeen.includes(id);
}

export function markTipSeen(id) {
    if (hasSeenTip(id)) return;
    progress.tipsSeen.push(id);
    save();
}

export function isTutorialDone() {
    return progress.tutorialDone;
}

export function markTutorialDone() {
    progress.tutorialDone = true;
    save();
}
