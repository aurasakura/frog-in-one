import * as THREE from "three";

// A burst of droplets thrown up and out, plus a ring spreading flat on the
// surface, both fading out. Used for water splashes and mud splats.
function Splash({
    dropletColor,
    ringColor,
    dropletCount = 24,
    dropletRadius = 2.5,
    speed = 90, // initial outward/upward speed
    gravity = 400,
    ringRadius = 45,
    duration = 0.8, // seconds
}) {
    const group = new THREE.Group();
    group.visible = false;

    const droplets = new THREE.InstancedMesh(
        new THREE.SphereGeometry(dropletRadius, 8, 6),
        new THREE.MeshBasicMaterial({ color: dropletColor, transparent: true }),
        dropletCount
    );
    droplets.frustumCulled = false; // instances move every frame
    group.add(droplets);

    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 1, 40),
        new THREE.MeshBasicMaterial({
            color: ringColor,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
        })
    );
    ring.position.z = 0.5; // just above the surface
    group.add(ring);

    // Per-droplet launch velocity, picked fresh for each burst
    const velocities = Array.from({ length: dropletCount }, () => new THREE.Vector3());
    const matrix = new THREE.Matrix4();
    let time = duration;

    return {
        object: group,

        play(x, y, z) {
            group.position.set(x, y, z);
            group.visible = true;
            time = 0;
            for (const velocity of velocities) {
                const angle = Math.random() * Math.PI * 2;
                const spread = speed * (0.4 + Math.random() * 0.6);
                velocity.set(
                    Math.cos(angle) * spread * 0.6,
                    Math.sin(angle) * spread * 0.6,
                    speed * (0.8 + Math.random() * 0.7)
                );
            }
        },

        update(delta) {
            if (!group.visible) return;
            time += delta;
            const progress = time / duration;
            if (progress >= 1) {
                group.visible = false;
                return;
            }

            velocities.forEach((v, i) => {
                matrix.makeTranslation(
                    v.x * time,
                    v.y * time,
                    Math.max(0, v.z * time - 0.5 * gravity * time * time)
                );
                droplets.setMatrixAt(i, matrix);
            });
            droplets.instanceMatrix.needsUpdate = true;
            droplets.material.opacity = 1 - progress;

            ring.scale.setScalar(ringRadius * Math.sqrt(progress));
            ring.material.opacity = 0.8 * (1 - progress);
        },
    };
}

// Falling in the water
export const splash = Splash({ dropletColor: "#D6EEFF", ringColor: "white" });

// Landing in mud: heavier, lower clods and a dark splat on the ground
export const mudSplat = Splash({
    dropletColor: "#4E3018",
    ringColor: "#3B2412",
    dropletCount: 16,
    dropletRadius: 3,
    speed: 60,
    gravity: 500,
    ringRadius: 26,
    duration: 0.6,
});
