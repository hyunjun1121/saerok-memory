import { addGardenReward, initialGardenState } from './gardenProgress';
import { describe, it, expect } from 'vitest';

describe('gardenProgress', () => {
  it('adds water drop on session complete', () => {
    const state = addGardenReward(initialGardenState, 'session_complete');
    expect(state.waterDrops).toBe(1);
    expect(state.treeLevel).toBe(1);
  });

  it('adds leaf on memory review', () => {
    const state = addGardenReward(initialGardenState, 'memory_review');
    expect(state.leaves).toBe(1);
  });

  it('levels up tree automatically after 10 drops', () => {
    let state = { ...initialGardenState, waterDrops: 9 };
    state = addGardenReward(state, 'session_complete');
    expect(state.treeLevel).toBe(2);
  });
});
