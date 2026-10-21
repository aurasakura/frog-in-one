// Level 5 — Home Street
//
// No new mechanics: everything at once, in the hardest arrangements.
//   - A wide wet street with puddles and two hose jets out of step.
//   - A front yard with slime, mud and a washing line.
//   - A wet side path between slime posts, a hose and a sprinkler.
//   - Froggy's home garden: the lily pad in his pond, by his house.
// Safe route: through every section in turn.
// Shortcut: Super Leap from the front yard over the side path into the
// garden, or Glide across the gap after it.
export default {
    name: "Home Street",
    par: 7,
    timeTarget: 140, // seconds
    arcPreview: 0.28,

    start: { col: 0, row: 0 },
    // A big pad, and close misses into the pond still count
    lilyPad: { col: 0, row: 38, size: 1.8, catchRadius: 1.4 },

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
        // Home Street itself
        {
            col: -4,
            row: 3,
            z: 0,
            rows: [
                "GGGGGGGGG",
                "WWPWWWPWW",
                "WWWWWWWWW",
                "MMWWPWWMM",
                "WWWWWWWWW",
                "WPWWWWWPW",
                "WWWWMWWWW",
                "WWWWWWWWW",
                "WWWWWWWWW",
                "GGGGGGGGG",
            ],
        },
        // Front yard: slime, mud and a washing line
        {
            col: -5,
            row: 15,
            z: 10,
            rows: [
                "GGGGGGGGGGG",
                "GMMGGSGGMMG",
                "GGGGGSGGGGG",
                "SSGGGGGGGSS",
                "GGGGGGGGGGG",
                "GGMGGGGGMGG",
                "GGGGGGGGGGG",
                "GGGGGGGGGGG",
            ],
        },
        // Side path: wet, with slime posts and puddles
        {
            col: -5,
            row: 25,
            z: 20,
            rows: [
                "GGGGGGGGGGG",
                "WWWWWWWWWWW",
                "WWPWWWWWPWW",
                "SWWWWSWWWWS",
                "WWWWWWWWWWW",
                "WWWPWWWPWWW",
                "GGGGGGGGGGG",
            ],
        },
        // Froggy's garden, with his pond and the lily pad
        {
            col: -5,
            row: 34,
            z: 25,
            rows: [
                "GGGGGGGGGGG",
                "GGGGGGGGGGG",
                "GGGPPPPGGGG",
                "GGPPPPPPGGG",
                "GGPPPPPPGGG",
                "GGGPPPPGGGG",
                "GGGGGGGGGGG",
                "GMGGGGGGGMG",
                "GGGGGGGGGGG",
            ],
        },
    ],

    flies: [
        { type: "superLeap", col: 0, row: 8, height: 30 },
        { type: "doubleHop", col: 0, row: 13.5, height: 45 },
        { type: "glide", col: 3, row: 23.5, height: 45 },
        { type: "doubleHop", col: -3, row: 32.5, height: 45 },
    ],

    obstacles: [
        { type: "hoseJet", col: -4, row: 5, direction: [1, 0], length: 8 },
        { type: "hoseJet", col: 4, row: 10, direction: [-1, 0], length: 8, offset: 2 },
        { type: "sprinkler", col: 4, row: 12 },
        { type: "washingLine", from: { col: -5, row: 18 }, to: { col: 5, row: 18 } },
        { type: "hoseJet", col: -5, row: 27, direction: [1, 0], length: 10, offset: 1 },
        { type: "sprinkler", col: 5, row: 31 },
    ],

    props: [
        { type: "sign", col: 2, row: 0, icon: "home", text: "ALMOST HOME!\nGood luck!" },
        { type: "mailbox", col: 2, row: -2 },
        { type: "bin", col: -4, row: 3 },
        { type: "bin", col: 4, row: 3 },
        { type: "flowerBed", col: -5, row: 15, width: 2 },
        { type: "flowerBed", col: 4, row: 15, width: 2 },
        { type: "fence", from: { col: -5, row: 34 }, to: { col: -2, row: 34 } },
        { type: "fence", from: { col: 2, row: 34 }, to: { col: 5, row: 34 } },
        { type: "mailbox", col: -1, row: 35 },
        { type: "birdbath", col: -4, row: 41 },
        { type: "flowerBed", col: -5, row: 38, depth: 2 },
    ],

    // Froggy's house, by the pond
    houses: [{ col: 4, row: 41, quarterTurns: 2 }],
};
