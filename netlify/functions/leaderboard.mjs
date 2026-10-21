import { getStore } from "@netlify/blobs";
import { LEVELS } from "../../src/levels/index.js";

// Shared leaderboard (Netlify Function + Netlify Blobs).
//   GET  /api/leaderboard  → { players: { [name]: { [levelIndex]: { strokes, par, time } } } }
//   POST /api/leaderboard  { name, level, strokes, time } → keeps it if it's
//        that player's best on the level (fewest strokes, then fastest)
// Each player is one blob, so two players finishing at once can't
// overwrite each other. Par comes from the level data, not the request.

const MAX_NAME_LENGTH = 16;
const MAX_STROKES = 999;
const MAX_TIME = 24 * 60 * 60; // seconds

const store = () => getStore({ name: "leaderboard", consistency: "strong" });
const playerKey = (name) => `player/${encodeURIComponent(name)}`;
const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

const isBetter = (a, b) => !b || a.strokes < b.strokes || (a.strokes === b.strokes && a.time < b.time);

async function list() {
    const leaderboard = store();
    const { blobs } = await leaderboard.list({ prefix: "player/" });
    const players = {};
    await Promise.all(
        blobs.map(async ({ key }) => {
            const levels = await leaderboard.get(key, { type: "json" });
            if (levels) players[decodeURIComponent(key.slice("player/".length))] = levels;
        })
    );
    return json({ players });
}

async function submit(req) {
    let body;
    try {
        body = await req.json();
    } catch {
        return json({ error: "Invalid JSON" }, 400);
    }
    const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LENGTH) : "";
    const level = Number(body.level);
    const strokes = Number(body.strokes);
    const time = Number(body.time);
    if (!name) return json({ error: "Missing name" }, 400);
    if (!Number.isInteger(level) || level < 0 || level >= LEVELS.length) return json({ error: "Bad level" }, 400);
    if (!Number.isInteger(strokes) || strokes < 1 || strokes > MAX_STROKES) return json({ error: "Bad strokes" }, 400);
    if (!Number.isFinite(time) || time <= 0 || time > MAX_TIME) return json({ error: "Bad time" }, 400);

    const leaderboard = store();
    const key = playerKey(name);
    const levels = (await leaderboard.get(key, { type: "json" })) ?? {};
    const result = { strokes, par: LEVELS[level].par, time: Math.round(time * 10) / 10 };
    const best = isBetter(result, levels[level]);
    if (best) {
        levels[level] = result;
        await leaderboard.setJSON(key, levels);
    }
    return json({ ok: true, best });
}

export default async (req) => {
    try {
        if (req.method === "GET") return await list();
        if (req.method === "POST") return await submit(req);
        return json({ error: "Method not allowed" }, 405);
    } catch (error) {
        console.error(error);
        return json({ error: "Leaderboard unavailable" }, 500);
    }
};

export const config = { path: "/api/leaderboard" };
