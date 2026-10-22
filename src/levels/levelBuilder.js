import * as THREE from "three";
import { Terrace, CELL_SIZE } from "../components/Terrace.js";
import { Water } from "../components/Water.js";
import { Scenery } from "../components/Scenery.js";
import { LilyPad, LILY_PAD_HEIGHT } from "../components/LilyPad.js";
import { placeHouses, clearHouses } from "../components/House.js";
import { PROPS, clearProps, FLOWER_BED_TOP } from "../components/Props.js";
import { setArcPreviewFraction } from "../components/AimGuide.js";
import { Fly } from "../components/Fly.js";
import { Sprinkler } from "../components/Sprinkler.js";
import { HoseJet } from "../components/HoseJet.js";
import { WashingLine } from "../components/WashingLine.js";

const DEFAULT_FLY_HEIGHT = 35; // above the surface below it

// Surface tiles of the current level, keyed by "col,row"
const tiles = new Map();
const tileKey = (col, row) => `${col},${row}`;

let levelGroup = null;
let lilyPadObject = null;
let scenery = null;
let terraces = [];

// The current level, as built
export const level = {
    data: null,
    start: new THREE.Vector3(),
    lilyPad: { col: 0, row: 0, z: 0, catchRadius: 0 },
    terraceFootprints: [],
    flies: [],
    obstacles: [], // each has object, update(delta, frog), collide(frog, delta)
};

function tileAt(col, row) {
    const tile = tiles.get(tileKey(col, row));
    if (!tile) throw new Error(`Level "${level.data.name}" has no tile at ${col},${row}`);
    return tile;
}

// Obstacle constructors by the `type` used in level data
const OBSTACLES = {
    sprinkler: (data) => {
        const tile = tileAt(data.col, data.row);
        return Sprinkler({ ...data, x: tile.x, y: tile.y, z: tile.z });
    },
    hoseJet: (data) => {
        const tile = tileAt(data.col, data.row);
        return HoseJet({ ...data, x: tile.x, y: tile.y, z: tile.z, length: data.length * CELL_SIZE });
    },
    washingLine: (data) => {
        const from = tileAt(data.from.col, data.from.row);
        const to = tileAt(data.to.col, data.to.row);
        return WashingLine({ ...data, x: from.x, y: from.y, z: from.z, toX: to.x, toY: to.y });
    },
};

// Replace whatever level is in the scene with the one described by `data`.
// Rebuilding also respawns the flies and resets the obstacles.
export function buildLevel(data, scene) {
    if (levelGroup) scene.remove(levelGroup);
    tiles.clear();
    clearHouses();
    clearProps();
    setArcPreviewFraction(data.arcPreview);

    levelGroup = new THREE.Group();
    level.data = data;
    level.terraceFootprints = [];
    terraces = [];

    for (const terraceData of data.terraces) {
        const terrace = Terrace(terraceData);
        levelGroup.add(terrace);
        terraces.push(terrace);
        for (const tile of terrace.userData.tiles) tiles.set(tileKey(tile.col, tile.row), tile);
        level.terraceFootprints.push(terrace.userData.footprint);
    }

    // Water sized to cover all the terraces
    const bounds = level.terraceFootprints.reduce((all, box) => ({
        minX: Math.min(all.minX, box.minX),
        maxX: Math.max(all.maxX, box.maxX),
        minY: Math.min(all.minY, box.minY),
        maxY: Math.max(all.maxY, box.maxY),
    }));
    levelGroup.add(Water(bounds));
    scenery = Scenery(bounds, level.terraceFootprints, data.name); // islands, lily pads, clouds
    levelGroup.add(scenery);

    const padTile = tileAt(data.lilyPad.col, data.lilyPad.row);
    const pad = LilyPad({ onWater: padTile.type === "water", padScale: data.lilyPad.size ?? 1 });
    pad.position.set(padTile.x, padTile.y, padTile.z);
    lilyPadObject = pad;
    levelGroup.add(pad);
    level.lilyPad = {
        col: padTile.col,
        row: padTile.row,
        z: padTile.z + LILY_PAD_HEIGHT,
        // Optional: landing in water this close to the pad's centre (in
        // tiles) also counts as reaching it
        catchRadius: (data.lilyPad.catchRadius ?? 0) * CELL_SIZE,
    };

    const startTile = tileAt(data.start.col, data.start.row);
    level.start.set(startTile.x, startTile.y, startTile.z);

    placeHouses(
        levelGroup,
        (data.houses ?? []).map(({ col, row, quarterTurns }) => {
            const tile = tileAt(col, row);
            return { x: tile.x, y: tile.y, z: tile.z, quarterTurns };
        })
    );

    // Static props stand on a tile; fences run between two tiles
    for (const propData of data.props ?? []) {
        const tile = tileAt(propData.col ?? propData.from.col, propData.row ?? propData.from.row);
        const placement = { ...propData, x: tile.x, y: tile.y, z: tile.z };
        if (propData.to) {
            const end = tileAt(propData.to.col, propData.to.row);
            placement.toX = end.x;
            placement.toY = end.y;
        }
        levelGroup.add(PROPS[propData.type](placement));
    }

    // Flower beds are soft soil: landing in one is like landing in mud
    // (stops dead, next hop 60%), and their raised sides block like a step
    for (const bed of (data.props ?? []).filter((p) => p.type === "flowerBed")) {
        for (let c = 0; c < (bed.width ?? 1); c++) {
            for (let r = 0; r < (bed.depth ?? 1); r++) {
                const tile = tileAt(bed.col + c, bed.row + r);
                tile.z += FLOWER_BED_TOP;
                tile.type = "mud";
                tile.flowerBed = true;
            }
        }
    }

    // Flies may hover over water, so col/row can be fractional
    level.flies = (data.flies ?? []).map(({ type, col, row, height = DEFAULT_FLY_HEIGHT, pattern }) => {
        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;
        const groundZ = surfaceAt(x, y)?.z ?? 0;
        const fly = Fly({ type, x, y, z: groundZ + height, pattern });
        levelGroup.add(fly.object);
        return fly;
    });

    level.obstacles = (data.obstacles ?? []).map((obstacleData) => {
        const obstacle = OBSTACLES[obstacleData.type](obstacleData);
        obstacle.kind = obstacleData.type; // e.g. for its first-touch tip
        levelGroup.add(obstacle.object);
        return obstacle;
    });

    scene.add(levelGroup);
}

// How far the lily pad is bobbing up or down right now
export function getLilyPadBob() {
    return lilyPadObject?.userData.bob ?? 0;
}

// Animate everything in the level; `frog` is the physics' view of Froggy
export function updateLevel(delta, frog) {
    for (const terrace of terraces) terrace.userData.update(delta);
    lilyPadObject?.userData.update(delta); // bobbing pad, fluttering flag
    scenery?.userData.update(delta); // drifting clouds
    for (const fly of level.flies) fly.update(delta);
    for (const obstacle of level.obstacles) obstacle.update(delta, frog);
}

// The scenery island under (x, y), if any ({ x, y, radius, top }). They
// can't be landed on: touching one counts as falling in (physics.js).
export function islandAt(x, y) {
    return scenery?.userData.islands.find((island) => Math.hypot(island.x - x, island.y - y) <= island.radius) ?? null;
}

// What Froggy would stand on at (x, y): a tile ({ type, z, ... }), the lily
// pad, or null over water
export function surfaceAt(x, y) {
    const col = Math.round(x / CELL_SIZE);
    const row = Math.round(y / CELL_SIZE);

    const pad = level.lilyPad;
    const lilyPad = { type: "lilyPad", z: pad.z };
    if (col === pad.col && row === pad.row) return lilyPad;
    const tile = tiles.get(tileKey(col, row)) ?? null;
    if (tile?.type === "water" && Math.hypot(x - pad.col * CELL_SIZE, y - pad.row * CELL_SIZE) <= pad.catchRadius) {
        return lilyPad;
    }
    return tile;
}
