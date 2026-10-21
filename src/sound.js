// Small sound effects, all synthesized here with Web Audio (original, no
// audio files). Browsers only allow audio after a user gesture; sounds
// triggered by a drag-and-release qualify. Any audio failure is ignored so
// the game runs on.
import { isMuted, setMuted } from "./progress.js";

let context = null;
let noiseBuffer = null;
let muted = isMuted();

export function getMuted() {
    return muted;
}

// Mute or unmute all sounds (remembered between visits)
export function toggleMuted() {
    muted = !muted;
    setMuted(muted);
    return muted;
}

function audioContext() {
    if (!context) context = new AudioContext();
    if (context.state === "suspended") context.resume();
    return context;
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

// Filtered noise sweeping from one frequency to another while fading out
function noiseSweep({ duration, from, to, volume, filterType = "lowpass" }) {
    play((ctx) => {
        const now = ctx.currentTime;
        const source = noise(ctx);

        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(from, now);
        filter.frequency.exponentialRampToValueAtTime(to, now + duration);

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
        const osc = ctx.createOscillator();
        osc.type = wave;
        osc.frequency.setValueAtTime(from, start);
        osc.frequency.exponentialRampToValueAtTime(to, start + duration);

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

export function playSplash() {
    noiseSweep({ duration: 0.5, from: 2500, to: 300, volume: 0.5 });
}

export function playSplat() {
    noiseSweep({ duration: 0.25, from: 900, to: 120, volume: 0.6 });
}

export function playWhoosh() {
    noiseSweep({ duration: 0.35, from: 400, to: 2200, volume: 0.25, filterType: "bandpass" });
}

export function playGulp() {
    toneSweep({ duration: 0.15, from: 320, to: 90, volume: 0.4 });
}

export function playBoing() {
    toneSweep({ duration: 0.3, from: 160, to: 520, volume: 0.3, wave: "triangle" });
}

export function playThump() {
    toneSweep({ duration: 0.15, from: 180, to: 70, volume: 0.35, wave: "square" });
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
