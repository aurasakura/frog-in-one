import * as THREE from "three";

// Two objects collide when the gap between their outlines is smaller than this
export const COLLISION_DISTANCE = 2;

// Radius of the circle (in the XY plane) that hugs the model's actual
// vertices, measured from the model's parent origin. Unlike a bounding box,
// it doesn't add empty corners around rounded characters, and it stays the
// same however the model is turned around the z-axis.
// Call this after the model is scaled/rotated but before it's added to a parent.
export function computeRadius(model) {
    model.updateMatrixWorld(true);

    const vertex = new THREE.Vector3();
    let maxSq = 0;

    model.traverse((child) => {
        if (!child.isMesh) return;

        const count = child.geometry.attributes.position.count;
        for (let i = 0; i < count; i++) {
            child.getVertexPosition(i, vertex); // includes skinning/morphs
            vertex.applyMatrix4(child.matrixWorld);
            maxSq = Math.max(maxSq, vertex.x * vertex.x + vertex.y * vertex.y);
        }
    });

    return Math.sqrt(maxSq);
}

export function circlesCollide(ax, ay, aRadius, bx, by, bRadius) {
    return Math.hypot(bx - ax, by - ay) - aRadius - bRadius < COLLISION_DISTANCE;
}

// Circle vs. axis-aligned box ({ minX, maxX, minY, maxY }) in the XY plane
export function circleCollidesBox(x, y, radius, box) {
    const closestX = Math.max(box.minX, Math.min(x, box.maxX));
    const closestY = Math.max(box.minY, Math.min(y, box.maxY));
    return Math.hypot(x - closestX, y - closestY) - radius < COLLISION_DISTANCE;
}

// Ground footprint (plus height range) of an object, from its bounding box:
// { minX, maxX, minY, maxY, minZ, maxZ }. `precise` measures the actual
// vertices for a tight fit; pass false for InstancedMeshes, whose instance
// bounds only the non-precise path includes.
export function footprint(object, precise = true) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object, precise);
    return {
        minX: box.min.x,
        maxX: box.max.x,
        minY: box.min.y,
        maxY: box.max.y,
        minZ: box.min.z,
        maxZ: box.max.z,
    };
}
