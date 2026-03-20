#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { listCommand } from './commands/list.js';
import { statusCommand } from './commands/status.js';
import { listTemplatesCommand } from './commands/templates.js';
import { regenerateCommand } from './commands/regenerate.js';
import { coachCommand } from './commands/coach.js';

const program = new Command();

program
  .name('ll-agents-team')
  .description('Lightweight AI agent team orchestration for any project')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize .agents-team/ in the current project')
  .option('-n, --name <name>', 'Team name', 'My Team')
  .action(initCommand);

program
  .command('add')
  .description('Add an agent to the team')
  .requiredOption('--name <name>', 'Agent name')
  .option('--role <role>', 'Agent role (e.g., "Frontend Developer")')
  .option(
    '--expertise <items>',
    'Comma-separated expertise areas (e.g., "React,CSS,TypeScript")',
  )
  .option(
    '--boundaries <patterns>',
    'Comma-separated file boundary patterns with access (e.g., "src/frontend/**:write,src/styles/**:exclusive")',
  )
  .option(
    '--template <key>',
    'Use a pre-built template (e.g., "generic/backend-dev", "ita-opti/opti-feature-dev"). Run "ll-agents-team templates" to list all options.',
  )
  .action(addCommand);

program
  .command('templates')
  .description('List all available agent templates')
  .action(listTemplatesCommand);

program
  .command('remove <name>')
  .description('Remove an agent from the team (charter preserved in _alumni)')
  .action(removeCommand);

program
  .command('list')
  .description('List all team members')
  .action(listCommand);

program
  .command('status')
  .description('Show team status, locks, and routing')
  .action(statusCommand);

program
  .command('regenerate')
  .description('Regenerate coordinator and agent charters from the latest templates')
  .option('--agents-only', 'Only regenerate agent charters')
  .option('--coordinator-only', 'Only regenerate the coordinator and Copilot instructions')
  .action(regenerateCommand);

program
  .command('coach')
  .description('Regenerate the Team coordinator with latest team state, ready for Team Setup Mode')
  .action(coachCommand);

program.parse();
