---
name: git
description: 'Use when performing git operations as part of the development workflow: committing completed work, checking status, staging files, creating branches, or reading commit history. Use for: committing after sub-agent completes work, checking what files were modified, verifying clean working tree before PR creation, reading recent commit history for context.'
argument-hint: 'Describe the git operation needed (e.g., "commit completed auth changes")'
---

# Git Operations

Use the `git` tool to perform repository operations at key workflow checkpoints — committing completed work, checking state, and providing history context.

## When to Use
- After a sub-agent completes its task — commit the changes before moving to the next subtask
- Before delegating to a sub-agent — check if there are uncommitted changes that might conflict
- When preparing context for a sub-agent — read recent commit messages to understand what changed recently
- Before PR creation — verify the working tree is clean and all changes are committed

## Common Operations

### Check current state
```
git status
git diff --stat
```
Use before delegating to understand the baseline; use after a sub-agent completes to confirm exactly which files changed.

### Stage and commit completed work
```
git add <files-in-agent-boundary>
git commit -m "<type>(<scope>): <short description>"
```
Commit per sub-agent task — one logical unit of work per commit.

### Read recent history
```
git log --oneline -10
git log --oneline --name-only -5
```
Use when loading context before planning — understanding recent changes helps avoid duplicate work and identifies risk areas.

### Check a specific file's history
```
git log --oneline -- <path/to/file>
git show HEAD:<path/to/file>
```
Use when a sub-agent reports unexpected behaviour in a file that may have been recently changed.

## Commit Message Convention

Follow **Conventional Commits** format:

```
<type>(<scope>): <short description>

[optional body]
```

| Type | When to Use |
|------|-------------|
| `feat` | New feature or behaviour |
| `fix` | Bug fix |
| `refactor` | Code change with no behaviour change |
| `test` | Adding or updating tests |
| `chore` | Build, config, dependency updates |
| `docs` | Documentation only |

Scope = the agent's boundary area (e.g., `storefront`, `auth-api`, `pricing`).

**Example:** `feat(storefront): add Hero Banner block with responsive layout`

## Integration with Coordinator Workflow

| Step | When | Action |
|------|------|--------|
| Step 1.1 | Before planning | `git status` + `git log --oneline -5` for situational awareness |
| Step 3.3 | After each sub-agent completes | `git diff --stat` to confirm files changed; `git add` + `git commit` the work |
| Step 4.1 | Before PR creation | `git status` to verify clean working tree; `git log --oneline -N` for PR body |

## Anti-Patterns to Avoid

- ❌ Committing all agents' work in a single monolithic commit — commit per sub-agent task
- ❌ Committing outside an agent's boundaries — each commit should only include files in the responsible agent's boundary
- ❌ Skipping commit messages or using vague messages like "fix" or "update" — always follow Conventional Commits
- ❌ Proceeding to PR creation without verifying `git status` shows a clean tree
