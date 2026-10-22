import { getAudioContext, getMuted, onMuteChange } from "./sound.js";

// Background music, composed here and played with Web Audio (no audio
// files), like the sound effects. Five looping tracks:
//   title  - a relaxed "lazy pond" tune on the start screen
//   game   - bouncy and cheerful, through all of the playing (every level)
//   score  - calm and celebratory, on the stars screen
//   intro  - gentle and wistful, while the story intro tells of Froggy
//            being far from home
//   ending - a sweet waltz, while Froggy meets his wife
// playMusic(name) crossfades to a track (or keeps it going if it's already
// playing); stopMusic() fades out. Mute silences music along with sounds.

const MUSIC_VOLUME = 0.32;
const FADE_TIME = 0.6; // seconds to fade between tracks
const LOOKAHEAD = 0.15; // seconds of notes scheduled ahead
const TICK_MS = 25; // how often the scheduler runs

// --- Notes ---

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// "C4", "F#5", "Bb3" → frequency in Hz
function frequency(name) {
    const [, letter, accidental, octave] = name.match(/^([A-G])([#b]?)(\d)$/);
    const semitone = NOTE_INDEX[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
    const midi = 12 * (Number(octave) + 1) + semitone;
    return 440 * 2 ** ((midi - 69) / 12);
}

// A voice's pattern: tokens separated by spaces (bars by "|", ignored).
// A note ("E5") or chord ("C4+E4+G4") starts on its step and lasts one step
// plus one for each "-" after it; "." is a rest. Drums use "x".
function parse(pattern) {
    const tokens = pattern.split(/\s+/).filter((t) => t && t !== "|");
    const events = [];
    tokens.forEach((token, step) => {
        if (token === "." || token === "-") return;
        let length = 1;
        while (tokens[step + length] === "-") length++;
        events.push({ step, length, notes: token === "x" ? [] : token.split("+").map(frequency) });
    });
    return { events, steps: tokens.length };
}

// --- Instruments: each plays one note into `out` at `time` for `duration` s ---

function envelope(ctx, out, time, attack, peak, release) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + release);
    gain.connect(out);
    return gain;
}

function oscillator(ctx, type, hz, time, end, target, detune = 0) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = hz;
    osc.detune.value = detune;
    osc.connect(target);
    osc.start(time);
    osc.stop(end);
}

const INSTRUMENTS = {
    // Short plucked note, for melodies
    pluck(ctx, out, hz, time, duration, volume) {
        const release = Math.max(0.18, duration * 0.9);
        oscillator(ctx, "triangle", hz, time, time + release + 0.05, envelope(ctx, out, time, 0.005, volume, release));
    },
    // Soft bell with a shimmer an octave up
    bell(ctx, out, hz, time, duration, volume) {
        const release = Math.max(0.6, duration * 1.4);
        oscillator(ctx, "sine", hz, time, time + release + 0.05, envelope(ctx, out, time, 0.005, volume, release));
        oscillator(ctx, "sine", hz * 2, time, time + release * 0.5, envelope(ctx, out, time, 0.005, volume * 0.25, release * 0.4));
    },
    // Round bass
    bass(ctx, out, hz, time, duration, volume) {
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 600;
        filter.connect(envelope(ctx, out, time, 0.01, volume, Math.max(0.15, duration * 0.95)));
        oscillator(ctx, "triangle", hz, time, time + duration + 0.1, filter);
    },
    // Warm held chord tone: two slightly detuned saws, softened
    pad(ctx, out, hz, time, duration, volume) {
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1100;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(volume, time + Math.min(0.35, duration * 0.4));
        gain.gain.setValueAtTime(volume, time + duration * 0.8);
        gain.gain.linearRampToValueAtTime(0.0001, time + duration + 0.3);
        filter.connect(gain).connect(out);
        oscillator(ctx, "sawtooth", hz, time, time + duration + 0.35, filter, -7);
        oscillator(ctx, "sawtooth", hz, time, time + duration + 0.35, filter, 7);
    },
    kick(ctx, out, hz, time, duration, volume) {
        const osc = ctx.createOscillator();
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
        osc.connect(envelope(ctx, out, time, 0.003, volume, 0.13));
        osc.start(time);
        osc.stop(time + 0.16);
    },
    snare(ctx, out, hz, time, duration, volume) {
        noiseHit(ctx, out, time, "highpass", 1500, volume, 0.1);
    },
    hat(ctx, out, hz, time, duration, volume) {
        noiseHit(ctx, out, time, "highpass", 7000, volume, 0.03);
    },
};

let noiseBuffer = null;
function noiseHit(ctx, out, time, type, cutoff, volume, release) {
    if (!noiseBuffer) {
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
        const samples = noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = cutoff;
    source.connect(filter).connect(envelope(ctx, out, time, 0.002, volume, release));
    source.start(time);
    source.stop(time + release + 0.02);
}

// --- Tracks: tempo (beats per minute), steps per beat, and voices ---

const TRACKS = {
    // Relaxed F major tune for the start screen: bells over a gentle bass,
    // F Dm Gm C | F Dm Bb-C F
    title: {
        bpm: 96,
        stepsPerBeat: 2,
        voices: [
            {
                instrument: "bell",
                volume: 0.11,
                pattern: `C5 . A4 C5 F5 . E5 . | D5 . A4 . F4 . A4 . | Bb4 . D5 . G5 F5 D5 . | E5 - - . C5 . G4 .
                          A4 C5 F5 . A5 . G5 F5 | F5 . D5 . A4 . D5 . | D5 C5 Bb4 . E5 D5 C5 . | F5 - - - . . . .`,
            },
            {
                instrument: "bass",
                volume: 0.2,
                pattern: `F2 . C3 . F2 . A2 . | D2 . A2 . D2 . F2 . | G2 . D3 . G2 . Bb2 . | C2 . G2 . C3 . E2 .
                          F2 . C3 . F2 . A2 . | D2 . A2 . D2 . F2 . | Bb1 . F2 . C2 . G2 . | F2 . C3 . F2 - - .`,
            },
            {
                instrument: "pad",
                volume: 0.03,
                pattern: `F3+A3+C4 - - - - - - - | D3+F3+A3 - - - - - - - | G3+Bb3+D4 - - - - - - - | C3+E3+G3 - - - - - - -
                          F3+A3+C4 - - - - - - - | D3+F3+A3 - - - - - - - | Bb2+D3+F3 - - - C3+E3+G3 - - - | F3+A3+C4 - - - - - - -`,
            },
            { instrument: "hat", volume: 0.025, pattern: ". x . x . x . x" },
        ],
    },
    // Bouncy C major romp: C Am F G | C Am F-G C, eighth notes
    game: {
        bpm: 124,
        stepsPerBeat: 2,
        voices: [
            {
                instrument: "pluck",
                volume: 0.16,
                pattern: `E5 . G5 . A5 G5 E5 . | C5 . E5 . D5 C5 A4 . | F4 A4 C5 . D5 C5 A4 . | G4 . B4 D5 G5 - - .
                          E5 . G5 . C6 B5 A5 G5 | A5 . E5 . C5 D5 E5 . | F5 E5 D5 C5 D5 - B4 - | C5 - G4 E4 C5 - - .`,
            },
            {
                instrument: "bass",
                volume: 0.22,
                pattern: `C3 . G2 . C3 . G2 . | A2 . E2 . A2 . E2 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 .
                          C3 . G2 . C3 . G2 . | A2 . E2 . A2 . E2 . | F2 . C3 . G2 . D3 . | C3 . G2 . C3 - - .`,
            },
            {
                instrument: "pad",
                volume: 0.035,
                pattern: `C4+E4+G4 - - - - - - - | A3+C4+E4 - - - - - - - | F3+A3+C4 - - - - - - - | G3+B3+D4 - - - - - - -
                          C4+E4+G4 - - - - - - - | A3+C4+E4 - - - - - - - | F3+A3+C4 - - - G3+B3+D4 - - - | C4+E4+G4 - - - - - - -`,
            },
            { instrument: "kick", volume: 0.3, pattern: "x . . . x . . ." },
            { instrument: "snare", volume: 0.06, pattern: ". . x . . . x ." },
            { instrument: "hat", volume: 0.04, pattern: ". x . x . x . x" },
        ],
    },
    // Calm, proud F major loop of bell arpeggios over warm chords
    score: {
        bpm: 92,
        stepsPerBeat: 2,
        voices: [
            {
                instrument: "bell",
                volume: 0.1,
                pattern: `F4 A4 C5 F5 C5 A4 C5 A4 | D4 F4 A4 D5 A4 F4 A4 F4 | Bb3 D4 F4 Bb4 F4 D4 F4 D4 | C4 E4 G4 C5 E5 C5 G4 E4`,
            },
            {
                instrument: "pluck",
                volume: 0.09,
                pattern: `A5 - - - C6 - - - | A5 - - - F5 - - - | F5 - - - D5 - - - | E5 - - - G5 - - -`,
            },
            { instrument: "bass", volume: 0.2, pattern: "F2 - - - - - - - | D2 - - - - - - - | Bb1 - - - - - - - | C2 - - - - - - -" },
            {
                instrument: "pad",
                volume: 0.03,
                pattern: "F3+A3+C4 - - - - - - - | D3+F3+A3 - - - - - - - | Bb2+D3+F3 - - - - - - - | C3+E3+G3 - - - - - - -",
            },
        ],
    },
    // Gentle, wistful A minor: Am F C E, slow
    intro: {
        bpm: 76,
        stepsPerBeat: 2,
        voices: [
            {
                instrument: "bell",
                volume: 0.12,
                pattern: `E5 - - - C5 - D5 - | C5 - - - A4 - - - | G4 - C5 - E5 - - - | D5 - - - B4 - G#4 -`,
            },
            { instrument: "bass", volume: 0.18, pattern: "A2 - - - - - - - | F2 - - - - - - - | C3 - - - - - - - | E2 - - - - - - -" },
            {
                instrument: "pad",
                volume: 0.04,
                pattern: "A3+C4+E4 - - - - - - - | F3+A3+C4 - - - - - - - | C4+E4+G4 - - - - - - - | E3+G#3+B3 - - - - - - -",
            },
        ],
    },
    // A sweet G major waltz (three beats a bar): oom-pah-pah under a melody
    ending: {
        bpm: 112,
        stepsPerBeat: 1,
        voices: [
            {
                instrument: "bell",
                volume: 0.12,
                pattern: `B4 D5 G5 | F#5 - E5 | E5 G5 C6 | B5 - A5 | G5 B5 E5 | E5 D5 C5 | D5 E5 F#5 | G5 - -`,
            },
            { instrument: "bass", volume: 0.22, pattern: "G2 . . | G2 . . | C3 . . | D3 . . | E2 . . | C3 . . | D3 . . | G2 . ." },
            {
                instrument: "pluck",
                volume: 0.07,
                pattern: `. B3+D4 B3+D4 | . B3+D4 B3+D4 | . C4+E4 C4+E4 | . C4+F#4 C4+F#4 | . B3+E4 B3+E4 | . C4+E4 C4+E4 | . C4+F#4 C4+F#4 | . B3+D4 B3+D4`,
            },
        ],
    },
};

for (const track of Object.values(TRACKS)) {
    track.parsed = track.voices.map((voice) => ({ ...voice, ...parse(voice.pattern) }));
    track.loopSteps = Math.max(...track.parsed.map((v) => v.steps));
}

// --- Playback ---

let master = null; // music volume (0 while muted)
let current = null; // { name, gain, timer }

function masterGain(ctx) {
    if (!master) {
        master = ctx.createGain();
        master.gain.value = getMuted() ? 0 : MUSIC_VOLUME;
        master.connect(ctx.destination);
    }
    return master;
}

onMuteChange((muted) => {
    if (master) master.gain.setTargetAtTime(muted ? 0 : MUSIC_VOLUME, master.context.currentTime, 0.05);
});

function fadeOut(playing, ctx) {
    clearInterval(playing.timer);
    playing.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, FADE_TIME / 4);
    setTimeout(() => playing.gain.disconnect(), FADE_TIME * 2000);
}

// Crossfade to the named track (it loops until another starts)
export function playMusic(name) {
    if (current?.name === name) return;
    const ctx = getAudioContext(); // null before the first click or key press
    if (!ctx) return;
    if (current) fadeOut(current, ctx);

    const track = TRACKS[name];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + FADE_TIME);
    gain.connect(masterGain(ctx));

    const stepTime = 60 / track.bpm / track.stepsPerBeat;
    let step = 0;
    let nextTime = ctx.currentTime + 0.05;
    const schedule = () => {
        while (nextTime < ctx.currentTime + LOOKAHEAD) {
            for (const voice of track.parsed) {
                for (const event of voice.events) {
                    // Shorter voices repeat within the loop
                    if (event.step !== step % voice.steps) continue;
                    const play = INSTRUMENTS[voice.instrument];
                    const duration = event.length * stepTime;
                    if (event.notes.length === 0) play(ctx, gain, 0, nextTime, duration, voice.volume);
                    for (const hz of event.notes) play(ctx, gain, hz, nextTime, duration, voice.volume);
                }
            }
            nextTime += stepTime;
            step = (step + 1) % track.loopSteps;
        }
    };
    schedule();
    current = { name, gain, timer: setInterval(schedule, TICK_MS) };
}

// Render `seconds` of a track offline (no speakers), e.g. for a recording
// or trailer: resolves to a stereo AudioBuffer at full music volume
export function renderTrack(name, seconds, sampleRate = 44100) {
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
    const out = ctx.createGain();
    out.gain.value = MUSIC_VOLUME;
    out.connect(ctx.destination);
    const track = TRACKS[name];
    const stepTime = 60 / track.bpm / track.stepsPerBeat;
    for (let step = 0, time = 0; time < seconds; step++, time += stepTime) {
        for (const voice of track.parsed) {
            for (const event of voice.events) {
                if (event.step !== (step % track.loopSteps) % voice.steps) continue;
                const play = INSTRUMENTS[voice.instrument];
                const duration = event.length * stepTime;
                if (event.notes.length === 0) play(ctx, out, 0, time, duration, voice.volume);
                for (const hz of event.notes) play(ctx, out, hz, time, duration, voice.volume);
            }
        }
    }
    return ctx.startRendering();
}

export function stopMusic() {
    if (!current) return;
    const ctx = getAudioContext();
    if (ctx) fadeOut(current, ctx);
    else clearInterval(current.timer);
    current = null;
}
