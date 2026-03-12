import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { MemoryEntry } from './types.js';
import { getTeamDir } from './team.js';
import { MEMORY_DIR, SHARED_DIR } from './types.js';

// ── Paths ────────────────────────────────────────────────────────────────────

function agentMemoryPath(agentName: string, root?: string): string {
  return join(getTeamDir(root), MEMORY_DIR, `${agentName}.md`);
}

function sharedLearningsPath(root?: string): string {
  return join(getTeamDir(root), SHARED_DIR, 'learnings.md');
}

function decisionsPath(root?: string): string {
  return join(getTeamDir(root), SHARED_DIR, 'decisions.md');
}

// ── Format ───────────────────────────────────────────────────────────────────

function formatEntry(entry: MemoryEntry): string {
  const tags = entry.tags?.length ? ` [${entry.tags.join(', ')}]` : '';
  const context = entry.context ? `\n  Context: ${entry.context}` : '';
  return `\n### ${entry.timestamp} — ${entry.type}${tags}\n**${entry.agent}:** ${entry.content}${context}\n`;
}

// ── Individual agent memory ──────────────────────────────────────────────────

export async function getAgentMemory(
  agentName: string,
  root?: string,
): Promise<string> {
  const path = agentMemoryPath(agentName, root);
  if (!existsSync(path)) return '';
  return readFile(path, 'utf-8');
}

export async function appendAgentMemory(
  entry: MemoryEntry,
  root?: string,
): Promise<void> {
  const path = agentMemoryPath(entry.agent, root);
  if (!existsSync(path)) {
    await writeFile(
      path,
      `# ${entry.agent} — Memory\n\n_Learnings and observations from working on this project._\n`,
    );
  }
  await appendFile(path, formatEntry(entry));
}

// ── Shared learnings ─────────────────────────────────────────────────────────

export async function getSharedLearnings(root?: string): Promise<string> {
  const path = sharedLearningsPath(root);
  if (!existsSync(path)) return '';
  return readFile(path, 'utf-8');
}

export async function appendSharedLearning(
  entry: MemoryEntry,
  root?: string,
): Promise<void> {
  const path = sharedLearningsPath(root);
  await appendFile(path, formatEntry(entry));
}

// ── Decisions ────────────────────────────────────────────────────────────────

export async function getDecisions(root?: string): Promise<string> {
  const path = decisionsPath(root);
  if (!existsSync(path)) return '';
  return readFile(path, 'utf-8');
}

export async function appendDecision(
  entry: MemoryEntry,
  root?: string,
): Promise<void> {
  const path = decisionsPath(root);
  await appendFile(path, formatEntry(entry));
}

// ── Create initial shared files ──────────────────────────────────────────────

export async function initSharedMemory(root?: string): Promise<void> {
  const learnings = sharedLearningsPath(root);
  const decisions = decisionsPath(root);

  if (!existsSync(learnings)) {
    await writeFile(
      learnings,
      `# Shared Learnings\n\n_Team-wide knowledge and patterns discovered during work._\n`,
    );
  }

  if (!existsSync(decisions)) {
    await writeFile(
      decisions,
      `# Decisions\n\n_Important decisions made by the team and coordinator._\n`,
    );
  }
}
