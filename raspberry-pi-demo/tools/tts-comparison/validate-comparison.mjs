import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COMPARISON_PROMPT = Object.freeze({
  id: 'exercise.D1_Q1.prompt',
  locale: 'ja',
  text: '春子さん、今日の気分はいかがですか。',
});

const EXPECTED_METHODS = Object.freeze({
  qwen: { inventoryKind: 'finite', inventoryTotal: 9, sampleTotal: 9, directory: 'qwen' },
  'fish-speech': { inventoryKind: 'open-ended', sampleTotal: 10, directory: 'fish' },
  kokoro: { inventoryKind: 'finite', inventoryTotal: 54, sampleTotal: 10, directory: 'kokoro' },
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

export function validateManifestShape(manifest) {
  assert(manifest?.schemaVersion === 1, 'schemaVersion must be 1');
  assert(manifest.prompt?.id === COMPARISON_PROMPT.id
    && manifest.prompt?.locale === COMPARISON_PROMPT.locale
    && manifest.prompt?.text === COMPARISON_PROMPT.text,
  'comparison prompt must match Haru D1_Q1 Japanese copy exactly');
  assert(manifest.audioNormalization?.targetIntegratedLufs === -16, 'target integrated loudness must be -16 LUFS');
  assert(manifest.audioNormalization?.truePeakCeilingDbtp === -1, 'true-peak ceiling must be -1 dBTP');
  assert(manifest.audioNormalization?.toleranceLufs === 2, 'short-utterance loudness tolerance must be 2 LU');
  assert(
    JSON.stringify(manifest.audioEncoding) === JSON.stringify({
      container: 'ogg',
      codec: 'opus',
      bitrateKbps: 48,
      vbr: true,
      compressionLevel: 10,
      channels: 1,
      sourceSampleRateHz: 24000,
      opusDecodeClockHz: 48000,
    }),
    'audio encoding must match Haru production settings',
  );
  assert(Array.isArray(manifest.methods), 'methods must be an array');
  assert(manifest.methods.length === 3, 'exactly three TTS methods are required');

  const methodIds = manifest.methods.map((method) => method.id);
  assert(new Set(methodIds).size === methodIds.length, 'method ids must be unique');
  assert(
    Object.keys(EXPECTED_METHODS).every((id) => methodIds.includes(id)),
    'methods must include qwen, fish-speech, and kokoro',
  );

  const sampleIds = new Set();
  for (const method of manifest.methods) {
    const expected = EXPECTED_METHODS[method.id];
    assert(expected, `unsupported method id: ${method.id}`);
    assert(typeof method.name === 'string' && method.name.length > 0, `${method.id}: name missing`);
    assert(typeof method.model?.id === 'string' && method.model.id.length > 0, `${method.id}: model id missing`);
    assert(typeof method.model?.revision === 'string' && method.model.revision.length > 0, `${method.id}: revision missing`);
    assert(typeof method.model?.license === 'string' && method.model.license.length > 0, `${method.id}: license missing`);
    assert(/^https:\/\//u.test(method.model?.sourceUrl ?? ''), `${method.id}: official source URL missing`);
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
      assert(typeof sample.id === 'string' && sample.id.length > 0, `${method.id}: sample id missing`);
      assert(typeof sample.voice === 'string' && sample.voice.length > 0, `${method.id}: voice missing`);
      assert(typeof sample.label === 'string' && sample.label.length > 0, `${method.id}: label missing`);
      assert(isSafeRelativePath(sample.path, '.ogg'), `${method.id}/${sample.id}: path must be safe and relative`);
      assert(
        sample.path.startsWith(`${expected.directory}/audio/`),
        `${method.id}/${sample.id}: path must stay in method audio directory`,
      );
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
  }

  return manifest;
}

function probeAudio(path) {
  const raw = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_name,channels,sample_rate:format=format_name,duration',
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

export function validateComparison(rootDirectory) {
  const root = resolve(rootDirectory);
  const rootReal = realpathSync.native(root);
  const manifestPath = join(root, 'manifest.json');
  assert(existsSync(manifestPath), `missing comparison manifest: ${manifestPath}`);
  const manifest = validateManifestShape(JSON.parse(readFileSync(manifestPath, 'utf8')));
  const referenced = new Set();
  const loudnessExceptions = [];

  for (const method of manifest.methods) {
    const report = resolve(root, method.reportPath);
    assert(existsSync(report), `${method.id}: missing report ${method.reportPath}`);
    const reportReal = realpathSync.native(report);
    assert(isContained(rootReal, reportReal), `${method.id}: report escapes comparison root`);
    for (const sample of method.samples) {
      const path = resolve(root, sample.path);
      assert(existsSync(path), `${method.id}/${sample.id}: missing audio ${sample.path}`);
      const pathReal = realpathSync.native(path);
      assert(isContained(rootReal, pathReal), `${method.id}/${sample.id}: audio escapes comparison root`);
      assert(sha256(path) === sample.sha256, `${method.id}/${sample.id}: sha256 mismatch`);
      const probe = probeAudio(path);
      const stream = probe.streams?.[0];
      const durationMs = Math.round(Number(probe.format?.duration) * 1000);
      assert(stream?.codec_name === 'opus', `${method.id}/${sample.id}: ffprobe codec mismatch`);
      assert(Number(stream?.channels) === 1, `${method.id}/${sample.id}: ffprobe channels mismatch`);
      // RFC 7845 exposes a fixed 48 kHz Opus decode clock even when source PCM
      // and encoder input are 24 kHz. sourceSampleRateHz records that input.
      assert(Number(stream?.sample_rate) === 48000, `${method.id}/${sample.id}: ffprobe Opus clock mismatch`);
      assert((probe.format?.format_name ?? '').includes('ogg'), `${method.id}/${sample.id}: ffprobe container mismatch`);
      assert(Math.abs(durationMs - sample.durationMs) <= 20, `${method.id}/${sample.id}: duration mismatch`);
      const measurement = measureAudio(path);
      const loudnessDelta = Math.abs(
        measurement.integratedLufs - manifest.audioNormalization.targetIntegratedLufs,
      );
      if (loudnessDelta > manifest.audioNormalization.toleranceLufs) {
        assert(
          sample.normalizationException,
          `${method.id}/${sample.id}: integrated loudness ${measurement.integratedLufs} LUFS outside tolerance`,
        );
        assert(
          measurement.integratedLufs >= -24 && measurement.integratedLufs <= -12,
          `${method.id}/${sample.id}: exceptional loudness ${measurement.integratedLufs} LUFS is unsafe`,
        );
        loudnessExceptions.push(`${method.id}/${sample.id}`);
      }
      assert(
        // Lossy Opus encoding may overshoot the -1 dBTP PCM target. Keep the
        // decoded result below -0.4 dBTP without changing model speaking speed.
        measurement.truePeakDbtp <= manifest.audioNormalization.truePeakCeilingDbtp + 0.6,
        `${method.id}/${sample.id}: true peak ${measurement.truePeakDbtp} dBTP exceeds ceiling`,
      );
      referenced.add(pathIdentity(pathReal));
    }
  }

  const outputOggFiles = Object.values(EXPECTED_METHODS)
    .flatMap((method) => findFiles(join(root, method.directory, 'audio'), '.ogg'));
  const orphaned = outputOggFiles.filter((path) => !referenced.has(pathIdentity(realpathSync.native(path))));
  assert(orphaned.length === 0, `orphaned Ogg files: ${orphaned.map((path) => relative(root, path)).join(', ')}`);
  assert(referenced.size === 29, `expected 29 referenced comparison samples, received ${referenced.size}`);
  assert(loudnessExceptions.length <= 3, `too many loudness exceptions: ${loudnessExceptions.join(', ')}`);
  return { manifest, audioFiles: referenced.size, loudnessExceptions };
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const root = process.argv[2] ? resolve(process.argv[2]) : dirname(fileURLToPath(import.meta.url));
  try {
    const result = validateComparison(root);
    console.log(`TTS comparison valid: ${result.manifest.methods.length} methods, ${result.audioFiles} samples`);
  } catch (error) {
    console.error(`TTS comparison invalid: ${error.message}`);
    process.exitCode = 1;
  }
}
