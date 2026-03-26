import { describe, it, expect } from 'vitest';
import { pickMutationType } from '../../src/optimizer/mutations.js';

describe('pickMutationType', () => {
  it('rotates through mutation types', () => {
    const types = [0, 1, 2, 3, 4].map(i => pickMutationType(i, 0));
    expect(types).toEqual(['SWAP_PROGRAM', 'ADD_CREDENTIAL', 'REORDER_STEPS', 'ADD_PARALLEL', 'SWITCH_PROVINCE']);
  });

  it('cycles back after full rotation', () => {
    expect(pickMutationType(5, 0)).toBe('SWAP_PROGRAM');
    expect(pickMutationType(6, 0)).toBe('ADD_CREDENTIAL');
  });

  it('forces RESEARCH after 5 consecutive discards', () => {
    expect(pickMutationType(0, 5)).toBe('RESEARCH');
    expect(pickMutationType(10, 5)).toBe('RESEARCH');
    expect(pickMutationType(3, 7)).toBe('RESEARCH');
  });

  it('uses normal rotation when discards are below threshold', () => {
    expect(pickMutationType(0, 4)).toBe('SWAP_PROGRAM');
    expect(pickMutationType(1, 3)).toBe('ADD_CREDENTIAL');
  });
});
