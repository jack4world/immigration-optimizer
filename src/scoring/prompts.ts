import type { Dimension, Rubrics, ProgramsDB } from '../data/schemas.js';

export function buildRubricText(dimConfig: Dimension): string {
  const lines: string[] = [];
  const subs = dimConfig.sub_dimensions || {};
  for (const [subName, subConfig] of Object.entries(subs)) {
    if (!subConfig) continue;
    lines.push(`\n### ${subName}: ${subConfig.description || ''}`);
    const anchors = subConfig.anchors || {};
    const sortedAnchors = Object.entries(anchors)
      .sort(([a], [b]) => Number(a) - Number(b));
    for (const [score, desc] of sortedAnchors) {
      lines.push(`  ${score}: ${desc}`);
    }
  }
  return lines.join('\n');
}

export function buildDimensionPrompt(
  dimName: string,
  dimConfig: Dimension,
  pathwayContent: string,
): string {
  const rubricText = buildRubricText(dimConfig);
  const subs = dimConfig.sub_dimensions || {};
  const subDims = Object.keys(subs);

  if (subDims.length === 0) {
    return `Score this immigration pathway on the dimension: ${dimName}

Score on a 0-100 scale. Do NOT round to multiples of 5.

## Immigration Pathway
${pathwayContent}

Respond in this exact JSON format (no other text):
{"overall": {"score": <0-100>, "note": "<1 sentence>"}}`;
  }

  return `Score this immigration pathway on the dimension: ${dimName}

Score each sub-dimension on a 0-100 scale using the rubric anchors below.
Do NOT round to multiples of 5 — use precise scores like 83, 87, 91.

## Rubric Anchors
${rubricText}

## Immigration Pathway
${pathwayContent}

Respond in this exact JSON format (no other text):
{
${subDims.map(sd => `  "${sd}": {"score": <0-100>, "note": "<1 sentence>"}`).join(',\n')}
}`;
}

export function buildCriticPrompt(
  pathwayContent: string,
  programsDb: ProgramsDB,
  rubrics: Rubrics,
): string {
  const rulesText: string[] = [];
  const penalties = rubrics.adversarial_penalties || {};
  for (const [category, rules] of Object.entries(penalties)) {
    if (category === 'max_penalty_per_dimension') continue;
    if (!Array.isArray(rules)) continue;
    for (const r of rules) {
      if (!r) continue;
      rulesText.push(`- [${category.toUpperCase()}] ${r.rule || ''} (penalty: ${r.penalty || -3})`);
    }
  }

  const programSummary = Object.values(programsDb)
    .map(p => `- ${p.id}: ${p.name} (min CLB ${p.eligibility.min_clb}, min edu ${p.eligibility.min_education}, ${p.eligibility.requires_job_offer ? 'needs job offer' : 'no job offer needed'})`)
    .join('\n');

  return `You are a ruthless immigration pathway critic. Your ONLY job is to find flaws.
Do NOT praise anything. Do NOT give the benefit of the doubt.

## PENALTY RULES — Check EVERY rule against EVERY step

${rulesText.length > 0 ? rulesText.join('\n') : '(no specific rules defined — use immigration planning best practices)'}

## MANDATORY AUDIT PROCEDURE

You MUST check each rule against each step of the pathway, one by one.
For each rule, write your reasoning before deciding TRIGGERED or NOT TRIGGERED.

Specifically check:
- Does each referenced program actually exist and is it currently active?
- Are ALL eligibility requirements met for each program?
- Are language test scores sufficient for the target program?
- Are processing time estimates realistic?
- Are ALL costs accounted for (application fees, biometrics, medical, police certs)?
- Will credentials/test scores still be valid when needed?
- Are step dependencies correctly ordered?
- Are there parallel opportunities being missed?

## Available Programs Database
${programSummary || '(empty)'}

## The Immigration Pathway
${pathwayContent}

Find every violation. Be strict and specific.
For each issue, cite the exact step number and the specific problem.
A penalty that COULD apply DOES apply — err on the side of penalizing.

Return a JSON array of penalties (no other text):
[{"category": "eligibility|timeline|cost|feasibility", "step": N, "issue": "specific description", "penalty": -N}]

Return an empty array [] ONLY if you have verified every rule against every step and found zero violations.`;
}

export function buildRewardPrompt(
  pathwayContent: string,
  programsDb: ProgramsDB,
  rubrics: Rubrics,
): string {
  const rewardRulesText: string[] = [];
  const rewards = rubrics.rewards || {};
  for (const [category, rules] of Object.entries(rewards)) {
    if (category === 'max_reward_per_dimension') continue;
    if (!Array.isArray(rules)) continue;
    for (const r of rules) {
      if (!r) continue;
      rewardRulesText.push(`- [${category.toUpperCase()}] ${r.rule || ''} (reward: +${r.reward || 3})`);
    }
  }

  if (rewardRulesText.length === 0) {
    rewardRulesText.push(
      '- [ELIGIBILITY] Applicant exceeds ALL program requirements by significant margin (reward: +5)',
      '- [ELIGIBILITY] CRS score 30+ points above recent draw cutoff (reward: +8)',
      '- [TIMELINE] Steps optimally parallelized — no wasted waiting time (reward: +5)',
      '- [TIMELINE] Total pathway duration under 12 months (reward: +8)',
      '- [COST] Total cost under $10,000 CAD (reward: +5)',
      '- [ROBUSTNESS] Has 2+ viable backup pathways with low switch cost (reward: +5)',
      '- [ROBUSTNESS] Primary pathway uses stable, well-established program (reward: +3)',
      '- [QUALITY] Destination matches applicant\'s top province preference (reward: +3)',
      '- [QUALITY] No career interruption needed during immigration process (reward: +5)',
    );
  }

  return `You are an immigration pathway evaluator looking for STRENGTHS and best practices.
Your job is to identify what the pathway does WELL. Be generous but honest.

## REWARD RULES — Check EVERY rule against the pathway

${rewardRulesText.join('\n')}

## The Immigration Pathway
${pathwayContent}

Find every strength. For each, cite the specific step or aspect that earns the reward.
A reward should only be given if the pathway CLEARLY demonstrates the positive trait.

Return a JSON array of rewards (no other text):
[{"category": "eligibility|timeline|cost|robustness|quality", "step": N, "reason": "specific reason", "reward": +N}]

Return an empty array [] if no clear strengths are found.`;
}

export function buildHolisticPrompt(
  allScores: Record<string, { score: number; weight: number; sub_dimensions: Record<string, { score: number }> }>,
): string {
  const scoresSummary: string[] = [];
  for (const [dim, data] of Object.entries(allScores)) {
    const subs = data.sub_dimensions || {};
    const subDetail = Object.entries(subs)
      .map(([sd, info]) => `${sd}: ${(info?.score ?? 0).toFixed(0)}`)
      .join(', ');
    scoresSummary.push(`- ${dim}: ${(data.score ?? 0).toFixed(1)} (weight: ${data.weight}) [${subDetail}]`);
  }

  return `You are reviewing scores from independent judges evaluating an immigration pathway.
Each judge scored one dimension without seeing the others' results.

Your job: identify where dimensions INTERACT and one judge missed something
that another judge's context reveals. Adjust +/-5 points max per dimension.

## Current Scores
${scoresSummary.join('\n')}

Examples of cross-dimension interactions:
- Success probability scored high but timeline shows 3+ years — timeline pressure may reduce success if policies change
- Cost scored well but plan robustness shows no backup — risky if main path fails after spending
- Quality of life scored low but success probability high — acceptable trade-off, maybe bump QoL +2

Return a JSON array of adjustments (no other text):
[{"dimension": "dim_name", "adjustment": +/-N, "reason": "1 sentence"}]

Max +/-5 per dimension. Return [] if no adjustments needed.`;
}

export function buildComparativePrompt(
  oldPathway: string,
  newPathway: string,
  mutation: string,
  rubrics: Rubrics,
): string {
  const allSubDims: string[] = [];
  const dims = rubrics.dimensions || {};
  for (const [dimName, dimConfig] of Object.entries(dims)) {
    const subs = dimConfig?.sub_dimensions || {};
    for (const sdName of Object.keys(subs)) {
      allSubDims.push(`${dimName}.${sdName}`);
    }
  }

  return `You are comparing two versions of an immigration pathway. A single mutation was applied.

## Mutation Applied
${mutation}

## PATHWAY A (before mutation)
${oldPathway}

## PATHWAY B (after mutation)
${newPathway}

For each sub-dimension below, score the IMPACT of this mutation:
- Positive (+1 to +5): the mutation improved this aspect
- Negative (-1 to -5): the mutation hurt this aspect
- Neutral (0): no meaningful change

IMPORTANT: Most sub-dimensions should be NEUTRAL (0) — a single mutation
rarely affects more than 2-3 sub-dimensions. Don't inflate changes.

Sub-dimensions:
${allSubDims.map(sd => `- ${sd}`).join('\n')}

Return a JSON object with ONLY affected sub-dimensions (non-zero deltas).
Omit neutral sub-dimensions.

Example (no other text):
{"success_probability.crs_competitiveness": 3, "timeline_efficiency.total_duration": -1}

Return {} if no meaningful impact.`;
}
