const MIN_LEVEL = 0.08;
const MAX_LEVEL = 1;
const PHRASE_DURATION_MS = 6_200;

interface SpeechPulse {
  readonly center: number;
  readonly width: number;
  readonly strength: number;
}

const SPEECH_PULSES: readonly SpeechPulse[] = [
  { center: 200, width: 115, strength: 0.78 },
  { center: 390, width: 145, strength: 0.98 },
  { center: 640, width: 150, strength: 0.88 },
  { center: 910, width: 130, strength: 0.72 },
  { center: 1_230, width: 170, strength: 1 },
  { center: 1_620, width: 135, strength: 0.82 },
  { center: 1_870, width: 155, strength: 0.94 },
  { center: 2_120, width: 120, strength: 0.7 },
  { center: 2_500, width: 165, strength: 0.96 },
  { center: 2_780, width: 135, strength: 0.78 },
  { center: 3_080, width: 150, strength: 0.9 },
  { center: 3_420, width: 125, strength: 0.66 },
  { center: 3_760, width: 175, strength: 1 },
  { center: 4_150, width: 135, strength: 0.76 },
  { center: 4_470, width: 155, strength: 0.92 },
  { center: 4_790, width: 120, strength: 0.68 },
  { center: 5_170, width: 180, strength: 0.98 },
  { center: 5_520, width: 145, strength: 0.8 },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function speechEnvelope(time: number): number {
  let envelope = 0;
  for (const pulse of SPEECH_PULSES) {
    const distance = (time - pulse.center) / pulse.width;
    const level = Math.exp(-0.5 * distance * distance) * pulse.strength;
    envelope = Math.max(envelope, level);
  }
  return envelope;
}

export function createFallbackVoiceFrame(elapsedMs: number, barCount: number): number[] {
  if (!Number.isFinite(elapsedMs) || !Number.isInteger(barCount) || barCount <= 0) return [];

  const time = ((elapsedMs % PHRASE_DURATION_MS) + PHRASE_DURATION_MS) % PHRASE_DURATION_MS;
  const envelope = speechEnvelope(time);
  const middle = (barCount - 1) / 2;

  return Array.from({ length: barCount }, (_, index) => {
    const distanceFromMiddle = middle === 0 ? 0 : Math.abs(index - middle) / middle;
    const spatialShape = 0.48 + 0.52 * (1 - Math.pow(distanceFromMiddle, 1.35));
    const texture = 0.68
      + 0.19 * Math.sin(time * 0.021 + index * 1.47)
      + 0.13 * Math.sin(time * 0.047 + index * 0.73);
    const level = MIN_LEVEL + envelope * spatialShape * clamp(texture, 0.38, 1);
    return Number(clamp(level, MIN_LEVEL, MAX_LEVEL).toFixed(3));
  });
}
