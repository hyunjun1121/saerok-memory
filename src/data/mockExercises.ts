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
  | "digit_span_practice"
  | "verbal_fluency_practice"
  | "trail_switching_practice"
  | "stroop_touch_practice"
  | "orientation_practice"
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

export interface TrailNode {
  id: string;
  label: LocalizedText;
  group: "number" | "symbol";
  x: number;
  y: number;
}

export type StroopColor = "red" | "blue" | "green" | "yellow";

export interface StroopTrial {
  id: string;
  word: LocalizedText;
  inkColor: StroopColor;
}

export interface WordCategoryCue {
  word: LocalizedText;
  category: LocalizedText;
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
  wordCategoryCues?: WordCategoryCue[];
  requiredSelectionCount?: number;
  plannedDelayMinutes?: number;
  pattern?: number[];
  phrase?: LocalizedText;
  digits?: string[];
  direction?: "forward" | "backward";
  fluencyCategory?: LocalizedText;
  durationSeconds?: number;
  trailNodes?: TrailNode[];
  expectedTrail?: string[];
  stroopTrials?: StroopTrial[];
  stroopColorOptions?: StroopColor[];
  orientationKind?: "date_weekday";
  targetDateISO?: string;
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
      ko: "다음 단어 다섯 가지를 잘 기억해 두세요. 잠시 후 다시 물어볼게요.",
      ja: "次の五つの言葉を覚えてください。あとでもう一度たずねます。",
      en: "Please remember these five words. I will ask you again later.",
    },
    payload: {
      phase: "encode",
      wordSetId: "set_1",
      plannedDelayMinutes: 3,
      words: [
        { ko: "연필", ja: "鉛筆", en: "pencil" },
        { ko: "사과", ja: "りんご", en: "apple" },
        { ko: "버스", ja: "バス", en: "bus" },
        { ko: "꽃", ja: "花", en: "flower" },
        { ko: "우산", ja: "傘", en: "umbrella" },
      ],
      wordCategoryCues: [
        {
          word: { ko: "연필", ja: "鉛筆", en: "pencil" },
          category: { ko: "쓰는 물건", ja: "書く道具", en: "writing tool" },
        },
        {
          word: { ko: "사과", ja: "りんご", en: "apple" },
          category: { ko: "과일", ja: "果物", en: "fruit" },
        },
        {
          word: { ko: "버스", ja: "バス", en: "bus" },
          category: { ko: "탈것", ja: "乗り物", en: "vehicle" },
        },
        {
          word: { ko: "꽃", ja: "花", en: "flower" },
          category: { ko: "식물", ja: "植物", en: "plant" },
        },
        {
          word: { ko: "우산", ja: "傘", en: "umbrella" },
          category: { ko: "비 오는 날 쓰는 물건", ja: "雨の日に使う物", en: "rainy-day item" },
        },
      ],
    },
    correctAnswer: null,
    difficulty: 1,
  },
  {
    id: "ex_2",
    lessonId: "lesson_1",
    type: "multiple_choice_meaning",
    prompt: {
      ko: "'고진감래'와 가장 가까운 뜻은 무엇일까요?",
      ja: "「苦あれば楽あり」に近い意味はどれでしょうか。",
      en: "Which meaning is closest to \"good things come after hardship\"?",
    },
    payload: {
      conceptId: "concept_2",
      options: [
        { id: "opt_1", label: { ko: "힘든 일이 지나면 좋은 일이 온다", ja: "つらい時期のあとに良いことが来る", en: "Good things come after a hard time" } },
        { id: "opt_2", label: { ko: "같은 말을 여러 번 반복한다", ja: "同じ言葉を何度も繰り返す", en: "Repeating the same words many times" } },
        { id: "opt_3", label: { ko: "욕심이 너무 많다", ja: "欲張りすぎる", en: "Being too greedy" } },
        { id: "opt_4", label: { ko: "매우 바쁘게 움직인다", ja: "とても忙しく動き回る", en: "Moving around very busily" } },
      ],
    },
    correctAnswer: "opt_1",
    explanation: {
      ko: "고생 끝에 즐거운 일이 온다는 뜻입니다.",
      ja: "苦労したあとに良いことが来る、という意味です。",
      en: "It means joy can come after hardship.",
    },
    difficulty: 1,
  },
  {
    id: "ex_3",
    lessonId: "lesson_1",
    type: "situation_match",
    prompt: {
      ko: "다음 중 '고진감래'와 어울리는 상황은 무엇일까요?",
      ja: "次のうち「苦あれば楽あり」に合う場面はどれでしょうか。",
      en: "Which situation matches \"good things come after hardship\"?",
    },
    payload: {
      conceptId: "concept_2",
      options: [
        { id: "opt_1", label: { ko: "오래 연습해서 드디어 노래를 잘하게 됐다", ja: "長く練習して、ようやく歌が上手になった", en: "After practicing for a long time, I finally sang well" } },
        { id: "opt_2", label: { ko: "길에서 우연히 친구를 만났다", ja: "道で偶然友だちに会った", en: "I happened to meet a friend on the street" } },
        { id: "opt_3", label: { ko: "약속 시간에 늦었다", ja: "約束の時間に遅れた", en: "I was late for an appointment" } },
      ],
    },
    correctAnswer: "opt_1",
    explanation: {
      ko: "힘든 연습 뒤에 좋은 결과가 온 상황입니다.",
      ja: "努力のあとに良い結果が来た場面です。",
      en: "This is a situation where effort over time led to a good result.",
    },
    difficulty: 2,
  },
  {
    id: "ex_4",
    lessonId: "lesson_1",
    type: "multiple_choice_meaning",
    prompt: {
      ko: "'일석이조'와 가장 가까운 뜻은 무엇일까요?",
      ja: "「一石二鳥」に近い意味はどれでしょうか。",
      en: "Which meaning is closest to \"two birds with one stone\"?",
    },
    payload: {
      conceptId: "concept_1",
      options: [
        { id: "opt_1", label: { ko: "하나의 행동으로 두 가지 이익을 얻는다", ja: "一つの行動で二つの良いことを得る", en: "Getting two benefits from one action" } },
        { id: "opt_2", label: { ko: "방향을 잡지 못하고 망설인다", ja: "方向が分からず迷う", en: "Being confused about which way to go" } },
        { id: "opt_3", label: { ko: "결심이 오래가지 못한다", ja: "決心が長く続かない", en: "A decision does not last long" } },
        { id: "opt_4", label: { ko: "묻는 말에 엉뚱하게 답한다", ja: "聞かれたことと違う答えをする", en: "Giving an answer that misses the question" } },
      ],
    },
    correctAnswer: "opt_1",
    explanation: {
      ko: "한 번의 행동으로 두 가지 좋은 결과를 얻는다는 뜻입니다.",
      ja: "一つの行動で二つの良い結果を得る、という意味です。",
      en: "It means getting two results from one action.",
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
      en: "Find the pattern and choose the next number.",
    },
    payload: {
      pattern: [12, 10, 8],
      options: [
        { id: "opt_1", label: "4" },
        { id: "opt_2", label: "5" },
        { id: "opt_3", label: "6" },
        { id: "opt_4", label: "7" },
      ],
    },
    correctAnswer: "opt_3",
    explanation: {
      ko: "2씩 작아지는 규칙입니다. 8 다음은 6입니다.",
      ja: "2ずつ小さくなる規則です。8の次は6です。",
      en: "The numbers go down by 2. After 8 comes 6.",
    },
    difficulty: 2,
  },
  {
    id: "ex_digit_span",
    lessonId: "lesson_1",
    type: "digit_span_practice",
    prompt: {
      ko: "숫자를 기억한 뒤 거꾸로 눌러보세요.",
      ja: "数字を覚えて、逆の順番で押してください。",
      en: "Remember the numbers, then tap them in reverse order.",
    },
    payload: {
      digits: ["4", "8", "2"],
      direction: "backward",
    },
    correctAnswer: ["2", "8", "4"],
    explanation: {
      ko: "작업기억을 가볍게 쓰는 연습입니다. 정답보다 천천히 다시 시도하는 흐름이 중요합니다.",
      ja: "ワーキングメモリを軽く使う練習です。正解だけでなく、落ち着いてもう一度試す流れを大切にします。",
      en: "This is a light working-memory practice. The goal is a calm retry flow, not a medical score.",
    },
    difficulty: 2,
  },
  {
    id: "ex_orientation",
    lessonId: "lesson_1",
    type: "orientation_practice",
    prompt: {
      ko: "오늘 날짜와 요일로 가장 알맞은 것을 골라보세요.",
      ja: "今日の日付と曜日として、いちばん合うものを選んでください。",
      en: "Choose the date and weekday that best match today.",
    },
    payload: {
      orientationKind: "date_weekday",
    },
    correctAnswer: null,
    explanation: {
      ko: "오늘의 날짜 감각을 가볍게 확인하는 루틴입니다. 결과는 진단 점수가 아니라 활동 기록으로만 저장됩니다.",
      ja: "今日の日付の感覚を軽く確かめるルーティンです。結果は診断点ではなく活動記録として保存されます。",
      en: "This is a light date-awareness routine. The result is stored only as an activity record, not as a diagnostic score.",
    },
    difficulty: 1,
  },
  {
    id: "ex_verbal_fluency",
    lessonId: "lesson_1",
    type: "verbal_fluency_practice",
    prompt: {
      ko: "떠오르는 동물 이름을 가능한 만큼 말하거나 적어보세요.",
      ja: "思いつく動物の名前を、できるだけ話すか書いてみましょう。",
      en: "Say or write as many animal names as you can think of.",
    },
    payload: {
      fluencyCategory: {
        ko: "동물",
        ja: "動物",
        en: "animals",
      },
      durationSeconds: 30,
    },
    correctAnswer: null,
    explanation: {
      ko: "범주 안에서 단어를 떠올리는 언어 유창성 연습입니다. 결과는 진단 점수가 아니라 오늘의 활동 기록으로만 저장됩니다.",
      ja: "カテゴリー内の言葉を思い出す言語流暢性の練習です。結果は診断点ではなく、今日の活動記録として保存されます。",
      en: "This is a language fluency routine for recalling words in a category. The result is stored as today's activity record, not as a diagnostic score.",
    },
    difficulty: 2,
  },
  {
    id: "ex_trail_switching",
    lessonId: "lesson_1",
    type: "trail_switching_practice",
    prompt: {
      ko: "숫자와 그림 단서를 번갈아 눌러 길을 완성해 보세요.",
      ja: "数字と絵の手がかりを交互に押して、道を完成させましょう。",
      en: "Alternate between numbers and picture cues to complete the path.",
    },
    payload: {
      trailNodes: [
        { id: "n1", label: "1", group: "number", x: 16, y: 20 },
        { id: "s1", label: { ko: "꽃", ja: "花", en: "flower" }, group: "symbol", x: 74, y: 18 },
        { id: "n2", label: "2", group: "number", x: 54, y: 42 },
        { id: "s2", label: { ko: "잎", ja: "葉", en: "leaf" }, group: "symbol", x: 22, y: 60 },
        { id: "n3", label: "3", group: "number", x: 70, y: 72 },
        { id: "s3", label: { ko: "물방울", ja: "しずく", en: "drop" }, group: "symbol", x: 34, y: 84 },
      ],
      expectedTrail: ["n1", "s1", "n2", "s2", "n3", "s3"],
    },
    correctAnswer: ["n1", "s1", "n2", "s2", "n3", "s3"],
    explanation: {
      ko: "숫자와 그림 범주를 번갈아 따라가는 주의 전환 연습입니다. 결과는 의료 점수가 아니라 활동 흐름으로 저장됩니다.",
      ja: "数字と絵のカテゴリーを交互にたどる注意切り替えの練習です。結果は医療点ではなく活動の流れとして保存されます。",
      en: "This routine practices switching attention between number and picture categories. Results are stored as activity flow, not as a medical score.",
    },
    difficulty: 3,
  },
  {
    id: "ex_stroop_touch",
    lessonId: "lesson_1",
    type: "stroop_touch_practice",
    prompt: {
      ko: "글자의 뜻은 잠시 내려놓고, 글자가 보이는 색을 골라보세요.",
      ja: "言葉の意味ではなく、文字に見えている色を選びましょう。",
      en: "Ignore the word meaning and choose the color you see.",
    },
    payload: {
      stroopColorOptions: ["red", "blue", "green", "yellow"],
      stroopTrials: [
        {
          id: "stroop_1",
          word: { ko: "파랑", ja: "青", en: "blue" },
          inkColor: "red",
        },
        {
          id: "stroop_2",
          word: { ko: "초록", ja: "緑", en: "green" },
          inkColor: "blue",
        },
        {
          id: "stroop_3",
          word: { ko: "노랑", ja: "黄", en: "yellow" },
          inkColor: "green",
        },
      ],
    },
    correctAnswer: null,
    explanation: {
      ko: "색상 선택 루틴은 자동 반응을 잠시 멈추고 보이는 색에 집중하는 연습입니다. 결과는 진단 점수가 아니라 반응 흐름 기록으로만 저장됩니다.",
      ja: "色選択ルーティンは、自動的な読み反応を少し止めて見える色に注意を向ける練習です。結果は診断点ではなく活動記録として保存されます。",
      en: "This color-focus routine practices pausing the automatic reading response and attending to the visible color. Results are stored only as activity-flow records, not as a diagnostic score.",
    },
    difficulty: 3,
  },
  {
    id: "ex_5",
    lessonId: "lesson_1",
    type: "pair_matching",
    prompt: {
      ko: "표현과 뜻을 알맞게 연결해 보세요.",
      ja: "表現と意味を正しくつないでください。",
      en: "Find and match the correct pairs.",
    },
    payload: {
      pairs: [
        { id: "pair_1", left: { ko: "고진감래", ja: "苦あれば楽あり", en: "hardship then joy" }, right: { ko: "힘든 뒤 좋은 일", ja: "苦労のあとに良いこと", en: "good after hardship" } },
        { id: "pair_2", left: { ko: "일석이조", ja: "一石二鳥", en: "two birds with one stone" }, right: { ko: "하나로 두 이익", ja: "一つで二つの良いこと", en: "two gains from one action" } },
        { id: "pair_3", left: { ko: "동문서답", ja: "的外れな答え", en: "missing the point" }, right: { ko: "엉뚱한 답", ja: "質問とずれた答え", en: "off-topic answer" } },
      ],
    },
    correctAnswer: ["pair_1", "pair_2", "pair_3"],
    explanation: {
      ko: "각 표현과 뜻을 잘 연결했습니다.",
      ja: "それぞれの表現と意味を正しくつなげました。",
      en: "You matched each expression with the right meaning.",
    },
    difficulty: 3,
  },
  {
    id: "ex_sequence",
    lessonId: "lesson_1",
    type: "sequence_order",
    prompt: {
      ko: "하루 루틴을 자연스러운 순서로 골라보세요.",
      ja: "一日の流れを自然な順番に選んでください。",
      en: "Choose the daily routine in a natural order.",
    },
    payload: {
      items: [
        { id: "step_1", label: { ko: "아침 인사하기", ja: "朝のあいさつをする", en: "Say a morning greeting" } },
        { id: "step_2", label: { ko: "세 단어 기억하기", ja: "三つの言葉を覚える", en: "Remember three words" } },
        { id: "step_3", label: { ko: "짧게 회상하기", ja: "短く思い出す", en: "Recall a short memory" } },
        { id: "step_4", label: { ko: "정원에 물 주기", ja: "庭に水をあげる", en: "Water the garden" } },
      ],
    },
    correctAnswer: ["step_1", "step_2", "step_3", "step_4"],
    explanation: {
      ko: "가벼운 인사에서 시작해 기억과 보상으로 이어지는 흐름입니다.",
      ja: "軽いあいさつから始まり、記憶と報酬につながる流れです。",
      en: "This flow starts gently and leads into memory practice and reward.",
    },
    difficulty: 2,
  },
  {
    id: "ex_audio",
    lessonId: "lesson_1",
    type: "audio_choice",
    prompt: {
      ko: "소리를 듣고 같은 표현을 골라보세요.",
      ja: "音声を聞いて、同じ表現を選んでください。",
      en: "Listen and choose the same expression.",
    },
    payload: {
      audioText: { ko: "고진감래", ja: "苦あれば楽あり", en: "Good things come after hardship" },
      options: [
        { id: "opt_1", label: { ko: "고진감래", ja: "苦あれば楽あり", en: "Good things come after hardship" } },
        { id: "opt_2", label: { ko: "일석이조", ja: "一石二鳥", en: "Two birds with one stone" } },
        { id: "opt_3", label: { ko: "동문서답", ja: "的外れな答え", en: "Missing the point" } },
      ],
    },
    correctAnswer: "opt_1",
    explanation: {
      ko: "들은 표현은 고진감래입니다.",
      ja: "聞こえた表現は「苦あれば楽あり」です。",
      en: "The expression you heard was good things come after hardship.",
    },
    difficulty: 1,
  },
  {
    id: "ex_picture",
    lessonId: "lesson_1",
    type: "picture_choice",
    prompt: {
      ko: "그림을 보고 Haru의 정원과 가장 어울리는 장면을 골라보세요.",
      ja: "絵を見て、Haruの庭にいちばん合う場面を選んでください。",
      en: "Look at the pictures and choose the scene that best fits Haru's garden.",
    },
    payload: {
      options: [
        { id: "opt_1", label: { ko: "기억 정원", ja: "思い出の庭", en: "Memory garden" }, imageUrl: "/assets/haru/garden_scene.png" },
        { id: "opt_2", label: { ko: "공유된 연결", ja: "共有されたつながり", en: "Shared connection" }, imageUrl: "/assets/haru/family_connection.png" },
        { id: "opt_3", label: { ko: "피어난 기억", ja: "咲いた思い出", en: "Blooming memory" }, imageUrl: "/assets/haru/memory_bloom.png" },
        { id: "opt_4", label: { ko: "물방울 보상", ja: "しずくのごほうび", en: "Water drop reward" }, imageUrl: "/assets/haru/water_drop.png" },
      ],
    },
    correctAnswer: "opt_1",
    explanation: {
      ko: "정원 화면은 매일의 기억 활동이 자라는 모습을 보여줍니다.",
      ja: "庭の画面は、毎日の記憶活動が育つ様子を表します。",
      en: "The garden screen shows daily memory activity growing over time.",
    },
    difficulty: 1,
  },
  {
    id: "ex_shape",
    lessonId: "lesson_1",
    type: "shape_copy_practice",
    prompt: {
      ko: "위의 그림을 보고 아래에 비슷하게 그려보세요.",
      ja: "上の形を見て、下に似た形を描いてください。",
      en: "Look at the shape above and draw a similar one below.",
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
      ko: "문장을 소리 내어 따라 읽어보세요.",
      ja: "文を声に出して読んでください。",
      en: "Please read this sentence aloud.",
    },
    payload: {
      phrase: {
        ko: "오늘 하루도 천천히 잘 시작했습니다.",
        ja: "今日もゆっくり始められました。",
        en: "I started today slowly and well.",
      },
    },
    correctAnswer: null,
    difficulty: 1,
  },
  {
    id: "ex_recall",
    lessonId: "lesson_1",
    type: "delayed_word_recall",
    prompt: {
      ko: "처음에 기억해 두었던 다섯 단어는 무엇이었나요?",
      ja: "最初に覚えた五つの言葉はどれでしたか。",
      en: "Which five words did you remember at the beginning?",
    },
    payload: {
      phase: "recall",
      wordSetId: "set_1",
      requiredSelectionCount: 5,
      plannedDelayMinutes: 3,
      wordCategoryCues: [
        {
          word: { ko: "연필", ja: "鉛筆", en: "pencil" },
          category: { ko: "쓰는 물건", ja: "書く道具", en: "writing tool" },
        },
        {
          word: { ko: "사과", ja: "りんご", en: "apple" },
          category: { ko: "과일", ja: "果物", en: "fruit" },
        },
        {
          word: { ko: "버스", ja: "バス", en: "bus" },
          category: { ko: "탈것", ja: "乗り物", en: "vehicle" },
        },
        {
          word: { ko: "꽃", ja: "花", en: "flower" },
          category: { ko: "식물", ja: "植物", en: "plant" },
        },
        {
          word: { ko: "우산", ja: "傘", en: "umbrella" },
          category: { ko: "비 오는 날 쓰는 물건", ja: "雨の日に使う物", en: "rainy-day item" },
        },
      ],
      options: [
        { id: "w_1", label: { ko: "연필", ja: "鉛筆", en: "pencil" } },
        { id: "w_2", label: { ko: "자동차", ja: "自動車", en: "car" } },
        { id: "w_3", label: { ko: "사과", ja: "りんご", en: "apple" } },
        { id: "w_4", label: { ko: "바나나", ja: "バナナ", en: "banana" } },
        { id: "w_5", label: { ko: "버스", ja: "バス", en: "bus" } },
        { id: "w_6", label: { ko: "기차", ja: "電車", en: "train" } },
        { id: "w_7", label: { ko: "꽃", ja: "花", en: "flower" } },
        { id: "w_8", label: { ko: "우산", ja: "傘", en: "umbrella" } },
      ],
    },
    correctAnswer: ["w_1", "w_3", "w_5", "w_7", "w_8"],
    explanation: {
      ko: "맞아요. 연필, 사과, 버스, 꽃, 우산이었습니다.",
      ja: "そうです。鉛筆、りんご、バス、花、傘でした。",
      en: "That's right. They were pencil, apple, bus, flower, and umbrella.",
    },
    difficulty: 3,
  },
  {
    id: "ex_6",
    lessonId: "lesson_1",
    type: "personal_memory_recall",
    prompt: {
      ko: "최근에 떠오르는 하루의 기억을 짧게 말해볼까요? 누구와 있었는지, 어디였는지, 어떤 일이 있었는지 편하게 이야기해 주세요.",
      ja: "最近思い出す一日の記憶を短く話してみましょう。誰といたか、どこだったか、何があったかを気軽に話してください。",
      en: "Tell a short story about a recent day you remember. Who were you with, where were you, and what happened?",
    },
    payload: {
      linkedConceptId: "daily_memory_1",
      memoryField: "story",
      options: [],
    },
    correctAnswer: null,
    explanation: {
      ko: "이야기를 기억 카드로 저장했습니다. 나중에 다시 자연스럽게 떠올려볼게요.",
      ja: "話を記憶カードとして保存しました。あとで自然に思い出してみましょう。",
      en: "Your story was saved as a memory card. We will gently revisit it later.",
    },
    difficulty: 1,
  },
  {
    id: "ex_7",
    lessonId: "lesson_1",
    type: "personal_memory_recall",
    prompt: {
      ko: "그때 어떤 기분이 드셨나요?",
      ja: "その時、どんな気持ちでしたか。",
      en: "How did you feel then?",
    },
    payload: {
      linkedConceptId: "daily_memory_1",
      memoryField: "emotionTag",
      options: [
        { id: "opt_happy", label: { ko: "기쁨", ja: "うれしさ", en: "Joy" }, value: "기쁨" },
        { id: "opt_proud", label: { ko: "뿌듯함", ja: "誇らしさ", en: "Pride" }, value: "뿌듯함" },
        { id: "opt_thankful", label: { ko: "감사함", ja: "ありがたさ", en: "Gratitude" }, value: "감사함" },
        { id: "opt_relieved", label: { ko: "마음이 놓임", ja: "安心", en: "Relief" }, value: "마음이 놓임" },
      ],
    },
    correctAnswer: null,
    explanation: {
      ko: "그 감정을 정원에 함께 심어두었습니다.",
      ja: "その気持ちも庭にそっと残しました。",
      en: "That feeling has been gently planted in your garden.",
    },
    difficulty: 1,
  },
];
