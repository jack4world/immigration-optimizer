# immigration-optimizer Agent Instructions

## Setup
1. Read `profile.yaml` — applicant background and preferences
2. Read `pathway.md` — current immigration plan (being optimized)
3. Read `programs_db.json` — immigration programs database
4. Read `rubrics.yaml` — scoring criteria (dimensions + penalties + rewards)
5. Score the baseline: `npx tsx src/cli.ts score`
6. Review score.json for dimension breakdown, penalties, and rewards
7. Begin optimization

## Applicant Summary
- **张明** | Chinese | Age 40 | married
- **Mechanical Engineer** (NOC 21301, TEER 1)
- Education: bachelors in Mechanical Engineering
- Foreign work: 15yr | Canadian work: 0yr
- English: CLB R8/W7/L8/S7
- French: None
- Settlement: $30000 CAD
- Target: Ontario, British Columbia, Alberta
- Timeline: within_1_year
- Risk: medium

## CRS 分析

当前 CRS: **283** 分
- 年龄: 45 (40岁)
- 教育: 112 (bachelors)
- 第一语言: 76 (最低CLB 7)
- 加拿大经验: 0 (0年)
- 技能转移: 50
- 额外加分: 0


### CRS 提分策略（按投入产出比排序）
1. **重考语言** — 当前最低CLB 7，提升到CLB 10可增加约 12-24 分
2. **考法语TEF/TCF** — CLB 7+ 可加 25-50 分（双语加分）
3. **加拿大教育证书** — 短期课程可加 15-30 分

### 关键提醒
CRS 283 分低于近期全类别抽签线（~500+），建议:
- 优先考虑PNP路线（省提名 +600 分，确保被邀请）
- 或通过定向抽签（STEM、法语、医疗等类别邀请分数更低）

## 评分系统

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
在项目目录中运行: `npx tsx src/cli.ts score`
查看实时仪表盘: `npx tsx src/cli.ts dashboard --watch`

## 输出语言
所有输出（pathway.md、programs_db.json、commit messages）使用简体中文。

## Phase 1: Research Sprint

Research immigration programs and verify latest policy data:

### 研究来源（按优先级排序）


1. **LLM 知识**（主要来源）：
   - 使用训练数据获取移民项目信息
   - 标记来源为 "llm_knowledge"
   - 注意：政策可能已变更

### Research Checklist
- [ ] Latest Express Entry draw scores (last 3 months)
- [ ] Processing times for target programs
- [ ] PNP draw scores for target provinces
- [ ] NOC 21301 demand by province
- [ ] Any new pilot programs or policy changes
- [ ] Verify all programs in programs_db.json are still active
- [ ] ALL PNP streams per province (not just 1 — each province has 3-8 streams)
- [ ] Entrepreneur, graduate, rural, tech, and skilled worker streams per province

### Comprehensive Research Command
Run `npx tsx src/cli.ts research` to trigger a full province-by-province scan.
Tip: Configure web search for real-time verification:
  ${cliCmd} config set search_api.provider tavily
  ${cliCmd} config set search_api.api_key <key>

After researching, update `programs_db.json` with new programs and change `source` from "llm_knowledge" to "web_research" or "ircc_official" for verified data.
Git commit: `research: verified [N] programs, added [N] new`

## Phase 2: Optimization Loop

Maximum iterations: **50**

```
FOR iteration = 1 to 50:

1. Pick mutation type (rotate: SWAP_PROGRAM → ADD_CREDENTIAL → REORDER_STEPS → ADD_PARALLEL → SWITCH_PROVINCE)
   If 5+ consecutive discards → RESEARCH

2. Make ONE change to pathway.md
3. Git commit: "[MUTATION_TYPE]: [specific description]"
4. Score: `npx tsx src/cli.ts score`
   (Read score.json for detailed breakdown)
5. If score improved → keep the commit
6. If score equal or worse → git reset --hard HEAD~1
7. Append to results.tsv using actual TAB characters (not spaces) between fields:
   iteration	commit	score_before	score_after	delta	status	mutation_type	description
8. Stop after iteration 50 or when interrupted
```

### Baseline (iteration 0)
Before entering the loop, score the initial pathway.md and write iteration 0 to results.tsv:
`0	<commit>	0.00	<score>	+<score>	keep	RESEARCH	baseline scored`

## 变异策略指南

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
- 比较各省 PNP 对此 NOC(21301) 的需求
- 考虑: 分数线、处理时间、费用、生活成本
- 如果当前省策略最优，添加备选省作为 Plan B
- 申请人愿意搬到非首选省份

### RESEARCH — 研究新项目
- 触发条件: 连续5次丢弃
- 搜索最新联邦试点项目、新开的PNP类别
- 验证现有项目数据是否过期
- 添加到 programs_db.json，然后尝试 SWAP

## Applicant Constraints (DO NOT violate)

Things to avoid:
- 不愿意读college换身份
- 不愿意做非本专业工作
- Risk tolerance: medium
- Timeline: within_1_year
- NOT willing to study as immigration pathway


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
- Use `npx tsx src/cli.ts status` to check progress
- Use `npx tsx src/cli.ts dashboard` for full overview
