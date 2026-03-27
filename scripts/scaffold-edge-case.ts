#!/usr/bin/env npx tsx
/**
 * Scaffold edge case project with pre-generated rubrics/pathway (no API needed)
 */
import { generateProfileYaml, parseProfileYaml, type InitAnswers } from '../src/generators/constraints.js';
import { generateProgram } from '../src/generators/program.js';
import { scaffoldPathway } from '../src/data/pathway.js';
import { loadConfig, saveConfig } from '../src/data/config.js';
import { calculateCRS, ieltsToClb } from '../src/crs/calculator.js';
import { checkEligibility } from '../src/crs/eligibility.js';
import { SEED_PROGRAMS } from '../src/data/seed-programs.js';
import { setLanguage } from '../src/i18n.js';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';

const answers: InitAnswers = {
  name: '张明',
  nationality: 'Chinese',
  age: 40,
  date_of_birth: '1986-05-15',
  marital_status: 'married',
  has_children: true,
  highest_degree: 'bachelors',
  field_of_study: 'Mechanical Engineering',
  institution: '哈尔滨工业大学',
  edu_country: 'China',
  year_completed: 2008,
  eca_completed: true,
  primary_test: 'IELTS',
  english_reading: ieltsToClb(6.5),
  english_writing: ieltsToClb(6.0),
  english_listening: ieltsToClb(6.5),
  english_speaking: ieltsToClb(6.0),
  has_french: false,
  french_reading: 0,
  french_writing: 0,
  french_listening: 0,
  french_speaking: 0,
  current_occupation: 'Mechanical Engineer',
  noc_code: '21301',
  teer_category: 1,
  foreign_years: 15,
  canadian_years: 0,
  settlement_funds_cad: 30000,
  willing_to_invest: false,
  has_job_offer: false,
  relatives_in_canada: false,
  previous_study: false,
  previous_work: false,
  target_provinces: ['Ontario', 'British Columbia', 'Alberta'],
  timeline_urgency: 'within_1_year',
  risk_tolerance: 'medium',
  willing_to_study: false,
  willing_to_relocate: true,
  anti_patterns: ['不愿意读college换身份', '不愿意做非本专业工作'],
  user_notes: 'Q: 为什么选择加拿大？\nA: 孩子教育，希望在加拿大读中学\n\nQ: 配偶情况？\nA: 妻子35岁，本科学历，IELTS 5.5，无工作经验\n\nQ: 是否考虑过其他途径？\nA: 之前看过澳洲技术移民，分数也不够',
};

const RUBRICS_YAML = `dimensions:
  success_probability:
    weight: 0.30
    description: "路径最终获得PR的综合成功率"
    sub_dimensions:
      crs_competitiveness:
        description: "CRS分数相对于历史邀请分数线的竞争力（当前283分，远低于一般抽签线500+）"
        anchors:
          60: "仅依赖Express Entry一般抽签，CRS 283无法被邀请"
          80: "通过PNP获得+600分或通过定向抽签（STEM类别）降低分数线要求"
          90: "通过PNP+CRS提升双管齐下，总分远超任何可能的分数线"
      program_eligibility:
        description: "是否完全满足目标项目的所有资格要求"
        anchors:
          60: "缺少1-2项关键要求（如CLB不达标或工作年限不足）"
          80: "满足所有要求，但语言CLB 7接近最低线"
          90: "各项指标远超最低要求，语言达到CLB 9+"
      historical_approval:
        description: "目标项目的历史批准率和配额情况"
        anchors:
          60: "项目竞争极为激烈，年配额常年用尽"
          80: "项目竞争适中，配额充足"
          90: "项目竞争较低，批准率高"
  timeline_efficiency:
    weight: 0.25
    description: "从现在到获得PR的总时间效率（申请人要求1年内）"
    sub_dimensions:
      total_duration:
        description: "预计总耗时（含准备+申请+审批）"
        anchors:
          60: "总耗时超过2年，不满足申请人within_1_year的时间要求"
          80: "总耗时12-18个月，基本满足时间要求"
          90: "总耗时12个月以内，完全满足时间要求"
      critical_path:
        description: "关键路径上是否有不必要的串行等待"
        anchors:
          60: "语言考试、ECA、PNP申请全部串行，浪费6+个月"
          80: "大部分可并行步骤已并行（如语言+ECA同时进行）"
          90: "关键路径完全优化，所有可并行步骤已并行"
  cost_efficiency:
    weight: 0.15
    description: "路径总成本相对于效果的性价比"
    sub_dimensions:
      total_cost:
        description: "申请费+考试费+中介费+生活成本等总费用（安家资金$30,000 CAD）"
        anchors:
          60: "总费用超过$30,000 CAD，超出申请人预算"
          80: "总费用在$10,000-20,000 CAD之间"
          90: "总费用低于$10,000 CAD"
      cost_risk_ratio:
        description: "在成功率不确定时投入的资金风险"
        anchors:
          60: "大量前期投入，但项目成功率不到60%"
          80: "投入合理，主路径成功率>75%"
          90: "低前期投入且高确定性，或有退费机制"
  quality_of_life:
    weight: 0.15
    description: "路径执行期间和定居后的生活质量（已婚有子女）"
    sub_dimensions:
      destination_match:
        description: "最终定居地与申请人偏好的匹配度（Ontario/BC/Alberta）"
        anchors:
          60: "目标省份不在Ontario/BC/Alberta中"
          80: "目标在偏好列表，但非首选（如Alberta而非Ontario）"
          90: "完全匹配首选省份，且有好的中学教育资源（申请人为子女教育移民）"
      career_continuity:
        description: "40岁机械工程师移民过程中职业发展的连续性"
        anchors:
          60: "需要读college或从事非机械工程工作（违反anti_pattern）"
          80: "短期过渡期后可在加拿大从事工程相关工作"
          90: "全程可在机械工程领域工作，无职业中断"
  plan_robustness:
    weight: 0.15
    description: "路径对政策变化和不确定性的韧性"
    sub_dimensions:
      backup_options:
        description: "如果主路径受阻是否有备选方案"
        anchors:
          60: "单一路径（如仅依赖Ontario PNP），无任何备选"
          80: "有1个可行备选方案（如主选Ontario PNP + 备选Alberta PNP）"
          90: "有2+个备选方案，覆盖不同省份和项目类别，且切换成本低"
      policy_sensitivity:
        description: "路径对政策变动的敏感度"
        anchors:
          60: "严重依赖特定试点项目或定向抽签类别"
          80: "依赖成熟稳定的PNP项目"
          90: "基于多年不变的核心项目（Express Entry + 成熟PNP），抗政策风险"

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
    - rule: "路径与申请人明确的anti_patterns冲突（如要求读college或做非本专业工作）"
      penalty: -15
    - rule: "40岁大龄申请人依赖一般Express Entry抽签（CRS 283远低于500+分数线）"
      penalty: -20
  max_penalty_per_dimension: -25

rewards:
  eligibility:
    - rule: "申请人各项指标远超目标项目最低要求"
      reward: 5
    - rule: "通过PNP+CRS提升使总分远超分数线"
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
    - rule: "目标省份完全匹配申请人首选且有优质中学教育"
      reward: 3
    - rule: "移民过程中无需中断机械工程职业发展"
      reward: 5
    - rule: "路径考虑了配偶和子女教育需求"
      reward: 3
  max_reward_per_dimension: 15`;

const PATHWAY_MD = `---
applicant: "张明"
target: "Canadian Permanent Residency"
primary_program: "Ontario PNP - Human Capital Priorities (via Express Entry)"
backup_program: "Alberta PNP - Alberta Express Entry Stream"
crs_estimate: 283
crs_with_pnp: 883
total_duration_months: 12
total_cost_cad: 18500
generated_at: "2026-03-25"
---

# 张明 — 加拿大永久居留权路径规划

## 核心挑战

| 因素 | 现状 | 影响 |
|------|------|------|
| 年龄 | 40岁 | CRS年龄分仅45（已婚满分100），每年继续下降 |
| CRS总分 | 283 | 远低于一般抽签线500+，**必须走PNP路线** |
| 语言 | CLB 7-8 | 满足大部分项目最低要求，但提分空间大 |
| 工作经验 | 海外15年 | 优势：丰富经验；劣势：无加拿大经验 |
| 教育 | 本科 | 中等，已完成ECA |
| 家庭 | 已婚有子女 | 配偶CLB较低，影响配偶加分 |

## 策略总结

**主路线**: Ontario PNP 人力资本优先 → Express Entry → PR
**备选A**: Alberta PNP Express Entry类别
**备选B**: BC PNP 技术工人类别（需先获得BC省雇主offer）
**CRS提分**: 重考IELTS冲CLB 9+ (预计+20-30分) + 考法语TEF冲CLB 7 (预计+50分)

## 步骤总览

| 步骤 | 行动 | 时间线 | 费用 (CAD) | 状态 | 并行 |
|------|------|--------|------------|------|------|
| 1 | 重考IELTS（冲7.5+各项） | 2026-04 ~ 2026-06 (2月) | $400 | 待开始 | 与步骤2并行 |
| 2 | 考法语TEF（冲CLB 7） | 2026-04 ~ 2026-07 (3月) | $500 | 待开始 | 与步骤1并行 |
| 3 | 创建Express Entry档案 | 2026-07 (完成语言后) | $0 | 待开始 | - |
| 4 | 申请Ontario PNP 人力资本优先 | 2026-07 ~ 2026-10 (3月) | $1,500 | 待开始 | 同时申请Alberta PNP |
| 5 | 申请Alberta PNP Express Entry | 2026-07 ~ 2026-10 (3月) | $500 | 待开始 | 与步骤4并行 |
| 6 | 获得省提名 (CRS +600) | 2026-10 | $0 | 待开始 | - |
| 7 | 收到ITA，提交PR申请 | 2026-10 ~ 2026-11 (1月) | $2,350 | 待开始 | - |
| 8 | 体检 + 无犯罪证明 | 2026-08 ~ 2026-09 | $1,200 | 待开始 | 与步骤4-5并行提前准备 |
| 9 | 生物采集 | 2026-11 | $170 | 待开始 | - |
| 10 | PR审批 + 登陆 | 2026-11 ~ 2027-03 (4月) | $1,000 | 待开始 | - |

**预计总时长**: 12个月 (2026-04 ~ 2027-03)
**预计总费用**: $7,620 CAD (不含安家资金)

---

## 详细步骤

### 步骤 1: 重考IELTS（冲7.5+各项）

**目标**: 将CLB从7-8提升到9-10，CRS语言分从76提升到约110+

**理由**:
- 当前最低CLB 7（Writing/Speaking 6.0），每提高一个CLB等级约+4-8 CRS分
- IELTS 7.5各项 = CLB 10，语言分可从76提升到128（+52分）
- 这是40岁申请人ROI最高的提分方式（2个月备考 → 50+分提升）

**当前状态**: IELTS R6.5/W6.0/L6.5/S6.0 → CLB R8/W7/L8/S7

**CRS影响**: +30~52分（取决于最终成绩）

**时间线**:
- 2026-04: 报名IELTS，开始备考（重点Writing和Speaking）
- 2026-05: 模考 + 调整
- 2026-06: 正式考试

**费用**:
- IELTS考试费: $400

**风险**:
- Writing/Speaking提分难度较大
- 缓解: 如6月成绩不理想，7月再考一次（$400追加费用）

---

### 步骤 2: 考法语TEF（冲CLB 7）

**目标**: 获得法语CLB 7+，解锁双语加分（CRS +25~50分）

**理由**:
- 法语CLB 7各项 + 英语CLB 5+ = CRS额外+50分
- 即使只达到法语CLB 7部分科目，也有+25分
- 对40岁大龄申请人来说，这50分可能是决定性的

**当前状态**: 无法语成绩

**CRS影响**: +25~50分

**时间线**:
- 2026-04: 报名法语课程（线上密集班）
- 2026-05~06: 每天1-2小时学习
- 2026-07: 参加TEF考试

**费用**:
- TEF考试费: $350
- 法语课程: $150（线上）

**风险**:
- 3个月从零到CLB 7难度非常大
- 缓解: 即使达不到CLB 7，CLB 5也有部分加分；可以延后到2026-09再考

---

### 步骤 3: 创建Express Entry档案

**目标**: 进入Express Entry候选池

**时间线**: 2026-07（语言成绩出来后立即提交）

**费用**: $0

**注意事项**:
- 必须等IELTS新成绩出来后再创建/更新档案
- 如果法语TEF同时出成绩，一并提交
- ECA已完成，无需等待

---

### 步骤 4: 申请Ontario PNP 人力资本优先

**目标**: 获得Ontario省提名（CRS +600分）

**理由**:
- Ontario PNP HCP从Express Entry池中直接筛选候选人
- 要求: Express Entry档案中 + CRS满足Ontario的筛选线
- 机械工程NOC 21301属于Ontario需求职业
- Ontario是申请人首选省份，有优质中学教育资源

**资格检查**:
- ✅ Express Entry档案有效
- ✅ 工作经验满足要求（15年海外）
- ✅ 教育满足要求（本科+ECA）
- ✅ CLB 7+满足最低语言要求
- ✅ 安家资金充足

**时间线**:
- 2026-07: 创建Express Entry档案后，等待Ontario筛选
- 2026-07~10: Ontario定期从EE池中发出邀请
- 审批周期: 约60-90天

**费用**:
- Ontario PNP申请费: $1,500

**风险**:
- Ontario HCP竞争激烈，筛选分数线波动
- 缓解: 同时申请Alberta PNP（步骤5），哪个先邀请走哪个

---

### 步骤 5: 申请Alberta PNP Express Entry类别

**目标**: 备选省提名路线（CRS +600分）

**理由**:
- Alberta Express Entry Stream直接从EE池筛选
- 机械工程在Alberta石油行业有需求
- 处理时间较Ontario快
- 作为Ontario PNP的并行备选

**资格检查**:
- ✅ Express Entry档案有效
- ✅ CLB 5+满足最低语言要求
- ✅ 有Alberta需求的职业（机械工程）
- ✅ 安家资金充足

**时间线**:
- 2026-07: 提交Alberta AAIP EOI
- 2026-07~10: 等待邀请
- 审批周期: 约60-90天

**费用**:
- Alberta PNP申请费: $500

---

### 步骤 6: 获得省提名

**目标**: CRS +600分，确保下次Express Entry抽签被邀请

**预计CRS**: 283（基础）+ 30~50（语言提升）+ 50（法语加分）+ 600（PNP）= **963~983分**

**时间线**: 2026-10（预计）

---

### 步骤 7: 收到ITA，提交PR申请

**目标**: 提交完整的PR申请

**时间线**:
- 收到ITA后60天内提交所有材料
- 预计2026-10~11

**费用**:
- PR申请费（主申请人）: $850
- PR申请费（配偶）: $850
- 每个子女: $230
- RPRF（登陆费，每人）: $515 × 2 = $1,030
- 预计总计: ~$2,350（含一个子女）

---

### 步骤 8: 体检 + 无犯罪证明（提前准备）

**目标**: 提前完成耗时的背景检查材料

**时间线**:
- 2026-08: 全家预约指定体检医生（DMP）
- 2026-08: 申请中国无犯罪证明（公证处）
- 2026-09: 完成体检和证明

**费用**:
- 体检（3人）: $450 × 3 = $1,350（但可以等ITA后再做，此处取平均$1,200）
- 无犯罪证明（公证+翻译）: 约$200

**注意**: 体检有效期12个月，无犯罪证明有效期因国家而异

---

### 步骤 9: 生物采集

**费用**: $85 × 2 = $170（成人）

---

### 步骤 10: PR审批 + 登陆

**时间线**:
- Express Entry PR审批: 约4-6个月（IRCC目标6个月）
- 预计2027-01~03获批
- 登陆: 获批后尽快入境激活PR

**费用**:
- 机票（全家3人）: ~$5,000
- 初期安家: 从$30,000安家资金中支出

---

## 备选路径

### Plan B: BC PNP 技术工人类别

**触发条件**: Ontario和Alberta PNP均未在2026-10前发出邀请

**路线**:
1. 在BC找到机械工程相关雇主offer
2. 雇主支持BC PNP申请
3. BC PNP技术工人类别处理时间约2-3个月

**额外时间**: +3-6个月（找工作+申请）
**额外费用**: $1,150（BC PNP申请费）
**权衡**: 需要先找到雇主offer，但BC也在偏好省份列表中

### Plan C: STEM定向抽签

**触发条件**: PNP路线全部受阻

**路线**:
1. 机械工程NOC 21301属于STEM类别
2. STEM定向抽签分数线通常低于一般抽签（约480-500分）
3. 如果语言+法语提分后CRS达到330-380，加上定向抽签可能可行

**权衡**: 不确定性较大，分数线波动，但无需PNP

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| IELTS提分不理想 | 中 | 高 — 影响CRS和PNP竞争力 | 多次考试机会；Writing/Speaking报班 |
| 法语3个月达不到CLB 7 | 高 | 中 — 失去50分加分 | 接受CLB 5（+部分加分）；延后补考 |
| Ontario PNP不发邀请 | 中 | 高 — 主路径受阻 | 并行申请Alberta PNP；BC PNP备选 |
| 年龄继续扣分（41岁） | 确定 | 低 — 每年约-5~10分 | 尽快行动，2026年内完成申请 |
| 政策变化（PNP规则调整） | 低 | 高 — 可能影响资格 | 多省并行；关注政策动态 |
| 配偶语言不够无法加分 | 高 | 低 — 配偶IELTS 5.5仅少量加分 | 配偶提升语言非关键路径 |

---

## 时间线甘特图

\`\`\`
2026-04  ████ IELTS备考 + 法语学习开始
2026-05  ████ 继续备考
2026-06  ██── IELTS考试
2026-07  ██── TEF考试 → 创建EE档案 → 申请Ontario/Alberta PNP
2026-08  ████ 体检+无犯罪证明（并行）
2026-09  ──── 等待PNP审批
2026-10  ██── 获得省提名 → 收到ITA
2026-11  ████ 提交PR申请 + 生物采集
2026-12  ──── PR审批中
2027-01  ──── PR审批中
2027-02  ──── PR审批中
2027-03  ██── PR获批 → 登陆
\`\`\`

## 总费用明细

| 项目 | 费用 (CAD) |
|------|-----------|
| IELTS考试 | $400 |
| TEF考试 + 法语课程 | $500 |
| Ontario PNP申请费 | $1,500 |
| Alberta PNP申请费 | $500 |
| PR申请费（全家） | $2,350 |
| RPRF登陆费 | $1,030 |
| 体检（全家） | $1,200 |
| 无犯罪证明 | $200 |
| 生物采集 | $170 |
| 机票（全家） | $5,000 |
| **小计（不含安家资金）** | **$12,850** |
| 安家资金（已有） | $30,000 |
`;

async function main() {
  setLanguage('zh');
  const config = loadConfig();
  if (!config.language) {
    config.language = 'zh';
    saveConfig(config);
  }

  const profileYaml = generateProfileYaml(answers);
  const profile = parseProfileYaml(profileYaml);
  const crs = calculateCRS(profile);

  console.log(chalk.bold.cyan(`\n  ┌─────────────────────────────────────────┐`));
  console.log(chalk.bold.cyan(`  │  边缘情况：40岁大龄申请人               │`));
  console.log(chalk.bold.cyan(`  └─────────────────────────────────────────┘\n`));

  console.log(`  姓名: ${chalk.bold(profile.personal.name)}`);
  console.log(`  年龄: ${chalk.bold.red(String(profile.personal.age))}`);
  console.log(`  CRS:  ${chalk.bold.yellow(String(crs.total))}`);

  const programs = Object.values(SEED_PROGRAMS);
  const eligible = programs.filter(p => checkEligibility(profile, p).eligible);
  console.log(`  合格: ${chalk.green(String(eligible.length))}/${programs.length} 项目\n`);

  const programMd = generateProgram(profile, config);
  const programsDbJson = JSON.stringify(SEED_PROGRAMS, null, 2);

  const dirName = 'daling-40-edge-case';
  const projectDir = path.resolve(dirName);
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }

  await scaffoldPathway(projectDir, {
    profile: profileYaml,
    rubrics: RUBRICS_YAML,
    pathway: PATHWAY_MD,
    program: programMd,
    programsDb: programsDbJson,
  });

  console.log(chalk.green.bold(`  项目创建完成: ${dirName}/\n`));
  console.log(`  下一步:`);
  console.log(`    cd ${dirName}`);
  console.log(`    node ../dist/cli.js run --headless --yolo\n`);
}

main().catch(err => {
  console.error(chalk.red(`\n  Error: ${err.message}\n`));
  process.exit(1);
});
