// ==================== Applicant Profile ====================

export type DegreeLevel =
  | 'high_school'
  | 'one_year_diploma'
  | 'two_year_diploma'
  | 'bachelors'
  | 'two_or_more_credentials'
  | 'masters'
  | 'phd';

export interface CLBScores {
  reading: number;
  writing: number;
  listening: number;
  speaking: number;
}

export interface WorkExperience {
  title: string;
  noc_code: string;
  employer: string;
  country: string;
  years: number;
  is_current: boolean;
  description: string;
}

export interface JobOffer {
  employer: string;
  position: string;
  noc_code: string;
  province: string;
  lmia_status: 'approved' | 'pending' | 'exempt' | 'none';
  salary_cad: number;
}

export interface ECAResult {
  agency: string;
  canadian_equivalent: DegreeLevel;
  date_issued: string;
  expiry_date: string;
}

export interface ApplicantProfile {
  personal: {
    name: string;
    nationality: string;
    age: number;
    date_of_birth: string;
    marital_status: 'single' | 'married' | 'common_law';
    has_children: boolean;
    children_count?: number;
    children_ages?: number[];
  };
  education: {
    highest_degree: DegreeLevel;
    field_of_study: string;
    institution: string;
    country: string;
    year_completed: number;
    has_canadian_credential: boolean;
    eca_completed: boolean;
    eca_result?: ECAResult;
  };
  language: {
    primary_test: 'IELTS' | 'CELPIP' | 'TEF' | 'TCF' | 'none';
    english: CLBScores | null;
    french: CLBScores | null;
    test_date?: string;
    test_expiry?: string;
  };
  work_experience: {
    canadian: WorkExperience[];
    foreign: WorkExperience[];
    total_years_canadian: number;
    total_years_foreign: number;
    current_occupation: string;
    noc_code: string;
    teer_category: 0 | 1 | 2 | 3 | 4 | 5;
  };
  finances: {
    settlement_funds_cad: number;
    proof_of_funds_available: boolean;
    net_worth_cad?: number;
    willing_to_invest: boolean;
    max_investment_cad?: number;
  };
  canadian_ties: {
    has_job_offer: boolean;
    job_offer_details?: JobOffer;
    has_lmia: boolean;
    provincial_nomination?: string;
    relatives_in_canada: boolean;
    relative_relationship?: string;
    previous_study_in_canada: boolean;
    previous_work_in_canada: boolean;
    previous_visit_to_canada: boolean;
  };
  preferences: {
    target_provinces: string[];
    preferred_city_size: 'metro' | 'medium' | 'small' | 'any';
    industry_preference: string[];
    timeline_urgency: 'asap' | 'within_1_year' | 'within_2_years' | 'flexible';
    risk_tolerance: 'low' | 'medium' | 'high';
    willing_to_study: boolean;
    willing_to_relocate_province: boolean;
    priority_order: string[];
    anti_patterns: string[];
  };
}

// ==================== CRS ====================

export interface CRSBreakdown {
  core_human_capital: number;
  spouse_factors: number;
  skill_transferability: number;
  additional_points: number;
  total: number;
  details: {
    age: number;
    education: number;
    first_language: number;
    second_language: number;
    canadian_experience: number;
    foreign_experience_transfer: number;
    education_language_transfer: number;
    canadian_education_transfer: number;
    job_offer: number;
    provincial_nomination: number;
    sibling_in_canada: number;
    french_bonus: number;
  };
}

// ==================== Immigration Programs ====================

export type ProgramCategory =
  | 'express_entry'
  | 'pnp'
  | 'quebec'
  | 'atlantic'
  | 'rural_northern'
  | 'startup_visa'
  | 'self_employed'
  | 'caregiver'
  | 'study_pathway'
  | 'work_permit'
  | 'other';

export interface ImmigrationProgram {
  id: string;
  name: string;
  name_zh: string;
  category: ProgramCategory;
  stream?: string;
  province?: string;
  description: string;
  description_zh: string;
  eligibility: {
    min_clb: number;
    min_education: DegreeLevel;
    min_work_years_canadian: number;
    min_work_years_foreign: number;
    min_noc_teer: number;
    eligible_noc_codes?: string[];
    min_settlement_funds: number;
    requires_job_offer: boolean;
    requires_lmia: boolean;
    requires_provincial_nomination: boolean;
    age_range?: { min: number; max: number };
    additional_requirements: string[];
  };
  processing: {
    typical_processing_months: { min: number; max: number };
    application_fee_cad: number;
    additional_costs: Array<{ item: string; cost_cad: number }>;
    total_estimated_cost_cad: number;
  };
  metrics: {
    success_rate_estimate: number;
    historical_cutoff_crs?: number;
    annual_quota?: number;
    competition_level: 'low' | 'medium' | 'high' | 'very_high';
    draw_frequency?: string;
  };
  source: 'ircc_official' | 'provincial_official' | 'web_research' | 'llm_knowledge';
  last_verified: string;
  url?: string;
}

export type ProgramsDB = Record<string, ImmigrationProgram>;

// ==================== Pathway ====================

export type StepCategory =
  | 'language_test'
  | 'credential_assessment'
  | 'education'
  | 'work_permit'
  | 'job_search'
  | 'provincial_nomination'
  | 'express_entry_profile'
  | 'application_submission'
  | 'medical_exam'
  | 'biometrics'
  | 'background_check'
  | 'landing'
  | 'other';

export interface PathwayStep {
  order: number;
  action: string;
  action_zh: string;
  program_id?: string;
  category: StepCategory;
  duration_months: { min: number; max: number };
  cost_cad: number;
  prerequisites: string[];
  success_probability: number;
  notes: string;
  is_critical_path: boolean;
  parallel_with?: number[];
}

// ==================== Scoring ====================

export interface SubDimension {
  description: string;
  anchors: Record<number, string>;
}

export interface Dimension {
  weight: number;
  description?: string;
  sub_dimensions: Record<string, SubDimension>;
}

export interface PenaltyRule {
  rule: string;
  penalty: number;
}

export interface RewardRule {
  rule: string;
  reward: number;
}

export interface Rubrics {
  dimensions: Record<string, Dimension>;
  adversarial_penalties: Record<string, PenaltyRule[]> & {
    max_penalty_per_dimension?: number;
  };
  rewards?: Record<string, RewardRule[]> & {
    max_reward_per_dimension?: number;
  };
}

export interface SubDimensionScore {
  score: number;
  note: string;
}

export interface DimensionResult {
  score: number;
  weight: number;
  sub_dimensions: Record<string, SubDimensionScore>;
  penalty?: number;
  reward?: number;
  score_before_adjustment?: number;
  holistic_adjustment?: number;
  holistic_reason?: string;
}

export interface Penalty {
  category: string;
  step: number;
  issue: string;
  penalty: number;
}

export interface Reward {
  category: string;
  step: number;
  reason: string;
  reward: number;
}

export interface Adjustment {
  dimension: string;
  adjustment: number;
  reason: string;
}

export interface AbsoluteScoreResult {
  mode: 'absolute';
  composite_score: number;
  components: Record<string, DimensionResult>;
  penalties: Penalty[];
  rewards: Reward[];
  holistic_adjustments: Adjustment[];
  crs_estimate?: CRSBreakdown;
  scored_at: string;
  model: string;
}

export interface ComparativeScoreResult {
  mode: 'comparative';
  verdict: 'better' | 'worse' | 'neutral';
  composite_delta: number;
  sub_dimension_deltas: Record<string, number>;
  dimension_deltas: Record<string, { delta: number; weight: number; affected_subs: Record<string, number> }>;
  mutation: string;
  scored_at: string;
  model: string;
}

// ==================== Mutations ====================

export type MutationType =
  | 'SWAP_PROGRAM'
  | 'ADD_CREDENTIAL'
  | 'REORDER_STEPS'
  | 'ADD_PARALLEL'
  | 'SWITCH_PROVINCE'
  | 'RESEARCH';

export interface MutationResult {
  type: MutationType;
  description: string;
  description_zh: string;
  newPathwayContent: string;
  new_programs?: ImmigrationProgram[];
  rationale: string;
}

export interface IterationLog {
  iteration: number;
  commit: string;
  score_before: number;
  score_after: number;
  delta: number;
  status: 'keep' | 'discard';
  mutation_type: MutationType;
  description: string;
}

// ==================== Eligibility ====================

export interface EligibilityResult {
  eligible: boolean;
  met: string[];
  unmet: string[];
  close: string[];
  score: number;
}
