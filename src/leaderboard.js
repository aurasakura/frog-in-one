import { LEVELS } from "./levels/index.js";
import { formatTime } from "./hud.js";
import { getPlayerName } from "./progress.js";

// Leaderboard: every player's best finish on each level (fewest strokes,
// then fastest time), and an overall table adding those up. Shared through
// the /api/leaderboard Netlify Function (netlify/functions/leaderboard.mjs).
// Finishes are also kept in localStorage, so when the API can't be reached
// (e.g. under plain `vite dev`) the board still shows this device's players.

const API = "/api/leaderboard";
const STORAGE_KEY = "froggy-golf-leaderboard";

// { [playerName]: { [levelIndex]: { strokes, par, time } } }
const localRecords = loadLocal();

function loadLocal() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return saved && typeof saved === "object" ? saved : {};
    } catch {
        return {};
    }
}

function saveLocal() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localRecords));
    } catch {
        // Storage unavailable: kept for this visit only
    }
}

const isBetter = (a, b) => !b || a.strokes < b.strokes || (a.strokes === b.strokes && a.time < b.time);

// Record a finished level (kept if it's the player's best on it)
export function recordFinish(name, levelIndex, strokes, par, time) {
    if (!name) return;
    const player = (localRecords[name] ??= {});
    const result = { strokes, par, time: Math.round(time * 10) / 10 };
    if (isBetter(result, player[levelIndex])) {
        player[levelIndex] = result;
        saveLocal();
    }
    fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, level: levelIndex, strokes, time }),
    }).catch(() => {}); // offline: the local copy still has it
}

// The shared records, or null if the API can't be reached
async function fetchRecords() {
    try {
        const response = await fetch(API, { cache: "no-store" });
        if (!response.ok) return null;
        const { players } = await response.json();
        return players && typeof players === "object" ? players : null;
    } catch {
        return null;
    }
}

// "6 (−1)": strokes, and how far over or under par ("E" for even)
function strokesText(strokes, par) {
    const diff = strokes - par;
    const relative = diff === 0 ? "E" : diff > 0 ? `+${diff}` : `−${-diff}`;
    return `${strokes} (${relative})`;
}

// Table rows for one level, or (levelIndex "all") the totals of players who
// have finished every level: fewest strokes against par, then fastest
function rows(records, levelIndex) {
    if (levelIndex !== "all") {
        return Object.entries(records)
            .filter(([, levels]) => levels[levelIndex])
            .map(([name, levels]) => ({ name, ...levels[levelIndex] }))
            .sort((a, b) => a.strokes - b.strokes || a.time - b.time)
            .map((r) => ({ name: r.name, cells: [strokesText(r.strokes, r.par), formatTime(r.time)] }));
    }
    return Object.entries(records)
        .map(([name, levels]) => {
            const done = Object.values(levels);
            return {
                name,
                finished: done.length,
                strokes: done.reduce((sum, r) => sum + r.strokes, 0),
                par: done.reduce((sum, r) => sum + r.par, 0),
                time: done.reduce((sum, r) => sum + r.time, 0),
            };
        })
        .filter((r) => r.finished === LEVELS.length)
        .sort((a, b) => a.strokes - a.par - (b.strokes - b.par) || a.time - b.time)
        .map((r) => ({ name: r.name, cells: [strokesText(r.strokes, r.par), formatTime(r.time)] }));
}

// --- Screen ---

const screen = document.querySelector(".leaderboard");
const tabs = screen.querySelector(".leaderboard-tabs");
const table = screen.querySelector(".leaderboard-table");
const status = screen.querySelector(".leaderboard-status");
const TABS = [{ id: "all", label: "Overall" }, ...LEVELS.map((data, i) => ({ id: i, label: `Level ${i + 1}` }))];

let selected = "all";
let records = null; // what's showing: shared records, or the local ones
let shared = false;
let returnTo = null; // the screen it was opened from, shown again on Back

function render() {
    tabs.replaceChildren(
        ...TABS.map(({ id, label }) => {
            const tab = document.createElement("button");
            tab.className = "leaderboard-tab";
            tab.textContent = label;
            tab.classList.toggle("selected", id === selected);
            tab.addEventListener("click", () => {
                selected = id;
                render();
            });
            return tab;
        })
    );

    if (!records) {
        status.textContent = "Loading…";
        table.hidden = true;
        return;
    }
    const list = rows(records, selected);
    table.hidden = list.length === 0;
    if (list.length === 0) {
        status.textContent =
            selected === "all"
                ? `Nobody has finished all ${LEVELS.length} levels yet. Be the first!`
                : `Nobody has finished level ${selected + 1} yet.`;
    } else {
        status.textContent = shared ? "" : "Couldn't reach the online leaderboard: showing players on this device.";
    }

    const headings = selected === "all" ? ["Total strokes (par)", "Total time"] : ["Strokes (par)", "Time"];
    const head = document.createElement("tr");
    for (const text of ["#", "Player", ...headings]) {
        const th = document.createElement("th");
        th.textContent = text;
        head.append(th);
    }
    const me = getPlayerName();
    table.replaceChildren(
        head,
        ...list.map((row, i) => {
            const tr = document.createElement("tr");
            tr.classList.toggle("me", row.name === me);
            for (const text of [i + 1, row.name, ...row.cells]) {
                const td = document.createElement("td");
                td.textContent = text;
                tr.append(td);
            }
            return tr;
        })
    );
}

// Open in place of `from`, the screen to go back to
export async function showLeaderboard(from) {
    returnTo = from;
    from.hidden = true;
    screen.hidden = false;
    screen.scrollTop = 0;
    records = null;
    render();
    const fetched = await fetchRecords();
    shared = fetched !== null;
    records = fetched ?? localRecords;
    if (!screen.hidden) render();
}

export function hideLeaderboard() {
    if (screen.hidden) return;
    screen.hidden = true;
    if (returnTo) returnTo.hidden = false;
    returnTo = null;
}

screen.querySelector(".close-leaderboard").addEventListener("click", hideLeaderboard);
window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") hideLeaderboard();
});
