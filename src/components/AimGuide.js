import * as THREE from "three";

// Share of the full arc the preview shows (§3). Levels can set their own
// (later levels show a little less) via setArcPreviewFraction.
export const ARC_PREVIEW_FRACTION = 0.4;
let arcPreviewFraction = ARC_PREVIEW_FRACTION;

export function setArcPreviewFraction(fraction = ARC_PREVIEW_FRACTION) {
    arcPreviewFraction = fraction;
}

const DOT_COUNT = 10;
const DOT_RADIUS = 2;

// Dotted arc preview (3D) plus a power bar (HTML, bottom of the screen)
function AimGuide() {
    const dots = new THREE.InstancedMesh(
        new THREE.SphereGeometry(DOT_RADIUS, 8, 6),
        new THREE.MeshBasicMaterial({ color: "white", transparent: true, opacity: 0.9 }),
        DOT_COUNT
    );
    dots.frustumCulled = false; // instances move every frame
    dots.visible = false;

    const bar = document.createElement("div");
    bar.className = "power-bar";
    bar.hidden = true;
    const fill = document.createElement("div");
    fill.className = "power-bar-fill";
    bar.append(fill);
    document.body.append(bar);

    const matrix = new THREE.Matrix4();

    return {
        object: dots,

        // `origin` and `velocity` are the launch position and velocity,
        // `gravity` the downward acceleration, `power` 0–1 for the bar.
        // `fraction` overrides how much of the arc to show (e.g. Super Leap).
        show(origin, velocity, gravity, power, fraction = arcPreviewFraction) {
            // Time for the full arc to come back down to launch height
            const flightTime = (2 * velocity.z) / gravity;
            const previewTime = flightTime * fraction;

            for (let i = 0; i < DOT_COUNT; i++) {
                const t = (previewTime * (i + 1)) / DOT_COUNT;
                matrix.makeTranslation(
                    origin.x + velocity.x * t,
                    origin.y + velocity.y * t,
                    origin.z + velocity.z * t - 0.5 * gravity * t * t
                );
                dots.setMatrixAt(i, matrix);
            }
            dots.instanceMatrix.needsUpdate = true;
            dots.visible = true;

            fill.style.width = `${Math.round(power * 100)}%`;
            fill.style.background = `hsl(${120 - 120 * power}, 80%, 50%)`; // green → red
            bar.hidden = false;
        },

        hide() {
            dots.visible = false;
            bar.hidden = true;
        },
    };
}

export const aimGuide = AimGuide();
