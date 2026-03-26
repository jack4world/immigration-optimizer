import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { loadConfig } from '../data/config.js';
import { createProvider } from '../llm/factory.js';
import { Scorer } from '../scoring/scorer.js';
import { calculateCRS } from '../crs/calculator.js';
import type { Rubrics, ApplicantProfile, ProgramsDB } from '../data/schemas.js';

export async function scoreCommand(): Promise<void> {
  const cwd = process.cwd();

  if (!fs.existsSync(path.join(cwd, 'profile.yaml'))) {
    console.log(chalk.red('\n  Not in an immigration project directory (no profile.yaml found).\n'));
    process.exit(1);
  }

  const config = loadConfig();

  const profile = yaml.load(fs.readFileSync(path.join(cwd, 'profile.yaml'), 'utf-8')) as ApplicantProfile;
  const rubrics = yaml.load(fs.readFileSync(path.join(cwd, 'rubrics.yaml'), 'utf-8')) as Rubrics;
  const pathwayContent = fs.readFileSync(path.join(cwd, 'pathway.md'), 'utf-8');

  let programsDb: ProgramsDB = {};
  const dbPath = path.join(cwd, 'programs_db.json');
  if (fs.existsSync(dbPath)) {
    programsDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  }

  const crs = calculateCRS(profile);
  console.log(chalk.bold(`\n  Scoring pathway (absolute mode)...`));
  console.log(`  CRS Estimate: ${crs.total}\n`);

  const provider = createProvider(config);
  const scorer = new Scorer(provider);
  const result = await scorer.scoreAbsolute(pathwayContent, programsDb, profile, rubrics, crs);

  fs.writeFileSync(path.join(cwd, 'score.json'), JSON.stringify(result, null, 2));

  console.log(chalk.bold(`\n  Composite Score: ${result.composite_score.toFixed(2)}/100\n`));

  console.log(chalk.bold('  Dimension Scores:'));
  for (const [dim, data] of Object.entries(result.components)) {
    const extras: string[] = [];
    if (data.penalty) extras.push(`penalty: ${data.penalty}`);
    if (data.reward) extras.push(chalk.green(`reward: +${data.reward}`));
    if (data.holistic_adjustment) extras.push(`holistic: ${data.holistic_adjustment > 0 ? '+' : ''}${data.holistic_adjustment}`);
    const extraStr = extras.length > 0 ? chalk.dim(` (${extras.join(', ')})`) : '';
    console.log(`    ${dim}: ${data.score.toFixed(1)} ${chalk.dim(`(w=${data.weight})`)}${extraStr}`);

    for (const [sd, info] of Object.entries(data.sub_dimensions)) {
      console.log(`      ${chalk.dim(sd)}: ${info.score.toFixed(0)} — ${chalk.dim(info.note)}`);
    }
  }

  if (result.penalties.length > 0) {
    console.log(chalk.bold(`\n  Adversarial Penalties (${result.penalties.length}):`));
    for (const p of result.penalties) {
      console.log(`    Step ${p.step}: ${p.issue} ${chalk.red(`(${p.penalty})`)}`);
    }
  }

  if (result.rewards.length > 0) {
    console.log(chalk.bold.green(`\n  Rewards (${result.rewards.length}):`));
    for (const r of result.rewards) {
      console.log(`    Step ${r.step}: ${r.reason} ${chalk.green(`(+${r.reward})`)}`);
    }
  }

  if (result.holistic_adjustments.length > 0) {
    console.log(chalk.bold(`\n  Holistic Adjustments (${result.holistic_adjustments.length}):`));
    for (const a of result.holistic_adjustments) {
      console.log(`    ${a.dimension}: ${a.adjustment > 0 ? '+' : ''}${a.adjustment} — ${a.reason}`);
    }
  }

  console.log(chalk.dim(`\n  Results written to score.json\n`));
}
