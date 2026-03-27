# ll-agents-team

**Lightweight AI agent team orchestration for any project.**

A CLI + Copilot agent system with two roles:

- **Coach** â€” scans your codebase (source files, build output, decompiled package declarations), proposes a set of sharply-defined agents tailored to your project, and creates them. Run once to set up, re-run whenever the architecture changes.
- **Team** â€” the coordinator. Takes a development task, clarifies requirements, plans subtasks, delegates to specialist agents in parallel, prevents file conflicts, validates results, and reports back.

Agents are persistent. They accumulate memory about your codebase across sessions and share knowledge with each other.

---

## Quick Start

### 1. Install

```bash
npm install -g ll-agents-team
```

### 2. Initialize your project

```bash
cd my-project
ll-agents-team init --name "My App Team"
```

This creates `.agents-team/` with your team configuration, shared memory files, and two Copilot agents under `.github/agents/`: **Coach** and **Team**.

### 3. Design your team with the Coach

Open Copilot Chat, select the **Coach** agent, and say **"set up the team"**.

> **Note:** After `init`, the Coach agent is ready to use immediately — no extra CLI command needed. Run `ll-agents-team coach` only if you're re-running setup later (after a refactor, new service, or team redesign) to refresh the agent files with the latest team state before opening the Coach.

The Coach will:
1. Map your project structure and read dependency files (npm, NuGet, pip, Maven)
2. Read 4â€“6 source files per bounded context â€” entry points, controllers, services, domain models, repositories, tests, and config
3. Scan decompiled package declarations (`.d.ts` files, NuGet XML docs, `.cs` decompiled sources) to identify real class/interface names used in your code
4. Scan build output (`dist/`, `bin/`, `out/`, `.next/`, `target/`) and read `.d.ts` declaration files, source maps, and assembly names to discover module boundaries
5. Propose a set of agents named after actual business capabilities and class names found in your code, with tight file boundaries
6. Ask you to confirm or adjust the proposal
7. Create the agents via the CLI and validate with `ll-agents-team status`

**Or add agents manually:**

```bash
ll-agents-team add \
  --name "Storefront Dev" \
  --role "Implements Vue storefront components, blocks, and Pinia stores" \
  --expertise "Vue 3,Pinia,TypeScript,SCSS,Vite" \
  --boundaries "src/storefront/**:write,tests/storefront/**:write"
```

### 4. Give a task to the Team coordinator

Open Copilot Chat, select the **Team** agent, and describe what you need:

```
I need to create a new Hero Banner block in the storefront
```

The Team coordinator will clarify requirements, present a plan for your approval, delegate subtasks to agents in parallel, validate memory updates after each completion, and produce a metrics report.

---

## How It Works

### The Coach Agent

The Coach (`.github/agents/coach.md`) is responsible for designing and maintaining your agent team. It only talks to you â€” it never delegates to sub-agents.

**When to use it:** Run `ll-agents-team coach` and open the Coach in Copilot Chat when you first set up the team, after a significant refactor, or when new services are added and the current team composition is stale.

**What it does in detail:**

| Phase | What happens |
|---|---|
| **Reconnaissance** | Reads structure, dependencies, source files, decompiled declarations, build output, existing agent config, retired agent history, and individual agent memory files |
| **Summary gate** | Writes a structured summary of bounded contexts, tech stack, decompiled classes, and coverage gaps before designing anything |
| **Design** | Proposes agents with names derived from real class names, expertise items from actual package names and interface names, and globs from real file paths |
| **Validation** | Asks you to confirm or adjust the design with `vscode_askQuestions` before creating anything |
| **Creation** | Runs `ll-agents-team add` for each agent, then regenerates coordinator files |
| **Verify** | Runs `ll-agents-team status` and checks `routing.json` for orphaned rules |

Three **process agents** are always proposed alongside domain agents and are mandatory unless you explicitly reject them:

| Agent | Role |
|---|---|
| **Clarifier** | Asks every clarification question for each feature until zero assumptions remain |
| **Planner** | Designs the full execution plan once clarifications are resolved |
| **Reviewer** | Reviews every implementation against acceptance criteria and ensures fixes before sign-off |

### The Team Coordinator

The Team coordinator (`.github/agents/team.md`) handles day-to-day development tasks. It delegates everything â€” it never writes code itself.

**Workflow for every task:**

1. **Read context** â€” shared learnings, decisions, agent memories, active file locks
2. **Clarify** â€” delegates to the Clarifier agent (or asks directly if no Clarifier exists) until zero assumptions remain
3. **Plan** â€” delegates to the Planner agent (or plans itself), presents the plan, waits for your explicit confirmation
4. **Delegate** â€” launches sub-agents via `runSubagent`, up to the configured parallel limit
5. **Validate** â€” after each sub-agent completes, checks that memory files were updated
6. **Review** â€” delegates to the Reviewer agent (mandatory if one exists) before declaring the feature done
7. **Report** â€” produces a structured metrics report (agents invoked, files modified, decisions recorded, follow-up items)

### Conflict Prevention

Each agent declares **file boundaries** â€” glob patterns defining what they can modify:

```bash
--boundaries "src/storefront/**:write,src/styles/**:exclusive"
```

| Access level | Meaning |
|---|---|
| `read` | Can read but not modify |
| `write` | Can modify (shared with others) |
| `exclusive` | Only this agent may modify these files |

The coordinator detects overlapping write/exclusive boundaries and never runs conflicting agents in parallel. A runtime lock manager prevents concurrent modifications even for non-overlapping boundary pairs that happen to touch the same files.

### Memory System

All memory persists across sessions. **Commit `.agents-team/` to your repo** â€” everyone who clones it gets the full team with accumulated knowledge.

| File | What it contains |
|---|---|
| `.agents-team/memory/{name}.md` | Each agent's private learnings â€” patterns, gotchas, codebase observations |
| `.agents-team/shared/learnings.md` | Team-wide knowledge relevant to all agents |
| `.agents-team/shared/decisions.md` | Log of architectural and design decisions |
| `.agents-team/log/activity.jsonl` | Structured event log of everything the team does |

Agents are required to update their memory after every task. The coordinator explicitly validates this and re-delegates a memory-update task if an agent skips it.

---

## Example â€” What happens when you give a task

**Task:** "I need to create a new Hero Banner block in the storefront"

**Step 1 â€” Context read**
The coordinator reads shared memory and finds: blocks live in `src/storefront/blocks/`, each block has `index.vue` + `types.ts`, no active file locks.

**Step 2 â€” Clarification**
The Clarifier agent asks: "What content does the Hero Banner need?" You answer: "Image, headline, and CTA button â€” configurable via CMS fields."

**Step 3 â€” Plan (presented for approval)**
```
Subtask 1 â€” Storefront Dev (parallel with Subtask 2)
  Create src/storefront/blocks/HeroBanner/index.vue + types.ts
  Acceptance: Vue component renders, CMS fields wired via useCmsField()

Subtask 2 â€” Backend API Dev (parallel with Subtask 1)
  Add HeroBannerBlockDto.cs + mapper entry
  Acceptance: GET /api/content returns HeroBanner fields

Subtask 3 â€” Storefront Dev (after Subtasks 1 + 2)
  Integration test: block fetches and renders live CMS data
```

**Step 4 â€” Parallel execution**
Subtasks 1 and 2 run simultaneously. Both agents update their memory files. The coordinator validates memory updates before proceeding.

**Step 5 â€” Review**
The Reviewer agent reads all changed files, verifies acceptance criteria, and signs off.

**Step 6 â€” Metrics report**
```
Total sub-agents invoked:  2
Subtasks completed:        3 (1 parallel batch + 1 sequential)
Storefront Dev  â€” 2 tasks | 4 files | Memory âœ…
Backend API Dev â€” 1 task  | 3 files | Memory âœ…
Boundary conflicts: None
```

---

## Commands

| Command | What it does |
|---|---|
| `ll-agents-team init` | Scaffold `.agents-team/` in the current project |
| `ll-agents-team coach` | Regenerate the Coach and Team agents with latest team state |
| `ll-agents-team add` | Add an agent manually |
| `ll-agents-team add --template <key>` | Add an agent from a pre-built template |
| `ll-agents-team templates` | List all available agent templates |
| `ll-agents-team remove <name>` | Remove an agent (charter preserved in `_alumni/`) |
| `ll-agents-team list` | List all agents and show boundary conflicts |
| `ll-agents-team status` | Live dashboard â€” agents, locks, routing, recent activity |
| `ll-agents-team status --watch` | Auto-refreshing dashboard (every 3 seconds) |
| `ll-agents-team regenerate` | Regenerate coordinator and all agent charter files from latest state |

---

## Skills

Four skills ship with the project under `.github/skills/`. They are loaded automatically by the Team coordinator and Coach when the relevant tool is needed, and are also available as slash commands in Copilot Chat.

| Skill | Tool | Use for |
|---|---|---|
| `build-diagnostics` | `problems` | Reading VS Code diagnostics after code changes — zero new errors is the pass bar |
| `codebase` | `codebase` | Semantic search and file exploration before planning or delegating |
| `git` | `git` | Committing completed work, checking state, reading recent history |
| `github-pr-workflow` | `github` | Creating PRs with structured body, acceptance criteria, and linked issues |

Invoke directly with a slash command:

```
/build-diagnostics after Backend Engineer completed auth changes
/codebase find all usages of OrderService
/git commit completed storefront changes
/github-pr-workflow Hero Banner block — storefront
```

## Agent Templates

Pre-built templates include a full role description, expertise list, file boundaries, and working protocol.

```bash
ll-agents-team templates   # list all available templates

# Add from template â€” no --role or --expertise required
ll-agents-team add --name "BackendDev"      --template generic/backend-dev
ll-agents-team add --name "FrontendDev"     --template generic/frontend-dev
ll-agents-team add --name "DocDev"          --template generic/doc-dev
ll-agents-team add --name "OptiFeatureDev"  --template ita-opti/opti-feature-dev
ll-agents-team add --name "PECoreDev"       --template ita-pricing-engine/pe-core-dev
ll-agents-team add --name "OMSOrderDev"     --template ita-oms/oms-order-dev
```

Available categories: `generic/`, `ita-opti/`, `ita-pricing-engine/`, `ita-oms/`

You can override any template field by passing the CLI flag explicitly â€” it takes precedence:

```bash
ll-agents-team add --name "BackendDev" --template generic/backend-dev --role "Senior Backend Dev"
```

---

## What Gets Created

```
.agents-team/
├── team.json                   # Team roster and coordinator config
├── routing.json                # File routing rules (regex → agent)
├── copilot-instructions.md     # Copilot workspace context file
├── agents/
│   ├── {name}.md               # Agent charters
│   └── _alumni/                # Charters of removed agents (preserved)
├── shared/
│   ├── decisions.md            # Architectural decisions log
│   └── learnings.md            # Shared team knowledge
├── memory/
│   └── {name}.md               # Per-agent memory files
├── locks/                      # Active file locks (ephemeral, not committed)
└── log/
    └── activity.jsonl          # Structured event log

.github/agents/
├── coach.md                    # Coach agent — team design and setup
└── team.md                     # Team coordinator agent — task execution

.github/skills/
├── build-diagnostics/          # problems tool — post-agent error validation
│   └── SKILL.md
├── codebase/                   # codebase tool — semantic search and file exploration
│   └── SKILL.md
├── git/                        # git tool — committing work, checking state, history
│   └── SKILL.md
└── github-pr-workflow/         # github tool — PR creation with structured body
    └── SKILL.md
```

Commit `.agents-team/` (excluding `locks/`). Your team and all accumulated knowledge persists for the whole repository.

---

## Activity Log

Every meaningful action is appended to `.agents-team/log/activity.jsonl`:

```jsonl
{"timestamp":"2026-03-25T10:01:00Z","event":"team:initialized","detail":"Team \"My App Team\" initialized"}
{"timestamp":"2026-03-25T10:02:30Z","event":"agent:added","agent":"Storefront Dev","detail":"Added agent (Vue 3, Pinia, TypeScript)"}
{"timestamp":"2026-03-25T10:15:00Z","event":"lock:acquired","agent":"Storefront Dev","taskId":"a1b2c3","detail":"Locked: src/storefront/blocks/HeroBanner/index.vue"}
{"timestamp":"2026-03-25T10:17:05Z","event":"memory:updated","agent":"Storefront Dev","detail":"HeroBanner uses useCmsField() composable"}
```

Read it programmatically:

```typescript
import { readActivityLog } from 'll-agents-team';

const last50 = await readActivityLog(undefined, 50);
const lockEvents = last50.filter(e => e.event === 'lock:acquired');
```

---

## Programmatic API

```typescript
import {
  loadTeam,
  createAgentEntry,
  addAgentToTeam,
  canRunParallel,
  matchAgent,
  loadRouting,
  createTask,
  createTaskPlan,
  appendAgentMemory,
  appendActivity,
  readActivityLog,
} from 'll-agents-team';

// Check if two agents can safely run in parallel
const team = await loadTeam();
const storefront = team.agents.find(a => a.name === 'Storefront Dev')!;
const backend = team.agents.find(a => a.name === 'Backend API Dev')!;
console.log(canRunParallel(storefront, backend)); // true â€” no boundary overlap

// Route a task description to the best matching agent
const routing = await loadRouting();
const match = matchAgent('build the React login form', team, routing);
console.log(match?.name); // "Storefront Dev"

// Build a task plan and compute parallel groups
const tasks = [
  createTask('Build HeroBanner component', 'Storefront Dev'),
  createTask('Add HeroBanner CMS schema', 'Backend API Dev'),
  createTask('Write integration test', 'Storefront Dev', ['task-1-id', 'task-2-id']),
];
const plan = createTaskPlan('Hero Banner feature', tasks);
console.log(plan.parallelGroups);
// [['task-1', 'task-2'], ['task-3']]

// Append a custom activity event
await appendActivity({
  event: 'task:status-changed',
  agent: 'Storefront Dev',
  taskId: 'abc123',
  detail: 'Task moved to in-progress',
});
```

---

## Configuration

### team.json

```json
{
  "name": "My App Team",
  "version": "1.0.0",
  "coordinator": {
    "maxParallelTasks": 4,
    "conflictStrategy": "boundary"
  },
  "agents": []
}
```

| Field | Description |
|---|---|
| `maxParallelTasks` | Maximum agents running simultaneously (default: 4) |
| `conflictStrategy` | `boundary` â€” use file boundaries (default) \| `lock` â€” runtime locks \| `queue` â€” fully sequential |

### routing.json

```json
{
  "rules": [
    { "pattern": "React|CSS|component|storefront", "agent": "Storefront Dev", "priority": 10 },
    { "pattern": "API|database|auth|DTO", "agent": "Backend API Dev", "priority": 10 }
  ]
}
```

Rules are regex patterns matched against task descriptions. Highest priority wins. Default rules are auto-generated when you add an agent.

---

## Requirements

- Node.js >= 20.0.0
- VS Code with GitHub Copilot

## License

MIT

