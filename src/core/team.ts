import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  type TeamConfig,
  type AgentEntry,
  type CoordinatorConfig,
  TEAM_DIR,
  TEAM_FILE,
  AGENTS_DIR,
  ALUMNI_DIR,
  MEMORY_DIR,
  SHARED_DIR,
  LOCKS_DIR,
  LOG_DIR,
  ROUTING_FILE,
} from './types.js';

// ── Paths ────────────────────────────────────────────────────────────────────

export function getTeamDir(root?: string): string {
  return join(resolve(root ?? '.'), TEAM_DIR);
}

export function getTeamFilePath(root?: string): string {
  return join(getTeamDir(root), TEAM_FILE);
}

export function getRoutingFilePath(root?: string): string {
  return join(getTeamDir(root), ROUTING_FILE);
}

// ── Read / Write ─────────────────────────────────────────────────────────────

export async function teamExists(root?: string): Promise<boolean> {
  return existsSync(getTeamFilePath(root));
}

export async function loadTeam(root?: string): Promise<TeamConfig> {
  const raw = await readFile(getTeamFilePath(root), 'utf-8');
  return JSON.parse(raw) as TeamConfig;
}

export async function saveTeam(
  config: TeamConfig,
  root?: string,
): Promise<void> {
  await writeFile(getTeamFilePath(root), JSON.stringify(config, null, 2) + '\n');
}

// ── Scaffold ─────────────────────────────────────────────────────────────────

export function getGithubAgentsDir(root?: string): string {
  return join(resolve(root ?? '.'), '.github', 'agents');
}

export function getCoordinatorPath(root?: string): string {
  return join(getGithubAgentsDir(root), 'team.md');
}

export function getInitiatorPath(root?: string): string {
  return join(getGithubAgentsDir(root), 'initiator.md');
}

export async function scaffoldTeamDir(root?: string): Promise<string> {
  const teamDir = getTeamDir(root);

  const dirs = [
    teamDir,
    join(teamDir, AGENTS_DIR),
    join(teamDir, ALUMNI_DIR),
    join(teamDir, MEMORY_DIR),
    join(teamDir, SHARED_DIR),
    join(teamDir, LOCKS_DIR),
    join(teamDir, LOG_DIR),
    getGithubAgentsDir(root),
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }

  return teamDir;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export function createDefaultTeam(name?: string): TeamConfig {
  const coordinator: CoordinatorConfig = {
    maxParallelTasks: 6,
    conflictStrategy: 'boundary',
  };

  return {
    name: name ?? 'My Team',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    coordinator,
    agents: [],
  };
}

// ── Agent helpers on team config ─────────────────────────────────────────────

export function findAgent(
  team: TeamConfig,
  name: string,
): AgentEntry | undefined {
  return team.agents.find(
    (a) => a.name.toLowerCase() === name.toLowerCase(),
  );
}

export function addAgentToTeam(
  team: TeamConfig,
  agent: AgentEntry,
): TeamConfig {
  if (findAgent(team, agent.name)) {
    throw new Error(`Agent "${agent.name}" already exists in the team.`);
  }
  return { ...team, agents: [...team.agents, agent] };
}

export function removeAgentFromTeam(
  team: TeamConfig,
  name: string,
): TeamConfig {
  const existing = findAgent(team, name);
  if (!existing) {
    throw new Error(`Agent "${name}" not found in the team.`);
  }
  return {
    ...team,
    agents: team.agents.filter(
      (a) => a.name.toLowerCase() !== name.toLowerCase(),
    ),
  };
}
