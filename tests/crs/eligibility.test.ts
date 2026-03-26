import { describe, it, expect } from 'vitest';
import { checkEligibility } from '../../src/crs/eligibility.js';
import type { ApplicantProfile, ImmigrationProgram } from '../../src/data/schemas.js';
import { SEED_PROGRAMS } from '../../src/data/seed-programs.js';

function makeProfile(overrides: Partial<ApplicantProfile> = {}): ApplicantProfile {
  return {
    personal: { name: 'Test', nationality: 'Chinese', age: 30, date_of_birth: '1996-01-01', marital_status: 'single', has_children: false },
    education: { highest_degree: 'masters', field_of_study: 'CS', institution: 'Test', country: 'China', year_completed: 2020, has_canadian_credential: false, eca_completed: true },
    language: { primary_test: 'IELTS', english: { reading: 9, writing: 8, listening: 9, speaking: 8 }, french: null },
    work_experience: { canadian: [], foreign: [], total_years_canadian: 0, total_years_foreign: 5, current_occupation: 'Engineer', noc_code: '21232', teer_category: 0 },
    finances: { settlement_funds_cad: 20000, proof_of_funds_available: true, willing_to_invest: false },
    canadian_ties: { has_job_offer: false, has_lmia: false, relatives_in_canada: false, previous_study_in_canada: false, previous_work_in_canada: false, previous_visit_to_canada: false },
    preferences: { target_provinces: ['Ontario'], preferred_city_size: 'any', industry_preference: ['CS'], timeline_urgency: 'within_1_year', risk_tolerance: 'medium', willing_to_study: false, willing_to_relocate_province: true, priority_order: ['certainty'], anti_patterns: [] },
    ...overrides,
  };
}

describe('checkEligibility', () => {
  it('returns eligible for FSWP with qualified applicant', () => {
    const result = checkEligibility(makeProfile(), SEED_PROGRAMS.ee_fswp);
    expect(result.eligible).toBe(true);
    expect(result.unmet).toHaveLength(0);
  });

  it('returns ineligible for CEC without Canadian experience', () => {
    const result = checkEligibility(makeProfile(), SEED_PROGRAMS.ee_cec);
    expect(result.eligible).toBe(false);
    expect(result.unmet.some(u => u.includes('加拿大工作'))).toBe(true);
  });

  it('returns ineligible when CLB too low', () => {
    const profile = makeProfile({
      language: { primary_test: 'IELTS', english: { reading: 5, writing: 5, listening: 5, speaking: 5 }, french: null },
    });
    const result = checkEligibility(profile, SEED_PROGRAMS.ee_fswp);
    expect(result.eligible).toBe(false);
    expect(result.unmet.some(u => u.includes('CLB'))).toBe(true);
  });

  it('marks close items when CLB is 1 below', () => {
    const profile = makeProfile({
      language: { primary_test: 'IELTS', english: { reading: 6, writing: 6, listening: 6, speaking: 6 }, french: null },
    });
    const result = checkEligibility(profile, SEED_PROGRAMS.ee_fswp);
    expect(result.close.length).toBeGreaterThan(0);
  });

  it('returns ineligible when settlement funds insufficient', () => {
    const profile = makeProfile({ finances: { settlement_funds_cad: 5000, proof_of_funds_available: true, willing_to_invest: false } });
    const result = checkEligibility(profile, SEED_PROGRAMS.ee_fswp);
    expect(result.eligible).toBe(false);
    expect(result.unmet.some(u => u.includes('安家资金'))).toBe(true);
  });

  it('returns ineligible for programs requiring job offer', () => {
    const result = checkEligibility(makeProfile(), SEED_PROGRAMS.bc_tech);
    expect(result.eligible).toBe(false);
    expect(result.unmet.some(u => u.includes('offer'))).toBe(true);
  });

  it('returns eligibility score between 0 and 100', () => {
    const result = checkEligibility(makeProfile(), SEED_PROGRAMS.ee_fswp);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
