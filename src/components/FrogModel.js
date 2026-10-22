import * as THREE from "three";

// A soft, rounded cartoon frog built from simple shapes. Used for Froggy
// (Player.js) and, in pink with a bow, for his wife (Wife.js).
//
// Built like a glTF model: y is up, the frog faces +z and its feet rest on
// y = 0. Stand it in the z-up world with rotation.x = π/2 (it then faces -y).
// About 16 wide, 13 tall and 18 long, in world units.

export const FROGGY_COLORS = {
    body: "#5DBB63",
    dark: "#3E8E41", // spots, thighs
    belly: "#EAF7C9",
    cheek: "#FF9EAF",
};

export const WIFE_COLORS = {
    body: "#F48FB1",
    dark: "#D96B97",
    belly: "#FFE4EE",
    cheek: "#FF6F91",
};

const BODY_CENTER = new THREE.Vector3(0, 5.8, -0.5);
const BODY_RADII = new THREE.Vector3(7.5, 5.5, 8.5);

const sphere = new THREE.SphereGeometry(1, 32, 24);
const smallSphere = new THREE.SphereGeometry(1, 16, 12);
// Lower half of a ring, flattened: a wide, gentle smile
const smile = new THREE.TorusGeometry(2.4, 0.3, 8, 24, Math.PI).rotateZ(Math.PI).scale(1, 0.55, 1);
const arm = new THREE.CapsuleGeometry(1.1, 2.6, 6, 12);
const happyEyeArc = new THREE.TorusGeometry(1.7, 0.32, 8, 20, Math.PI); // upper half: a closed happy eye ^

// Blinking: every few seconds the eyelids (body-coloured spheres over the
// eyes) shut for a moment, now and then twice in a row
const BLINK_GAP = [2, 5]; // seconds between blinks (random in range)
const BLINK_TIME = 0.13; // eyes shut this long
const DOUBLE_BLINK_CHANCE = 0.2;
const LID_RADIUS = 3.5; // just covers the eye, pupil and shine

const materialCache = new Map();
function material(color, roughness = 0.55) {
    const key = `${color}:${roughness}`;
    if (!materialCache.has(key)) {
        materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
    }
    return materialCache.get(key);
}

// A sphere stretched to `radii`, at `position`
function blob(geometry, color, position, radii, roughness) {
    const mesh = new THREE.Mesh(geometry, material(color, roughness));
    mesh.position.copy(position);
    mesh.scale.copy(radii);
    mesh.castShadow = true;
    return mesh;
}

// Height of the top of the body at (x, z), for placing things on its back
function backHeight(x, z) {
    const dx = x / BODY_RADII.x;
    const dz = (z - BODY_CENTER.z) / BODY_RADII.z;
    return BODY_CENTER.y + BODY_RADII.y * Math.sqrt(Math.max(0, 1 - dx * dx - dz * dz));
}

const v = (x, y, z) => new THREE.Vector3(x, y, z);

export function FrogModel(colors = FROGGY_COLORS) {
    const frog = new THREE.Group();
    // Parts the expression changes (see setFrogExpression)
    const face = { eyes: [], pupils: [], shines: [], happyEyes: [], lids: [], mouth: null, wavingArm: null };

    // Body and belly
    frog.add(blob(sphere, colors.body, BODY_CENTER, BODY_RADII));
    frog.add(blob(sphere, colors.belly, v(0, 4.8, 3.4), v(5.6, 4.2, 5.2)));

    // Spots on the back
    for (const [x, z, r] of [[2.2, -3, 1.3], [-2.6, -1.4, 1.1], [0.4, -5.6, 0.9], [-1.2, -4.4, 0.7]]) {
        frog.add(blob(smallSphere, colors.dark, v(x, backHeight(x, z) - 0.25, z), v(r, 0.35, r)));
    }

    // Eyes: a bump on the head, white eyeball, pupil and a shine
    for (const side of [-1, 1]) {
        frog.add(blob(sphere, colors.body, v(side * 3.6, 10.1, 3.1), v(3.2, 3.2, 3.2)));
        const eye = blob(sphere, "#FFFFFF", v(side * 3.7, 10.8, 4.2), v(2.6, 2.6, 2.6), 0.2);
        const pupil = blob(smallSphere, "#1B1B1B", v(side * 3.8, 10.9, 6.0), v(1.35, 1.35, 1.35), 0.15);
        const shine = blob(smallSphere, "#FFFFFF", v(side * 3.3, 11.5, 7.1), v(0.45, 0.45, 0.45), 0.1);
        frog.add(eye, pupil, shine);
        face.eyes.push(eye);
        face.pupils.push(pupil);
        face.shines.push(shine);

        // Eyelid, shown while blinking, with a dark line where the eye shuts
        const lid = blob(sphere, colors.body, v(side * 3.7, 10.8, 4.2), v(LID_RADIUS, LID_RADIUS, LID_RADIUS));
        const lash = new THREE.Mesh(happyEyeArc, material("#2B2B2B", 0.4));
        lash.position.set(side * 3.7, 11.2, 7.55);
        lash.rotation.set(-0.15, 0, Math.PI); // lower half: a closed eye ‿
        for (const part of [lid, lash]) {
            part.visible = false;
            frog.add(part);
            face.lids.push(part);
        }

        // Closed happy eye (^), shown instead of the open eye when grinning
        const happyEye = new THREE.Mesh(happyEyeArc, material("#2B2B2B", 0.4));
        happyEye.position.set(side * 3.7, 10.4, 6.75);
        happyEye.rotation.x = -0.15;
        happyEye.visible = false;
        frog.add(happyEye);
        face.happyEyes.push(happyEye);

        // Pink cheeks
        frog.add(blob(smallSphere, colors.cheek, v(side * 4.7, 7.3, 6.4), v(1.4, 0.8, 0.5)));

        // Back legs: a big thigh, a flat foot and three toes
        frog.add(blob(sphere, colors.dark, v(side * 6.4, 3.1, -2.6), v(2.9, 2.7, 4.6)));
        frog.add(blob(sphere, colors.body, v(side * 7.4, 0.8, 1.2), v(2.6, 0.8, 3.4)));
        for (const toe of [-1, 0, 1]) {
            frog.add(blob(smallSphere, colors.body, v(side * 7.4 + toe * 1.5, 0.7, 4.4 - Math.abs(toe) * 0.5), v(0.9, 0.6, 0.9)));
        }

        // Front arms and hands, each on a pivot at the shoulder so it can wave
        const shoulder = new THREE.Group();
        shoulder.position.set(side * 4, 4.6, 4.6);
        const front = new THREE.Mesh(arm, material(colors.body));
        front.position.set(side * 0.2, -2, 0.8);
        front.rotation.set(0.35, 0, side * 0.25);
        front.castShadow = true;
        shoulder.add(front);
        shoulder.add(blob(smallSphere, colors.body, v(side * 0.6, -4, 2), v(1.8, 0.6, 1.8)));
        shoulder.userData.side = side;
        frog.add(shoulder);
        if (side === 1) face.wavingArm = shoulder;
    }

    // Smile
    const mouth = new THREE.Mesh(smile, material("#2B2B2B", 0.4));
    // High on the face, tilted to follow the body, so the belly doesn't hide it
    mouth.position.set(0, 8.0, 7.6);
    mouth.rotation.x = -0.5;
    frog.add(mouth);
    face.mouth = mouth;

    frog.userData.face = face;
    frog.userData.blink = { next: BLINK_GAP[0] + Math.random() * (BLINK_GAP[1] - BLINK_GAP[0]), shut: 0, again: false };
    return frog;
}

// Expression for a FrogModel: `happiness` 0 (normal) to 1 (wide grin, eyes
// closed in happy ^ ^ arcs); `wave` 0–1 raises the waving arm, which waves
// with `time` (seconds)
export function setFrogExpression(frog, happiness, wave = 0, time = 0) {
    const face = frog.userData.face;
    face.mouth.scale.set(1 + 0.45 * happiness, 1 + 0.2 * happiness, 1);
    const eyesClosed = happiness > 0.5;
    for (const part of [...face.eyes, ...face.pupils, ...face.shines]) part.visible = !eyesClosed;
    for (const arc of face.happyEyes) arc.visible = eyesClosed;

    // Raise the arm out to the side and wave it from the shoulder
    const arm = face.wavingArm;
    arm.rotation.z = arm.userData.side * wave * (2.2 + 0.35 * Math.sin(time * 12));
}

// Blink now and then; call every frame. No blinking while the eyes are
// closed in a grin.
export function updateFrogBlink(frog, delta) {
    const blink = frog.userData.blink;
    if (blink.shut > 0) {
        blink.shut -= delta;
        if (blink.shut <= 0) {
            // A double blink reopens only briefly before shutting again
            blink.next = blink.again ? BLINK_TIME : BLINK_GAP[0] + Math.random() * (BLINK_GAP[1] - BLINK_GAP[0]);
            blink.again = false;
        }
    } else {
        blink.next -= delta;
        if (blink.next <= 0) {
            blink.shut = BLINK_TIME;
            blink.again = blink.again === false && Math.random() < DOUBLE_BLINK_CHANCE;
        }
    }
    const face = frog.userData.face;
    const grinning = face.happyEyes[0].visible;
    for (const lid of face.lids) lid.visible = blink.shut > 0 && !grinning;
}
