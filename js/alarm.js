// Siren (Web Audio, no sound file) and vibration. Browsers only allow audio after a tap,
// so every failure here is silent: the ntfy notification has already rung.

let ctx = null;
let osc = null;
let gain = null;
let toneTimer = null;
let vibrateTimer = null;
let active = false;

// Must be called from a click/pointerup/keydown handler: on touch screens a pointerdown is not
// a user activation, so audio would stay locked. Resolves true once audio runs (or does not exist).
export async function unlockAudio() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return true;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state !== "running") await ctx.resume();
    if (active) startSiren();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

function startSiren() {
  if (osc || !ctx || ctx.state !== "running") return;
  try {
    osc = ctx.createOscillator();
    gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 960;
    gain.gain.value = 0.8;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    let high = true;
    toneTimer = setInterval(() => {
      high = !high;
      osc.frequency.setValueAtTime(high ? 960 : 770, ctx.currentTime);
    }, 500);
  } catch {
    stopSiren();
  }
}

function stopSiren() {
  clearInterval(toneTimer);
  toneTimer = null;
  try {
    osc?.stop();
    osc?.disconnect();
    gain?.disconnect();
  } catch {
    // Already stopped.
  }
  osc = null;
  gain = null;
}

export function startAlarm() {
  active = true;
  startSiren();
  if (!vibrateTimer && navigator.vibrate) {
    const buzz = () => {
      try {
        navigator.vibrate([600, 300]);
      } catch {
        // Vibration blocked until the user taps the page.
      }
    };
    buzz();
    vibrateTimer = setInterval(buzz, 900);
  }
}

export function stopAlarm() {
  active = false;
  stopSiren();
  clearInterval(vibrateTimer);
  vibrateTimer = null;
  try {
    navigator.vibrate?.(0);
  } catch {
    // Nothing to stop.
  }
}
