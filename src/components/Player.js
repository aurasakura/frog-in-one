import * as THREE from "three";
import { computeRadius } from "../collision.js";
import { FrogModel, FROGGY_COLORS } from "./FrogModel.js";

// Froggy's model (FrogModel). Rotate and squash this (not the group).
// Declared before the player is built, which sets it.
export let model = null;

export const player = Player();

function Player() {
    const group = new THREE.Group();
    group.position.set(0, 0, 0); // center of the scene

    model = FrogModel(FROGGY_COLORS);
    model.rotation.x = Math.PI / 2; // stand the y-up model upright in the z-up world
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    // The model's feet are already at its origin, so it sits on the ground
    // as is. Kept for squash & stretch, which rescales around the feet.
    model.userData.groundOffset = 0;
    model.userData.baseScale = 1;

    group.userData.radius = computeRadius(model);
    group.add(model);

    return group;
}
