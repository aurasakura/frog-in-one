import * as THREE from "three";

// Small visual effects: Froggy's hop shadow, landing dust, fly-eating
// sparkles and celebration confetti. Each is a singleton with `object`
// (add it to the scene) and `update(delta)`.

const SHADOW_SIZE = 30; // diameter on the ground
const SHADOW_OPACITY = 0.35;
const SHADOW_FADE_HEIGHT = 220; // fully faded this far above the ground
const SHADOW_FADE_SPEED = 8; // how quickly it fades in/out

const DUST_COUNT = 8;
const DUST_TIME = 0.5;
const SPARKLE_COUNT = 12;
const SPARKLE_TIME = 0.6;
const CONFETTI_COUNT = 90;
const CONFETTI_TIME = 2.6;
const CONFETTI_GRAVITY = 260;
const CONFETTI_COLORS = ["#FF6F91", "#FFC75F", "#F9F871", "#00C9A7", "#4D8DFF", "#C34A36", "#FFFFFF"];

function canvasTexture(size, draw) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    draw(canvas.getContext("2d"), size);
    return new THREE.CanvasTexture(canvas);
}

// Soft round blob, white in the middle fading to transparent
const softDot = canvasTexture(64, (ctx, s) => {
    const gradient = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.6)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, s, s);
});

// Four-pointed star
const starTexture = canvasTexture(64, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.moveTo(c, 2);
    ctx.quadraticCurveTo(c, c, s - 2, c);
    ctx.quadraticCurveTo(c, c, c, s - 2);
    ctx.quadraticCurveTo(c, c, 2, c);
    ctx.quadraticCurveTo(c, c, c, 2);
    ctx.fill();
});

// --- Hop shadow ---

function FrogShadow() {
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
            map: softDot,
            color: "black",
            transparent: true,
            opacity: 0,
            depthWrite: false,
        })
    );
    mesh.visible = false;
    let opacity = 0;

    return {
        object: mesh,

        // `groundZ` is the surface under Froggy (null over open water);
        // the shadow only shows while he's `airborne`
        update(delta, position, groundZ, airborne) {
            const height = groundZ === null ? Infinity : position.z - groundZ;
            const target = airborne && height < SHADOW_FADE_HEIGHT
                ? SHADOW_OPACITY * (1 - height / SHADOW_FADE_HEIGHT)
                : 0;
            opacity += (target - opacity) * Math.min(1, SHADOW_FADE_SPEED * delta);
            mesh.visible = opacity > 0.01 && groundZ !== null;
            if (!mesh.visible) return;

            mesh.position.set(position.x, position.y, groundZ + 0.4);
            mesh.scale.setScalar(SHADOW_SIZE * (1 - Math.min(height, SHADOW_FADE_HEIGHT) / (SHADOW_FADE_HEIGHT * 2)));
            mesh.material.opacity = opacity;
        },
    };
}

// --- Bursts of sprites (dust, sparkles) ---

function SpriteBurst({ count, time, texture, size, speed, rise, gravity = 0, additive = false }) {
    const group = new THREE.Group();
    const sprites = [];
    for (let i = 0; i < count; i++) {
        const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthWrite: false,
                blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
            })
        );
        sprite.visible = false;
        group.add(sprite);
        sprites.push({ sprite, velocity: new THREE.Vector3(), age: time });
    }

    return {
        object: group,

        play(x, y, z, color) {
            for (const p of sprites) {
                const angle = Math.random() * Math.PI * 2;
                const spread = speed * (0.5 + Math.random() * 0.5);
                p.velocity.set(Math.cos(angle) * spread, Math.sin(angle) * spread, rise * (0.5 + Math.random()));
                p.sprite.position.set(x, y, z);
                p.sprite.material.color.set(color);
                p.sprite.material.rotation = Math.random() * Math.PI;
                p.sprite.visible = true;
                p.age = 0;
            }
        },

        update(delta) {
            for (const p of sprites) {
                if (p.age >= time) continue;
                p.age += delta;
                const progress = Math.min(1, p.age / time);
                p.velocity.z -= gravity * delta;
                p.velocity.multiplyScalar(1 - Math.min(1, 3 * delta)); // air drag
                p.sprite.position.addScaledVector(p.velocity, delta);
                p.sprite.scale.setScalar(size * (0.6 + progress));
                p.sprite.material.opacity = 1 - progress;
                p.sprite.material.rotation += delta * 2;
                if (progress >= 1) p.sprite.visible = false;
            }
        },
    };
}

// Puff of dust where Froggy lands
export const dust = SpriteBurst({ count: DUST_COUNT, time: DUST_TIME, texture: softDot, size: 10, speed: 60, rise: 25 });

// Sparkles when Froggy eats a fly
export const sparkles = SpriteBurst({
    count: SPARKLE_COUNT,
    time: SPARKLE_TIME,
    texture: starTexture,
    size: 7,
    speed: 70,
    rise: 70,
    gravity: 120,
    additive: true,
});

// --- Confetti ---

function Confetti() {
    const mesh = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(3, 5),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
        CONFETTI_COUNT
    );
    mesh.frustumCulled = false; // pieces move every frame
    mesh.visible = false;

    const color = new THREE.Color();
    const pieces = Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        mesh.setColorAt(i, color.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]));
        return {
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            spin: new THREE.Vector3(),
        };
    });

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    let age = CONFETTI_TIME;

    return {
        object: mesh,

        play(x, y, z) {
            age = 0;
            mesh.visible = true;
            for (const p of pieces) {
                const angle = Math.random() * Math.PI * 2;
                const out = 40 + Math.random() * 90;
                p.position.set(x, y, z + 10);
                p.velocity.set(Math.cos(angle) * out, Math.sin(angle) * out, 180 + Math.random() * 160);
                p.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
                p.spin.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
            }
        },

        update(delta) {
            if (!mesh.visible) return;
            age += delta;
            if (age >= CONFETTI_TIME) {
                mesh.visible = false;
                return;
            }
            const shrink = Math.min(1, (CONFETTI_TIME - age) / 0.5); // shrink away at the end
            scale.setScalar(shrink);
            pieces.forEach((p, i) => {
                p.velocity.z -= CONFETTI_GRAVITY * delta;
                p.velocity.x *= 1 - Math.min(1, 1.5 * delta); // flutter: drag sideways…
                p.velocity.y *= 1 - Math.min(1, 1.5 * delta);
                p.velocity.z = Math.max(p.velocity.z, -60); // …and fall slowly
                p.position.addScaledVector(p.velocity, delta);
                p.rotation.x += p.spin.x * delta;
                p.rotation.y += p.spin.y * delta;
                p.rotation.z += p.spin.z * delta;
                matrix.compose(p.position, quaternion.setFromEuler(p.rotation), scale);
                mesh.setMatrixAt(i, matrix);
            });
            mesh.instanceMatrix.needsUpdate = true;
        },
    };
}

export const confetti = Confetti();
export const frogShadow = FrogShadow();
