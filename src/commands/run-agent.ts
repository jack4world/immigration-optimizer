import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { generateProgram } from '../generators/program.js';
import { loadConfig } from '../data/config.js';
import { calculateCRS } from '../crs/calculator.js';
import { checkEligibility } from '../crs/eligibility.js';
import type { ApplicantProfile, ProgramsDB } from '../data/schemas.js';

export async function launchAgent(pathwayDir: string, options: { safe?: boolean; headless?: boolean }): Promise<void> {
  try {
    execSync('which claude', { stdio: 'ignore' });
  } catch {
    console.log(chalk.red('\n  Claude Code CLI not found.'));
    console.log(chalk.red('  Install: https://docs.anthropic.com/en/docs/claude-code\n'));
    process.exit(1);
  }

  const profilePath = path.join(pathwayDir, 'profile.yaml');
  if (!fs.existsSync(profilePath)) {
    console.log(chalk.red('\n  Not in an immigration project directory (no profile.yaml found).\n'));
    process.exit(1);
  }

  const profile = yaml.load(fs.readFileSync(profilePath, 'utf-8')) as ApplicantProfile;
  const config = loadConfig();
  const crs = calculateCRS(profile);

  // Show pre-launch summary
  console.log(chalk.bold.cyan(`\n  ┌─────────────────────────────────────────┐`));
  console.log(chalk.bold.cyan(`  │  Immigration Optimizer — Agent Mode     │`));
  console.log(chalk.bold.cyan(`  └─────────────────────────────────────────┘\n`));

  console.log(`  Applicant: ${chalk.bold(profile.personal.name)}`);
  console.log(`  CRS:       ${chalk.bold.yellow(String(crs.total))}`);
  console.log(`  Target:    ${profile.preferences.target_provinces.join(', ')}`);
  console.log(`  Timeline:  ${profile.preferences.timeline_urgency}`);

  // Eligibility summary
  const dbPath = path.join(pathwayDir, 'programs_db.json');
  if (fs.existsSync(dbPath)) {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8')) as ProgramsDB;
    const programs = Object.values(db);
    const eligible = programs.filter(p => checkEligibility(profile, p).eligible);
    console.log(`  Eligible:  ${chalk.green(`${eligible.length}`)}/${programs.length} programs`);
  }

  // Generate program.md
  const programContent = generateProgram(profile, config);
  const programPath = path.join(pathwayDir, 'program.md');
  fs.writeFileSync(programPath, programContent);
  console.log(`  Program:   ${chalk.green('program.md generated')}`);

  const args: string[] = [];
  if (!options.safe) {
    args.push('--dangerously-skip-permissions');
  }

  const mode = options.safe ? 'safe' : 'yolo';
  console.log(`  Mode:      ${mode === 'yolo' ? chalk.yellow(mode) : chalk.green(mode)}`);

  if (options.headless) {
    const prompt = [
      'Read program.md carefully — it contains the applicant profile, CRS analysis, scoring system, and optimization instructions.',
      'Begin the optimization loop:',
      '1. First run a research sprint to verify program data',
      '2. Then enter the mutation loop — mutate, score, keep/discard',
      '3. Log every iteration to results.tsv',
      '4. Run until interrupted',
    ].join(' ');

    args.push('-p', prompt);
    console.log(chalk.bold(`\n  Launching headless...\n`));

    const child = spawn('claude', args, {
      cwd: pathwayDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (data: Buffer) => { process.stdout.write(data); });
    child.stderr?.on('data', (data: Buffer) => { process.stderr.write(data); });

    return new Promise<void>((resolve) => {
      child.on('close', (code) => {
        const msg = code === 0 || code === null ? 'Agent exited cleanly.' : `Agent exited with code ${code}.`;
        console.log((code === 0 || code === null ? chalk.green : chalk.yellow)(`\n  ${msg}\n`));
        resolve();
      });
      child.on('error', (err) => {
        console.log(chalk.red(`\n  Failed to launch Claude Code: ${err.message}\n`));
        resolve();
      });
    });
  }

  // Interactive mode
  console.log(chalk.bold(`\n  Launching interactive session...`));
  console.log(chalk.dim(`  Tell Claude: "Read program.md and start optimizing"`));
  console.log(chalk.dim(`  Monitor in another terminal: immigration-optimizer dashboard --watch\n`));

  const child = spawn('claude', args, {
    cwd: pathwayDir,
    stdio: 'inherit',
  });

  return new Promise<void>((resolve) => {
    child.on('close', (code) => {
      const msg = code === 0 || code === null ? 'Agent session ended.' : `Agent exited with code ${code}.`;
      console.log((code === 0 || code === null ? chalk.green : chalk.yellow)(`\n  ${msg}\n`));
      resolve();
    });
    child.on('error', (err) => {
      console.log(chalk.red(`\n  Failed to launch Claude Code: ${err.message}\n`));
      resolve();
    });
  });
}
