import { LEVELS } from "./levels/index.js";
import { getBestStars, isUnlocked, totalStars, getPlayerName, setPlayerName } from "./progress.js";
import { TIPS } from "./tips.js";
import { signIconCanvas } from "./components/Props.js";
import { showLeaderboard } from "./leaderboard.js";

// Title screen, the tutorial (How to Play) and level select (§11). This
// module only draws the screens and reports button presses; gameState.js
// decides what they do.

const titleScreen = document.querySelector(".title-screen");
const nameForm = titleScreen.querySelector(".name-form");
const nameInput = titleScreen.querySelector(".name-input");
const playButton = titleScreen.querySelector(".play");
const howToPlayScreen = document.querySelector(".how-to-play");
const levelSelectScreen = document.querySelector(".level-select");
const levelList = levelSelectScreen.querySelector(".level-list");
const totalElement = levelSelectScreen.querySelector(".level-total");

const handlers = {};

export function initMenus({ onPlay, onLevelSelect, onPickLevel, onBack }) {
    Object.assign(handlers, { onPlay, onLevelSelect, onPickLevel, onBack });
}

// The player's name: remembered, and needed before Start
nameInput.value = getPlayerName();
function updatePlayButton() {
    const named = nameInput.value.trim() !== "";
    playButton.disabled = !named;
    nameForm.classList.toggle("named", named);
}
updatePlayButton();
nameInput.addEventListener("input", updatePlayButton);
nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!nameInput.value.trim()) {
        nameInput.focus();
        return;
    }
    setPlayerName(nameInput.value);
    nameInput.blur();
    handlers.onPlay();
});

titleScreen.querySelector(".open-how-to-play").addEventListener("click", () => showHowToPlay(true));
titleScreen.querySelector(".open-leaderboard").addEventListener("click", () => showLeaderboard(titleScreen));
howToPlayScreen.querySelector(".close-how-to-play").addEventListener("click", () => showHowToPlay(false));
window.addEventListener("keydown", (event) => {
    if (event.code === "Escape" && !howToPlayScreen.hidden) showHowToPlay(false);
});
titleScreen.querySelector(".open-level-select").addEventListener("click", () => handlers.onLevelSelect());
levelSelectScreen.querySelector(".back").addEventListener("click", () => handlers.onBack());

export function showTitle(visible) {
    titleScreen.hidden = !visible;
    if (!visible) howToPlayScreen.hidden = true;
}

// --- Tutorial: every mechanic with its sign drawing and tip text ---

const HOW_TO_PLAY = [
    {
        heading: "Playing",
        cards: [
            { icon: "hop", title: "Hop", text: "Press on Froggy, drag back to aim and let go to hop. Drag further for a bigger jump." },
            { icon: "goal", title: "Goal", text: "Land on the lily pad by the red flag in as few hops as you can." },
            { icon: "water", title: "Water", text: TIPS.water[1] },
        ],
    },
    {
        heading: "Ground",
        cards: ["grass", "mud", "flowerBed", "wetPavement", "slime", "puddle"].map((id) => ({ icon: id, id })),
    },
    {
        heading: "Obstacles",
        cards: [
            { icon: "sprinkler", id: "sprinkler" },
            { icon: "hose", id: "hoseJet" },
            { icon: "laundry", id: "washingLine" },
        ],
    },
    {
        heading: "Powerup flies",
        cards: ["doubleHop", "glide", "superLeap"].map((id) => ({ icon: id, id })),
    },
];

let howToPlayBuilt = false;

function buildHowToPlay() {
    howToPlayBuilt = true;
    howToPlayScreen.querySelector(".how-to-sections").replaceChildren(
        ...HOW_TO_PLAY.map(({ heading, cards }) => {
            const section = document.createElement("section");
            section.className = "how-to-section";
            const title = document.createElement("h2");
            title.textContent = heading;
            const grid = document.createElement("div");
            grid.className = "how-to-cards";
            grid.append(
                ...cards.map(({ icon, id, title: cardTitle, text }) => {
                    const card = document.createElement("div");
                    card.className = "how-to-card";
                    const drawing = signIconCanvas(icon, 160);
                    drawing.className = "how-to-icon";
                    const name = document.createElement("h3");
                    name.textContent = cardTitle ?? TIPS[id][0];
                    const description = document.createElement("p");
                    description.textContent = text ?? TIPS[id][1];
                    card.append(drawing, name, description);
                    return card;
                })
            );
            section.append(title, grid);
            return section;
        })
    );
}

function showHowToPlay(visible) {
    if (visible && !howToPlayBuilt) buildHowToPlay();
    howToPlayScreen.hidden = !visible;
    titleScreen.hidden = visible;
    if (visible) howToPlayScreen.scrollTop = 0;
}

function starRow(count) {
    return "★★★".slice(0, count) + "☆☆☆".slice(count);
}

// Rebuild the level cards from saved progress each time it opens
export function showLevelSelect(visible) {
    levelSelectScreen.hidden = !visible;
    if (!visible) return;

    levelList.replaceChildren(
        ...LEVELS.map((data, index) => {
            const unlocked = isUnlocked(index);
            const best = getBestStars(index);

            const card = document.createElement("button");
            card.className = "level-card";
            card.disabled = !unlocked;
            card.innerHTML = `
                <span class="level-number">${index + 1}</span>
                <span class="level-name"></span>
                <span class="level-stars" aria-label="${best} of 3 stars">${starRow(best)}</span>
                <span class="level-note"></span>`;
            card.querySelector(".level-name").textContent = data.name;
            card.querySelector(".level-note").textContent = unlocked
                ? `Par ${data.par}`
                : `🔒 Finish level ${index} to unlock`;
            card.addEventListener("click", () => handlers.onPickLevel(index));
            return card;
        })
    );
    totalElement.textContent = `Total ★ ${totalStars(LEVELS.length)} / ${LEVELS.length * 3}`;
}
