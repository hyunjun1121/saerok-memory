import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

test('generated bilingual protocol and TTS inventory match the final administered definitions', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'error',
    server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { PILOT_PROTOCOL_VERSION, PILOT_QUESTIONS, PILOT_WEEKDAYS } = await vite.ssrLoadModule('/src/features/pilot/pilotProtocol.ts');
    const { getLocalizedText: local } = await vite.ssrLoadModule('/src/utils/localizedText.ts');
    const document = await readFile('docs/japan-first-meeting-pilot-ja-ko.md', 'utf8');
    const ttsDocument = await readFile('docs/japan-pilot-tts-plan-ja-ko.md', 'utf8');
    const inventory = JSON.parse(await readFile('docs/japan-pilot-tts-inventory.json', 'utf8'));
    assert.equal(inventory.protocolVersion, PILOT_PROTOCOL_VERSION);
    assert.ok(document.includes(PILOT_PROTOCOL_VERSION));
    assert.ok(ttsDocument.includes(PILOT_PROTOCOL_VERSION));
    assert.equal(PILOT_QUESTIONS.length, 9);
    assert.equal(inventory.entryCount, inventory.entries.length);
    assert.equal(inventory.uniqueJapaneseTextCount, new Set(inventory.entries.map(entry => entry.textJa)).size);
    assert.equal(inventory.requiredCount, inventory.entries.filter(entry => entry.priority !== 'optional').length);
    for (const [index, question] of PILOT_QUESTIONS.entries()) {
      const prefix = `q${String(index + 1).padStart(2, '0')}`;
      const main = inventory.entries.find(entry => entry.id === `${prefix}.main`);
      for (const language of ['ja', 'ko']) assert.ok(document.includes(local(question.prompt, language)));
      assert.equal(main.textJa, local(question.prompt, 'ja'));
      assert.equal(main.textKo, local(question.prompt, 'ko'));
      if (question.kind === 'voice') {
        const followUp = inventory.entries.find(entry => entry.id === `${prefix}.follow_up`);
        assert.equal(followUp.textJa, local(question.followUp, 'ja'));
        assert.equal(followUp.conditionalOn, 'facilitator-short-answer-decision');
      } else if (!question.dynamic) {
        for (const option of question.options) {
          const entry = inventory.entries.find(item => item.id === `${prefix}.option_${option.id.toLowerCase()}`);
          assert.equal(entry.textJa, local(option.label, 'ja'));
          assert.equal(entry.textKo, local(option.label, 'ko'));
          assert.ok(document.includes(local(option.label, 'ko')));
        }
      }
    }
    const weekdays = inventory.entries.filter(entry => entry.id.startsWith('q01.weekday_'));
    assert.equal(weekdays.length, 7);
    assert.deepEqual(weekdays.map(entry => entry.textJa), PILOT_WEEKDAYS.map(label => local(label, 'ja')));
    assert.ok(weekdays.every(entry => entry.buttonNumber === null));
    assert.equal(inventory.entries.filter(entry => entry.part === 'main').length, 9);
    assert.equal(inventory.entries.filter(entry => entry.part === 'followUp').length, 5);
    assert.equal(inventory.entries.filter(entry => entry.category === 'option').length, 19);
    assert.ok(!inventory.entries.some(entry => entry.textJa === '今日の気分はいかがですか。'));
  } finally { await vite.close(); }
});
