import type { LocalizedText } from "@/utils/localizedText";
import { haru7DayExercises } from "@/data/haru7DayExercises";

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

export type RoutineDomain =
  | "memory"
  | "attention"
  | "language"
  | "dailyFlow"
  | "visuospatial"
  | "moodSocial";

export interface ExercisePayload {
  audioText?: LocalizedText;
  instructionText?: LocalizedText;
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
  orientationKind?: "date_weekday" | "month" | "weekday" | "season" | "random";
  targetDateISO?: string;
  // Haru-original everyday framing (never copies official test items/cutoffs).
  domain?: RoutineDomain;
  recommendedDays?: number[];
  scenarioTitle?: LocalizedText;
  scenarioBody?: LocalizedText;
  benefitCopy?: LocalizedText;
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
      ko: "이른 아침에 이웃에게 건네기 좋은 말은 무엇일까요?",
      ja: "早い朝、ご近所さんに声をかけるのに良い言葉はどれでしょう?",
      en: "Which is a good thing to say to a neighbor early in the morning?",
    },
    payload: {
      domain: "language",
      recommendedDays: [3, 5],
      options: [
        { id: "opt_1", label: { ko: "안녕하세요", ja: "おはようございます", en: "Good morning" } },
        { id: "opt_2", label: { ko: "잘 가세요", ja: "いってらっしゃい", en: "Take care (goodbye)" } },
        { id: "opt_3", label: { ko: "맛있게 드세요", ja: "いただきます", en: "Enjoy your meal" } },
        { id: "opt_4", label: { ko: "고맙습니다", ja: "ありがとうございます", en: "Thank you" } },
      ],
    },
    correctAnswer: "opt_1",
    explanation: {
      ko: "아침 인사로는 '안녕하세요'가 어울려요.",
      ja: "朝のあいさつには「おはようございます」が合います。",
      en: "A morning greeting fits best at the start of the day.",
    },
    difficulty: 1,
  },
  {
    id: "ex_3",
    lessonId: "lesson_1",
    type: "situation_match",
    prompt: {
      ko: "다음 중 '잠깐만 기다려 주세요'와 어울리는 상황은 무엇일까요?",
      ja: "次のうち「少しだけお待ちください」に合う場面はどれでしょう?",
      en: "Which situation fits \"please wait a moment\"?",
    },
    payload: {
      domain: "language",
      recommendedDays: [3, 5],
      options: [
        { id: "opt_1", label: { ko: "전화를 받고 다른 일을 먼저 마무리해야 할 때", ja: "電話に出て、まず別の用事を終わらせる時", en: "Answering the phone but needing to finish something first" } },
        { id: "opt_2", label: { ko: "식사를 모두 마치고 자리에서 일어날 때", ja: "食事を終えて席を立つ時", en: "Finishing a meal and getting up from the table" } },
        { id: "opt_3", label: { ko: "산책을 마치고 집에 돌아올 때", ja: "散歩を終えて家に戻る時", en: "Coming back home after a walk" } },
      ],
    },
    correctAnswer: "opt_1",
    explanation: {
      ko: "잠시 시간이 필요할 때 '잠깐만 기다려 주세요'라고 해요.",
      ja: "少し時間が欲しい時に「少しだけお待ちください」と言います。",
      en: "We say it when we need a short moment before continuing.",
    },
    difficulty: 2,
  },
  {
    id: "ex_4",
    lessonId: "lesson_1",
    type: "multiple_choice_meaning",
    prompt: {
      ko: "'맛있게 드세요'는 보통 언제 건네는 말일까요?",
      ja: "「いただきます」は普通、いつ使う言葉でしょう?",
      en: "When do we usually say \"enjoy your meal\"?",
    },
    payload: {
      domain: "language",
      recommendedDays: [3, 5],
      options: [
        { id: "opt_1", label: { ko: "밥을 먹기 직전에", ja: "食事を始める直前に", en: "Right before starting a meal" } },
        { id: "opt_2", label: { ko: "잠들기 직전에", ja: "眠る直前に", en: "Right before going to sleep" } },
        { id: "opt_3", label: { ko: "전화를 받을 때", ja: "電話に出る時", en: "When answering the phone" } },
        { id: "opt_4", label: { ko: "문을 열고 나갈 때", ja: "ドアを開けて出る時", en: "When opening the door to leave" } },
      ],
    },
    correctAnswer: "opt_1",
    explanation: {
      ko: "식사를 시작할 때 '맛있게 드세요'라고 해요.",
      ja: "食事を始める時に「いただきます」と言います。",
      en: "We say it as a meal begins.",
    },
    difficulty: 1,
  },
  {
    id: "ex_attention",
    lessonId: "lesson_1",
    type: "attention_pattern",
    prompt: {
      ko: "사과 9개가 있는데 이웃에게 2개 드리면 몇 개가 남을까요?",
      ja: "りんごが9個あるとき、ご近所さんに2個あげたらいくつ残るでしょうか?",
      en: "You have 9 apples. If you give 2 to a neighbor, how many are left?",
    },
    payload: {
      domain: "attention",
      recommendedDays: [1, 6],
      scenarioTitle: {
        ko: "나눠 드리기",
        ja: "おすそわけ",
        en: "Sharing with a neighbor",
      },
      scenarioBody: {
        ko: "처음에 사과 9개가 있었어요. 이웃에게 2개를 나눠 드렸어요.",
        ja: "最初はりんごが9個ありました。ご近所さんに2個おすそわけしました。",
        en: "You started with 9 apples and shared 2 with a neighbor.",
      },
      benefitCopy: {
        ko: "하루 일과에서 일어나는 일을 가볍게 떠올려 보는 활동이에요.",
        ja: "一日の出来事を軽く思い出す活動です。",
        en: "A light activity for recalling everyday moments.",
      },
      options: [
        { id: "opt_1", label: "5" },
        { id: "opt_2", label: "6" },
        { id: "opt_3", label: "7" },
        { id: "opt_4", label: "8" },
      ],
    },
    correctAnswer: "opt_3",
    explanation: {
      ko: "9개에서 2개를 나눠 드리면 7개가 남아요.",
      ja: "9個から2個あげると、7個残ります。",
      en: "9 minus 2 leaves 7.",
    },
    difficulty: 2,
  },
  {
    id: "ex_digit_span",
    lessonId: "lesson_1",
    type: "digit_span_practice",
    prompt: {
      ko: "버스 번호를 눌러보세요.",
      ja: "バスの番号を押してみましょう。",
      en: "Tap the bus number.",
    },
    payload: {
      domain: "memory",
      recommendedDays: [2, 4],
      digits: ["4", "8", "2"],
      direction: "forward",
    },
    correctAnswer: ["4", "8", "2"],
    explanation: {
      ko: "잠깐 본 번호를 가볍게 떠올리는 활동이에요. 정답보다 천천히 다시 시도하는 흐름이 중요해요.",
      ja: "少し見た番号を軽く思い出す活動です。正解だけでなく、落ち着いてもう一度試す流れを大切にします。",
      en: "A light activity for recalling a number you glimpsed. The goal is a calm retry flow and steady attention.",
    },
    difficulty: 2,
  },
  {
    id: "ex_orientation",
    lessonId: "lesson_1",
    type: "orientation_practice",
    prompt: {
      ko: "오늘 날짜를 골라보세요.",
      ja: "今日の日付を選んでください。",
      en: "Choose today's date.",
    },
    payload: {
      domain: "dailyFlow",
      recommendedDays: [0, 3, 6],
      orientationKind: "random",
    },
    correctAnswer: null,
    explanation: {
      ko: "오늘의 날짜와 요일을 확인하며 하루의 흐름을 정리하는 루틴이에요. 선택과 응답 흐름은 활동 기록으로 저장돼요.",
      ja: "今日の日付と曜日を確かめながら、一日の流れを整えるルーティンです。選択と反応の流れは活動記録として保存されます。",
      en: "This routine checks today's date and weekday while helping organize the flow of the day. Choices and response flow are saved as activity records.",
    },
    difficulty: 1,
  },
  {
    id: "ex_verbal_fluency",
    lessonId: "lesson_1",
    type: "verbal_fluency_practice",
    prompt: {
      ko: "지금 떠오르는 과일 이름을 최대한 많이 말하세요.",
      ja: "今思い浮かぶ果物の名前をできるだけ多く言ってください。",
      en: "Say as many fruit names as you can, one after another.",
    },
    payload: {
      domain: "language",
      recommendedDays: [3, 5],
      fluencyCategory: {
        ko: "과일",
        ja: "果物",
        en: "fruit",
      },
      durationSeconds: 30,
    },
    correctAnswer: null,
    explanation: {
      ko: "한 주제 안에서 단어를 떠올리는 가벼운 말하기 활동이에요. 떠오른 단어와 반복 흐름을 오늘의 활동 기록으로 저장해요.",
      ja: "一つのお題の中で言葉を思い出す軽い話す活動です。思いついた言葉と繰り返しの流れを今日の活動記録として保存します。",
      en: "A light speaking activity for recalling words within one topic. Entered words and repetition flow are saved as today's activity record.",
    },
    difficulty: 2,
  },
  {
    id: "ex_trail_switching",
    lessonId: "lesson_1",
    type: "trail_switching_practice",
    prompt: {
      ko: "순서대로 눌러보세요.",
      ja: "順番に押してみましょう。",
      en: "Tap them in order.",
    },
    payload: {
      domain: "attention",
      recommendedDays: [1, 4],
      trailNodes: [
        { id: "n1", label: "1", group: "number", x: 24, y: 28 },
        { id: "s1", label: { ko: "꽃집", ja: "花屋", en: "flower shop" }, group: "symbol", x: 74, y: 26 },
        { id: "n2", label: "2", group: "number", x: 74, y: 74 },
        { id: "s2", label: { ko: "약국", ja: "薬局", en: "pharmacy" }, group: "symbol", x: 26, y: 76 },
      ],
      expectedTrail: ["n1", "s1", "n2", "s2"],
    },
    correctAnswer: ["n1", "s1", "n2", "s2"],
    explanation: {
      ko: "번호표와 장소 그림을 번갈아 따라가는 가벼운 활동이에요. 선택 순서와 다시 누른 횟수를 활동 흐름으로 저장해요.",
      ja: "番号表と場所の絵を交互にたどる軽い活動です。選択の順番と押し直した回数を活動の流れとして保存します。",
      en: "A light activity of following number signs and place pictures in turn. Tap order and retaps are saved as activity flow.",
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
      domain: "attention",
      recommendedDays: [1, 5],
      scenarioTitle: {
        ko: "색깔 신호",
        ja: "色のサイン",
        en: "Color signals",
      },
      scenarioBody: {
        ko: "신호등이나 간판 색을 빠르게 알아보는 짧은 활동이에요. 색이 잘 안 보이면 글자로 된 색 이름도 함께 표시돼요.",
        ja: "信号や看板の色を素早く見分ける短い活動です。色が見えにくい時は、色の名前も文字で表示されます。",
        en: "A short activity for noticing signal and sign colors quickly. If a color is hard to see, the color name is shown in text too.",
      },
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
      ko: "색상 선택 루틴은 자동 반응을 잠시 멈추고 보이는 색에 집중하는 연습입니다. 선택 반응 흐름을 활동 기록으로 저장합니다.",
      ja: "色選択ルーティンは、自動的な読み反応を少し止めて見える色に注意を向ける練習です。選択反応の流れを活動記録として保存します。",
      en: "This color-focus routine practices pausing the automatic reading response and attending to the visible color. Choice response flow is saved as an activity record.",
    },
    difficulty: 3,
  },
  {
    id: "ex_5",
    lessonId: "lesson_1",
    type: "pair_matching",
    prompt: {
      ko: "일상 행동과 어울리는 장소를 알맞게 연결해 보세요.",
      ja: "日常の行動と合う場所を正しくつないでください。",
      en: "Match each everyday action with the place it belongs to.",
    },
    payload: {
      domain: "dailyFlow",
      recommendedDays: [0, 4],
      pairs: [
        { id: "pair_1", left: { ko: "밥 먹기", ja: "ご飯を食べる", en: "Eating a meal" }, right: { ko: "식탁", ja: "ダイニングテーブル", en: "Dining table" } },
        { id: "pair_2", left: { ko: "전화 받기", ja: "電話に出る", en: "Answering the phone" }, right: { ko: "가족 목소리", ja: "家族の声", en: "A family member's voice" } },
        { id: "pair_3", left: { ko: "가볍게 산책하기", ja: "軽く散歩する", en: "A short walk" }, right: { ko: "동네 길", ja: "近所の道", en: "A neighborhood street" } },
      ],
    },
    correctAnswer: ["pair_1", "pair_2", "pair_3"],
    explanation: {
      ko: "일상 행동과 어울리는 장소를 잘 연결했습니다.",
      ja: "日常の行動と合う場所を正しくつなげました。",
      en: "You matched each everyday action with its place.",
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
        { id: "step_2", label: { ko: "밥 챙겨 먹기", ja: "ご飯を食べる", en: "Have a meal" } },
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
      domain: "language",
      recommendedDays: [3, 5],
      audioText: { ko: "시원하다", ja: "すっきりする", en: "Refreshing" },
      options: [
        { id: "opt_1", label: { ko: "시원하다", ja: "すっきりする", en: "Refreshing" } },
        { id: "opt_2", label: { ko: "춥다", ja: "寒い", en: "Cold" } },
        { id: "opt_3", label: { ko: "더워요", ja: "暑い", en: "Hot" } },
        { id: "opt_4", label: { ko: "졸려요", ja: "眠い", en: "Sleepy" } },
      ],
    },
    correctAnswer: "opt_1",
    explanation: {
      ko: "들은 표현은 '시원하다'예요.",
      ja: "聞こえた表現は「すっきりする」です。",
      en: "The expression you heard was \"refreshing\".",
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
      ko: "따라 그리세요.",
      ja: "形をなぞってください。",
      en: "Trace the shape.",
    },
    payload: {
      domain: "visuospatial",
      recommendedDays: [4, 6],
    },
    correctAnswer: null,
    difficulty: 1,
  },
  {
    id: "ex_speech",
    lessonId: "lesson_1",
    type: "speech_repeat_practice",
    prompt: {
      ko: "따라 말해보세요.",
      ja: "声に出して言ってみましょう。",
      en: "Say it out loud.",
    },
    payload: {
      domain: "language",
      recommendedDays: [3, 5],
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
      ko: "오늘 하루를 말씀해 주세요.",
      ja: "今日の一日を話してください。",
      en: "Please tell me about your day.",
    },
    payload: {
      domain: "moodSocial",
      recommendedDays: [2, 5],
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
  {
    // 🔖 기억(개인 회상, 음성): 사전에 시드된 "어제 외식" 기억카드를
    // 바탕으로 한 회상 질문. story 모드라 화면 진입 즉시 음성 녹음 시작.
    id: "ex_recall_dining",
    lessonId: "lesson_1",
    type: "personal_memory_recall",
    prompt: {
      ko: "어제 가족과 외식하셨다고 했는데, 무엇을 드셨는지 기억나시나요?",
      ja: "昨日ご家族と外食なさったと聞いています。何をお食べになりましたか、覚えていますか?",
      en: "You mentioned eating out with your family yesterday. Do you remember what you had?",
    },
    payload: {
      domain: "memory",
      recommendedDays: [2, 5],
      linkedConceptId: "demo_dining_recall",
      memoryField: "story",
      options: [],
    },
    correctAnswer: null,
    explanation: {
      ko: "말씀해주신 이야기를 기억 카드에 남겼어요.",
      ja: "お話しいただいたことを記憶カードに残しました。",
      en: "I saved what you shared to your memory card.",
    },
    difficulty: 1,
  },
  {
    // 🧮 주의·계산: 시장 거스름돈. ex_attention(사과)은 카탈로그에 잔류.
    id: "ex_market_money",
    lessonId: "lesson_1",
    type: "attention_pattern",
    prompt: {
      ko: "거스름돈을 골라보세요.",
      ja: "おつりを選んでください。",
      en: "Choose the change.",
    },
    payload: {
      domain: "attention",
      recommendedDays: [1, 4],
      scenarioTitle: {
        ko: "장보기",
        ja: "買い物",
        en: "Shopping",
      },
      scenarioBody: {
        ko: "시장에서 과일을 3,000원어치 샀습니다. 5,000원을 냈다면 거스름돈은 얼마일까요?",
        ja: "市場で果物を3,000ウォン分買いました。5,000ウォン出したなら、おつりはいくらでしょうか?",
        en: "You bought 3,000 won worth of fruit at the market. If you paid 5,000 won, how much is the change?",
      },
      options: [
        { id: "opt_1000", label: { ko: "1,000원", ja: "1,000ウォン", en: "1,000 won" } },
        { id: "opt_2000", label: { ko: "2,000원", ja: "2,000ウォン", en: "2,000 won" } },
        { id: "opt_3000", label: { ko: "3,000원", ja: "3,000ウォン", en: "3,000 won" } },
        { id: "opt_4000", label: { ko: "4,000원", ja: "4,000ウォン", en: "4,000 won" } },
      ],
    },
    correctAnswer: "opt_2000",
    explanation: {
      ko: "5,000원에서 3,000원을 빼면 2,000원이에요.",
      ja: "5,000ウォンから3,000ウォンを引くと2,000ウォンです。",
      en: "5,000 minus 3,000 is 2,000 won.",
    },
    difficulty: 2,
  },
  {
    // 🧮 주의(숫자 패턴): 1 3 5 7 ? → 9. attention_pattern의 pattern 렌더링 사용.
    id: "ex_number_pattern",
    lessonId: "lesson_1",
    type: "attention_pattern",
    prompt: {
      ko: "다음 숫자를 골라보세요.",
      ja: "次の数を選んでください。",
      en: "Choose the next number.",
    },
    payload: {
      domain: "attention",
      recommendedDays: [1, 5],
      pattern: [1, 3, 5, 7],
      options: [
        { id: "opt_8", label: { ko: "8", ja: "8", en: "8" } },
        { id: "opt_9", label: { ko: "9", ja: "9", en: "9" } },
        { id: "opt_10", label: { ko: "10", ja: "10", en: "10" } },
        { id: "opt_11", label: { ko: "11", ja: "11", en: "11" } },
      ],
    },
    correctAnswer: "opt_9",
    explanation: {
      ko: "2씩 커지는 규칙이라 다음은 9이에요.",
      ja: "2ずつ大きくなるので、次は9です。",
      en: "It grows by 2 each step, so the next is 9.",
    },
    difficulty: 2,
  },
  {
    // 🗣️ 언어(이해): 속담 뜻 고르기. 비의료 일상 어휘.
    id: "ex_proverb",
    lessonId: "lesson_1",
    type: "multiple_choice_meaning",
    prompt: {
      ko: "속담 '티끌 모아 태산'의 뜻을 골라보세요.",
      ja: "ことわざ「塵も積もれば山となる」の意味を選んでください。",
      en: "Choose the meaning of the proverb \"Many a little makes a mickle.\"",
    },
    payload: {
      domain: "language",
      recommendedDays: [3, 5],
      options: [
        { id: "opt_small", label: { ko: "작은 것이 모이면 커져요", ja: "小さなものが集まると大きくなります", en: "Small things add up to something big" } },
        { id: "opt_hurry", label: { ko: "빨리 서둘러야 해요", ja: "急いだ方がいいです", en: "You should hurry up" } },
        { id: "opt_alone", label: { ko: "혼자 있는 게 좋아요", ja: "一人がいいです", en: "Being alone is nice" } },
        { id: "opt_high", label: { ko: "높은 곳에 올라가요", ja: "高い所に登ります", en: "Climb to a high place" } },
      ],
    },
    correctAnswer: "opt_small",
    explanation: {
      ko: "작은 것이 모이면 큰산이 된다는 뜻이에요.",
      ja: "小さなものが積もると大きな山になるという意味です。",
      en: "It means small things pile up into something great.",
    },
    difficulty: 2,
  },
  {
    // 🙂 감정(음성): 요즘 기분 편하게 말하기. story 모드 음성 녹음.
    id: "ex_mood_voice",
    lessonId: "lesson_1",
    type: "personal_memory_recall",
    prompt: {
      ko: "요즘 기분이 어떠신지 편하게 말씀해 주세요.",
      ja: "最近のお気持ちはいかがですか。気楽にお話しください。",
      en: "How have you been feeling lately? Please share comfortably.",
    },
    payload: {
      domain: "moodSocial",
      recommendedDays: [2, 6],
      linkedConceptId: "demo_mood_check",
      memoryField: "story",
      options: [],
    },
    correctAnswer: null,
    explanation: {
      ko: "말씀해주신 기분을 기록에 남겼어요.",
      ja: "お話しいただいた気持ちは記録に残しました。",
      en: "I noted how you've been feeling.",
    },
    difficulty: 1,
  },
  ...haru7DayExercises,
];
