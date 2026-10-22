import * as THREE from "three";
import { playSprinklerTick, playSprinklerSpritz, nearness } from "../sound.js";

const SPIN_SPEED = 1.2; // radians per second
const SPRAY_WIDTH = THREE.MathUtils.degToRad(50); // angle of the spray sector
const SPRAY_RADIUS = 170; // how far the wind reaches
const SPRAY_TOP = 140; // ...and how high above the sprinkler
const WIND_ACCEL = 520; // push on Froggy while he's in the spray (units/s²)
const TICK_INTERVAL = 0.22; // seconds between the "tch" ticks as it turns
const TICK_RANGE = 380; // ticks are heard from this far away
const SPRITZ_COOLDOWN = 0.6; // seconds between spritzes while he's in the spray

const NOZZLE_HEIGHT = 14;
const DROPLET_COUNT = 70;
const DROPLET_SPEED = 220;
const DROPLET_ANGLE = THREE.MathUtils.degToRad(35); // upward launch angle
const DROPLET_GRAVITY = 300;
const DROPLET_LIFE = (2 * DROPLET_SPEED * Math.sin(DROPLET_ANGLE)) / DROPLET_GRAVITY;

// Wrap an angle into -π..π
function wrapAngle(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

// Rotating garden sprinkler. While Froggy is in the air inside its spray
// sector, wind pushes him away from it.
export function Sprinkler({ x, y, z, startAngle = 0 }) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(9, 11, 4, 20),
        new THREE.MeshLambertMaterial({ color: "#5D6D7E" })
    );
    base.rotation.x = Math.PI / 2;
    base.position.z = 2;
    group.add(base);

    const head = new THREE.Group();
    head.position.z = 4;
    group.add(head);
    const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(3, 3, NOZZLE_HEIGHT - 4, 12),
        new THREE.MeshLambertMaterial({ color: "#F4D03F" })
    );
    stem.rotation.x = Math.PI / 2;
    stem.position.z = (NOZZLE_HEIGHT - 4) / 2;
    head.add(stem);
    const nozzle = new THREE.Mesh(
        new THREE.BoxGeometry(10, 4, 4),
        new THREE.MeshLambertMaterial({ color: "#E67E22" })
    );
    nozzle.position.set(5, 0, NOZZLE_HEIGHT - 4);
    head.add(nozzle);

    const droplets = new THREE.InstancedMesh(
        new THREE.SphereGeometry(1.6, 6, 4),
        new THREE.MeshBasicMaterial({ color: "#BFE6FF", transparent: true, opacity: 0.85 }),
        DROPLET_COUNT
    );
    droplets.frustumCulled = false; // instances move every frame
    group.add(droplets);

    // Each droplet: its angle when it left the nozzle, and its age
    const particles = Array.from({ length: DROPLET_COUNT }, (_, i) => ({
        angle: startAngle,
        age: (i / DROPLET_COUNT) * DROPLET_LIFE, // staggered so the spray starts full
    }));

    let sprayAngle = startAngle;
    let tickTimer = Math.random() * TICK_INTERVAL; // so sprinklers don't tick in step
    let spritzCooldown = 0;
    const matrix = new THREE.Matrix4();

    return {
        object: group,

        update(delta, frog) {
            sprayAngle = wrapAngle(sprayAngle + SPIN_SPEED * delta);
            spritzCooldown = Math.max(0, spritzCooldown - delta);
            tickTimer -= delta;
            if (tickTimer <= 0) {
                tickTimer += TICK_INTERVAL;
                if (frog) playSprinklerTick(nearness(Math.hypot(frog.position.x - x, frog.position.y - y), TICK_RANGE));
            }
            head.rotation.z = sprayAngle;

            const groundSpeed = DROPLET_SPEED * Math.cos(DROPLET_ANGLE);
            const upSpeed = DROPLET_SPEED * Math.sin(DROPLET_ANGLE);
            particles.forEach((p, i) => {
                p.age += delta;
                if (p.age > DROPLET_LIFE) {
                    p.age -= DROPLET_LIFE;
                    p.angle = sprayAngle + (Math.random() - 0.5) * SPRAY_WIDTH;
                }
                const distance = groundSpeed * p.age;
                matrix.makeTranslation(
                    Math.cos(p.angle) * distance,
                    Math.sin(p.angle) * distance,
                    NOZZLE_HEIGHT + upSpeed * p.age - 0.5 * DROPLET_GRAVITY * p.age * p.age
                );
                droplets.setMatrixAt(i, matrix);
            });
            droplets.instanceMatrix.needsUpdate = true;
        },

        // Wind only affects Froggy while he's in the air inside the spray
        collide(frog, delta) {
            if (!frog.airborne) return null;
            const dx = frog.position.x - x;
            const dy = frog.position.y - y;
            const distance = Math.hypot(dx, dy);
            if (distance < 1 || distance > SPRAY_RADIUS) return null;
            if (frog.position.z - z > SPRAY_TOP) return null;
            if (Math.abs(wrapAngle(Math.atan2(dy, dx) - sprayAngle)) > SPRAY_WIDTH / 2) return null;

            frog.velocity.x += (dx / distance) * WIND_ACCEL * delta;
            frog.velocity.y += (dy / distance) * WIND_ACCEL * delta;
            if (spritzCooldown <= 0) {
                spritzCooldown = SPRITZ_COOLDOWN;
                playSprinklerSpritz();
            }
            return "pushed";
        },
    };
}
