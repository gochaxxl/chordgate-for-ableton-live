// ChordGate.js
// Max for Live MIDI Effect: rhythmic retrigger for held chords.
// Long chords come in; every active step of the pattern re-strikes all
// currently held notes together as one block chord (new note-on = new attack).
//
// Messages (all into inlet 0):
//   note <pitch> <velocity>      incoming MIDI notes (from midiparse)
//   tick <bars> <beats> <units> <resolution> <tempo> <tsNum> <tsDen>
//                                song position from [transport], every 20 ticks
//   vels <list>                  velocity per step (0 = rest)
//   lens <list>                  note length per step, measured in steps
//   steps <n>                    pattern length (1..32)
//   rate <index>                 0=1/4 1=1/8 2=1/8T 3=1/16 4=1/16T 5=1/32
//   enable <0|1>                 0 = pass notes through unchanged
//   init                         sent once after the device has loaded
//   panic                        release everything

autowatch = 1;
inlets = 1;
outlets = 4;

setinletassist(0, "note / tick / pattern messages");
setoutletassist(0, "notes (pitch velocity) to midiformat");
setoutletassist(1, "velocity slider display");
setoutletassist(2, "length slider display");
setoutletassist(3, "playhead display");

var MAX_STEPS = 32;
var RATE_TICKS = [480, 240, 160, 120, 80, 60]; // 480 ticks per quarter note
var FINE_TICKS = 20;   // must match [metro 20 ticks] in the patch
var MIN_LENGTH = 0.1;  // shortest note, in steps

// Default pattern (fresh device): 3-3-2 feel, 16 steps
var DEFAULT_VEL = [110, 0, 0, 90, 0, 0, 100, 0, 110, 0, 0, 90, 0, 0, 100, 0];
var DEFAULT_LEN = [2.5, 1, 1, 2.5, 1, 1, 1.5, 1, 2.5, 1, 1, 2.5, 1, 1, 1.5, 1];

var numSteps = 16;
var stepTicks = 120;
var enabled = 1;
var ready = 0;

var velPattern = [];
var lenPattern = [];
for (var i = 0; i < MAX_STEPS; i++) {
    velPattern.push(0);
    lenPattern.push(0);
}

var held = {};      // pitch -> input velocity (notes currently held by the clip)
var sounding = {};  // pitch -> remaining ticks until note-off (Infinity = until released)

var tickCounter = 0;
var lastStepAbs = -1;
var lastStepTick = -1000;
var lastStepVel = 0;
var lastStepLen = 0;
var lastShownStep = -1;

function clamp(x, lo, hi) {
    return x < lo ? lo : (x > hi ? hi : x);
}

function sendNote(pitch, velocity) {
    outlet(0, pitch, velocity);
}

function flush() {
    for (var key in sounding) {
        sendNote(Number(key), 0);
    }
    sounding = {};
}

// ---------------------------------------------------------------- notes in

function note(pitch, velocity) {
    var key = String(pitch);
    if (velocity > 0) {
        held[key] = velocity;
        if (!enabled) {
            if (sounding.hasOwnProperty(key)) sendNote(pitch, 0);
            sendNote(pitch, velocity);
            sounding[key] = Infinity;
        } else if (tickCounter === lastStepTick && lastStepVel > 0 && !sounding.hasOwnProperty(key)) {
            // The note arrived just after an active step: join that hit.
            sendNote(pitch, lastStepVel);
            sounding[key] = lastStepLen;
        }
    } else {
        delete held[key];
        if (sounding.hasOwnProperty(key)) {
            sendNote(pitch, 0);
            delete sounding[key];
        }
    }
}
note.immediate = 1;

// ---------------------------------------------------------------- clock

function tick(bars, beats, units, resolution, tempo, tsNum, tsDen) {
    tickCounter++;

    // Release notes whose length has run out.
    for (var key in sounding) {
        if (sounding[key] === Infinity) continue;
        sounding[key] -= FINE_TICKS;
        if (sounding[key] <= FINE_TICKS * 0.5) {
            sendNote(Number(key), 0);
            delete sounding[key];
        }
    }

    if (!resolution) resolution = 480;
    if (!tsNum) tsNum = 4;
    if (!tsDen) tsDen = 4;

    // Song position in ticks (480 per quarter note).
    var beatTicks = 1920 / tsDen;
    var position = ((bars - 1) * tsNum + (beats - 1)) * beatTicks + units * 480 / resolution;

    var exact = position / stepTicks;
    var stepAbs = Math.round(exact);
    if (Math.abs(exact - stepAbs) * stepTicks >= FINE_TICKS * 0.5) return; // not on a step
    if (stepAbs === lastStepAbs && tickCounter - lastStepTick <= 1) return; // already done

    var step = ((stepAbs % numSteps) + numSteps) % numSteps;
    lastStepAbs = stepAbs;
    lastStepTick = tickCounter;
    lastStepVel = 0;
    showStep(step);

    if (!enabled) return;
    var vel = velPattern[step];
    if (vel <= 0) return;

    var len = Math.max(lenPattern[step], MIN_LENGTH) * stepTicks;
    lastStepVel = vel;
    lastStepLen = len;

    for (var k in held) {
        var pitch = Number(k);
        if (sounding.hasOwnProperty(k)) sendNote(pitch, 0);
        sendNote(pitch, vel);
        sounding[k] = len;
    }
}
tick.immediate = 1;

function showStep(step) {
    if (step === lastShownStep) return;
    lastShownStep = step;
    var a = ["set"];
    for (var i = 0; i < numSteps; i++) a.push(i === step ? 1 : 0);
    outlet(3, a);
}

// ---------------------------------------------------------------- settings

function vels() {
    var a = arrayfromargs(arguments);
    for (var i = 0; i < a.length && i < MAX_STEPS; i++) {
        velPattern[i] = clamp(Math.round(a[i]), 0, 127);
    }
}

function lens() {
    var a = arrayfromargs(arguments);
    for (var i = 0; i < a.length && i < MAX_STEPS; i++) {
        lenPattern[i] = clamp(a[i], 0, 8);
    }
}

function steps(n) {
    numSteps = clamp(Math.round(n), 1, MAX_STEPS);
    lastShownStep = -1;
    if (ready) pushPattern();
    else sendSizes();
}

function rate(index) {
    stepTicks = RATE_TICKS[clamp(Math.round(index), 0, RATE_TICKS.length - 1)];
    lastStepAbs = -1;
}

function enable(x) {
    enabled = x ? 1 : 0;
    flush();
    if (!enabled) {
        // Pass-through mode: let the held chord keep sounding as is.
        for (var k in held) {
            sendNote(Number(k), held[k]);
            sounding[k] = Infinity;
        }
    }
}

function init() {
    ready = 1;
    var empty = true;
    for (var i = 0; i < MAX_STEPS; i++) {
        if (velPattern[i] > 0) { empty = false; break; }
    }
    if (empty) {
        for (var j = 0; j < MAX_STEPS; j++) {
            velPattern[j] = DEFAULT_VEL[j % DEFAULT_VEL.length];
            lenPattern[j] = DEFAULT_LEN[j % DEFAULT_LEN.length];
        }
    }
    pushPattern();
}

function panic() {
    flush();
    held = {};
}

function notifydeleted() {
    flush();
}

// ---------------------------------------------------------------- display

function sendSizes() {
    outlet(1, "size", numSteps);
    outlet(2, "size", numSteps);
    outlet(3, "size", numSteps);
}

function pushPattern() {
    sendSizes();
    outlet(1, ["set"].concat(velPattern.slice(0, numSteps)));
    outlet(2, ["set"].concat(lenPattern.slice(0, numSteps)));
}
