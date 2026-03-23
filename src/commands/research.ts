import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import yaml from 'js-yaml';
import { simpleGit } from 'simple-git';
import { loadConfig } from '../data/config.js';
import { createProvider } from '../llm/factory.js';
import { researchPrograms, mergeProgramsDb } from '../research/researcher.js';
import type { ApplicantProfile, ProgramsDB } from '../data/schemas.js';

export async function researchCommand(): Promise<void> {
  const cwd = process.cwd();

  if (!fs.existsSync(path.join(cwd, 'profile.yaml'))) {
    console.log(chalk.red('\n  Not in an immigration project directory.\n'));
    process.exit(1);
  }

  const config = loadConfig();
  const provider = createProvider(config);

  const profile = yaml.load(fs.readFileSync(path.join(cwd, 'profile.yaml'), 'utf-8')) as ApplicantProfile;
  const dbPath = path.join(cwd, 'programs_db.json');
  let programsDb: ProgramsDB = {};
  if (fs.existsSync(dbPath)) {
    programsDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  }

  const existing = Object.keys(programsDb).length;
  console.log(chalk.bold(`\n  Researching immigration programs (${existing} already in database)...\n`));

  const spinner = ora('Researching programs...').start();
  const newPrograms = await researchPrograms(provider, profile, programsDb);
  spinner.succeed(`Found ${newPrograms.length} new programs`);

  const merged = mergeProgramsDb(programsDb, newPrograms);
  fs.writeFileSync(dbPath, JSON.stringify(merged, null, 2));

  const git = simpleGit(cwd);
  try {
    await git.add('programs_db.json');
    await git.commit(`research: added ${newPrograms.length} programs to database`);
    console.log(chalk.green('\n  Database updated and committed.\n'));
  } catch {
    console.log(chalk.dim('\n  Database updated (no git changes to commit).\n'));
  }

  console.log(chalk.bold(`  Programs database: ${Object.keys(merged).length} total`));
  for (const prog of newPrograms) {
    console.log(`    + ${prog.name_zh || prog.name} (${prog.category})`);
  }
  console.log();
}
