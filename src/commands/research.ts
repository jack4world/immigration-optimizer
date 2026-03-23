import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { simpleGit } from 'simple-git';
import { loadConfig } from '../data/config.js';
import { createProvider } from '../llm/factory.js';
import { researchAllPrograms, mergeProgramsDb } from '../research/researcher.js';
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
  console.log(chalk.bold(`\n  Comprehensive immigration program research (${existing} already in database)\n`));

  const newPrograms = await researchAllPrograms(provider, profile, programsDb, (msg) => console.log(msg), config);

  const merged = mergeProgramsDb(programsDb, newPrograms);
  fs.writeFileSync(dbPath, JSON.stringify(merged, null, 2));

  const git = simpleGit(cwd);
  try {
    await git.add('programs_db.json');
    await git.commit(`research: comprehensive scan, added ${newPrograms.length} programs (${Object.keys(merged).length} total)`);
    console.log(chalk.green('\n  Database updated and committed.'));
  } catch {
    console.log(chalk.dim('\n  Database updated (no git changes to commit).'));
  }

  // Summary by province
  const byProvince: Record<string, string[]> = {};
  for (const prog of Object.values(merged)) {
    const prov = prog.province || 'Federal';
    if (!byProvince[prov]) byProvince[prov] = [];
    byProvince[prov].push(prog.name_zh || prog.name);
  }

  console.log(chalk.bold(`\n  Programs database: ${Object.keys(merged).length} total\n`));
  for (const [prov, names] of Object.entries(byProvince).sort()) {
    console.log(chalk.bold(`  ${prov} (${names.length}):`));
    for (const name of names) {
      console.log(`    - ${name}`);
    }
  }

  const added = newPrograms.length;
  if (added > 0) {
    console.log(chalk.green(`\n  + ${added} new programs added this session`));
  }
  console.log();
}
