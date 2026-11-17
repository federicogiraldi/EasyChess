import { getSettings } from './settings';

/**
 * Suoni sintetizzati con la Web Audio API: niente file da scaricare, funzionano offline.
 * Il browser li permette solo dopo un'interazione dell'utente (tocco o clic), che qui c'è sempre.
 */

export type SoundName = 'move' | 'capture' | 'check' | 'castle' | 'correct' | 'wrong' | 'success';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Un colpo secco come un pezzo di legno appoggiato sulla scacchiera. */
function knock(c: AudioContext, at: number, gain: number, freq: number) {
  const len = Math.floor(c.sampleRate * 0.05);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 3;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(c.destination);
  src.start(at);
}

function tone(c: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine', endFreq?: number) {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

export function playSound(name: SoundName) {
  const s = getSettings();
  if (!s.sound || s.volume <= 0) return;
  const c = audio();
  if (!c) return;
  const v = s.volume;
  const t = c.currentTime + 0.005;
  switch (name) {
    case 'move':
      knock(c, t, 1.6 * v, 900);
      break;
    case 'capture':
      knock(c, t, 1.8 * v, 700);
      knock(c, t + 0.06, 1.4 * v, 1100);
      break;
    case 'castle':
      knock(c, t, 1.5 * v, 900);
      knock(c, t + 0.1, 1.5 * v, 1000);
      break;
    case 'check':
      knock(c, t, 1.6 * v, 900);
      tone(c, t + 0.02, 880, 0.18, 0.12 * v, 'triangle');
      break;
    case 'correct':
      tone(c, t, 660, 0.14, 0.12 * v, 'triangle');
      tone(c, t + 0.09, 990, 0.2, 0.12 * v, 'triangle');
      break;
    case 'wrong':
      tone(c, t, 220, 0.22, 0.1 * v, 'square', 150);
      break;
    case 'success':
      [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.08, f, 0.25, 0.1 * v, 'triangle'));
      break;
  }
}

/** Il suono giusto per una mossa appena giocata (da descrizione chess.js: flags e SAN). */
export function moveSound(move: { san: string; flags: string }): SoundName {
  if (move.san.includes('+') || move.san.includes('#')) return 'check';
  if (move.flags.includes('k') || move.flags.includes('q')) return 'castle';
  if (move.flags.includes('c') || move.flags.includes('e')) return 'capture';
  return 'move';
}
