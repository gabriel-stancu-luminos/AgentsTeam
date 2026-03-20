import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  scaffoldTeamDir,
  createDefaultTeam,
  saveTeam,
  teamExists,
  getTeamDir,
  getCoordinatorPath,
} from '../core/team.js';
import { saveRouting } from '../core/router.js';
import { initSharedMemory } from '../core/memory.js';
import { generateCoordinatorPrompt, generateCopilotInstructions } from '../core/coordinator.js';

export async function initCommand(options: { name?: string }): Promise<void> {
  const exists = await teamExists();

  if (exists) {
    console.log('⚠  .agents-team/ already exists. Use "add" to add agents.');
    return;
  }

  const teamName = options.name ?? 'My Team';

  // 1. Scaffold directory structure
  const teamDir = await scaffoldTeamDir();
  console.log(`✓ Created ${teamDir}/`);

  // 2. Create team.json
  const team = createDefaultTeam(teamName);
  await saveTeam(team);
  console.log('✓ Created team.json');

  // 3. Create routing.json
  await saveRouting({ rules: [] });
  console.log('✓ Created routing.json');

  // 4. Create shared memory files
  await initSharedMemory();
  console.log('✓ Created shared/decisions.md and shared/learnings.md');

  // 5. Generate coordinator agent prompt (visible in Copilot as "Team")
  const coordinatorPrompt = generateCoordinatorPrompt(team);
  await writeFile(getCoordinatorPath(), coordinatorPrompt);
  console.log('✓ Generated coordinator agent (.github/agents/team.md)');

  // 6. Generate Copilot workspace instructions
  const copilotInstructions = generateCopilotInstructions(team);
  await writeFile(
    join(getTeamDir(), 'copilot-instructions.md'),
    copilotInstructions,
  );
  console.log('✓ Generated Copilot instructions (copilot-instructions.md)');

  console.log('');
  console.log(`🎉 Team "${teamName}" initialized!`);
  console.log('');
  console.log('Next step — design your team:');
  console.log('');
  console.log('  ll-agents-team coach');
  console.log('');
  console.log('Then open Copilot Chat, select the Team agent, and say "set up the team".');
  console.log('The coordinator will scan your workspace and design specific agents for your project.');
  console.log('');
  console.log('Or add agents manually:');
  console.log('  ll-agents-team add --name "Frontend" --role "Frontend Developer" --expertise "React,CSS,TypeScript"');
  console.log('  ll-agents-team add --name "Backend" --role "Backend Developer" --expertise "Node.js,PostgreSQL,REST APIs"');
}
