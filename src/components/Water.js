import * as THREE from "three";

export const WATER_Z = -60; // well below the terraces
const WATER_MARGIN = 3000; // how far the water reaches past the level

// A large water plane under the level. `bounds` is the level's footprint.
export function Water(bounds) {
    const width = bounds.maxX - bounds.minX + WATER_MARGIN * 2;
    const depth = bounds.maxY - bounds.minY + WATER_MARGIN * 2;

    const water = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        new THREE.MeshPhongMaterial({ color: "#2E86C1", shininess: 80 })
    );
    water.position.set(
        (bounds.minX + bounds.maxX) / 2,
        (bounds.minY + bounds.maxY) / 2,
        WATER_Z
    );
    water.receiveShadow = true;

    return water;
}
