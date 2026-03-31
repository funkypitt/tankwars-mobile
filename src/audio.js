// Simple synthesized sound effects using Web Audio API
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function initAudio() {
  // Called on first user interaction to unlock audio
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) {
    // Audio not supported
  }
}

function playTone(freq, duration, type = 'square', volume = 0.15) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Silently fail
  }
}

function playNoise(duration, volume = 0.1) {
  try {
    const ctx = getAudioCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch (e) {
    // Silently fail
  }
}

export function sfxFire() {
  playTone(200, 0.1, 'sawtooth', 0.2);
  setTimeout(() => playTone(150, 0.1, 'sawtooth', 0.15), 50);
}

export function sfxExplosionSmall() {
  playNoise(0.3, 0.15);
  playTone(80, 0.3, 'sawtooth', 0.1);
}

export function sfxExplosionBig() {
  playNoise(0.8, 0.25);
  playTone(40, 0.6, 'sawtooth', 0.15);
  setTimeout(() => playTone(30, 0.5, 'sawtooth', 0.1), 200);
}

export function sfxExplosionNuke() {
  playNoise(1.5, 0.35);
  playTone(25, 1.0, 'sawtooth', 0.2);
  setTimeout(() => playNoise(0.8, 0.2), 300);
  setTimeout(() => playTone(20, 0.8, 'sawtooth', 0.15), 500);
}

export function sfxLaser() {
  playTone(800, 0.5, 'sine', 0.1);
  playTone(1200, 0.3, 'sine', 0.08);
}

export function sfxSonic() {
  playTone(2000, 0.8, 'sine', 0.08);
  playTone(3000, 0.4, 'sine', 0.05);
}

export function sfxFall() {
  playTone(300, 0.1, 'sine', 0.08);
  setTimeout(() => playTone(200, 0.1, 'sine', 0.08), 100);
}

export function sfxBuy() {
  playTone(600, 0.05, 'square', 0.1);
  setTimeout(() => playTone(800, 0.05, 'square', 0.1), 60);
}

export function sfxClick() {
  playTone(500, 0.03, 'square', 0.08);
}

export function sfxWin() {
  playTone(400, 0.15, 'square', 0.12);
  setTimeout(() => playTone(500, 0.15, 'square', 0.12), 150);
  setTimeout(() => playTone(600, 0.15, 'square', 0.12), 300);
  setTimeout(() => playTone(800, 0.3, 'square', 0.15), 450);
}

export function sfxDeath() {
  playTone(200, 0.2, 'sawtooth', 0.12);
  setTimeout(() => playTone(100, 0.3, 'sawtooth', 0.1), 200);
  setTimeout(() => playTone(50, 0.5, 'sawtooth', 0.08), 400);
}
