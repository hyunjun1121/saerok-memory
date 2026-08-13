import { KOREAN_COMPARISON_PROMPT } from './validate-comparison.mjs';

const QWEN_VOICES = [
  'Vivian',
  'Serena',
  'Uncle_Fu',
  'Dylan',
  'Eric',
  'Ryan',
  'Aiden',
  'Ono_Anna',
  'Sohee',
];

function samples(count, prefix, voices = []) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    voice: voices[index] ?? `${prefix}-voice-${index + 1}`,
    label: voices[index] ?? `${prefix} ${index + 1}`,
    path: `${prefix}/audio/${index + 1}.ogg`,
    sha256: 'a'.repeat(64),
    durationMs: 3000,
    codec: 'opus',
    container: 'ogg',
    channels: 1,
    sourceSampleRateHz: 24000,
    sampleRateHz: 48000,
  }));
}

export function validShape() {
  return {
    schemaVersion: 1,
    prompt: KOREAN_COMPARISON_PROMPT,
    audioNormalization: {
      targetIntegratedLufs: -16,
      truePeakCeilingDbtp: -1,
      toleranceLufs: 2,
    },
    audioEncoding: {
      container: 'ogg',
      codec: 'opus',
      bitrateKbps: 48,
      vbr: true,
      compressionLevel: 10,
      channels: 1,
      sourceSampleRateHz: 24000,
      opusDecodeClockHz: 48000,
    },
    methods: [
      {
        id: 'qwen',
        name: 'Qwen3-TTS 한국어 preset 비교',
        model: {
          id: 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice',
          revision: 'revision',
          license: 'Apache-2.0',
          sourceUrl: 'https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice',
        },
        voiceInventory: {
          kind: 'finite',
          total: 9,
          selectionRationale: '공식 preset 아홉 개를 같은 한국어 문장으로 모두 생성했습니다.',
        },
        reportPath: 'qwen/REPORT.md',
        samples: samples(9, 'qwen', QWEN_VOICES),
      },
      {
        id: 'fish-speech',
        name: 'Fish Speech 한국어 reference-free 비교',
        model: {
          id: 'fishaudio/s2-pro',
          revision: 'revision',
          license: 'Fish Audio Research License',
          sourceUrl: 'https://huggingface.co/fishaudio/s2-pro',
        },
        voiceInventory: {
          kind: 'open-ended',
          selectionRationale: '고정 seed 후보 중 기술 검증을 통과한 열 개 timbre를 선정했습니다.',
        },
        reportPath: 'fish/REPORT.md',
        samples: samples(10, 'fish'),
      },
    ],
  };
}
