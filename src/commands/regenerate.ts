import { writeFile, mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import {
  loadTeam,
  saveTeam,
  addAgentToTeam,
  teamExists,
  getTeamDir,
  getCoordinatorPath,
  getInitiatorPath,
  getGithubAgentsDir,
} from '../core/team.js';
import {
  generateCharter,
  getCharterPath,
  listTemplates,
  resolveTemplate,
  parseTemplateContent,
  createAgentEntry,
  writeAgentFiles,
} from '../core/agent.js';
import { generateCoordinatorPrompt, generateInitiatorPrompt, generateCopilotInstructions } from '../core/coordinator.js';
import { generateDefaultRules, loadRouting, saveRouting } from '../core/router.js';

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

    const initiatorPrompt = generateInitiatorPrompt(team);
    await writeFile(getInitiatorPath(), initiatorPrompt);
    console.log('✓ Regenerated initiator agent (.github/agents/initiator.md)');
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

  // ── Suggest new generic agents not yet in the team ────────────────────────
  await suggestNewAgents(team);
}

async function suggestNewAgents(team: Awaited<ReturnType<typeof loadTeam>>): Promise<void> {
  const allTemplates = await listTemplates();
  const genericTemplates = allTemplates.filter((t) => t.category === 'generic');

  const existingNames = new Set(team.agents.map((a) => a.name.toLowerCase()));
  const missing = genericTemplates.filter((t) => !existingNames.has(t.name.toLowerCase()));

  if (missing.length === 0) return;

  // Load each missing template to get the role description
  const suggestions: Array<{
    key: string;
    name: string;
    role: string;
    expertise: string[];
    boundaries: ReturnType<typeof parseTemplateContent>['boundaries'];
    charter: string;
  }> = [];

  for (const tpl of missing) {
    const resolved = await resolveTemplate(tpl.key);
    if (!resolved) continue;
    const parsed = parseTemplateContent(resolved.content, tpl.name);
    suggestions.push({
      key: tpl.key,
      name: tpl.name,
      role: parsed.role,
      expertise: parsed.expertise,
      boundaries: parsed.boundaries,
      charter: parsed.charter,
    });
  }

  if (suggestions.length === 0) return;

  console.log('');
  console.log('💡 New agent templates are available that are not yet in your team:');
  for (const s of suggestions) {
    console.log(`   • ${s.name} — ${s.role}`);
  }
  console.log('');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, resolve));

  const toAdd: typeof suggestions = [];

  for (const s of suggestions) {
    const answer = await ask(`  Add "${s.name}" (${s.role})? [y/N] `);
    if (answer.trim().toLowerCase() === 'y') {
      toAdd.push(s);
    }
  }

  rl.close();

  if (toAdd.length === 0) return;

  let currentTeam = await loadTeam();
  const routing = await loadRouting();

  for (const s of toAdd) {
    const agent = createAgentEntry(s.name, s.role, s.expertise, s.boundaries);
    try {
      currentTeam = addAgentToTeam(currentTeam, agent);
    } catch (err) {
      console.error(`✗ ${(err as Error).message}`);
      continue;
    }
    await saveTeam(currentTeam);
    await writeAgentFiles(agent, undefined, s.charter);
    console.log(`✓ Added agent: ${s.name} (${s.role})`);

    const rules = generateDefaultRules(agent);
    rules.forEach((r) => routing.rules.push(r));
  }

  routing.rules.sort((a, b) => b.priority - a.priority);
  await saveRouting(routing);

  // Regenerate coordinator and Copilot instructions to include the new agents
  const coordinatorPrompt = generateCoordinatorPrompt(currentTeam);
  await writeFile(getCoordinatorPath(), coordinatorPrompt);

  const copilotInstructions = generateCopilotInstructions(currentTeam);
  await writeFile(join(getTeamDir(), 'copilot-instructions.md'), copilotInstructions);

  console.log('✓ Updated coordinator and Copilot instructions with new agents');
}
