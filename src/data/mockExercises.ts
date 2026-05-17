import type { LocalizedText } from "../utils/localizedText";

export type ExerciseType =
  | "multiple_choice_meaning"
  | "situation_match"
  | "pair_matching"
  | "sequence_order"
  | "audio_choice"
  | "picture_choice"
  | "personal_memory_recall"
  | "delayed_word_recall"
  | "attention_pattern"
  | "shape_copy_practice"
  | "speech_repeat_practice";

export interface AnswerOption {
  id: string;
  label: LocalizedText;
  value?: string;
  imageUrl?: string;
  accessibilityLabel?: LocalizedText;
}

export interface PairOption {
  id: string;
  left: LocalizedText;
  right: LocalizedText;
}

export interface ExercisePayload {
  audioText?: LocalizedText;
  conceptId?: string;
  items?: AnswerOption[];
  linkedConceptId?: string;
  memoryField?: "topic" | "emotionTag" | "peopleTags" | "placeTag" | "story";
  memoryId?: string;
  options?: AnswerOption[];
  pairs?: PairOption[];
  phase?: "encode" | "recall";
  wordSetId?: string;
  words?: LocalizedText[];
  requiredSelectionCount?: number;
  pattern?: number[];
  phrase?: LocalizedText;
}

export interface Exercise {
  id: string;
  lessonId: string;
  type: ExerciseType;
  prompt: LocalizedText;
  payload: ExercisePayload;
  correctAnswer: string | string[] | null;
  explanation?: LocalizedText;
  difficulty: 1 | 2 | 3 | 4 | 5;
  accessibilityHint?: LocalizedText;
}

export const mockExercises: Exercise[] = [
  {
    id: "ex_1",
    lessonId: "lesson_1",
    type: "delayed_word_recall",
    prompt: {
      ko: "다음 단어 세 개를 잘 기억해두세요. 나중에 다시 물어볼게요.",
      ja: "次の3つの言葉をよく覚えておいてください。あとでまた聞きます。",
      en: "Please remember these three words. I will ask you again later."
    },
    payload: {
      phase: "encode",
      wordSetId: "set_1",
      words: [
        { ko: "비행기", ja: "飛行機", en: "airplane" },
        { ko: "사과", ja: "りんご", en: "apple" },
        { ko: "자전거", ja: "自転車", en: "bicycle" }
      ]
    },
    correctAnswer: null,
    difficulty: 1,
  },
  {
    id: "ex_2",
    lessonId: "lesson_1",
    type: "multiple_choice_meaning",
    prompt: {
      ko: "고진감래와 가장 가까운 뜻은 무엇일까요?",
      ja: "「苦あれば楽あり」に最も近い意味はどれですか？",
      en: "Which meaning is closest to \"good things come after hardship\"?"
    },
    payload: {
      conceptId: "concept_2",
      options: [
        { id: "opt_1", label: { ko: "힘든 일이 지나면 좋은 일이 온다", ja: "つらい時期のあとに良いことが来る", en: "Good things come after a hard time" } },
        { id: "opt_2", label: { ko: "같은 말을 여러 번 반복한다", ja: "同じ言葉を何度も繰り返す", en: "Repeating the same words many times" } },
        { id: "opt_3", label: { ko: "욕심이 너무 많다", ja: "欲張りすぎる", en: "Being too greedy" } },
        { id: "opt_4", label: { ko: "매우 바쁘게 움직인다", ja: "とても忙しく動き回る", en: "Moving around very busily" } }
      ]
    },
    correctAnswer: "opt_1",
    explanation: {
      ko: "고생 끝에 낙이 온다는 의미입니다.",
      ja: "苦労のあとには喜びが来る、という意味です。",
      en: "It means joy can come after hardship."
    },
    difficulty: 1,
  },
  {
    id: "ex_3",
    lessonId: "lesson_1",
    type: "situation_match",
    prompt: {
      ko: "다음 중 '고진감래' 상황은?",
      ja: "次のうち「苦あれば楽あり」に当てはまる場面はどれですか？",
      en: "Which situation matches \"good things come after hardship\"?"
    },
    payload: {
      conceptId: "concept_2",
      options: [
        { id: "opt_1", label: { ko: "오래 연습해서 드디어 노래를 잘하게 됐다", ja: "長く練習して、ようやく歌が上手になった", en: "After practicing for a long time, I finally sang well" } },
        { id: "opt_2", label: { ko: "길에서 우연히 친구를 만났다", ja: "道で偶然友だちに会った", en: "I happened to meet a friend on the street" } },
        { id: "opt_3", label: { ko: "약속 시간에 늦었다", ja: "約束の時間に遅れた", en: "I was late for an appointment" } }
      ]
    },
    correctAnswer: "opt_1",
    explanation: {
      ko: "힘든 연습 시간을 견딘 뒤 좋은 결과가 온 상황이에요.",
      ja: "大変な練習を続けたあとに良い結果が出た場面です。",
      en: "This is a situation where effort over time led to a good result."
    },
    difficulty: 2,
  },
  {
    id: "ex_4",
    lessonId: "lesson_1",
    type: "multiple_choice_meaning",
    prompt: {
      ko: "일석이조와 가장 가까운 뜻은 무엇일까요?",
      ja: "「一石二鳥」に最も近い意味はどれですか？",
      en: "Which meaning is closest to \"two birds with one stone\"?"
    },
    payload: {
      conceptId: "concept_1",
      options: [
        { id: "opt_1", label: { ko: "하나의 행동으로 두 가지 이익을 얻는다", ja: "一つの行動で二つの良いことを得る", en: "Getting two benefits from one action" } },
        { id: "opt_2", label: { ko: "오른쪽 왼쪽 방향을 잡지 못한다", ja: "右左が分からず迷う", en: "Being confused about which way to go" } },
        { id: "opt_3", label: { ko: "결심이 사흘을 가지 못한다", ja: "決心が三日も続かない", en: "A decision does not last three days" } },
        { id: "opt_4", label: { ko: "묻는 말에 엉뚱한 대답을 한다", ja: "聞かれたことと違う答えをする", en: "Giving an answer that misses the question" } }
      ]
    },
    correctAnswer: "opt_1",
    explanation: {
      ko: "돌 하나를 던져 새 두 마리를 잡는다는 뜻입니다.",
      ja: "一つの行動で二つの成果を得る、という意味です。",
      en: "It means getting two results from one action."
    },
    difficulty: 1,
  },
  {
    id: "ex_attention",
    lessonId: "lesson_1",
    type: "attention_pattern",
    prompt: {
      ko: "규칙을 찾아 다음 숫자를 골라보세요.",
      ja: "規則を見つけて、次の数字を選んでください。",
      en: "Find the pattern and choose the next number."
    },
    payload: {
      pattern: [12, 10, 8],
      options: [
        { id: "opt_1", label: "4" },
        { id: "opt_2", label: "5" },
        { id: "opt_3", label: "6" },
        { id: "opt_4", label: "7" }
      ]
    },
    correctAnswer: "opt_3",
    explanation: {
      ko: "2씩 작아지는 규칙이에요. 8 다음은 6입니다.",
      ja: "2ずつ小さくなる規則です。8の次は6です。",
      en: "The numbers go down by 2. After 8 comes 6."
    },
    difficulty: 2,
  },
  {
    id: "ex_5",
    lessonId: "lesson_1",
    type: "pair_matching",
    prompt: {
      ko: "알맞은 짝을 찾아 연결해보세요.",
      ja: "正しい組み合わせを見つけてつないでください。",
      en: "Find and match the correct pairs."
    },
    payload: {
      pairs: [
        { id: "pair_1", left: { ko: "고진감래", ja: "苦あれば楽あり", en: "hardship then joy" }, right: { ko: "힘든 뒤 좋은 일", ja: "苦労のあとに良いこと", en: "good after hardship" } },
        { id: "pair_2", left: { ko: "일석이조", ja: "一石二鳥", en: "two birds with one stone" }, right: { ko: "하나로 두 이익", ja: "一つで二つの良いこと", en: "two gains from one action" } },
        { id: "pair_3", left: { ko: "동문서답", ja: "的外れな答え", en: "missing the point" }, right: { ko: "엉뚱한 답", ja: "質問とずれた答え", en: "off-topic answer" } }
      ]
    },
    correctAnswer: ["pair_1", "pair_2", "pair_3"],
    explanation: {
      ko: "각 사자성어의 뜻을 잘 연결했습니다.",
      ja: "それぞれの言葉の意味を正しく結びました。",
      en: "You matched each expression with the right meaning."
    },
    difficulty: 3,
  },
  {
    id: "ex_shape",
    lessonId: "lesson_1",
    type: "shape_copy_practice",
    prompt: {
      ko: "위의 그림을 보고 아래에 비슷하게 그려보세요.",
      ja: "上の図を見て、下に似た形を描いてください。",
      en: "Look at the shape above and draw a similar one below."
    },
    payload: {},
    correctAnswer: null,
    difficulty: 1,
  },
  {
    id: "ex_speech",
    lessonId: "lesson_1",
    type: "speech_repeat_practice",
    prompt: {
      ko: "이 문장을 소리 내어 따라 읽어보세요.",
      ja: "この文を声に出して読んでみましょう。",
      en: "Please read this sentence aloud."
    },
    payload: {
      phrase: {
        ko: "오늘 날씨가 참 좋습니다.",
        ja: "今日は天気がとてもいいです。",
        en: "The weather is very nice today."
      }
    },
    correctAnswer: null,
    difficulty: 1,
  },
  {
    id: "ex_recall",
    lessonId: "lesson_1",
    type: "delayed_word_recall",
    prompt: {
      ko: "처음에 기억해두었던 세 단어가 무엇이었나요?",
      ja: "最初に覚えた3つの言葉は何でしたか？",
      en: "Which three words did you remember at the beginning?"
    },
    payload: {
      phase: "recall",
      wordSetId: "set_1",
      requiredSelectionCount: 3,
      options: [
        { id: "w_1", label: { ko: "비행기", ja: "飛行機", en: "airplane" } },
        { id: "w_2", label: { ko: "자동차", ja: "自動車", en: "car" } },
        { id: "w_3", label: { ko: "사과", ja: "りんご", en: "apple" } },
        { id: "w_4", label: { ko: "바나나", ja: "バナナ", en: "banana" } },
        { id: "w_5", label: { ko: "자전거", ja: "自転車", en: "bicycle" } },
        { id: "w_6", label: { ko: "기차", ja: "電車", en: "train" } }
      ]
    },
    correctAnswer: ["w_1", "w_3", "w_5"],
    explanation: {
      ko: "맞아요! 비행기, 사과, 자전거였어요.",
      ja: "そうです！飛行機、りんご、自転車でした。",
      en: "That's right! They were airplane, apple, and bicycle."
    },
    difficulty: 3,
  },
  {
    id: "ex_6",
    lessonId: "lesson_1",
    type: "personal_memory_recall",
    prompt: {
      ko: "최근에 떠오르는 하루의 기억을 짧게 말해볼까요? 누구와 있었는지, 어디였는지, 어떤 일이 있었는지 편하게 이야기해 주세요.",
      ja: "最近思い出す一日の出来事を短く話してみましょう。誰といたか、どこにいたか、何があったかを気軽に話してください。",
      en: "Tell a short story about a recent day you remember. Who were you with, where were you, and what happened?"
    },
    payload: {
      linkedConceptId: "daily_memory_1",
      memoryField: "story",
      options: []
    },
    correctAnswer: null,
    explanation: {
      ko: "소중한 이야기를 기억 카드로 저장했어요. 나중에 다시 자연스럽게 떠올려볼게요.",
      ja: "大切なお話を記憶カードに保存しました。あとで自然に思い出してみましょう。",
      en: "Your story was saved as a memory card. We will gently revisit it later."
    },
    difficulty: 1,
  },
  {
    id: "ex_7",
    lessonId: "lesson_1",
    type: "personal_memory_recall",
    prompt: {
      ko: "그때 어떤 기분이 드셨나요?",
      ja: "その時、どんな気持ちでしたか？",
      en: "How did you feel then?"
    },
    payload: {
      linkedConceptId: "daily_memory_1",
      memoryField: "emotionTag",
      options: [
        { id: "opt_happy", label: { ko: "기쁨", ja: "うれしさ", en: "Joy" } },
        { id: "opt_proud", label: { ko: "뿌듯함", ja: "誇らしさ", en: "Pride" } },
        { id: "opt_thankful", label: { ko: "감사함", ja: "ありがたさ", en: "Gratitude" } },
        { id: "opt_relieved", label: { ko: "마음이 놓임", ja: "安心", en: "Relief" } }
      ]
    },
    correctAnswer: null,
    explanation: {
      ko: "그 감정을 정원에 잘 심어두었습니다.",
      ja: "その気持ちを庭にそっと植えておきました。",
      en: "That feeling has been gently planted in your garden."
    },
    difficulty: 1,
  }
];
