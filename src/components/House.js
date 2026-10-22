import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { footprint } from "../collision.js";
import { addBoxShape } from "./Props.js";

const HOUSE_SCALE = 65;

// small_house.glb is loaded once and cloned for every house
let templatePromise = null;

function loadTemplate() {
    if (!templatePromise) {
        templatePromise = new GLTFLoader()
            // Files in public/ sit next to index.html; relative, so the game
            // also works from a sub-folder (e.g. on itch.io)
            .loadAsync(`${import.meta.env.BASE_URL}models/small_house.glb`)
            .then((gltf) => {
                const template = gltf.scene;
                template.scale.setScalar(HOUSE_SCALE);
                template.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                return template;
            });
        templatePromise.catch((error) =>
            console.error("Failed to load small_house.glb:", error)
        );
    }
    return templatePromise;
}

// Bumped by clearHouses so houses still loading for an old level are dropped
let generation = 0;

export function clearHouses() {
    generation++;
}

// Place houses from level data: each placement is { x, y, z, quarterTurns },
// where z is the height of the surface the house stands on. Each house's
// footprint becomes a collision box (see Props.js).
export function placeHouses(parent, placements) {
    const placedFor = generation;

    loadTemplate().then((template) => {
        if (placedFor !== generation) return;

        for (const { x, y, z, quarterTurns = 0 } of placements) {
            const house = template.clone();
            house.rotation.set(
                Math.PI / 2, // stand the model upright in the z-up world
                quarterTurns * (Math.PI / 2),
                0
            );

            // Sit exactly on the surface
            house.position.set(0, 0, 0);
            const lift = -footprint(house).minZ;
            house.position.set(x, y, z + lift);

            addBoxShape(footprint(house));
            parent.add(house);
        }
    });
}
