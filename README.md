# ll-agents-team

**Lightweight AI agent team orchestration for any project.** One command. A coordinator that creates teams, delegates tasks in parallel, and prevents conflicts.

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