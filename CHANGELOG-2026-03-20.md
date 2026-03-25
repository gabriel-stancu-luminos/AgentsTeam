# Changelog — March 20, 2026

---

## [18:07] feat: deeper codebase scan and built output decompilation in team setup
**Commit:** `0c82fd7`

### What changed
The Team Setup Mode inside the coordinator was significantly enhanced to produce more specific, accurate agents.

#### `src/core/coordinator.ts`
- **S1.3 — Deeper source reading**: minimum files per bounded context raised from 2–3 to **4–6**. The coordinator now reads:
  - Entry points (`index.ts`, `main.ts`, `Program.cs`, etc.)
  - Every controller / handler / resolver
  - Services and use-case classes (noting exact names, signatures, injected deps)
  - Domain models / DTOs
  - Repository / data-access layer (ORM and query patterns)
  - Test files (`*.spec.ts`, `*.test.ts`, `*Test.java`, etc.)
  - Config files (`appsettings.json`, `config.ts`, `.env.example`)
- For every file read the coordinator must now record: exact class/function names, exact import package names, business capability, data read/written, and exclusive vs. shared ownership
- **Sub-domain discovery**: folders with >5 subdirectories are treated as separate bounded contexts; barrel files (`index.ts`, `index.js`) are read to understand module public APIs; `domain/`, `modules/`, `features/`, `bounded-contexts/` children each become agent candidates

- **S1.4 — New: Scan compiled/built output (decompile step)**:
  - Lists known output directories: `dist/`, `build/`, `out/`, `bin/`, `obj/`, `.output/`, `.next/`, `target/`, `publish/`
  - Reads `.d.ts` TypeScript declaration files for full API surface
  - Reads `.js.map` source maps to trace module-to-source relationships
  - Reads compiled entry-point JS files (`dist/index.js`, `dist/main.js`)
  - For .NET: lists `.dll` files in `bin/` → assembly/project boundaries
  - For Java/Kotlin: lists `.jar` files → microservice boundaries
  - Every artifact name becomes a candidate agent boundary

- **S1.6 — Existing agent review** now also checks whether the build scan revealed modules not covered by any current agent

- **Phase 2 — Specificity requirements** (new section):
  - Agent names must be derived from actual class/service names found in source, not folder names
  - Expertise items must be exact package names (npm/NuGet/PyPI/Maven) — never language names
  - Boundaries must use actual file paths read, not guesses
  - One agent per deployable service in monorepos
  - Each compiled assembly/package/jar that maps to a separate deployable becomes a separate agent candidate
  - New anti-pattern: agent name matching a folder name → must reflect business capability instead
  - New proposal table: **build output map** (artifact → source folder → owning agent)

#### `README.md`
- Quick Start step 3 updated: lists what the coordinator now reads (4–6 files per context, build output scan types)
- "Team Setup Mode" section in How It Works rewritten: full 7-step description covering deeper source reading, build output scanning with specific artifact types, package-name-based expertise, class-name-based agent naming, build output map, gap detection, and validation

---

## [17:36] upgrade version
**Commit:** `4187ef5`

#### `package.json`
- Version bumped

---

## [16:50] merge coach into Team coordinator as Team Setup Mode
**Commit:** `486cf73`

### What changed
The separate `coach` agent was eliminated. Its functionality was absorbed directly into the **Team** coordinator as "Team Setup Mode" — a single agent now handles both team setup and task execution.

#### `src/core/coordinator.ts` (+161 lines)
- Full Team Setup Mode prompt injected: phases 1–5 (reconnaissance, agent design, user validation, CLI creation, post-creation validation)
- Setup mode triggers on empty team or explicit user request ("set up the team", "create agents", etc.)
- Coordinator now self-describes its two operating modes at the top of its prompt

#### `src/core/coach.ts` (deleted)
- Removed entirely; all logic moved into coordinator prompt generation

#### `src/commands/coach.ts`
- Simplified: no longer runs a separate coach agent; instead regenerates the coordinator and instructs user to use the Team agent's setup mode

#### `src/commands/init.ts`
- Adjusted for the merged flow

#### `src/commands/regenerate.ts`
- Minor cleanup following coach removal

#### `README.md`
- Updated How It Works and Quick Start to reflect the single-agent model

---

## [16:38] update readme
**Commit:** `e8eb5f1`

#### `README.md` (+254 lines)
- Full end-to-end worked example added: "Hero Banner block" scenario showing all 6 steps (context read → clarifying question → plan → parallel delegation → validation → metrics report)
- Expanded Commands table (added `coach`, `regenerate`)
- Expanded How It Works (coordinator steps, memory system, routing, file locking)
- Full What Gets Created directory tree
- Agent Templates section with full `templates` command output example and explanation of how templates work
- Programmatic API section with TypeScript code examples
- Configuration section (`team.json`, `routing.json`)

---

## [16:35] correct tool aliases, add coach agent, wire locks/routing into coordinator
**Commit:** `1989a66`

#### `src/core/coach.ts` (new, 223 lines)
- Standalone coach agent prompt that scans the codebase, designs agents, and runs the CLI to create them

#### `src/commands/coach.ts` (new)
- `ll-agents-team coach` command: writes the coach agent charter to `.github/agents/coach.md` and instructs user to invoke it

#### `src/commands/init.ts`
- Wired locks and routing into the init scaffold

#### `src/commands/regenerate.ts`
- Added `coach` regeneration alongside coordinator and agent charters

#### `src/cli.ts`
- Registered `coach` subcommand

#### `src/core/coordinator.ts`
- Fixed tool aliases in the coordinator prompt

---

## [16:18] Tools for subagents to edit code
**Commit:** `e5ea845`

#### `src/core/agent.ts`
- Updated the `tools` list in agent charter frontmatter to include the correct editing tool aliases so sub-agents can modify files

#### `src/core/coordinator.ts`
- Same tools list correction in the coordinator prompt frontmatter
