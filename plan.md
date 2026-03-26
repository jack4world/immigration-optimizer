# 加拿大移民路径优化器 — 实现计划

## 项目名称: `immigration-optimizer`

## 概述

将 `trip-optimizer` 的自研究（autoresearch）架构——迭代变异、对抗性评分、git 回退锁定——改造为针对外国人的**加拿大个性化移民路径优化系统**。

核心类比：

| trip-optimizer | immigration-optimizer |
|---|---|
| 旅行计划 (plan.md) | 移民路径计划 (pathway.md) |
| 城市/活动 | 移民项目/步骤 |
| 评分维度 (体验、物流、美食) | 评分维度 (成功率、时间线、成本、生活质量) |
| 变异类型 (SWAP, UPGRADE, REORDER) | 变异类型 (SWAP_PROGRAM, ADD_CREDENTIAL, REORDER_STEPS) |
| activities_db.json | programs_db.json (移民项目数据库) |
| constraints.yaml (日期、预算、偏好) | profile.yaml (年龄、学历、工作、语言、资金) |
| rubrics.yaml | rubrics.yaml (移民特定评分标准) |
| 旅行研究 | 移民项目研究 + CRS分数计算 |

---

## 一、数据模型

### 1.1 核心接口 (`src/data/schemas.ts`)

```typescript
// ==================== 申请人档案 ====================

export interface ApplicantProfile {
  // 个人信息
  personal: {
    name: string;
    nationality: string;
    age: number;
    date_of_birth: string;           // YYYY-MM-DD
    marital_status: 'single' | 'married' | 'common_law';
    has_children: boolean;
    children_count?: number;
    children_ages?: number[];
  };

  // 教育背景
  education: {
    highest_degree: DegreeLevel;
    field_of_study: string;
    institution: string;
    country: string;
    year_completed: number;
    has_canadian_credential?: boolean;
    eca_completed: boolean;           // Educational Credential Assessment
    eca_result?: ECAResult;
  };

  // 语言能力
  language: {
    primary_test: 'IELTS' | 'CELPIP' | 'TEF' | 'TCF' | 'none';
    english: CLBScores | null;
    french: CLBScores | null;
    test_date?: string;
    test_expiry?: string;
  };

  // 工作经验
  work_experience: {
    canadian: WorkExperience[];
    foreign: WorkExperience[];
    total_years_canadian: number;
    total_years_foreign: number;
    current_occupation: string;
    noc_code: string;                 // NOC 2021 TEER category
    teer_category: 0 | 1 | 2 | 3 | 4 | 5;
  };

  // 财务状况
  finances: {
    settlement_funds_cad: number;
    proof_of_funds_available: boolean;
    net_worth_cad?: number;
    willing_to_invest?: boolean;
    max_investment_cad?: number;
  };

  // 加拿大联系
  canadian_ties: {
    has_job_offer: boolean;
    job_offer_details?: JobOffer;
    has_lmia?: boolean;
    provincial_nomination?: string;   // 省份
    relatives_in_canada: boolean;
    relative_relationship?: string;
    previous_study_in_canada: boolean;
    previous_work_in_canada: boolean;
    previous_visit_to_canada: boolean;
  };

  // 偏好与约束
  preferences: {
    target_provinces: string[];       // 优先省份
    preferred_city_size: 'metro' | 'medium' | 'small' | 'any';
    industry_preference: string[];
    timeline_urgency: 'asap' | 'within_1_year' | 'within_2_years' | 'flexible';
    risk_tolerance: 'low' | 'medium' | 'high'; // 接受不确定性程度
    willing_to_study: boolean;
    willing_to_relocate_province: boolean;
    priority_order: string[];         // ['speed', 'cost', 'certainty', 'quality_of_life']
    anti_patterns: string[];          // 不愿做的事
  };
}

export type DegreeLevel =
  | 'high_school'
  | 'one_year_diploma'
  | 'two_year_diploma'
  | 'bachelors'
  | 'two_or_more_credentials'
  | 'masters'
  | 'phd';

export interface CLBScores {
  reading: number;    // CLB 1-12
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
  agency: string;               // WES, IQAS, etc.
  canadian_equivalent: DegreeLevel;
  date_issued: string;
  expiry_date: string;
}

// ==================== CRS 分数计算 ====================

export interface CRSBreakdown {
  core_human_capital: number;       // max 500 (single) / 460 (married)
  spouse_factors: number;           // max 40
  skill_transferability: number;    // max 100
  additional_points: number;        // max 600
  total: number;                    // max 1200
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

// ==================== 移民项目数据库 ====================

export interface ImmigrationProgram {
  id: string;                         // e.g., 'express_entry_fswp'
  name: string;
  name_zh: string;
  category: ProgramCategory;
  stream?: string;                    // e.g., 'Human Capital Priorities'
  province?: string;                  // null = federal
  description: string;
  description_zh: string;

  // 资格要求
  eligibility: {
    min_clb: number;
    min_education: DegreeLevel;
    min_work_years_canadian: number;
    min_work_years_foreign: number;
    min_noc_teer: number;
    eligible_noc_codes?: string[];    // null = all
    min_settlement_funds: number;
    requires_job_offer: boolean;
    requires_lmia: boolean;
    requires_provincial_nomination: boolean;
    age_range?: { min: number; max: number };
    additional_requirements: string[];
  };

  // 时间与成本
  processing: {
    typical_processing_months: { min: number; max: number };
    application_fee_cad: number;
    additional_costs: { item: string; cost_cad: number }[];
    total_estimated_cost_cad: number;
  };

  // 评估参数
  metrics: {
    success_rate_estimate: number;    // 0-100
    historical_cutoff_crs?: number;   // 最近邀请分数线
    annual_quota?: number;
    competition_level: 'low' | 'medium' | 'high' | 'very_high';
    draw_frequency?: string;          // e.g., 'bi-weekly', 'monthly'
  };

  // 元数据
  source: 'ircc_official' | 'provincial_official' | 'web_research' | 'llm_knowledge';
  last_verified: string;
  url?: string;
}

export type ProgramCategory =
  | 'express_entry'        // EE: FSWP, FSTP, CEC
  | 'pnp'                 // 省提名
  | 'quebec'              // 魁北克
  | 'atlantic'            // 大西洋移民
  | 'rural_northern'      // 农村和北部移民
  | 'startup_visa'        // 创业签证
  | 'self_employed'       // 自雇
  | 'caregiver'           // 护理
  | 'study_pathway'       // 留学转移民
  | 'work_permit'         // 工签 (过渡步骤)
  | 'other';

// ==================== 移民路径 ====================

export interface PathwayStep {
  order: number;
  action: string;                     // 具体行动
  action_zh: string;
  program_id?: string;                // 关联项目
  category: StepCategory;
  duration_months: { min: number; max: number };
  cost_cad: number;
  prerequisites: string[];            // 前置步骤 ID
  success_probability: number;        // 0-1
  notes: string;
  is_critical_path: boolean;          // 是否在关键路径上
  parallel_with?: number[];           // 可并行的步骤 order
}

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

// ==================== 评分 ====================

export interface PathwayScore {
  mode: 'absolute' | 'comparative';
  composite_score: number;            // 0-100
  components: Record<string, DimensionResult>;
  penalties: Penalty[];
  holistic_adjustments: Adjustment[];
  crs_estimate: CRSBreakdown;
  scored_at: string;
  model: string;
}

export interface DimensionResult {
  score: number;
  weight: number;
  sub_dimensions: Record<string, { score: number; note: string }>;
}

export interface Penalty {
  category: string;
  step: number;
  issue: string;
  penalty: number;
}

export interface Adjustment {
  dimension: string;
  adjustment: number;
  reason: string;
}

// ==================== 变异 ====================

export type MutationType =
  | 'SWAP_PROGRAM'        // 换一个更适合的移民项目
  | 'ADD_CREDENTIAL'      // 增加一个证书/语言考试来提分
  | 'REORDER_STEPS'       // 重排步骤以缩短关键路径
  | 'ADD_PARALLEL'        // 将串行步骤改为并行
  | 'SWITCH_PROVINCE'     // 换目标省份 (PNP)
  | 'RESEARCH';           // 研究新项目加入数据库

export interface MutationResult {
  type: MutationType;
  description: string;
  description_zh: string;
  new_pathway: string;                // 完整 pathway.md 内容
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
```

### 1.2 约束文件 (`profile.yaml`)

替代 trip-optimizer 的 `constraints.yaml`。由 `init` 命令的问卷生成。

```yaml
applicant:
  name: "张三"
  nationality: "Chinese"
  age: 32
  date_of_birth: "1994-05-15"
  marital_status: married

education:
  highest_degree: masters
  field_of_study: "Computer Science"
  institution: "Tsinghua University"
  country: "China"
  year_completed: 2019
  eca_completed: true
  eca_result:
    agency: "WES"
    canadian_equivalent: masters
    expiry_date: "2028-01-15"

language:
  english:
    test: IELTS
    reading: 8.0     # CLB 9
    writing: 7.0     # CLB 8
    listening: 8.5   # CLB 10
    speaking: 7.0    # CLB 8
  french: null

work_experience:
  current_occupation: "Software Engineer"
  noc_code: "21232"
  teer_category: 0
  canadian_years: 0
  foreign_years: 6

finances:
  settlement_funds_cad: 35000
  willing_to_invest: false

canadian_ties:
  has_job_offer: false
  relatives_in_canada: false
  previous_study: false
  previous_work: false

preferences:
  target_provinces: ["Ontario", "British Columbia"]
  timeline_urgency: within_1_year
  risk_tolerance: medium
  willing_to_study: false
  willing_to_relocate_province: true
  priority_order: [certainty, speed, cost, quality_of_life]
  anti_patterns:
    - "不愿读两年以上的学位"
    - "不想去偏远农村地区"
```

### 1.3 评分标准 (`rubrics.yaml`)

```yaml
dimensions:
  success_probability:
    weight: 0.30
    description: "路径最终获得PR的综合成功率"
    sub_dimensions:
      crs_competitiveness:
        description: "CRS分数相对于历史邀请分数线的竞争力"
        anchors:
          60: "CRS低于最近6个月平均分数线20分以上"
          80: "CRS与最近平均分数线持平或高出10分"
          90: "CRS高出最近平均分数线30分以上"
      program_eligibility:
        description: "是否完全满足目标项目的所有资格要求"
        anchors:
          60: "缺少1-2项关键要求，需要额外步骤补足"
          80: "满足所有要求，但在某些方面接近最低线"
          90: "各项指标远超最低要求"
      historical_approval:
        description: "目标项目的历史批准率和配额情况"
        anchors:
          60: "项目竞争极为激烈，年配额常年用尽"
          80: "项目竞争适中，配额充足"
          90: "项目竞争较低，批准率高"

  timeline_efficiency:
    weight: 0.25
    description: "从现在到获得PR的总时间效率"
    sub_dimensions:
      total_duration:
        description: "预计总耗时（含准备+申请+审批）"
        anchors:
          60: "总耗时超过3年"
          80: "总耗时1.5-2年"
          90: "总耗时1年以内"
      critical_path:
        description: "关键路径上是否有不必要的串行等待"
        anchors:
          60: "多个步骤可以并行但被安排成串行"
          80: "大部分可并行步骤已并行"
          90: "关键路径完全优化，无浪费等待"
      processing_predictability:
        description: "各步骤处理时间的可预测性"
        anchors:
          60: "依赖处理时间波动大的项目"
          80: "大部分步骤有明确的处理时间承诺"
          90: "所有步骤有SLA或明确时间线"

  cost_efficiency:
    weight: 0.15
    description: "路径总成本相对于效果的性价比"
    sub_dimensions:
      total_cost:
        description: "申请费+考试费+中介费+生活成本等总费用"
        anchors:
          60: "总费用超过$50,000 CAD"
          80: "总费用在$15,000-30,000 CAD之间"
          90: "总费用低于$15,000 CAD"
      cost_risk_ratio:
        description: "在成功率不确定时投入的资金风险"
        anchors:
          60: "大量前期投入，但成功率不到60%"
          80: "投入合理，成功率>75%"
          90: "低前期投入，或高确定性项目"

  quality_of_life:
    weight: 0.15
    description: "路径执行期间和定居后的生活质量"
    sub_dimensions:
      destination_match:
        description: "最终定居地与申请人偏好的匹配度"
        anchors:
          60: "目标省份/城市不在偏好列表中"
          80: "目标在偏好列表，但非首选"
          90: "完全匹配首选省份和城市规模"
      career_continuity:
        description: "移民过程中职业发展的连续性"
        anchors:
          60: "需要长期中断工作或大幅降级"
          80: "短期过渡期后可恢复同级别工作"
          90: "全程可在本专业领域工作"

  plan_robustness:
    weight: 0.15
    description: "路径对政策变化和不确定性的韧性"
    sub_dimensions:
      backup_options:
        description: "如果主路径受阻是否有备选方案"
        anchors:
          60: "单一路径，无任何备选"
          80: "有1个可行备选方案"
          90: "有2+个备选方案，且切换成本低"
      policy_sensitivity:
        description: "路径对政策变动的敏感度"
        anchors:
          60: "严重依赖特定政策（可能变动的试点项目等）"
          80: "依赖成熟稳定的移民项目"
          90: "基于多年不变的核心项目，抗政策风险"

adversarial_penalties:
  eligibility:
    - rule: "路径包含申请人不满足资格要求的项目"
      penalty: -15
    - rule: "CLB分数不满足目标项目最低要求"
      penalty: -20
    - rule: "工作经验年限不满足目标项目要求"
      penalty: -15
  timeline:
    - rule: "步骤之间有逻辑依赖但未按正确顺序排列"
      penalty: -10
    - rule: "证件/考试成绩在申请时已过期"
      penalty: -20
    - rule: "可并行的步骤被安排成串行且无理由"
      penalty: -5
  cost:
    - rule: "遗漏必要费用（如体检、生物采集）"
      penalty: -5
    - rule: "费用估算与官方数据偏差>30%"
      penalty: -8
  feasibility:
    - rule: "路径依赖不存在或已关闭的移民项目"
      penalty: -25
    - rule: "假设获得省提名但未说明具体途径"
      penalty: -10
    - rule: "路径与申请人明确的 anti_patterns 冲突"
      penalty: -15
  max_penalty_per_dimension: -25
```

---

## 二、CRS 分数计算引擎

这是本系统特有的确定性模块，不依赖 LLM。

### 2.1 CRS 计算器 (`src/crs/calculator.ts`)

```typescript
import { ApplicantProfile, CRSBreakdown, CLBScores } from '../data/schemas';

// ===== 年龄分数表 (单身) =====
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

// ===== 教育分数表 =====
const EDUCATION_POINTS_SINGLE: Record<string, number> = {
  'high_school': 30,
  'one_year_diploma': 90,
  'two_year_diploma': 98,
  'bachelors': 120,
  'two_or_more_credentials': 128,
  'masters': 135,
  'phd': 150,
};

const EDUCATION_POINTS_MARRIED: Record<string, number> = {
  'high_school': 28,
  'one_year_diploma': 84,
  'two_year_diploma': 91,
  'bachelors': 112,
  'two_or_more_credentials': 119,
  'masters': 126,
  'phd': 140,
};

// ===== IELTS → CLB 转换 =====
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

// ===== CLB → 语言分数 =====
function clbToPoints(clb: number, isMarried: boolean): number {
  if (!isMarried) {
    if (clb >= 10) return 34;
    if (clb === 9) return 31;
    if (clb === 8) return 23;
    if (clb === 7) return 17;
    if (clb >= 4) return 6;
    return 0;
  } else {
    if (clb >= 10) return 32;
    if (clb === 9) return 29;
    if (clb === 8) return 22;
    if (clb === 7) return 16;
    if (clb >= 4) return 6;
    return 0;
  }
}

// ===== 加拿大工作经验分数 =====
function canadianExpPoints(years: number, isMarried: boolean): number {
  if (!isMarried) {
    if (years >= 5) return 80;
    if (years >= 4) return 72;
    if (years >= 3) return 64;
    if (years >= 2) return 53;
    if (years >= 1) return 40;
    return 0;
  } else {
    if (years >= 5) return 70;
    if (years >= 4) return 64;
    if (years >= 3) return 56;
    if (years >= 2) return 46;
    if (years >= 1) return 35;
    return 0;
  }
}

// ===== 主计算函数 =====
export function calculateCRS(profile: ApplicantProfile): CRSBreakdown {
  const isMarried = profile.personal.marital_status !== 'single';
  const age = profile.personal.age;

  // 1. Core / Human Capital
  const ageTable = isMarried ? AGE_POINTS_MARRIED : AGE_POINTS_SINGLE;
  const agePoints = ageTable[Math.min(Math.max(age, 17), 45)] ?? 0;

  const eduTable = isMarried ? EDUCATION_POINTS_MARRIED : EDUCATION_POINTS_SINGLE;
  const eduPoints = eduTable[profile.education.highest_degree] ?? 0;

  // 语言 (4个子项各自查分)
  const eng = profile.language.english;
  let firstLangPoints = 0;
  if (eng) {
    firstLangPoints =
      clbToPoints(eng.reading, isMarried) +
      clbToPoints(eng.writing, isMarried) +
      clbToPoints(eng.listening, isMarried) +
      clbToPoints(eng.speaking, isMarried);
  }

  const fre = profile.language.french;
  let secondLangPoints = 0;
  if (fre) {
    // 第二官方语言加分简化
    const minClb = Math.min(fre.reading, fre.writing, fre.listening, fre.speaking);
    if (minClb >= 7) secondLangPoints = 24;
    else if (minClb >= 5) secondLangPoints = 4 * Math.min(minClb - 4, 2);
  }

  const canExpPoints = canadianExpPoints(
    profile.work_experience.total_years_canadian, isMarried
  );

  const coreTotal = agePoints + eduPoints + firstLangPoints + secondLangPoints + canExpPoints;

  // 2. Spouse factors (简化 — 如已婚但配偶信息未提供则为0)
  const spouseFactors = 0; // TODO: 实际实现需要配偶资料

  // 3. Skill Transferability (max 100)
  let skillTransfer = 0;
  // 教育+语言交叉 (简化计算)
  if (eng) {
    const minClb = Math.min(eng.reading, eng.writing, eng.listening, eng.speaking);
    if (minClb >= 9 && ['masters', 'phd'].includes(profile.education.highest_degree)) {
      skillTransfer += 50;
    } else if (minClb >= 7 && ['bachelors', 'two_or_more_credentials', 'masters', 'phd'].includes(profile.education.highest_degree)) {
      skillTransfer += 25;
    }
  }
  // 外国工作经验+语言交叉
  if (eng && profile.work_experience.total_years_foreign >= 3) {
    const minClb = Math.min(eng.reading, eng.writing, eng.listening, eng.speaking);
    if (minClb >= 9) skillTransfer += 50;
    else if (minClb >= 7) skillTransfer += 25;
  }
  skillTransfer = Math.min(skillTransfer, 100);

  // 4. Additional Points (max 600)
  let additional = 0;
  if (profile.canadian_ties.provincial_nomination) additional += 600;
  if (profile.canadian_ties.has_job_offer && profile.canadian_ties.has_lmia) {
    if (profile.work_experience.teer_category === 0) additional += 200;
    else additional += 50;
  }
  if (profile.canadian_ties.relatives_in_canada) additional += 15;
  if (profile.education.has_canadian_credential) additional += 30;
  // 法语加分
  if (fre) {
    const minFre = Math.min(fre.reading, fre.writing, fre.listening, fre.speaking);
    if (eng) {
      const minEng = Math.min(eng.reading, eng.writing, eng.listening, eng.speaking);
      if (minFre >= 7 && minEng >= 5) additional += 50;
      else if (minFre >= 7) additional += 25;
    }
  }

  const total = coreTotal + spouseFactors + Math.min(skillTransfer, 100) + Math.min(additional, 600);

  return {
    core_human_capital: coreTotal,
    spouse_factors: spouseFactors,
    skill_transferability: skillTransfer,
    additional_points: additional,
    total: Math.min(total, 1200),
    details: {
      age: agePoints,
      education: eduPoints,
      first_language: firstLangPoints,
      second_language: secondLangPoints,
      canadian_experience: canExpPoints,
      foreign_experience_transfer: Math.min(skillTransfer, 50),
      education_language_transfer: Math.min(skillTransfer, 50),
      canadian_education_transfer: profile.education.has_canadian_credential ? 30 : 0,
      job_offer: profile.canadian_ties.has_job_offer ? (profile.work_experience.teer_category === 0 ? 200 : 50) : 0,
      provincial_nomination: profile.canadian_ties.provincial_nomination ? 600 : 0,
      sibling_in_canada: profile.canadian_ties.relatives_in_canada ? 15 : 0,
      french_bonus: secondLangPoints > 0 ? 25 : 0,
    },
  };
}
```

### 2.2 资格筛选器 (`src/crs/eligibility.ts`)

```typescript
import { ApplicantProfile, ImmigrationProgram } from '../data/schemas';

export interface EligibilityResult {
  eligible: boolean;
  met: string[];
  unmet: string[];
  close: string[];        // 接近但不满足的条件
  score: number;          // 0-100 匹配度
}

export function checkEligibility(
  profile: ApplicantProfile,
  program: ImmigrationProgram
): EligibilityResult {
  const met: string[] = [];
  const unmet: string[] = [];
  const close: string[] = [];
  const req = program.eligibility;

  // CLB检查
  const eng = profile.language.english;
  if (eng) {
    const minClb = Math.min(eng.reading, eng.writing, eng.listening, eng.speaking);
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

  // 教育检查
  const degreeRank: Record<string, number> = {
    'high_school': 1, 'one_year_diploma': 2, 'two_year_diploma': 3,
    'bachelors': 4, 'two_or_more_credentials': 5, 'masters': 6, 'phd': 7,
  };
  const profileRank = degreeRank[profile.education.highest_degree] ?? 0;
  const reqRank = degreeRank[req.min_education] ?? 0;
  if (profileRank >= reqRank) {
    met.push(`学历 ${profile.education.highest_degree} 满足要求`);
  } else {
    unmet.push(`学历 ${profile.education.highest_degree} < 要求 ${req.min_education}`);
  }

  // 工作经验检查
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

  // NOC检查
  if (req.eligible_noc_codes && !req.eligible_noc_codes.includes(profile.work_experience.noc_code)) {
    unmet.push(`NOC ${profile.work_experience.noc_code} 不在项目合格列表中`);
  } else {
    met.push(`NOC ${profile.work_experience.noc_code} 合格`);
  }

  // Job offer检查
  if (req.requires_job_offer && !profile.canadian_ties.has_job_offer) {
    unmet.push(`需要加拿大雇主offer，目前无`);
  }

  // 安家资金检查
  if (profile.finances.settlement_funds_cad < req.min_settlement_funds) {
    unmet.push(`安家资金 $${profile.finances.settlement_funds_cad} < 要求 $${req.min_settlement_funds}`);
  } else {
    met.push(`安家资金充足`);
  }

  const eligible = unmet.length === 0;
  const score = Math.round((met.length / (met.length + unmet.length + close.length)) * 100);

  return { eligible, met, unmet, close, score };
}
```

---

## 三、移民路径计划文件 (`pathway.md`)

替代 trip-optimizer 的 `plan.md`。这是被优化器迭代变异的核心文件。

```markdown
---
applicant: "张三"
target: "Canadian Permanent Residency"
primary_program: "Express Entry - Federal Skilled Worker Program"
crs_estimate: 468
total_duration_months: 14
total_cost_cad: 18500
generated_at: "2026-03-23"
---

## 路径概览

| 步骤 | 行动 | 时间 | 费用(CAD) | 状态 | 并行 |
|------|------|------|-----------|------|------|
| 1 | IELTS考试（目标CLB 10+） | 2026-04 ~ 2026-05 | $350 | 待执行 | — |
| 2 | WES学历认证 | 2026-04 ~ 2026-07 | $450 | 已完成 | 与步骤1并行 |
| 3 | 创建EE profile | 2026-07 | $0 | 待执行 | — |
| 4 | 等待ITA（邀请） | 2026-07 ~ 2026-09 | $0 | 待执行 | — |
| 5 | 提交PR申请 | 2026-09 | $1,365 | 待执行 | — |
| 6 | 体检 + 生物采集 | 2026-09 ~ 2026-10 | $650 | 待执行 | — |
| 7 | 背景调查等待 | 2026-10 ~ 2027-03 | $0 | 待执行 | — |
| 8 | 获得COPR + 登陆 | 2027-04 ~ 2027-06 | $1,200 | 待执行 | — |

**预计总费用:** $18,500 CAD (含考试、认证、申请费、体检、机票)
**预计总时间:** 14个月

---

# 步骤 1: IELTS 考试

## 目标
将CLB分数从当前水平提升至CLB 10（各项），以最大化CRS语言分。

## 当前状态
- Reading: 8.0 (CLB 9) → 目标 8.5+ (CLB 10)
- Writing: 7.0 (CLB 8) → **关键瓶颈** 目标 7.5+ (CLB 9)
- Listening: 8.5 (CLB 10) ✓ 已达标
- Speaking: 7.0 (CLB 8) → 目标 7.5+ (CLB 9)

## CRS 影响
Writing CLB 8→9: +8分; Speaking CLB 8→9: +8分; Reading CLB 9→10: +3分
**潜在提升: +19 CRS分**

## 时间线
- 2026-04-01 ~ 2026-04-30: 备考（重点Writing和Speaking）
- 2026-05-10: 考试日
- 2026-05-24: 出分

## 费用
- 考试费: $350
- 备考材料: $200（可选）

## 风险
- Writing提分难度较大，可能需要二次考试（+$350, +2个月）
- 备选: 同时报名CELPIP作为backup

---

# 步骤 2: WES 学历认证 (ECA)

## 目标
获得WES出具的ECA报告，确认硕士学位的加拿大等效认证。

## 当前状态
已完成 ✓ — WES认证已获得，有效期至2028-01-15。

## 费用
$450（已支出）

---

# 步骤 3: 创建 Express Entry Profile

## 前置条件
- ✓ ECA完成
- ◻ IELTS成绩（步骤1）

## CRS估算
当前: 468分 → 目标: 487分（含语言提升后）

| 项目 | 分数 |
|------|------|
| 年龄 (32) | 94 |
| 学历 (硕士) | 126 |
| 第一语言 (目标CLB 9-10) | 116→124 |
| 加拿大工作经验 (0年) | 0 |
| 技能转移 | 50 |
| 额外加分 | 0 |
| **总计** | **468→487** |

## 近期FSWP抽签分数线
- 2026-03-06: 524 (全类别)
- 2026-02-20: 488 (STEM定向)
- 2026-01-15: 476 (法语能力)

## 策略
487分在STEM定向抽签中有竞争力。如全类别分数线维持>500，
需要考虑PNP加分路线（+600分）。

---

# 步骤 4-8: [后续步骤详情...]

---

## 备选路径

### 备选A: Ontario PNP - Human Capital Priorities
如果EE分数不够全类别邀请，Ontario HCP stream可直接从EE池中
提名CRS 400+的STEM候选人。获得提名后CRS+600，确保下次被邀请。
- 额外时间: +3-6个月
- 额外费用: $1,500 (省提名申请费)

### 备选B: BC PNP - Tech Stream
BC省科技行业快速通道，要求有BC省科技公司Job Offer。
需要先获得工作机会。
- 额外时间: +6-12个月（含找工作时间）
- 额外费用: $1,750 (省提名) + 搬家成本

---

## 关键风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| IELTS未达目标分 | 中 | 延迟2个月 | 同时备考CELPIP |
| 全类别分数线上涨 | 高 | 需要PNP路线 | 提前准备Ontario HCP申请 |
| 处理时间延长 | 低 | 延迟3-6个月 | 提交完整材料减少补件 |
```

---

## 四、变异系统

### 4.1 变异类型定义 (`src/optimizer/mutations.ts`)

```typescript
import { LLMProvider } from '../llm/provider';
import { ApplicantProfile, MutationType, MutationResult, ImmigrationProgram } from '../data/schemas';

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

export async function generateMutation(
  type: MutationType,
  currentPathway: string,
  profile: ApplicantProfile,
  programsDb: Record<string, ImmigrationProgram>,
  rubrics: string,
  llm: LLMProvider,
): Promise<MutationResult> {
  const mutationPrompts: Record<MutationType, string> = {

    SWAP_PROGRAM: `你是加拿大移民路径优化专家。

当前路径:
${currentPathway}

申请人档案:
${JSON.stringify(profile, null, 2)}

可用移民项目数据库:
${JSON.stringify(programsDb, null, 2)}

任务: 找出当前路径中成功率最低或耗时最长的步骤，替换为更适合申请人的移民项目。
考虑:
- CRS分数竞争力
- 项目资格匹配度
- 处理时间
- 历史邀请分数线趋势

返回完整的新 pathway.md 内容。

返回JSON: { "type": "SWAP_PROGRAM", "description": "变更描述", "description_zh": "中文描述", "new_pathway": "完整pathway.md内容", "rationale": "理由" }`,

    ADD_CREDENTIAL: `你是加拿大移民路径优化专家。

当前路径:
${currentPathway}

申请人档案:
${JSON.stringify(profile, null, 2)}

任务: 分析申请人CRS分数的薄弱环节，建议增加一个证书或考试来提升竞争力。
可考虑:
- 重考语言考试提升CLB
- 增加法语考试（TEF/TCF）获得双语加分
- 加拿大教育证书（短期课程获得Canadian credential加分）
- 专业资格认证

评估投入产出比: 时间成本 vs CRS提升分数。

返回JSON: { "type": "ADD_CREDENTIAL", "description": "...", "description_zh": "...", "new_pathway": "...", "rationale": "..." }`,

    REORDER_STEPS: `你是加拿大移民路径优化专家。

当前路径:
${currentPathway}

任务: 检查步骤之间的依赖关系，找到可以提前开始的步骤以缩短关键路径总时间。
考虑:
- 哪些步骤有真实的前置依赖
- 哪些步骤被不必要地安排在其他步骤之后
- 文档准备可以提前多久开始
- 体检和背调的最佳启动时间

返回JSON: { "type": "REORDER_STEPS", "description": "...", "description_zh": "...", "new_pathway": "...", "rationale": "..." }`,

    ADD_PARALLEL: `你是加拿大移民路径优化专家。

当前路径:
${currentPathway}

任务: 找到当前串行但实际上可以并行执行的步骤对。
例如:
- 语言考试备考期间同时申请ECA
- 等待EE邀请期间准备体检预约
- 准备PR材料的同时办理无犯罪证明

标记哪些步骤可并行，更新时间线。

返回JSON: { "type": "ADD_PARALLEL", "description": "...", "description_zh": "...", "new_pathway": "...", "rationale": "..." }`,

    SWITCH_PROVINCE: `你是加拿大移民路径优化专家。

当前路径:
${currentPathway}

申请人档案:
${JSON.stringify(profile, null, 2)}

可用项目数据库:
${JSON.stringify(programsDb, null, 2)}

任务: 评估是否有其他省的PNP项目更适合申请人。考虑:
- 各省对申请人NOC职业的需求度
- 省提名处理时间
- 省提名额外费用
- 定居城市匹配申请人偏好
- 各省最低要求 vs 申请人条件的匹配度

如果当前省策略已是最优，可以建议添加备选省份作为Plan B。

返回JSON: { "type": "SWITCH_PROVINCE", "description": "...", "description_zh": "...", "new_pathway": "...", "rationale": "..." }`,

    RESEARCH: `你是加拿大移民研究专家。

当前路径:
${currentPathway}

申请人档案:
${JSON.stringify(profile, null, 2)}

已有项目数据库:
${JSON.stringify(Object.keys(programsDb))}

任务: 路径优化已陷入瓶颈，需要发现新的移民项目或路线。
研究方向:
1. 联邦新试点项目（最近1年内推出的）
2. 申请人未考虑过的省提名类别
3. 行业特定移民通道
4. 组合策略（如先工签再PR）
5. 国际人才计划

为每个发现的项目提供完整的 ImmigrationProgram 数据结构。

返回JSON: { "type": "RESEARCH", "description": "...", "description_zh": "...", "new_pathway": "...", "new_programs": [...], "rationale": "..." }`,
  };

  const prompt = mutationPrompts[type];
  const response = await llm.complete(prompt, 32000);
  return JSON.parse(extractJson(response));
}
```

### 4.2 优化循环 (`src/optimizer/loop.ts`)

```typescript
import simpleGit from 'simple-git';
import { pickMutationType, generateMutation } from './mutations';
import { Scorer } from '../scoring/scorer';
import { Logger } from './logger';
import { calculateCRS } from '../crs/calculator';
import { LLMProvider } from '../llm/provider';
import { ApplicantProfile, ImmigrationProgram } from '../data/schemas';
import * as fs from 'fs/promises';
import * as path from 'path';

interface LoopOptions {
  pathwayDir: string;
  llm: LLMProvider;
  recalibrationInterval?: number;   // 默认10
}

export async function runOptimizationLoop(options: LoopOptions): Promise<void> {
  const { pathwayDir, llm, recalibrationInterval = 10 } = options;
  const git = simpleGit(pathwayDir);

  // 加载文件
  const profile: ApplicantProfile = JSON.parse(
    await fs.readFile(path.join(pathwayDir, 'profile.yaml'), 'utf-8')
  );
  const rubrics = await fs.readFile(path.join(pathwayDir, 'rubrics.yaml'), 'utf-8');
  const programsDbPath = path.join(pathwayDir, 'programs_db.json');
  let programsDb: Record<string, ImmigrationProgram> = JSON.parse(
    await fs.readFile(programsDbPath, 'utf-8')
  );

  const scorer = new Scorer(llm, rubrics);
  const logger = new Logger(path.join(pathwayDir, 'results.tsv'));

  // CRS基线计算
  const crs = calculateCRS(profile);
  console.log(`CRS估算: ${crs.total}分`);

  // 基线评分或崩溃恢复
  let currentPathway = await fs.readFile(path.join(pathwayDir, 'pathway.md'), 'utf-8');
  let lastLog = logger.getLastEntry();
  let currentScore: number;
  let iteration: number;
  let consecutiveDiscards: number;

  if (lastLog) {
    currentScore = lastLog.status === 'keep' ? lastLog.score_after : lastLog.score_before;
    iteration = lastLog.iteration + 1;
    consecutiveDiscards = logger.getConsecutiveDiscards();
    console.log(`恢复自迭代 ${lastLog.iteration}，当前分数: ${currentScore}`);
  } else {
    console.log('执行基线评分...');
    const baseline = await scorer.scoreAbsolute(currentPathway, profile);
    currentScore = baseline.composite_score;
    iteration = 1;
    consecutiveDiscards = 0;
    const commitHash = (await git.log(['-1'])).latest?.hash?.slice(0, 7) ?? 'initial';
    logger.log({
      iteration: 0, commit: commitHash,
      score_before: 0, score_after: currentScore,
      delta: currentScore, status: 'keep',
      mutation_type: 'RESEARCH' as any, description: 'baseline scored',
    });
    console.log(`基线分数: ${currentScore.toFixed(1)}`);
  }

  // 主循环
  const shutdown = new Promise<void>((resolve) => {
    process.on('SIGINT', () => { console.log('\n优化停止。'); resolve(); });
  });

  const loop = async () => {
    while (true) {
      const mutationType = pickMutationType(iteration, consecutiveDiscards);
      console.log(`\n--- 迭代 ${iteration} [${mutationType}] ---`);

      try {
        // 生成变异
        const mutation = await generateMutation(
          mutationType, currentPathway, profile, programsDb, rubrics, llm
        );
        console.log(`变异: ${mutation.description_zh}`);

        // 写入并提交
        await fs.writeFile(path.join(pathwayDir, 'pathway.md'), mutation.new_pathway);
        if (mutation.new_programs) {
          for (const prog of mutation.new_programs) {
            programsDb[prog.id] = prog;
          }
          await fs.writeFile(programsDbPath, JSON.stringify(programsDb, null, 2));
          await git.add(['programs_db.json']);
        }
        await git.add(['pathway.md']);
        await git.commit(`${mutationType}: ${mutation.description}`);

        // 评分
        const useAbsolute = iteration % recalibrationInterval === 0;
        let newScore: number;
        let verdict: string;

        if (useAbsolute) {
          const result = await scorer.scoreAbsolute(mutation.new_pathway, profile);
          newScore = result.composite_score;
          await fs.writeFile(
            path.join(pathwayDir, 'score.json'),
            JSON.stringify(result, null, 2)
          );
        } else {
          const result = await scorer.scoreComparative(currentPathway, mutation.new_pathway);
          newScore = currentScore + result.composite_delta;
        }

        const delta = newScore - currentScore;
        verdict = delta > 0 ? 'keep' : 'discard';

        // 接受或回退
        const commitHash = (await git.log(['-1'])).latest?.hash?.slice(0, 7) ?? '';
        if (verdict === 'keep') {
          currentScore = newScore;
          currentPathway = mutation.new_pathway;
          consecutiveDiscards = 0;
          console.log(`✓ 保留 (${currentScore.toFixed(1)}, +${delta.toFixed(1)})`);
        } else {
          await git.reset(['--hard', 'HEAD~1']);
          consecutiveDiscards++;
          console.log(`✗ 丢弃 (${newScore.toFixed(1)}, ${delta.toFixed(1)})`);
        }

        logger.log({
          iteration, commit: commitHash,
          score_before: currentScore - (verdict === 'keep' ? delta : 0),
          score_after: newScore, delta, status: verdict as any,
          mutation_type: mutationType, description: mutation.description,
        });

        iteration++;
      } catch (err) {
        console.error(`迭代 ${iteration} 错误:`, err);
        // 安全回退
        try { await git.reset(['--hard', 'HEAD']); } catch {}
        iteration++;
      }
    }
  };

  await Promise.race([loop(), shutdown]);
}
```

---

## 五、评分系统

### 5.1 维度评分提示 (`src/scoring/prompts.ts`)

```typescript
export function buildDimensionPrompt(
  dimensionKey: string,
  dimensionConfig: any,
  pathwayContent: string,
  profile: any,
): string {
  return `你是加拿大移民路径评估专家。

## 评估维度: ${dimensionKey}
${dimensionConfig.description}

## 子维度与评分锚点
${Object.entries(dimensionConfig.sub_dimensions)
  .map(([key, sub]: [string, any]) =>
    `### ${key}
${sub.description}
评分锚点:
${Object.entries(sub.anchors).map(([score, desc]) => `  ${score}分: ${desc}`).join('\n')}`)
  .join('\n\n')}

## 申请人档案
${JSON.stringify(profile, null, 2)}

## 当前移民路径
${pathwayContent}

请严格按照评分锚点评估路径在此维度的表现。
返回JSON:
{
  "dimension": "${dimensionKey}",
  "sub_dimensions": {
    "sub_dim_name": { "score": 0-100, "note": "评分理由" },
    ...
  }
}`;
}

export function buildCriticPrompt(
  pathwayContent: string,
  profile: any,
  adversarialRules: any,
): string {
  return `你是一位严格的加拿大移民路径审核官。你的工作是找出路径中的每一个问题。

## 对抗性审核规则
${JSON.stringify(adversarialRules, null, 2)}

## 申请人档案
${JSON.stringify(profile, null, 2)}

## 当前路径
${pathwayContent}

审核流程:
1. 逐步骤检查是否满足所有资格要求
2. 验证时间线逻辑（过期证件、顺序依赖）
3. 核实费用估算是否遗漏
4. 检查是否依赖不存在或已关闭的项目
5. 确认路径不违反申请人的anti_patterns

对每个发现的问题返回:
{
  "penalties": [
    { "category": "eligibility|timeline|cost|feasibility",
      "step": 步骤编号,
      "issue": "具体问题描述",
      "penalty": 负数扣分值 }
  ]
}

如果没有发现问题，返回 { "penalties": [] }。
但你必须非常严格——大多数路径都有至少2-3个问题。`;
}

export function buildComparativePrompt(
  oldPathway: string,
  newPathway: string,
): string {
  return `你是加拿大移民路径评估专家。

比较以下两个版本的移民路径，评估变更带来的影响。

## 旧版本
${oldPathway}

## 新版本
${newPathway}

对以下维度评估变更的影响（-5到+5分）:
- success_probability（成功率）
- timeline_efficiency（时间效率）
- cost_efficiency（成本效率）
- quality_of_life（生活质量）
- plan_robustness（计划韧性）

返回JSON:
{
  "deltas": {
    "success_probability": { "delta": 数字, "reason": "理由" },
    "timeline_efficiency": { "delta": 数字, "reason": "理由" },
    "cost_efficiency": { "delta": 数字, "reason": "理由" },
    "quality_of_life": { "delta": 数字, "reason": "理由" },
    "plan_robustness": { "delta": 数字, "reason": "理由" }
  },
  "verdict": "better|worse|neutral",
  "summary": "变更总结"
}`;
}
```

---

## 六、初始化流程

### 6.1 问卷设计 (`src/commands/init.ts`)

```typescript
import inquirer from 'inquirer';
import { ApplicantProfile } from '../data/schemas';
import { calculateCRS } from '../crs/calculator';
import { ieltsToClb } from '../crs/calculator';

export async function collectProfile(): Promise<ApplicantProfile> {
  console.log('\n📋 加拿大移民路径优化器 — 个人档案收集\n');

  // === 基本信息 ===
  const personal = await inquirer.prompt([
    { type: 'input', name: 'name', message: '姓名:' },
    { type: 'input', name: 'nationality', message: '国籍:' },
    { type: 'number', name: 'age', message: '年龄:' },
    { type: 'input', name: 'date_of_birth', message: '出生日期 (YYYY-MM-DD):' },
    { type: 'list', name: 'marital_status', message: '婚姻状况:',
      choices: [
        { name: '单身', value: 'single' },
        { name: '已婚', value: 'married' },
        { name: '同居伴侣', value: 'common_law' },
      ]},
    { type: 'confirm', name: 'has_children', message: '有子女吗?' },
  ]);

  // === 教育 ===
  const education = await inquirer.prompt([
    { type: 'list', name: 'highest_degree', message: '最高学历:',
      choices: [
        { name: '高中', value: 'high_school' },
        { name: '一年制大专/证书', value: 'one_year_diploma' },
        { name: '两年制大专', value: 'two_year_diploma' },
        { name: '本科', value: 'bachelors' },
        { name: '双学历', value: 'two_or_more_credentials' },
        { name: '硕士', value: 'masters' },
        { name: '博士', value: 'phd' },
      ]},
    { type: 'input', name: 'field_of_study', message: '专业领域:' },
    { type: 'input', name: 'institution', message: '毕业院校:' },
    { type: 'input', name: 'country', message: '学校所在国家:' },
    { type: 'number', name: 'year_completed', message: '毕业年份:' },
    { type: 'confirm', name: 'eca_completed', message: '是否已完成学历认证 (ECA/WES)?', default: false },
  ]);

  // === 语言 ===
  const langBase = await inquirer.prompt([
    { type: 'list', name: 'primary_test', message: '英语考试类型:',
      choices: ['IELTS', 'CELPIP', 'none'] },
  ]);

  let english = null;
  if (langBase.primary_test !== 'none') {
    const scores = await inquirer.prompt([
      { type: 'number', name: 'reading', message: `${langBase.primary_test} Reading:` },
      { type: 'number', name: 'writing', message: `${langBase.primary_test} Writing:` },
      { type: 'number', name: 'listening', message: `${langBase.primary_test} Listening:` },
      { type: 'number', name: 'speaking', message: `${langBase.primary_test} Speaking:` },
    ]);

    if (langBase.primary_test === 'IELTS') {
      english = {
        reading: ieltsToClb(scores.reading),
        writing: ieltsToClb(scores.writing),
        listening: ieltsToClb(scores.listening),
        speaking: ieltsToClb(scores.speaking),
      };
    } else {
      english = scores; // CELPIP直接是CLB
    }
  }

  const hasFrench = await inquirer.prompt([
    { type: 'confirm', name: 'has_french', message: '有法语成绩吗?', default: false },
  ]);
  let french = null;
  if (hasFrench.has_french) {
    const frScores = await inquirer.prompt([
      { type: 'number', name: 'reading', message: 'TEF/TCF Reading (CLB):' },
      { type: 'number', name: 'writing', message: 'TEF/TCF Writing (CLB):' },
      { type: 'number', name: 'listening', message: 'TEF/TCF Listening (CLB):' },
      { type: 'number', name: 'speaking', message: 'TEF/TCF Speaking (CLB):' },
    ]);
    french = frScores;
  }

  // === 工作经验 ===
  const work = await inquirer.prompt([
    { type: 'input', name: 'current_occupation', message: '当前职位:' },
    { type: 'input', name: 'noc_code', message: 'NOC代码 (如21232):' },
    { type: 'list', name: 'teer_category', message: 'TEER类别:',
      choices: [
        { name: 'TEER 0 (管理)', value: 0 },
        { name: 'TEER 1 (专业)', value: 1 },
        { name: 'TEER 2 (技术)', value: 2 },
        { name: 'TEER 3 (中级)', value: 3 },
        { name: 'TEER 4 (劳动)', value: 4 },
      ]},
    { type: 'number', name: 'foreign_years', message: '海外工作经验（年）:' },
    { type: 'number', name: 'canadian_years', message: '加拿大工作经验（年）:', default: 0 },
  ]);

  // === 财务 ===
  const finances = await inquirer.prompt([
    { type: 'number', name: 'settlement_funds_cad', message: '可证明安家资金 (CAD):' },
    { type: 'confirm', name: 'willing_to_invest', message: '愿意走投资移民吗?', default: false },
  ]);

  // === 加拿大联系 ===
  const ties = await inquirer.prompt([
    { type: 'confirm', name: 'has_job_offer', message: '有加拿大雇主Offer吗?', default: false },
    { type: 'confirm', name: 'relatives_in_canada', message: '有加拿大亲属吗?', default: false },
    { type: 'confirm', name: 'previous_study', message: '曾在加拿大留学?', default: false },
    { type: 'confirm', name: 'previous_work', message: '曾在加拿大工作?', default: false },
  ]);

  // === 偏好 ===
  const preferences = await inquirer.prompt([
    { type: 'checkbox', name: 'target_provinces', message: '目标省份（可多选）:',
      choices: [
        'Ontario', 'British Columbia', 'Alberta', 'Quebec',
        'Manitoba', 'Saskatchewan', 'Nova Scotia', 'New Brunswick',
        'Newfoundland', 'PEI', '不限',
      ]},
    { type: 'list', name: 'timeline_urgency', message: '时间紧迫度:',
      choices: [
        { name: '越快越好', value: 'asap' },
        { name: '一年以内', value: 'within_1_year' },
        { name: '两年以内', value: 'within_2_years' },
        { name: '不着急', value: 'flexible' },
      ]},
    { type: 'list', name: 'risk_tolerance', message: '风险承受能力:',
      choices: [
        { name: '低（只走最稳妥的路线）', value: 'low' },
        { name: '中（可以接受一些不确定性）', value: 'medium' },
        { name: '高（愿意尝试新项目/试点）', value: 'high' },
      ]},
    { type: 'confirm', name: 'willing_to_study', message: '愿意通过留学作为移民途径吗?', default: false },
    { type: 'confirm', name: 'willing_to_relocate_province', message: '愿意为PNP搬到非首选省份吗?' },
    { type: 'input', name: 'anti_patterns', message: '不愿做的事（逗号分隔）:' },
  ]);

  // 组装档案
  const profile: ApplicantProfile = {
    personal,
    education: { ...education, country: education.country, has_canadian_credential: false },
    language: { primary_test: langBase.primary_test, english, french },
    work_experience: {
      canadian: [], foreign: [],
      total_years_canadian: work.canadian_years,
      total_years_foreign: work.foreign_years,
      current_occupation: work.current_occupation,
      noc_code: work.noc_code,
      teer_category: work.teer_category,
    },
    finances,
    canadian_ties: {
      has_job_offer: ties.has_job_offer,
      relatives_in_canada: ties.relatives_in_canada,
      previous_study_in_canada: ties.previous_study,
      previous_work_in_canada: ties.previous_work,
      previous_visit_to_canada: false,
    },
    preferences: {
      target_provinces: preferences.target_provinces,
      preferred_city_size: 'any',
      industry_preference: [education.field_of_study],
      timeline_urgency: preferences.timeline_urgency,
      risk_tolerance: preferences.risk_tolerance,
      willing_to_study: preferences.willing_to_study,
      willing_to_relocate_province: preferences.willing_to_relocate_province,
      priority_order: ['certainty', 'speed', 'cost', 'quality_of_life'],
      anti_patterns: preferences.anti_patterns.split(',').map((s: string) => s.trim()),
    },
  };

  // 即时CRS计算
  const crs = calculateCRS(profile);
  console.log(`\n📊 CRS估算分数: ${crs.total}`);
  console.log(`  年龄: ${crs.details.age} | 教育: ${crs.details.education} | 语言: ${crs.details.first_language}`);
  console.log(`  加拿大经验: ${crs.details.canadian_experience} | 技能转移: ${crs.skill_transferability}`);

  return profile;
}
```

---

## 七、项目数据库 (`programs_db.json`)

### 7.1 研究系统 (`src/research/researcher.ts`)

```typescript
import { LLMProvider } from '../llm/provider';
import { ImmigrationProgram, ApplicantProfile } from '../data/schemas';

export async function researchPrograms(
  profile: ApplicantProfile,
  existingPrograms: Record<string, ImmigrationProgram>,
  llm: LLMProvider,
): Promise<ImmigrationProgram[]> {
  const prompt = `你是加拿大移民项目研究专家。

申请人背景:
- 国籍: ${profile.personal.nationality}
- 年龄: ${profile.personal.age}
- 学历: ${profile.education.highest_degree} (${profile.education.field_of_study})
- 工作: ${profile.work_experience.current_occupation} (NOC ${profile.work_experience.noc_code}, TEER ${profile.work_experience.teer_category})
- 海外工作: ${profile.work_experience.total_years_foreign}年
- 加拿大工作: ${profile.work_experience.total_years_canadian}年
- 英语CLB: ${profile.language.english ? Math.min(profile.language.english.reading, profile.language.english.writing, profile.language.english.listening, profile.language.english.speaking) : 'N/A'}
- 法语: ${profile.language.french ? '有' : '无'}
- 安家资金: $${profile.finances.settlement_funds_cad} CAD
- 目标省份: ${profile.preferences.target_provinces.join(', ')}

已有项目: ${Object.keys(existingPrograms).join(', ')}

请研究并返回5-10个适合此申请人的加拿大移民项目（排除已有项目）。
包括联邦和省提名项目。对每个项目提供完整信息。

返回JSON数组，每个元素结构:
{
  "id": "唯一ID",
  "name": "英文名",
  "name_zh": "中文名",
  "category": "express_entry|pnp|atlantic|startup_visa|study_pathway|work_permit|other",
  "stream": "具体stream名（如有）",
  "province": "省份（联邦项目为null）",
  "description": "英文描述",
  "description_zh": "中文描述",
  "eligibility": {
    "min_clb": 数字,
    "min_education": "学历等级",
    "min_work_years_canadian": 数字,
    "min_work_years_foreign": 数字,
    "min_noc_teer": 数字,
    "eligible_noc_codes": null或["codes"],
    "min_settlement_funds": 数字,
    "requires_job_offer": boolean,
    "requires_lmia": boolean,
    "requires_provincial_nomination": boolean,
    "additional_requirements": ["额外要求"]
  },
  "processing": {
    "typical_processing_months": { "min": 数字, "max": 数字 },
    "application_fee_cad": 数字,
    "additional_costs": [{ "item": "名目", "cost_cad": 数字 }],
    "total_estimated_cost_cad": 数字
  },
  "metrics": {
    "success_rate_estimate": 0-100,
    "historical_cutoff_crs": 数字或null,
    "annual_quota": 数字或null,
    "competition_level": "low|medium|high|very_high",
    "draw_frequency": "频率描述"
  },
  "source": "llm_knowledge",
  "last_verified": "${new Date().toISOString().split('T')[0]}",
  "url": "官方链接"
}`;

  const response = await llm.complete(prompt, 8000);
  const programs: ImmigrationProgram[] = JSON.parse(extractJson(response));
  return programs;
}

export function mergeProgramsDb(
  existing: Record<string, ImmigrationProgram>,
  newPrograms: ImmigrationProgram[],
): Record<string, ImmigrationProgram> {
  const merged = { ...existing };
  for (const prog of newPrograms) {
    if (merged[prog.id]) {
      // 更新: 保留 source 优先级更高的版本
      const sourcePriority = { ircc_official: 4, provincial_official: 3, web_research: 2, llm_knowledge: 1 };
      const existingPriority = sourcePriority[merged[prog.id].source] ?? 0;
      const newPriority = sourcePriority[prog.source] ?? 0;
      if (newPriority >= existingPriority) {
        merged[prog.id] = prog;
      }
    } else {
      merged[prog.id] = prog;
    }
  }
  return merged;
}
```

### 7.2 初始种子数据

系统应内置核心联邦项目的种子数据（不依赖LLM生成）：

```typescript
// src/data/seed-programs.ts
export const SEED_PROGRAMS: Record<string, ImmigrationProgram> = {
  'ee_fswp': {
    id: 'ee_fswp',
    name: 'Express Entry - Federal Skilled Worker Program',
    name_zh: '快速通道 - 联邦技术移民',
    category: 'express_entry',
    province: null,
    description: 'Points-based system for skilled workers with foreign work experience',
    description_zh: '基于积分的联邦技术移民项目，面向有海外工作经验的技术工人',
    eligibility: {
      min_clb: 7,
      min_education: 'high_school',
      min_work_years_canadian: 0,
      min_work_years_foreign: 1,
      min_noc_teer: 3,
      eligible_noc_codes: null,
      min_settlement_funds: 13757,
      requires_job_offer: false,
      requires_lmia: false,
      requires_provincial_nomination: false,
      additional_requirements: ['Must score 67+ on FSW selection grid'],
    },
    processing: {
      typical_processing_months: { min: 5, max: 8 },
      application_fee_cad: 1365,
      additional_costs: [
        { item: 'Biometrics', cost_cad: 85 },
        { item: 'Medical exam', cost_cad: 450 },
        { item: 'Police certificate', cost_cad: 100 },
      ],
      total_estimated_cost_cad: 2000,
    },
    metrics: {
      success_rate_estimate: 85,
      historical_cutoff_crs: 524,
      annual_quota: 110000,
      competition_level: 'high',
      draw_frequency: 'bi-weekly',
    },
    source: 'ircc_official',
    last_verified: '2026-03-01',
    url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers.html',
  },
  'ee_cec': {
    id: 'ee_cec',
    name: 'Express Entry - Canadian Experience Class',
    name_zh: '快速通道 - 加拿大经验类',
    category: 'express_entry',
    province: null,
    description: 'For skilled workers with Canadian work experience',
    description_zh: '面向有加拿大工作经验的技术工人',
    eligibility: {
      min_clb: 7,        // TEER 0/1; CLB 5 for TEER 2/3
      min_education: 'high_school',
      min_work_years_canadian: 1,
      min_work_years_foreign: 0,
      min_noc_teer: 3,
      eligible_noc_codes: null,
      min_settlement_funds: 0,    // CEC无安家资金要求
      requires_job_offer: false,
      requires_lmia: false,
      requires_provincial_nomination: false,
      additional_requirements: ['12 months Canadian work experience in last 3 years'],
    },
    processing: {
      typical_processing_months: { min: 4, max: 6 },
      application_fee_cad: 1365,
      additional_costs: [
        { item: 'Biometrics', cost_cad: 85 },
        { item: 'Medical exam', cost_cad: 450 },
      ],
      total_estimated_cost_cad: 1900,
    },
    metrics: {
      success_rate_estimate: 90,
      historical_cutoff_crs: 510,
      annual_quota: 82880,
      competition_level: 'high',
      draw_frequency: 'bi-weekly',
    },
    source: 'ircc_official',
    last_verified: '2026-03-01',
    url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/canadian-experience-class.html',
  },
  // ... FSTP, Atlantic, PNP streams 等
};
```

---

## 八、文件结构（最终目录）

```
immigration-optimizer/
├── src/
│   ├── cli.ts                       # Commander.js 入口
│   ├── i18n.ts                      # 中英文双语
│   ├── index.ts
│   ├── commands/
│   │   ├── init.ts                  # 问卷 + 档案生成
│   │   ├── run.ts                   # 启动优化 (standalone / agent)
│   │   ├── run-agent.ts             # Claude Code agent 模式
│   │   ├── score.ts                 # 单次评分
│   │   ├── research.ts              # 手动研究移民项目
│   │   ├── status.ts                # 显示优化进度
│   │   ├── dashboard.ts             # 实时仪表盘
│   │   ├── chart.ts                 # ASCII分数趋势图
│   │   ├── plan.ts                  # 显示/导出路径 (PDF)
│   │   ├── crs.ts                   # CRS分数计算/模拟
│   │   ├── compare.ts               # 对比两个路径方案
│   │   ├── config.ts                # 管理API密钥
│   │   └── profile.ts               # 查看申请人档案
│   ├── data/
│   │   ├── schemas.ts               # 所有TypeScript接口
│   │   ├── config.ts                # config.json管理
│   │   ├── profile.ts               # profile.yaml管理
│   │   ├── pathway.ts               # pathway.md读写
│   │   ├── paths.ts                 # 全局数据目录
│   │   └── seed-programs.ts         # 内置联邦项目数据
│   ├── crs/
│   │   ├── calculator.ts            # CRS分数计算（确定性）
│   │   ├── eligibility.ts           # 项目资格检查
│   │   ├── what-if.ts               # "如果...会怎样" 模拟
│   │   └── draw-history.ts          # 历史邀请分数线
│   ├── llm/
│   │   ├── provider.ts
│   │   ├── factory.ts
│   │   ├── anthropic.ts
│   │   ├── vertex.ts
│   │   ├── openai-compatible.ts
│   │   └── json-parser.ts
│   ├── generators/
│   │   ├── profile-yaml.ts          # 问卷→profile.yaml
│   │   ├── rubrics.ts               # 评分标准生成
│   │   ├── pathway.ts               # 初始路径生成
│   │   └── program.ts               # Agent指令生成
│   ├── optimizer/
│   │   ├── loop.ts                  # 主迭代循环
│   │   ├── mutations.ts             # 变异生成
│   │   └── logger.ts                # results.tsv记录
│   ├── scoring/
│   │   ├── scorer.ts                # 评分编排器
│   │   ├── dimension-scorer.ts      # 维度评分
│   │   ├── critic.ts                # 对抗性审核
│   │   ├── holistic.ts              # 跨维度调整
│   │   └── prompts.ts               # 所有评分提示词
│   └── research/
│       └── researcher.ts            # 项目研究 + 合并
├── tests/
│   ├── crs/
│   │   ├── calculator.test.ts       # CRS计算单元测试
│   │   └── eligibility.test.ts      # 资格检查测试
│   ├── optimizer/
│   │   └── mutations.test.ts
│   └── scoring/
│       └── critic.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 九、与 trip-optimizer 的关键差异

| 方面 | trip-optimizer | immigration-optimizer |
|------|----------------|----------------------|
| **确定性计算** | 无 | CRS计算器、资格检查器（不需LLM） |
| **数据时效性** | 餐厅/活动变化慢 | 移民政策、分数线变化快，需频繁web research |
| **步骤依赖** | 日程线性排列 | 步骤有复杂依赖关系，支持并行 |
| **备选路径** | 无 | pathway.md显式包含Plan B/C |
| **变异类型** | SWAP/UPGRADE/REORDER/SIMPLIFY/REALLOCATE | SWAP_PROGRAM/ADD_CREDENTIAL/REORDER_STEPS/ADD_PARALLEL/SWITCH_PROVINCE |
| **评分重点** | 体验、物流、美食 | 成功率、时间线、成本、生活质量、韧性 |
| **关键新模块** | — | CRS计算器、资格筛选器、What-If模拟器 |
| **风险维度** | 仅"来源可信度"抑制 | 政策敏感度、备选方案、证件过期检查 |
| **语言** | EN/ZH | 主要ZH（面向中国申请人），支持EN |

---

## 十、实现优先级

### P0 — 核心 ✅ COMPLETED
1. ✅ `src/data/schemas.ts` — 所有接口定义 (含 Reward/RewardRule)
2. ✅ `src/crs/calculator.ts` — CRS确定性计算
3. ✅ `src/crs/eligibility.ts` — 资格检查
4. ✅ `src/data/seed-programs.ts` — 内置项目数据 (10个联邦+省提名项目)
5. ✅ `src/commands/init.ts` — 问卷 + 档案收集 + CRS即时计算
6. ✅ `src/generators/plan.ts` — 初始路径生成 (pathway.md)
7. ✅ `src/optimizer/mutations.ts` — 6种变异 (SWAP_PROGRAM, ADD_CREDENTIAL, REORDER_STEPS, ADD_PARALLEL, SWITCH_PROVINCE, RESEARCH)
8. ✅ `src/optimizer/loop.ts` — 主循环
9. ✅ `src/scoring/` — 全套评分系统 (含 reward evaluator + penalty critic)
10. ✅ `src/generators/rubrics.ts` — 评分标准 + 奖励规则 + 惩罚规则
11. ✅ `src/generators/program.ts` — Agent指令生成
12. ✅ `src/commands/` — 全部命令 (init, run, score, research, status, dashboard, chart, profile, config)
13. ✅ `src/research/researcher.ts` — 项目研究 + 合并
14. ✅ `src/i18n.ts` — 中英文双语 (默认中文)
15. ✅ `src/cli.ts` — CLI入口 (immigration-optimizer)
16. ✅ 评分奖惩机制 — rewards + penalties 双向迭代优化

### P1 — 增强
17. ✅ 实时仪表盘 — CRS分析、维度评分、奖惩显示、变异分布、sparkline趋势、资格矩阵、路径摘要
18. ✅ Claude Code agent模式 — CRS分析嵌入program.md、评分系统指南、变异策略、研究清单、资格前置验证
19. `src/crs/what-if.ts` — "如果重考IELTS到CLB10会怎样"模拟
20. `src/crs/draw-history.ts` — 自动获取最新邀请分数线
21. `src/commands/compare.ts` — 对比两个方案
22. Web research集成（获取最新政策）

### P2 — 扩展
23. PDF导出
24. 多申请人（主申+配偶联合优化）
25. 政策变动追踪与自动重评分
