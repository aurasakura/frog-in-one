import * as THREE from "three";
import { player, model } from "./components/Player.js";
import { Wife } from "./components/Wife.js";
import { setFrogExpression } from "./components/FrogModel.js";
import { CELL_SIZE } from "./components/Terrace.js";
import { level, surfaceAt } from "./levels/levelBuilder.js";
import { playChirp, playLand, playLaunch } from "./sound.js";

// Intro and outro cutscenes (§1). Both are skippable (click or Space).
// While one runs it drives the camera; when it finishes it calls `onDone`
// once and keeps gently animating until stopCutscene().

const INTRO_DURATION = 10; // seconds
const INTRO_LINES = [
    { from: 0.3, to: 3.4, text: "Froggy is a long way from home…" },
    { from: 3.6, to: 6.7, text: "…and his wife is waiting by the garden pond with dinner." },
    { from: 6.9, to: 9.9, text: "Hop him home in as few strokes as you can!" },
];

const OUTRO_ORBIT_RADIUS = 170;
const OUTRO_ORBIT_HEIGHT = 85;
const OUTRO_ORBIT_SPEED = 0.12; // radians per second
const OUTRO_HOP_START = 1.5; // Froggy hops onto the lily pad
const OUTRO_HOP_TIME = 0.9;
const OUTRO_HAPPY_START = 3.0; // happy hops together
const OUTRO_HAPPY_HOPS = 3;
const OUTRO_HAPPY_HOP_TIME = 0.55;
const OUTRO_HAPPY_HEIGHT = 18;
const OUTRO_DURATION = 5.2; // then the total stars show
const PAD_SPACING = 10; // the two frogs sit this far either side of the pad's centre
const OUTRO_SMILE_TIME = 0.3; // both grow into a grin once Froggy lands beside her
// Love hearts floating up around the two of them once they're together
const HEART_INTERVAL = 0.22; // seconds between new hearts
const HEART_LIFE = 2.2; // seconds a heart rises and fades
const HEART_RISE = 45; // world units risen over its life
const HEART_SPREAD = 26; // how far from the pad's centre hearts appear
const HEART_SIZE = [6, 11]; // world units (random in range)
const HEART_COLORS = ["#FF4D6D", "#FF6F91", "#FF8FB1", "#E53935"];
const OUTRO_LINES = [
    { from: 0.3, to: 2.9, text: "Home at last!" },
    { from: 3.1, to: OUTRO_DURATION, text: "Just in time for dinner." },
];

const textBox = document.querySelector(".cutscene-text");
const cutsceneLayer = document.querySelector(".cutscene");

let active = null; // the running cutscene, or null

const lookTarget = new THREE.Vector3();
const bounds = new THREE.Box3();
const boundsCenter = new THREE.Vector3();

// How far an object's visible middle sits from `anchor` (x, y only): the
// frog model isn't centred on its origin, so this centres them on the pad
function visualOffset(object, anchor) {
    bounds.setFromObject(object).getCenter(boundsCenter);
    return new THREE.Vector2(boundsCenter.x - anchor.x, boundsCenter.y - anchor.y);
}

function smoothstep(t) {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
}

// Face the model towards (x, y); it starts facing -y
function faceModel(target, x, y) {
    if (target) target.rotation.y = Math.atan2(x, -y);
}

function showLine(lines, time) {
    const line = lines.find((l) => time >= l.from && time < l.to);
    textBox.textContent = line ? line.text : "";
    textBox.classList.toggle("visible", Boolean(line));
}

function begin(cutscene) {
    active = cutscene;
    cutsceneLayer.hidden = false;
    textBox.textContent = "";
    textBox.classList.remove("visible");
}

function finish() {
    if (!active || active.finished) return;
    active.finished = true;
    cutsceneLayer.hidden = true;
    textBox.classList.remove("visible");
    active.onDone();
}

// A heart shape drawn on a canvas, as a sprite material in `color`
const heartMaterials = new Map();
function heartMaterial(color) {
    if (!heartMaterials.has(color)) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 64;
        const ctx = canvas.getContext("2d");
        ctx.beginPath();
        ctx.moveTo(32, 56);
        ctx.bezierCurveTo(4, 36, 4, 10, 20, 10);
        ctx.bezierCurveTo(28, 10, 32, 16, 32, 22);
        ctx.bezierCurveTo(32, 16, 36, 10, 44, 10);
        ctx.bezierCurveTo(60, 10, 60, 36, 32, 56);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.stroke();
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        heartMaterials.set(color, new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    }
    return heartMaterials.get(color);
}

// --- Intro: a slow camera sweep over the route of the current level ---

export function startIntro(onDone) {
    const pad = new THREE.Vector3(level.lilyPad.col * CELL_SIZE, level.lilyPad.row * CELL_SIZE, level.lilyPad.z);
    const start = level.start.clone();
    const middle = pad.clone().add(start).multiplyScalar(0.5);
    const side = Math.max(250, pad.distanceTo(start) * 0.4);

    // Over the lily pad → high along the side of the route → behind Froggy,
    // ending where the chase camera will be, so play starts seamlessly
    const positions = new THREE.CatmullRomCurve3([
        pad.clone().add(new THREE.Vector3(0, 220, 240)),
        middle.clone().add(new THREE.Vector3(-side, 0, 380)),
        start.clone().add(new THREE.Vector3(0, -150, 90)),
    ]);
    const looks = new THREE.CatmullRomCurve3([
        pad.clone(),
        middle.clone(),
        start.clone().add(new THREE.Vector3(0, 100, 0)),
    ]);

    begin({
        time: 0,
        finished: false,
        onDone,
        update(delta, camera) {
            this.time = Math.min(this.time + delta, INTRO_DURATION);
            const t = smoothstep(this.time / INTRO_DURATION);
            camera.position.copy(positions.getPoint(t));
            camera.lookAt(looks.getPoint(t, lookTarget));
            showLine(INTRO_LINES, this.time);
            if (this.time >= INTRO_DURATION) finish();
        },
        skip() {
            this.time = INTRO_DURATION;
        },
    });
}

// --- Outro: Froggy joins his wife on the lily pad in his garden pond ---

export function startOutro(scene, onDone) {
    const pad = new THREE.Vector3(level.lilyPad.col * CELL_SIZE, level.lilyPad.row * CELL_SIZE, level.lilyPad.z);
    // Froggy starts on the bank, two tiles south of the pad
    const froggyStart = pad.clone().add(new THREE.Vector3(0, -2 * CELL_SIZE, 0));
    froggyStart.z = surfaceAt(froggyStart.x, froggyStart.y)?.z ?? pad.z;
    const froggyEnd = pad.clone().add(new THREE.Vector3(-PAD_SPACING, 0, 0));
    player.position.copy(froggyStart);
    player.visible = true;

    // Centre Froggy (as he'll stand, facing his wife) on his spot on the pad
    if (model) {
        faceModel(model, 1, 0);
        player.updateMatrixWorld(true);
        const offset = visualOffset(model, player.position);
        froggyEnd.x -= offset.x;
        froggyEnd.y -= offset.y;
    }

    const wife = Wife();
    const wifeSpot = new THREE.Vector3(pad.x + PAD_SPACING, pad.y, pad.z);
    wife.position.copy(wifeSpot);
    wife.rotation.z = Math.atan2(-1, 0); // face west, towards where Froggy lands
    scene.add(wife);
    let wifeCentred = false;

    let chirped = 0;
    const hearts = [];
    let heartTimer = 0;
    const together = OUTRO_HOP_START + OUTRO_HOP_TIME; // Froggy lands beside her

    begin({
        time: 0,
        finished: false,
        onDone,
        wife,
        scene,
        update(delta, camera) {
            this.time += delta;
            const time = this.time;

            // Camera: slow orbit around the pond
            const angle = -Math.PI / 2 + time * OUTRO_ORBIT_SPEED;
            camera.position.set(
                pad.x + Math.cos(angle) * OUTRO_ORBIT_RADIUS,
                pad.y + Math.sin(angle) * OUTRO_ORBIT_RADIUS,
                pad.z + OUTRO_ORBIT_HEIGHT
            );
            camera.lookAt(pad.x, pad.y, pad.z + 10);

            // Froggy hops onto the pad
            const hop = (time - OUTRO_HOP_START) / OUTRO_HOP_TIME;
            if (hop < 0) {
                faceModel(model, 0, 1);
            } else if (hop <= 1) {
                if (!this.launched) {
                    this.launched = true;
                    playLaunch();
                }
                player.position.lerpVectors(froggyStart, froggyEnd, hop);
                player.position.z += Math.sin(hop * Math.PI) * 45;
                faceModel(model, froggyEnd.x - froggyStart.x, froggyEnd.y - froggyStart.y);
            } else {
                if (!this.landed) {
                    this.landed = true;
                    playLand();
                }
                player.position.copy(froggyEnd);
                faceModel(model, 1, 0); // turn to his wife
            }

            // Happy hops together
            const happy = (time - OUTRO_HAPPY_START) / OUTRO_HAPPY_HOP_TIME;
            let lift = 0;
            if (happy >= 0 && happy < OUTRO_HAPPY_HOPS) {
                lift = Math.abs(Math.sin(happy * Math.PI)) * OUTRO_HAPPY_HEIGHT;
                if (Math.floor(happy) >= chirped) {
                    chirped++;
                    playChirp();
                }
            }
            if (time > OUTRO_HOP_START + OUTRO_HOP_TIME) player.position.z = froggyEnd.z + lift;
            // Her model loads in the background: centre it on her spot once it's there
            if (!wifeCentred && wife.children.length > 0) {
                wifeCentred = true;
                wife.updateMatrixWorld(true);
                const offset = visualOffset(wife, wifeSpot);
                wife.position.x = wifeSpot.x - offset.x;
                wife.position.y = wifeSpot.y - offset.y;
            }
            wife.position.z = pad.z + lift;

            // Both grin together once he's beside her (his arm stays down)
            const smile = smoothstep((time - together) / OUTRO_SMILE_TIME);
            if (model) setFrogExpression(model, smile, 0, time);
            setFrogExpression(wife.userData.model, smile, 0, time);

            // Love hearts float up around them, swaying and fading
            if (time > together) {
                heartTimer -= delta;
                if (heartTimer <= 0) {
                    heartTimer = HEART_INTERVAL;
                    const color = HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)];
                    const heart = new THREE.Sprite(heartMaterial(color).clone());
                    const angle = Math.random() * Math.PI * 2;
                    const distance = HEART_SPREAD * (0.4 + Math.random() * 0.6);
                    heart.userData = {
                        age: 0,
                        size: HEART_SIZE[0] + Math.random() * (HEART_SIZE[1] - HEART_SIZE[0]),
                        x: pad.x + Math.cos(angle) * distance,
                        y: pad.y + Math.sin(angle) * distance,
                        z: pad.z + 8 + Math.random() * 10,
                        phase: Math.random() * Math.PI * 2,
                    };
                    scene.add(heart);
                    hearts.push(heart);
                }
            }
            for (let i = hearts.length - 1; i >= 0; i--) {
                const heart = hearts[i];
                const state = heart.userData;
                state.age += delta;
                const t = state.age / HEART_LIFE;
                if (t >= 1) {
                    scene.remove(heart);
                    heart.material.dispose();
                    hearts.splice(i, 1);
                    continue;
                }
                const sway = Math.sin(state.age * 3 + state.phase) * 3;
                heart.position.set(state.x + sway, state.y, state.z + t * HEART_RISE);
                heart.scale.setScalar(state.size * Math.min(1, t * 5)); // pop in
                heart.material.opacity = t < 0.7 ? 1 : (1 - t) / 0.3;
            }

            showLine(OUTRO_LINES, time);
            if (time >= OUTRO_DURATION) finish();
        },
        skip() {
            this.time = Math.max(this.time, OUTRO_DURATION);
        },
        cleanUp() {
            scene.remove(wife);
            for (const heart of hearts) {
                scene.remove(heart);
                heart.material.dispose();
            }
        },
    });
}

// --- Control ---

export function isCutsceneRunning() {
    return active !== null;
}

// Drive the camera (and the cutscene's own animation)
export function updateCutscene(delta, camera) {
    active?.update(delta, camera);
}

// Jump to the end (click or Space)
export function skipCutscene() {
    if (active && !active.finished) active.skip();
}

// Stop entirely, e.g. when leaving the outro or starting a level
export function stopCutscene() {
    if (!active) return;
    active.cleanUp?.();
    cutsceneLayer.hidden = true;
    textBox.classList.remove("visible");
    active = null;
}

cutsceneLayer.addEventListener("click", skipCutscene);
