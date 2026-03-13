import { readdir, readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type AgentEntry,
  type FileBoundary,
  AGENTS_DIR,
  ALUMNI_DIR,
  MEMORY_DIR,
} from './types.js';
import { getTeamDir } from './team.js';

// ── Charter path helpers ─────────────────────────────────────────────────────

export function getCharterPath(agentName: string, root?: string): string {
  return join(getTeamDir(root), AGENTS_DIR, `${agentName}.md`);
}

export function getAlumniPath(agentName: string, root?: string): string {
  return join(getTeamDir(root), ALUMNI_DIR, `${agentName}.md`);
}

export function getMemoryPath(agentName: string, root?: string): string {
  return join(getTeamDir(root), MEMORY_DIR, `${agentName}.md`);
}

// ── Create agent entry ───────────────────────────────────────────────────────

export function createAgentEntry(
  name: string,
  role: string,
  expertise: string[],
  boundaries: FileBoundary[],
): AgentEntry {
  return {
    name,
    role,
    expertise,
    boundaries,
    createdAt: new Date().toISOString(),
  };
}

// ── Charter generation ───────────────────────────────────────────────────────

export function generateCharter(agent: AgentEntry): string {
  const expertiseList = agent.expertise.map((e) => `- ${e}`).join('\n');

  const boundariesList = agent.boundaries.length > 0
    ? agent.boundaries
        .map((b) => `- \`${b.pattern}\` (${b.access})`)
        .join('\n')
    : '- _No boundaries defined — coordinate with the team coordinator_';

  return `# ${agent.name} — ${agent.role}

## Expertise
${expertiseList}

## File Boundaries
You are responsible for and may modify files matching these patterns:
${boundariesList}

**Do NOT modify files outside your boundaries.** If you need changes in other areas, report back to the coordinator with what you need.

## Working Protocol

### Before Starting
1. Read \`.agents-team/memory/${agent.name}.md\` for your past learnings on this project
2. Read \`.agents-team/shared/learnings.md\` for team-wide knowledge
3. Read \`.agents-team/shared/decisions.md\` for decisions that affect your work

### While Working
- Stay within your file boundaries
- If you encounter a decision that affects other team members, note it for the coordinator
- If you're blocked by another agent's work, report back immediately — don't wait
- Record important discoveries and patterns as you go

### After Completing
1. **Update your private memory** — append new learnings, patterns, gotchas, and codebase observations to \`.agents-team/memory/${agent.name}.md\`
2. **Update shared knowledge** — if your findings are relevant to other agents, append them to \`.agents-team/shared/learnings.md\`
3. **Record decisions** — if architectural or design decisions were made, append them to \`.agents-team/shared/decisions.md\`
4. Report your results to the coordinator
5. Note any follow-up work that might be needed by other agents
`;
}

// ── Agent charter file (referenced by coordinator, not a Copilot agent) ──────

export function generateAgentPrompt(agent: AgentEntry): string {
  return generateCharter(agent);
}

// ── Template discovery & parsing ─────────────────────────────────────────────

export function getTemplatesDir(): string {
  return fileURLToPath(new URL('../../src/agent-templates', import.meta.url));
}

export interface TemplateInfo {
  key: string;      // e.g. "generic/backend-dev"
  category: string; // e.g. "generic"
  name: string;     // e.g. "backend-dev"
  path: string;     // absolute path
}

export interface ParsedTemplate {
  role: string;
  expertise: string[];
  boundaries: FileBoundary[];
  charter: string;
}

export async function listTemplates(): Promise<TemplateInfo[]> {
  const templatesDir = getTemplatesDir();
  const templates: TemplateInfo[] = [];
  try {
    const categories = await readdir(templatesDir, { withFileTypes: true });
    for (const cat of categories) {
      if (!cat.isDirectory()) continue;
      const files = await readdir(join(templatesDir, cat.name));
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const name = file.replace(/\.md$/, '');
        templates.push({
          key: `${cat.name}/${name}`,
          category: cat.name,
          name,
          path: join(templatesDir, cat.name, file),
        });
      }
    }
  } catch {
    // templates dir not found — silently return empty
  }
  return templates;
}

export function parseTemplateContent(content: string, agentName: string): ParsedTemplate {
  const lines = content.split('\n');
  let role = '';
  let inSection = '';
  const expertise: string[] = [];
  const boundaries: FileBoundary[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      inSection = trimmed.slice(3).toLowerCase();
      continue;
    }
    if (inSection === 'role' && trimmed && !role) {
      role = trimmed;
    }
    if (inSection === 'expertise' && trimmed.startsWith('- ')) {
      expertise.push(trimmed.slice(2).trim());
    }
    if (inSection === 'file boundaries' && trimmed.startsWith('- `')) {
      const match = trimmed.match(/^- `([^`]+)`\s+\((\w+)\)/);
      if (match) {
        boundaries.push({
          pattern: match[1],
          access: (['read', 'write', 'exclusive'].includes(match[2])
            ? match[2] : 'write') as FileBoundary['access'],
        });
      }
    }
  }

  // Fallback: extract role from title line "# template-name — Role Description"
  if (!role && lines[0]) {
    const titleMatch = lines[0].match(/^# [^\s—]+\s+—\s+(.+)$/);
    if (titleMatch) role = titleMatch[1].trim();
  }

  // Replace title and all memory-path references
  const newTitle = `# ${agentName} — ${role}`;
  const charter = [newTitle, ...lines.slice(1)]
    .join('\n')
    .replace(/\.agents-team\/memory\/[^.\s]+\.md/g, `.agents-team/memory/${agentName}.md`);

  return { role, expertise, boundaries, charter };
}

export async function resolveTemplate(
  key: string,
): Promise<{ content: string; path: string } | null> {
  const templates = await listTemplates();
  // Exact key match first (e.g. "generic/backend-dev"), then name-only fallback
  const found = templates.find((t) => t.key === key) ?? templates.find((t) => t.name === key);
  if (!found) return null;
  const content = await readFile(found.path, 'utf-8');
  return { content, path: found.path };
}

// ── Persist agent files ──────────────────────────────────────────────────────

export async function writeAgentFiles(
  agent: AgentEntry,
  root?: string,
  charterContent?: string,
): Promise<void> {
  const charterPath = getCharterPath(agent.name, root);
  const memoryPath = getMemoryPath(agent.name, root);

  await writeFile(charterPath, charterContent ?? generateAgentPrompt(agent));

  if (!existsSync(memoryPath)) {
    await writeFile(
      memoryPath,
      `# ${agent.name} — Memory\n\n_Learnings and observations from working on this project._\n`,
    );
  }
}

// ── Archive agent (move to alumni) ───────────────────────────────────────────

export async function archiveAgent(
  agentName: string,
  root?: string,
): Promise<void> {
  const charterPath = getCharterPath(agentName, root);
  const alumniPath = getAlumniPath(agentName, root);

  if (existsSync(charterPath)) {
    await mkdir(join(getTeamDir(root), ALUMNI_DIR), { recursive: true });
    await rename(charterPath, alumniPath);
  }
}

// ── Read charter ─────────────────────────────────────────────────────────────

export async function readCharter(
  agentName: string,
  root?: string,
): Promise<string | null> {
  const path = getCharterPath(agentName, root);
  if (!existsSync(path)) return null;
  return readFile(path, 'utf-8');
}
