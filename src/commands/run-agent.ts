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
      'Read program.md for full instructions. Then execute this loop:',
      '',
      'SETUP: Read profile.yaml, pathway.md, programs_db.json, rubrics.yaml.',
      '',
      'SCORING: For each scoring pass, read rubrics.yaml dimensions and score pathway.md on each dimension (0-100).',
      'Write score.json with format: {"mode":"absolute","composite_score":N,"components":{"dim":{"score":N,"weight":N,"sub_dimensions":{"sub":{"score":N,"note":"..."}}},...},"penalties":[],"rewards":[],"holistic_adjustments":[],"scored_at":"ISO","model":"claude"}',
      '',
      'BASELINE: Score the initial pathway.md. Write iteration 0 to results.tsv:',
      '0\\t<commit>\\t0.00\\t<score>\\t+<score>\\tkeep\\tRESEARCH\\tbaseline scored',
      '',
      'LOOP: For each iteration N:',
      '1. Pick mutation type rotating: SWAP_PROGRAM, ADD_CREDENTIAL, REORDER_STEPS, ADD_PARALLEL, SWITCH_PROVINCE (or RESEARCH if 5+ discards)',
      '2. Generate ONE change to pathway.md',
      '3. git add pathway.md && git commit -m "<TYPE>: <description>"',
      '4. Score the new pathway',
      '5. If new score > old score: KEEP (update current score)',
      '6. If new score <= old score: git reset --hard HEAD~1',
      '7. Append tab-separated line to results.tsv: N\\t<commit>\\t<before>\\t<after>\\t<delta>\\t<keep|discard>\\t<TYPE>\\t<desc>',
      '8. Continue forever until interrupted',
      '',
      'IMPORTANT: Always append to results.tsv (do NOT overwrite). Always use tab separators. The dashboard reads this file.',
    ].join('\n');

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
