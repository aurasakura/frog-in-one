import * as THREE from "three";
import { CELL_SIZE } from "./Terrace.js";

export const LILY_PAD_HEIGHT = 1.5;
const PAD_RADIUS = 14;
const NOTCH_ANGLE = 0.6; // radians cut out of the pad
const BOB_HEIGHT = 0.4; // the pad bobs gently on the water
const BOB_SPEED = 2;

// The pool the pad floats in fills its whole tile (landing anywhere in it
// counts as reaching the pad), with a pale stone rim
const POOL_SIZE = CELL_SIZE - 2;
const RIM_WIDTH = 2.5;

// Golf flag on the pool's corner, visible from across the level
const POLE_HEIGHT = 64;
const POLE_OFFSET = CELL_SIZE / 2 - 4; // from the pad's centre, towards one corner
const FLAG_WIDTH = 20;
const FLAG_HEIGHT = 13;
const FLAG_FLUTTER_SPEED = 6; // radians per second
const FLAG_FLUTTER = 0.14; // how far the pennant ripples, per unit along it

function roundedSquare(size, radius) {
    const h = size / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-h + radius, -h);
    shape.lineTo(h - radius, -h);
    shape.quadraticCurveTo(h, -h, h, -h + radius);
    shape.lineTo(h, h - radius);
    shape.quadraticCurveTo(h, h, h - radius, h);
    shape.lineTo(-h + radius, h);
    shape.quadraticCurveTo(-h, h, -h, h - radius);
    shape.lineTo(-h, -h + radius);
    shape.quadraticCurveTo(-h, -h, -h + radius, -h);
    return shape;
}

// The goal: a notched lily pad with a pink flower, floating in a little
// pool on its tile, with a golf flag beside it. `onWater` (the tile is
// already pond water) skips the pool's stone rim; `withFlag: false` leaves
// out the flag, and `withPool: false` the square of pool water under the
// pad; `padScale` makes the pad and flower bigger.
export function LilyPad({ onWater = false, withFlag = true, withPool = true, padScale = 1 } = {}) {
    const group = new THREE.Group();

    // Pool: water filling the tile, inside a stone rim
    if (!onWater) {
        const rimShape = roundedSquare(POOL_SIZE, 6);
        rimShape.holes.push(roundedSquare(POOL_SIZE - RIM_WIDTH * 2, 4));
        const rim = new THREE.Mesh(
            new THREE.ExtrudeGeometry(rimShape, { depth: 1.2, bevelEnabled: false }),
            new THREE.MeshLambertMaterial({ color: "#D9D2C3" })
        );
        rim.position.z = 0.1;
        rim.receiveShadow = true;
        group.add(rim);
    }
    const water = new THREE.Mesh(
        new THREE.ShapeGeometry(roundedSquare(POOL_SIZE - RIM_WIDTH * 2, 4)),
        new THREE.MeshPhongMaterial({ color: "#3A8FD0", shininess: 140, specular: "#FFFFFF" })
    );
    water.position.z = 0.3;
    if (withPool) group.add(water);

    // Pad and flower, bobbing together
    const floating = new THREE.Group();
    floating.scale.set(padScale, padScale, 1);
    group.add(floating);
    const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(
            PAD_RADIUS,
            PAD_RADIUS,
            LILY_PAD_HEIGHT,
            32,
            1,
            false,
            NOTCH_ANGLE / 2,
            Math.PI * 2 - NOTCH_ANGLE
        ),
        new THREE.MeshLambertMaterial({ color: "#3FA34D" })
    );
    pad.rotation.x = Math.PI / 2; // cylinder axis from y to z (up)
    pad.position.z = LILY_PAD_HEIGHT / 2;
    pad.receiveShadow = true;
    floating.add(pad);

    const flower = new THREE.Mesh(
        new THREE.SphereGeometry(3, 12, 8),
        new THREE.MeshLambertMaterial({ color: "#FF8FB1" })
    );
    flower.position.set(-PAD_RADIUS * 0.5, PAD_RADIUS * 0.4, LILY_PAD_HEIGHT + 2);
    floating.add(flower);

    // Golf flag: white pole with a gold ball on top and a red pennant
    const flag = new THREE.Group();
    flag.position.set(POLE_OFFSET, POLE_OFFSET, 0);
    if (withFlag) group.add(flag);
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.7, POLE_HEIGHT, 8),
        new THREE.MeshLambertMaterial({ color: "#FAFAFA" })
    );
    pole.rotation.x = Math.PI / 2;
    pole.position.z = POLE_HEIGHT / 2;
    pole.castShadow = true;
    flag.add(pole);
    const ball = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 12, 8),
        new THREE.MeshStandardMaterial({ color: "#F2C14E", roughness: 0.3, metalness: 0.4 })
    );
    ball.position.z = POLE_HEIGHT + 1;
    flag.add(ball);

    // Pennant: a plane tapered into a triangle, standing upright; its
    // vertices ripple each frame
    const pennantGeometry = new THREE.PlaneGeometry(FLAG_WIDTH, FLAG_HEIGHT, 10, 1)
        .translate(FLAG_WIDTH / 2, 0, 0)
        .rotateX(Math.PI / 2); // stand upright in the x–z plane
    const positions = pennantGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const along = positions.getX(i) / FLAG_WIDTH; // 0 at the pole, 1 at the tip
        positions.setZ(i, positions.getZ(i) * (1 - along)); // taper to a point
    }
    const restX = Array.from({ length: positions.count }, (_, i) => positions.getX(i));
    const pennant = new THREE.Mesh(
        pennantGeometry,
        new THREE.MeshLambertMaterial({ color: "#E53935", side: THREE.DoubleSide })
    );
    pennant.position.z = POLE_HEIGHT - FLAG_HEIGHT / 2 - 1;
    flag.add(pennant);

    let time = Math.random() * 10;
    group.userData.update = (delta) => {
        time += delta;
        floating.position.z = Math.sin(time * BOB_SPEED) * BOB_HEIGHT;
        group.userData.bob = floating.position.z; // Froggy bobs along when he's on it
        for (let i = 0; i < positions.count; i++) {
            const x = restX[i];
            positions.setY(i, Math.sin(time * FLAG_FLUTTER_SPEED - x * 0.35) * x * FLAG_FLUTTER);
        }
        positions.needsUpdate = true;
    };

    return group;
}
