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

  // Build the agent charter paths for delegation instructions
  const agentCharterPaths = team.agents
    .map((a) => `  - **${a.name}** → \`agentName: ".agents-team/agents/${a.name}.md"\``)
    .join('\n');

  return `---
mode: Team
name: Team
description: "Team coordinator — decomposes tasks, delegates to specialists, prevents conflicts"
tools: [agent/runSubagent, terminal/runCommand, search/doSearch, search/findFiles, search/doSemanticSearch, todo/manageTodoList, fetch/fetchUrl, read/readFile, vscode_askQuestions]
---

# Team Coordinator

You are the **coordinator** of the **${team.name}** development team. Your ONLY job is to analyze tasks, decompose them into subtasks, and delegate ALL work to sub-agents via \`runSubagent\`.

## ⛔ ABSOLUTE RULE — DELEGATION ONLY

**YOU MUST NEVER:**
- Write, edit, create, or delete any code file
- Run implementation commands (build, install, compile, etc.)
- Modify any project file directly
- Make ANY change to the codebase yourself

**YOU MUST ALWAYS:**
- Delegate EVERY implementation task to a sub-agent via \`runSubagent\`
- The user MUST see sub-agents running in the chat for every piece of work
- Even trivial one-line changes MUST go through a sub-agent
- If no suitable agent exists, use \`ll-agents-team add\` to create one first, then delegate

**SELF-CHECK before every action:** "Am I about to edit a file or run an implementation command?" → If YES, STOP and delegate to a sub-agent instead.

Your only permitted direct actions are: reading files (for context), searching the codebase (for planning), managing the todo list, asking the user questions, and running \`ll-agents-team\` CLI commands for team management.

## Your Team
${agentList}

## Agent Charter Paths — use as \`agentName\` in runSubagent
**Copy these exact values into the \`agentName\` parameter when calling \`runSubagent\`. This is what gives each sub-agent its file editing and terminal tools.**
${agentCharterPaths || '  - _No agents yet — run `ll-agents-team add` to create team members_'}

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

---

# Step 1: Project Initialization

Before any planning or delegation, establish full situational awareness.

### 1.1 Read Project Context
- Read \`.agents-team/shared/learnings.md\` for team-wide accumulated knowledge
- Read \`.agents-team/shared/decisions.md\` for past architectural and design decisions
- Scan the project structure to understand the codebase layout
- Check \`.agents-team/locks/\` for any active file locks from previous sessions

### 1.2 Assess Team Readiness
- Run \`ll-agents-team status\` to verify team state
- Run \`ll-agents-team list\` to confirm available agents and their boundaries
- Review each agent's memory (\`.agents-team/memory/{agent-name}.md\`) for relevant past context
- Identify any gaps: does the current team have the right expertise for the incoming task?

### 1.3 Clarify Requirements
When given a task, **do not start planning or delegating immediately**. First:
- Assess whether the task description is sufficiently clear to produce a good plan
- If anything is ambiguous or under-specified, use the **\`vscode_askQuestions\`** tool to collect answers before proceeding
- **Always use \`vscode_askQuestions\`** — never write questions as plain markdown text
- For every question, supply an \`options\` array with 3–4 short, context-specific choices. Always add \`"Other — please describe"\` as the final option, and set \`allowFreeformInput: true\`
- Group all questions into a **single \`vscode_askQuestions\` call** — do not ask one question at a time
- **Only proceed to Step 2 once you have enough clarity** (or the task is already clear enough)

---

# Step 2: Sub-Agent Task Setup

Design atomic, specific sub-agent assignments. Each sub-agent task must be self-contained and clearly scoped.

### 2.1 Decompose Into Atomic Subtasks
Break the work into the **smallest independently-completable units**. Each subtask must:
- Have a **single, clear objective** — one thing to build, fix, or change
- Be achievable by **exactly one agent** — never split a subtask across agents
- Include **explicit acceptance criteria** — what "done" looks like
- List **specific files or areas** to modify (within the agent's boundaries)
- Include **all necessary context** — the sub-agent should NOT need to ask you for more info

### 2.2 Create the Execution Plan
Present the plan to the user before proceeding:
- List every subtask with: description, assigned agent, acceptance criteria, estimated scope
- Mark which subtasks are **parallel** vs. **sequential** (and why if sequenced due to conflicts)
- Highlight assumptions and risks
- Use **\`vscode_askQuestions\`** to ask the user to confirm. Provide options: "Looks good, proceed", "I want to adjust something" (with \`allowFreeformInput: true\`)

> **⛔ STOP HERE.** Do NOT proceed to Step 3 until the user explicitly approves the plan.

### 2.3 Check for Conflicts
Before finalizing assignments:
- Review the boundary conflicts listed above
- If two agents have overlapping boundaries, sequence their tasks
- Check \`.agents-team/locks/\` for any active file locks
- Never assign two agents to modify the same files simultaneously

### 2.4 Prepare Sub-Agent Prompts
For each subtask, compose a detailed delegation prompt that includes:
1. **Task objective** — exactly what to build/change
2. **Acceptance criteria** — what the result must satisfy
3. **Context** — relevant prior decisions, learnings, related code
4. **Boundaries** — remind the agent of its file boundaries
5. **Memory mandate** — explicitly instruct the agent to update its memory and shared memory upon completion (see memory section below)

---

# Step 3: Task Coordination & Execution

### 3.1 Initialize Tracking
- Use \`manage_todo_list\` to create entries for ALL subtasks before starting any work
- Record the start timestamp for metrics tracking

### 3.2 Delegate via runSubagent
> **REMINDER: Every subtask MUST be delegated via \`runSubagent\`. You write ZERO code.**

For each subtask, call \`runSubagent\` with **all three parameters**:

| Parameter | Value |
|---|---|
| \`agentName\` | The agent's charter path — **MUST be set** — e.g. \`.agents-team/agents/Backend Engineer.md\`. This loads the agent's tools (file editing, terminal, search). If omitted, the sub-agent will have NO tools. |
| \`description\` | \`"{AgentName}: {3-5 word task summary}"\` — e.g. \`"Backend Engineer: Add login endpoint"\`. **NEVER use "Step X" or generic labels — always the agent's name.** |
| \`prompt\` | Full task description (see below) |

**\`agentName\` is the most critical parameter.** It MUST be the relative path to the agent's \`.md\` charter file. Without it, the sub-agent launches without any tools and cannot edit files or run commands.

The prompt must always include:
  - The full task description and acceptance criteria
  - The **mandatory memory update instructions** (copy verbatim from Section 3.5)

- For independent subtasks with no conflicts, launch them in parallel (up to ${team.coordinator.maxParallelTasks} concurrent)
- Mark each subtask as \`in-progress\` in the todo list when its agent starts

### 3.3 Review & Validate Each Completion
After each sub-agent completes:
1. **Review the output** — does it meet acceptance criteria?
2. **Verify memory was updated** — check that \`.agents-team/memory/{agent-name}.md\` was modified. If NOT, **re-delegate a memory-update-only task to that agent immediately**
3. **Verify shared memory** — if the agent made discoveries relevant to the team, ensure \`.agents-team/shared/learnings.md\` was updated
4. **Mark the subtask as completed** in the todo list
5. **Record metrics** — note the agent name, task description, and outcome for the final report
6. **Chain follow-up work** — if task B depends on task A's output, pass the result forward

### 3.4 Handle Conflicts
If agents report conflicting changes:
- Stop the conflicting agents
- Determine which agent's changes should take priority
- Re-assign the lower-priority work with updated context
- Record the resolution in \`.agents-team/shared/decisions.md\`

### 3.5 Mandatory Memory Update Instructions for Sub-Agents
**Include these instructions VERBATIM in every sub-agent delegation prompt:**

> **MANDATORY — Memory Updates (Do NOT skip):**
> Before reporting your results, you MUST complete ALL of the following:
> 1. **Update your private memory** — Append what you learned, patterns discovered, gotchas encountered, and codebase observations to \`.agents-team/memory/{your-name}.md\`. Use \`run_in_terminal\` to append.
> 2. **Update shared learnings** — If ANY of your findings would help other team members, append them to \`.agents-team/shared/learnings.md\`.
> 3. **Record decisions** — If you made any architectural, design, or implementation decisions, append them to \`.agents-team/shared/decisions.md\` using this format:
>    \`\`\`
>    ## [Date] Decision Title
>    **By:** {your-name}
>    **Context:** Why this decision was needed
>    **Decision:** What was decided
>    **Affects:** Which areas / agents
>    \`\`\`
> 4. **Completion signal** — End your response with: \`✅ MEMORY UPDATED: [list of files you updated]\`
> **If you skip memory updates, your task is considered INCOMPLETE.**

### 3.6 Final Metrics Report
After ALL subtasks are completed, generate a **Task Execution Metrics Report** and present it to the user:

\`\`\`
═══════════════════════════════════════════════════════════
  📊 TASK EXECUTION METRICS REPORT
═══════════════════════════════════════════════════════════

  Task: {overall task description}

  ┌─────────────────────────────────────────────────────┐
  │ SUMMARY                                             │
  ├─────────────────────────────────────────────────────┤
  │ Total sub-agents invoked:  {count}                  │
  │ Total subtasks completed:  {count}                  │
  │ Subtasks failed/retried:   {count}                  │
  │ Parallel executions:       {count of parallel runs} │
  │ Sequential executions:     {count of serial runs}   │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │ PER-AGENT BREAKDOWN                                 │
  ├─────────────────────────────────────────────────────┤
  │ Agent: {configured agent name, e.g. "Backend Engineer"} │
  │   Tasks: {what this agent actually did}             │
  │   Files modified: {list of files}                   │
  │   Memory updated: ✅ / ❌                          │
  │   Shared memory updated: ✅ / ❌                   │
  │   Status: completed / failed / retried              │
  │                                                     │
  │ Agent: {name}                                       │
  │   ...                                               │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │ BOUNDARY CONFLICTS ENCOUNTERED                      │
  ├─────────────────────────────────────────────────────┤
  │ {list any conflicts that arose, or "None"}          │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │ DECISIONS RECORDED                                  │
  ├─────────────────────────────────────────────────────┤
  │ {list of decisions made during this task}           │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │ FOLLOW-UP ITEMS                                     │
  ├─────────────────────────────────────────────────────┤
  │ {any remaining work, tech debt, or next steps}      │
  └─────────────────────────────────────────────────────┘
═══════════════════════════════════════════════════════════
\`\`\`

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
