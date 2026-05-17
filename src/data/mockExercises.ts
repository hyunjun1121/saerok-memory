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
  label: string;
  value?: string;
  imageUrl?: string;
  accessibilityLabel?: string;
}

export interface PairOption {
  id: string;
  left: string;
  right: string;
}

export interface ExercisePayload {
  audioText?: string;
  conceptId?: string;
  items?: AnswerOption[];
  linkedConceptId?: string;
  memoryField?: "topic" | "emotionTag" | "peopleTags" | "placeTag";
  memoryId?: string;
  options?: AnswerOption[];
  pairs?: PairOption[];
  phase?: "encode" | "recall";
  wordSetId?: string;
  words?: string[];
  requiredSelectionCount?: number;
  pattern?: number[];
  phrase?: string;
}

export interface Exercise {
  id: string;
  lessonId: string;
  type: ExerciseType;
  prompt: string;
  payload: ExercisePayload;
  correctAnswer: string | string[] | null;
  explanation?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  accessibilityHint?: string;
}

export const mockExercises: Exercise[] = [
  {
    id: "ex_1",
    lessonId: "lesson_1",
    type: "delayed_word_recall",
    prompt: "다음 단어 세 개를 잘 기억해두세요. 나중에 다시 물어볼게요.",
    payload: {
      phase: "encode",
      wordSetId: "set_1",
      words: ["비행기", "사과", "자전거"]
    },
    correctAnswer: null,
    difficulty: 1,
  },
  {
    id: "ex_2",
    lessonId: "lesson_1",
    type: "multiple_choice_meaning",
    prompt: "고진감래와 가장 가까운 뜻은 무엇일까요?",
    payload: {
      conceptId: "concept_2",
      options: [
        { id: "opt_1", label: "힘든 일이 지나면 좋은 일이 온다" },
        { id: "opt_2", label: "같은 말을 여러 번 반복한다" },
        { id: "opt_3", label: "욕심이 너무 많다" },
        { id: "opt_4", label: "매우 바쁘게 움직인다" }
      ]
    },
    correctAnswer: "opt_1",
    explanation: "고생 끝에 낙이 온다는 의미입니다.",
    difficulty: 1,
  },
  {
    id: "ex_3",
    lessonId: "lesson_1",
    type: "situation_match",
    prompt: "다음 중 '고진감래' 상황은?",
    payload: {
      conceptId: "concept_2",
      options: [
        { id: "opt_1", label: "오래 연습해서 드디어 노래를 잘하게 됐다" },
        { id: "opt_2", label: "길에서 우연히 친구를 만났다" },
        { id: "opt_3", label: "약속 시간에 늦었다" }
      ]
    },
    correctAnswer: "opt_1",
    explanation: "힘든 연습 시간을 견딘 뒤 좋은 결과가 온 상황이에요.",
    difficulty: 2,
  },
  {
    id: "ex_4",
    lessonId: "lesson_1",
    type: "multiple_choice_meaning",
    prompt: "일석이조와 가장 가까운 뜻은 무엇일까요?",
    payload: {
      conceptId: "concept_1",
      options: [
        { id: "opt_1", label: "하나의 행동으로 두 가지 이익을 얻는다" },
        { id: "opt_2", label: "오른쪽 왼쪽 방향을 잡지 못한다" },
        { id: "opt_3", label: "결심이 사흘을 가지 못한다" },
        { id: "opt_4", label: "묻는 말에 엉뚱한 대답을 한다" }
      ]
    },
    correctAnswer: "opt_1",
    explanation: "돌 하나를 던져 새 두 마리를 잡는다는 뜻입니다.",
    difficulty: 1,
  },
  {
    id: "ex_attention",
    lessonId: "lesson_1",
    type: "attention_pattern",
    prompt: "규칙을 찾아 다음 숫자를 골라보세요.",
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
    explanation: "2씩 작아지는 규칙이에요. 8 다음은 6입니다.",
    difficulty: 2,
  },
  {
    id: "ex_5",
    lessonId: "lesson_1",
    type: "pair_matching",
    prompt: "알맞은 짝을 찾아 연결해보세요.",
    payload: {
      pairs: [
        { id: "pair_1", left: "고진감래", right: "힘든 뒤 좋은 일" },
        { id: "pair_2", left: "일석이조", right: "하나로 두 이익" },
        { id: "pair_3", left: "동문서답", right: "엉뚱한 답" }
      ]
    },
    correctAnswer: ["pair_1", "pair_2", "pair_3"],
    explanation: "각 사자성어의 뜻을 잘 연결했습니다.",
    difficulty: 3,
  },
  {
    id: "ex_shape",
    lessonId: "lesson_1",
    type: "shape_copy_practice",
    prompt: "위의 그림을 보고 아래에 비슷하게 그려보세요.",
    payload: {},
    correctAnswer: null,
    difficulty: 1,
  },
  {
    id: "ex_speech",
    lessonId: "lesson_1",
    type: "speech_repeat_practice",
    prompt: "이 문장을 소리 내어 따라 읽어보세요.",
    payload: {
      phrase: "오늘 날씨가 참 좋습니다."
    },
    correctAnswer: null,
    difficulty: 1,
  },
  {
    id: "ex_recall",
    lessonId: "lesson_1",
    type: "delayed_word_recall",
    prompt: "처음에 기억해두었던 세 단어가 무엇이었나요?",
    payload: {
      phase: "recall",
      wordSetId: "set_1",
      requiredSelectionCount: 3,
      options: [
        { id: "w_1", label: "비행기" },
        { id: "w_2", label: "자동차" },
        { id: "w_3", label: "사과" },
        { id: "w_4", label: "바나나" },
        { id: "w_5", label: "자전거" },
        { id: "w_6", label: "기차" }
      ]
    },
    correctAnswer: ["w_1", "w_3", "w_5"],
    explanation: "맞아요! 비행기, 사과, 자전거였어요.",
    difficulty: 3,
  },
  {
    id: "ex_6",
    lessonId: "lesson_1",
    type: "personal_memory_recall",
    prompt: "최근에 '일석이조'라고 느꼈던 순간이 있나요? 어떤 일이 있었나요?",
    payload: {
      linkedConceptId: "concept_1",
      memoryField: "topic",
      options: [
        { id: "opt_family", label: "가족", value: "family" },
        { id: "opt_health", label: "건강", value: "health" },
        { id: "opt_hobby", label: "취미", value: "hobby" },
        { id: "opt_daily", label: "일상", value: "daily_life" }
      ]
    },
    correctAnswer: null, // Any answer is valid for creation
    explanation: "소중한 기억을 공유해주셔서 감사합니다.",
    difficulty: 1,
  },
  {
    id: "ex_7",
    lessonId: "lesson_1",
    type: "personal_memory_recall",
    prompt: "그때 어떤 기분이 드셨나요?",
    payload: {
      linkedConceptId: "concept_1",
      memoryField: "emotionTag",
      options: [
        { id: "opt_happy", label: "기쁨" },
        { id: "opt_proud", label: "뿌듯함" },
        { id: "opt_thankful", label: "감사함" },
        { id: "opt_relieved", label: "마음이 놓임" }
      ]
    },
    correctAnswer: null,
    explanation: "그 감정을 정원에 잘 심어두었습니다.",
    difficulty: 1,
  }
];
