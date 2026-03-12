import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
1. Report your results to the coordinator
2. List any new learnings about the codebase, patterns, or conventions you discovered
3. Note any follow-up work that might be needed by other agents
`;
}

// ── Agent prompt file (for Copilot agent mode) ──────────────────────────────

export function generateAgentPrompt(agent: AgentEntry): string {
  const expertiseStr = agent.expertise.join(', ');

  return `---
mode: ${agent.name.toLowerCase()}
description: "${agent.role} — expertise in ${expertiseStr}"
tools:
  - read_file
  - create_file
  - replace_string_in_file
  - run_in_terminal
  - file_search
  - grep_search
  - semantic_search
---

${generateCharter(agent)}`;
}

// ── Persist agent files ──────────────────────────────────────────────────────

export async function writeAgentFiles(
  agent: AgentEntry,
  root?: string,
): Promise<void> {
  const charterPath = getCharterPath(agent.name, root);
  const memoryPath = getMemoryPath(agent.name, root);

  await writeFile(charterPath, generateAgentPrompt(agent));

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
