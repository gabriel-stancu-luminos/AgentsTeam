# ll-agents-team

**Lightweight AI agent team orchestration for any project.** One command sets up a coordinator that decomposes tasks, delegates to specialist agents in parallel, prevents file conflicts, and now keeps a full audit trail of everything the team does.

---

## Quick Start

### 1. Install

```bash
npm install -g ll-agents-team
```

### 2. Initialize in your project

```bash
cd my-project
ll-agents-team init --name "My App Team"
```

### 3. Set up your team

```bash
ll-agents-team coach
```

Then open Copilot Chat, select the **Team** agent, and say **"set up the team"**. The coordinator will scan your workspace, propose specific agents named after real classes and business capabilities found in your code, and create them automatically.

**Or add agents manually:**

```bash
ll-agents-team add --name "Storefront Dev" \
  --role "Implements Vue storefront components, blocks, and Pinia stores" \
  --expertise "Vue 3 Composition API,Pinia,TypeScript,SCSS modules,Vite" \
  --boundaries "src/storefront/**:write,tests/storefront/**:write"
```

### 4. Give a task to the coordinator

Open Copilot Chat, select the **Team** agent, and describe what you need:

```
I need to create a new Hero Banner block in the storefront
```

The coordinator will clarify, plan, delegate in parallel, validate memory updates, and report back with a metrics summary.

---

## Commands

| Command | What it does |
|---------|-------------|
| `ll-agents-team init` | Scaffold `.agents-team/` in the current project |
| `ll-agents-team coach` | Regenerate the Team coordinator with latest team state |
| `ll-agents-team add` | Add an agent with name, role, expertise, and boundaries |
| `ll-agents-team add --template <key>` | Add an agent from a pre-built template |
| `ll-agents-team templates` | List all available agent templates |
| `ll-agents-team remove <name>` | Remove an agent (charter preserved in `_alumni/`) |
| `ll-agents-team list` | List all team members and boundary conflicts |
| `ll-agents-team status` | Rich terminal dashboard — agents, locks, activity, routing |
| `ll-agents-team status --watch` | Live-refreshing dashboard (updates every 3 seconds) |
| `ll-agents-team regenerate` | Regenerate the coordinator and all agent charter files |

---

## Activity Log

Every meaningful action the team takes is automatically appended to `.agents-team/log/activity.jsonl` as a structured JSONL record:

```jsonl
{"timestamp":"2026-03-25T10:01:00Z","event":"team:initialized","detail":"Team \"My App Team\" initialized"}
{"timestamp":"2026-03-25T10:02:30Z","event":"agent:added","agent":"Alice","detail":"Added agent \"Alice\" (Frontend Developer)","meta":{"expertise":["React","CSS","TypeScript"],"boundaries":2}}
{"timestamp":"2026-03-25T10:15:00Z","event":"lock:acquired","agent":"Alice","taskId":"a1b2c3d4","detail":"Locked: src/frontend/App.tsx"}
{"timestamp":"2026-03-25T10:17:00Z","event":"memory:updated","agent":"Alice","detail":"learning: App.tsx uses Context API for state management"}
{"timestamp":"2026-03-25T10:17:05Z","event":"lock:released","agent":"Alice","detail":"Released: src/frontend/App.tsx"}
```

**Captured events:**

| Event | When it fires |
|---|---|
| `team:initialized` | `init` completes |
| `agent:added` | `add` completes |
| `agent:removed` | `remove` completes |
| `lock:acquired` | an agent acquires a file lock |
| `lock:released` | a lock is released |
| `memory:updated` | any agent or shared memory write |
| `task:created` | a task is created via the API |
| `task:assigned` | a task is assigned to an agent |
| `task:status-changed` | a task changes status |

**Read the log from code:**

```typescript
import { readActivityLog } from 'll-agents-team';

const last50 = await readActivityLog(undefined, 50);
const lockEvents = last50.filter(e => e.event === 'lock:acquired');
```

Commit `.agents-team/log/activity.jsonl` — it gives you a full history of what the team did and when.

---

## Status Dashboard

`ll-agents-team status` renders a rich colour-coded terminal view:

```
  🤖  My App Team  ·  3 agents  ·  max 4 parallel  ·  boundary strategy

  AGENTS  (3)
  ──────────────────────────────────────────────────────────────────
  Alice             Frontend Developer  [12 memories]
    Expertise:   React, TypeScript, CSS
    Boundaries:  src/frontend/** (write), src/styles/** (exclusive)
    Last:        10:17:05  learning: App.tsx uses Context API…

  ACTIVE LOCKS  (1)
  ──────────────────────────────────────────────────────────────────
  ⚑  src/api/auth.ts  →  Bob  (task: 9f3a1c2d)  ·  28m remaining

  RECENT ACTIVITY  (10)
  ──────────────────────────────────────────────────────────────────
  10:17:05  memory:updated          Alice           learning: App.tsx uses Context…
  10:15:00  lock:acquired           Bob             Locked: src/api/auth.ts
  10:02:30  agent:added             Alice           Added agent "Alice" (Frontend…

  ROUTING RULES  (4)
  ──────────────────────────────────────────────────────────────────
  /React|CSS|component/  →  Alice  (priority: 10)
```

Add `--watch` to keep it updating live:

```bash
ll-agents-team status --watch   # refreshes every 3s, Ctrl+C to exit
```

---

## How It Works

### The Coordinator

The coordinator is a Copilot agent (`.github/agents/team.md`, visible as **Team** in the agent picker). It:

1. **Reads context** — shared learnings, decisions, agent memories, active locks
2. **Clarifies** — asks targeted questions via `vscode_askQuestions` if the task is ambiguous
3. **Plans** — presents a written plan and waits for your confirmation before doing anything
4. **Delegates** — launches sub-agents via `runSubagent`, never writes code itself
5. **Parallelizes** — runs independent agents simultaneously (up to the configured max)
6. **Validates** — checks memory was updated after each sub-agent completes
7. **Reports** — produces a metrics report at the end

### Team Setup Mode

When you say **"set up the team"** to the Team coordinator, it scans your workspace and:

1. Reads 4–6 source files per bounded context (entry points, controllers, services, domain models, repos, tests, config)
2. Scans compiled output (`dist/`, `bin/`, `.next/`, `target/`) — reads `.d.ts` declaration files and source maps
3. Extracts real package names from dependency files for expertise fields
4. Proposes agents named after actual class/service names found in code, with per-folder boundaries derived from real file paths
5. Detects gaps — flags folders with no agent owner
6. Creates the agents and validates with `ll-agents-team status`

### Conflict Prevention

Each agent declares **file boundaries** — glob patterns defining what they can modify:

```bash
--boundaries "src/storefront/**:write,src/styles/**:exclusive"
```

Access levels:
- **`read`** — can read but not modify
- **`write`** — can modify (shared ownership allowed)
- **`exclusive`** — only this agent may modify these files

The coordinator automatically detects overlapping write/exclusive boundaries and never runs conflicting agents in parallel.

### Memory System

**Individual memory** (`.agents-team/memory/{name}.md`): each agent records learnings — patterns, conventions, gotchas — after every task. Persists across sessions.

**Shared learnings** (`.agents-team/shared/learnings.md`): team-wide knowledge relevant to all agents.

**Decisions** (`.agents-team/shared/decisions.md`): log of architectural and design decisions.

**Activity log** (`.agents-team/log/activity.jsonl`): structured record of every event — agent changes, lock activity, memory writes.

Commit `.agents-team/` — your team and all its knowledge persists for everyone who clones the repo.

---

## Agent Templates

Pre-built templates with full role, expertise, boundaries, and working protocol:

```bash
ll-agents-team templates   # list all
ll-agents-team add --name "BackendDev" --template generic/backend-dev
ll-agents-team add --name "OptiFeatureDev" --template ita-opti/opti-feature-dev
```

Available: `generic/backend-dev`, `generic/frontend-dev`, `generic/doc-dev`, `ita-opti/*`, `ita-pricing-engine/*`, `ita-oms/*`

Mix template + override — template provides the base, CLI args take precedence:

```bash
ll-agents-team add --name "BackendDev" --template generic/backend-dev --role "Senior Backend Dev"
```

---

## What Gets Created

```
.agents-team/
├── team.json                     # Team roster and coordinator config
├── routing.json                  # Task routing rules
├── copilot-instructions.md       # Copilot workspace context
├── agents/
│   ├── {name}.md                 # Agent charters
│   └── _alumni/                  # Archived agent charters
├── shared/
│   ├── decisions.md              # Team decisions log
│   └── learnings.md              # Shared team knowledge
├── memory/
│   └── {name}.md                 # Individual agent memories
├── locks/                        # Active file locks (ephemeral)
└── log/
    └── activity.jsonl            # Structured event log

.github/agents/
├── team.md                       # Team coordinator agent
└── initiator.md                  # Initiator agent (Team Setup Mode)
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

// Check if two agents can run in parallel
const team = await loadTeam();
const a = team.agents.find(a => a.name === 'Frontend')!;
const b = team.agents.find(a => a.name === 'Backend')!;
console.log(canRunParallel(a, b)); // true

// Route a task to the best agent
const routing = await loadRouting();
const match = matchAgent('build the React login form', team, routing);
console.log(match?.name); // "Frontend"

// Build a task plan with parallel groups
const tasks = [
  createTask('Build login form UI', 'Frontend'),
  createTask('Create auth API endpoints', 'Backend'),
  createTask('Write login tests', 'Tester', ['task-1-id', 'task-2-id']),
];
const plan = createTaskPlan('Build login page', tasks);
console.log(plan.parallelGroups);
// [['task-1', 'task-2'], ['task-3']]

// Append a custom activity event
await appendActivity({
  event: 'task:status-changed',
  agent: 'Frontend',
  taskId: 'abc123',
  detail: 'Task moved to in-progress',
});

// Read the last 20 activity entries
const log = await readActivityLog(undefined, 20);
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
  "agents": [...]
}
```

- **`maxParallelTasks`**: Maximum agents running simultaneously (default: 4)
- **`conflictStrategy`**: `boundary` (default) | `lock` | `queue`

### routing.json

```json
{
  "rules": [
    { "pattern": "React|CSS|UI|component", "agent": "Frontend", "priority": 10 },
    { "pattern": "API|database|auth", "agent": "Backend", "priority": 10 }
  ]
}
```

Rules are regex patterns matched against task descriptions, ordered by priority (highest first).

---

## Requirements

- Node.js >= 20.0.0
- VS Code with GitHub Copilot

## License

MIT


---

## Quick Start

### 1. Install

```bash
npm install -g ll-agents-team
```

### 2. Initialize in your project

```bash
cd my-project
ll-agents-team init --name "My App Team"
```

### 3. Set up your team

```bash
ll-agents-team coach
```

Then open Copilot Chat, select the **Team** agent, and say **"set up the team"**. The coordinator will:
- Read 4–6 source files per bounded context (entry points, controllers, services, domain models, repos, tests, config)
- Scan compiled/built output (`dist/`, `bin/`, `out/`, `.next/`, `target/`) — reads `.d.ts` declaration files, `.js.map` source maps, and `.dll`/`.jar` artifact names to discover module boundaries
- Extract real library names from dependency files for expertise fields
- Propose specific non-overlapping agents named after actual classes and business capabilities found in the code

Review and approve — agents are created automatically.

**Or add agents manually:**

```bash
ll-agents-team add --name "Storefront Dev" \
  --role "Implements Vue storefront components, blocks, and Pinia stores" \
  --expertise "Vue 3 Composition API,Pinia,TypeScript,SCSS modules,Vite" \
  --boundaries "src/storefront/**:write,tests/storefront/**:write"

ll-agents-team add --name "Backend API Dev" \
  --role "Implements REST endpoints, MediatR handlers, and EF Core repositories" \
  --expertise "ASP.NET Core,MediatR,FluentValidation,Entity Framework Core,xUnit" \
  --boundaries "src/Api/**:write,src/Domain/**:write,tests/Api/**:write"
```

### 4. Give a task to the coordinator

Open Copilot Chat, select the **Team** agent, and describe what you need:

```
I need to create a new Hero Banner block in the storefront
```

The coordinator will do the rest.

---

## Real Example — "I need to create a new Hero Banner block in the storefront"

Here is exactly what happens step by step when you send this task to the **Team** coordinator.

### Step 1 — Coordinator reads context

Before planning anything, the coordinator reads:
- `.agents-team/shared/learnings.md` — finds a note: *"storefront blocks live in `src/storefront/blocks/`, each block has an `index.vue`, a `types.ts`, and is registered in `src/storefront/blocks/registry.ts`"*
- `.agents-team/shared/decisions.md` — finds: *"blocks use Pinia for local state, not props drilling"*
- `.agents-team/memory/Storefront Dev.md` — finds: *"block registry auto-discovers via Vite glob import, no manual registration needed"*
- Runs `ll-agents-team status` — no active locks, no conflicts

### Step 2 — Coordinator asks a clarifying question

Because "Hero Banner" is not fully specified, it asks a single `vscode_askQuestions` call:

> **What content does the Hero Banner block need?**
> - Image + headline + CTA button
> - Image + headline only
> - Configurable via CMS fields
> - Other — please describe

You answer: *"Image + headline + CTA button, configurable via CMS fields"*

### Step 3 — Coordinator presents the plan

```
📋 Execution Plan — Hero Banner Block

Subtask 1 — Storefront Dev (parallel)
  Create src/storefront/blocks/HeroBanner/index.vue
  Create src/storefront/blocks/HeroBanner/types.ts
  Fields: image (url+alt), headline (string), ctaLabel (string), ctaUrl (string)
  CMS binding via existing useCmsField() composable
  Acceptance: block renders, props are typed, CMS fields are wired

Subtask 2 — Backend API Dev (parallel)
  Expose HeroBanner block schema in the CMS content model API
  Add DTO + mapper for the new block type
  Acceptance: GET /api/content returns HeroBanner fields correctly

Subtask 3 — Storefront Dev (sequential, after Subtask 2)
  Integration test: block fetches and renders live CMS data
  Acceptance: Cypress test passes with mock CMS response

Parallel: Subtasks 1 + 2 run simultaneously.
Sequential: Subtask 3 waits for both.
```

You confirm: *"Looks good, proceed"*

### Step 4 — Coordinator delegates in parallel

It launches two sub-agents simultaneously:

**Subagent: Storefront Dev — Create HeroBanner block**
- Creates `src/storefront/blocks/HeroBanner/index.vue` with Vue 3 `<script setup>`, typed props, CMS binding
- Creates `src/storefront/blocks/HeroBanner/types.ts` with `HeroBannerBlock` interface
- Writes unit test in `tests/storefront/blocks/HeroBanner.spec.ts`
- Updates memory: *"HeroBanner uses useCmsField() composable, image field needs alt fallback"*
- Ends with: `✅ MEMORY UPDATED: .agents-team/memory/Storefront Dev.md`

**Subagent: Backend API Dev — Add HeroBanner CMS schema**
- Adds `HeroBannerBlockDto.cs` in `src/Api/Cms/Blocks/`
- Adds mapper entry in `CmsBlockMapper.cs`
- Adds unit test in `tests/Api/Cms/HeroBannerBlockMapperTests.cs`
- Updates memory: *"CMS block DTOs live in src/Api/Cms/Blocks/, one file per block type"*
- Ends with: `✅ MEMORY UPDATED: .agents-team/memory/Backend API Dev.md`

### Step 5 — Coordinator validates, then delegates the integration task

After both complete, coordinator:
1. Verifies memory files were updated ✅
2. Marks Subtasks 1 & 2 as completed in the todo list
3. Launches **Subagent: Storefront Dev — Integration test for HeroBanner**
   - Adds `tests/storefront/blocks/HeroBanner.integration.spec.ts`
   - Uses mock CMS response matching the DTO schema from Subtask 2

### Step 6 — Metrics report

```
📊 TASK EXECUTION METRICS REPORT
Task: Create Hero Banner block in storefront

Total sub-agents invoked:  2
Total subtasks completed:  3
Parallel executions:       1 (Subtasks 1 + 2)
Sequential executions:     1 (Subtask 3)

Storefront Dev   — 2 tasks | 4 files | Memory ✅ | Status: completed
Backend API Dev  — 1 task  | 3 files | Memory ✅ | Status: completed

Boundary conflicts: None
Follow-up: Register HeroBanner in Storybook (optional)
```

---

## Commands

| Command | What it does |
|---------|-------------|
| `ll-agents-team init` | Scaffold `.agents-team/` in the current project |
| `ll-agents-team coach` | Regenerate the Team coordinator with latest team state, ready for Team Setup Mode |
| `ll-agents-team add` | Add an agent with name, role, expertise, and boundaries |
| `ll-agents-team add --template <key>` | Add an agent from a pre-built template |
| `ll-agents-team templates` | List all available agent templates |
| `ll-agents-team remove <name>` | Remove an agent (charter preserved in `_alumni/`) |
| `ll-agents-team list` | List all team members and boundary conflicts |
| `ll-agents-team status` | Show team status, locks, routing rules, memory entries |
| `ll-agents-team regenerate` | Regenerate the coordinator and all agent charter files |

---

## How It Works

### The Coordinator

The coordinator is a Copilot agent (`.github/agents/team.md`, visible as **Team** in the agent picker). It:

1. **Reads context** — shared learnings, decisions, agent memories, active locks
2. **Clarifies** — asks targeted questions via `vscode_askQuestions` if the task is ambiguous
3. **Plans** — presents a written plan and waits for your confirmation before doing anything
4. **Delegates** — launches sub-agents via `runSubagent`, never writes code itself
5. **Parallelizes** — runs independent agents simultaneously (up to the configured max)
6. **Validates** — checks memory was updated after each sub-agent completes
7. **Reports** — produces a metrics report at the end

### Team Setup Mode (built into the Team coordinator)

When you say **"set up the team"** to the Team coordinator, it enters Team Setup Mode. It:

1. **Reads 4–6 source files per bounded context** — entry points, controllers, services, domain models, repos, tests, and config; records exact class names, library imports, and business capabilities
2. **Scans compiled/built output** — lists `dist/`, `bin/`, `out/`, `.next/`, `target/`, `publish/`; reads `.d.ts` declaration files (full API surface), `.js.map` source maps (module layout), and `.dll`/`.jar` artifact names to discover assembly/package boundaries without needing every source file
3. **Reads dependency files** — extracts exact npm/NuGet/PyPI/Maven package names for expertise fields (never language names)
4. **Proposes agents** named after actual class/service names found in code, with tight per-folder boundaries derived from real file paths
5. **Shows a build output map** — every compiled artifact mapped to its owning agent
6. **Detects gaps** — flags folders and build artifacts with no agent owner
7. **Validates** after creation with `ll-agents-team status`

There is only one agent file: `.github/agents/team.md`. It handles both team setup and task execution.

Run `ll-agents-team coach` after adding a major feature area or significant refactor — it regenerates the coordinator with the latest team state before you start a new setup session.

### Conflict Prevention

Each agent declares **file boundaries** — glob patterns defining what they can modify:

```bash
--boundaries "src/storefront/**:write,src/styles/**:exclusive"
```

Access levels:
- **`read`** — can read but not modify
- **`write`** — can modify (shared ownership allowed)
- **`exclusive`** — only this agent may modify these files

The coordinator automatically detects overlapping boundaries and never runs conflicting agents in parallel.

### Memory System

**Individual memory** (`.agents-team/memory/{name}.md`): each agent records learnings — patterns, conventions, gotchas — after every task. Persists across sessions.

**Shared learnings** (`.agents-team/shared/learnings.md`): team-wide knowledge relevant to all agents.

**Decisions** (`.agents-team/shared/decisions.md`): log of architectural and design decisions.

Commit `.agents-team/` — your team and all its knowledge persists for everyone who clones the repo.

---

## Agent Templates

Pre-built templates with full role, expertise, boundaries, and working protocol:

```bash
ll-agents-team templates   # list all
ll-agents-team add --name "BackendDev" --template generic/backend-dev
ll-agents-team add --name "OptiFeatureDev" --template ita-opti/opti-feature-dev
```

Available: `generic/backend-dev`, `generic/frontend-dev`, `generic/doc-dev`, `ita-opti/*`, `ita-pricing-engine/*`, `ita-oms/*`

---

## What Gets Created

```
.agents-team/
├── team.json                     # Team roster and coordinator config
├── routing.json                  # Task routing rules
├── copilot-instructions.md       # Copilot workspace context
├── agents/
│   └── {name}.md                 # Agent charters
├── shared/
│   ├── decisions.md              # Team decisions log
│   └── learnings.md              # Shared team knowledge
├── memory/
│   └── {name}.md                 # Individual agent memories
└── locks/                        # Active file locks (ephemeral)

.github/agents/
└── team.md                       # Single Team agent (coordinator + Team Setup Mode)
```

---

## Quick Start

### 1. Install

```bash
npm install -g ll-agents-team
```

### 2. Initialize in your project

```bash
cd my-project
ll-agents-team init --name "My App Team"
```

This creates `.agents-team/` with the coordinator, shared memory files, and Copilot integration.

### 3. Add agents

**From a pre-built template** (recommended — full role, expertise, boundaries and working protocol included):

```bash
# List all available templates
ll-agents-team templates

# Add from template — no --role or --expertise needed
ll-agents-team add --name "BackendDev"      --template generic/backend-dev
ll-agents-team add --name "OptiFeatureDev" --template ita-opti/opti-feature-dev
ll-agents-team add --name "PECoreDev"      --template ita-pricing-engine/pe-core-dev
```

**Manually** (full control over every field):

```bash
ll-agents-team add \
  --name "Frontend" \
  --role "Frontend Developer" \
  --expertise "React,CSS,TypeScript,UI components" \
  --boundaries "src/frontend/**:write,src/styles/**:exclusive"

ll-agents-team add \
  --name "Backend" \
  --role "Backend Developer" \
  --expertise "Node.js,PostgreSQL,REST APIs,authentication" \
  --boundaries "src/backend/**:write,src/api/**:exclusive"
```

**Mix template + override** — template provides the base, CLI args take precedence:

```bash
ll-agents-team add --name "BackendDev" --template generic/backend-dev --role "Senior Backend Dev"
```

### 4. Use in Copilot

Open VS Code, start a Copilot chat, and reference the coordinator:

```
Use the instructions in .agents-team/agents/coordinator.md

Build the login page with email/password authentication
```

The coordinator will:
1. **Ask clarifying business questions** if the task is ambiguous (outcome, constraints, edge cases, acceptance criteria)
2. **Present a written plan** (subtasks, assigned agents, parallel vs. sequential) and wait for your approval
3. Decompose confirmed subtasks and assign them to agents
4. Run independent subtasks in parallel
5. Sequence dependent or conflicting subtasks
6. Track progress and record decisions

---

## Commands

| Command | What it does |
|---------|-------------|
| `ll-agents-team init` | Scaffold `.agents-team/` in the current project |
| `ll-agents-team add` | Add an agent with name, role, expertise, and boundaries |
| `ll-agents-team add --template <key>` | Add an agent from a pre-built template |
| `ll-agents-team templates` | List all available agent templates |
| `ll-agents-team remove <name>` | Remove an agent (charter preserved in `_alumni/`) |
| `ll-agents-team list` | List all team members and boundary conflicts |
| `ll-agents-team status` | Show team status, locks, routing rules, memory entries |

---

## How It Works

### The Coordinator

The coordinator is a Copilot agent (`.github/agents/team.md`, visible as **@Team** in Copilot Chat). When you give it a task, it:

1. **Clarifies** — asks targeted business questions if the task is ambiguous (outcome, constraints, edge cases, acceptance criteria)
2. **Plans** — presents a written plan (subtasks, owners, parallel vs. sequential) and waits for your confirmation before proceeding
3. **Analyzes** — breaks confirmed subtasks into the smallest independently-completable units
4. **Routes** — matches subtasks to agents by expertise and routing rules
5. **Checks conflicts** — ensures agents with overlapping file boundaries don't run simultaneously
6. **Delegates** — launches independent subtasks in parallel, sequences dependent ones
7. **Tracks** — records decisions and learnings in shared memory

### Conflict Prevention

Each agent declares **file boundaries** — glob patterns defining which files they can modify:

```bash
# Only Frontend can touch styles (exclusive)
--boundaries "src/frontend/**:write,src/styles/**:exclusive"

# Only Backend can touch API routes (exclusive)
--boundaries "src/backend/**:write,src/api/**:exclusive"
```

Access levels:
- **`read`** — can read but not modify
- **`write`** — can modify (others can too)
- **`exclusive`** — only this agent may modify these files

The coordinator automatically detects overlapping write/exclusive boundaries and **never** runs conflicting agents in parallel.

### File Locking

Beyond boundaries, a runtime lock manager prevents concurrent modifications:
- Agents acquire locks before modifying files
- Locks auto-expire after 30 minutes
- The coordinator checks locks before delegating
- Removed agents have all locks released automatically

### Memory System

**Individual memory** (`.agents-team/memory/{name}.md`):
Each agent accumulates learnings about the project — patterns discovered, conventions learned, decisions made. These persist across sessions.

**Shared learnings** (`.agents-team/shared/learnings.md`):
Team-wide knowledge that affects everyone — architecture decisions, coding standards, tool configurations.

**Decisions** (`.agents-team/shared/decisions.md`):
A log of important decisions made during work — what was decided, why, and who it affects.

### Routing

Tasks are matched to agents using two strategies:

1. **Explicit rules** (`.agents-team/routing.json`): regex patterns mapped to agents with priorities
2. **Expertise matching**: keyword overlap between the task description and agent expertise

Default routing rules are generated when you add an agent. You can edit `routing.json` to customize.

---

## What Gets Created

```
.agents-team/
├── team.json                     # Team roster and coordinator config
├── routing.json                  # Task routing rules
├── copilot-instructions.md       # Copilot workspace context
├── agents/
│   ├── coordinator.md            # Coordinator agent (auto-generated)
│   ├── {name}.md                 # Agent charters (per agent)
│   └── _alumni/                  # Archived agent charters
├── shared/
│   ├── decisions.md              # Team decisions log
│   └── learnings.md              # Shared team knowledge
├── memory/
│   └── {name}.md                 # Individual agent memories
├── locks/                        # Active file locks (ephemeral)
└── log/                          # Task execution history
```

**Commit this folder.** Your team persists across sessions. Anyone who clones the repo gets the same team with all their accumulated knowledge.

---

## Agent Templates

Templates are pre-built agent charters bundled with the package. They include a full role description, expertise list, file boundaries, coding standards, and a working protocol — saving you from typing all that on the CLI.

### List available templates

```bash
ll-agents-team templates
```

```
📋 Available agent templates:

  generic/
    backend-dev
      ll-agents-team add --name "MyAgent" --template generic/backend-dev
    frontend-dev
      ll-agents-team add --name "MyAgent" --template generic/frontend-dev
    doc-dev
      ll-agents-team add --name "MyAgent" --template generic/doc-dev
  ita-opti/
    opti-feature-dev
    opti-infra-dev
    opti-integration-dev
  ita-pricing-engine/
    pe-core-dev
    pe-admin-dev
    pe-pipeline-dev
  ita-oms/
    oms-order-dev
    oms-platform-dev
    oms-pom-dev
```

### How templates work

When you use `--template`, the CLI:
1. Reads the template `.md` file from the package
2. Parses out the role, expertise list, and file boundaries
3. Renames the title and memory-path references to match your `--name`
4. Writes the full template content as the agent's charter (`.agents-team/agents/{name}.md`)
5. Adds the agent to `team.json` and regenerates `team.md`

Any explicitly passed `--role`, `--expertise`, or `--boundaries` override the template values.

### Adding your own templates

Add `.md` files under `src/agent-templates/{category}/` in the `ll-agents-team` package, following this structure:

```markdown
# template-name — Role Title

## Role
One-paragraph description of what this agent does.

## Expertise
- Technology / skill 1
- Technology / skill 2

## File Boundaries
You are responsible for and may modify files matching these patterns:
- `src/path/**` (write)
- `tests/**` (read)

## Working Protocol
...
```

Rebuild and reinstall the package after adding templates:

```bash
npm run build
npm install -g .
```

---

## Programmatic API

Use the SDK directly in your own tooling:

```typescript
import {
  loadTeam,
  addAgentToTeam,
  createAgentEntry,
  canRunParallel,
  createTask,
  createTaskPlan,
  matchAgent,
  loadRouting,
  appendAgentMemory,
} from 'll-agents-team';

// Load team
const team = await loadTeam();

// Check if two agents can run in parallel
const frontend = team.agents.find(a => a.name === 'Frontend')!;
const backend = team.agents.find(a => a.name === 'Backend')!;
console.log(canRunParallel(frontend, backend)); // true (no boundary overlap)

// Route a task to the best agent
const routing = await loadRouting();
const match = matchAgent('build the React login form', team, routing);
console.log(match?.name); // "Frontend"

// Build a task plan with parallel groups
const tasks = [
  createTask('Build login form UI', 'Frontend'),
  createTask('Create auth API endpoints', 'Backend'),
  createTask('Write login tests', 'Tester', ['task-1-id', 'task-2-id']),
];
const plan = createTaskPlan('Build login page', tasks);
console.log(plan.parallelGroups);
// [['task-1', 'task-2'], ['task-3']]  — form + API in parallel, then tests

// Record a learning
await appendAgentMemory({
  timestamp: new Date().toISOString(),
  agent: 'Frontend',
  type: 'learning',
  content: 'This project uses Tailwind v4 with dark mode support',
  tags: ['styling', 'tailwind'],
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
  "agents": [...]
}
```

- **`maxParallelTasks`**: Maximum agents running simultaneously (default: 4)
- **`conflictStrategy`**: How to handle conflicts
  - `boundary` — use file boundaries to determine parallelism (default)
  - `lock` — use runtime file locks
  - `queue` — fully sequential execution

### routing.json

```json
{
  "rules": [
    { "pattern": "React|CSS|UI|component", "agent": "Frontend", "priority": 10 },
    { "pattern": "API|database|auth", "agent": "Backend", "priority": 10 },
    { "pattern": "test|spec|e2e", "agent": "Tester", "priority": 10 }
  ]
}
```

Rules are regex patterns matched against task descriptions, ordered by priority (highest first).

---

## Requirements

- Node.js >= 20.0.0
- VS Code with GitHub Copilot (for agent orchestration)

## License

MIT