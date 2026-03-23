import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import yaml from 'js-yaml';
import type { ApplicantProfile } from '../data/schemas.js';
import { calculateCRS } from '../crs/calculator.js';

export function profileCommand(): void {
  const cwd = process.cwd();
  const profilePath = path.join(cwd, 'profile.yaml');

  if (!fs.existsSync(profilePath)) {
    console.log(chalk.red('\n  No profile.yaml found in current directory.\n'));
    process.exit(1);
  }

  const profile = yaml.load(fs.readFileSync(profilePath, 'utf-8')) as ApplicantProfile;
  const crs = calculateCRS(profile);

  console.log(chalk.bold('\n  Applicant Profile\n'));
  console.log(`  Name: ${profile.personal.name}`);
  console.log(`  Age: ${profile.personal.age} | Nationality: ${profile.personal.nationality}`);
  console.log(`  Marital: ${profile.personal.marital_status}`);

  console.log(chalk.bold('\n  Education'));
  console.log(`  ${profile.education.highest_degree} in ${profile.education.field_of_study}`);
  console.log(`  ${profile.education.institution} (${profile.education.country}, ${profile.education.year_completed})`);
  console.log(`  ECA: ${profile.education.eca_completed ? chalk.green('Yes') : chalk.yellow('No')}`);

  console.log(chalk.bold('\n  Language'));
  if (profile.language.english) {
    const e = profile.language.english;
    console.log(`  English (CLB): R${e.reading} W${e.writing} L${e.listening} S${e.speaking}`);
  } else {
    console.log(`  English: ${chalk.yellow('No test')}`);
  }
  if (profile.language.french) {
    const f = profile.language.french;
    console.log(`  French (CLB): R${f.reading} W${f.writing} L${f.listening} S${f.speaking}`);
  }

  console.log(chalk.bold('\n  Work Experience'));
  console.log(`  ${profile.work_experience.current_occupation} (NOC ${profile.work_experience.noc_code}, TEER ${profile.work_experience.teer_category})`);
  console.log(`  Foreign: ${profile.work_experience.total_years_foreign}yr | Canadian: ${profile.work_experience.total_years_canadian}yr`);

  console.log(chalk.bold('\n  Finances'));
  console.log(`  Settlement funds: $${profile.finances.settlement_funds_cad} CAD`);

  console.log(chalk.bold('\n  CRS Estimate'));
  console.log(`  Total: ${chalk.bold.green(String(crs.total))}`);
  console.log(`  Age: ${crs.details.age} | Education: ${crs.details.education} | Language: ${crs.details.first_language}`);
  console.log(`  Canadian exp: ${crs.details.canadian_experience} | Skill transfer: ${crs.skill_transferability}`);

  console.log(chalk.bold('\n  Preferences'));
  console.log(`  Target: ${profile.preferences.target_provinces.join(', ')}`);
  console.log(`  Timeline: ${profile.preferences.timeline_urgency}`);
  console.log(`  Risk: ${profile.preferences.risk_tolerance}`);
  if (profile.preferences.anti_patterns.length > 0) {
    console.log(`  Avoid: ${profile.preferences.anti_patterns.join(', ')}`);
  }

  console.log();
}
