import * as THREE from "three";
import { CELL_SIZE } from "./Terrace.js";
import { circleCollidesBox, circlesCollide, footprint } from "../collision.js";
import { POWERUPS, powerupIconCanvas } from "../powerups.js";

// Static neighbourhood props (§8): picket fences, mailboxes, bins, flower
// beds and birdbaths, built from simple geometry. Every prop (and every
// house, see House.js) registers a collision shape here.

const FENCE_HEIGHT = 22;
const PICKET_SPACING = 7;
const MAILBOX_HEIGHT = 30;
const BIN_RADIUS = 10;
const BIN_HEIGHT = 28;
const BED_HEIGHT = 8;
// Top of a flower bed's soil: the bed is a landing surface at this height
// above its tiles (soft soil, so it acts like mud; see levelBuilder.js)
export const FLOWER_BED_TOP = BED_HEIGHT + 1;
const BIRDBATH_RADIUS = 14;
const BIRDBATH_HEIGHT = 26;

const FLOWER_COLORS = ["#FF6F91", "#FFC75F", "#F9F871", "#C34A36", "#D65DB1", "#FFFFFF"];

// --- Collision shapes ---

// { kind: "box", minX, maxX, minY, maxY, minZ, maxZ } or
// { kind: "circle", x, y, radius, minZ, maxZ }
const shapes = [];

export function clearProps() {
    shapes.length = 0;
}

export function addBoxShape(box) {
    shapes.push({ kind: "box", ...box });
}

export function addCircleShape(x, y, radius, minZ, maxZ) {
    shapes.push({ kind: "circle", x, y, radius, minZ, maxZ });
}

// Does a circle at (x, y), with its bottom at height z, run into a prop?
// Froggy clears a prop once he's higher than its top.
export function collidesWithProp(x, y, z, radius) {
    return shapes.some((shape) => {
        if (z >= shape.maxZ) return false;
        return shape.kind === "box"
            ? circleCollidesBox(x, y, radius, shape)
            : circlesCollide(x, y, radius, shape.x, shape.y, shape.radius);
    });
}

// --- Geometry helpers ---

const materials = new Map();
function material(color) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshLambertMaterial({ color }));
    return materials.get(color);
}

function box(width, depth, height, color, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, depth, height), material(color));
    mesh.position.set(x, y, z + height / 2);
    mesh.castShadow = true;
    return mesh;
}

// Upright cylinder (three's cylinders run along y; ours stand along z)
function cylinder(radiusTop, radiusBottom, height, color, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16), material(color));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z + height / 2);
    mesh.castShadow = true;
    return mesh;
}

// --- Props ---

// White picket fence from (x, y) to (toX, toY)
function PicketFence({ x, y, z, toX, toY }) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const length = Math.hypot(toX - x, toY - y);
    group.rotation.z = Math.atan2(toY - y, toX - x); // local +x along the fence

    const count = Math.max(2, Math.round(length / PICKET_SPACING) + 1);
    for (let i = 0; i < count; i++) {
        const along = (i / (count - 1)) * length;
        group.add(box(3, 1.5, FENCE_HEIGHT - 3, "#F4F4F4", along, 0, 0));
        const tip = new THREE.Mesh(new THREE.ConeGeometry(2.1, 3, 4), material("#F4F4F4"));
        tip.rotation.x = Math.PI / 2;
        tip.position.set(along, 0, FENCE_HEIGHT - 1.5);
        group.add(tip);
    }
    for (const railZ of [5, FENCE_HEIGHT - 8]) {
        group.add(box(length, 1.2, 2, "#E2E2E2", length / 2, -1.2, railZ));
    }

    addBoxShape(footprint(group));
    return group;
}

function Mailbox({ x, y, z, color = "#2E5EAA" }) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.add(box(3, 3, MAILBOX_HEIGHT - 8, "#7A5230"));
    group.add(box(9, 14, 8, color, 0, 0, MAILBOX_HEIGHT - 8));
    group.add(box(1, 1, 7, "#E53935", 5, -3, MAILBOX_HEIGHT - 6)); // flag

    addBoxShape(footprint(group));
    return group;
}

function Bin({ x, y, z, color = "#2E7D32" }) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.add(cylinder(BIN_RADIUS, BIN_RADIUS * 0.85, BIN_HEIGHT - 3, color));
    group.add(cylinder(BIN_RADIUS + 1, BIN_RADIUS + 1, 3, "#37474F", 0, 0, BIN_HEIGHT - 3)); // lid

    addCircleShape(x, y, BIN_RADIUS, z, z + BIN_HEIGHT);
    return group;
}

// Raised wooden bed with flowers, covering `width` × `depth` tiles
function FlowerBed({ x, y, z, width = 1, depth = 1 }) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const w = width * CELL_SIZE - 6;
    const d = depth * CELL_SIZE - 6;
    // Centred on the middle of the tiles it covers
    const cx = ((width - 1) * CELL_SIZE) / 2;
    const cy = ((depth - 1) * CELL_SIZE) / 2;

    group.add(box(w, d, BED_HEIGHT, "#8D6E63", cx, cy));
    group.add(box(w - 4, d - 4, 1, "#4E342E", cx, cy, BED_HEIGHT));

    const flowerCount = Math.round((w * d) / 120);
    const stem = new THREE.CylinderGeometry(0.4, 0.4, 6, 4).rotateX(Math.PI / 2);
    const bloom = new THREE.SphereGeometry(2, 8, 6);
    for (let i = 0; i < flowerCount; i++) {
        const fx = cx + (Math.random() - 0.5) * (w - 8);
        const fy = cy + (Math.random() - 0.5) * (d - 8);
        const stemMesh = new THREE.Mesh(stem, material("#4CAF50"));
        stemMesh.position.set(fx, fy, BED_HEIGHT + 3);
        const bloomMesh = new THREE.Mesh(bloom, material(FLOWER_COLORS[i % FLOWER_COLORS.length]));
        bloomMesh.position.set(fx, fy, BED_HEIGHT + 6.5);
        group.add(stemMesh, bloomMesh);
    }

    // No collision shape: the level builder turns the bed's tiles into a
    // raised, mud-like surface, so Froggy lands in it (and bumps its sides)
    return group;
}

function Birdbath({ x, y, z }) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.add(cylinder(6, 8, 3, "#B0BEC5"));
    group.add(cylinder(3, 4, BIRDBATH_HEIGHT - 7, "#CFD8DC", 0, 0, 3));
    group.add(cylinder(BIRDBATH_RADIUS, 9, 4, "#CFD8DC", 0, 0, BIRDBATH_HEIGHT - 4));
    const water = new THREE.Mesh(
        new THREE.CircleGeometry(BIRDBATH_RADIUS - 2, 20),
        new THREE.MeshPhongMaterial({ color: "#7EC8E3", shininess: 120 })
    );
    water.position.z = BIRDBATH_HEIGHT + 0.1;
    group.add(water);

    addCircleShape(x, y, BIRDBATH_RADIUS, z, z + BIRDBATH_HEIGHT);
    return group;
}

// --- Signpost: a wooden board on a post, teaching a mechanic ---

const SIGN_WIDTH = 40;
const SIGN_HEIGHT = 32;
const SIGN_BOTTOM = 14; // board's lower edge above the ground

const INK = "#3B2412";

// --- Sign icons: small drawings of the mechanic, centred on (0, 0) and
// about 180 wide by 140 tall, in the sign's ink with a few colours ---

function inked(ctx, fill) {
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    ctx.stroke();
}

// A dome-shaped blob (slime) standing on y = bottom
function blobPath(ctx, x, bottom, width, height) {
    ctx.beginPath();
    ctx.moveTo(x - width / 2, bottom);
    ctx.quadraticCurveTo(x - width / 2, bottom - height, x, bottom - height);
    ctx.quadraticCurveTo(x + width / 2, bottom - height, x + width / 2, bottom);
    ctx.closePath();
}

function dottedArc(ctx, fromX, toX, baseY, height) {
    ctx.save();
    ctx.setLineDash([4, 14]);
    ctx.beginPath();
    ctx.moveTo(fromX, baseY);
    ctx.quadraticCurveTo((fromX + toX) / 2, baseY - height * 2, toX, baseY);
    ctx.stroke();
    ctx.restore();
}

function waves(ctx, y, width, count) {
    ctx.beginPath();
    const step = width / count;
    ctx.moveTo(-width / 2, y);
    for (let i = 0; i < count; i++) {
        const x = -width / 2 + i * step;
        ctx.quadraticCurveTo(x + step / 4, y - 14, x + step / 2, y);
        ctx.quadraticCurveTo(x + (3 * step) / 4, y + 14, x + step, y);
    }
    ctx.stroke();
}

function drop(ctx, x, y, size, fill) {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x + size * 0.8, y + size * 0.1, x, y + size * 0.6);
    ctx.quadraticCurveTo(x - size * 0.8, y + size * 0.1, x, y - size);
    inked(ctx, fill);
}

function frog(ctx, x, y) {
    ctx.beginPath();
    ctx.ellipse(x, y, 24, 18, 0, 0, Math.PI * 2);
    inked(ctx, "#5DBB63");
    for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x + side * 10, y - 18, 7, 0, Math.PI * 2);
        inked(ctx, "white");
    }
}

// Light streaks for a wet shine
function shine(ctx, segments) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    for (const [x1, y1, x2, y2] of segments) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    ctx.restore();
}

const SIGN_ICONS = {
    // Froggy's hop arc to the flag
    hop(ctx) {
        frog(ctx, -65, 45);
        dottedArc(ctx, -40, 70, 55, 50);
        ctx.beginPath();
        ctx.moveTo(70, 60);
        ctx.lineTo(70, -45);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(70, -45);
        ctx.lineTo(108, -31);
        ctx.lineTo(70, -17);
        ctx.closePath();
        inked(ctx, "#D9473B");
    },
    // A splash on the waves
    water(ctx) {
        drop(ctx, 0, -28, 30, "#4FA3E0");
        drop(ctx, -45, -8, 16, "#4FA3E0");
        drop(ctx, 45, -8, 16, "#4FA3E0");
        ctx.save();
        ctx.strokeStyle = "#1F5F99";
        waves(ctx, 32, 170, 4);
        waves(ctx, 60, 120, 3);
        ctx.restore();
    },
    // A mud patch with flying clods
    mud(ctx) {
        ctx.beginPath();
        ctx.ellipse(0, 38, 85, 26, 0, 0, Math.PI * 2);
        inked(ctx, "#6B4423");
        for (const [x, y, r] of [[-35, -15, 11], [20, -38, 9], [55, -5, 7]]) {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            inked(ctx, "#6B4423");
        }
    },
    // A sprinkler head with its spray fanning out
    sprinkler(ctx) {
        ctx.beginPath();
        ctx.rect(-10, 10, 20, 50);
        inked(ctx, "#9AA0A6");
        ctx.beginPath();
        ctx.arc(0, 8, 16, 0, Math.PI * 2);
        inked(ctx, "#C9CDD1");
        ctx.save();
        ctx.strokeStyle = "#4FA3E0";
        ctx.setLineDash([10, 10]);
        for (const side of [-1, 1]) {
            for (const reach of [55, 85]) {
                ctx.beginPath();
                ctx.moveTo(side * 14, -2);
                ctx.quadraticCurveTo(side * reach * 0.6, -reach, side * reach, reach * 0.3);
                ctx.stroke();
            }
        }
        ctx.restore();
    },
    // Froggy sliding over a shiny slab
    wetPavement(ctx) {
        ctx.beginPath();
        ctx.rect(-90, 35, 180, 28);
        inked(ctx, "#8C949B");
        shine(ctx, [[-70, 45, -45, 45], [-10, 52, 15, 52], [45, 45, 70, 45]]);
        frog(ctx, 45, 10);
        for (const y of [-2, 12, 26]) {
            ctx.beginPath();
            ctx.moveTo(-75, y);
            ctx.lineTo(-5, y);
            ctx.stroke();
        }
    },
    // A puddle with a raindrop falling in
    puddle(ctx) {
        ctx.beginPath();
        ctx.ellipse(0, 30, 85, 30, 0, 0, Math.PI * 2);
        inked(ctx, "#4FA3E0");
        shine(ctx, [[-50, 22, -15, 18]]);
        drop(ctx, 0, -35, 24, "#4FA3E0");
    },
    // A hose nozzle with a jet shooting out sideways
    hose(ctx) {
        ctx.save();
        ctx.lineWidth = 16;
        ctx.strokeStyle = "#3E8E41";
        ctx.beginPath();
        ctx.moveTo(-90, 60);
        ctx.quadraticCurveTo(-90, 0, -48, 0);
        ctx.stroke();
        ctx.restore();
        ctx.beginPath();
        ctx.rect(-50, -13, 36, 26);
        inked(ctx, "#E3B23C");
        ctx.save();
        ctx.lineWidth = 9;
        ctx.strokeStyle = "#4FA3E0";
        for (const spread of [-1, 0, 1]) {
            ctx.beginPath();
            ctx.moveTo(-6, spread * 5);
            ctx.lineTo(95, spread * 24);
            ctx.stroke();
        }
        ctx.restore();
    },
    // Froggy bouncing off the top of a slime block
    slime(ctx) {
        blobPath(ctx, 15, 62, 120, 70);
        inked(ctx, "#8BE04E");
        shine(ctx, [[-20, 15, 0, 7]]);
        dottedArc(ctx, 15, 95, -10, 35);
        frog(ctx, 15, -20);
    },
    // A shirt on the washing line
    laundry(ctx) {
        ctx.beginPath();
        ctx.moveTo(-95, -52);
        ctx.quadraticCurveTo(0, -32, 95, -52);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-30, -42);
        ctx.lineTo(-62, -20);
        ctx.lineTo(-47, 2);
        ctx.lineTo(-30, -8);
        ctx.lineTo(-30, 58);
        ctx.lineTo(30, 58);
        ctx.lineTo(30, -8);
        ctx.lineTo(47, 2);
        ctx.lineTo(62, -20);
        ctx.lineTo(30, -42);
        ctx.closePath();
        inked(ctx, "#E86A92");
    },
    // Bounces from one slime pad to the next
    shortcut(ctx) {
        for (const x of [-70, 0, 70]) {
            blobPath(ctx, x, 60, 52, 30);
            inked(ctx, "#8BE04E");
        }
        dottedArc(ctx, -70, 0, 28, 35);
        dottedArc(ctx, 0, 70, 28, 35);
    },
    // The lily pad with its flag
    goal(ctx) {
        ctx.beginPath();
        ctx.ellipse(-10, 40, 75, 24, 0, 0.35, Math.PI * 2 - 0.35);
        ctx.lineTo(-10, 40);
        ctx.closePath();
        inked(ctx, "#3FA34D");
        ctx.beginPath();
        ctx.arc(-50, 34, 9, 0, Math.PI * 2);
        inked(ctx, "#FF8FB1");
        ctx.beginPath();
        ctx.moveTo(30, 40);
        ctx.lineTo(30, -60);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(30, -60);
        ctx.lineTo(72, -45);
        ctx.lineTo(30, -30);
        ctx.closePath();
        inked(ctx, "#D9473B");
    },
    // Froggy sliding a little on a grass slab
    grass(ctx) {
        ctx.beginPath();
        ctx.rect(-90, 35, 180, 28);
        inked(ctx, "#6CBF4B");
        for (const x of [-70, -40, 60, 80]) {
            ctx.beginPath();
            ctx.moveTo(x - 6, 35);
            ctx.lineTo(x, 20);
            ctx.lineTo(x + 6, 35);
            ctx.stroke();
        }
        frog(ctx, 20, 10);
        for (const y of [4, 18]) {
            ctx.beginPath();
            ctx.moveTo(-40, y);
            ctx.lineTo(-12, y);
            ctx.stroke();
        }
    },
    // Soft soil with flowers
    flowerBed(ctx) {
        ctx.beginPath();
        ctx.rect(-90, 25, 180, 38);
        inked(ctx, "#7A4E2A");
        for (const [x, color] of [[-55, "#FF6F91"], [0, "#FFC75F"], [55, "#D65DB1"]]) {
            ctx.beginPath();
            ctx.moveTo(x, 25);
            ctx.lineTo(x, -10);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, -22, 14, 0, Math.PI * 2);
            inked(ctx, color);
        }
    },
    // Froggy's house
    home(ctx) {
        ctx.beginPath();
        ctx.rect(-55, -5, 110, 65);
        inked(ctx, "#F2E3C6");
        ctx.beginPath();
        ctx.moveTo(-75, -5);
        ctx.lineTo(0, -62);
        ctx.lineTo(75, -5);
        ctx.closePath();
        inked(ctx, "#C0392B");
        ctx.beginPath();
        ctx.rect(-14, 20, 28, 40);
        inked(ctx, "#7A5230");
    },
};

// Powerup signs show the fly's icon on its colour, as in the HUD
for (const type of Object.keys(POWERUPS)) {
    SIGN_ICONS[type] = (ctx) => {
        ctx.beginPath();
        ctx.arc(0, 0, 62, 0, Math.PI * 2);
        inked(ctx, POWERUPS[type].color);
        ctx.drawImage(powerupIconCanvas(type, 96), -48, -48);
    };
}

// One sign icon on its own transparent canvas (e.g. for the How to Play
// screen), `width` wide
export function signIconCanvas(icon, width = 200) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round(width * 0.8);
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale((width / 200) * 0.85, (width / 200) * 0.85); // drawings run a little past ±100
    ctx.lineWidth = 7;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    SIGN_ICONS[icon]?.(ctx);
    return canvas;
}

// Draw the sign: first line as a bold title, the rest wrapped below, and
// the `icon` drawing (a SIGN_ICONS key) at the bottom
function signTexture(text, icon) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 410;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#C8955C";
    ctx.fillRect(0, 0, 512, 410);
    ctx.fillStyle = "rgba(90, 55, 25, 0.25)"; // wood grain
    for (let y = 18; y < 410; y += 36) ctx.fillRect(0, y, 512, 3);
    ctx.strokeStyle = "#6D4C2F";
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, 498, 396);

    const [title, ...rest] = text.split("\n");
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = "bold 64px sans-serif";
    ctx.fillText(title, 256, 82);

    ctx.font = "40px sans-serif";
    const words = rest.join(" ").split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
        const attempt = line ? `${line} ${word}` : word;
        if (ctx.measureText(attempt).width > 450 && line) {
            lines.push(line);
            line = word;
        } else {
            line = attempt;
        }
    }
    if (line) lines.push(line);
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 256, 136 + i * 44));

    if (SIGN_ICONS[icon]) {
        ctx.save();
        ctx.translate(256, 300);
        ctx.lineWidth = 7;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = INK;
        SIGN_ICONS[icon](ctx);
        ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

// `text` is "TITLE\nexplanation…" and `icon` the drawing under it (see
// SIGN_ICONS); `facing` ([dx, dy]) is the direction the readable side faces
// (towards where the player approaches from)
function Signpost({ x, y, z, text, icon, facing = [0, -1] }) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.z = Math.atan2(facing[0], -facing[1]); // board faces `facing`

    group.add(box(3, 3, SIGN_BOTTOM + SIGN_HEIGHT - 2, "#7A5230", 0, 2.5)); // post behind the board
    group.add(box(SIGN_WIDTH, 2, SIGN_HEIGHT, "#9C6B3E", 0, 0, SIGN_BOTTOM));
    const board = new THREE.Mesh(
        new THREE.PlaneGeometry(SIGN_WIDTH - 1, SIGN_HEIGHT - 1),
        new THREE.MeshLambertMaterial({ map: signTexture(text, icon) })
    );
    board.rotation.x = Math.PI / 2; // stand upright, facing -y
    board.position.set(0, -1.05, SIGN_BOTTOM + SIGN_HEIGHT / 2);
    group.add(board);

    addBoxShape(footprint(group));
    return group;
}

// --- Arrow: a white arrow painted flat on a surface, showing the way ---

const arrowGeometry = (() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 12);
    shape.lineTo(9, 1);
    shape.lineTo(3.5, 1);
    shape.lineTo(3.5, -12);
    shape.lineTo(-3.5, -12);
    shape.lineTo(-3.5, 1);
    shape.lineTo(-9, 1);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
})();
const arrowMaterial = new THREE.MeshBasicMaterial({ color: "white", transparent: true, opacity: 0.85 });

// Points along `direction` ([dx, dy]); `dx`/`dy` shift it by tiles (0.5 =
// between tiles, e.g. the middle of a 2×2 pad). No collision.
function Arrow({ x, y, z, direction = [0, 1], dx = 0, dy = 0 }) {
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.set(x + dx * CELL_SIZE, y + dy * CELL_SIZE, z + 1.5);
    arrow.rotation.z = Math.atan2(-direction[0], direction[1]); // shape points +y
    return arrow;
}

// Constructors by the `type` used in level data
export const PROPS = {
    fence: PicketFence,
    mailbox: Mailbox,
    bin: Bin,
    flowerBed: FlowerBed,
    birdbath: Birdbath,
    sign: Signpost,
    arrow: Arrow,
};
