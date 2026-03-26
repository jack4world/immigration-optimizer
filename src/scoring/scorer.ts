import type { LLMProvider } from '../llm/provider.js';
import type {
  Rubrics, ProgramsDB, ApplicantProfile,
  AbsoluteScoreResult, ComparativeScoreResult,
  DimensionResult, CRSBreakdown,
} from '../data/schemas.js';
import { scoreDimension } from './dimension-scorer.js';
import { runAdversarialCritic, runRewardEvaluator, applyPenalties, applyRewards } from './critic.js';
import { runHolisticPass, applyHolisticAdjustments } from './holistic.js';
import { buildComparativePrompt } from './prompts.js';
import { parseJsonResponse } from '../llm/json-parser.js';

function checkSourceConfidence(programsDb: ProgramsDB): string | null {
  let totalEntries = 0;
  let llmOnlyEntries = 0;

  for (const prog of Object.values(programsDb)) {
    totalEntries++;
    if (!prog.source || prog.source === 'llm_knowledge') {
      llmOnlyEntries++;
    }
  }

  if (totalEntries === 0) {
    return 'No program research data — scores capped at 85';
  }

  const llmRatio = llmOnlyEntries / totalEntries;
  if (llmRatio > 0.8) {
    return `${Math.round(llmRatio * 100)}% of program data is unverified LLM knowledge — success/robustness scores capped at 85`;
  }

  return null;
}

export class Scorer {
  constructor(
    private provider: LLMProvider,
    private model: string = 'unknown',
  ) {}

  async scoreAbsolute(
    pathwayContent: string,
    programsDb: ProgramsDB,
    profile: ApplicantProfile,
    rubrics: Rubrics,
    crs?: CRSBreakdown,
    log: (msg: string) => void = console.log,
  ): Promise<AbsoluteScoreResult> {
    const dimensions = rubrics.dimensions || {};
    const allScores: Record<string, DimensionResult> = {};

    for (const [dimName, dimConfig] of Object.entries(dimensions)) {
      log(`  Scoring ${dimName}...`);
      const result = await scoreDimension(this.provider, dimName, dimConfig, pathwayContent);
      allScores[dimName] = result;
      log(`  ${dimName}: ${result.score.toFixed(1)}`);
    }

    log('  Running adversarial critic...');
    const penalties = await runAdversarialCritic(this.provider, pathwayContent, programsDb, rubrics);
    log(`  ${penalties.length} penalties found`);

    const maxPen = typeof rubrics.adversarial_penalties?.max_penalty_per_dimension === 'number'
      ? rubrics.adversarial_penalties.max_penalty_per_dimension
      : -25;
    applyPenalties(allScores, penalties, maxPen);

    log('  Running reward evaluator...');
    const rewards = await runRewardEvaluator(this.provider, pathwayContent, programsDb, rubrics);
    log(`  ${rewards.length} rewards found`);

    const maxRew = typeof rubrics.rewards?.max_reward_per_dimension === 'number'
      ? rubrics.rewards.max_reward_per_dimension
      : 15;
    applyRewards(allScores, rewards, maxRew);

    log('  Running holistic pass...');
    const adjustments = await runHolisticPass(this.provider, allScores);
    log(`  ${adjustments.length} adjustments`);
    applyHolisticAdjustments(allScores, adjustments);

    const sourceWarning = checkSourceConfidence(programsDb);
    if (sourceWarning) {
      log(`  ⚠ ${sourceWarning}`);
      for (const dim of ['success_probability', 'plan_robustness']) {
        if (dim in allScores && allScores[dim].score > 85) {
          const before = allScores[dim].score;
          allScores[dim].score = Math.min(allScores[dim].score, 85);
          log(`  ${dim} capped: ${before.toFixed(1)} → ${allScores[dim].score.toFixed(1)} (unverified data)`);
        }
      }
    }

    const composite = Object.values(allScores).reduce(
      (sum, d) => sum + d.weight * d.score,
      0,
    );

    return {
      mode: 'absolute',
      composite_score: Math.round(composite * 100) / 100,
      components: allScores,
      penalties,
      rewards,
      holistic_adjustments: adjustments,
      crs_estimate: crs,
      scored_at: new Date().toISOString(),
      model: this.model,
    };
  }

  async scoreComparative(
    oldPathway: string,
    newPathway: string,
    mutation: string,
    rubrics: Rubrics,
    log: (msg: string) => void = console.log,
  ): Promise<ComparativeScoreResult> {
    log('  Comparing pathways...');
    const prompt = buildComparativePrompt(oldPathway, newPathway, mutation, rubrics);
    const response = await this.provider.complete(prompt, 4000);

    let deltas: Record<string, number> = {};
    try {
      const parsed = parseJsonResponse(response);
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        deltas = parsed;
      }
    } catch {
      log('  WARNING: comparative parse failed, treating as neutral');
    }

    const clamped: Record<string, number> = {};
    for (const [key, delta] of Object.entries(deltas)) {
      if (typeof delta === 'number') {
        clamped[key] = Math.max(-5, Math.min(5, delta));
      }
    }

    const dimensions2 = rubrics.dimensions || {};
    const dimDeltas: Record<string, { delta: number; weight: number; affected_subs: Record<string, number> }> = {};

    for (const [dimName, dimConfig] of Object.entries(dimensions2)) {
      const subs = dimConfig.sub_dimensions || {};
      const subCount = Object.keys(subs).length || 1;
      let dimTotal = 0;
      const affectedSubs: Record<string, number> = {};

      for (const sdName of Object.keys(subs)) {
        const fullKey = `${dimName}.${sdName}`;
        const d = clamped[fullKey] || 0;
        dimTotal += d;
        if (d !== 0) affectedSubs[fullKey] = d;
      }

      dimDeltas[dimName] = {
        delta: Math.round((dimTotal / subCount) * 100) / 100,
        weight: dimConfig.weight,
        affected_subs: affectedSubs,
      };
    }

    const compositeDelta = Object.values(dimDeltas).reduce(
      (sum, d) => sum + d.weight * d.delta,
      0,
    );

    const nonZero = Object.entries(clamped).filter(([, v]) => v !== 0);
    const verdict = compositeDelta > 0.05 ? 'better' : compositeDelta < -0.05 ? 'worse' : 'neutral';
    log(`  ${verdict} (delta: ${compositeDelta >= 0 ? '+' : ''}${compositeDelta.toFixed(2)}, ${nonZero.length} subs affected)`);

    return {
      mode: 'comparative',
      verdict,
      composite_delta: Math.round(compositeDelta * 100) / 100,
      sub_dimension_deltas: clamped,
      dimension_deltas: dimDeltas,
      mutation,
      scored_at: new Date().toISOString(),
      model: this.model,
    };
  }
}
