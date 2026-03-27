---
name: github-pr-workflow
description: 'Use when creating a GitHub pull request after feature implementation and Reviewer sign-off. Uses the github tool to create a PR with structured body including acceptance criteria, changed files per agent, and linked issues. Use for: post-feature PR creation, linking GitHub issues with Closes #N, adding labels, recording PR URL in shared decisions.'
argument-hint: 'Describe the feature being submitted (e.g., "Hero Banner block — storefront")'
---

# GitHub PR Workflow

Use the `github` tool to create a pull request after all implementation and review steps are complete.

## Prerequisites

A PR must NOT be created until ALL of the following are true:
- [ ] Reviewer agent has explicitly stated `"✅ Review passed — all criteria met"` (or no Reviewer is on the team)
- [ ] All acceptance criteria are confirmed met
- [ ] `build-diagnostics` check passed — zero new errors
- [ ] User confirmed PR creation via `vscode_askQuestions`

## Procedure

### 1. Confirm with User

Use `vscode_askQuestions`:
```json
{
  "question": "Would you like me to create a GitHub PR for this feature?",
  "options": [
    "Yes, create the PR",
    "No, I'll handle it manually"
  ],
  "allowFreeformInput": true
}
```

If "No" → skip PR creation; proceed to recording in decisions.

### 2. Prepare PR Content

**Title**: Concise feature name matching the task description (match the user's original request phrasing).

**Body**: Use [the PR body template](#pr-body-template) below.

**Labels**: Assign from existing repo labels only — never create new labels:
- `enhancement` — new feature or improvement
- `bug` — fix for a defect
- `chore` — maintenance, dependency updates, refactoring
- `docs` — documentation only

**Linked issues**: If the task was triggered by a GitHub issue, include `Closes #N` in the body. Ask the user for the issue number if unsure.

### 3. Create the PR

Use the `github` tool to create the pull request with the prepared content.

### 4. Record in Shared Decisions

After the PR is created, append the PR URL to `.agents-team/shared/decisions.md` under the relevant decision entry:

```markdown
**PR:** {PR URL}
```

## PR Body Template

```markdown
## Summary
{1–2 sentence description of what this PR implements and why}

## Changes

| File | Agent | Change |
|------|-------|--------|
| {path/to/file} | {Agent Name} | {What was changed} |

## Acceptance Criteria
- [x] {criterion 1 — copy verbatim from clarification step}
- [x] {criterion 2}
- [x] {criterion N}

## Decisions Recorded
{List any entries added to .agents-team/shared/decisions.md during this task, or "None"}

## Agents Involved
{List each agent that contributed, with a one-line summary of their work}

Closes #{issue number}
```

## Anti-Patterns to Avoid

- ❌ Creating a PR before the Reviewer signs off
- ❌ Skipping `vscode_askQuestions` confirmation — always ask first
- ❌ Missing linked issue when the work was triggered by a GitHub issue
- ❌ PR body without per-agent change breakdown — the reviewer needs to know who changed what
- ❌ Forgetting to record the PR URL in `.agents-team/shared/decisions.md`
