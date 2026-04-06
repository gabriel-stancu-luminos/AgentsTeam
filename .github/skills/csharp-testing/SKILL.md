---
name: csharp-testing
description: 'Use when any agent needs to discover, run, or interpret C# test results using C# Dev Kit. Covers running tests before/after code changes, verifying test coverage, understanding test failures, and writing quick tests to validate implementation correctness. Use for: post-implementation test verification, test failure diagnosis, coverage gap detection, test-driven development guidance.'
argument-hint: 'Describe what testing action is needed (e.g., "run unit tests for OrderService after changes", "check why integration tests are failing")'
---

# C# Testing with C# Dev Kit

Use this skill to discover, run, and interpret C# tests as a quality gate during development. This skill applies to ALL agents — not just the dedicated Test Developer.

## When to Use
- **After implementing a feature** — run existing tests to verify nothing is broken
- **After a sub-agent completes work** — verify test suite still passes
- **When diagnosing a bug** — run targeted tests to reproduce and confirm the fix
- **Before reporting task completion** — confirm all related tests pass
- **When asked to add test coverage** — delegate to the Test Developer agent, then verify results with this skill

## Discovering Tests

### Via C# Dev Kit Test Explorer
C# Dev Kit automatically discovers tests in the workspace. The Test Explorer sidebar shows:
- All test projects in the solution
- Test classes grouped by namespace
- Individual test methods with pass/fail/skip status
- Inline CodeLens links ("Run Test" / "Debug Test") above each `[TestMethod]`, `[Fact]`, or `[Test]`

### Via Terminal
```bash
# List all test projects in the solution
dotnet sln list | Select-String "\.Tests"

# Discover tests without running them (dry run)
dotnet test --list-tests
```

## Running Tests

### Run All Tests
```bash
dotnet test
```

### Run Tests for a Specific Project
```bash
dotnet test path/to/Project.Tests.csproj
```

### Run Tests by Category
```bash
# Unit tests only (fast feedback)
dotnet test --filter "TestCategory=Unit"

# Integration tests
dotnet test --filter "TestCategory=Integration"
```

### Run Tests Matching a Name Pattern
```bash
# All tests for a specific class
dotnet test --filter "FullyQualifiedName~OrderService"

# A single test method
dotnet test --filter "FullyQualifiedName~ProcessOrder_WhenOrderIsValid_ReturnsSuccess"
```

### Run with Detailed Output
```bash
dotnet test --verbosity normal --logger "console;verbosity=detailed"
```

## Interpreting Test Results

### Terminal Output
```
Passed!  - Failed:     0, Passed:    42, Skipped: 0, Total:    42
```
- **Passed** — all tests green, safe to proceed
- **Failed** — read the failure messages; each shows the expected vs. actual value and a stack trace pointing to the exact assertion that failed
- **Skipped** — tests marked `[Ignore]` or conditionally excluded; flag if unexpected

### Common Failure Patterns

| Symptom | Likely Cause | Action |
|---------|-------------|--------|
| `NullReferenceException` in test | Missing mock setup or DI registration | Add the missing `Substitute.For<T>()` return value |
| `Assert.AreEqual` mismatch | Logic bug or model mapping error | Check the production code path |
| `HttpRequestException` | Integration test can't reach external service | Ensure test uses `WebApplicationFactory` or mock HTTP handler |
| `ObjectDisposedException` | Async disposal timing | Ensure `await using` or proper test lifecycle hooks |
| Timeout | Deadlock or missing `await` | Check for `.Result` or `.Wait()` calls blocking async code |

## Pre/Post Change Test Verification

### Standard Workflow for Any Agent

**Before starting implementation:**
```bash
# Record baseline — run tests and note the count
dotnet test --verbosity quiet
# → Passed: 42, Failed: 0
```

**After completing implementation:**
```bash
# Run the same tests again
dotnet test --verbosity quiet
# → Compare: still Passed: 42, Failed: 0? Any new failures?
```

**Decision Matrix:**
| Before | After | Action |
|--------|-------|--------|
| 42 pass, 0 fail | 42 pass, 0 fail | ✅ No regression — proceed |
| 42 pass, 0 fail | 41 pass, 1 fail | ❌ Regression — fix before proceeding |
| 42 pass, 0 fail | 45 pass, 0 fail | ✅ New tests added and passing — proceed |
| 42 pass, 0 fail | 42 pass, 0 fail, but new code has no tests | ⚠️ Flag coverage gap — request test task |

## Code Coverage

### Collect Coverage
```bash
dotnet test --collect:"XPlat Code Coverage"
```
Coverage results are written to `TestResults/` as Cobertura XML.

### Generate Human-Readable Report
```bash
# Install report generator (once)
dotnet tool install -g dotnet-reportgenerator-globaltool

# Generate HTML report
reportgenerator -reports:TestResults/**/coverage.cobertura.xml -targetdir:CoverageReport -reporttypes:Html
```

### Coverage Guidelines
- **New code should have ≥80% line coverage** for business logic
- **Exclude from coverage:** auto-generated code, DTOs, startup/configuration, Azure Function triggers (they're thin wrappers)
- **Focus coverage on:** calculation logic, validation rules, state transitions, error handling paths

## Integration with Coordinator Workflow

| Coordinator Step | Testing Action |
|-----------------|---------------|
| Step 1 — Context load | Run `dotnet test` to establish baseline pass/fail counts |
| Step 2 — Sub-agent prep | Include in sub-agent prompt: "Run `dotnet test` after your changes and report the result" |
| Step 3.3 — Validate completion | Run `dotnet test` → compare with baseline → fail the step if new test failures |
| Step 4 — Review | Reviewer checks whether new code has adequate test coverage |

## Integration with Build Diagnostics Skill

Combine this skill with the `build-diagnostics` skill for a complete quality gate:

1. **Build Diagnostics** → catches compile errors and warnings (fast)
2. **C# Testing** → catches logic errors and regressions (thorough)

Both gates must pass before a sub-agent's work is accepted.

## Delegating Test Work

When an agent identifies that tests are needed but testing is outside their expertise:
1. Report to the coordinator: "Area X needs test coverage for [specific scenarios]"
2. Coordinator delegates to the **Test Developer** agent (`generic/test-dev` template)
3. After Test Developer completes, run this skill's verification procedure to confirm

## Anti-Patterns to Avoid
- ❌ Skipping test runs after code changes ("it's a small change") — always verify
- ❌ Ignoring test failures and proceeding with the next task
- ❌ Running only the test you just wrote — run the full suite to catch regressions
- ❌ Using `--no-build` when source files have changed — stale binaries give false results
- ❌ Treating skipped tests as passing — investigate why tests are skipped
