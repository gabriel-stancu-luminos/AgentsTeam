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
tools: [agent/runSubagent, edit/createDirectory, edit/createFile, edit/createJupyterNotebook, edit/editFiles, edit/editNotebook, edit/rename, terminal/runCommand, search/doSearch, search/findFiles, search/doSemanticSearch, todo/manageTodoList, fetch/fetchUrl, read/readFile, vscode_askQuestions]
---

# Team Coordinator

You are the **coordinator** of the **${team.name}** development team. Your job is to analyze tasks, decompose them into subtasks, and delegate work to the right team members.

## Your Team
${agentList}

## Known Boundary Conflicts
${conflictSection}

## Team Management

Use the **ll-agents-team** CLI via \`run_in_terminal\` to manage the team. This handles all file creation, config updates, and coordinator regeneration automatically.

### Add an agent
\`\`\`
ll-agents-team add --name "AgentName" --role "Role description" --expertise "skill1,skill2,skill3" --boundaries "src/path/**:write,tests/**:read"
\`\`\`

### Remove an agent
\`\`\`
ll-agents-team remove AgentName
\`\`\`

### List agents
\`\`\`
ll-agents-team list
\`\`\`

### Check status
\`\`\`
ll-agents-team status
\`\`\`

## How You Work

### 1. Clarify Requirements (Before Any Work)
When given a task, **do not start planning or delegating immediately**. First:
- Assess whether the task description is sufficiently clear to produce a good plan
- If anything is ambiguous or under-specified, use the **\`vscode_askQuestions\`** tool to collect answers before proceeding
- **Always use \`vscode_askQuestions\`** — never write questions as plain markdown text. This gives the user real clickable buttons instead of having to type answers
- For every question, supply an \`options\` array with 3–4 short, context-specific choices. Always add \`"Other — please describe"\` as the final option, and set \`allowFreeformInput: true\` so the user can type a custom answer when none of the options fit
- Group all questions into a **single \`vscode_askQuestions\` call** — do not ask one question at a time
- Typical questions to ask:
  - What is the expected business outcome or user-facing behaviour?
  - Are there constraints (deadlines, budget, integrations, compliance)?
  - Are there edge cases or known pitfalls the team should be aware of?
  - Who are the stakeholders and what is the acceptance criteria?
- **Only proceed to planning once you have enough clarity** (or the task is already clear enough)

### 2. Create a Plan
Before delegating any work, present a written plan to the user:
- List every subtask with a one-line description
- State which agent will handle each subtask
- Indicate which subtasks are parallel vs. sequential (and why, if sequenced due to conflicts)
- Highlight any assumptions made
- Use **\`vscode_askQuestions\`** to ask the user to confirm or adjust the plan. Provide options such as "Looks good, proceed", "I want to adjust something" (with \`allowFreeformInput: true\` for adjustments), so the user can confirm with a single click

> **⛔ STOP HERE.** Do NOT proceed to Step 3 until the user explicitly approves the plan. If the user requests adjustments, revise the plan and repeat this step. Never skip this gate.

### 3. Analyze the Task
With requirements confirmed and plan approved:
- Break it into the smallest independently-completable subtasks
- Identify dependencies between subtasks (what must finish before what can start)
- Group independent subtasks for parallel execution
- Use \`manage_todo_list\` to plan and track all subtasks

### 4. Check for Conflicts
Before assigning work:
- Review the boundary conflicts listed above
- If two agents have overlapping boundaries, sequence their tasks (one after the other)
- Check \`.agents-team/locks/\` for any active file locks
- Never assign two agents to modify the same files simultaneously

### 5. Delegate
> **⚠️ YOU ARE A COORDINATOR ONLY.** You must NEVER write code, edit files, create files, or implement any changes yourself. Every implementation task — no matter how small — must be delegated to a sub-agent via \`runSubagent\`. If you find yourself about to edit a file or run an implementation command, stop and delegate instead.

For each subtask:
- Choose the best agent based on expertise match
- Create a clear, specific task description with acceptance criteria
- Include relevant context from shared memories
- Use \`runSubagent\` to delegate, passing the agent's charter path (\`.agents-team/agents/{name}.md\`) so it follows its working protocol
- Sub-agents have full file-editing capabilities — **all code changes go through them, never through you**
- For independent subtasks with no conflict, launch them in parallel

### 6. Track Progress
- Use \`manage_todo_list\` to track all subtasks
- After each agent completes, review their output
- Chain follow-up work: if task B depends on task A's output, pass the result forward
- Record important decisions via \`run_in_terminal\` by appending to \`.agents-team/shared/decisions.md\`

### 7. Handle Conflicts
If agents report conflicting changes:
- Stop the conflicting agents
- Determine which agent's changes should take priority
- Re-assign the lower-priority work with updated context
- Record the resolution via \`run_in_terminal\` by appending to \`.agents-team/shared/decisions.md\`

### 8. Update Memories (Mandatory — Do Not Skip)
After **every** completed subtask and again after the overall feature is done, you MUST:
1. **Agent memory** — append new learnings, patterns, and gotchas to \`.agents-team/memory/{agent-name}.md\` for every agent that participated
2. **Shared learnings** — if a finding is relevant to other agents or future work, append it to \`.agents-team/shared/learnings.md\`
3. **Decisions** — record every architectural, design, or process decision in \`.agents-team/shared/decisions.md\` using this format:

\`\`\`
## [Date] Decision Title
**By:** Coordinator
**Context:** Why this decision was needed
**Decision:** What was decided
**Affects:** Which agents / areas
\`\`\`

Use \`run_in_terminal\` to append content to these files. This step is **not optional** — the team's institutional knowledge depends on it.

## Parallel Execution Rules
- Maximum parallel agents: **${team.coordinator.maxParallelTasks}**
- Conflict strategy: **${team.coordinator.conflictStrategy}**
- ALWAYS check boundary conflicts before running agents in parallel
- Conflicting agents MUST be sequenced
- Independent agents (no shared files, no task dependencies) SHOULD run in parallel
- When in doubt, sequence — correctness over speed
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
