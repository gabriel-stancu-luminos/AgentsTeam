import type { AgentEntry, TeamConfig } from './types.js';

// ── Glob-to-regex conversion (basic) ─────────────────────────────────────────

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

// ── Boundary conflict detection ──────────────────────────────────────────────

/**
 * Returns file patterns where two agents have overlapping write/exclusive boundaries.
 * If the returned array is non-empty, these agents should NOT run in parallel.
 */
export function checkBoundaryConflict(
  agent1: AgentEntry,
  agent2: AgentEntry,
): string[] {
  const conflicts: string[] = [];

  const writeBoundaries1 = agent1.boundaries.filter(
    (b) => b.access === 'write' || b.access === 'exclusive',
  );
  const writeBoundaries2 = agent2.boundaries.filter(
    (b) => b.access === 'write' || b.access === 'exclusive',
  );

  for (const b1 of writeBoundaries1) {
    for (const b2 of writeBoundaries2) {
      if (patternsOverlap(b1.pattern, b2.pattern)) {
        conflicts.push(`${b1.pattern} <-> ${b2.pattern}`);
      }
    }
  }

  return conflicts;
}

/**
 * Two glob patterns "overlap" if one matches the other's literal text,
 * or they share the same concrete directory prefix (up to the first wildcard).
 */
function patternsOverlap(a: string, b: string): boolean {
  // Identical pattern
  if (a === b) return true;

  const regA = globToRegex(a);
  const regB = globToRegex(b);

  // Direct match: pattern A matches pattern B's literal or vice versa
  if (regA.test(b) || regB.test(a)) return true;

  // Extract the concrete prefix before any wildcard
  const concretePrefix = (p: string) => {
    const parts = p.split('/');
    const concrete: string[] = [];
    for (const part of parts) {
      if (part.includes('*') || part.includes('?')) break;
      concrete.push(part);
    }
    return concrete.join('/');
  };

  const prefixA = concretePrefix(a);
  const prefixB = concretePrefix(b);

  // One prefix is a parent of the other (e.g., "src/frontend" and "src/frontend/components")
  if (prefixA && prefixB) {
    if (prefixA.startsWith(prefixB + '/') || prefixB.startsWith(prefixA + '/')) return true;
    if (prefixA === prefixB) return true;
  }

  return false;
}

// ── Parallel safety check ────────────────────────────────────────────────────

/**
 * Returns true if two agents can safely run in parallel (no boundary conflicts).
 */
export function canRunParallel(
  agent1: AgentEntry,
  agent2: AgentEntry,
): boolean {
  return checkBoundaryConflict(agent1, agent2).length === 0;
}

/**
 * Given a team and a list of agent names, compute which pairs conflict.
 * Returns a set of pairs [name1, name2] that must be sequenced.
 */
export function computeConflictPairs(
  team: TeamConfig,
  agentNames: string[],
): [string, string][] {
  const pairs: [string, string][] = [];
  const agents = agentNames
    .map((name) =>
      team.agents.find((a) => a.name.toLowerCase() === name.toLowerCase()),
    )
    .filter((a): a is AgentEntry => a !== undefined);

  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      if (!canRunParallel(agents[i], agents[j])) {
        pairs.push([agents[i].name, agents[j].name]);
      }
    }
  }

  return pairs;
}

// ── Coordinator prompt generation ────────────────────────────────────────────

export function generateCoordinatorPrompt(team: TeamConfig): string {
  const agentList = team.agents
    .map((a) => {
      const expertise = a.expertise.join(', ');
      const boundaries = a.boundaries
        .map((b) => `\`${b.pattern}\` (${b.access})`)
        .join(', ');
      return `- **${a.name}** — ${a.role} | Expertise: ${expertise} | Boundaries: ${boundaries || 'none'}`;
    })
    .join('\n');

  // Pre-compute conflict pairs
  const allNames = team.agents.map((a) => a.name);
  const conflicts = computeConflictPairs(team, allNames);
  const conflictSection =
    conflicts.length > 0
      ? conflicts
          .map(([a, b]) => `- **${a}** and **${b}** have overlapping file boundaries — MUST be sequenced`)
          .join('\n')
      : '- _No boundary conflicts detected — all agents can run in parallel if tasks are independent_';

  return `---
mode: Team
name: Team
description: "Team coordinator — decomposes tasks, delegates to specialists, prevents conflicts"
tools:
  - read_file
  - create_file
  - replace_string_in_file
  - multi_replace_string_in_file
  - run_in_terminal
  - runSubagent
  - manage_todo_list
  - file_search
  - grep_search
  - semantic_search
---

# Team Coordinator

You are the **coordinator** of the **${team.name}** development team. Your job is to analyze tasks, decompose them into subtasks, and delegate work to the right team members.

## Your Team
${agentList}

## Known Boundary Conflicts
${conflictSection}

## How You Work

### 1. Analyze the Task
When given a task:
- Break it into the smallest independently-completable subtasks
- Identify dependencies between subtasks (what must finish before what can start)
- Group independent subtasks for parallel execution
- Use \`manage_todo_list\` to plan and track all subtasks

### 2. Check for Conflicts
Before assigning work:
- Review the boundary conflicts listed above
- If two agents have overlapping boundaries, sequence their tasks (one after the other)
- Check \`.agents-team/locks/\` for any active file locks
- Never assign two agents to modify the same files simultaneously

### 3. Delegate
For each subtask:
- Choose the best agent based on expertise match
- Create a clear, specific task description with acceptance criteria
- Include relevant context from shared memories
- Use \`runSubagent\` to delegate, telling the sub-agent to follow the instructions in its charter file at \`.agents-team/agents/{name}.md\`
- For independent subtasks with no conflict, launch them in parallel

### 4. Track Progress
- Use \`manage_todo_list\` to track all subtasks
- After each agent completes, review their output
- Chain follow-up work: if task B depends on task A's output, pass the result forward
- Record important decisions in \`.agents-team/shared/decisions.md\`

### 5. Handle Conflicts
If agents report conflicting changes:
- Stop the conflicting agents
- Determine which agent's changes should take priority
- Re-assign the lower-priority work with updated context
- Add a note to \`.agents-team/shared/decisions.md\` explaining the resolution

### 6. Update Memories
After each completed task:
- Append learnings to the agent's memory: \`.agents-team/memory/{agent-name}.md\`
- If a learning affects the whole team, also add to \`.agents-team/shared/learnings.md\`
- Major decisions go in \`.agents-team/shared/decisions.md\`

## Parallel Execution Rules
- Maximum parallel agents: **${team.coordinator.maxParallelTasks}**
- Conflict strategy: **${team.coordinator.conflictStrategy}**
- ALWAYS check boundary conflicts before running agents in parallel
- Conflicting agents MUST be sequenced
- Independent agents (no shared files, no task dependencies) SHOULD run in parallel
- When in doubt, sequence — correctness over speed

## Decision Format
When recording a decision in \`.agents-team/shared/decisions.md\`:
\`\`\`
## [Date] Decision Title
**By:** Coordinator
**Context:** Why this decision was needed
**Decision:** What was decided
**Affects:** Which agents / areas
\`\`\`
`;
}

// ── Copilot workspace instructions ───────────────────────────────────────────

export function generateCopilotInstructions(team: TeamConfig): string {
  const agentList = team.agents
    .map((a) => `- **${a.name}**: ${a.role} (${a.expertise.join(', ')})`)
    .join('\n');

  return `# Team Context

This project uses **ll-agents-team** for AI agent coordination.

## Team: ${team.name}

### Members
${agentList || '- _No agents yet — run `ll-agents-team add` to add team members_'}

### Coordinator
The team coordinator decomposes tasks, delegates to specialists, and prevents conflicts.
See \`.github/agents/team.md\` for the coordinator agent — it appears as **Team** in the Copilot chat.

### Shared Knowledge
- **Decisions:** \`.agents-team/shared/decisions.md\`
- **Learnings:** \`.agents-team/shared/learnings.md\`
- **Individual memories:** \`.agents-team/memory/{agent-name}.md\`

### Conflict Prevention
- Each agent has defined file boundaries
- Agents with overlapping boundaries are never run in parallel
- The coordinator manages all task sequencing
`;
}
