import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  type RoutingConfig,
  type RoutingRule,
  type TeamConfig,
  type AgentEntry,
  ROUTING_FILE,
} from './types.js';
import { getTeamDir } from './team.js';

// ── Paths ────────────────────────────────────────────────────────────────────

export function getRoutingPath(root?: string): string {
  return join(getTeamDir(root), ROUTING_FILE);
}

// ── Read / Write ─────────────────────────────────────────────────────────────

export async function loadRouting(root?: string): Promise<RoutingConfig> {
  const path = getRoutingPath(root);
  if (!existsSync(path)) return { rules: [] };
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as RoutingConfig;
}

export async function saveRouting(
  config: RoutingConfig,
  root?: string,
): Promise<void> {
  await writeFile(getRoutingPath(root), JSON.stringify(config, null, 2) + '\n');
}

// ── Rule management ──────────────────────────────────────────────────────────

export async function addRoutingRule(
  rule: RoutingRule,
  root?: string,
): Promise<void> {
  const config = await loadRouting(root);
  config.rules.push(rule);
  config.rules.sort((a, b) => b.priority - a.priority);
  await saveRouting(config, root);
}

export async function removeRoutingRules(
  agentName: string,
  root?: string,
): Promise<number> {
  const config = await loadRouting(root);
  const before = config.rules.length;
  config.rules = config.rules.filter(
    (r) => r.agent.toLowerCase() !== agentName.toLowerCase(),
  );
  const removed = before - config.rules.length;
  if (removed > 0) await saveRouting(config, root);
  return removed;
}

// ── Task → Agent matching ────────────────────────────────────────────────────

/**
 * Match a task description to the best agent using routing rules
 * and expertise keyword matching.
 */
export function matchAgent(
  taskDescription: string,
  team: TeamConfig,
  routing: RoutingConfig,
): AgentEntry | null {
  const desc = taskDescription.toLowerCase();

  // 1. Check explicit routing rules (ordered by priority)
  for (const rule of routing.rules) {
    try {
      const re = new RegExp(rule.pattern, 'i');
      if (re.test(taskDescription)) {
        const agent = team.agents.find(
          (a) => a.name.toLowerCase() === rule.agent.toLowerCase(),
        );
        if (agent) return agent;
      }
    } catch {
      // Invalid regex pattern — skip
    }
  }

  // 2. Fall back to expertise keyword matching
  let bestMatch: AgentEntry | null = null;
  let bestScore = 0;

  for (const agent of team.agents) {
    let score = 0;
    for (const exp of agent.expertise) {
      if (desc.includes(exp.toLowerCase())) {
        score += 1;
      }
    }
    // Also match role keywords
    const roleWords = agent.role.toLowerCase().split(/\s+/);
    for (const word of roleWords) {
      if (word.length > 2 && desc.includes(word)) {
        score += 0.5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = agent;
    }
  }

  return bestMatch;
}

// ── Generate default routing rules for an agent ──────────────────────────────

export function generateDefaultRules(agent: AgentEntry): RoutingRule[] {
  const rules: RoutingRule[] = [];
  for (const exp of agent.expertise) {
    rules.push({
      pattern: exp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      agent: agent.name,
      priority: 10,
    });
  }
  return rules;
}
