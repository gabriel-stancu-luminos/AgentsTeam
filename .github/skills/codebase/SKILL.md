---
name: codebase
description: 'Use when searching or exploring the codebase for context before planning or delegating. Invokes the codebase tool for semantic search, file exploration, and symbol lookup. Use for: finding relevant files before task decomposition, understanding existing patterns before assigning work, locating all usages of a symbol, checking which agent boundaries cover a given path.'
argument-hint: 'Describe what you are looking for (e.g., "authentication middleware files", "all usages of OrderService")'
---

# Codebase Exploration

Use the `codebase` tool to gather accurate, context-specific information from the repository before planning or delegating — never guess at file locations or patterns.

## When to Use
- **Before decomposing a task** — understand what files exist so sub-agent prompts reference real paths
- **Before assigning an agent** — verify the relevant files fall within the agent's declared boundaries
- **When a sub-agent reports unexpected behaviour** — find related files that might also be affected
- **When loading context for a Planner or Clarifier** — provide exact class/method names rather than guessing
- **When checking for existing patterns** — find how similar features were implemented before designing a new one

## Effective Search Strategies

### Find files by feature area
Search for the feature keyword to locate all related files in one pass rather than browsing directories manually.

### Find all usages of a class or function
Use the symbol name to locate every call site — essential before changing an interface to understand the blast radius.

### Find existing patterns to follow
Search for a known example of the pattern (e.g., an existing endpoint, a DTO, a test file) and read it to understand conventions before designing something new.

### Locate configuration and entry points
Search for entry-point keywords (`main`, `startup`, `bootstrap`, `configure`) when the team needs to understand how a service initialises.

## Pre-Delegation Checklist

Before writing a sub-agent delegation prompt, use `codebase` to confirm:

- [ ] Exact file paths for the files the agent will modify (no guesses)
- [ ] Class and method names the agent will interact with
- [ ] Existing test files that cover the area being changed
- [ ] Any shared interfaces or DTOs the change might affect
- [ ] Other agents whose boundaries overlap with the target files (cross-check against `ll-agents-team list`)

## Integration with Coordinator Workflow

| Step | When | Action |
|------|------|--------|
| Step 1.1 | Project initialisation | Scan project structure; read entry points and key source files |
| Step 2.1 | Task decomposition | Confirm exact file paths for each subtask before writing sub-agent prompts |
| Step 2.4 | Sub-agent prompt preparation | Include real class/method names found via `codebase` search — never use placeholder names |
| Step 3.3 | Post-agent validation | If new errors reference unknown symbols, search for them to guide the fix delegation |

## Anti-Patterns to Avoid

- ❌ Writing sub-agent prompts with assumed file paths — always verify with `codebase` first
- ❌ Using only directory listings for context — directory names alone never reveal class names, interfaces, or patterns
- ❌ Running `codebase` searches sequentially when multiple independent lookups are needed — batch parallel searches
- ❌ Skipping the codebase scan when the user asks for "a quick task" — even fast-track tasks need accurate file paths in sub-agent prompts
