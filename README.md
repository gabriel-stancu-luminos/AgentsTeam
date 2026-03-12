# ll-agents-team

**Lightweight AI agent team orchestration for any project.** One command. A coordinator that creates teams, delegates tasks in parallel, and prevents conflicts.

Inspired by [Squad](https://github.com/bradygaster/squad) — but lighter. No SDK runtime, no interactive shell, no casting engine. Just clean team definitions, a smart coordinator, and conflict-safe parallel execution — all through VS Code Copilot.

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

ll-agents-team add \
  --name "Tester" \
  --role "QA Engineer" \
  --expertise "testing,Jest,Playwright,test automation" \
  --boundaries "tests/**:write,e2e/**:write"
```

### 4. Use in Copilot

Open VS Code, start a Copilot chat, and reference the coordinator:

```
Use the instructions in .agents-team/agents/coordinator.md

Build the login page with email/password authentication
```

The coordinator will:
1. Decompose the task into subtasks
2. Assign each subtask to the right agent
3. Run independent subtasks in parallel
4. Sequence dependent or conflicting subtasks
5. Track progress and record decisions

---

## Commands

| Command | What it does |
|---------|-------------|
| `ll-agents-team init` | Scaffold `.agents-team/` in the current project |
| `ll-agents-team add` | Add an agent with name, role, expertise, boundaries |
| `ll-agents-team remove <name>` | Remove an agent (charter preserved in `_alumni/`) |
| `ll-agents-team list` | List all team members and boundary conflicts |
| `ll-agents-team status` | Show team status, locks, routing rules, memory entries |

---

## How It Works

### The Coordinator

The coordinator is a Copilot agent defined in `.agents-team/agents/coordinator.md`. When you give it a task, it:

1. **Analyzes** — breaks the task into subtasks
2. **Routes** — matches subtasks to agents by expertise and routing rules
3. **Checks conflicts** — ensures agents with overlapping file boundaries don't run simultaneously
4. **Delegates** — launches independent subtasks in parallel, sequences dependent ones
5. **Tracks** — records decisions and learnings in shared memory

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

## Comparison with Squad

| Feature | Squad | ll-agents-team |
|---------|-------|----------------|
| Team management | CLI + SDK | CLI + SDK |
| Coordinator agent | SDK runtime | Copilot agent (prompt-based) |
| Parallel execution | Session-based | Boundary-checked |
| Conflict prevention | Hook pipeline | File boundaries + locks |
| Memory / learnings | History files | Individual + shared memory |
| Decisions log | decisions.md | decisions.md |
| Casting (themed names) | CastingEngine | Not included |
| Interactive shell | Real-time TUI | Not included |
| Ralph (monitor) | Persistent watcher | Not included |
| Crash recovery | Session persistence | Not included |
| Hook pipeline (PII, guards) | Programmable | Not included |
| Plugin marketplace | Community plugins | Not included |
| Dependencies | Node 20+, Copilot SDK | Node 20+, commander |

---

## Requirements

- Node.js >= 20.0.0
- VS Code with GitHub Copilot (for agent orchestration)

## License

MIT