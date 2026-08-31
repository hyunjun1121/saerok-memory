export const MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice";
export const MODEL_REVISION = "0c0e3051f131929182e2c023b9537f8b1c68adfe";

export const VOICE_CONFIG = {
  ko: {
    language: "Korean",
    speaker: "Sohee",
    instruct:
      "따뜻하고 차분한 한국어 여성 안내 음성. 고령자가 편하게 들을 수 있도록 또렷하되 과장하지 말고, 평소보다 약간 느린 속도로 자연스럽게 읽어 주세요.",
  },
  ja: {
    language: "Japanese",
    speaker: "Ono_Anna",
    instruct:
      "温かく落ち着いた日本語の女性案内音声。高齢の方にも聞き取りやすいよう、明瞭に、誇張せず、自然な範囲で少しゆっくり話してください。",
  },
};

export const GUIDANCE_TEXT = {
  "login.nfc.waiting": {
    ko: "카드 리더기에 카드를 대주세요.",
    ja: "カードリーダーにカードをかざしてください。",
  },
  "guide.welcome": {
    ko: "화면과 같은 위치의 네 버튼으로 오늘의 하루를 시작해요.",
    ja: "画面と同じ位置にある4つのボタンで、今日のHaruを始めましょう。",
  },
  "guide.button_test": {
    ko: "화면에서 빛나는 위치와 같은 버튼을 눌러 주세요.",
    ja: "画面で光っている位置と同じボタンを押してください。",
  },
  "guide.choice": {
    ko: "원하는 답과 같은 위치의 버튼을 눌러 주세요.",
    ja: "答えと同じ位置にあるボタンを押してください。",
  },
  "guide.choice_confirm": {
    ko: "선택한 버튼을 한 번 더 누르면 확정돼요.",
    ja: "選んだボタンをもう一度押すと決まります。",
  },
  "guide.sequence": {
    ko: "순서대로 버튼을 고르고, 같은 버튼을 한 번 더 눌러 주세요.",
    ja: "順番にボタンを選び、同じボタンをもう一度押してください。",
  },
  "guide.voice_ready": {
    ko: "오른쪽 버튼을 누르면 편하게 말씀하실 수 있어요.",
    ja: "右側のボタンを押したら、いつものようにお話しください。",
  },
  "guide.voice_recording": {
    ko: "편하게 말씀하세요. 마치면 오른쪽 버튼을 눌러 주세요.",
    ja: "いつものようにお話しください。終わったら右側のボタンを押してください。",
  },
  "guide.voice_review": {
    ko: "다시 말하려면 왼쪽, 이대로 확정하려면 오른쪽 버튼을 눌러 주세요.",
    ja: "話し直すときは左、このまま確定するときは右のボタンを押してください。",
  },
  "guide.feedback": {
    ko: "오른쪽 버튼을 누르면 다음으로 넘어가요.",
    ja: "右側のボタンを押すと次へ進みます。",
  },
  "guide.day_complete": {
    ko: "오늘 하루 활동을 마쳤어요. 함께해 주셔서 고마워요.",
    ja: "今日の活動はこれで終わりです。ご一緒いただき、ありがとうございました。",
  },
  "guide.microphone_unavailable": {
    ko: "마이크를 찾지 못했지만 체험은 계속할 수 있어요.",
    ja: "マイクが見つかりませんが、体験はそのまま続けられます。",
  },
  "feedback.selected": {
    ko: "선택했어요. 같은 버튼을 한 번 더 눌러 주세요.",
    ja: "選びました。同じボタンをもう一度押してください。",
  },
  "feedback.saved": {
    ko: "잘 남겼어요.",
    ja: "きちんと残せました。",
  },
  "feedback.try_again": {
    ko: "괜찮아요. 천천히 다시 해봐요.",
    ja: "大丈夫です。ゆっくり、もう一度やってみましょう。",
  },
  "action.replay": { ko: "다시 듣기", ja: "もう一度聞く" },
  "action.back": { ko: "뒤로 가기", ja: "戻る" },
  "action.next": { ko: "다음으로", ja: "次へ" },
  "action.start": { ko: "시작하기", ja: "始める" },
  "action.finish": { ko: "마치기", ja: "終わる" },
  "action.retry": { ko: "다시 하기", ja: "やり直す" },
  "action.reset": { ko: "처음부터", ja: "最初から" },
  "action.confirm": { ko: "확정하기", ja: "決める" },
};

function localize(value, locale) {
  if (typeof value === "string") return value;
  const text = value?.[locale] ?? value?.ko ?? value?.ja;
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error(`Missing ${locale} text in narration source`);
  }
  return text.trim();
}

function addLocalized(entries, id, value) {
  for (const locale of ["ko", "ja"]) {
    entries.push({ id, locale, text: localize(value, locale) });
  }
}

const SHAPE_SPEECH = {
  "● ▲": { ko: "동그라미, 세모", ja: "丸、三角" },
  "▲ ●": { ko: "세모, 동그라미", ja: "三角、丸" },
  "● ●": { ko: "동그라미, 동그라미", ja: "丸、丸" },
  "▲ ▲": { ko: "세모, 세모", ja: "三角、三角" },
};

function narrationLabel(choice) {
  const korean = localize(choice.label, "ko");
  const spokenShape = SHAPE_SPEECH[korean];
  return spokenShape ?? choice.label;
}

export function buildNarrationSource(exercises, weekPlan) {
  if (!Array.isArray(exercises) || exercises.length !== 42) {
    throw new Error(`Expected exactly 42 Haru exercises, received ${exercises?.length ?? "invalid"}`);
  }
  if (!Array.isArray(weekPlan) || weekPlan.length !== 7) {
    throw new Error(`Expected exactly 7 Haru day plans, received ${weekPlan?.length ?? "invalid"}`);
  }

  const entries = [];
  const exerciseIds = new Set();
  for (const exercise of exercises) {
    if (exerciseIds.has(exercise.id)) throw new Error(`Duplicate exercise id: ${exercise.id}`);
    exerciseIds.add(exercise.id);
    addLocalized(entries, `exercise.${exercise.id}.prompt`, exercise.prompt);

    const choices = exercise.payload?.options ?? exercise.payload?.items ?? [];
    if (choices.length !== 0 && choices.length !== 4) {
      throw new Error(`Exercise ${exercise.id} must expose zero or four physical-button choices`);
    }
    for (const choice of choices) {
      addLocalized(entries, `exercise.${exercise.id}.option.${choice.id}`, narrationLabel(choice));
    }
    if (exercise.type === "sequence_order") {
      const orderedIds = Array.isArray(exercise.correctAnswer) ? exercise.correctAnswer : [];
      const orderedChoices = orderedIds.map((id) => choices.find((choice) => choice.id === id));
      if (orderedChoices.some((choice) => !choice)) {
        throw new Error(`Exercise ${exercise.id} has an invalid authored sequence`);
      }
      addLocalized(entries, `exercise.${exercise.id}.sequence`, {
        ko: orderedChoices.map((choice) => localize(choice.label, "ko")).join(", "),
        ja: orderedChoices.map((choice) => localize(choice.label, "ja")).join("、"),
      });
    }
  }

  for (const day of weekPlan) {
    addLocalized(entries, `day.${day.day}.title`, day.title);
    addLocalized(entries, `day.${day.day}.greeting`, day.greeting);
    addLocalized(entries, `day.${day.day}.completion`, day.completionMessage);
  }

  for (const [id, text] of Object.entries(GUIDANCE_TEXT)) addLocalized(entries, id, text);

  entries.sort((left, right) =>
    left.locale.localeCompare(right.locale) || left.id.localeCompare(right.id),
  );
  const seen = new Set();
  for (const entry of entries) {
    const key = `${entry.locale}:${entry.id}`;
    if (seen.has(key)) throw new Error(`Duplicate narration source entry: ${key}`);
    seen.add(key);
  }

  return {
    schemaVersion: 1,
    model: {
      id: MODEL_ID,
      revision: MODEL_REVISION,
      license: "Apache-2.0",
      sourceUrl: `https://huggingface.co/${MODEL_ID}`,
      voices: VOICE_CONFIG,
    },
    entries,
  };
}
