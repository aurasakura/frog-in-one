import * as THREE from "three";
import { playHoseDrip, playHoseSwoosh, nearness } from "../sound.js";

// Timing of one cycle: off → warning (drips) → on (stream) → off …
const OFF_TIME = 2.2; // seconds
const WARNING_TIME = 0.8;
const ON_TIME = 1.4;
const CYCLE_TIME = OFF_TIME + WARNING_TIME + ON_TIME;

const STREAM_HEIGHT = 10; // stream height above the ground
const STREAM_RADIUS = 5;
const STREAM_SPEED = 500; // how fast the stream's front shoots out
const KNOCK_SPEED = 260; // sideways speed given to Froggy, along the stream
const KNOCK_UP = 170; // ...and upward speed
const HIT_COOLDOWN = 0.6; // seconds before the same jet can hit again
const SOUND_RANGE = 500; // heard from this far away

const STREAM_DROPLETS = 40;
const DRIP_COUNT = 4;
const DRIP_GRAVITY = 300;

// Garden hose nozzle shooting a straight stream along `direction` ([dx, dy])
// for `length` world units, on a timer. `offset` shifts its cycle (seconds).
export function HoseJet({ x, y, z, direction = [1, 0], length = 200, offset = 0 }) {
    const dir = new THREE.Vector2(direction[0], direction[1]).normalize();
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.z = Math.atan2(dir.y, dir.x); // local +x along the stream

    // Hose reel and brass nozzle
    const reel = new THREE.Mesh(
        new THREE.TorusGeometry(8, 3, 8, 20),
        new THREE.MeshLambertMaterial({ color: "#27AE60" })
    );
    reel.position.set(-12, 0, 11);
    reel.rotation.x = Math.PI / 2;
    group.add(reel);
    const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 3.5, 10, 12),
        new THREE.MeshLambertMaterial({ color: "#B7950B" })
    );
    nozzle.rotation.z = -Math.PI / 2; // cylinder axis from y to +x
    nozzle.position.set(0, 0, STREAM_HEIGHT);
    group.add(nozzle);

    // Stream: a translucent tube that grows outwards, plus droplets
    const stream = new THREE.Mesh(
        new THREE.CylinderGeometry(STREAM_RADIUS * 0.6, STREAM_RADIUS * 0.6, 1, 10).rotateZ(-Math.PI / 2).translate(0.5, 0, 0),
        new THREE.MeshPhongMaterial({ color: "#AEDFF7", transparent: true, opacity: 0.55, shininess: 100 })
    );
    stream.position.set(5, 0, STREAM_HEIGHT);
    group.add(stream);

    const droplets = new THREE.InstancedMesh(
        new THREE.SphereGeometry(1.8, 6, 4),
        new THREE.MeshBasicMaterial({ color: "#D6F1FF" }),
        STREAM_DROPLETS + DRIP_COUNT
    );
    droplets.frustumCulled = false; // instances move every frame
    group.add(droplets);

    const matrix = new THREE.Matrix4();
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    let time = offset;
    let cooldown = 0;
    let reach = 0; // how far the stream currently extends
    let lastPhase = null;

    function phase() {
        const t = ((time % CYCLE_TIME) + CYCLE_TIME) % CYCLE_TIME;
        if (t < OFF_TIME) return { name: "off", t };
        if (t < OFF_TIME + WARNING_TIME) return { name: "warning", t: t - OFF_TIME };
        return { name: "on", t: t - OFF_TIME - WARNING_TIME };
    }

    return {
        object: group,

        update(delta, frog) {
            time += delta;
            cooldown = Math.max(0, cooldown - delta);
            const { name, t } = phase();

            // A drip as it warns, a swoosh as it fires (quieter further away)
            if (name !== lastPhase && lastPhase !== null && frog) {
                const loudness = nearness(Math.hypot(frog.position.x - x, frog.position.y - y), SOUND_RANGE);
                if (name === "warning") playHoseDrip(loudness);
                if (name === "on") playHoseSwoosh(loudness);
            }
            lastPhase = name;

            reach = name === "on" ? Math.min(length, STREAM_SPEED * t) : 0;
            stream.visible = reach > 0;
            stream.scale.x = Math.max(reach, 0.001);

            // Stream droplets travel along the jet and wobble a little
            for (let i = 0; i < STREAM_DROPLETS; i++) {
                if (reach <= 0) {
                    droplets.setMatrixAt(i, hidden);
                    continue;
                }
                const along = ((i / STREAM_DROPLETS) * length + time * STREAM_SPEED * 0.6) % length;
                if (along > reach) {
                    droplets.setMatrixAt(i, hidden);
                    continue;
                }
                matrix.makeTranslation(
                    5 + along,
                    Math.sin(i * 7.3 + time * 20) * 1.5,
                    STREAM_HEIGHT + Math.cos(i * 3.1 + time * 17) * 1.5
                );
                droplets.setMatrixAt(i, matrix);
            }

            // Warning: drips fall from the nozzle and it shakes
            for (let i = 0; i < DRIP_COUNT; i++) {
                if (name !== "warning") {
                    droplets.setMatrixAt(STREAM_DROPLETS + i, hidden);
                    continue;
                }
                const dripAge = (t + i * 0.2) % 0.4;
                matrix.makeTranslation(5, 0, STREAM_HEIGHT - 0.5 * DRIP_GRAVITY * dripAge * dripAge);
                droplets.setMatrixAt(STREAM_DROPLETS + i, matrix);
            }
            nozzle.position.y = name === "warning" ? Math.sin(time * 60) * 0.6 : 0;
            droplets.instanceMatrix.needsUpdate = true;
        },

        // A hit knocks Froggy along the stream (sideways across his path),
        // in the air or on the ground
        collide(frog) {
            if (reach <= 0 || cooldown > 0) return null;

            const rx = frog.position.x - x;
            const ry = frog.position.y - y;
            const along = rx * dir.x + ry * dir.y;
            if (along < 0 || along > reach) return null;
            const across = Math.abs(rx * dir.y - ry * dir.x);
            if (across > STREAM_RADIUS + frog.radius) return null;

            const feet = frog.position.z - z;
            if (feet > STREAM_HEIGHT + STREAM_RADIUS) return null;
            if (feet + frog.height < STREAM_HEIGHT - STREAM_RADIUS) return null;

            frog.velocity.x = dir.x * KNOCK_SPEED;
            frog.velocity.y = dir.y * KNOCK_SPEED;
            frog.velocity.z = KNOCK_UP;
            cooldown = HIT_COOLDOWN;
            return "knocked";
        },
    };
}
