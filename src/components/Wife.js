import * as THREE from "three";
import { FrogModel, WIFE_COLORS } from "./FrogModel.js";

const MODEL_SCALE = 0.9; // a little smaller than Froggy
const BOW_COLOR = "#E53935";

// A small bow: two flat cones point to point, with a knot in the middle.
// Built y-up like the frog model it sits on.
function Bow() {
    const bow = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: BOW_COLOR, roughness: 0.45 });
    for (const side of [-1, 1]) {
        const loop = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4, 16), material);
        loop.rotation.z = side * (Math.PI / 2); // point towards the knot
        loop.position.x = side * 2;
        loop.scale.z = 0.5; // flatten front to back
        bow.add(loop);
    }
    bow.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), material));
    return bow;
}

// Froggy's wife (§1 outro): the frog model in pink, wearing a bow on her
// head. The group stands with its feet at z = 0 and faces -y; turn
// `rotation.z` to face her another way. `userData.model` is her FrogModel
// (for setFrogExpression).
export function Wife() {
    const group = new THREE.Group();

    const model = FrogModel(WIFE_COLORS);
    const bow = Bow();
    bow.position.set(-2.5, 12.6, 0.5); // on top of her head, a little to one side
    bow.rotation.z = 0.3;
    model.add(bow);

    model.scale.setScalar(MODEL_SCALE);
    model.rotation.x = Math.PI / 2; // stand the y-up model upright in the z-up world
    group.add(model);
    group.userData.model = model;

    return group;
}
