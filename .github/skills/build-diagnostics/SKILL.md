---
name: build-diagnostics
description: 'Use when validating code changes, checking for compile errors or TypeScript errors, verifying zero new errors after an agent completes work, or confirming a fix resolved an issue. Invokes the problems tool to read VS Code diagnostics. Use for: post-implementation validation, before/after error count comparison, detecting regressions, gating PR creation.'
argument-hint: 'Describe what validation checkpoint you are at (e.g., "after Backend Engineer completed auth changes")'
---

# Build Diagnostics

Use the `problems` tool to read VS Code diagnostics (TypeScript errors, lint warnings, build errors) as a quality gate immediately after any code changes.

## When to Use
- Immediately after a sub-agent reports task completion
- To verify a specific error was resolved by a fix
- Before presenting a feature as done (zero new errors is the pass bar)
- Before creating a PR — confirm the final state is clean
- Comparing errors before vs. after a change set to detect regressions

## Procedure

### Standard Post-Agent Check

1. **Record baseline** — before delegating, note the current error/warning count from `problems`
2. **Delegate the sub-agent task** via `runSubagent`
3. **After the sub-agent completes**, immediately call `problems` again
4. **Compare counts**:
   - Zero new errors → task passed ✅ — continue to next subtask
   - New errors appeared → re-delegate a fix task ❌ — see Failure Actions below
   - New warnings only → flag in metrics report but do not block (exception: deprecation warnings in the agent's boundary area)
5. **Log the result** — record before/after counts in the final metrics report

### Pass Bar

| Outcome | Decision |
|---------|----------|
| No new errors | ✅ Pass — proceed |
| New errors | ❌ Fail — re-delegate fix immediately |
| New warnings (non-deprecation) | ⚠️ Flag in report — do not block |
| New deprecation warnings in agent's boundary | ❌ Fail — re-delegate fix |

## Failure Actions

When new errors are detected:

1. **Do not proceed** to the next subtask — fix errors first
2. **Identify the responsible agent** — check which agent's boundary includes the affected files
3. **Re-delegate a fix task** to that agent with:
   - The exact error messages from `problems` (copy verbatim)
   - The file path and line number of each error
   - Instruction to fix only the errors, no other scope changes
4. **After the fix agent completes**, call `problems` again to verify the count decreased to baseline
5. **Repeat** until errors are resolved before moving on

## Integration with Coordinator Step 3.3

At Step 3.3 (Review & Validate Each Completion) in the Team coordinator workflow, run this
on every sub-agent completion:

```
1. Call problems → record error/warning count (after_count)
2. If after_count.errors > before_count.errors:
     → Collect error messages
     → Re-delegate to responsible agent: "Fix these exact errors: {messages}"
     → Call problems again to verify
3. Record before_count / after_count in the metrics report
```

## Metrics Report Format

Include in the final Task Execution Metrics Report:

```
Agent: {name}
  Build before: {N errors, M warnings}
  Build after:  {N errors, M warnings}
  Delta:        {+0 errors (pass) | +X errors (fixed in retry)}
```
