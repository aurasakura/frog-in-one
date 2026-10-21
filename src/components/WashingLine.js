import * as THREE from "three";
import { playWhoosh } from "../sound.js";

const POLE_HEIGHT = 66;
const LINE_HEIGHT = 60;
const GARMENT_GAP_MIN = 4; // space between garments on the line…
const GARMENT_GAP_MAX = 10; // …varied at random within this range
const PEG_COLOR = "#C49A6C";

const SWING_PERIOD = 3.2; // seconds for a full swing up one side and the other
const SWING_AMPLITUDE = 1.45; // radians at the top of the swing
const LIFTED_ANGLE = 1.0; // swung further than this = lifted, Froggy can pass under
const HIT_DEPTH = 8; // thickness of the hanging clothes' danger zone
const KNOCK_SPEED = 230; // speed Froggy is knocked in the clothes' swing direction
const KNOCK_UP = 150;
const HIT_COOLDOWN = 0.6;
const WHOOSH_DISTANCE = 400; // only whoosh when Froggy is this close

const FABRIC_COLORS = [
    "#E74C3C", "#F1C40F", "#3498DB", "#FFFFFF", "#9B59B6",
    "#2ECC71", "#FF8FB1", "#F39C12", "#1ABC9C", "#34495E",
];

// --- Garments ---
// Each is a flat outline hanging from its top edge at y = 0 (y negative
// downwards), `width` across and `length` long. Lengths matter for play:
// with the line at 60, anything longer than about 36 reaches Froggy when
// hanging straight; shorter things (shorts, socks) leave gaps he fits under.

function tShirt(shape) {
    shape.moveTo(-6, 0);
    shape.lineTo(-13, -2);
    shape.lineTo(-18, -9); // sleeve
    shape.lineTo(-14, -13);
    shape.lineTo(-10, -9); // armpit
    shape.lineTo(-10, -32); // hem
    shape.lineTo(10, -32);
    shape.lineTo(10, -9);
    shape.lineTo(14, -13);
    shape.lineTo(18, -9);
    shape.lineTo(13, -2);
    shape.lineTo(6, 0);
    shape.quadraticCurveTo(0, -5, -6, 0); // neckline
}

function trousers(shape) {
    shape.moveTo(-9, 0);
    shape.lineTo(9, 0);
    shape.lineTo(10, -42);
    shape.lineTo(2.5, -42);
    shape.lineTo(0, -14); // crotch
    shape.lineTo(-2.5, -42);
    shape.lineTo(-10, -42);
    shape.closePath();
}

function shorts(shape) {
    shape.moveTo(-9, 0);
    shape.lineTo(9, 0);
    shape.lineTo(11, -20);
    shape.lineTo(2, -20);
    shape.lineTo(0, -12);
    shape.lineTo(-2, -20);
    shape.lineTo(-11, -20);
    shape.closePath();
}

function dress(shape) {
    shape.moveTo(-7, 0);
    shape.lineTo(-4, 0);
    shape.quadraticCurveTo(0, -4, 4, 0); // neckline
    shape.lineTo(7, 0);
    shape.lineTo(8, -14); // waist
    shape.quadraticCurveTo(12, -30, 15, -46); // flared skirt
    shape.quadraticCurveTo(0, -43, -15, -46);
    shape.quadraticCurveTo(-12, -30, -8, -14);
    shape.closePath();
}

function towel(shape) {
    shape.moveTo(-11, 0);
    shape.lineTo(11, 0);
    shape.lineTo(11, -48);
    shape.lineTo(-11, -48);
    shape.closePath();
}

function sock(shape) {
    shape.moveTo(-3, 0);
    shape.lineTo(3, 0);
    shape.lineTo(3, -15);
    shape.lineTo(8, -17); // heel to toe
    shape.quadraticCurveTo(11, -21, 6, -23);
    shape.lineTo(-1, -23);
    shape.quadraticCurveTo(-3, -23, -3, -19);
    shape.closePath();
}

// kind → { draw, width, length, weight (how often it's picked), pegs, extra }
const GARMENTS = {
    tShirt: { draw: tShirt, width: 36, length: 32, weight: 3, pegs: [-9, 9] },
    trousers: { draw: trousers, width: 20, length: 42, weight: 2, pegs: [-7, 7] },
    shorts: { draw: shorts, width: 22, length: 20, weight: 1, pegs: [-7, 7] },
    dress: { draw: dress, width: 30, length: 46, weight: 2, pegs: [-5, 5], extra: "waistband" },
    towel: { draw: towel, width: 22, length: 48, weight: 3, pegs: [-9, 9], extra: "stripes" },
    socks: { draw: sock, width: 20, length: 23, weight: 1, pegs: [0], pair: true },
};

const geometries = new Map();
function garmentGeometry(kind) {
    if (!geometries.has(kind)) {
        const shape = new THREE.Shape();
        GARMENTS[kind].draw(shape);
        // Stand the outline in the line's vertical plane: shape y → world z
        geometries.set(kind, new THREE.ShapeGeometry(shape, 12).rotateX(Math.PI / 2));
    }
    return geometries.get(kind);
}

const materials = new Map();
function fabric(color) {
    if (!materials.has(color)) {
        materials.set(color, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
    }
    return materials.get(color);
}

const pegGeometry = new THREE.BoxGeometry(1.4, 1.8, 5);
const stripeGeometry = new THREE.PlaneGeometry(22, 3).rotateX(Math.PI / 2);
const bandGeometry = new THREE.PlaneGeometry(16, 2.2).rotateX(Math.PI / 2);

// Small seeded random numbers, so a line always gets the same laundry
function seededRandom(seed) {
    let state = Math.floor(Math.abs(seed)) % 2147483647 || 1;
    return () => {
        state = (state * 16807) % 2147483647;
        return (state - 1) / 2147483646;
    };
}

function pick(random, items, weightOf = () => 1) {
    const total = items.reduce((sum, item) => sum + weightOf(item), 0);
    let roll = random() * total;
    for (const item of items) {
        roll -= weightOf(item);
        if (roll <= 0) return item;
    }
    return items[items.length - 1];
}

// One garment (or pair of socks) on a pivot, built in the pivot's frame:
// the line runs along x, the garment hangs down -z, swinging around x
function Garment(kind, random) {
    const spec = GARMENTS[kind];
    const pivot = new THREE.Group();
    const color = pick(random, FABRIC_COLORS);
    const accent = pick(random, FABRIC_COLORS.filter((c) => c !== color));
    const offsets = spec.pair ? [-5, 5] : [0];

    for (const dx of offsets) {
        const piece = new THREE.Mesh(garmentGeometry(kind), fabric(color));
        piece.position.x = dx;
        pivot.add(piece);
        for (const peg of spec.pegs) {
            const clothespin = new THREE.Mesh(pegGeometry, fabric(PEG_COLOR));
            clothespin.position.set(dx + peg, 0, -1);
            pivot.add(clothespin);
        }
    }

    // A little detail in a second colour, on both faces of the fabric
    const details = spec.extra === "stripes"
        ? [[stripeGeometry, -8], [stripeGeometry, -40]]
        : spec.extra === "waistband"
            ? [[bandGeometry, -14]]
            : [];
    for (const [geometry, z] of details) {
        for (const face of [-0.05, 0.05]) {
            const detail = new THREE.Mesh(geometry, fabric(accent));
            detail.position.set(0, face, z);
            pivot.add(detail);
        }
    }

    return pivot;
}

// Washing line between two posts at (x, y) and (toX, toY). The clothes
// swing up and down: lifted, Froggy passes underneath; hanging straight,
// they knock him the way they're swinging. Each line hangs its own mix of
// laundry, chosen from its position, so lines differ but stay the same.
export function WashingLine({ x, y, z, toX, toY, offset = 0 }) {
    const dir = new THREE.Vector2(toX - x, toY - y);
    const length = dir.length();
    dir.normalize();

    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.z = Math.atan2(dir.y, dir.x); // local +x along the line

    const poleMaterial = new THREE.MeshLambertMaterial({ color: "#8E6E53" });
    for (const at of [0, length]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, POLE_HEIGHT, 8), poleMaterial);
        pole.rotation.x = Math.PI / 2;
        pole.position.set(at, 0, POLE_HEIGHT / 2);
        group.add(pole);
    }
    const line = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, length, 6),
        new THREE.MeshBasicMaterial({ color: "#EEEEEE" })
    );
    line.rotation.z = -Math.PI / 2; // cylinder axis from y to +x
    line.position.set(length / 2, 0, LINE_HEIGHT);
    group.add(line);

    // Fill the line with laundry: { pivot, from, to (along the line), length }
    const random = seededRandom(x * 73856093 + y * 19349663 + toX * 83492791 + toY);
    const kinds = Object.keys(GARMENTS);
    const garments = [];
    let along = 6 + random() * 6;
    while (true) {
        const kind = pick(random, kinds, (k) => GARMENTS[k].weight);
        const spec = GARMENTS[kind];
        if (along + spec.width > length - 6) break;

        const pivot = Garment(kind, random);
        pivot.position.set(along + spec.width / 2, 0, LINE_HEIGHT);
        pivot.rotation.z = (random() - 0.5) * 0.1; // hung slightly unevenly
        group.add(pivot);
        garments.push({ pivot, from: along, to: along + spec.width, length: spec.length });

        along += spec.width + GARMENT_GAP_MIN + random() * (GARMENT_GAP_MAX - GARMENT_GAP_MIN);
    }

    let time = offset;
    let angle = 0;
    let wasLifted = false;
    let cooldown = 0;

    const isLifted = () => Math.abs(angle) > LIFTED_ANGLE;

    return {
        object: group,

        update(delta, frog) {
            time += delta;
            cooldown = Math.max(0, cooldown - delta);
            angle = SWING_AMPLITUDE * Math.sin((2 * Math.PI * time) / SWING_PERIOD);
            for (const { pivot } of garments) pivot.rotation.x = angle;

            const lifted = isLifted();
            if (lifted && !wasLifted && frog) {
                const distance = Math.hypot(frog.position.x - (x + toX) / 2, frog.position.y - (y + toY) / 2);
                if (distance < WHOOSH_DISTANCE) playWhoosh();
            }
            wasLifted = lifted;
        },

        // Hanging clothes knock Froggy along with their swing. Each garment
        // is checked on its own: where it hangs and how far down it reaches.
        collide(frog) {
            if (cooldown > 0 || isLifted()) return null;

            const rx = frog.position.x - x;
            const ry = frog.position.y - y;
            const alongLine = rx * dir.x + ry * dir.y;
            const across = rx * -dir.y + ry * dir.x; // signed: which side of the line
            const feet = frog.position.z - z;
            if (feet > LINE_HEIGHT) return null; // above the line

            const hit = garments.some((garment) => {
                if (alongLine < garment.from - frog.radius || alongLine > garment.to + frog.radius) return false;
                const reach = garment.length * Math.abs(Math.sin(angle));
                if (Math.abs(across) > HIT_DEPTH + reach + frog.radius) return false;
                const bottom = LINE_HEIGHT - garment.length * Math.cos(angle);
                return feet + frog.height >= bottom;
            });
            if (!hit) return null;

            // Push him the way the clothes are swinging right now. With the
            // cloth bottom at L·sin(angle) across the line, it moves with
            // the sign of the swing's rate of change, d(angle)/dt ∝ cos(phase).
            const swingDirection = Math.sign(Math.cos((2 * Math.PI * time) / SWING_PERIOD));
            const side = swingDirection || Math.sign(across) || 1;
            frog.velocity.x = -dir.y * side * KNOCK_SPEED;
            frog.velocity.y = dir.x * side * KNOCK_SPEED;
            frog.velocity.z = KNOCK_UP;
            cooldown = HIT_COOLDOWN;
            return "knocked";
        },
    };
}
