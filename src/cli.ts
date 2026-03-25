import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { configCommand } from './commands/config.js';
import { profileCommand } from './commands/profile.js';
import { scoreCommand } from './commands/score.js';
import { researchCommand } from './commands/research.js';
import { runCommand } from './commands/run.js';
import { statusCommand } from './commands/status.js';
import { dashboardCommand } from './commands/dashboard.js';
import { chartCommand } from './commands/chart.js';
import { loadConfig } from './data/config.js';
import { setLanguage } from './i18n.js';

const _cfg = loadConfig();
if (_cfg.language) setLanguage(_cfg.language);

const program = new Command();

program
  .name('immigration-optimizer')
  .description('Optimize Canadian immigration pathways using the autoresearch pattern')
  .version('0.1.0');

program
  .command('init <name>')
  .description('Create a new immigration pathway project')
  .action(initCommand);

program
  .command('config')
  .description('Manage API keys and provider settings')
  .argument('[args...]', 'config subcommand and arguments')
  .action((args: string[]) => configCommand(args));

program
  .command('profile')
  .description('View applicant profile and CRS estimate')
  .action(() => profileCommand());

program
  .command('score')
  .description('Run a one-off absolute score of the current pathway')
  .action(scoreCommand);

program
  .command('research')
  .description('Research additional immigration programs')
  .action(researchCommand);

program
  .command('run')
  .description('Start the optimization loop (default: agent mode)')
  .option('--standalone', 'Use direct API calls instead of Claude Code agent')
  .option('--headless', 'Run agent non-interactively')
  .option('--yolo', 'Skip all permission prompts (dangerously-skip-permissions)')
  .option('--max-iterations <n>', 'Maximum optimization iterations (default: 50)', parseInt)
  .action(runCommand);

program
  .command('status')
  .description('Show current score and optimization progress')
  .action(statusCommand);

program
  .command('dashboard')
  .description('Live dashboard showing optimization progress')
  .option('--watch', 'Auto-refresh mode')
  .option('--interval <seconds>', 'Refresh interval in seconds (default: 3)')
  .action((options) => dashboardCommand(options));

program
  .command('chart')
  .description('ASCII chart of score progression')
  .action(chartCommand);

process.on('unhandledRejection', (err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n  \x1b[31mError: ${msg}\x1b[0m`);
  if (msg.includes('401') || msg.includes('403') || msg.includes('Authentication') || msg.includes('PERMISSION')) {
    if (_cfg.model_override) {
      console.error(`  \x1b[33mAPI key for ${_cfg.model_override.model} is invalid or expired.\x1b[0m`);
    } else if (process.env.CLAUDE_CODE_USE_VERTEX === '1' || process.env.GOOGLE_CLOUD_PROJECT) {
      console.error('  \x1b[33mAuthentication failed. Run: gcloud auth application-default login\x1b[0m');
    } else {
      console.error('  \x1b[33mAnthropic API key is invalid. Run: immigration-optimizer config set api_key <key>\x1b[0m');
    }
  } else if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
    console.error('  \x1b[33mNetwork error. Check your internet connection.\x1b[0m');
  }
  console.error();
  process.exit(1);
});

program.parse();
