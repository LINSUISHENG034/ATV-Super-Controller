#!/usr/bin/env node
import { Command } from 'commander';
import { logger } from './utils/logger.js';
import { startCommand } from './commands/start.js';
import { statusCommand } from './commands/status.js';
import { testCommand } from './commands/test.js';
import { validateCommand } from './commands/validate.js';

logger.debug('CLI initializing');

const program = new Command();

program
  .name('atv-controller')
  .description('Android TV scheduler and controller')
  .version('1.0.0');

program
  .command('start')
  .description('Start the scheduler service')
  .action(startCommand);

program
  .command('status')
  .description('Show scheduler and device status')
  .option('--json', 'Output in JSON format')
  .action(statusCommand);

program
  .command('test')
  .description('Manually trigger an action or task')
  .argument('<name>', 'Action name (wake-up, launch-app, play-video, shutdown) or configured task name')
  .option('--url <url>', 'YouTube URL for play-video action')
  .option('--app <package>', 'App package for launch-app action')
  .option('-c, --config <path>', 'Path to config file')
  .action(testCommand);

program
  .command('validate')
  .description('Validate configuration file')
  .option('-c, --config <path>', 'Path to config file')
  .action(validateCommand);

program.parse(process.argv);
