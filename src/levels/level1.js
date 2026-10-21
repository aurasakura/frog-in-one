// Level 1 — Front Lawn
//
// Introduces: grass sliding, terrace gaps, the Double Hop fly.
// Safe route: west around the pond on wide lawns with 1-tile gaps.
// Shortcut: straight north across the pond via a small stepping-stone lawn;
// the Double Hop fly over the pond makes the long first jump safe.
//
// Tile coordinates: one tile = CELL_SIZE world units, tile (0, 0) is at the
// world origin, +row is forward (+y). Terrace `rows` are listed far to near,
// and `col`/`row` give the bottom-left tile. Codes: G grass, M mud,
// W wet pavement, S slime, P puddle/pond water, "." no tile.
export default {
    name: "Front Lawn",
    par: 5,
    timeTarget: 70, // seconds
    arcPreview: 0.4, // share of the arc the aim guide shows

    start: { col: 0, row: 0 },
    lilyPad: { col: 0, row: 22 },

    terraces: [
        // Start lawn: room to learn aiming and sliding
        {
            col: -3,
            row: -2,
            z: 0,
            rows: [
                ".GGGGG.",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                ".GGGGG.",
            ],
        },
        // Safe route: west lawn, one tile of water from the start lawn
        {
            col: -11,
            row: 1,
            z: 0,
            rows: [
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
            ],
        },
        // Safe route: garden step, a little higher
        {
            col: -11,
            row: 11,
            z: 5,
            rows: [
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
            ],
        },
        // Shortcut: stepping-stone lawn in the middle of the pond
        {
            col: -1,
            row: 12,
            z: 5,
            rows: [
                "GGG",
                "GGG",
                "GGG",
            ],
        },
        // Finish lawn with the lily pad
        {
            col: -7,
            row: 19,
            z: 10,
            rows: [
                "GGGGGGGGGGG",
                "GGGGGGGGGGG",
                "GGGGGGGGGGG",
                "GGGGGGGGGGG",
                "GGGGGGGGGGG",
                "GGGGGGGGGGG",
                "GGGGGGGGGGG",
                "GGGGGGGGGGG",
            ],
        },
    ],

    // Powerup flies. col/row may be fractional (e.g. over water);
    // height is above the surface (or water gap) below.
    flies: [
        // Over the start lawn: grab it and try Double Hop over safe ground
        { type: "doubleHop", col: -2, row: 2, height: 28 },
        // Over the pond: makes the shortcut's long jump comfortable
        { type: "doubleHop", col: 0, row: 8.5, height: 45 },
        // Over the last gap of the safe route
        { type: "doubleHop", col: -8, row: 18, height: 40 },
    ],

    obstacles: [],

    props: [
        { type: "sign", col: 2, row: 2, icon: "hop", text: "HOW TO PLAY\nDrag back, let go to hop" },
        { type: "sign", col: -1, row: 5, icon: "water", text: "WATER\nSends you back" },
        { type: "fence", from: { col: -2, row: -2 }, to: { col: 2, row: -2 } },
        { type: "mailbox", col: 3, row: -1 },
        { type: "birdbath", col: -10, row: 5 },
        { type: "flowerBed", col: -11, row: 15, width: 2, depth: 2 },
        { type: "flowerBed", col: 3, row: 25 },
        { type: "bin", col: -7, row: 21 },
    ],

    houses: [{ col: -6, row: 25, quarterTurns: 1 }],
};
