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
import { createAgentEntry, writeAgentFiles, resolveTemplate, parseTemplateContent, listTemplates } from '../core/agent.js';
import { addRoutingRule, generateDefaultRules, saveRouting, loadRouting } from '../core/router.js';
import { generateCoordinatorPrompt, generateCopilotInstructions } from '../core/coordinator.js';
import type { FileBoundary } from '../core/types.js';

interface AddOptions {
  name: string;
  role?: string;
  expertise?: string;
  boundaries?: string;
  template?: string;
}

export async function addCommand(options: AddOptions): Promise<void> {
  if (!(await teamExists())) {
    console.error('✗ No .agents-team/ found. Run "ll-agents-team init" first.');
    process.exit(1);
  }

  const { name, role: roleOpt, expertise: expertiseOpt, template: templateKey } = options;
  let boundariesStr = options.boundaries;

  let charterContent: string | undefined;
  let role = roleOpt ?? '';
  let expertise = expertiseOpt ?? '';

  // Resolve template if provided
  if (templateKey) {
    const tpl = await resolveTemplate(templateKey);
    if (!tpl) {
      const available = await listTemplates();
      console.error(`✗ Template "${templateKey}" not found.`);
      if (available.length > 0) {
        console.error(`  Available: ${available.map((t) => t.key).join(', ')}`);
      }
      process.exit(1);
    }
    const parsed = parseTemplateContent(tpl.content, name);
    charterContent = parsed.charter;
    // Template values are defaults; explicit CLI args take precedence
    if (!role) role = parsed.role;
    if (!expertise) expertise = parsed.expertise.join(',');
    if (!boundariesStr && parsed.boundaries.length > 0) {
      boundariesStr = parsed.boundaries.map((b) => `${b.pattern}:${b.access}`).join(',');
    }
    console.log(`✔ Using template: ${tpl.path}`);
  }

  if (!role) {
    console.error('✗ --role is required when not using a template.');
    process.exit(1);
  }

  // Parse expertise (comma-separated)
  const expertiseList = expertise
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (expertiseList.length === 0) {
    console.error('✗ At least one expertise area is required (provide --expertise or use a template).');
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
  await writeAgentFiles(agent, undefined, charterContent);
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
