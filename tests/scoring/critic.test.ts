import { describe, it, expect } from 'vitest';
import { mapPenaltyToDimension, applyPenalties, applyRewards, mapRewardToDimension } from '../../src/scoring/critic.js';
import type { DimensionResult } from '../../src/data/schemas.js';

describe('mapPenaltyToDimension', () => {
  it('maps eligibility to success_probability', () => {
    expect(mapPenaltyToDimension('eligibility')).toBe('success_probability');
  });

  it('maps timeline to timeline_efficiency', () => {
    expect(mapPenaltyToDimension('timeline')).toBe('timeline_efficiency');
  });

  it('maps cost to cost_efficiency', () => {
    expect(mapPenaltyToDimension('cost')).toBe('cost_efficiency');
  });

  it('maps feasibility to plan_robustness', () => {
    expect(mapPenaltyToDimension('feasibility')).toBe('plan_robustness');
  });

  it('defaults to success_probability for unknown', () => {
    expect(mapPenaltyToDimension('unknown')).toBe('success_probability');
  });
});

describe('mapRewardToDimension', () => {
  it('maps eligibility to success_probability', () => {
    expect(mapRewardToDimension('eligibility')).toBe('success_probability');
  });

  it('maps quality to quality_of_life', () => {
    expect(mapRewardToDimension('quality')).toBe('quality_of_life');
  });

  it('maps robustness to plan_robustness', () => {
    expect(mapRewardToDimension('robustness')).toBe('plan_robustness');
  });
});

describe('applyPenalties', () => {
  it('applies penalties to correct dimensions', () => {
    const scores: Record<string, DimensionResult> = {
      success_probability: { score: 85, weight: 0.3, sub_dimensions: {} },
      timeline_efficiency: { score: 80, weight: 0.25, sub_dimensions: {} },
    };

    applyPenalties(scores, [
      { category: 'eligibility', step: 3, issue: 'CLB below requirement', penalty: -5 },
    ]);

    expect(scores.success_probability.score).toBe(80);
    expect(scores.success_probability.penalty).toBe(-5);
    expect(scores.success_probability.score_before_adjustment).toBe(85);
  });

  it('caps penalties per dimension', () => {
    const scores: Record<string, DimensionResult> = {
      timeline_efficiency: { score: 85, weight: 0.25, sub_dimensions: {} },
    };

    applyPenalties(scores, [
      { category: 'timeline', step: 1, issue: 'issue 1', penalty: -10 },
      { category: 'timeline', step: 2, issue: 'issue 2', penalty: -10 },
      { category: 'timeline', step: 3, issue: 'issue 3', penalty: -10 },
    ], -20);

    expect(scores.timeline_efficiency.penalty).toBe(-20);
    expect(scores.timeline_efficiency.score).toBe(65);
  });

  it('does not go below 0', () => {
    const scores: Record<string, DimensionResult> = {
      success_probability: { score: 10, weight: 0.3, sub_dimensions: {} },
    };

    applyPenalties(scores, [
      { category: 'eligibility', step: 1, issue: 'bad', penalty: -20 },
    ]);

    expect(scores.success_probability.score).toBe(0);
  });
});

describe('applyRewards', () => {
  it('applies rewards to correct dimensions', () => {
    const scores: Record<string, DimensionResult> = {
      success_probability: { score: 75, weight: 0.3, sub_dimensions: {} },
    };

    applyRewards(scores, [
      { category: 'eligibility', step: 1, reason: 'exceeds requirements', reward: 5 },
    ]);

    expect(scores.success_probability.score).toBe(80);
    expect(scores.success_probability.reward).toBe(5);
  });

  it('caps rewards per dimension', () => {
    const scores: Record<string, DimensionResult> = {
      quality_of_life: { score: 70, weight: 0.15, sub_dimensions: {} },
    };

    applyRewards(scores, [
      { category: 'quality', step: 1, reason: 'great match', reward: 10 },
      { category: 'quality', step: 2, reason: 'career ok', reward: 10 },
    ], 15);

    expect(scores.quality_of_life.reward).toBe(15);
    expect(scores.quality_of_life.score).toBe(85);
  });

  it('does not go above 100', () => {
    const scores: Record<string, DimensionResult> = {
      success_probability: { score: 95, weight: 0.3, sub_dimensions: {} },
    };

    applyRewards(scores, [
      { category: 'eligibility', step: 1, reason: 'perfect', reward: 10 },
    ]);

    expect(scores.success_probability.score).toBe(100);
  });
});
