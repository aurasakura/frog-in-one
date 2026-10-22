// Small sound effects, all synthesized here with Web Audio (original, no
// audio files). Browsers only allow audio after a user gesture; sounds
// triggered by a drag-and-release qualify. Any audio failure is ignored so
// the game runs on. Every sound is pitched slightly differently each time
// (see vary), so repeats never sound identical.
import { isMuted, setMuted } from "./progress.js";

let context = null;
let noiseBuffer = null;
let muted = isMuted();

export function getMuted() {
    return muted;
}

const muteListeners = [];

// Call `listener(muted)` whenever mute is toggled (music.js)
export function onMuteChange(listener) {
    muteListeners.push(listener);
}

// Mute or unmute all sounds and music (remembered between visits)
export function toggleMuted() {
    muted = !muted;
    setMuted(muted);
    for (const listener of muteListeners) listener(muted);
    return muted;
}

function audioContext() {
    if (!context) context = new AudioContext();
    if (context.state === "suspended") context.resume();
    return context;
}

// The shared audio context for music.js, or null until the player has
// clicked or pressed a key (browsers block audio before that)
export function getAudioContext() {
    if (!context && navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
    try {
        return audioContext();
    } catch {
        return null;
    }
}

function play(build) {
    if (muted) return;
    // Before the first click/tap/key the browser would block audio anyway
    if (!context && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try {
        build(audioContext());
    } catch (error) {
        console.warn("Sound unavailable:", error);
    }
}

// One second of white noise, reused by every noise-based sound
function noise(ctx) {
    if (!noiseBuffer) {
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const samples = noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    return source;
}

// A random pitch factor within ±`amount`, so each play sounds a bit different
const vary = (amount = 0.07) => 1 + (Math.random() * 2 - 1) * amount;

// How loud an obstacle's sound is at `distance` from Froggy: full up close,
// fading to nothing at `range`
export function nearness(distance, range) {
    return Math.max(0, 1 - distance / range) ** 1.5;
}

// Filtered noise sweeping from one frequency to another while fading out
function noiseSweep({ duration, from, to, volume, filterType = "lowpass" }) {
    play((ctx) => {
        const now = ctx.currentTime;
        const source = noise(ctx);
        const pitch = vary();

        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(from * pitch, now);
        filter.frequency.exponentialRampToValueAtTime(to * pitch, now + duration);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        source.connect(filter).connect(gain).connect(ctx.destination);
        source.start(now);
        source.stop(now + duration);
    });
}

// A tone gliding from one pitch to another while fading out, `delay`
// seconds from now
function toneSweep({ duration, from, to, volume, wave = "sine", delay = 0 }) {
    play((ctx) => {
        const start = ctx.currentTime + delay;
        const pitch = vary(0.04); // tones vary less, so tunes stay in tune
        const osc = ctx.createOscillator();
        osc.type = wave;
        osc.frequency.setValueAtTime(from * pitch, start);
        osc.frequency.exponentialRampToValueAtTime(to * pitch, start + duration);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
    });
}

export function playLaunch() {
    toneSweep({ duration: 0.18, from: 220, to: 660, volume: 0.25, wave: "triangle" });
    noiseSweep({ duration: 0.15, from: 600, to: 2000, volume: 0.12, filterType: "bandpass" });
}

export function playLand() {
    toneSweep({ duration: 0.12, from: 140, to: 60, volume: 0.35 });
    noiseSweep({ duration: 0.1, from: 800, to: 200, volume: 0.15 });
}

// Falling into water: just a splash. A soft, unresonant wash of water noise
// that swells in and falls away, with a scatter of tiny spray droplets
// (very short bright noise bursts at random moments) on top.
export function playSplash() {
    noiseShape({
        filterType: "bandpass",
        q: 0.4,
        frequency: [[0, 1800], [0.15, 1200], [0.7, 380]],
        gain: [[0.035, 0.55], [0.18, 0.3], [0.7, 0.001]],
    });
    noiseShape({ filterType: "lowpass", q: 0.5, frequency: [[0, 900], [0.5, 200]], gain: [[0.04, 0.35], [0.5, 0.001]] });
    for (let i = 0; i < 9; i++) {
        noiseShape({
            filterType: "highpass",
            q: 0.5,
            frequency: [[0, 2500 + Math.random() * 2500], [0.03, 2000]],
            gain: [[0.004, 0.06 + Math.random() * 0.06], [0.02 + Math.random() * 0.03, 0.001]],
            delay: 0.06 + Math.random() * 0.5,
        });
    }
}

export function playSplat() {
    noiseSweep({ duration: 0.25, from: 900, to: 120, volume: 0.6 });
}

// Noise shaped over time: the filter frequency and the volume each follow a
// list of [seconds, value] points (volume points are scaled by `volume`)
function noiseShape({ filterType = "bandpass", q = 1, frequency, gain, volume = 1, delay = 0 }) {
    if (volume <= 0.001) return;
    play((ctx) => {
        const start = ctx.currentTime + delay;
        const pitch = vary();
        const end = gain[gain.length - 1][0];
        const source = noise(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.Q.value = q;
        filter.frequency.setValueAtTime(frequency[0][1] * pitch, start);
        for (const [t, f] of frequency.slice(1)) filter.frequency.exponentialRampToValueAtTime(f * pitch, start + t);
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0.0001, start);
        for (const [t, g] of gain) amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, g * volume), start + t);
        source.connect(filter).connect(amp).connect(ctx.destination);
        source.loop = true; // so a late start in the buffer never runs out
        source.start(start, Math.random() * 0.5); // a different stretch of noise each time
        source.stop(start + end);
    });
}

// A tone whose pitch wobbles (a springy "boing"): it glides from `from` to
// `to` with a vibrato of `wobble` Hz at `rate` per second, while fading
function wobbleTone({ duration, from, to, wobble, rate, volume, wave = "sine" }) {
    play((ctx) => {
        const now = ctx.currentTime;
        const pitch = vary();
        const osc = ctx.createOscillator();
        osc.type = wave;
        osc.frequency.setValueAtTime(from * pitch, now);
        osc.frequency.exponentialRampToValueAtTime(to * pitch, now + duration * 0.35);
        osc.frequency.exponentialRampToValueAtTime(to * pitch * 0.8, now + duration);
        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(rate, now);
        lfo.frequency.linearRampToValueAtTime(rate * 0.6, now + duration); // the spring slows down
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(wobble, now);
        depth.gain.exponentialRampToValueAtTime(1, now + duration);
        lfo.connect(depth).connect(osc.frequency);
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(volume, now);
        amp.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(amp).connect(ctx.destination);
        osc.start(now);
        lfo.start(now);
        osc.stop(now + duration);
        lfo.stop(now + duration);
    });
}

// Washing line swinging past: a soft cloth "whoo-sh" that swells and fades
export function playLaundryWoosh(volume = 1) {
    noiseShape({
        q: 0.8,
        frequency: [[0, 260], [0.3, 1100], [0.65, 420]],
        gain: [[0.22, 0.32], [0.65, 0.001]],
        volume,
    });
}

// Hose about to fire: a little drip
export function playHoseDrip(volume = 1) {
    if (volume <= 0.001) return;
    toneSweep({ duration: 0.08, from: 1400, to: 500, volume: 0.12 * volume });
}

// Hose jet firing: a hissing "swoosh" that rushes up and trails off
export function playHoseSwoosh(volume = 1) {
    noiseShape({
        filterType: "highpass",
        q: 0.7,
        frequency: [[0, 900], [0.15, 3200], [0.9, 2000]],
        gain: [[0.06, 0.28], [0.35, 0.18], [0.9, 0.001]],
        volume,
    });
}

// Sprinkler turning: a quiet "tch" each tick
export function playSprinklerTick(volume = 1) {
    noiseShape({ filterType: "highpass", frequency: [[0, 3500], [0.035, 5000]], gain: [[0.004, 0.16], [0.035, 0.001]], volume });
}

// Caught in the sprinkler's spray: a light spritz
export function playSprinklerSpritz() {
    noiseShape({
        filterType: "bandpass",
        q: 0.6,
        frequency: [[0, 5000], [0.35, 2500]],
        gain: [[0.03, 0.22], [0.35, 0.001]],
    });
}

export function playGulp() {
    toneSweep({ duration: 0.15, from: 320, to: 90, volume: 0.4 });
}

// Bouncing off a slime top: a springy, wobbling boing with a squelch
export function playSlimeBoing() {
    wobbleTone({ duration: 0.55, from: 150, to: 560, wobble: 60, rate: 16, volume: 0.32 });
    noiseShape({ filterType: "lowpass", frequency: [[0, 700], [0.08, 200]], gain: [[0.01, 0.3], [0.08, 0.001]] });
}

// Bumping into the side of slime: a lower, shorter, squishier boing
export function playSlimeBump() {
    wobbleTone({ duration: 0.3, from: 110, to: 260, wobble: 35, rate: 22, volume: 0.3, wave: "triangle" });
}

// Hit by something (a hose jet, the laundry) or bumping into a wall: a
// solid, low thud. `volume` softens it for the smaller bumps.
export function playThud(volume = 1) {
    toneSweep({ duration: 0.2, from: 130, to: 45, volume: 0.5 * volume });
    noiseShape({ filterType: "lowpass", frequency: [[0, 500], [0.12, 120]], gain: [[0.005, 0.45], [0.12, 0.001]], volume });
}

// Clicking a (wooden) button: a short, hollow wood-block "tok"
export function playButtonClick() {
    toneSweep({ duration: 0.07, from: 720, to: 480, volume: 0.22, wave: "triangle" });
    noiseShape({ filterType: "bandpass", q: 4, frequency: [[0, 1800], [0.05, 900]], gain: [[0.003, 0.3], [0.05, 0.001]] });
}

// Pointer moving onto a button: a very soft tick
export function playButtonHover() {
    toneSweep({ duration: 0.04, from: 1300, to: 1100, volume: 0.05 });
}

// Rising sparkly chime
export function playPowerup() {
    [660, 880, 1320].forEach((pitch, i) => {
        toneSweep({ duration: 0.18, from: pitch, to: pitch * 1.02, volume: 0.18, wave: "triangle", delay: i * 0.06 });
    });
}

// Little fanfare: an arpeggio up to a held top note
export function playLevelComplete() {
    [523, 659, 784].forEach((pitch, i) => {
        toneSweep({ duration: 0.16, from: pitch, to: pitch, volume: 0.22, wave: "triangle", delay: i * 0.12 });
    });
    toneSweep({ duration: 0.6, from: 1047, to: 1040, volume: 0.25, wave: "triangle", delay: 0.36 });
}

// A soft, low "rib-bit" for Froggy's idle croak
export function playCroak() {
    play((ctx) => {
        [
            { delay: 0, duration: 0.09, from: 210, to: 160 },
            { delay: 0.2, duration: 0.11, from: 250, to: 180 },
        ].forEach(({ delay, duration, from, to }) => {
            const start = ctx.currentTime + delay;
            const osc = ctx.createOscillator();
            osc.type = "sawtooth"; // buzzy, like a croak…
            osc.frequency.setValueAtTime(from, start);
            osc.frequency.exponentialRampToValueAtTime(to, start + duration);

            const filter = ctx.createBiquadFilter(); // …but softened
            filter.type = "lowpass";
            filter.frequency.value = 700;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

            osc.connect(filter).connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(start + duration);
        });
    });
}

// Two quick chirps, for the frogs' happy hop
export function playChirp() {
    toneSweep({ duration: 0.09, from: 900, to: 1400, volume: 0.15, wave: "sine" });
    toneSweep({ duration: 0.09, from: 1000, to: 1600, volume: 0.15, wave: "sine", delay: 0.11 });
}
