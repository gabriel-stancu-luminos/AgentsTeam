import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  loadTeam,
  saveTeam,
  removeAgentFromTeam,
  teamExists,
  getTeamDir,
  getCoordinatorPath,
} from '../core/team.js';
import { archiveAgent } from '../core/agent.js';
import { removeRoutingRules } from '../core/router.js';
import { releaseAllLocks } from '../core/lock-manager.js';
import { generateCoordinatorPrompt, generateCopilotInstructions } from '../core/coordinator.js';
import { appendActivity } from '../core/activity-log.js';

export async function removeCommand(name: string): Promise<void> {
  if (!(await teamExists())) {
    console.error('✗ No .agents-team/ found. Run "ll-agents-team init" first.');
    process.exit(1);
  }

  let team = await loadTeam();
  try {
    team = removeAgentFromTeam(team, name);
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }

  // Save updated team
  await saveTeam(team);

  // Archive agent charter (move to _alumni)
  await archiveAgent(name);
  console.log(`✓ Archived agent charter to agents/_alumni/${name}.md`);

  // Remove routing rules
  const removed = await removeRoutingRules(name);
  if (removed > 0) console.log(`✓ Removed ${removed} routing rule(s)`);

  // Release any held locks
  const released = await releaseAllLocks(name);
  if (released > 0) console.log(`✓ Released ${released} file lock(s)`);

  await appendActivity({ event: 'agent:removed', agent: name, detail: `Removed agent "${name}" from team` });

  // Regenerate coordinator prompt
  const coordinatorPrompt = generateCoordinatorPrompt(team);
  await writeFile(getCoordinatorPath(), coordinatorPrompt);
  console.log('✓ Updated coordinator agent');

  // Regenerate Copilot instructions
  const copilotInstructions = generateCopilotInstructions(team);
  await writeFile(
    join(getTeamDir(), 'copilot-instructions.md'),
    copilotInstructions,
  );

  console.log('');
  console.log(`🎉 Agent "${name}" removed from the team.`);
  console.log('   Their memory and archived charter are preserved.');
}
