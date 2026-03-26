import type { LLMProvider } from '../llm/provider.js';
import type { ApplicantProfile, CRSBreakdown, ProgramsDB } from '../data/schemas.js';
import { getLlmLanguageInstruction } from '../i18n.js';

export async function generatePathway(
  provider: LLMProvider,
  profile: ApplicantProfile,
  crs: CRSBreakdown,
  programsDb: ProgramsDB,
): Promise<string> {
  const langInstruction = getLlmLanguageInstruction();

  const programsList = Object.values(programsDb)
    .map(p => `- ${p.name} (${p.name_zh}): ${p.description_zh || p.description}`)
    .join('\n');

  const prompt = `Generate a detailed, step-by-step immigration pathway to Canadian Permanent Residency for this applicant.

## Applicant Profile
- Name: ${profile.personal.name}
- Nationality: ${profile.personal.nationality}
- Age: ${profile.personal.age}
- Marital status: ${profile.personal.marital_status}
- Education: ${profile.education.highest_degree} in ${profile.education.field_of_study} (${profile.education.institution}, ${profile.education.country}, ${profile.education.year_completed})
- ECA completed: ${profile.education.eca_completed ? 'Yes' : 'No'}
- English: ${profile.language.english ? `CLB R${profile.language.english.reading}/W${profile.language.english.writing}/L${profile.language.english.listening}/S${profile.language.english.speaking}` : 'None'}
- French: ${profile.language.french ? `CLB R${profile.language.french.reading}/W${profile.language.french.writing}/L${profile.language.french.listening}/S${profile.language.french.speaking}` : 'None'}
- Current occupation: ${profile.work_experience.current_occupation} (NOC ${profile.work_experience.noc_code}, TEER ${profile.work_experience.teer_category})
- Foreign work: ${profile.work_experience.total_years_foreign} years
- Canadian work: ${profile.work_experience.total_years_canadian} years
- Settlement funds: $${profile.finances.settlement_funds_cad} CAD
- Job offer in Canada: ${profile.canadian_ties.has_job_offer ? 'Yes' : 'No'}
- Relatives in Canada: ${profile.canadian_ties.relatives_in_canada ? 'Yes' : 'No'}

## CRS Score Breakdown
- Total: ${crs.total}
- Age: ${crs.details.age}, Education: ${crs.details.education}, Language: ${crs.details.first_language}
- Canadian experience: ${crs.details.canadian_experience}, Skill transfer: ${crs.skill_transferability}
- Additional: ${crs.additional_points}

## Available Immigration Programs
${programsList}

## Applicant Preferences
- Target provinces: ${profile.preferences.target_provinces.join(', ')}
- Timeline: ${profile.preferences.timeline_urgency}
- Risk tolerance: ${profile.preferences.risk_tolerance}
- Willing to study: ${profile.preferences.willing_to_study ? 'Yes' : 'No'}
- Willing to relocate province: ${profile.preferences.willing_to_relocate_province ? 'Yes' : 'No'}
- Things to avoid: ${profile.preferences.anti_patterns.join(', ') || 'none'}

## Requirements
Generate a complete pathway.md with:

1. YAML frontmatter:
---
applicant: "${profile.personal.name}"
target: "Canadian Permanent Residency"
primary_program: "<best fit program>"
crs_estimate: ${crs.total}
total_duration_months: <estimated>
total_cost_cad: <estimated>
generated_at: "${new Date().toISOString().split('T')[0]}"
---

2. Summary table of all steps:
| Step | Action | Timeline | Cost (CAD) | Status | Parallel |
|------|--------|----------|------------|--------|----------|

3. Detailed section for each step including:
- Goal and rationale
- Current status (what the applicant already has)
- CRS impact (if applicable)
- Timeline with specific months
- Cost breakdown
- Risks and mitigation strategies
- Prerequisites

4. Backup pathways (Plan B, Plan C) with:
- When to trigger the backup
- Additional time and cost
- Trade-offs

5. Risk assessment table:
| Risk | Probability | Impact | Mitigation |

IMPORTANT:
- Be specific about timelines (use actual month estimates based on current date)
- Include ALL costs (application fees, biometrics, medical, police certificates, etc.)
- Identify which steps can run in parallel
- Consider the applicant's CRS score vs recent draw cutoffs
- If CRS is below typical cutoffs, recommend PNP or credential improvement steps
- Include realistic processing time estimates${langInstruction}`;

  return await provider.complete(prompt, 32000);
}
