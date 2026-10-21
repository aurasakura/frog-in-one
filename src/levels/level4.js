// Level 4 — Backyard
//
// Introduces: slime, washing lines.
// Mixes in: wet pavement sliding into slime, mud, hose jets, sprinklers,
// and all three flies.
//   - Slime is first met as two blocks on the patio (safe), the washing
//     line across the wide lawn (safe).
//   - Then a wet patio runs into a wall of slime blocks (land on top for a
//     free bounce, or slide into the side and bounce back) with a hose
//     across it, a mud-pocked vegetable patch under a sprinkler, and a
//     second washing line guarding the lily pad.
// Safe route: patio → lawn → wet patio → vegetable patch → finish deck.
// Shortcut: the slime lane east of the garden. From its grass launch pad,
// hop north onto the first slime pad: the free bounce carries Froggy on to
// the long pad (about 60–72% power), and each new pad bounces him again, on
// to the third pad and the shelf by the vegetable patch. Spacing was tuned
// with a simulation of the game's physics, back when only the first pad
// bounced; low grass under the gaps and along the east side catches misses
// (costs time, not a splash).
export default {
    name: "Backyard",
    par: 6,
    timeTarget: 120, // seconds
    arcPreview: 0.31,

    start: { col: 0, row: 0 },
    lilyPad: { col: 0, row: 33 },

    terraces: [
        // Patio with two slime blocks to try
        {
            col: -3,
            row: -2,
            z: 0,
            rows: [
                "GGGGGSS",
                "GGGGGSS",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                ".GGGGG.",
            ],
        },
        // Lawn under the first washing line
        {
            col: -4,
            row: 5,
            z: 5,
            rows: [
                "GGGGGGGGG",
                "GGGGGGMMM",
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
            ],
        },
        // Wet patio sliding into a wall of slime
        {
            col: -4,
            row: 14,
            z: 5,
            rows: [
                "GGGGGGGGG",
                "SSGSSGSSG",
                "WWWWWWWWW",
                "WWWWWWWWW",
                "WWWWWWWWW",
                "WWWWWWWWW",
                "GGGGGGGGG",
            ],
        },
        // Vegetable patch with mud pockets
        {
            col: -5,
            row: 22,
            z: 10,
            rows: [
                "GGGGGGGGGGG",
                "GMMGGGGGMMG",
                "GGGGGMGGGGG",
                "GGMGGGGGMGG",
                "GGGGGGGGGGG",
                "GGGGGGGGGGG",
            ],
        },
        // Finish deck
        {
            col: -3,
            row: 30,
            z: 15,
            rows: [
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
            ],
        },
        // Shortcut lane (columns 7–8): launch pad, three slime pads, shelf
        { col: 7, row: 3, z: 5, rows: ["GG", "GG", "GG"] },
        { col: 7, row: 8, z: 0, rows: ["SS", "SS"] },
        { col: 7, row: 12, z: 0, rows: ["SS", "SS", "SS"] },
        { col: 7, row: 17, z: 0, rows: ["SS", "SS"] },
        { col: 7, row: 21, z: 10, rows: ["GG", "GG", "GG", "GG", "GG"] },
        // Low grass catching misses: under the gaps, and a ledge to the east
        {
            col: 7,
            row: 6,
            z: -8,
            rows: [
                "GGG",
                "GGG",
                "..G",
                "..G",
                "GGG",
                "GGG",
                "..G",
                "..G",
                "..G",
                "GGG",
                "GGG",
                "..G",
                "..G",
                "GGG",
                "GGG",
            ],
        },
    ],

    flies: [
        // Patio: Super Leap, e.g. for the jump onto the first stepping stone
        { type: "superLeap", col: -2, row: 1, height: 28 },
        // Over the gap into the wet patio
        { type: "doubleHop", col: 0, row: 13, height: 40 },
        // Over the slime lane, between the long pad and the third pad
        { type: "doubleHop", col: 7.5, row: 15.5, height: 45 },
        // Over the gap to the finish deck
        { type: "glide", col: -3, row: 28.5, height: 45 },
    ],

    obstacles: [
        { type: "washingLine", from: { col: -4, row: 8 }, to: { col: 4, row: 8 } },
        { type: "hoseJet", col: -4, row: 17, direction: [1, 0], length: 8, offset: 1 },
        { type: "sprinkler", col: 4, row: 24 },
        { type: "washingLine", from: { col: -3, row: 31 }, to: { col: 3, row: 31 }, offset: 0.8 },
    ],

    props: [
        { type: "sign", col: -3, row: 2, icon: "slime", text: "SLIME\nLand on top to bounce" },
        { type: "sign", col: 3, row: 6, icon: "laundry", text: "LAUNDRY\nPass when it swings up" },
        { type: "sign", col: 8, row: 3, facing: [-1, 0], icon: "shortcut", text: "SHORTCUT\nBounce along the slime" },
        { type: "arrow", col: 7, row: 3, dx: 0.5, dy: 1 },
        { type: "arrow", col: 7, row: 8, dx: 0.5, dy: 0.5 },
        { type: "arrow", col: 7, row: 12, dx: 0.5, dy: 1 },
        { type: "arrow", col: 7, row: 17, dx: 0.5, dy: 0.5 },
        { type: "bin", col: -3, row: -1 },
        { type: "fence", from: { col: -4, row: 5 }, to: { col: -4, row: 12 } },
        { type: "birdbath", col: -2, row: 11 },
        { type: "flowerBed", col: -5, row: 22, width: 2 },
        { type: "flowerBed", col: 2, row: 34, width: 2 },
    ],

    houses: [{ col: -4, row: 26, quarterTurns: 1 }],
};
