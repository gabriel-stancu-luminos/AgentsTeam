import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  scaffoldTeamDir,
  createDefaultTeam,
  saveTeam,
  teamExists,
  getTeamDir,
  getCoordinatorPath,
  getCoachPath,
  copySkills,
} from '../core/team.js';
import { saveRouting } from '../core/router.js';
import { initSharedMemory } from '../core/memory.js';
import { generateCoordinatorPrompt, generateCoachPrompt, generateCopilotInstructions } from '../core/coordinator.js';
import { appendActivity } from '../core/activity-log.js';

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

  // 6. Generate coach agent prompt (visible in Copilot as "Coach")
  const coachPrompt = generateCoachPrompt(team);
  await writeFile(getCoachPath(), coachPrompt);
  console.log('✓ Generated coach agent (.github/agents/coach.md)');

  // 7. Generate Copilot workspace instructions
  const copilotInstructions = generateCopilotInstructions(team);
  await writeFile(
    join(getTeamDir(), 'copilot-instructions.md'),
    copilotInstructions,
  );
  console.log('✓ Generated Copilot instructions (copilot-instructions.md)');

  // 8. Copy bundled skills
  const skillsCopied = await copySkills();
  if (skillsCopied.length > 0) {
    console.log(`✓ Copied ${skillsCopied.length} skill(s) to .github/skills/ (${skillsCopied.join(', ')})`);
  }

  console.log('');
  console.log(`🎉 Team "${teamName}" initialized!`);
  console.log('');
  console.log('Next step — design your team:');
  console.log('');
  console.log('  ll-agents-team coach');
  console.log('');
  console.log('Then open Copilot Chat, select the Coach agent, and say "set up the team".');

  await appendActivity({ event: 'team:initialized', detail: `Team "${teamName}" initialized` });
  console.log('The Coach will scan your workspace and design specific agents for your project.');
  console.log('');
  console.log('Once agents are created, switch to the Team agent for development tasks.');
  console.log('');
  console.log('Or add agents manually:');
  console.log('  ll-agents-team add --name "Frontend" --role "Frontend Developer" --expertise "React,CSS,TypeScript"');
  console.log('  ll-agents-team add --name "Backend" --role "Backend Developer" --expertise "Node.js,PostgreSQL,REST APIs"');
}
