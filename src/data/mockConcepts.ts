export interface Concept {
  id: string;
  type: "idiom" | "proverb" | "expression" | "attention_pattern";
  displayText: string;
  romanization?: string;
  simpleMeaning: string;
  detailedMeaning?: string;
  exampleSituationIds: string[];
  memoryPromptIds: string[];
  audioAssetId?: string;
  imageAssetId?: string;
}

export const mockConcepts: Record<string, Concept> = {
  "concept_1": {
    id: "concept_1",
    type: "idiom",
    displayText: "일석이조",
    simpleMeaning: "하나의 행동으로 두 가지 이익을 얻는 것",
    detailedMeaning: "돌 하나를 던져 새 두 마리를 잡는다는 뜻입니다.",
    exampleSituationIds: ["sit_1_1", "sit_1_2", "sit_1_3"],
    memoryPromptIds: ["mem_1_1", "mem_1_2", "mem_1_3"],
  },
  "concept_2": {
    id: "concept_2",
    type: "idiom",
    displayText: "고진감래",
    simpleMeaning: "힘든 일이 지나면 좋은 일이 온다는 뜻",
    detailedMeaning: "고생 끝에 낙이 온다는 의미입니다.",
    exampleSituationIds: ["sit_2_1", "sit_2_2", "sit_2_3"],
    memoryPromptIds: ["mem_2_1", "mem_2_2", "mem_2_3"],
  },
  "concept_3": {
    id: "concept_3",
    type: "idiom",
    displayText: "동문서답",
    simpleMeaning: "묻는 말에 엉뚱한 대답을 하는 것",
    detailedMeaning: "동쪽을 묻는데 서쪽을 답한다는 뜻입니다.",
    exampleSituationIds: ["sit_3_1", "sit_3_2", "sit_3_3"],
    memoryPromptIds: ["mem_3_1", "mem_3_2", "mem_3_3"],
  },
  "concept_4": {
    id: "concept_4",
    type: "idiom",
    displayText: "우왕좌왕",
    simpleMeaning: "이리저리 왔다 갔다 하며 어쩔 줄 모르는 모습",
    detailedMeaning: "오른쪽으로 갔다가 왼쪽으로 갔다가 하며 방향을 잡지 못하는 상태입니다.",
    exampleSituationIds: ["sit_4_1", "sit_4_2", "sit_4_3"],
    memoryPromptIds: ["mem_4_1", "mem_4_2", "mem_4_3"],
  },
  "concept_5": {
    id: "concept_5",
    type: "idiom",
    displayText: "작심삼일",
    simpleMeaning: "결심한 마음이 사흘을 가지 못한다는 뜻",
    detailedMeaning: "단단히 먹은 마음이 삼 일 만에 무너진다는 의미입니다.",
    exampleSituationIds: ["sit_5_1", "sit_5_2", "sit_5_3"],
    memoryPromptIds: ["mem_5_1", "mem_5_2", "mem_5_3"],
  }
};
