import type { LLMProvider } from '../llm/provider.js';
import type { ApplicantProfile, CRSBreakdown } from '../data/schemas.js';
import { getLlmLanguageInstruction } from '../i18n.js';

const SEED_RUBRIC = `dimensions:
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
          80: "满足所有要求，但某些方面接近最低线"
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
          60: "严重依赖特定政策（试点项目等）"
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
    - rule: "路径与申请人明确的anti_patterns冲突"
      penalty: -15
  max_penalty_per_dimension: -25

rewards:
  eligibility:
    - rule: "申请人各项指标远超目标项目最低要求"
      reward: 5
    - rule: "CRS分数高出最近抽签分数线30分以上"
      reward: 8
    - rule: "同时满足多个项目的资格要求，选择灵活"
      reward: 5
  timeline:
    - rule: "所有可并行步骤已实现并行"
      reward: 5
    - rule: "总路径时长在12个月以内"
      reward: 8
    - rule: "关键路径上无不必要的等待"
      reward: 3
  cost:
    - rule: "总费用低于$10,000 CAD"
      reward: 5
    - rule: "高投入步骤对应高确定性回报"
      reward: 3
  robustness:
    - rule: "有2个以上可行备选路径且切换成本低"
      reward: 5
    - rule: "主路径使用成熟稳定的移民项目（非试点）"
      reward: 3
  quality:
    - rule: "目标省份完全匹配申请人首选"
      reward: 3
    - rule: "移民过程中无需中断职业发展"
      reward: 5
    - rule: "路径考虑了家庭成员需求"
      reward: 3
  max_reward_per_dimension: 15`;

export async function generateRubrics(
  provider: LLMProvider,
  profile: ApplicantProfile,
  crs: CRSBreakdown,
): Promise<string> {
  const prompt = `Generate a scoring rubric for evaluating a Canadian immigration pathway plan. The rubric should have 5-7 scoring dimensions, each with 2-4 sub-dimensions. Each sub-dimension needs anchor descriptions at scores 60, 80, and 90.

Also generate adversarial penalty rules that catch specific flaws in immigration pathway plans.

## Applicant Details
- Age: ${profile.personal.age}, Nationality: ${profile.personal.nationality}
- Education: ${profile.education.highest_degree} in ${profile.education.field_of_study}
- CRS Score: ${crs.total}
- Work: ${profile.work_experience.current_occupation} (${profile.work_experience.total_years_foreign}yr foreign, ${profile.work_experience.total_years_canadian}yr Canadian)
- Language: ${profile.language.english ? `English CLB min ${Math.min(profile.language.english.reading, profile.language.english.writing, profile.language.english.listening, profile.language.english.speaking)}` : 'No English test'}, ${profile.language.french ? 'Has French' : 'No French'}
- Target provinces: ${profile.preferences.target_provinces.join(', ')}
- Timeline: ${profile.preferences.timeline_urgency}
- Risk tolerance: ${profile.preferences.risk_tolerance}
- Things to avoid: ${profile.preferences.anti_patterns.join(', ') || 'none'}

## Seed Example (adapt dimensions and anchors to fit THIS applicant's profile)
\`\`\`yaml
${SEED_RUBRIC}
\`\`\`

IMPORTANT:
- Adapt dimensions to this applicant's specific situation
- Dimension weights must sum to 1.0
- Anchor descriptions should reference the applicant's specifics (CRS score, occupation, target provinces)
- Keep the same YAML structure as the seed example
- Return ONLY valid YAML, no other text${getLlmLanguageInstruction()}`;

  const response = await provider.complete(prompt, 4000);

  let yamlText = response;
  if (yamlText.startsWith('```')) {
    yamlText = yamlText.split('\n').slice(1).join('\n');
    const lastBacktick = yamlText.lastIndexOf('```');
    if (lastBacktick >= 0) {
      yamlText = yamlText.substring(0, lastBacktick).trim();
    }
  }

  return yamlText;
}
