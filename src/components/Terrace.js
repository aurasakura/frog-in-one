import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { footprint } from "../collision.js";

export const CELL_SIZE = 40; // one tile
const TOP_THICKNESS = 4; // surface layer
const BODY_DEPTH = 36; // soil underneath, visible from the sides
export const MUD_SINK = 1.5; // mud sits slightly lower than the ground around it
export const PUDDLE_SINK = 2.5; // puddle water sits below the ground around it
export const SLIME_HEIGHT = 16; // slime blocks rise this far above the terrace

// Slime wobble: a gentle idle jiggle, plus a bigger one when poked
const SLIME_WOBBLE_SPEED = 6; // radians per second
const SLIME_IDLE_WOBBLE = 0.04;
const SLIME_POKE_WOBBLE = 0.25;
const SLIME_POKE_DECAY = 4; // per second

// Characters used in level data for each surface type ("." = no tile)
export const SURFACE_CODES = {
    G: "grass",
    M: "mud",
    W: "wetPavement",
    S: "slime",
    P: "water", // puddle / pond: landing in it sends Froggy back
};

const GRASS_COLORS = ["#228B22", "#90EE90"]; // checkerboard, as on the original floor
const TILE_SHADES = ["#FFFFFF", "#D9D9D9"]; // subtle checker over textured surfaces
const SOIL_COLOR = "#7A4E2D";

// --- Procedural textures (made once, shared by every terrace) ---

function canvasTexture(draw) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    draw(canvas.getContext("2d"));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function blob(ctx, x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
}

// Lumpy brown mud with dark patches and a few wet glints
const mudTexture = canvasTexture((ctx) => {
    ctx.fillStyle = "#6B4423";
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 14; i++) {
        const dark = i % 2 === 0;
        blob(
            ctx,
            Math.random() * 64,
            Math.random() * 64,
            4 + Math.random() * 8,
            3 + Math.random() * 6,
            dark ? "rgba(60, 35, 15, 0.6)" : "rgba(140, 95, 55, 0.5)"
        );
    }
    for (let i = 0; i < 6; i++) {
        blob(ctx, Math.random() * 64, Math.random() * 64, 2, 1, "rgba(220, 200, 170, 0.5)");
    }
});

// Grey paving slabs (2×2 per tile) with grout lines and puddle sheen
const pavementTexture = canvasTexture((ctx) => {
    ctx.fillStyle = "#5E6873";
    ctx.fillRect(0, 0, 64, 64);
    for (const [x, y] of [[0, 0], [32, 0], [0, 32], [32, 32]]) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.03 + Math.random() * 0.06})`;
        ctx.fillRect(x + 1, y + 1, 30, 30);
    }
    ctx.strokeStyle = "#3E464F";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 62, 62);
    ctx.beginPath();
    ctx.moveTo(32, 0);
    ctx.lineTo(32, 64);
    ctx.moveTo(0, 32);
    ctx.lineTo(64, 32);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
        blob(ctx, Math.random() * 64, Math.random() * 64, 8 + Math.random() * 6, 3, "rgba(190, 215, 240, 0.35)");
    }
});

const SURFACE_MATERIALS = {
    grass: new THREE.MeshLambertMaterial(),
    mud: new THREE.MeshLambertMaterial({ map: mudTexture }),
    // Shiny: strong specular highlights from the sun
    wetPavement: new THREE.MeshPhongMaterial({
        map: pavementTexture,
        shininess: 110,
        specular: "#A8BED4",
    }),
    water: new THREE.MeshPhongMaterial({
        color: "#3A8FD0",
        shininess: 140,
        specular: "#FFFFFF",
        transparent: true,
        opacity: 0.9,
    }),
};

const slimeMaterial = new THREE.MeshPhongMaterial({
    color: "#8BE33B",
    emissive: "#2B6B00",
    shininess: 140,
    specular: "#FFFFFF",
    transparent: true,
    opacity: 0.85,
});
// Base at z = 0 so the block wobbles up from the terrace, not around its middle
const slimeGeometry = new RoundedBoxGeometry(
    CELL_SIZE - 2,
    CELL_SIZE - 2,
    SLIME_HEIGHT + TOP_THICKNESS,
    3,
    5
).translate(0, 0, (SLIME_HEIGHT + TOP_THICKNESS) / 2);

// Height Froggy stands at (or splashes into) on a tile of this type
function surfaceHeight(type, z) {
    if (type === "mud") return z - MUD_SINK;
    if (type === "water") return z - PUDDLE_SINK;
    if (type === "slime") return z + SLIME_HEIGHT;
    return z;
}

// Give each touching cluster of slime tiles its own shared `slimePad`
function markSlimePads(tiles) {
    const slime = new Map(tiles.filter((t) => t.type === "slime").map((t) => [`${t.col},${t.row}`, t]));
    for (const start of slime.values()) {
        if (start.slimePad) continue;
        const pad = {};
        const stack = [start];
        start.slimePad = pad;
        while (stack.length) {
            const { col, row } = stack.pop();
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const next = slime.get(`${col + dc},${row + dr}`);
                if (next && !next.slimePad) {
                    next.slimePad = pad;
                    stack.push(next);
                }
            }
        }
    }
}

// A raised, floating block of tiles. `rows` are strings of surface codes,
// listed far (+y) to near (-y); `col`/`row` give the tile of the bottom-left
// character and `z` the height of the top surface.
//
// Each tile is { col, row, x, y, z, type } where z is what Froggy stands on;
// slime tiles also get poke() to make their block wobble, and `slimePad`:
// an object shared by each touching cluster of slime tiles.
export function Terrace({ col, row, z = 0, rows }) {
    const tiles = [];
    rows.forEach((line, r) => {
        [...line].forEach((code, c) => {
            const type = SURFACE_CODES[code];
            if (!type) return;
            const tileCol = col + c;
            const tileRow = row + (rows.length - 1 - r);
            tiles.push({
                col: tileCol,
                row: tileRow,
                x: tileCol * CELL_SIZE,
                y: tileRow * CELL_SIZE,
                z: surfaceHeight(type, z),
                type,
            });
        });
    });

    const group = new THREE.Group();
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const shadeOf = (tile) => (((tile.col + tile.row) % 2) + 2) % 2; // works for negatives

    // Soil under every tile
    const body = new THREE.InstancedMesh(
        new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, BODY_DEPTH),
        new THREE.MeshLambertMaterial({ color: SOIL_COLOR }),
        tiles.length
    );
    tiles.forEach((tile, i) => {
        matrix.makeTranslation(tile.x, tile.y, z - TOP_THICKNESS - BODY_DEPTH / 2);
        body.setMatrixAt(i, matrix);
    });
    body.receiveShadow = true;
    group.add(body);

    // Flat surface layers: one instanced mesh per surface type
    const topGeometry = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, TOP_THICKNESS);
    for (const type of ["grass", "mud", "wetPavement", "water"]) {
        const ofType = tiles.filter((tile) => tile.type === type);
        if (ofType.length === 0) continue;

        const mesh = new THREE.InstancedMesh(topGeometry, SURFACE_MATERIALS[type], ofType.length);
        ofType.forEach((tile, i) => {
            matrix.makeTranslation(tile.x, tile.y, tile.z - TOP_THICKNESS / 2);
            mesh.setMatrixAt(i, matrix);
            const palette = type === "grass" ? GRASS_COLORS : TILE_SHADES;
            mesh.setColorAt(i, color.set(type === "water" ? "#FFFFFF" : palette[shadeOf(tile)]));
        });
        mesh.receiveShadow = true;
        group.add(mesh);
    }

    // Slime: separate wobbly blocks
    const slimeBlocks = [];
    for (const tile of tiles.filter((t) => t.type === "slime")) {
        const block = new THREE.Mesh(slimeGeometry, slimeMaterial);
        block.position.set(tile.x, tile.y, z - TOP_THICKNESS);
        block.userData = { phase: Math.random() * Math.PI * 2, poke: 0 };
        group.add(block);
        slimeBlocks.push(block);
        tile.poke = () => (block.userData.poke = SLIME_POKE_WOBBLE);
    }

    markSlimePads(tiles);
    group.userData.tiles = tiles;
    group.userData.footprint = footprint(group, false);

    let time = 0;
    group.userData.update = (delta) => {
        time += delta;
        for (const block of slimeBlocks) {
            const state = block.userData;
            state.poke *= Math.exp(-SLIME_POKE_DECAY * delta);
            const stretch =
                1 + (SLIME_IDLE_WOBBLE + state.poke) * Math.sin(time * SLIME_WOBBLE_SPEED + state.phase);
            block.scale.set(1 / Math.sqrt(stretch), 1 / Math.sqrt(stretch), stretch);
        }
    };

    return group;
}
