import * as THREE from "three";
import { FrogModel, FROGGY_COLORS, setFrogExpression, updateFrogBlink } from "./FrogModel.js";
import { LilyPad, LILY_PAD_HEIGHT } from "./LilyPad.js";
import { playLaunch, playLand } from "../sound.js";
import { screenWidth, screenHeight } from "../screenSize.js";

// The title screen's own little scene: Froggy on a lily pad in a pond,
// bobbing on the water and every so often waving, grinning or doing a
// little hop. Click him and he does a backflip. The camera frames him on
// the right of the screen (the menu is on the left), or near the top on a
// tall, narrow screen.

const FOV = 38; // degrees
const CAMERA_DISTANCE = 95;
const CAMERA_HEIGHT = 26;
const LOOK_HEIGHT = 10;
const FROG_SHARE_X = 0.36 - 1 / 6; // Froggy's offset from the middle, as a share of the half-width (1/6 of it = 1/12 of the screen)
const FROG_SHARE_Y = 0.38; // ...or, on a narrow screen, of the half-height (upwards)
const NARROW_ASPECT = 0.9; // narrower than this: Froggy above the menu

const BOB_SPEED = 2.2; // Froggy's own gentle bounce on the pad
const BOB_HEIGHT = 1.2;
const BOB_SQUASH = 0.04;
const FROG_TURN = -0.35; // radians: turned a little towards the menu

// Every few seconds Froggy does something: wave, grin, both, or a hop
const ACTION_GAP = [2.5, 5.5]; // seconds between actions (random in range)
const ACTIONS = [
    { name: "wave", duration: 2.4, weight: 3 },
    { name: "smile", duration: 1.8, weight: 2 },
    { name: "waveSmile", duration: 2.6, weight: 2 },
    { name: "hop", duration: 0.7, weight: 1 },
];
const HOP_HEIGHT = 14;
// Clicked: he springs up, backflips (turning around his middle) with a grin
// and lands back on the pad
const FLIP = { name: "flip", duration: 1 };
const FLIP_HEIGHT = 26;
const FLIP_MIDDLE = 6.5; // height of his middle above his feet, which the flip turns around

const RIPPLE_COUNT = 3;
const RIPPLE_TIME = 3; // seconds for a ripple to spread and fade
const RIPPLE_SIZE = 26; // how much a ripple's radius grows

const random = (min, max) => min + Math.random() * (max - min);

function pickAction() {
    const total = ACTIONS.reduce((sum, a) => sum + a.weight, 0);
    let roll = Math.random() * total;
    for (const action of ACTIONS) {
        roll -= action.weight;
        if (roll <= 0) return action;
    }
    return ACTIONS[0];
}

const smoothstep = (t) => {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
};

// 0 → 1 → 0 over an action, easing in and out at the ends
function envelope(t, edge = 0.2) {
    if (t <= 0 || t >= 1) return 0;
    return Math.min(1, t / edge, (1 - t) / edge);
}

// Sky: light blue at the top fading to a pale haze at the horizon
function skyTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#5DB7EC");
    gradient.addColorStop(0.65, "#A9DDF5");
    gradient.addColorStop(1, "#E3F4E8");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

// A small floating pad (no flag), for decoration
function smallPad(radius, x, y, angle) {
    const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 1, 24, 1, false, 0.3, Math.PI * 2 - 0.6),
        new THREE.MeshLambertMaterial({ color: "#46A957" })
    );
    pad.rotation.set(Math.PI / 2, angle, 0);
    pad.position.set(x, y, 0.5);
    return pad;
}

// A cattail: a thin stalk with a brown head
function cattail(x, y, height, lean) {
    const group = new THREE.Group();
    const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.7, height, 6),
        new THREE.MeshLambertMaterial({ color: "#4E8A3A" })
    );
    stalk.rotation.x = Math.PI / 2;
    stalk.position.z = height / 2;
    group.add(stalk);
    const head = new THREE.Mesh(
        new THREE.CapsuleGeometry(1.6, 7, 4, 8),
        new THREE.MeshLambertMaterial({ color: "#7A4E2A" })
    );
    head.rotation.x = Math.PI / 2;
    head.position.z = height - 2;
    group.add(head);
    group.position.set(x, y, 0);
    group.rotation.y = lean;
    return group;
}

export function TitleScene() {
    const scene = new THREE.Scene();
    scene.background = skyTexture();
    scene.fog = new THREE.Fog("#D6EEF0", 350, 900);

    scene.add(new THREE.HemisphereLight("#FFFFFF", "#5D8A5A", 1.6));
    const sun = new THREE.DirectionalLight("#FFF6E0", 1.6);
    sun.position.set(-80, -120, 160);
    scene.add(sun);

    // Pond, with a grassy far bank and bushes
    const pond = new THREE.Mesh(
        new THREE.PlaneGeometry(3000, 3000),
        new THREE.MeshPhongMaterial({ color: "#3A8FD0", shininess: 120, specular: "#CFEFFF" })
    );
    scene.add(pond);
    const bank = new THREE.Mesh(
        new THREE.BoxGeometry(3000, 200, 12),
        new THREE.MeshLambertMaterial({ color: "#7CC35A" })
    );
    bank.position.set(0, 420, 2);
    scene.add(bank);
    const bushMaterial = new THREE.MeshLambertMaterial({ color: "#4F9E44" });
    const bushGeometry = new THREE.SphereGeometry(1, 16, 12);
    for (let i = 0; i < 26; i++) {
        const bush = new THREE.Mesh(bushGeometry, bushMaterial);
        const size = random(18, 40);
        bush.scale.set(size * 1.3, size, size);
        bush.position.set(-700 + i * 56 + random(-15, 15), 340 + random(0, 30), 6);
        scene.add(bush);
    }

    // Lily pad (its flower behind Froggy) and a few small ones
    const lilyPad = LilyPad({ onWater: true, withFlag: false, withPool: false });
    lilyPad.rotation.z = -Math.PI / 2; // notch to the side, flower behind
    scene.add(lilyPad);
    for (const [r, x, y, a] of [[9, -45, 50, 1], [6, 40, 60, 2.4], [7, 30, -30, 4], [5, 60, 5, 0.5], [8, -90, 120, 3]]) {
        scene.add(smallPad(r, x, y, a));
    }
    // Cattails off to Froggy's right, away from the menu
    for (const [x, y, h, lean] of [[45, 30, 38, 0.1], [52, 38, 30, -0.12], [38, 44, 34, 0.05], [75, 70, 40, -0.1]]) {
        scene.add(cattail(x, y, h, lean));
    }

    // Ripples spreading out from the pad
    const ripples = [];
    const rippleGeometry = new THREE.RingGeometry(0.92, 1, 48);
    for (let i = 0; i < RIPPLE_COUNT; i++) {
        const ripple = new THREE.Mesh(
            rippleGeometry,
            new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, depthWrite: false })
        );
        ripple.position.z = 0.2;
        ripple.userData.age = (i / RIPPLE_COUNT) * RIPPLE_TIME;
        scene.add(ripple);
        ripples.push(ripple);
    }

    // Froggy: the group bobs and hops, the pivot (at his middle) flips
    const frog = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.position.z = FLIP_MIDDLE;
    frog.add(pivot);
    const model = FrogModel(FROGGY_COLORS);
    model.rotation.x = Math.PI / 2; // stand the y-up model upright in the z-up world
    model.rotation.y = FROG_TURN;
    model.position.z = -FLIP_MIDDLE;
    pivot.add(model);
    scene.add(frog);
    // The axis to his right (he faces -y, turned by FROG_TURN): turning
    // around it tips him backwards
    const flipAxis = new THREE.Vector3(-Math.cos(FROG_TURN), -Math.sin(FROG_TURN), 0);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 3000);
    camera.up.set(0, 0, 1);

    // Frame Froggy right of centre (or above it on a narrow screen) by
    // moving the camera and its target the other way
    function frame() {
        const aspect = screenWidth() / screenHeight();
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        const narrow = aspect < NARROW_ASPECT;
        const distance = narrow ? CAMERA_DISTANCE * 1.25 : CAMERA_DISTANCE;
        const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
        const shiftX = narrow ? 0 : FROG_SHARE_X * halfHeight * aspect;
        const shiftZ = narrow ? FROG_SHARE_Y * halfHeight : 0;
        camera.position.set(-shiftX, -distance, CAMERA_HEIGHT - shiftZ);
        camera.lookAt(-shiftX, 0, LOOK_HEIGHT - shiftZ);
    }
    frame();
    window.addEventListener("resize", frame);

    let time = 0;
    let action = null;
    let actionTime = 0;
    let nextAction = random(1, 2);
    let landed = true;

    // Clicking Froggy (at screen position x, y) makes him backflip
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    function isOverFrog(x, y) {
        pointer.set((x / screenWidth()) * 2 - 1, -(y / screenHeight()) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        return raycaster.intersectObject(model, true).length > 0;
    }
    function click(x, y) {
        if (action?.name === "flip" || !isOverFrog(x, y)) return;
        action = FLIP;
        actionTime = 0;
        landed = false;
        playLaunch();
    }

    function update(delta) {
        time += delta;
        lilyPad.userData.update(delta);

        // Pick the next action once the last one is over
        if (action) {
            actionTime += delta;
            if (actionTime >= action.duration) {
                action = null;
                nextAction = random(...ACTION_GAP);
            }
        } else {
            nextAction -= delta;
            if (nextAction <= 0) {
                action = pickAction();
                actionTime = 0;
            }
        }
        const progress = action ? actionTime / action.duration : 0;
        const name = action?.name;
        const wave = name === "wave" || name === "waveSmile" ? envelope(progress) : 0;
        let smile = name === "smile" || name === "waveSmile" ? envelope(progress, 0.15) : 0;
        let hop = name === "hop" ? Math.sin(progress * Math.PI) * HOP_HEIGHT : 0;
        let flip = 0;
        if (name === "flip") {
            hop = Math.sin(progress * Math.PI) * FLIP_HEIGHT;
            flip = smoothstep((progress - 0.1) / 0.75) * Math.PI * 2; // a full turn while in the air
            smile = envelope(progress, 0.15);
            if (!landed && progress > 0.97) {
                landed = true;
                playLand();
            }
        }
        pivot.quaternion.setFromAxisAngle(flipAxis, flip);
        setFrogExpression(model, smile, wave, time);
        updateFrogBlink(model, delta);

        // Bob with the pad, plus his own little bounce (squashing at the bottom)
        const bounce = (Math.sin(time * BOB_SPEED) + 1) / 2;
        frog.position.z = LILY_PAD_HEIGHT + (lilyPad.userData.bob ?? 0) + bounce * BOB_HEIGHT + hop;
        const squash = hop > 0 ? -0.06 : (1 - bounce) * BOB_SQUASH;
        model.scale.set(1 + squash, 1 - squash, 1 + squash);

        for (const ripple of ripples) {
            ripple.userData.age = (ripple.userData.age + delta) % RIPPLE_TIME;
            const t = ripple.userData.age / RIPPLE_TIME;
            ripple.scale.setScalar(15 + t * RIPPLE_SIZE);
            ripple.material.opacity = 0.35 * (1 - t);
        }
    }

    return { scene, camera, update, click, isOverFrog };
}
