import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  loadTeam,
  saveTeam,
  addAgentToTeam,
  teamExists,
  getTeamDir,
  getCoordinatorPath,
} from '../core/team.js';
import { createAgentEntry, writeAgentFiles } from '../core/agent.js';
import { addRoutingRule, generateDefaultRules, saveRouting, loadRouting } from '../core/router.js';
import { generateCoordinatorPrompt, generateCopilotInstructions } from '../core/coordinator.js';
import type { FileBoundary } from '../core/types.js';

interface AddOptions {
  name: string;
  role: string;
  expertise: string;
  boundaries?: string;
}

export async function addCommand(options: AddOptions): Promise<void> {
  if (!(await teamExists())) {
    console.error('✗ No .agents-team/ found. Run "ll-agents-team init" first.');
    process.exit(1);
  }

  const { name, role, expertise, boundaries: boundariesStr } = options;

  // Parse expertise (comma-separated)
  const expertiseList = expertise
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (expertiseList.length === 0) {
    console.error('✗ At least one expertise area is required.');
    process.exit(1);
  }

  // Parse boundaries (comma-separated "pattern:access" pairs)
  const boundaryList: FileBoundary[] = [];
  if (boundariesStr) {
    for (const raw of boundariesStr.split(',').map((b) => b.trim())) {
      const [pattern, access] = raw.split(':');
      if (pattern) {
        boundaryList.push({
          pattern: pattern.trim(),
          access: (['read', 'write', 'exclusive'].includes(access?.trim())
            ? access.trim()
            : 'write') as FileBoundary['access'],
        });
      }
    }
  }

  // Create agent entry
  const agent = createAgentEntry(name, role, expertiseList, boundaryList);

  // Add to team.json
  let team = await loadTeam();
  try {
    team = addAgentToTeam(team, agent);
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }
  await saveTeam(team);

  // Write charter + memory files
  await writeAgentFiles(agent);
  console.log(`✓ Created agent charter: agents/${name}.md`);

  // Add default routing rules
  const rules = generateDefaultRules(agent);
  const routing = await loadRouting();
  rules.forEach((r) => routing.rules.push(r));
  routing.rules.sort((a, b) => b.priority - a.priority);
  await saveRouting(routing);
  console.log(`✓ Added ${rules.length} routing rule(s)`);

  // Regenerate coordinator prompt (now knows about the new agent)
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
  console.log(`🎉 Agent "${name}" (${role}) added to the team!`);
  console.log(`   Expertise: ${expertiseList.join(', ')}`);
  if (boundaryList.length > 0) {
    console.log(`   Boundaries: ${boundaryList.map((b) => `${b.pattern} (${b.access})`).join(', ')}`);
  }
}
