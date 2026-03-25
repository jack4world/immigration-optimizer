import type { ApplicantProfile, ImmigrationProgram, EligibilityResult } from '../data/schemas.js';

const DEGREE_RANK: Record<string, number> = {
  high_school: 1,
  one_year_diploma: 2,
  two_year_diploma: 3,
  bachelors: 4,
  two_or_more_credentials: 5,
  masters: 6,
  phd: 7,
};

function getMinClb(scores: { reading: number; writing: number; listening: number; speaking: number }): number {
  return Math.min(scores.reading, scores.writing, scores.listening, scores.speaking);
}

export function checkEligibility(
  profile: ApplicantProfile,
  program: ImmigrationProgram,
): EligibilityResult {
  const met: string[] = [];
  const unmet: string[] = [];
  const close: string[] = [];
  const req = program.eligibility;

  const eng = profile.language.english;
  if (eng) {
    const minClb = getMinClb(eng);
    if (minClb >= req.min_clb) {
      met.push(`CLB ${minClb} >= 要求 ${req.min_clb}`);
    } else if (minClb >= req.min_clb - 1) {
      close.push(`CLB ${minClb} 接近要求 ${req.min_clb}（差1级）`);
    } else {
      unmet.push(`CLB ${minClb} < 要求 ${req.min_clb}`);
    }
  } else if (req.min_clb > 0) {
    unmet.push(`无语言成绩，要求 CLB ${req.min_clb}`);
  }

  const profileRank = DEGREE_RANK[profile.education.highest_degree] ?? 0;
  const reqRank = DEGREE_RANK[req.min_education] ?? 0;
  if (profileRank >= reqRank) {
    met.push(`学历 ${profile.education.highest_degree} 满足要求`);
  } else {
    unmet.push(`学历 ${profile.education.highest_degree} < 要求 ${req.min_education}`);
  }

  if (profile.work_experience.total_years_foreign >= req.min_work_years_foreign) {
    met.push(`海外工作${profile.work_experience.total_years_foreign}年 >= 要求${req.min_work_years_foreign}年`);
  } else {
    unmet.push(`海外工作${profile.work_experience.total_years_foreign}年 < 要求${req.min_work_years_foreign}年`);
  }

  if (req.min_work_years_canadian > 0) {
    if (profile.work_experience.total_years_canadian >= req.min_work_years_canadian) {
      met.push(`加拿大工作${profile.work_experience.total_years_canadian}年 >= 要求`);
    } else {
      unmet.push(`加拿大工作${profile.work_experience.total_years_canadian}年 < 要求${req.min_work_years_canadian}年`);
    }
  }

  if (req.eligible_noc_codes) {
    if (req.eligible_noc_codes.includes(profile.work_experience.noc_code)) {
      met.push(`NOC ${profile.work_experience.noc_code} 合格`);
    } else {
      unmet.push(`NOC ${profile.work_experience.noc_code} 不在项目合格列表中`);
    }
  }

  if (req.requires_job_offer && !profile.canadian_ties.has_job_offer) {
    unmet.push(`需要加拿大雇主offer，目前无`);
  }

  if (req.requires_lmia && !profile.canadian_ties.has_lmia) {
    unmet.push(`需要LMIA，目前无`);
  }

  if (req.requires_provincial_nomination && !profile.canadian_ties.provincial_nomination) {
    unmet.push(`需要省提名，目前无`);
  }

  if (profile.finances.settlement_funds_cad < req.min_settlement_funds) {
    unmet.push(`安家资金 $${profile.finances.settlement_funds_cad} < 要求 $${req.min_settlement_funds}`);
  } else {
    met.push(`安家资金充足`);
  }

  if (req.age_range) {
    if (profile.personal.age < req.age_range.min || profile.personal.age > req.age_range.max) {
      unmet.push(`年龄 ${profile.personal.age} 不在要求范围 ${req.age_range.min}-${req.age_range.max}`);
    } else {
      met.push(`年龄 ${profile.personal.age} 在要求范围内`);
    }
  }

  const total = met.length + unmet.length + close.length;
  const eligible = unmet.length === 0;
  const score = total > 0 ? Math.round((met.length / total) * 100) : 0;

  return { eligible, met, unmet, close, score };
}
