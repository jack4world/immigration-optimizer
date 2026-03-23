import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { readResults, getLastBestScore } from '../optimizer/logger.js';
import { calculateCRS } from '../crs/calculator.js';
import { checkEligibility } from '../crs/eligibility.js';
import type { ApplicantProfile, ProgramsDB, AbsoluteScoreResult, IterationLog, MutationType } from '../data/schemas.js';

function bar(value: number, max: number, width: number = 30): string {
  const filled = Math.max(0, Math.round((value / max) * width));
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
}

function sparkline(values: number[]): string {
  if (values.length === 0) return '';
  const chars = ['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map(v => chars[Math.min(7, Math.floor(((v - min) / range) * 7))]).join('');
}

function mutationDistribution(results: IterationLog[]): Record<string, { total: number; kept: number }> {
  const dist: Record<string, { total: number; kept: number }> = {};
  for (const r of results) {
    const t = r.mutation_type || 'unknown';
    if (!dist[t]) dist[t] = { total: 0, kept: 0 };
    dist[t].total++;
    if (r.status === 'keep') dist[t].kept++;
  }
  return dist;
}

function formatDuration(months: number): string {
  if (months < 12) return `${months}mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y}y${m}mo` : `${y}y`;
}

function renderDashboard(dir?: string): void {
  const cwd = dir || process.cwd();

  if (!fs.existsSync(path.join(cwd, 'profile.yaml'))) {
    console.log(chalk.red('\n  Not in an immigration project directory.\n'));
    process.exit(1);
  }

  const profile = yaml.load(fs.readFileSync(path.join(cwd, 'profile.yaml'), 'utf-8')) as ApplicantProfile;
  const resultsPath = path.join(cwd, 'results.tsv');
  const results = readResults(resultsPath);

  const crs = calculateCRS(profile);
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

  // Header
  console.log(chalk.bold.cyan(`\n  ┌─────────────────────────────────────────────────────────────────┐`));
  console.log(chalk.bold.cyan(`  │  ${profile.personal.name} — 加拿大移民路径优化器                        │`));
  console.log(chalk.bold.cyan(`  │  ${chalk.dim(now)}                                            │`));
  console.log(chalk.bold.cyan(`  └─────────────────────────────────────────────────────────────────┘\n`));

  // CRS Section
  console.log(chalk.bold('  CRS 综合评分'));
  console.log(`  ${chalk.bold.yellow(String(crs.total))} / 1200`);
  console.log(`  [${bar(crs.total, 1200, 40)}]`);
  console.log(chalk.dim(`    Core ${crs.core_human_capital} | Skill ${crs.skill_transferability} | Additional ${crs.additional_points}`));
  console.log(chalk.dim(`    Age ${crs.details.age} | Edu ${crs.details.education} | Lang ${crs.details.first_language} | CanExp ${crs.details.canadian_experience}`));

  if (crs.details.provincial_nomination > 0) {
    console.log(chalk.green(`    + Provincial Nomination: +600`));
  }
  if (crs.details.french_bonus > 0) {
    console.log(chalk.green(`    + French Bonus: +${crs.details.french_bonus}`));
  }

  // Pathway score
  if (results.length === 0) {
    console.log(chalk.yellow('\n  No optimization results yet. Run: immigration-optimizer run\n'));
    return;
  }

  const lastBest = getLastBestScore(resultsPath);
  const score = lastBest?.score ?? 0;
  const baseline = results[0]?.score_after || 0;

  console.log(chalk.bold('\n  路径评分'));
  console.log(`  ${chalk.bold.green(score.toFixed(1))} / 100  ${chalk.dim(`(baseline ${baseline.toFixed(1)}, delta ${score - baseline >= 0 ? '+' : ''}${(score - baseline).toFixed(1)})`)}`);
  console.log(`  [${bar(score, 100, 40)}]`);

  // Score trend sparkline
  const scoreHistory: number[] = [];
  let currentBest = results[0]?.score_after ?? 0;
  for (const r of results) {
    if (r.status === 'keep') currentBest = r.score_after;
    scoreHistory.push(currentBest);
  }
  const recent = scoreHistory.slice(-40);
  if (recent.length > 2) {
    console.log(`  Trend: ${sparkline(recent)} ${chalk.dim(`(last ${recent.length} iterations)`)}`);
  }

  // Dimension scores
  const scorePath = path.join(cwd, 'score.json');
  if (fs.existsSync(scorePath)) {
    try {
      const scoreData = JSON.parse(fs.readFileSync(scorePath, 'utf-8')) as AbsoluteScoreResult;
      if (scoreData.components) {
        console.log(chalk.bold('\n  维度评分'));

        const dimNames: Record<string, string> = {
          success_probability: '成功率',
          timeline_efficiency: '时间效率',
          cost_efficiency: '成本效率',
          quality_of_life: '生活质量',
          plan_robustness: '计划韧性',
        };

        for (const [dim, result] of Object.entries(scoreData.components)) {
          const label = (dimNames[dim] || dim).padEnd(10);
          const dimBar = bar(result.score, 100, 20);
          const penStr = result.penalty ? chalk.red(` ${result.penalty}`) : '';
          const rewStr = result.reward ? chalk.green(` +${result.reward}`) : '';
          const wStr = chalk.dim(`w=${result.weight}`);
          console.log(`    ${label} [${dimBar}] ${result.score.toFixed(1)}${penStr}${rewStr} ${wStr}`);
        }

        // Penalties summary
        if (scoreData.penalties && scoreData.penalties.length > 0) {
          console.log(chalk.bold.red(`\n  惩罚 (${scoreData.penalties.length})`));
          for (const p of scoreData.penalties.slice(0, 4)) {
            console.log(chalk.red(`    ${p.penalty}  Step ${p.step}: ${p.issue.substring(0, 55)}`));
          }
          if (scoreData.penalties.length > 4) {
            console.log(chalk.dim(`    ... +${scoreData.penalties.length - 4} more`));
          }
        }

        // Rewards summary
        if (scoreData.rewards && scoreData.rewards.length > 0) {
          console.log(chalk.bold.green(`\n  奖励 (${scoreData.rewards.length})`));
          for (const r of scoreData.rewards.slice(0, 4)) {
            console.log(chalk.green(`    +${r.reward}  Step ${r.step}: ${r.reason.substring(0, 55)}`));
          }
          if (scoreData.rewards.length > 4) {
            console.log(chalk.dim(`    ... +${scoreData.rewards.length - 4} more`));
          }
        }
      }
    } catch { /* skip malformed */ }
  }

  // Recent mutations
  const last8 = results.slice(-8);
  console.log(chalk.bold('\n  最近变异'));
  for (const r of last8) {
    const icon = r.status === 'keep' ? chalk.green('\u2713') : chalk.red('\u2717');
    const d = isNaN(r.delta) ? 0 : r.delta;
    const delta = d >= 0 ? chalk.green(`+${d.toFixed(2)}`) : chalk.red(d.toFixed(2));
    const mtype = (r.mutation_type || 'unknown').padEnd(16);
    const desc = (r.description || '').substring(0, 38).padEnd(38);
    console.log(`    ${icon} #${String(r.iteration || 0).padStart(3)} ${mtype} ${desc} ${delta}`);
  }

  // Mutation distribution
  const dist = mutationDistribution(results);
  const distEntries = Object.entries(dist).sort((a, b) => b[1].total - a[1].total);
  if (distEntries.length > 0) {
    console.log(chalk.bold('\n  变异类型分布'));
    for (const [type, stats] of distEntries) {
      const rate = stats.total > 0 ? ((stats.kept / stats.total) * 100).toFixed(0) : '0';
      const typeBar = bar(stats.total, Math.max(...distEntries.map(e => e[1].total)), 12);
      console.log(`    ${(type as string).padEnd(16)} [${typeBar}] ${String(stats.total).padStart(3)} (${rate}% kept)`);
    }
  }

  // Stats
  const totalIterations = results[results.length - 1].iteration;
  const keeps = results.filter(r => r.status === 'keep').length;
  const keepRate = ((keeps / results.length) * 100).toFixed(1);

  let streak = 0;
  const lastStatus = results[results.length - 1].status;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].status === lastStatus) streak++;
    else break;
  }

  console.log(chalk.bold('\n  统计'));
  console.log(`    Iterations:  ${totalIterations}`);
  console.log(`    Keep rate:   ${keepRate}% (${keeps}/${results.length})`);
  console.log(`    Streak:      ${streak} ${lastStatus}s`);
  console.log(`    Baseline:    ${baseline.toFixed(2)}`);
  const totalDelta = score - baseline;
  console.log(`    Total delta: ${totalDelta >= 0 ? chalk.green(`+${totalDelta.toFixed(2)}`) : chalk.red(totalDelta.toFixed(2))}`);

  // Program eligibility matrix
  const dbPath = path.join(cwd, 'programs_db.json');
  if (fs.existsSync(dbPath)) {
    try {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8')) as ProgramsDB;
      const programs = Object.values(db);
      if (programs.length > 0) {
        const verified = programs.filter(p => p.source !== 'llm_knowledge').length;

        console.log(chalk.bold(`\n  项目数据库 (${programs.length} total, ${verified} verified)`));

        const eligible = programs.filter(p => {
          const r = checkEligibility(profile, p);
          return r.eligible;
        });
        const close = programs.filter(p => {
          const r = checkEligibility(profile, p);
          return !r.eligible && r.close.length > 0;
        });

        console.log(`    ${chalk.green(`${eligible.length} eligible`)} | ${chalk.yellow(`${close.length} close`)} | ${chalk.red(`${programs.length - eligible.length - close.length} ineligible`)}`);

        // Show top eligible programs
        if (eligible.length > 0) {
          console.log(chalk.dim('    Top eligible:'));
          for (const p of eligible.slice(0, 5)) {
            const procTime = `${p.processing.typical_processing_months.min}-${p.processing.typical_processing_months.max}mo`;
            const costStr = `$${p.processing.total_estimated_cost_cad}`;
            console.log(chalk.dim(`      ${(p.name_zh || p.name).substring(0, 30).padEnd(30)} ${procTime.padEnd(8)} ${costStr.padEnd(8)} ${p.metrics.competition_level}`));
          }
        }

        // Pathway timeline estimate from pathway.md frontmatter
        const pathwayPath = path.join(cwd, 'pathway.md');
        if (fs.existsSync(pathwayPath)) {
          const pathwayContent = fs.readFileSync(pathwayPath, 'utf-8');
          const durationMatch = pathwayContent.match(/total_duration_months:\s*(\d+)/);
          const costMatch = pathwayContent.match(/total_cost_cad:\s*(\d+)/);
          const programMatch = pathwayContent.match(/primary_program:\s*"?([^"\n]+)"?/);
          if (durationMatch || costMatch || programMatch) {
            console.log(chalk.bold('\n  当前路径'));
            if (programMatch) console.log(`    Program:  ${programMatch[1]}`);
            if (durationMatch) console.log(`    Duration: ${formatDuration(parseInt(durationMatch[1], 10))}`);
            if (costMatch) console.log(`    Cost:     $${parseInt(costMatch[1], 10).toLocaleString()} CAD`);
          }
        }
      }
    } catch { /* skip */ }
  }

  console.log();
}

export function dashboardCommand(options: { watch?: boolean; interval?: string }): void {
  const dir = process.cwd();
  const intervalMs = options.interval ? parseInt(options.interval, 10) * 1000 : 3000;

  if (options.watch) {
    const render = (): void => {
      try {
        process.stdout.write('\x1B[2J\x1B[0f');
        renderDashboard(dir);
        console.log(chalk.gray(`  Auto-refreshing every ${intervalMs / 1000}s. Ctrl+C to stop.`));
      } catch {
        process.stdout.write('\x1B[2J\x1B[0f');
        console.log(chalk.yellow('\n  Waiting for optimizer... (directory in flux)\n'));
      }
    };
    render();
    setInterval(render, intervalMs);
  } else {
    renderDashboard(dir);
  }
}
