// Level 3 — Rainy Street
//
// Introduces: wet pavement, puddles, hose jets, the Glide fly.
// Mixes in: mud (safe stopping strips between slides), sprinklers,
// Double Hop and Super Leap.
//   - Wet pavement is first met at the bottom of the street, which ends in
//     a mud strip, so an overlong slide just sticks in the mud.
//   - Puddles and hose jets come further up the street, between mud strips.
// Safe route: up the street, across to the side alley, up the alley's
// mud stops, then over to the front garden.
// Shortcut: from the street's far curb, Glide over the flooded crossing
// straight to the front garden.
import { isTouchScreen } from "../input.js";

export default {
    name: "Rainy Street",
    par: 7,
    timeTarget: 110, // seconds
    arcPreview: 0.34,

    start: { col: 0, row: 0 },
    lilyPad: { col: 0, row: 29 },

    terraces: [
        // Sidewalk
        {
            col: -2,
            row: -2,
            z: 0,
            rows: [
                "GGGGG",
                "GGGGG",
                "GGGGG",
                "GGGGG",
            ],
        },
        // The street: wet lanes between mud strips, puddles further up
        {
            col: -3,
            row: 3,
            z: 0,
            rows: [
                "GGGGGGG",
                "WWPWWWW",
                "MMMMMMM",
                "WWWWPWW",
                "WPWWWWW",
                "WWWWWWW",
                "MMMMMMM",
                "WWWWWWW",
                "WWWWWWW",
                "WWWWWWW",
                "GGGGGGG",
                "GGGGGGG",
            ],
        },
        // Side alley (safe route), two tiles west of the street
        {
            col: -9,
            row: 6,
            z: 0,
            rows: [
                "GGGG",
                "GGGG",
                "GGGG",
                "WWWW",
                "WPWW",
                "MMMM",
                "WWWW",
                "WWPW",
                "MMMM",
                "WWWW",
                "PWWW",
                "MMMM",
                "WWWW",
                "WWWP",
                "MMMM",
                "WWWW",
                "WWWW",
                "MMMM",
                "GGGG",
                "GGGG",
                "GGGG",
            ],
        },
        // Front garden with the lily pad
        {
            col: -4,
            row: 24,
            z: 10,
            rows: [
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
            ],
        },
    ],

    flies: [
        // Bottom of the street: try Glide over safe ground
        { type: "glide", col: 0, row: 5, height: 70 },
        // Middle of the flooded crossing, high up: hop through it from the far
        // curb, then hold E to Glide the rest of the way
        { type: "glide", col: 0, row: 19, height: 85 },
        // Sidewalk: a Super Leap to cross the street faster
        { type: "superLeap", col: 1, row: 0, height: 28 },
        // Alley: Double Hop for the gap into the front garden
        { type: "doubleHop", col: -7, row: 21, height: 40 },
    ],

    obstacles: [
        // Hose jets across the street, out of step with each other
        { type: "hoseJet", col: -3, row: 10, direction: [1, 0], length: 6 },
        { type: "hoseJet", col: 3, row: 13, direction: [-1, 0], length: 6, offset: 1.5 },
        // Sprinklers at the alley crossing and in the alley
        { type: "sprinkler", col: -3, row: 5 },
        { type: "sprinkler", col: -6, row: 17 },
        // Hose guarding the lily pad
        { type: "hoseJet", col: 4, row: 27, direction: [-1, 0], length: 8, offset: 0.7 },
    ],

    props: [
        { type: "sign", col: -2, row: 1, icon: "wetPavement", text: "WET PAVEMENT\nYou slide far" },
        { type: "sign", col: 3, row: 4, icon: "glide", text: isTouchScreen ? "GLIDE\nHold the powerup in mid-air" : "GLIDE\nHold E in mid-air" },
        { type: "sign", col: -3, row: 9, icon: "puddle", text: "PUDDLES\nSame as water" },
        { type: "sign", col: 3, row: 11, icon: "hose", text: "HOSE\nDrip, then a jet" },
        { type: "bin", col: -2, row: -1 },
        { type: "bin", col: 3, row: 3 },
        { type: "mailbox", col: 2, row: -2 },
        { type: "mailbox", col: -1, row: 24 },
        { type: "birdbath", col: -3, row: 29 },
        { type: "fence", from: { col: -4, row: 31 }, to: { col: -1, row: 31 } },
        { type: "flowerBed", col: 3, row: 25 },
    ],

    houses: [{ col: 3, row: 31, quarterTurns: 2 }],
};
