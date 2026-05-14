export interface GardenState {
  waterDrops: number;
  leaves: number;
  flowers: number;
  photoFlowers: number;
  treeLevel: number;
}

export type RewardEvent =
  | "session_complete"
  | "memory_review"
  | "family_photo_review"
  | "weekly_completion"
  | "streak_milestone";

export function addGardenReward(currentState: GardenState, event: RewardEvent): GardenState {
  const nextState = { ...currentState };

  switch (event) {
    case "session_complete":
      nextState.waterDrops += 1;
      break;
    case "memory_review":
      nextState.leaves += 1;
      break;
    case "family_photo_review":
      nextState.photoFlowers += 1;
      break;
    case "weekly_completion":
      nextState.flowers += 1;
      break;
    case "streak_milestone":
      nextState.treeLevel += 1;
      break;
  }

  const computedTreeLevel = Math.floor(nextState.waterDrops / 10) + 1;
  nextState.treeLevel = Math.max(nextState.treeLevel, computedTreeLevel);

  return nextState;
}

export const initialGardenState: GardenState = {
  waterDrops: 0,
  leaves: 0,
  flowers: 0,
  photoFlowers: 0,
  treeLevel: 1,
};
