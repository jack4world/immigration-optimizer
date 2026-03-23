import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { readResults, getLastBestScore } from '../optimizer/logger.js';
import type { ApplicantProfile, ProgramsDB } from '../data/schemas.js';

export function statusCommand(): void {
  const cwd = process.cwd();

  if (!fs.existsSync(path.join(cwd, 'profile.yaml'))) {
    console.log(chalk.red('\n  Not in an immigration project directory.\n'));
    process.exit(1);
  }

  const profile = yaml.load(fs.readFileSync(path.join(cwd, 'profile.yaml'), 'utf-8')) as ApplicantProfile;
  const resultsPath = path.join(cwd, 'results.tsv');
  const results = readResults(resultsPath);

  if (results.length === 0) {
    console.log(chalk.yellow('\n  No optimization results yet. Run: immigration-optimizer run\n'));
    return;
  }

  const lastBest = getLastBestScore(resultsPath);
  const baseline = results[0]?.score_after || 0;
  const totalIterations = results[results.length - 1].iteration;
  const keeps = results.filter(r => r.status === 'keep').length;
  const last5 = results.slice(-5);

  let streak = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].status === results[results.length - 1].status) streak++;
    else break;
  }
  const streakType = results[results.length - 1].status;

  console.log(chalk.bold(`\n  ${profile.personal.name} — Immigration Pathway — iteration ${totalIterations}\n`));
  console.log(`  Score: ${chalk.bold(lastBest?.score.toFixed(2) || '?')}/100  (${baseline > 0 ? `+${(lastBest!.score - baseline).toFixed(1)} from baseline` : ''})`);
  console.log(`  Iterations: ${totalIterations} (${keeps} kept, ${totalIterations - keeps} discarded)`);
  console.log(`  Streak: ${streak} ${streakType}s in a row`);

  console.log(chalk.bold('\n  Last 5 mutations:'));
  for (const r of last5) {
    const icon = r.status === 'keep' ? chalk.green('\u2713') : chalk.red('\u2717');
    const d = isNaN(r.delta) ? 0 : r.delta;
    const delta = d >= 0 ? `+${d.toFixed(2)}` : d.toFixed(2);
    const mtype = (r.mutation_type || 'unknown').padEnd(16);
    const desc = (r.description || '').substring(0, 50);
    console.log(`    ${icon} ${mtype} ${desc}  ${delta}`);
  }

  const dbPath = path.join(cwd, 'programs_db.json');
  if (fs.existsSync(dbPath)) {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8')) as ProgramsDB;
    const programs = Object.values(db);
    if (programs.length > 0) {
      console.log(chalk.bold(`\n  Programs database: ${programs.length}`));
      const byCategory: Record<string, number> = {};
      for (const p of programs) {
        byCategory[p.category] = (byCategory[p.category] || 0) + 1;
      }
      for (const [cat, count] of Object.entries(byCategory)) {
        console.log(`    ${cat.padEnd(20)} ${count}`);
      }
    }
  }

  console.log();
}
