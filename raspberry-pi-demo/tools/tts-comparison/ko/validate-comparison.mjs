import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KOREAN_COMPARISON_PROMPT = Object.freeze({
  id: 'exercise.D1_Q1.prompt',
  locale: 'ko',
  text: '영자 어르신, 오늘 기분은 어떠세요?',
});

export const FISH_VISIBLE_ATTRIBUTION = 'Built with Fish Audio';
export const FISH_REQUIRED_NOTICE = 'This model is licensed under the Fish Audio Research License, Copyright © 39 AI, INC. All Rights Reserved.';

const QWEN_VOICES = Object.freeze([
  'Vivian',
  'Serena',
  'Uncle_Fu',
  'Dylan',
  'Eric',
  'Ryan',
  'Aiden',
  'Ono_Anna',
  'Sohee',
]);

const EXPECTED_METHODS = Object.freeze({
  qwen: Object.freeze({
    directory: 'qwen',
    inventoryKind: 'finite',
    inventoryTotal: 9,
    sampleTotal: 9,
    modelId: 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice',
    license: 'Apache-2.0',
    sourceUrl: 'https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice',
  }),
  'fish-speech': Object.freeze({
    directory: 'fish',
    inventoryKind: 'open-ended',
    sampleTotal: 10,
    modelId: 'fishaudio/s2-pro',
    license: 'Fish Audio Research License',
    sourceUrl: 'https://huggingface.co/fishaudio/s2-pro',
  }),
});

const EXPECTED_ENCODING = Object.freeze({
  container: 'ogg',
  codec: 'opus',
  bitrateKbps: 48,
  vbr: true,
  compressionLevel: 10,
  channels: 1,
  sourceSampleRateHz: 24000,
  opusDecodeClockHz: 48000,
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeRoot(rootDirectory) {
  if (rootDirectory instanceof URL) return fileURLToPath(rootDirectory);
  return resolve(rootDirectory);
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function isSafeRelativePath(path, extension) {
  return typeof path === 'string'
    && path.length > 0
    && !isAbsolute(path)
    && !/^[A-Za-z]:/u.test(path)
    && !path.includes(':')
    && !path.includes('\\')
    && path.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..')
    && path.toLowerCase().endsWith(extension);
}

function isContained(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === ''
    || (!isAbsolute(pathFromRoot)
      && pathFromRoot !== '..'
      && !pathFromRoot.startsWith(`..${sep}`));
}

function pathIdentity(path) {
  return process.platform === 'win32' ? path.toLowerCase() : path;
}

function assertExactPrompt(prompt) {
  assert(
    prompt?.id === KOREAN_COMPARISON_PROMPT.id
      && prompt?.locale === KOREAN_COMPARISON_PROMPT.locale
      && prompt?.text === KOREAN_COMPARISON_PROMPT.text,
    'comparison prompt must match Haru D1_Q1 Korean copy exactly',
  );
}

function validateSample(method, expected, sample, sampleIds, voices, paths) {
  assert(typeof sample.id === 'string' && sample.id.length > 0, `${method.id}: sample id missing`);
  assert(typeof sample.voice === 'string' && sample.voice.length > 0, `${method.id}: voice missing`);
  assert(typeof sample.label === 'string' && sample.label.length > 0, `${method.id}: label missing`);
  assert(isSafeRelativePath(sample.path, '.ogg'), `${method.id}/${sample.id}: path must be safe and relative`);
  assert(
    sample.path.startsWith(`${expected.directory}/audio/`),
    `${method.id}/${sample.id}: path must stay in method audio directory`,
  );
  if (sample.wavPath !== undefined) {
    assert(isSafeRelativePath(sample.wavPath, '.wav'), `${method.id}/${sample.id}: wavPath must be safe and relative`);
    assert(
      sample.wavPath.startsWith(`${expected.directory}/audio/`),
      `${method.id}/${sample.id}: wavPath must stay in method audio directory`,
    );
  }
  assert(/^[a-f0-9]{64}$/u.test(sample.sha256 ?? ''), `${method.id}/${sample.id}: invalid sha256`);
  assert(
    Number.isInteger(sample.durationMs) && sample.durationMs >= 1200 && sample.durationMs <= 10000,
    `${method.id}/${sample.id}: durationMs must stay within 1.2-10 seconds`,
  );
  assert(sample.codec === 'opus', `${method.id}/${sample.id}: codec must be opus`);
  assert(sample.container === 'ogg', `${method.id}/${sample.id}: container must be ogg`);
  assert(sample.channels === 1, `${method.id}/${sample.id}: channels must be 1`);
  assert(sample.sourceSampleRateHz === 24000, `${method.id}/${sample.id}: sourceSampleRateHz must be 24000`);
  assert(sample.sampleRateHz === 48000, `${method.id}/${sample.id}: Opus decode clock must be 48000 Hz`);
  if (sample.normalizationException !== undefined) {
    assert(
      typeof sample.normalizationException === 'string' && sample.normalizationException.length >= 30,
      `${method.id}/${sample.id}: normalizationException needs an explicit reason`,
    );
  }
  assert(!voices.has(sample.voice), `${method.id}: duplicate voice ${sample.voice}`);
  assert(!paths.has(sample.path), `${method.id}: duplicate path ${sample.path}`);
  assert(!sampleIds.has(sample.id), `${method.id}: duplicate sample id ${sample.id}`);
  voices.add(sample.voice);
  paths.add(sample.path);
  sampleIds.add(sample.id);
}

export function validateManifestShape(manifest) {
  assert(manifest?.schemaVersion === 1, 'schemaVersion must be 1');
  assertExactPrompt(manifest.prompt);
  assert(manifest.audioNormalization?.targetIntegratedLufs === -16, 'target integrated loudness must be -16 LUFS');
  assert(manifest.audioNormalization?.truePeakCeilingDbtp === -1, 'true-peak ceiling must be -1 dBTP');
  assert(manifest.audioNormalization?.toleranceLufs === 2, 'short-utterance loudness tolerance must be 2 LU');
  assert(
    JSON.stringify(manifest.audioEncoding) === JSON.stringify(EXPECTED_ENCODING),
    'audio encoding must match Haru production settings',
  );
  assert(Array.isArray(manifest.methods), 'methods must be an array');
  assert(manifest.methods.length === 2, 'exactly two TTS methods are required');
  const methodIds = manifest.methods.map((method) => method.id);
  assert(
    JSON.stringify(methodIds) === JSON.stringify(['qwen', 'fish-speech']),
    'methods must include only qwen and fish-speech in that order',
  );

  const sampleIds = new Set();
  for (const method of manifest.methods) {
    const expected = EXPECTED_METHODS[method.id];
    assert(expected, `unsupported method id: ${method.id}`);
    assert(typeof method.name === 'string' && method.name.length > 0, `${method.id}: name missing`);
    assert(method.model?.id === expected.modelId, `${method.id}: model id mismatch`);
    assert(typeof method.model?.revision === 'string' && method.model.revision.length > 0, `${method.id}: revision missing`);
    assert(method.model?.license === expected.license, `${method.id}: license mismatch`);
    assert(method.model?.sourceUrl === expected.sourceUrl, `${method.id}: official source URL mismatch`);
    assert(method.voiceInventory?.kind === expected.inventoryKind, `${method.id}: inventory kind mismatch`);
    if (expected.inventoryTotal !== undefined) {
      assert(method.voiceInventory.total === expected.inventoryTotal, `${method.id}: inventory total mismatch`);
    }
    assert(
      typeof method.voiceInventory?.selectionRationale === 'string'
        && method.voiceInventory.selectionRationale.length >= 20,
      `${method.id}: selection rationale missing`,
    );
    assert(Array.isArray(method.samples), `${method.id}: samples must be an array`);
    assert(method.samples.length === expected.sampleTotal, `${method.id}: expected ${expected.sampleTotal} samples`);
    assert(isSafeRelativePath(method.reportPath, '.md'), `${method.id}: reportPath must be safe and relative`);
    assert(method.reportPath === `${expected.directory}/REPORT.md`, `${method.id}: reportPath must use its method directory`);

    const voices = new Set();
    const paths = new Set();
    for (const sample of method.samples) {
      validateSample(method, expected, sample, sampleIds, voices, paths);
    }
    if (method.id === 'qwen') {
      assert(
        QWEN_VOICES.every((voice) => voices.has(voice)),
        'qwen: samples must contain all 9 official preset voices',
      );
    }
  }
  return manifest;
}

function probeAudio(path) {
  const raw = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_name,channels,sample_rate:format=format_name,duration,size',
    '-of', 'json',
    path,
  ], { encoding: 'utf8' });
  return JSON.parse(raw);
}

function measureAudio(path) {
  const result = spawnSync('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i', path,
    '-filter_complex', 'ebur128=peak=true',
    '-f', 'null',
    process.platform === 'win32' ? 'NUL' : '/dev/null',
  ], { encoding: 'utf8' });
  assert(result.status === 0, `ffmpeg loudness measurement failed: ${path}`);
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const integrated = [...output.matchAll(/I:\s*(-?[0-9.]+) LUFS/gu)];
  const peaks = [...output.matchAll(/Peak:\s*(-?[0-9.]+) dBFS/gu)];
  assert(integrated.length > 0 && peaks.length > 0, `could not parse loudness measurement: ${path}`);
  return {
    integratedLufs: Number(integrated.at(-1)[1]),
    truePeakDbtp: Number(peaks.at(-1)[1]),
  };
}

function findFiles(root, extension) {
  if (!existsSync(root)) return [];
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...findFiles(path, extension));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) result.push(path);
  }
  return result;
}

function existingContainedFile(rootReal, root, relativePath, label) {
  const lexicalPath = resolve(root, relativePath);
  assert(existsSync(lexicalPath), `missing ${label}: ${relativePath}`);
  const realPath = realpathSync.native(lexicalPath);
  assert(isContained(rootReal, realPath), `${label} escapes comparison root: ${relativePath}`);
  assert(statSync(realPath).isFile(), `${label} must be a regular file: ${relativePath}`);
  return realPath;
}

function validateFishNotices(root, rootReal) {
  const licensePath = existingContainedFile(rootReal, root, 'fish/LICENSE', 'Fish license');
  const noticePath = existingContainedFile(rootReal, root, 'fish/NOTICE.txt', 'Fish notice');
  const license = readFileSync(licensePath, 'utf8');
  const notice = readFileSync(noticePath, 'utf8');
  assert(license.includes('# FISH AUDIO RESEARCH LICENSE AGREEMENT'), 'Fish license agreement heading missing');
  assert(
    license.includes('Any use of the Fish Audio Materials or Derivative Works for a Commercial Purpose requires a separate written license agreement from Fish Audio.'),
    'Fish commercial-license clause missing',
  );
  assert(notice.includes(FISH_REQUIRED_NOTICE), 'Fish required attribution notice mismatch');
  assert(notice.includes('Source revision:'), 'Fish source revision missing from NOTICE');
  assert(notice.includes('Model revision:'), 'Fish model revision missing from NOTICE');
}

export function validateComparison(rootDirectory = new URL('.', import.meta.url)) {
  const root = normalizeRoot(rootDirectory);
  const rootReal = realpathSync.native(root);
  const manifestPath = join(root, 'manifest.json');
  assert(existsSync(manifestPath), `missing comparison manifest: ${manifestPath}`);
  const manifest = validateManifestShape(JSON.parse(readFileSync(manifestPath, 'utf8')));
  const referencedOgg = new Set();
  const referencedWav = new Set();
  const loudnessExceptions = [];

  for (const method of manifest.methods) {
    const expected = EXPECTED_METHODS[method.id];
    existingContainedFile(rootReal, root, method.reportPath, `${method.id} report`);
    for (const sample of method.samples) {
      const oggPath = existingContainedFile(rootReal, root, sample.path, `${method.id}/${sample.id} OGG`);
      assert(sha256(oggPath) === sample.sha256, `${method.id}/${sample.id}: sha256 mismatch`);
      const oggProbe = probeAudio(oggPath);
      const oggStream = oggProbe.streams?.[0];
      const durationMs = Math.round(Number(oggProbe.format?.duration) * 1000);
      assert(oggStream?.codec_name === 'opus', `${method.id}/${sample.id}: ffprobe codec mismatch`);
      assert(Number(oggStream?.channels) === 1, `${method.id}/${sample.id}: ffprobe channels mismatch`);
      assert(Number(oggStream?.sample_rate) === 48000, `${method.id}/${sample.id}: ffprobe Opus clock mismatch`);
      assert((oggProbe.format?.format_name ?? '').includes('ogg'), `${method.id}/${sample.id}: ffprobe container mismatch`);
      assert(Math.abs(durationMs - sample.durationMs) <= 20, `${method.id}/${sample.id}: duration mismatch`);

      const wavRelative = sample.wavPath ?? sample.path.replace(/\.ogg$/iu, '.wav');
      assert(isSafeRelativePath(wavRelative, '.wav'), `${method.id}/${sample.id}: derived WAV path unsafe`);
      assert(wavRelative.startsWith(`${expected.directory}/audio/`), `${method.id}/${sample.id}: WAV path outside method audio directory`);
      const wavPath = existingContainedFile(rootReal, root, wavRelative, `${method.id}/${sample.id} WAV`);
      const wavProbe = probeAudio(wavPath);
      const wavStream = wavProbe.streams?.[0];
      const wavDurationMs = Math.round(Number(wavProbe.format?.duration) * 1000);
      assert(/^pcm_/u.test(wavStream?.codec_name ?? ''), `${method.id}/${sample.id}: WAV must use PCM`);
      assert(Number(wavStream?.channels) === 1, `${method.id}/${sample.id}: WAV channels mismatch`);
      assert(Number(wavStream?.sample_rate) === 24000, `${method.id}/${sample.id}: WAV sample rate mismatch`);
      assert((wavProbe.format?.format_name ?? '').includes('wav'), `${method.id}/${sample.id}: WAV container mismatch`);
      assert(wavDurationMs > 0, `${method.id}/${sample.id}: WAV duration must be positive`);
      assert(Math.abs(wavDurationMs - durationMs) <= 100, `${method.id}/${sample.id}: WAV/OGG duration mismatch`);

      const measurement = measureAudio(oggPath);
      const loudnessDelta = Math.abs(
        measurement.integratedLufs - manifest.audioNormalization.targetIntegratedLufs,
      );
      if (loudnessDelta > manifest.audioNormalization.toleranceLufs) {
        assert(sample.normalizationException, `${method.id}/${sample.id}: loudness exception reason missing`);
        assert(
          measurement.integratedLufs >= -24 && measurement.integratedLufs <= -12,
          `${method.id}/${sample.id}: exceptional loudness ${measurement.integratedLufs} LUFS is unsafe`,
        );
        loudnessExceptions.push(`${method.id}/${sample.id}`);
      }
      assert(
        measurement.truePeakDbtp <= manifest.audioNormalization.truePeakCeilingDbtp + 0.6,
        `${method.id}/${sample.id}: true peak ${measurement.truePeakDbtp} dBTP exceeds ceiling`,
      );
      if (Number.isFinite(sample.integratedLufs)) {
        assert(Math.abs(sample.integratedLufs - measurement.integratedLufs) <= 0.11, `${method.id}/${sample.id}: stored LUFS mismatch`);
      }
      if (Number.isFinite(sample.truePeakDbtp)) {
        assert(Math.abs(sample.truePeakDbtp - measurement.truePeakDbtp) <= 0.11, `${method.id}/${sample.id}: stored true peak mismatch`);
      }
      referencedOgg.add(pathIdentity(oggPath));
      referencedWav.add(pathIdentity(wavPath));
    }
  }

  validateFishNotices(root, rootReal);
  const outputOgg = Object.values(EXPECTED_METHODS)
    .flatMap((method) => findFiles(join(root, method.directory, 'audio'), '.ogg'));
  const outputWav = Object.values(EXPECTED_METHODS)
    .flatMap((method) => findFiles(join(root, method.directory, 'audio'), '.wav'));
  const orphanedOgg = outputOgg.filter((path) => !referencedOgg.has(pathIdentity(realpathSync.native(path))));
  const orphanedWav = outputWav.filter((path) => !referencedWav.has(pathIdentity(realpathSync.native(path))));
  assert(orphanedOgg.length === 0, `orphaned OGG files: ${orphanedOgg.map((path) => relative(root, path)).join(', ')}`);
  assert(orphanedWav.length === 0, `orphaned WAV files: ${orphanedWav.map((path) => relative(root, path)).join(', ')}`);
  assert(referencedOgg.size === 19, `expected 19 referenced OGG samples, received ${referencedOgg.size}`);
  assert(referencedWav.size === 19, `expected 19 referenced WAV samples, received ${referencedWav.size}`);
  return {
    manifest,
    audioFiles: referencedOgg.size,
    wavFiles: referencedWav.size,
    loudnessExceptions,
  };
}

export function validatePlayerAttribution(rootDirectory = new URL('.', import.meta.url)) {
  const root = normalizeRoot(rootDirectory);
  const indexPath = join(root, 'index.html');
  assert(existsSync(indexPath), 'player index.html missing');
  const html = readFileSync(indexPath, 'utf8');
  assert(/<html lang="ko">/u.test(html), 'player must declare Korean language');
  assert(html.includes(KOREAN_COMPARISON_PROMPT.text), 'player Korean prompt missing');
  assert(html.includes(`>${FISH_VISIBLE_ATTRIBUTION}<`), 'visible Fish attribution mismatch');
  assert(/href="fish\/LICENSE"/u.test(html), 'Fish license link missing');
  assert(/href="fish\/NOTICE\.txt"/u.test(html), 'Fish notice link missing');
  assert(!/Kokoro/iu.test(html), 'Kokoro must not appear in Korean comparison');
  assert((html.match(/<audio /gu) ?? []).length === 19, 'player must contain exactly 19 audio controls');
  return true;
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  try {
    const result = validateComparison();
    console.log(`Korean TTS comparison valid: 2 methods, ${result.audioFiles} OGG + ${result.wavFiles} WAV samples`);
  } catch (error) {
    console.error(`Korean TTS comparison invalid: ${error.message}`);
    process.exitCode = 1;
  }
}
