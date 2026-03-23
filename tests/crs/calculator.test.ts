import { describe, it, expect } from 'vitest';
import { calculateCRS, ieltsToClb } from '../../src/crs/calculator.js';
import type { ApplicantProfile } from '../../src/data/schemas.js';

function makeProfile(overrides: Partial<ApplicantProfile> = {}): ApplicantProfile {
  return {
    personal: { name: 'Test', nationality: 'Chinese', age: 30, date_of_birth: '1996-01-01', marital_status: 'single', has_children: false },
    education: { highest_degree: 'masters', field_of_study: 'CS', institution: 'Tsinghua', country: 'China', year_completed: 2020, has_canadian_credential: false, eca_completed: true },
    language: { primary_test: 'IELTS', english: { reading: 10, writing: 9, listening: 10, speaking: 9 }, french: null },
    work_experience: { canadian: [], foreign: [], total_years_canadian: 0, total_years_foreign: 5, current_occupation: 'Engineer', noc_code: '21232', teer_category: 0 },
    finances: { settlement_funds_cad: 20000, proof_of_funds_available: true, willing_to_invest: false },
    canadian_ties: { has_job_offer: false, has_lmia: false, relatives_in_canada: false, previous_study_in_canada: false, previous_work_in_canada: false, previous_visit_to_canada: false },
    preferences: { target_provinces: ['Ontario'], preferred_city_size: 'any', industry_preference: ['CS'], timeline_urgency: 'within_1_year', risk_tolerance: 'medium', willing_to_study: false, willing_to_relocate_province: true, priority_order: ['certainty'], anti_patterns: [] },
    ...overrides,
  };
}

describe('ieltsToClb', () => {
  it('converts IELTS bands to CLB', () => {
    expect(ieltsToClb(8.5)).toBe(12);
    expect(ieltsToClb(8.0)).toBe(11);
    expect(ieltsToClb(7.5)).toBe(10);
    expect(ieltsToClb(7.0)).toBe(9);
    expect(ieltsToClb(6.5)).toBe(8);
    expect(ieltsToClb(6.0)).toBe(7);
    expect(ieltsToClb(5.5)).toBe(6);
    expect(ieltsToClb(5.0)).toBe(5);
    expect(ieltsToClb(4.0)).toBe(4);
    expect(ieltsToClb(3.5)).toBe(3);
  });
});

describe('calculateCRS', () => {
  it('calculates total CRS for a single applicant', () => {
    const crs = calculateCRS(makeProfile());
    expect(crs.total).toBeGreaterThan(0);
    expect(crs.total).toBeLessThanOrEqual(1200);
  });

  it('gives maximum age points at 20-29 for single', () => {
    const crs = calculateCRS(makeProfile({ personal: { name: 'Test', nationality: 'CN', age: 25, date_of_birth: '2001-01-01', marital_status: 'single', has_children: false } }));
    expect(crs.details.age).toBe(110);
  });

  it('gives zero age points at 45+', () => {
    const crs = calculateCRS(makeProfile({ personal: { name: 'Test', nationality: 'CN', age: 45, date_of_birth: '1981-01-01', marital_status: 'single', has_children: false } }));
    expect(crs.details.age).toBe(0);
  });

  it('gives education points for masters', () => {
    const crs = calculateCRS(makeProfile());
    expect(crs.details.education).toBe(135);
  });

  it('adds provincial nomination points', () => {
    const profile = makeProfile({ canadian_ties: { has_job_offer: false, has_lmia: false, provincial_nomination: 'Ontario', relatives_in_canada: false, previous_study_in_canada: false, previous_work_in_canada: false, previous_visit_to_canada: false } });
    const crs = calculateCRS(profile);
    expect(crs.details.provincial_nomination).toBe(600);
    expect(crs.additional_points).toBeGreaterThanOrEqual(600);
  });

  it('adds job offer points with LMIA', () => {
    const profile = makeProfile({ canadian_ties: { has_job_offer: true, has_lmia: true, relatives_in_canada: false, previous_study_in_canada: false, previous_work_in_canada: false, previous_visit_to_canada: false } });
    const crs = calculateCRS(profile);
    expect(crs.details.job_offer).toBe(200);
  });

  it('gives lower points for married applicants', () => {
    const single = calculateCRS(makeProfile());
    const married = calculateCRS(makeProfile({ personal: { name: 'Test', nationality: 'CN', age: 30, date_of_birth: '1996-01-01', marital_status: 'married', has_children: false } }));
    expect(married.details.age).toBeLessThan(single.details.age);
  });

  it('adds skill transferability for high CLB + masters', () => {
    const crs = calculateCRS(makeProfile());
    expect(crs.skill_transferability).toBeGreaterThan(0);
  });

  it('caps total at 1200', () => {
    const profile = makeProfile({ canadian_ties: { has_job_offer: true, has_lmia: true, provincial_nomination: 'Ontario', relatives_in_canada: true, previous_study_in_canada: false, previous_work_in_canada: false, previous_visit_to_canada: false } });
    const crs = calculateCRS(profile);
    expect(crs.total).toBeLessThanOrEqual(1200);
  });
});
