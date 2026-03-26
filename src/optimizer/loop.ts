import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { simpleGit } from 'simple-git';
import type { LLMProvider } from '../llm/provider.js';
import type { ApplicantProfile, Rubrics, ProgramsDB, IterationLog } from '../data/schemas.js';
import { calculateCRS } from '../crs/calculator.js';
import { Scorer } from '../scoring/scorer.js';
import { pickMutationType, generateMutation } from './mutations.js';
import { appendResult, getLastBestScore } from './logger.js';

export interface LoopOptions {
  provider: LLMProvider;
  pathwayDir: string;
  recalibrationInterval?: number;
  onIteration?: (log: IterationLog) => void;
}

export async function runOptimizationLoop(options: LoopOptions): Promise<void> {
  const {
    provider,
    pathwayDir,
    recalibrationInterval = 10,
    onIteration,
  } = options;

  const git = simpleGit(pathwayDir);
  const resultsPath = path.join(pathwayDir, 'results.tsv');
  const profilePath = path.join(pathwayDir, 'profile.yaml');
  const rubricsPath = path.join(pathwayDir, 'rubrics.yaml');
  const pathwayPath = path.join(pathwayDir, 'pathway.md');
  const dbPath = path.join(pathwayDir, 'programs_db.json');

  const profile = yaml.load(fs.readFileSync(profilePath, 'utf-8')) as ApplicantProfile;
  const rubrics = yaml.load(fs.readFileSync(rubricsPath, 'utf-8')) as Rubrics;
  const scorer = new Scorer(provider);

  const crs = calculateCRS(profile);
  console.log(`  CRS Estimate: ${crs.total}`);

  const lastBest = getLastBestScore(resultsPath);
  let currentScore: number;
  let iteration: number;

  if (lastBest) {
    currentScore = lastBest.score;
    iteration = lastBest.iteration + 1;
    console.log(`  Resuming from iteration ${iteration} (score: ${currentScore.toFixed(2)})`);
  } else {
    console.log('  Scoring baseline...');
    const pathwayContent = fs.readFileSync(pathwayPath, 'utf-8');
    const programsDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8')) as ProgramsDB;
    const baselineResult = await scorer.scoreAbsolute(pathwayContent, programsDb, profile, rubrics, crs);
    currentScore = baselineResult.composite_score;

    fs.writeFileSync(path.join(pathwayDir, 'score.json'), JSON.stringify(baselineResult, null, 2));

    const log: IterationLog = {
      iteration: 0,
      commit: (await git.revparse(['HEAD'])).trim(),
      score_before: 0,
      score_after: currentScore,
      delta: currentScore,
      status: 'keep',
      mutation_type: 'RESEARCH',
      description: 'baseline scored',
    };
    appendResult(resultsPath, log);
    onIteration?.(log);

    console.log(`  Baseline score: ${currentScore.toFixed(2)}/100`);
    iteration = 1;
  }

  let consecutiveDiscards = 0;
  console.log('  Starting optimization loop (Ctrl+C to stop)');
  console.log(`  Score: ${currentScore.toFixed(2)}/100\n`);

  let running = true;
  const shutdown = () => {
    running = false;
    console.log('\n  Stopping after current iteration...');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    const pathwayContent = fs.readFileSync(pathwayPath, 'utf-8');
    let programsDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8')) as ProgramsDB;

    const mutationType = pickMutationType(iteration, consecutiveDiscards);

    try {
      process.stdout.write(`  [${iteration}] ${mutationType} — generating mutation...`);
      const mutation = await generateMutation(
        provider,
        mutationType,
        pathwayContent,
        profile,
        programsDb,
      );
      process.stdout.write('\r\x1b[K');

      fs.writeFileSync(pathwayPath, mutation.newPathwayContent);
      await git.add('pathway.md');

      if (mutation.new_programs && mutation.new_programs.length > 0) {
        for (const prog of mutation.new_programs) {
          programsDb[prog.id] = prog;
        }
        fs.writeFileSync(dbPath, JSON.stringify(programsDb, null, 2));
        await git.add('programs_db.json');
      }

      await git.commit(`${mutationType}: ${mutation.description}`);
      const commitHash = (await git.revparse(['HEAD'])).trim().substring(0, 7);

      let scoreAfter: number;
      let verdict: string;

      const isRecalibration = iteration % recalibrationInterval === 0;
      process.stdout.write(`  [${iteration}] ${mutationType} — scoring (${isRecalibration ? 'absolute' : 'comparative'})...`);

      if (isRecalibration) {
        const result = await scorer.scoreAbsolute(
          mutation.newPathwayContent,
          programsDb,
          profile,
          rubrics,
          crs,
          () => {},
        );
        scoreAfter = result.composite_score;
        verdict = scoreAfter > currentScore ? 'better' : scoreAfter < currentScore ? 'worse' : 'neutral';
        fs.writeFileSync(path.join(pathwayDir, 'score.json'), JSON.stringify(result, null, 2));
      } else {
        const result = await scorer.scoreComparative(
          pathwayContent,
          mutation.newPathwayContent,
          mutation.description,
          rubrics,
          () => {},
        );
        scoreAfter = currentScore + result.composite_delta;
        verdict = result.verdict;
      }
      process.stdout.write('\r\x1b[K');

      const delta = scoreAfter - currentScore;
      const status = verdict === 'better' ? 'keep' as const : 'discard' as const;

      if (status === 'keep') {
        currentScore = scoreAfter;
        consecutiveDiscards = 0;
      } else {
        await git.reset(['--hard', 'HEAD~1']);
        consecutiveDiscards++;
      }

      const iterLog: IterationLog = {
        iteration,
        commit: commitHash,
        score_before: currentScore - (status === 'keep' ? delta : 0),
        score_after: scoreAfter,
        delta,
        status,
        mutation_type: mutationType,
        description: mutation.description,
      };

      appendResult(resultsPath, iterLog);
      onIteration?.(iterLog);

      const statusIcon = status === 'keep' ? '\x1b[32m\u2713\x1b[0m' : '\x1b[31m\u2717\x1b[0m';
      const deltaStr = delta >= 0 ? `\x1b[32m+${delta.toFixed(2)}\x1b[0m` : `\x1b[31m${delta.toFixed(2)}\x1b[0m`;
      const scoreStr = `\x1b[1m${currentScore.toFixed(2)}\x1b[0m`;
      console.log(`  [${iteration}] ${statusIcon} ${mutationType.padEnd(16)} ${deltaStr}  ${scoreStr}  ${mutation.description.substring(0, 50)}`);

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.log(`  [${iteration}] ERROR: ${errMsg} -- reverting`);
      try {
        await git.reset(['--hard', 'HEAD']);
      } catch { /* ignore */ }
      consecutiveDiscards++;
    }

    iteration++;
  }

  process.removeListener('SIGINT', shutdown);
  process.removeListener('SIGTERM', shutdown);
  console.log(`\n  Stopped at iteration ${iteration - 1}. Best score: ${currentScore.toFixed(2)}/100\n`);
}
