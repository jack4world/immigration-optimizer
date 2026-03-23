import type { ApplicantProfile, CRSBreakdown } from '../data/schemas.js';
import type { Config } from '../data/config.js';
import { getLanguage } from '../i18n.js';
import { calculateCRS } from '../crs/calculator.js';

export function generateProgram(profile: ApplicantProfile, config: Config): string {
  const hasSearchApi = !!config.search_api?.api_key;
  const isZh = getLanguage() === 'zh';
  const crs = calculateCRS(profile);

  const engMin = profile.language.english
    ? Math.min(profile.language.english.reading, profile.language.english.writing,
               profile.language.english.listening, profile.language.english.speaking)
    : 0;

  const crsGap = crs.total < 500 ? 500 - crs.total : 0;
  const needsPnp = crs.total < 480;

  const researchSources = isZh
    ? `### 研究来源（按优先级排序）

1. **浏览器研究**（使用 agent-browser 技能）：
   - IRCC 官网: https://www.canada.ca/en/immigration-refugees-citizenship.html
   - 各省PNP官网获取最新项目要求、配额和抽签分数
   - Express Entry 最新抽签: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/submit-profile/rounds-invitations.html
   - canadavisa.com 论坛获取实时审批时间线和经验
   - NOC 职业查询: https://noc.esdc.gc.ca/

${hasSearchApi ? `2. **网络搜索 API**（已配置）：
   - "Canada Express Entry draw ${new Date().toISOString().substring(0, 7)}" — 获取最新分数线
   - "[province] PNP draw 2026 latest" — 各省最新抽签
   - "IRCC processing times ${new Date().getFullYear()}" — 最新处理时间
   - "NOC ${profile.work_experience.noc_code} Canada demand" — 职业需求
   - "[program name] eligibility requirements 2026" — 最新资格要求

3. **LLM 知识**（备选）：` : `2. **LLM 知识**（主要来源）：
`}   - 使用训练数据获取移民项目信息
   - 标记来源为 "llm_knowledge"
   - 注意：政策可能已变更，需要通过浏览器验证关键信息`
    : `### Research Sources (priority order)

1. **Browser research** (use agent-browser skill):
   - IRCC official: https://www.canada.ca/en/immigration-refugees-citizenship.html
   - Provincial PNP sites for latest requirements, quotas, draw scores
   - Latest EE draws: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/submit-profile/rounds-invitations.html
   - canadavisa.com forums for real processing timelines
   - NOC lookup: https://noc.esdc.gc.ca/

${hasSearchApi ? `2. **Web search API** (configured):
   - "Canada Express Entry draw ${new Date().toISOString().substring(0, 7)}"
   - "[province] PNP draw 2026 latest"
   - "IRCC processing times ${new Date().getFullYear()}"
   - "NOC ${profile.work_experience.noc_code} Canada demand"

3. **LLM knowledge** (fallback):` : `2. **LLM knowledge** (primary):
`}   - Use training data for program info
   - Flag as source: "llm_knowledge"
   - Verify critical info via browser when possible`;

  const outputLanguage = isZh
    ? `\n## 输出语言\n所有输出（pathway.md、programs_db.json、commit messages）使用简体中文。\n`
    : '';

  const crsAnalysis = isZh
    ? `## CRS 分析

当前 CRS: **${crs.total}** 分
- 年龄: ${crs.details.age} (${profile.personal.age}岁)
- 教育: ${crs.details.education} (${profile.education.highest_degree})
- 第一语言: ${crs.details.first_language} (最低CLB ${engMin})
- 加拿大经验: ${crs.details.canadian_experience} (${profile.work_experience.total_years_canadian}年)
- 技能转移: ${crs.skill_transferability}
- 额外加分: ${crs.additional_points}
${crs.details.provincial_nomination > 0 ? `- 省提名: +600` : ''}

### CRS 提分策略（按投入产出比排序）
${engMin < 10 ? `1. **重考语言** — 当前最低CLB ${engMin}，提升到CLB 10可增加约 ${(10 - engMin) * 4}-${(10 - engMin) * 8} 分` : ''}
${!profile.language.french ? `${engMin < 10 ? '2' : '1'}. **考法语TEF/TCF** — CLB 7+ 可加 25-50 分（双语加分）` : ''}
${!profile.education.has_canadian_credential ? `${!profile.language.french ? '3' : '2'}. **加拿大教育证书** — 短期课程可加 15-30 分` : ''}
${needsPnp ? `\n### 关键提醒\nCRS ${crs.total} 分低于近期全类别抽签线（~500+），建议:\n- 优先考虑PNP路线（省提名 +600 分，确保被邀请）\n- 或通过定向抽签（STEM、法语、医疗等类别邀请分数更低）` : ''}`
    : `## CRS Analysis

Current CRS: **${crs.total}**
- Age: ${crs.details.age} (age ${profile.personal.age})
- Education: ${crs.details.education} (${profile.education.highest_degree})
- First language: ${crs.details.first_language} (min CLB ${engMin})
- Canadian experience: ${crs.details.canadian_experience} (${profile.work_experience.total_years_canadian}yr)
- Skill transfer: ${crs.skill_transferability}
- Additional: ${crs.additional_points}

### CRS Improvement Strategies (by ROI)
${engMin < 10 ? `1. **Retake language test** — min CLB ${engMin}, CLB 10 adds ~${(10 - engMin) * 4}-${(10 - engMin) * 8} points` : ''}
${!profile.language.french ? `2. **Take French TEF/TCF** — CLB 7+ adds 25-50 points (bilingual bonus)` : ''}
${needsPnp ? `\n### Key Warning\nCRS ${crs.total} is below recent general draws (~500+). Consider:\n- PNP route (+600 points, guarantees invitation)\n- Category-based draws (STEM, French, healthcare have lower cutoffs)` : ''}`;

  const scoringGuide = isZh
    ? `## 评分系统

路径评分使用 **5维度 + 奖惩** 系统:

### 维度 (rubrics.yaml)
1. **success_probability** (成功率, w=0.30) — CRS竞争力、项目资格匹配、历史批准率
2. **timeline_efficiency** (时间效率, w=0.25) — 总耗时、关键路径优化、并行化
3. **cost_efficiency** (成本效率, w=0.15) — 总费用、投入产出比
4. **quality_of_life** (生活质量, w=0.15) — 目标匹配、职业连续性
5. **plan_robustness** (计划韧性, w=0.15) — 备选方案、政策风险

### 惩罚 (扣分，每维度最多 -25)
- 不满足资格要求的项目 → -15
- CLB不达标 → -20
- 步骤依赖顺序错误 → -10
- 证件过期 → -20
- 遗漏费用 → -5
- 依赖不存在的项目 → -25

### 奖励 (加分，每维度最多 +15)
- 超额满足所有要求 → +5
- CRS高出分数线30分 → +8
- 最优并行化 → +5
- 总时长<12个月 → +8
- 有2+备选路径 → +5
- 无需中断职业 → +5

### 评分命令
在项目目录中运行: \`immigration-optimizer score\`
查看实时仪表盘: \`immigration-optimizer dashboard --watch\``
    : `## Scoring System

Pathway scoring uses a **5-dimension + reward/penalty** system:

### Dimensions (rubrics.yaml)
1. **success_probability** (w=0.30) — CRS competitiveness, eligibility match, approval rates
2. **timeline_efficiency** (w=0.25) — total duration, critical path, parallelization
3. **cost_efficiency** (w=0.15) — total cost, cost-risk ratio
4. **quality_of_life** (w=0.15) — destination match, career continuity
5. **plan_robustness** (w=0.15) — backup options, policy sensitivity

### Penalties (per dimension max -25)
- Ineligible program → -15
- CLB below requirement → -20
- Step dependency error → -10
- Expired credential → -20
- Missing costs → -5

### Rewards (per dimension max +15)
- Exceeds all requirements → +5
- CRS 30+ above cutoff → +8
- Optimal parallelization → +5
- Total duration <12mo → +8
- 2+ backup pathways → +5

### Scoring Command
Run in project dir: \`immigration-optimizer score\`
Live dashboard: \`immigration-optimizer dashboard --watch\``;

  const mutationStrategies = isZh
    ? `## 变异策略指南

### SWAP_PROGRAM — 替换项目
- 找出成功率最低或处理时间最长的步骤
- 从 programs_db.json 中找更好的替代
- **必须验证资格**: 检查 CLB、学历、工作年限、NOC
- 考虑因素: CRS分数线趋势、配额使用率、处理时间

### ADD_CREDENTIAL — 增加证书
- 分析 CRS 薄弱环节（上面的 CRS 分析）
- 评估 ROI: 时间成本 vs 分数提升
- 选项: 重考IELTS/CELPIP、法语TEF/TCF、加拿大短期课程、专业认证
- **不要同时加太多证书** — 每次只加一个，看评分变化

### REORDER_STEPS — 重排步骤
- 检查真实依赖关系 vs 不必要的串行
- 例如: ECA 申请不需要等语言成绩
- 体检可以在收到 ITA 之前准备（预约体检医生）
- 无犯罪证明可以提前办

### ADD_PARALLEL — 添加并行
- 找到当前串行但可以同时进行的步骤
- 常见并行: 语言考试 + ECA申请、等待ITA + 准备体检、PR申请 + 无犯罪证明
- 更新时间线，标注并行关系

### SWITCH_PROVINCE — 换省份
- 比较各省 PNP 对此 NOC(${profile.work_experience.noc_code}) 的需求
- 考虑: 分数线、处理时间、费用、生活成本
- 如果当前省策略最优，添加备选省作为 Plan B
- ${profile.preferences.willing_to_relocate_province ? '申请人愿意搬到非首选省份' : '⚠ 申请人不愿搬到非首选省份'}

### RESEARCH — 研究新项目
- 触发条件: 连续5次丢弃
- 搜索最新联邦试点项目、新开的PNP类别
- 验证现有项目数据是否过期
- 添加到 programs_db.json，然后尝试 SWAP`
    : `## Mutation Strategy Guide

### SWAP_PROGRAM
- Find lowest success rate or longest processing step
- Replace with better-fit program from programs_db.json
- **Must verify eligibility**: check CLB, education, work years, NOC
- Consider: CRS cutoff trends, quota usage, processing times

### ADD_CREDENTIAL
- Analyze CRS weak points (see CRS Analysis above)
- Evaluate ROI: time cost vs score improvement
- Options: retake IELTS/CELPIP, French TEF/TCF, Canadian credential, professional cert

### REORDER_STEPS / ADD_PARALLEL
- Check real dependencies vs unnecessary serialization
- Common parallel pairs: language + ECA, waiting for ITA + medical prep

### SWITCH_PROVINCE
- Compare PNP demand for NOC ${profile.work_experience.noc_code} across provinces
- ${profile.preferences.willing_to_relocate_province ? 'Applicant willing to relocate' : 'WARNING: Applicant NOT willing to relocate'}

### RESEARCH
- Triggered after 5+ consecutive discards
- Search for new pilot programs, new PNP streams
- Verify existing program data is current`;

  return `# immigration-optimizer Agent Instructions

## Setup
1. Read \`profile.yaml\` — applicant background and preferences
2. Read \`pathway.md\` — current immigration plan (being optimized)
3. Read \`programs_db.json\` — immigration programs database
4. Read \`rubrics.yaml\` — scoring criteria (dimensions + penalties + rewards)
5. Score the baseline: \`immigration-optimizer score\`
6. Review score.json for dimension breakdown, penalties, and rewards
7. Begin optimization

## Applicant Summary
- **${profile.personal.name}** | ${profile.personal.nationality} | Age ${profile.personal.age} | ${profile.personal.marital_status}
- **${profile.work_experience.current_occupation}** (NOC ${profile.work_experience.noc_code}, TEER ${profile.work_experience.teer_category})
- Education: ${profile.education.highest_degree} in ${profile.education.field_of_study}
- Foreign work: ${profile.work_experience.total_years_foreign}yr | Canadian work: ${profile.work_experience.total_years_canadian}yr
- English: ${profile.language.english ? `CLB R${profile.language.english.reading}/W${profile.language.english.writing}/L${profile.language.english.listening}/S${profile.language.english.speaking}` : 'None'}
- French: ${profile.language.french ? `CLB R${profile.language.french.reading}/W${profile.language.french.writing}/L${profile.language.french.listening}/S${profile.language.french.speaking}` : 'None'}
- Settlement: $${profile.finances.settlement_funds_cad} CAD
- Target: ${profile.preferences.target_provinces.join(', ')}
- Timeline: ${profile.preferences.timeline_urgency}
- Risk: ${profile.preferences.risk_tolerance}

${crsAnalysis}

${scoringGuide}
${outputLanguage}
## Phase 1: Research Sprint

Research immigration programs and verify latest policy data:

${researchSources}

### Research Checklist
- [ ] Latest Express Entry draw scores (last 3 months)
- [ ] Processing times for target programs
- [ ] PNP draw scores for target provinces
- [ ] NOC ${profile.work_experience.noc_code} demand by province
- [ ] Any new pilot programs or policy changes
- [ ] Verify all programs in programs_db.json are still active

After researching, update \`programs_db.json\` with new programs and change \`source\` from "llm_knowledge" to "web_research" or "ircc_official" for verified data.
Git commit: \`research: verified [N] programs, added [N] new\`

## Phase 2: Optimization Loop

\`\`\`
LOOP FOREVER:

1. Pick mutation type (rotate: SWAP_PROGRAM → ADD_CREDENTIAL → REORDER_STEPS → ADD_PARALLEL → SWITCH_PROVINCE)
   If 5+ consecutive discards → RESEARCH

2. Make ONE change to pathway.md
3. Git commit: "[MUTATION_TYPE]: [specific description]"
4. Score: immigration-optimizer score
   (Read score.json for detailed breakdown)
5. If score improved → keep the commit
6. If score equal or worse → git reset --hard HEAD~1
7. Append to results.tsv (tab-separated):
   iteration<TAB>commit<TAB>score_before<TAB>score_after<TAB>delta<TAB>status<TAB>mutation_type<TAB>description
8. NEVER STOP — run until interrupted
\`\`\`

${mutationStrategies}

## Applicant Constraints (DO NOT violate)
${profile.preferences.anti_patterns.length > 0 ? `\nThings to avoid:\n${profile.preferences.anti_patterns.map(a => '- ' + a).join('\n')}` : ''}
- Risk tolerance: ${profile.preferences.risk_tolerance}
- Timeline: ${profile.preferences.timeline_urgency}
${!profile.preferences.willing_to_study ? '- NOT willing to study as immigration pathway' : ''}
${!profile.preferences.willing_to_relocate_province ? '- NOT willing to relocate to non-preferred province' : ''}

## What You CANNOT Do
- Fabricate job offers, LMIA approvals, or provincial nominations
- Assume credentials the applicant doesn't have
- Ignore eligibility requirements for any program
- Modify profile.yaml or rubrics.yaml
- Recommend clearly ineligible programs
- Schedule activities after credential expiry dates

## Crash/Failure Handling
- If scoring fails: revert and log as crash
- If 10+ consecutive discards: shift to RESEARCH phase
- If score plateaus 20+ iterations: try aggressive SWITCH_PROVINCE or ADD_CREDENTIAL
- results.tsv is gitignored — survives git resets

## Context Management
- Write research findings to programs_db.json immediately
- Read results.tsv periodically to avoid repeating failed mutations
- Use \`immigration-optimizer status\` to check progress
- Use \`immigration-optimizer dashboard\` for full overview
`;
}
