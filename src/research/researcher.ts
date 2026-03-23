import type { LLMProvider } from '../llm/provider.js';
import type { ImmigrationProgram, ApplicantProfile, ProgramsDB } from '../data/schemas.js';
import type { Config } from '../data/config.js';
import { parseJsonResponse } from '../llm/json-parser.js';
import { getLlmLanguageInstruction } from '../i18n.js';
import { webSearch, buildSearchQueries, buildFederalSearchQueries, type SearchResult } from './web-search.js';

function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return '';
  return results
    .map(r => `- [${r.title}](${r.url})\n  ${r.snippet}`)
    .join('\n');
}

export async function researchPrograms(
  provider: LLMProvider,
  profile: ApplicantProfile,
  existingDb: ProgramsDB,
  config?: Config,
  log: (msg: string) => void = () => {},
): Promise<ImmigrationProgram[]> {
  const langInstruction = getLlmLanguageInstruction();
  const existingIds = Object.keys(existingDb);

  let webContext = '';
  if (config) {
    log('  Searching web for federal programs...');
    const queries = buildFederalSearchQueries();
    const allResults: SearchResult[] = [];
    for (const q of queries) {
      const results = await webSearch(q, config);
      allResults.push(...results);
      if (allResults.length >= 20) break;
    }
    if (allResults.length > 0) {
      webContext = `\n## Web Search Results (use these to verify and supplement your knowledge)\n${formatSearchResults(allResults)}\n`;
      log(`  Found ${allResults.length} web results for federal programs`);
    }
  }

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
${webContext}
Research and return 8-15 immigration programs suitable for this applicant (exclude already known programs).

IMPORTANT research instructions:
- For EACH target province, research ALL available PNP streams (not just one per province)
  - Express Entry linked streams
  - Employer-driven streams
  - Entrepreneur/business streams
  - Foreign graduate streams
  - Tech/priority occupation streams
  - Rural/regional streams
- Include federal programs: EE category-based draws (STEM, healthcare, French, trade), Rural & Northern, caregiver
- Include work permit pathways that can lead to PR (e.g., LMIA work permit → CEC)
- For each province listed in target, list every stream the applicant could potentially qualify for
- Also check provinces NOT in the target list if they have strong programs for this NOC code
${webContext ? '- Use the web search results above to verify program details and find new programs not in your training data' : ''}
- Mark source as "web_research" for programs verified against web search results, "llm_knowledge" otherwise

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
  "source": "llm_knowledge or web_research",
  "last_verified": "${new Date().toISOString().split('T')[0]}",
  "url": "official program URL if known"
}

Return ONLY the JSON array.${langInstruction}`;

  const response = await provider.complete(prompt, 16000);
  return parseJsonResponse(response);
}

const ALL_PROVINCES = [
  'Ontario', 'British Columbia', 'Alberta', 'Saskatchewan', 'Manitoba',
  'Nova Scotia', 'New Brunswick', 'Newfoundland and Labrador', 'PEI',
];

export async function researchProvince(
  provider: LLMProvider,
  province: string,
  profile: ApplicantProfile,
  existingDb: ProgramsDB,
  config?: Config,
  log: (msg: string) => void = () => {},
): Promise<ImmigrationProgram[]> {
  const langInstruction = getLlmLanguageInstruction();
  const existingForProvince = Object.values(existingDb)
    .filter(p => p.province === province)
    .map(p => `${p.id}: ${p.stream || p.name}`)
    .join(', ');

  let webContext = '';
  if (config) {
    const queries = buildSearchQueries(province, profile.work_experience.noc_code);
    const allResults: SearchResult[] = [];
    for (const q of queries) {
      const results = await webSearch(q, config);
      allResults.push(...results);
      if (allResults.length >= 15) break;
    }
    if (allResults.length > 0) {
      webContext = `\n## Web Search Results for ${province}\n${formatSearchResults(allResults)}\n`;
      log(`    ${allResults.length} web results for ${province}`);
    }
  }

  const prompt = `You are a Canadian immigration researcher specializing in ${province}.

## Applicant
- ${profile.work_experience.current_occupation} (NOC ${profile.work_experience.noc_code}, TEER ${profile.work_experience.teer_category})
- Education: ${profile.education.highest_degree}
- Foreign work: ${profile.work_experience.total_years_foreign}yr, Canadian: ${profile.work_experience.total_years_canadian}yr
- CLB: ${profile.language.english ? Math.min(profile.language.english.reading, profile.language.english.writing, profile.language.english.listening, profile.language.english.speaking) : 'N/A'}
- Funds: $${profile.finances.settlement_funds_cad} CAD

## Already known for ${province}
${existingForProvince || '(none)'}
${webContext}
List ALL Provincial Nominee Program streams available in ${province}, including:
1. Express Entry linked streams
2. Employer-driven / job offer streams
3. Entrepreneur / business streams
4. International graduate streams
5. Tech / priority occupation streams
6. Rural / regional streams
7. Semi-skilled worker streams
8. Any other active streams
${webContext ? '\nUse the web search results above to verify details, find new streams, and get current draw scores.\nMark source as "web_research" for programs found or verified via search results.' : ''}

For each stream, provide full eligibility details even if the applicant may not qualify.
This is a COMPREHENSIVE database — we want EVERY active stream, not just the best fit.

Return JSON array with the same ImmigrationProgram structure.
Return ONLY the JSON array.${langInstruction}`;

  const response = await provider.complete(prompt, 12000);
  return parseJsonResponse(response);
}

export async function researchAllPrograms(
  provider: LLMProvider,
  profile: ApplicantProfile,
  existingDb: ProgramsDB,
  log: (msg: string) => void = console.log,
  config?: Config,
): Promise<ImmigrationProgram[]> {
  const allNew: ImmigrationProgram[] = [];

  const hasSearch = !!(config?.search_api?.api_key);
  if (hasSearch) {
    log('  Web search API configured — will verify programs against live data');
  } else {
    log('  No web search API — using LLM knowledge only (configure with: immigration-optimizer config set search_api.provider tavily)');
  }

  log('  Researching federal programs...');
  const federal = await researchPrograms(provider, profile, existingDb, config, log);
  allNew.push(...federal);
  log(`  Found ${federal.length} federal/general programs`);

  const provinces = [...new Set([
    ...profile.preferences.target_provinces,
    ...ALL_PROVINCES.filter(p => !profile.preferences.target_provinces.includes(p)),
  ])];

  for (const province of provinces) {
    log(`  Researching ${province}...`);
    try {
      const merged = mergeProgramsDb(existingDb, allNew);
      const provincial = await researchProvince(provider, province, profile, merged, config, log);
      allNew.push(...provincial);
      log(`  Found ${provincial.length} programs for ${province}`);
    } catch (err) {
      log(`  ${province}: research failed — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const webVerified = allNew.filter(p => p.source === 'web_research').length;
  const llmOnly = allNew.filter(p => p.source === 'llm_knowledge').length;
  log(`\n  Research complete: ${allNew.length} new programs (${webVerified} web-verified, ${llmOnly} LLM-only)`);

  return allNew;
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
