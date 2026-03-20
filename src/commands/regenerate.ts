import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  loadTeam,
  teamExists,
  getTeamDir,
  getCoordinatorPath,
  getGithubAgentsDir,
} from '../core/team.js';
import { generateCharter, getCharterPath } from '../core/agent.js';
import { generateCoordinatorPrompt, generateCopilotInstructions } from '../core/coordinator.js';

interface RegenerateOptions {
  agentsOnly?: boolean;
  coordinatorOnly?: boolean;
}

export async function regenerateCommand(options: RegenerateOptions): Promise<void> {
  if (!(await teamExists())) {
    console.error('✗ No .agents-team/ found. Run "ll-agents-team init" first.');
    process.exit(1);
  }

  const team = await loadTeam();
  const doAll = !options.agentsOnly && !options.coordinatorOnly;
  let updated = 0;

  // Regenerate coordinator prompt
  if (doAll || options.coordinatorOnly) {
    const agentsDir = getGithubAgentsDir();
    await mkdir(agentsDir, { recursive: true });

    const coordinatorPrompt = generateCoordinatorPrompt(team);
    await writeFile(getCoordinatorPath(), coordinatorPrompt);
    console.log('✓ Regenerated coordinator agent (.github/agents/team.md)');
    updated++;

    const copilotInstructions = generateCopilotInstructions(team);
    await writeFile(
      join(getTeamDir(), 'copilot-instructions.md'),
      copilotInstructions,
    );
    console.log('✓ Regenerated Copilot instructions (copilot-instructions.md)');
    updated++;
  }

  // Regenerate agent charters for ALL agents — including those originally created from templates
  if (doAll || options.agentsOnly) {
    for (const agent of team.agents) {
      const charter = generateCharter(agent);
      await writeFile(getCharterPath(agent.name), charter);
      console.log(`✓ Regenerated charter for ${agent.name}`);
      updated++;
    }
  }

  console.log('');
  if (updated === 0) {
    console.log('Nothing to regenerate.');
  } else {
    console.log(`🎉 Regenerated ${updated} file(s) with the latest templates.`);
  }
}
