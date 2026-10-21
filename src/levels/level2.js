// Level 2 — Garden
//
// Introduces: mud, the rotating sprinkler, the Super Leap fly.
// Mixes in: grass slides, terrace gaps, Double Hop.
//   - Mud is first met on the patio (safe), then the vegetable plot is a
//     field of mud rows that slow the safe route down.
//   - The sprinkler is first met on the wide lawn (safe), then a second one
//     sits on the finish deck's edge and blows you back over the last gap:
//     grab the Double Hop fly over that gap to beat it.
// Safe route: patio → lawn → vegetable plot → finish.
// Shortcut: Super Leap from the north edge of the lawn straight over the
// vegetable plot onto the finish deck.
export default {
    name: "Garden",
    par: 5,
    timeTarget: 85, // seconds
    arcPreview: 0.37,

    start: { col: 0, row: 0 },
    lilyPad: { col: 0, row: 29 },

    terraces: [
        // Patio, with a small mud patch to try
        {
            col: -3,
            row: -2,
            z: 0,
            rows: [
                "GGGGGGG",
                "GGGGMMM",
                "GGGGMMM",
                "GGGGGGG",
                "GGGGGGG",
                "GGGGGGG",
                ".GGGGG.",
            ],
        },
        // Lawn: the first sprinkler, with plenty of ground around it
        {
            col: -4,
            row: 6,
            z: 5,
            rows: [
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
                "MMGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
                "GGGGGGGGG",
            ],
        },
        // Vegetable plot: rows of mud that keep stopping you short
        {
            col: -5,
            row: 16,
            z: 10,
            rows: [
                "GGGGGGGGGGG",
                "MMGMMGMMGMM",
                "GGGGGGGGGGG",
                "MMGMMGMMGMM",
                "GGGGGGGGGGG",
                "MGMMGMMGMMG",
                "GGGGGGGGGGG",
            ],
        },
        // Finish deck, three tiles of water past the plot
        {
            col: -3,
            row: 26,
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
    ],

    flies: [
        // Patio: learn Super Leap before a shot, over safe ground
        { type: "superLeap", col: -2, row: 1, height: 28 },
        // Lawn: the shortcut's Super Leap
        { type: "superLeap", col: 2, row: 13, height: 30 },
        // Over the last gap: Double Hop against the sprinkler's wind
        { type: "doubleHop", col: 0, row: 24, height: 45 },
    ],

    obstacles: [
        { type: "sprinkler", col: 3, row: 8 },
        { type: "sprinkler", col: -1, row: 27, startAngle: -Math.PI / 2 },
    ],

    props: [
        { type: "sign", col: 3, row: 1, icon: "mud", text: "MUD\nStops you. Next hop 60%" },
        { type: "sign", col: -3, row: 0, icon: "superLeap", text: "SUPER LEAP\nPress E before a hop" },
        { type: "sign", col: -3, row: 7, icon: "sprinkler", text: "SPRINKLER\nSpray pushes you" },
        { type: "bin", col: -3, row: -1 },
        { type: "mailbox", col: 3, row: -1 },
        { type: "flowerBed", col: -4, row: 13, width: 2, depth: 2 },
        { type: "flowerBed", col: 3, row: 13, width: 2, depth: 2 },
        { type: "birdbath", col: 0, row: 11 },
        { type: "fence", from: { col: 3, row: 27 }, to: { col: 3, row: 31 } },
        { type: "flowerBed", col: -5, row: 22 },
        { type: "flowerBed", col: 5, row: 22 },
    ],

    houses: [],
};
