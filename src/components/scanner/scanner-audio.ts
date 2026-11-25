export type ScannerSoundTone = "success" | "warning" | "error";

interface AudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

function getAudioContextClass(): typeof AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const win = window as AudioWindow;
  return window.AudioContext ?? win.webkitAudioContext ?? null;
}

let sharedAudioCtx: AudioContext | null = null;

function scheduleTone(
  ctx: AudioContext,
  frequencyHz: number,
  startOffsetSec: number,
  durationSec: number,
  type: OscillatorType,
  peakGain: number
): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + startOffsetSec;
  const stop = start + durationSec;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequencyHz, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(start);
  oscillator.stop(stop + 0.01);
}

/**
 * Plays crisp Web Audio API chimes for <1s gate feedback without external audio files.
 */
export function playScannerBeep(tone: ScannerSoundTone): void {
  try {
    const AudioCtx = getAudioContextClass();
    if (!AudioCtx) return;

    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      void sharedAudioCtx.resume();
    }

    switch (tone) {
      case "success":
        scheduleTone(sharedAudioCtx, 880, 0, 0.09, "sine", 0.14);
        scheduleTone(sharedAudioCtx, 1318.5, 0.09, 0.14, "sine", 0.16);
        break;
      case "warning":
        scheduleTone(sharedAudioCtx, 587.3, 0, 0.1, "triangle", 0.15);
        scheduleTone(sharedAudioCtx, 466.2, 0.13, 0.14, "triangle", 0.14);
        break;
      case "error":
        scheduleTone(sharedAudioCtx, 240, 0, 0.14, "sawtooth", 0.11);
        scheduleTone(sharedAudioCtx, 180, 0.14, 0.2, "sawtooth", 0.11);
        break;
    }
  } catch {
    // Ignore audio context restrictions if browser blocks unprompted audio
  }
}
