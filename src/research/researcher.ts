import type { LLMProvider } from '../llm/provider.js';
import type { ImmigrationProgram, ApplicantProfile, ProgramsDB } from '../data/schemas.js';
import { parseJsonResponse } from '../llm/json-parser.js';
import { getLlmLanguageInstruction } from '../i18n.js';

export async function researchPrograms(
  provider: LLMProvider,
  profile: ApplicantProfile,
  existingDb: ProgramsDB,
): Promise<ImmigrationProgram[]> {
  const langInstruction = getLlmLanguageInstruction();
  const existingIds = Object.keys(existingDb);

  const prompt = `You are a Canadian immigration program researcher.

## Applicant Background
- Nationality: ${profile.personal.nationality}
- Age: ${profile.personal.age}
- Education: ${profile.education.highest_degree} in ${profile.education.field_of_study}
- Occupation: ${profile.work_experience.current_occupation} (NOC ${profile.work_experience.noc_code}, TEER ${profile.work_experience.teer_category})
- Foreign work: ${profile.work_experience.total_years_foreign} years
- Canadian work: ${profile.work_experience.total_years_canadian} years
- English CLB: ${profile.language.english ? Math.min(profile.language.english.reading, profile.language.english.writing, profile.language.english.listening, profile.language.english.speaking) : 'N/A'}
- French: ${profile.language.french ? 'Yes' : 'No'}
- Settlement funds: $${profile.finances.settlement_funds_cad} CAD
- Target provinces: ${profile.preferences.target_provinces.join(', ')}

## Already in database
${existingIds.join(', ') || '(none)'}

Research and return 5-8 immigration programs suitable for this applicant (exclude already known programs).
Include federal programs, provincial nominee programs, and any special pathways.

Return a JSON array of programs, each with this structure:
{
  "id": "unique_id",
  "name": "English name",
  "name_zh": "中文名",
  "category": "express_entry|pnp|atlantic|startup_visa|study_pathway|work_permit|other",
  "stream": "specific stream if applicable",
  "province": "province or null for federal",
  "description": "English description",
  "description_zh": "中文描述",
  "eligibility": {
    "min_clb": number,
    "min_education": "degree level",
    "min_work_years_canadian": number,
    "min_work_years_foreign": number,
    "min_noc_teer": number,
    "min_settlement_funds": number,
    "requires_job_offer": boolean,
    "requires_lmia": boolean,
    "requires_provincial_nomination": boolean,
    "additional_requirements": ["string"]
  },
  "processing": {
    "typical_processing_months": { "min": number, "max": number },
    "application_fee_cad": number,
    "additional_costs": [{ "item": "name", "cost_cad": number }],
    "total_estimated_cost_cad": number
  },
  "metrics": {
    "success_rate_estimate": 0-100,
    "historical_cutoff_crs": number or null,
    "annual_quota": number or null,
    "competition_level": "low|medium|high|very_high"
  },
  "source": "llm_knowledge",
  "last_verified": "${new Date().toISOString().split('T')[0]}"
}

Return ONLY the JSON array.${langInstruction}`;

  const response = await provider.complete(prompt, 8000);
  return parseJsonResponse(response);
}

export function mergeProgramsDb(
  existing: ProgramsDB,
  newPrograms: ImmigrationProgram[],
): ProgramsDB {
  const merged = { ...existing };
  const sourcePriority: Record<string, number> = {
    ircc_official: 4,
    provincial_official: 3,
    web_research: 2,
    llm_knowledge: 1,
  };

  for (const prog of newPrograms) {
    if (merged[prog.id]) {
      const existingP = sourcePriority[merged[prog.id].source] ?? 0;
      const newP = sourcePriority[prog.source] ?? 0;
      if (newP >= existingP) {
        merged[prog.id] = prog;
      }
    } else {
      merged[prog.id] = prog;
    }
  }

  return merged;
}
