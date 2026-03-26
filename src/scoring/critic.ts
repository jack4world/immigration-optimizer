import type { LLMProvider } from '../llm/provider.js';
import type { Penalty, Reward, Rubrics, ProgramsDB, DimensionResult } from '../data/schemas.js';
import { buildCriticPrompt, buildRewardPrompt } from './prompts.js';
import { parseJsonResponse } from '../llm/json-parser.js';

const PENALTY_TO_DIMENSION: Record<string, string> = {
  eligibility: 'success_probability',
  timeline: 'timeline_efficiency',
  cost: 'cost_efficiency',
  feasibility: 'plan_robustness',
};

const REWARD_TO_DIMENSION: Record<string, string> = {
  eligibility: 'success_probability',
  timeline: 'timeline_efficiency',
  cost: 'cost_efficiency',
  robustness: 'plan_robustness',
  quality: 'quality_of_life',
};

export function mapPenaltyToDimension(category: string): string {
  return PENALTY_TO_DIMENSION[category] || 'success_probability';
}

export function mapRewardToDimension(category: string): string {
  return REWARD_TO_DIMENSION[category] || 'success_probability';
}

export async function runAdversarialCritic(
  provider: LLMProvider,
  pathwayContent: string,
  programsDb: ProgramsDB,
  rubrics: Rubrics,
): Promise<Penalty[]> {
  const prompt = buildCriticPrompt(pathwayContent, programsDb, rubrics);

  try {
    const response = await provider.complete(prompt, 8000);
    const result = parseJsonResponse(response);
    if (Array.isArray(result)) return result;
    return [];
  } catch {
    console.warn('WARNING: critic parse failed, returning empty penalties');
    return [];
  }
}

export async function runRewardEvaluator(
  provider: LLMProvider,
  pathwayContent: string,
  programsDb: ProgramsDB,
  rubrics: Rubrics,
): Promise<Reward[]> {
  if (!rubrics.rewards || Object.keys(rubrics.rewards).length === 0) {
    return [];
  }

  const prompt = buildRewardPrompt(pathwayContent, programsDb, rubrics);

  try {
    const response = await provider.complete(prompt, 4000);
    const result = parseJsonResponse(response);
    if (Array.isArray(result)) return result;
    return [];
  } catch {
    console.warn('WARNING: reward parse failed, returning empty rewards');
    return [];
  }
}

export function applyPenalties(
  scores: Record<string, DimensionResult>,
  penalties: Penalty[],
  maxPerDimension: number = -25,
): void {
  const penaltyByDim: Record<string, number> = {};

  for (const p of penalties) {
    const dim = mapPenaltyToDimension(p.category);
    penaltyByDim[dim] = penaltyByDim[dim] || 0;
    penaltyByDim[dim] = Math.max(penaltyByDim[dim] + p.penalty, maxPerDimension);
  }

  for (const [dim, pen] of Object.entries(penaltyByDim)) {
    if (dim in scores) {
      scores[dim].penalty = pen;
      scores[dim].score_before_adjustment = scores[dim].score;
      scores[dim].score = Math.max(0, scores[dim].score + pen);
    }
  }
}

export function applyRewards(
  scores: Record<string, DimensionResult>,
  rewards: Reward[],
  maxPerDimension: number = 15,
): void {
  const rewardByDim: Record<string, number> = {};

  for (const r of rewards) {
    const dim = mapRewardToDimension(r.category);
    rewardByDim[dim] = rewardByDim[dim] || 0;
    rewardByDim[dim] = Math.min(rewardByDim[dim] + r.reward, maxPerDimension);
  }

  for (const [dim, rew] of Object.entries(rewardByDim)) {
    if (dim in scores) {
      scores[dim].reward = rew;
      if (!scores[dim].score_before_adjustment) {
        scores[dim].score_before_adjustment = scores[dim].score;
      }
      scores[dim].score = Math.min(100, scores[dim].score + rew);
    }
  }
}
