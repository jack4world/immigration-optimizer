#!/usr/bin/env npx tsx
/**
 * Non-interactive init for edge case: 40-year-old applicant
 * Usage: npx tsx scripts/init-edge-case.ts
 */
import { generateProfileYaml, parseProfileYaml, type InitAnswers } from '../src/generators/constraints.js';
import { generateRubrics } from '../src/generators/rubrics.js';
import { generatePathway } from '../src/generators/plan.js';
import { generateProgram } from '../src/generators/program.js';
import { scaffoldPathway } from '../src/data/pathway.js';
import { loadConfig, saveConfig } from '../src/data/config.js';
import { calculateCRS } from '../src/crs/calculator.js';
import { ieltsToClb } from '../src/crs/calculator.js';
import { checkEligibility } from '../src/crs/eligibility.js';
import { SEED_PROGRAMS } from '../src/data/seed-programs.js';
import { createProvider } from '../src/llm/factory.js';
import { setLanguage } from '../src/i18n.js';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';

// ===== 边缘情况：40岁大龄申请人 =====
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
  // IELTS 6.5 各项 → CLB 8
  english_reading: ieltsToClb(6.5),   // CLB 8
  english_writing: ieltsToClb(6.0),   // CLB 7
  english_listening: ieltsToClb(6.5), // CLB 8
  english_speaking: ieltsToClb(6.0),  // CLB 7
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
  console.log(`  年龄: ${chalk.bold.red(String(profile.personal.age))} (CRS 年龄扣分严重)`);
  console.log(`  CRS:  ${chalk.bold.yellow(String(crs.total))}`);
  console.log(`  年龄分: ${crs.details.age} (满分110→已婚100)`);
  console.log(`  教育分: ${crs.details.education}`);
  console.log(`  语言分: ${crs.details.first_language} (最低CLB 7)`);
  console.log(`  加拿大经验: ${crs.details.canadian_experience}`);
  console.log(`  技能转移: ${crs.skill_transferability}`);
  console.log(`  额外加分: ${crs.additional_points}\n`);

  // Eligibility check
  const programs = Object.values(SEED_PROGRAMS);
  const eligible = programs.filter(p => checkEligibility(profile, p).eligible);
  const close = programs.filter(p => {
    const r = checkEligibility(profile, p);
    return !r.eligible && r.close.length > 0;
  });
  console.log(`  合格项目: ${chalk.green(String(eligible.length))}/${programs.length}`);
  console.log(`  接近合格: ${chalk.yellow(String(close.length))}`);

  for (const p of eligible.slice(0, 5)) {
    const r = checkEligibility(profile, p);
    console.log(`    ${chalk.green('✓')} ${p.name_zh} (${r.score}%)`);
  }
  for (const p of close.slice(0, 3)) {
    const r = checkEligibility(profile, p);
    console.log(`    ${chalk.yellow('~')} ${p.name_zh}: ${r.close.join(', ')}`);
  }

  const provider = createProvider(config);

  console.log(chalk.dim(`\n  生成评分标准...`));
  const rubricsYaml = await generateRubrics(provider, profile, crs);

  console.log(chalk.dim(`  生成初始路径...`));
  const pathwayMd = await generatePathway(provider, profile, crs, SEED_PROGRAMS);

  const programMd = generateProgram(profile, config);
  const programsDbJson = JSON.stringify(SEED_PROGRAMS, null, 2);

  const dirName = 'daling-40-edge-case';
  const projectDir = path.resolve(dirName);

  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }

  console.log(chalk.dim(`  创建项目...`));
  await scaffoldPathway(projectDir, {
    profile: profileYaml,
    rubrics: rubricsYaml,
    pathway: pathwayMd,
    program: programMd,
    programsDb: programsDbJson,
  });

  console.log(chalk.green.bold(`\n  ✓ 项目创建完成: ${dirName}/\n`));
  console.log(`  ${chalk.bold('下一步:')}`);
  console.log(`    cd ${dirName}`);
  console.log(`    node ../dist/cli.js run --headless --yolo`);
  console.log();
}

main().catch(err => {
  console.error(chalk.red(`\n  Error: ${err.message}\n`));
  process.exit(1);
});
