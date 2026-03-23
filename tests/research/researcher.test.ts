import { describe, it, expect } from 'vitest';
import { mergeProgramsDb } from '../../src/research/researcher.js';
import type { ImmigrationProgram, ProgramsDB } from '../../src/data/schemas.js';

function makeProgram(id: string, source: 'llm_knowledge' | 'web_research' | 'ircc_official' = 'llm_knowledge'): ImmigrationProgram {
  return {
    id,
    name: `Program ${id}`,
    name_zh: `项目 ${id}`,
    category: 'express_entry',
    description: 'test',
    description_zh: 'test',
    eligibility: {
      min_clb: 7,
      min_education: 'bachelors',
      min_work_years_canadian: 0,
      min_work_years_foreign: 1,
      min_noc_teer: 3,
      min_settlement_funds: 13757,
      requires_job_offer: false,
      requires_lmia: false,
      requires_provincial_nomination: false,
      additional_requirements: [],
    },
    processing: {
      typical_processing_months: { min: 5, max: 8 },
      application_fee_cad: 1365,
      additional_costs: [],
      total_estimated_cost_cad: 1365,
    },
    metrics: {
      success_rate_estimate: 80,
      competition_level: 'medium',
    },
    source,
    last_verified: '2026-01-01',
  };
}

describe('mergeProgramsDb', () => {
  it('returns new programs when db is empty', () => {
    const result = mergeProgramsDb({}, [makeProgram('a'), makeProgram('b')]);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result.a.id).toBe('a');
  });

  it('merges without overwriting higher-priority sources', () => {
    const existing: ProgramsDB = { a: makeProgram('a', 'ircc_official') };
    const result = mergeProgramsDb(existing, [makeProgram('a', 'llm_knowledge'), makeProgram('b')]);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result.a.source).toBe('ircc_official');
    expect(result.b.source).toBe('llm_knowledge');
  });

  it('overwrites lower-priority sources', () => {
    const existing: ProgramsDB = { a: makeProgram('a', 'llm_knowledge') };
    const result = mergeProgramsDb(existing, [makeProgram('a', 'web_research')]);
    expect(result.a.source).toBe('web_research');
  });
});
