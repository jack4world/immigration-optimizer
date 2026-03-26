import type { LLMProvider } from '../llm/provider.js';
import type { MutationType, MutationResult, ApplicantProfile, ProgramsDB } from '../data/schemas.js';
import { parseJsonResponse } from '../llm/json-parser.js';
import { getLlmLanguageInstruction } from '../i18n.js';

const MUTATION_ROTATION: MutationType[] = [
  'SWAP_PROGRAM',
  'ADD_CREDENTIAL',
  'REORDER_STEPS',
  'ADD_PARALLEL',
  'SWITCH_PROVINCE',
];

export function pickMutationType(iteration: number, consecutiveDiscards: number): MutationType {
  if (consecutiveDiscards >= 5) return 'RESEARCH';
  return MUTATION_ROTATION[iteration % MUTATION_ROTATION.length];
}

function buildMutationPrompt(
  type: MutationType,
  pathwayContent: string,
  profile: ApplicantProfile,
  programsDb: ProgramsDB,
): string {
  const langInstruction = getLlmLanguageInstruction();
  const profileSummary = `Applicant: ${profile.personal.name}, Age ${profile.personal.age}, ${profile.personal.nationality}
Occupation: ${profile.work_experience.current_occupation} (NOC ${profile.work_experience.noc_code}, TEER ${profile.work_experience.teer_category})
Education: ${profile.education.highest_degree} in ${profile.education.field_of_study}
Foreign work: ${profile.work_experience.total_years_foreign}yr, Canadian work: ${profile.work_experience.total_years_canadian}yr
English: ${profile.language.english ? `CLB R${profile.language.english.reading}/W${profile.language.english.writing}/L${profile.language.english.listening}/S${profile.language.english.speaking}` : 'None'}
French: ${profile.language.french ? 'Yes' : 'None'}
Settlement funds: $${profile.finances.settlement_funds_cad} CAD
Target provinces: ${profile.preferences.target_provinces.join(', ')}
Anti-patterns: ${profile.preferences.anti_patterns.join(', ') || 'none'}`;

  const dbSummary = Object.entries(programsDb)
    .map(([id, p]) => `${id}: ${p.name_zh || p.name} (CLB>=${p.eligibility.min_clb}, success ${p.metrics.success_rate_estimate}%, ${p.metrics.competition_level})`)
    .join('\n');

  const baseContext = `## Current Pathway
${pathwayContent}

## Applicant Profile
${profileSummary}

## Programs Database
${dbSummary || '(empty)'}`;

  const typePrompts: Record<MutationType, string> = {
    SWAP_PROGRAM: `Find the immigration program in the pathway with the lowest success probability or worst fit for this applicant, and replace it with a better-fit program from the database. Consider CRS competitiveness, eligibility match, processing time, and the applicant's preferences.`,
    ADD_CREDENTIAL: `Analyze the applicant's CRS weak points and recommend adding ONE credential or test step. Options: retake IELTS/CELPIP for higher CLB, add French (TEF/TCF) for bilingual bonus, obtain a Canadian credential for education bonus, or get a professional certification. Evaluate the ROI: time cost vs CRS improvement.`,
    REORDER_STEPS: `Check step dependencies and find steps that can be started earlier to shorten the critical path total time. Consider: which steps have real prerequisites vs which were unnecessarily sequenced. Document preparation, police certificates, and medical exams can often start earlier.`,
    ADD_PARALLEL: `Find steps currently arranged in series that can actually run in parallel. Examples: language test prep while waiting for ECA, medical exam while waiting for ITA, police certificates while preparing PR application. Mark parallel steps and update the timeline.`,
    SWITCH_PROVINCE: `Evaluate whether a different province's PNP would be a better fit. Compare: eligibility requirements, processing times, CRS boost (+600 for nomination), job market for the applicant's NOC, and destination preference match. If the current strategy is already optimal, add a backup provincial path.`,
    RESEARCH: `The optimization is stuck. Research 3-5 new immigration programs or pathways not yet in the database. Consider: new federal pilot programs, lesser-known PNP streams, industry-specific pathways, or combination strategies (e.g., work permit → CEC). Return new programs with full data.`,
  };

  return `You are making a single "${type}" mutation to improve this Canadian immigration pathway.

## Task
${typePrompts[type]}

${baseContext}

## Response Format
Return a JSON object with exactly these fields:
{
  "type": "${type}",
  "description": "Brief English description of what changed",
  "description_zh": "中文描述",
  "new_pathway": "The COMPLETE updated pathway.md content with the mutation applied",
  "rationale": "Why this change improves the pathway"${type === 'RESEARCH' ? ',\n  "new_programs": [<array of new ImmigrationProgram objects>]' : ''}
}

IMPORTANT:
- Make exactly ONE change. Do not modify anything else in the pathway.
- Return the COMPLETE pathway content, not just the changed section.
- Keep all YAML frontmatter intact.
- The description should be specific enough to understand without reading the full pathway.${langInstruction}`;
}

export async function generateMutation(
  provider: LLMProvider,
  type: MutationType,
  pathwayContent: string,
  profile: ApplicantProfile,
  programsDb: ProgramsDB,
): Promise<MutationResult> {
  const prompt = buildMutationPrompt(type, pathwayContent, profile, programsDb);
  const response = await provider.complete(prompt, 32000);

  const parsed = parseJsonResponse(response);

  return {
    type: parsed.type || type,
    description: parsed.description || 'Unknown mutation',
    description_zh: parsed.description_zh || parsed.description || '',
    newPathwayContent: parsed.new_pathway || pathwayContent,
    new_programs: parsed.new_programs,
    rationale: parsed.rationale || '',
  };
}
