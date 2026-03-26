import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { loadConfig } from '../data/config.js';
import { createProvider } from '../llm/factory.js';
import { runOptimizationLoop } from '../optimizer/loop.js';

interface RunOptions {
  standalone?: boolean;
  headless?: boolean;
  yolo?: boolean;
  maxIterations?: number;
}

export async function runCommand(options: RunOptions): Promise<void> {
  const cwd = process.cwd();

  if (!fs.existsSync(path.join(cwd, 'profile.yaml'))) {
    console.log(chalk.red('\n  Not in an immigration project directory (no profile.yaml found).\n'));
    process.exit(1);
  }

  const config = loadConfig();

  if (options.standalone) {
    const provider = createProvider(config);
    const modelName = config.model_override?.model || process.env.ANTHROPIC_MODEL || 'default';
    console.log(chalk.bold(`\n  immigration-optimizer: standalone mode (${modelName})\n`));

    await runOptimizationLoop({
      provider,
      pathwayDir: cwd,
      onIteration: () => {},
    });
    return;
  }

  if (config.model_override) {
    console.log(chalk.yellow('\n  Custom model configured — agent mode still uses Claude Code.'));
    console.log(chalk.yellow('  Use --standalone to run with your custom model.\n'));
  }

  const { launchAgent } = await import('./run-agent.js');
  await launchAgent(cwd, { yolo: options.yolo, headless: options.headless, maxIterations: options.maxIterations });
}
