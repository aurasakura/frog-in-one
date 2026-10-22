import * as THREE from "three";
import { WATER_Z } from "./Water.js";

// Decoration around a level, so the water under the terraces isn't an empty
// sheet: islands out on the water (some with trees, some with houses, some
// with both), lily pads (some with flowers) and clouds drifting overhead.
// None of it can be landed on: the islands sit down at the water, far below
// the terraces, and well away from them; physics.js also treats touching
// one as a splash (see islandAt in levelBuilder.js). Laid out with a random
// generator seeded by the level's name, so each level always looks the same.

const ISLAND_COUNT = 14;
const ISLAND_DISTANCE = [550, 2400]; // from the level's edge: out of reach of any hop
const ISLAND_RADIUS = [60, 170];
const ISLAND_GAP = 80; // between islands
const ISLAND_HEIGHT = [6, 70]; // grass top above the water (random in range)
const CLIFF_FROM = 22; // islands taller than this have rocky cliffs and a sandy beach
const TREE_AREA = 900; // island area (world units²) per tree, halved when sharing with houses
const LEAF_COLORS = ["#3F8F3A", "#4E9E44", "#2F7A34", "#5DAA4A"];
const HOUSE_COLORS = ["#F2E3C6", "#F7C8A0", "#CDE3F2", "#F4E1A1", "#E9C2D0"];
const ROOF_COLORS = ["#C0392B", "#8E5A3C", "#5B6C8C", "#A0522D"];
const LILY_PAD_COUNT = 140;
const LILY_PAD_SPREAD = 1400; // pads float up to this far out from the level
const LILY_PAD_CLEARANCE = 20; // and no closer than this to a terrace
const FLOWER_CHANCE = 0.25;
const CLOUD_COUNT = 16;
const CLOUD_HEIGHT = [380, 620];
const CLOUD_SPEED = 8; // world units per second
const CLOUD_SPREAD = 1800; // clouds fill the level's area plus this much

// Small seeded random generator (mulberry32)
function seededRandom(text) {
    let seed = 0;
    for (const char of text) seed = (seed * 31 + char.charCodeAt(0)) | 0;
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const material = (color) => new THREE.MeshLambertMaterial({ color });
const pick = (random, list) => list[Math.floor(random() * list.length)];

// One instanced mesh from a list of { position, scale, rotation?, color? }
function instanced(geometry, mat, items) {
    const mesh = new THREE.InstancedMesh(geometry, mat, items.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    items.forEach((item, i) => {
        dummy.position.copy(item.position);
        dummy.scale.copy(item.scale);
        dummy.rotation.set(item.rotation?.x ?? 0, item.rotation?.y ?? 0, item.rotation?.z ?? 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (item.color) mesh.setColorAt(i, color.set(item.color));
    });
    return mesh;
}

// Is (x, y) under the level (inside any terrace footprint, plus a margin)?
function underLevel(footprints, x, y, margin) {
    return footprints.some(
        (b) => x > b.minX - margin && x < b.maxX + margin && y > b.minY - margin && y < b.maxY + margin
    );
}

// A little house: walls, a hipped roof, a door and two windows, front
// facing -y, standing on z = 0. userData has its height and radius.
function House(random) {
    const house = new THREE.Group();
    const width = 50 + random() * 25;
    const depth = 40 + random() * 15;
    const height = 34 + random() * 14;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(width, depth, height), material(pick(random, HOUSE_COLORS)));
    walls.position.z = height / 2;
    house.add(walls);
    const diagonal = Math.hypot(width, depth);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(diagonal / 2 + 5, 26, 4), material(pick(random, ROOF_COLORS)));
    roof.rotation.set(Math.PI / 2, Math.PI / 4, 0);
    roof.scale.set((width / diagonal) * 1.42, 1, (depth / diagonal) * 1.42); // stretch the square base to fit
    roof.position.z = height + 13;
    house.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 18), material("#7A5230"));
    door.position.set(0, -depth / 2 - 0.5, 9);
    house.add(door);
    for (const side of [-1, 1]) {
        const window = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 10), material("#9BD3F2"));
        window.position.set(side * width * 0.3, -depth / 2 - 0.5, height * 0.6);
        house.add(window);
    }
    house.userData.height = height + 26;
    house.userData.radius = diagonal / 2;
    return house;
}

// Islands in a ring around the level, low and sandy or tall with rocky
// cliffs and a beach, each with a grassy top and trees, houses or both. Returns the group and each island's
// { x, y, radius, top } (top: the height of its tallest tree or house).
function Islands(box, footprints, random) {
    const group = new THREE.Group();
    const islands = [];
    const trunks = [];
    const crowns = [];
    const pines = [];
    const sand = material("#E6D3A3");
    const rock = material("#9C8F7E");
    const grass = material("#6DBE4B");
    const upright = (mesh, x, y, z) => {
        mesh.rotation.x = Math.PI / 2; // cylinders run along y; stand them along z
        mesh.position.set(x, y, z);
        return mesh;
    };
    const centreX = (box.minX + box.maxX) / 2;
    const centreY = (box.minY + box.maxY) / 2;

    for (let tries = 0; islands.length < ISLAND_COUNT && tries < 400; tries++) {
        const angle = random() * Math.PI * 2;
        const distance = ISLAND_DISTANCE[0] + random() * (ISLAND_DISTANCE[1] - ISLAND_DISTANCE[0]);
        const x = centreX + Math.cos(angle) * ((box.maxX - box.minX) / 2 + distance);
        const y = centreY + Math.sin(angle) * ((box.maxY - box.minY) / 2 + distance);
        const radius = ISLAND_RADIUS[0] + random() * (ISLAND_RADIUS[1] - ISLAND_RADIUS[0]);
        if (underLevel(footprints, x, y, ISLAND_DISTANCE[0] + radius)) continue;
        if (islands.some((o) => Math.hypot(o.x - x, o.y - y) < o.radius + radius + ISLAND_GAP)) continue;

        const height = ISLAND_HEIGHT[0] + random() ** 1.5 * (ISLAND_HEIGHT[1] - ISLAND_HEIGHT[0]); // mostly low
        const surface = WATER_Z + height;
        const island = { x, y, radius, top: surface };
        islands.push(island);
        let topRadius = radius * 0.88;
        if (height > CLIFF_FROM) {
            // Rocky sides narrowing upwards, standing on a wider sandy beach
            const beach = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.12, radius * 1.22, 4, 28), sand);
            const cliff = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius, height - 2, 9), rock);
            group.add(upright(beach, x, y, WATER_Z + 2), upright(cliff, x, y, WATER_Z + (height - 2) / 2));
            topRadius = radius * 0.8;
        } else {
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.12, height - 2, 28), sand);
            group.add(upright(rim, x, y, WATER_Z + (height - 2) / 2));
        }
        const top = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, topRadius * 1.04, 2.5, 28), grass);
        group.add(upright(top, x, y, surface - 1));

        // A free spot of radius r on the grass, or null if it's full
        const taken = [];
        const freeSpot = (r) => {
            for (let t = 0; t < 20; t++) {
                const a = random() * Math.PI * 2;
                const d = Math.sqrt(random()) * Math.max(0, topRadius * 0.9 - r);
                const spot = { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r };
                if (!taken.some((o) => Math.hypot(o.x - spot.x, o.y - spot.y) < o.r + r)) {
                    taken.push(spot);
                    return spot;
                }
            }
            return null;
        };

        const kind = pick(random, ["trees", "houses", "both"]);
        if (kind !== "trees") {
            const houseCount = radius > 120 ? 1 + Math.floor(random() * 2) : 1;
            for (let i = 0; i < houseCount; i++) {
                const house = House(random);
                const spot = freeSpot(house.userData.radius + 6);
                if (!spot) continue;
                house.position.set(spot.x, spot.y, surface);
                house.rotation.z = random() * Math.PI * 2;
                group.add(house);
                island.top = Math.max(island.top, surface + house.userData.height);
            }
        }
        if (kind !== "houses") {
            const treeCount = Math.round((Math.PI * radius * radius) / TREE_AREA / (kind === "both" ? 2 : 1));
            for (let i = 0; i < treeCount; i++) {
                const spot = freeSpot(9);
                if (!spot) continue;
                const height = 40 + random() * 45;
                const leaf = pick(random, LEAF_COLORS);
                trunks.push({
                    position: new THREE.Vector3(spot.x, spot.y, surface + height * 0.25),
                    scale: new THREE.Vector3(2.6, height * 0.5, 2.6),
                    rotation: { x: Math.PI / 2 },
                });
                if (random() < 0.4) {
                    pines.push({
                        position: new THREE.Vector3(spot.x, spot.y, surface + height * 0.62),
                        scale: new THREE.Vector3(height * 0.28, height * 0.8, height * 0.28),
                        rotation: { x: Math.PI / 2 },
                        color: leaf,
                    });
                } else {
                    const size = height * (0.28 + random() * 0.1);
                    crowns.push({
                        position: new THREE.Vector3(spot.x, spot.y, surface + height * 0.65),
                        scale: new THREE.Vector3(size, size, size * 0.9),
                        color: leaf,
                    });
                }
                island.top = Math.max(island.top, surface + height * 1.05);
            }
        }
    }
    group.add(instanced(new THREE.CylinderGeometry(1, 1.3, 1, 6), material("#7A5230"), trunks));
    group.add(instanced(new THREE.IcosahedronGeometry(1, 1), material("#FFFFFF"), crowns));
    group.add(instanced(new THREE.ConeGeometry(1, 1, 8), material("#FFFFFF"), pines));
    return { group, islands };
}

// Lily pads (a few with pink flowers) on the water around the level, not
// under the terraces or on the islands
function LilyPads(box, footprints, islands, random) {
    const group = new THREE.Group();
    const pads = [];
    for (let i = 0; i < LILY_PAD_COUNT; i++) {
        const x = box.minX - LILY_PAD_SPREAD + random() * (box.maxX - box.minX + LILY_PAD_SPREAD * 2);
        const y = box.minY - LILY_PAD_SPREAD + random() * (box.maxY - box.minY + LILY_PAD_SPREAD * 2);
        if (underLevel(footprints, x, y, LILY_PAD_CLEARANCE)) continue;
        if (islands.some((island) => Math.hypot(island.x - x, island.y - y) < island.radius * 1.2)) continue;
        const size = 8 + random() * 10;
        pads.push({
            position: new THREE.Vector3(x, y, WATER_Z + 0.6),
            scale: new THREE.Vector3(size, 1, size),
            rotation: { x: Math.PI / 2, y: random() * Math.PI * 2 },
            color: random() < 0.5 ? "#46A957" : "#3C9A4C",
        });
    }
    const padGeometry = new THREE.CylinderGeometry(1, 1, 0.8, 20, 1, false, 0.3, Math.PI * 2 - 0.6);
    group.add(instanced(padGeometry, material("#FFFFFF"), pads));

    const flowers = pads
        .filter(() => random() < FLOWER_CHANCE)
        .map((pad) => ({
            position: new THREE.Vector3(pad.position.x + pad.scale.x * 0.3, pad.position.y, WATER_Z + 2.5),
            scale: new THREE.Vector3(2.8, 2.8, 2.2),
        }));
    group.add(instanced(new THREE.SphereGeometry(1, 10, 8), material("#FF8FB1"), flowers));
    return group;
}

// Fluffy clouds (a few white spheres each) drifting slowly across the sky
function Clouds(box, random) {
    const group = new THREE.Group();
    const cloudMaterial = new THREE.MeshLambertMaterial({ color: "#FFFFFF", emissive: "#DDE8F0" });
    const puff = new THREE.SphereGeometry(1, 14, 10);
    const minX = box.minX - CLOUD_SPREAD;
    const maxX = box.maxX + CLOUD_SPREAD;
    const clouds = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
        const cloud = new THREE.Group();
        const puffs = 4 + Math.floor(random() * 3);
        for (let j = 0; j < puffs; j++) {
            const mesh = new THREE.Mesh(puff, cloudMaterial);
            const size = 30 + random() * 30;
            mesh.scale.set(size * 1.3, size, size * 0.8);
            mesh.position.set((j - puffs / 2) * 38 + random() * 15, random() * 20, random() * 18);
            cloud.add(mesh);
        }
        cloud.position.set(
            minX + random() * (maxX - minX),
            box.minY - CLOUD_SPREAD + random() * (box.maxY - box.minY + CLOUD_SPREAD * 2),
            CLOUD_HEIGHT[0] + random() * (CLOUD_HEIGHT[1] - CLOUD_HEIGHT[0])
        );
        group.add(cloud);
        clouds.push(cloud);
    }
    group.userData.update = (delta) => {
        for (const cloud of clouds) {
            cloud.position.x += CLOUD_SPEED * delta;
            if (cloud.position.x > maxX) cloud.position.x = minX; // wrap round
        }
    };
    return group;
}

// `box` is the level's footprint, `footprints` each terrace's, and `name`
// seeds the layout. userData.islands lists the islands ({ x, y, radius, top }).
export function Scenery(box, footprints, name) {
    const random = seededRandom(name);
    const group = new THREE.Group();
    const islands = Islands(box, footprints, random);
    const clouds = Clouds(box, random);
    group.add(islands.group, LilyPads(box, footprints, islands.islands, random), clouds);
    group.userData.update = clouds.userData.update;
    group.userData.islands = islands.islands;
    return group;
}
