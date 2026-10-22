import { isTouchScreen } from "./input.js";

// Powerup definitions (§6), shared by the flies and the HUD
export const POWERUPS = {
    doubleHop: {
        name: "Double Hop",
        color: "#CC79A7", // magenta
        pattern: "bouncing",
        hint: isTouchScreen ? "Tap the powerup in mid-air" : "Press E in mid-air to Double Hop",
    },
    glide: {
        name: "Glide",
        color: "#0072B2", // deep blue
        pattern: "drifting",
        hint: isTouchScreen ? "Hold the powerup in mid-air" : "Hold E in mid-air to Glide",
    },
    superLeap: {
        name: "Super Leap",
        color: "#E69F00", // orange-gold
        pattern: "darting",
        hint: isTouchScreen ? "Tap the powerup before a shot" : "Press E before a shot to Super Leap",
    },
};

// --- Icons: white shapes with a dark outline, drawn on a canvas ---

function arrow(ctx, cx, cy, width, height) {
    const top = cy - height / 2;
    const headBottom = top + height * 0.45;
    const shaft = width * 0.4;
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + width / 2, headBottom);
    ctx.lineTo(cx + shaft / 2, headBottom);
    ctx.lineTo(cx + shaft / 2, cy + height / 2);
    ctx.lineTo(cx - shaft / 2, cy + height / 2);
    ctx.lineTo(cx - shaft / 2, headBottom);
    ctx.lineTo(cx - width / 2, headBottom);
    ctx.closePath();
}

function sparkle(ctx, cx, cy, r) {
    ctx.moveTo(cx, cy - r);
    ctx.quadraticCurveTo(cx, cy, cx + r, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + r);
    ctx.quadraticCurveTo(cx, cy, cx - r, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - r);
    ctx.closePath();
}

// One wide wing, mirrored by `side` (-1 left, 1 right)
function wing(ctx, c, s, side) {
    ctx.moveTo(c, c);
    ctx.quadraticCurveTo(c + side * 0.22 * s, c - 0.32 * s, c + side * 0.48 * s, c - 0.14 * s);
    ctx.quadraticCurveTo(c + side * 0.36 * s, c - 0.02 * s, c + side * 0.42 * s, c + 0.08 * s);
    ctx.quadraticCurveTo(c + side * 0.26 * s, c + 0.02 * s, c + side * 0.28 * s, c + 0.14 * s);
    ctx.quadraticCurveTo(c + side * 0.14 * s, c + 0.06 * s, c, c + 0.1 * s);
    ctx.closePath();
}

const iconCache = new Map();

// A canvas with the powerup's icon: ⬆⬆, wide wings, or ⬆ with sparkles
export function powerupIconCanvas(type, size = 64) {
    const key = `${type}:${size}`;
    if (iconCache.has(key)) return iconCache.get(key);

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const c = size / 2;

    ctx.beginPath();
    if (type === "doubleHop") {
        arrow(ctx, c - size * 0.17, c, size * 0.3, size * 0.7);
        arrow(ctx, c + size * 0.17, c, size * 0.3, size * 0.7);
    } else if (type === "glide") {
        wing(ctx, c, size, -1);
        wing(ctx, c, size, 1);
    } else if (type === "superLeap") {
        arrow(ctx, c, c + size * 0.04, size * 0.46, size * 0.78);
        sparkle(ctx, c - size * 0.33, c - size * 0.25, size * 0.1);
        sparkle(ctx, c + size * 0.34, c - size * 0.1, size * 0.08);
        sparkle(ctx, c + size * 0.3, c + size * 0.3, size * 0.07);
    }
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.07;
    ctx.strokeStyle = "#1A1A1A";
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.fill();

    iconCache.set(key, canvas);
    return canvas;
}
