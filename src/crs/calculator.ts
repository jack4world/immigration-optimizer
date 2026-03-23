import type { ApplicantProfile, CRSBreakdown } from '../data/schemas.js';

const AGE_POINTS_SINGLE: Record<number, number> = {
  17: 0, 18: 99, 19: 105, 20: 110, 21: 110, 22: 110, 23: 110,
  24: 110, 25: 110, 26: 110, 27: 110, 28: 110, 29: 110,
  30: 105, 31: 99, 32: 94, 33: 88, 34: 83, 35: 77, 36: 72,
  37: 66, 38: 61, 39: 55, 40: 50, 41: 39, 42: 28, 43: 17,
  44: 6, 45: 0,
};

const AGE_POINTS_MARRIED: Record<number, number> = {
  17: 0, 18: 90, 19: 95, 20: 100, 21: 100, 22: 100, 23: 100,
  24: 100, 25: 100, 26: 100, 27: 100, 28: 100, 29: 100,
  30: 95, 31: 90, 32: 85, 33: 80, 34: 75, 35: 70, 36: 65,
  37: 60, 38: 55, 39: 50, 40: 45, 41: 35, 42: 25, 43: 15,
  44: 5, 45: 0,
};

const EDUCATION_POINTS_SINGLE: Record<string, number> = {
  high_school: 30,
  one_year_diploma: 90,
  two_year_diploma: 98,
  bachelors: 120,
  two_or_more_credentials: 128,
  masters: 135,
  phd: 150,
};

const EDUCATION_POINTS_MARRIED: Record<string, number> = {
  high_school: 28,
  one_year_diploma: 84,
  two_year_diploma: 91,
  bachelors: 112,
  two_or_more_credentials: 119,
  masters: 126,
  phd: 140,
};

export function ieltsToClb(band: number): number {
  if (band >= 8.5) return 12;
  if (band >= 8.0) return 11;
  if (band >= 7.5) return 10;
  if (band >= 7.0) return 9;
  if (band >= 6.5) return 8;
  if (band >= 6.0) return 7;
  if (band >= 5.5) return 6;
  if (band >= 5.0) return 5;
  if (band >= 4.0) return 4;
  return 3;
}

function clbToPoints(clb: number, isMarried: boolean): number {
  if (!isMarried) {
    if (clb >= 10) return 34;
    if (clb === 9) return 31;
    if (clb === 8) return 23;
    if (clb === 7) return 17;
    if (clb >= 4) return 6;
    return 0;
  }
  if (clb >= 10) return 32;
  if (clb === 9) return 29;
  if (clb === 8) return 22;
  if (clb === 7) return 16;
  if (clb >= 4) return 6;
  return 0;
}

function canadianExpPoints(years: number, isMarried: boolean): number {
  if (!isMarried) {
    if (years >= 5) return 80;
    if (years >= 4) return 72;
    if (years >= 3) return 64;
    if (years >= 2) return 53;
    if (years >= 1) return 40;
    return 0;
  }
  if (years >= 5) return 70;
  if (years >= 4) return 64;
  if (years >= 3) return 56;
  if (years >= 2) return 46;
  if (years >= 1) return 35;
  return 0;
}

function getAgePoints(age: number, isMarried: boolean): number {
  const table = isMarried ? AGE_POINTS_MARRIED : AGE_POINTS_SINGLE;
  const clamped = Math.min(Math.max(age, 17), 45);
  return table[clamped] ?? 0;
}

function getEducationPoints(degree: string, isMarried: boolean): number {
  const table = isMarried ? EDUCATION_POINTS_MARRIED : EDUCATION_POINTS_SINGLE;
  return table[degree] ?? 0;
}

function getLanguagePoints(scores: { reading: number; writing: number; listening: number; speaking: number }, isMarried: boolean): number {
  return clbToPoints(scores.reading, isMarried)
    + clbToPoints(scores.writing, isMarried)
    + clbToPoints(scores.listening, isMarried)
    + clbToPoints(scores.speaking, isMarried);
}

function getMinClb(scores: { reading: number; writing: number; listening: number; speaking: number }): number {
  return Math.min(scores.reading, scores.writing, scores.listening, scores.speaking);
}

export function calculateCRS(profile: ApplicantProfile): CRSBreakdown {
  const isMarried = profile.personal.marital_status !== 'single';

  const agePoints = getAgePoints(profile.personal.age, isMarried);
  const eduPoints = getEducationPoints(profile.education.highest_degree, isMarried);

  let firstLangPoints = 0;
  if (profile.language.english) {
    firstLangPoints = getLanguagePoints(profile.language.english, isMarried);
  }

  let secondLangPoints = 0;
  if (profile.language.french) {
    const minClb = getMinClb(profile.language.french);
    if (minClb >= 7) secondLangPoints = 24;
    else if (minClb >= 5) secondLangPoints = 4 * Math.min(minClb - 4, 2);
  }

  const canExpPoints = canadianExpPoints(profile.work_experience.total_years_canadian, isMarried);

  const coreTotal = agePoints + eduPoints + firstLangPoints + secondLangPoints + canExpPoints;

  const spouseFactors = 0;

  let skillTransfer = 0;
  if (profile.language.english) {
    const minClb = getMinClb(profile.language.english);
    const highEdu = ['masters', 'phd'].includes(profile.education.highest_degree);
    const midEdu = ['bachelors', 'two_or_more_credentials', 'masters', 'phd'].includes(profile.education.highest_degree);

    if (minClb >= 9 && highEdu) skillTransfer += 50;
    else if (minClb >= 7 && midEdu) skillTransfer += 25;

    if (profile.work_experience.total_years_foreign >= 3) {
      if (minClb >= 9) skillTransfer += 50;
      else if (minClb >= 7) skillTransfer += 25;
    }
  }
  skillTransfer = Math.min(skillTransfer, 100);

  let additional = 0;
  if (profile.canadian_ties.provincial_nomination) additional += 600;
  if (profile.canadian_ties.has_job_offer && profile.canadian_ties.has_lmia) {
    additional += profile.work_experience.teer_category === 0 ? 200 : 50;
  }
  if (profile.canadian_ties.relatives_in_canada) additional += 15;
  if (profile.education.has_canadian_credential) additional += 30;

  let frenchBonus = 0;
  if (profile.language.french) {
    const minFre = getMinClb(profile.language.french);
    if (profile.language.english) {
      const minEng = getMinClb(profile.language.english);
      if (minFre >= 7 && minEng >= 5) {
        frenchBonus = 50;
      } else if (minFre >= 7) {
        frenchBonus = 25;
      }
    }
    additional += frenchBonus;
  }

  const total = Math.min(coreTotal + spouseFactors + skillTransfer + additional, 1200);

  return {
    core_human_capital: coreTotal,
    spouse_factors: spouseFactors,
    skill_transferability: skillTransfer,
    additional_points: additional,
    total,
    details: {
      age: agePoints,
      education: eduPoints,
      first_language: firstLangPoints,
      second_language: secondLangPoints,
      canadian_experience: canExpPoints,
      foreign_experience_transfer: Math.min(skillTransfer, 50),
      education_language_transfer: Math.min(skillTransfer, 50),
      canadian_education_transfer: profile.education.has_canadian_credential ? 30 : 0,
      job_offer: profile.canadian_ties.has_job_offer && profile.canadian_ties.has_lmia
        ? (profile.work_experience.teer_category === 0 ? 200 : 50) : 0,
      provincial_nomination: profile.canadian_ties.provincial_nomination ? 600 : 0,
      sibling_in_canada: profile.canadian_ties.relatives_in_canada ? 15 : 0,
      french_bonus: frenchBonus,
    },
  };
}
