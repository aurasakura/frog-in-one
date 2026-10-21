import * as THREE from "three";
import { POWERUPS, powerupIconCanvas } from "../powerups.js";

const OUTLINE_SCALE = 1.14; // dark hull drawn slightly larger, behind each part
const OUTLINE_COLOR = "#1A1A1A";
const GLOW_SIZE = 46;
const ICON_SIZE = 16;
const ICON_HEIGHT = 20; // above the fly's centre
const COLLECT_RADIUS = 12; // forgiving pick-up range
const WING_FLAP_SPEED = 38; // radians per second
const WING_FLAP_ANGLE = 0.45; // radians either side of the rest angle
const WING_REST_ANGLE = 0.6; // wings held up in a V, so they show from above

// Movement patterns (offsets from the fly's home position)
const BOUNCE_HEIGHT = 18;
const BOUNCE_SPEED = 3; // radians per second
const DRIFT_RADIUS = 30;
const DRIFT_SPEED = 0.5;
const DART_RADIUS = 45;
const DART_INTERVAL = 0.9; // seconds between darts
const DART_SNAP = 12; // how quickly it reaches each new spot

const GULP_TIME = 0.25; // seconds to fly into Froggy's mouth
const MOUTH_HEIGHT = 12;
const TRAIL_LENGTH = 8; // Super Leap sparkle trail
const TRAIL_SPACING = 0.04; // seconds between trail samples

// --- Fly model: a round cartoon fly built from simple shapes ---
// Built in the z-up world, centred on its origin, facing -y. About 12 long.

const sphere = new THREE.SphereGeometry(1, 24, 16);
const stripe = new THREE.TorusGeometry(1, 0.16, 8, 32);
const antennaStalk = new THREE.CylinderGeometry(0.15, 0.15, 1, 6); // stretched to length
const wingShape = new THREE.CircleGeometry(1, 24);
const outlineMaterial = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
const darkMaterial = new THREE.MeshStandardMaterial({ color: "#2B2B33", roughness: 0.45 });
const eyeMaterial = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.15 });
const pupilMaterial = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.1 });
const wingMaterial = new THREE.MeshStandardMaterial({
    color: "#E8F6FF",
    roughness: 0.2,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
});

function part(geometry, material, position, scale, outlined = true) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.scale.copy(scale);
    if (!outlined) return [mesh];
    // Inverted hull: the same shape a bit larger, back faces only, in dark
    const outline = new THREE.Mesh(geometry, outlineMaterial);
    outline.position.copy(position);
    outline.scale.copy(scale).multiplyScalar(OUTLINE_SCALE);
    return [outline, mesh];
}

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Returns the model and its two wing pivots (for flapping)
function FlyModel(color) {
    const fly = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.15 });

    // Round abdomen in the powerup's colour, with two dark stripes
    fly.add(...part(sphere, bodyMaterial, v(0, 2, 0), v(3.2, 4, 3)));
    for (const [y, r] of [[1.3, 3.05], [3.0, 2.6]]) {
        const ring = new THREE.Mesh(stripe, darkMaterial);
        ring.position.set(0, y, 0);
        ring.rotation.x = Math.PI / 2;
        ring.scale.set(r, r * 0.95, r);
        fly.add(ring);
    }

    // Dark thorax and head
    fly.add(...part(sphere, darkMaterial, v(0, -1.6, 0.4), v(2.4, 2.2, 2.3)));
    fly.add(...part(sphere, darkMaterial, v(0, -3.9, 0.8), v(2.1, 2, 2)));

    // Big cartoon eyes looking forward
    for (const side of [-1, 1]) {
        fly.add(...part(sphere, eyeMaterial, v(side * 1.2, -5.2, 1.5), v(1.35, 1.35, 1.35)));
        fly.add(...part(sphere, pupilMaterial, v(side * 1.3, -6.25, 1.6), v(0.6, 0.6, 0.6), false));

        // Antennae: a stalk from the top of the head to a round tip in the
        // powerup colour
        const base = v(side * 0.7, -4.2, 2.5);
        const tip = v(side * 1.5, -5.4, 5.2);
        const stalk = new THREE.Mesh(antennaStalk, darkMaterial);
        stalk.position.copy(base).lerp(tip, 0.5);
        stalk.scale.y = base.distanceTo(tip);
        stalk.quaternion.setFromUnitVectors(v(0, 1, 0), tip.clone().sub(base).normalize());
        fly.add(stalk);
        fly.add(...part(sphere, bodyMaterial, tip, v(0.55, 0.55, 0.55), false));
    }

    // Wings: see-through ovals on pivots at the top of the thorax
    const wings = [];
    for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 1, -1.2, 2.2);
        const wing = new THREE.Mesh(wingShape, wingMaterial);
        wing.scale.set(2.2, 4.2, 1);
        wing.position.set(side * 2.4, 1.8, 0);
        wing.rotation.z = side * -0.35;
        pivot.add(wing);
        pivot.userData.side = side;
        fly.add(pivot);
        wings.push(pivot);
    }

    return { model: fly, wings };
}

let glowTexture = null;

function glowSprite(color, size) {
    if (!glowTexture) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 64;
        const ctx = canvas.getContext("2d");
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
        gradient.addColorStop(0.4, "rgba(255, 255, 255, 0.35)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        glowTexture = new THREE.CanvasTexture(canvas);
    }
    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: glowTexture,
            color,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
        })
    );
    sprite.scale.setScalar(size);
    return sprite;
}

function iconSprite(type) {
    const texture = new THREE.CanvasTexture(powerupIconCanvas(type, 64));
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    sprite.scale.setScalar(ICON_SIZE);
    sprite.position.z = ICON_HEIGHT;
    return sprite;
}

// A powerup fly hovering at (x, y, z). `pattern` is "bouncing", "drifting"
// or "darting" (defaults to the powerup's own pattern).
export function Fly({ type, x, y, z, pattern = POWERUPS[type].pattern }) {
    const color = new THREE.Color(POWERUPS[type].color);

    const group = new THREE.Group(); // home position
    group.position.set(x, y, z);
    const body = new THREE.Group(); // moves in the pattern
    group.add(body);

    body.add(glowSprite(color, GLOW_SIZE));
    body.add(iconSprite(type));
    const { model, wings } = FlyModel(color);
    body.add(model);

    // Super Leap leaves a short sparkle trail
    const trail = [];
    if (type === "superLeap") {
        for (let i = 0; i < TRAIL_LENGTH; i++) {
            const spark = glowSprite(new THREE.Color("#FFE08A"), 8 * (1 - i / TRAIL_LENGTH));
            spark.visible = false;
            group.add(spark);
            trail.push(spark);
        }
    }

    let time = Math.random() * 10; // so flies of the same kind don't move in sync
    let dartTimer = 0;
    const dartTarget = new THREE.Vector3();
    let trailTimer = 0;
    const trailHistory = [];

    let gulpTime = -1; // < 0 while not being eaten
    let gulpTarget = null;
    const gulpStart = new THREE.Vector3();
    const previousOffset = new THREE.Vector3();

    function moveInPattern(delta) {
        const offset = body.position;
        previousOffset.copy(offset);

        if (pattern === "bouncing") {
            offset.set(0, 0, Math.abs(Math.sin(time * BOUNCE_SPEED)) * BOUNCE_HEIGHT);
        } else if (pattern === "drifting") {
            offset.set(
                Math.cos(time * DRIFT_SPEED) * DRIFT_RADIUS,
                Math.sin(time * DRIFT_SPEED * 0.7) * DRIFT_RADIUS,
                Math.sin(time * 0.9) * 5
            );
        } else if (pattern === "darting") {
            dartTimer -= delta;
            if (dartTimer <= 0) {
                dartTimer = DART_INTERVAL;
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * DART_RADIUS;
                dartTarget.set(Math.cos(angle) * distance, Math.sin(angle) * distance, (Math.random() - 0.5) * 16);
            }
            offset.lerp(dartTarget, 1 - Math.exp(-DART_SNAP * delta));
        }

        // Face the way it's moving (the model starts facing -y)
        const dx = offset.x - previousOffset.x;
        const dy = offset.y - previousOffset.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.01) body.rotation.z = Math.atan2(dx, -dy);
    }

    function updateTrail(delta) {
        if (trail.length === 0) return;
        trailTimer -= delta;
        if (trailTimer <= 0) {
            trailTimer = TRAIL_SPACING;
            trailHistory.unshift(body.position.clone());
            trailHistory.length = Math.min(trailHistory.length, TRAIL_LENGTH);
        }
        trail.forEach((spark, i) => {
            const point = trailHistory[i];
            spark.visible = Boolean(point) && gulpTime < 0;
            if (point) spark.position.copy(point);
        });
    }

    return {
        object: group,
        type,
        collected: false,

        get radius() {
            return COLLECT_RADIUS;
        },

        // World position of the fly's centre
        getCenter(target) {
            return target.copy(group.position).add(body.position);
        },

        // Fly into Froggy's mouth; `target` is his (live) position vector
        gulp(target) {
            this.collected = true;
            gulpTime = 0;
            gulpTarget = target;
            gulpStart.copy(body.position);
        },

        update(delta) {
            time += delta;

            // Flap: each wing swings up and down around the body's long axis
            const flap = Math.sin(time * WING_FLAP_SPEED) * WING_FLAP_ANGLE;
            for (const wing of wings) wing.rotation.y = -wing.userData.side * (WING_REST_ANGLE + flap);

            if (gulpTime >= 0) {
                if (!group.visible) return;
                gulpTime += delta;
                const progress = Math.min(1, gulpTime / GULP_TIME);
                const mouth = new THREE.Vector3(gulpTarget.x, gulpTarget.y, gulpTarget.z + MOUTH_HEIGHT).sub(
                    group.position
                );
                body.position.lerpVectors(gulpStart, mouth, progress * progress);
                body.scale.setScalar(1 - progress);
                if (progress >= 1) group.visible = false;
                updateTrail(delta);
                return;
            }

            moveInPattern(delta);
            updateTrail(delta);
        },
    };
}
