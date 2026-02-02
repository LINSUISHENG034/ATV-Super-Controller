#!/usr/bin/env node
import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { statusCommand } from './commands/status.js';
import { testCommand } from './commands/test.js';
import { validateCommand } from './commands/validate.js';

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
  .action(statusCommand);

program
  .command('test')
  .description('Test device connection')
  .action(testCommand);

program
  .command('validate')
  .description('Validate configuration file')
  .option('-c, --config <path>', 'Path to config file', './config.json')
  .action(validateCommand);

program.parse(process.argv);
