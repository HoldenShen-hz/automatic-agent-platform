# Full Coverage Testing Manual

> **Document Version**: v1.2
> **Applicable Project**: automatic-agent-system
> **Test Framework**: Node.js built-in test runner (`node:test`) + `node:assert/strict`
> **Coverage Tool**: c8 (V8 native coverage) + Istanbul reporter
> **Mutation Testing**: Stryker Mutator v9.6
> **Node.js Requirement**: v22+ (`--test` + `--test-concurrency` flags)

---

## Table of Contents

**Part I - Testing Governance Fundamentals**

1. [Testing Infrastructure Overview](#1-testing-infrastructure-overview)
2. [Command Quick Reference](#2-command-quick-reference)
3. [Directory Structure and Layering Rules](#3-directory-structure-and-layering-rules)
4. [Test Writing Standards and Patterns](#4-test-writing-standards-and-patterns)
5. [Mock and Helper Toolbox](#5-mock-and-helper-toolbox)
6. [Coverage Gate Mechanism](#6-coverage-gate-mechanism)
7. [Test Coverage Assurance System](#7-test-coverage-assurance-system)
8. [Security Regression Testing Standards](#8-security-regression-testing-standards)
9. [Golden / Snapshot Testing](#9-golden--snapshot-testing)
10. [Performance Benchmark Testing](#10-performance-benchmark-testing)
11. [Mutation Testing (Stryker)](#11-mutation-testing-stryker)
12. [CI Integration and Workflow](#12-ci-integration-and-workflow)
13. [New Module Testing Checklist](#13-new-module-testing-checklist)

**Part II - Architectural Semantics Coverage (Added in v1.1, Extended in v1.2)**

14. [State Machine Testing Standards](#14-state-machine-testing-standards)
15. [Event-Driven Testing Standards](#15-event-driven-testing-standards)
16. [OAPEFLIR Stage Coverage Matrix](#16-oapeflir-stage-coverage-matrix)
17. [Concurrency and Timing Testing Standards](#17-concurrency-and-timing-testing-standards)
18. [Design Specification to Test Traceability](#18-design-specification-to-test-traceability)
19. [Real Execution vs Mock Execution Boundary](#19-real-execution-vs-mock-execution-boundary)
20. [Test Debt Classification](#20-test-debt-classification)
21. [Failure Case Replay Rules](#21-failure-case-replay-rules)
22. [Test Data Governance](#22-test-data-governance)
23. [Coverage Quality Thresholds](#23-coverage-quality-thresholds)

---

## 1. Testing Infrastructure Overview

### 1.1 Tech Stack

| Component | Choice | Version |
|-----------|--------|---------|
| Test runner | `node:test` (Node.js built-in) | Node 22+ |
| Assertions | `node:assert/strict` | Node 22+ |
| Mocking | Hand-written mock objects + `tests/helpers/typed-factories.ts` | - |
| Coverage | c8 (V8 native) | v11.0.0 |
| Mutation | Stryker Mutator | v9.6.1 |
| Lint | ESLint | - |
| Typecheck | TypeScript `tsc --noEmit` | - |

### 1.2 Key Design Decisions

- **No external test framework**: No Jest / Vitest / Mocha, reduces dependencies
- **No external mock library**: No Sinon / testdouble, mocks created via type-safe factory functions
- **Compile then run**: `npm run build:test` compiles `src/` + `tests/` -> `dist/`, tests run from `dist/tests/**/*.test.js`
- **Coverage ratchet**: Baseline can only go up, never down, enforced by CI

### 1.3 Current Scale

| Metric | Value |
|--------|-------|
| Total test files | 922 |
| Total test cases | ~9,340 |
| OAPEFLIR test files | 26 |
| OAPEFLIR test cases | ~119 |
| Global line coverage | 82.0% |
| Global function coverage | 87.0% |
| Global branch coverage | 78.3% |

---

## 2. Command Quick Reference

```bash
# Full test suite (with coverage gate)
npm test

# Run tests only (without gate)
npm run test:raw

# Layered execution
npm run test:unit
npm run test:integration
npm run test:golden

# Specific file
npm run build:test && node --test "dist/tests/unit/core/agent-loop/*.test.js"

# PostgreSQL integration test (requires PG environment)
AA_TEST_PG_DSN="postgres://..." npm run test:pg-integration

# Performance test
npm run test:performance

# Mutation test
npm run test:mutation

# Coverage report
npm run coverage:report

# Update coverage baseline
npm run coverage:baseline:update

# Type check
npm run typecheck
```

---

## 3. Directory Structure and Layering Rules

### 3.1 Directory Layout

```
tests/
├── unit/                  # Isolated logic tests (652 files)
│   ├── core/              # Mirror structure of src/core/
│   │   ├── agent-loop/    # OAPEFLIR loop
│   │   ├── knowledge/     # Knowledge plane
│   │   ├── feedback/      # Feedback layer
│   │   ├── learning/      # Learning layer
│   │   ├── planning/      # Planning layer
│   │   ├── improvement/   # Improvement layer
│   │   ├── memory/        # Memory layer
│   │   ├── artifacts/     # Artifacts layer
│   │   ├── events/        # Event bus
│   │   ├── security/      # Security
│   │   ├── storage/       # Storage
│   │   └── ...
│   ├── plugins/           # Plugin tests
│   └── ...
├── integration/           # Cross-service/runtime tests (245 files)
│   ├── security/          # Security boundary tests (50+ files)
│   ├── runtime/           # Runtime integration
│   ├── storage/           # DB integration
│   └── ...
├── golden/                # Snapshot/Golden tests (8 files)
│   └── snapshots/         # Golden file storage
├── e2e/                   # End-to-end scenarios (9 files)
├── performance/           # Performance benchmarks (7 files)
├── helpers/               # Shared utilities (18 files)
│   ├── typed-factories.ts
│   ├── fixtures/
│   ├── integration-context.ts
│   ├── repository-harness.ts
│   ├── e2e-harness.ts
│   ├── golden.ts
│   ├── env.ts
│   ├── fs.ts
│   └── ...
└── fixtures/              # Migration test fixtures
```

### 3.2 Layering Rules

| Layer | Directory | Rule | Dependencies |
|-------|-----------|------|--------------|
| **Unit** | `tests/unit/` | Single-module isolation tests, all external dependencies mocked | No DB, no network, no file I/O |
| **Integration** | `tests/integration/` | Cross-module, CLI, runtime, sandbox | SQLite in-memory, temp directories allowed |
| **Golden** | `tests/golden/` | Output snapshot comparison | May depend on real services |
| **E2E** | `tests/e2e/` | Complete business flow | Full stack, mock provider |
| **Performance** | `tests/performance/` | Latency/throughput benchmarks | Real DB allowed |

---

## 4. Test Writing Standards and Patterns

### 4.1 Basic Structure

This project uses **flat `test()` calls** without `describe()` nesting. Each test file directly imports `node:test` and `node:assert/strict`.

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { MyService } from "../../../../src/core/my-module/my-service.js";

test("MyService returns default value when input is empty", () => {
  const service = new MyService();
  const result = service.compute({});
  assert.equal(result, "default");
});

test("MyService rejects illegal parameters", () => {
  const service = new MyService();
  assert.throws(() => service.compute(null as any), {
    message: /invalid input/i,
  });
});
```

### 4.2 Naming Conventions

| Dimension | Rule | Example |
|-----------|------|---------|
| File name | `<module-under-test>.test.ts`, kebab-case | `feedback-collector.test.ts` |
| Test title | Behavior description, subject + condition + expectation | `"FeedbackCollector deduplicates signals and emits learning signals"` |
| Variable name | camelCase consistent with production code | `const collector = new FeedbackCollector()` |

### 4.3 Import Paths

All imports use **relative paths + `.js` extension** (because compiled to ESM):

```typescript
// Correct
import { FeedbackCollector } from "../../../../src/core/feedback/feedback-collector.js";

// Wrong - missing .js extension
import { FeedbackCollector } from "../../../../src/core/feedback/feedback-collector";
```

### 4.4 Assertion Patterns

This project uses only `node:assert/strict`, common APIs:

```typescript
// Value equality (===)
assert.equal(result.status, "blocked");

// Deep equality (objects/arrays)
assert.deepEqual(learningSignals[0]?.sourceSignalIds, ["sig_1", "sig_2"]);

// Boolean assertion
assert.ok(result.length > 0);

// Exception assertion
assert.throws(() => schema.parse(badInput));
assert.throws(() => fn(), { message: /expected pattern/ });

// Async exception
await assert.rejects(async () => service.execute(), {
  message: /timeout/,
});

// Does not throw (commonly used for Schema validation)
assert.doesNotThrow(() => schema.parse(validPayload));
```

### 4.5 Sync vs Async

- **Unit tests**: Prefer sync. Pure functions, schema parsing, in-memory services are all sync
- **Integration tests**: Usually `async`, because involving DB/files/subprocesses
- **Principle**: If the function under test returns `Promise`, mark the test function `async`; otherwise keep it sync

### 4.6 Resource Cleanup Pattern

Integration and E2E tests use `try/finally` pattern to ensure cleanup:

```typescript
test("sandbox blocks symlink traversal", async () => {
  const workspace = createTempWorkspace("aa-sandbox-");
  const outside = createTempWorkspace("aa-target-");
  try {
    // ... test logic
    assert.equal(result.status, "blocked");
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});
```

**Forbidden** to use `afterEach` or global teardown - Node.js test runner has limited support for these, and `try/finally` is more reliable.

### 4.7 Test Data Construction

Use fixture factory functions + spread overrides pattern to avoid large inline data:

```typescript
import { createMinimalTask } from "../../../helpers/fixtures/base.js";

test("task store persists custom priority", () => {
  const task = createMinimalTask({ priority: "critical" });
  store.insertTask(task);
  const loaded = store.getTask(task.id);
  assert.equal(loaded.priority, "critical");
});
```

### 4.8 Security Test Patterns

Security tests follow **denial-path regression** pattern - each test verifies one attack vector is rejected:

```typescript
test("command executor blocks null-byte injection in path argument", async () => {
  // 1. Build attack input
  const nullBytePath = "somefile\x00.txt";
  // 2. Execute
  const result = await executor.execute({ ..., args: [nullBytePath] });
  // 3. Assert rejection + specific error code
  assert.equal(result.status, "blocked");
  assert.equal(result.error?.code, "sandbox.command_arg_path_denied");
});
```

---

## 5. Mock and Helper Toolbox

This project **does not use Sinon / testdouble**, all mocks are implemented via hand-written factory functions, centralized in `tests/helpers/`.

### 5.1 Tool Inventory

| File | Core Exports | Purpose |
|------|--------------|---------|
| `typed-factories.ts` | `unsafeCast<T>()`, `partial<T>()`, `createMockCacheStore()`, `createMockCacheFacade()`, `createMockCacheMetrics()` | Type-safe mock object creation |
| `fixtures/base.ts` | `createMinimalTask()`, `createMinimalExecution()`, `createMinimalApproval()` | Minimal valid domain records |
| `fixtures/composite.ts` | `createBlockedTask()`, `createApprovalRequest()`, `createCompletedTask()`, `createFailedTask()` | Multi-entity association scenarios |
| `env.ts` | `withEnv(overrides, fn)`, `withEnvSync(overrides, fn)` | Environment variable isolation |
| `fs.ts` | `createTempWorkspace()`, `cleanupPath()`, `createFile()`, `createSymlink()` | Temporary filesystem |
| `integration-context.ts` | `createIntegrationContext()`, `createSeededIntegrationContext()` | SQLite + TaskStore integration context |
| `repository-harness.ts` | `createRepositoryHarness()`, `createRepositoryWithStoreHarness()` | Repository layer DB testing |
| `e2e-harness.ts` | `createE2EHarness()`, `createSeededE2EHarness()` | Full-stack E2E context |
| `golden.ts` | `assertGolden()`, `assertGoldenContains()`, `assertGoldenMatches()` | Snapshot assertions |
| `process-guard.ts` | `createProcessGuard()`, `withProcessGuard()` | Subprocess leak detection (ADR-072) |
| `concurrent-runner.ts` | `runConcurrentInvariant()`, `runConcurrentStateModification()`, `runCriticalSectionTest()` | Concurrent invariant verification |
| `api.ts` | `createSeededApiContext()` | Complete API integration seed (DB + 12 services) |

### 5.2 `unsafeCast<T>()` and `partial<T>()`

`unsafeCast<T>()` replaces scattered `as any`, making it searchable and auditable:

```typescript
import { unsafeCast } from "../../../helpers/typed-factories.js";

const fakeProvider = unsafeCast<LlmProvider>({
  generate: async () => ({ text: "mock response", tokens: 10 }),
});
```

`partial<T>()` is used to construct partially implemented interface objects (type-correct `Partial<T>`):

```typescript
import { partial } from "../../../helpers/typed-factories.js";

const config = partial<RuntimeConfig>({ maxRetries: 3, timeoutMs: 5000 });
```

### 5.3 Mock Creation Pattern

The project uniformly uses **object literal + interface type** approach to create mocks:

```typescript
const mockStore: CacheStore = {
  async get() { return { hit: false, value: null, reason: "not_found" }; },
  async set() { /* no-op */ },
  async delete() { /* no-op */ },
  async clear() { /* no-op */ },
};
```

**Do NOT use** `jest.fn()` / `sinon.stub()` - if you need to record calls, use closure arrays:

```typescript
const calls: string[] = [];
const mockLogger = {
  info(msg: string) { calls.push(msg); },
  error(msg: string) { calls.push(`ERROR: ${msg}`); },
};
// ... execute code under test ...
assert.equal(calls.length, 2);
assert.ok(calls[0]?.includes("started"));
```

### 5.4 Environment Variable Isolation

`withEnv()` saves original values before callback, restores after (even if throws):

```typescript
import { withEnv } from "../../../helpers/env.js";

test("respects AA_LOG_LEVEL env var", async () => {
  await withEnv({ AA_LOG_LEVEL: "debug" }, async () => {
    const config = loadConfig();
    assert.equal(config.logLevel, "debug");
  });
});
```

### 5.5 Harness Selection Guide

| Scenario | Use |
|----------|-----|
| Pure logic unit test | Direct `new Service()` + inline mock |
| Repository test | `createRepositoryHarness()` |
| Cross-service integration test | `createIntegrationContext()` or `createSeededIntegrationContext()` |
| API endpoint test | `createSeededApiContext()` -> `ctx.createServer()` |
| E2E full flow | `createE2EHarness()` or `createSeededE2EHarness()` |
| Subprocess-related | Wrap with `withProcessGuard(fn)` |
| Concurrency safety | `runConcurrentInvariant()` / `runCriticalSectionTest()` |

---

## 6. Coverage Gate Mechanism

### 6.1 Three-Layer Architecture

```
c8 (V8 native) -> generate-coverage-report.mjs -> check-coverage-baseline.mjs
                                                          |
                                                         v
                                                 .coverage-baseline.json (ratchet)
```

### 6.2 c8 Configuration (`.c8rc.json`)

| Parameter | Value | Description |
|-----------|-------|-------------|
| `reporter` | `["text", "html", "lcov", "json-summary"]` | Four-format output |
| `include` | `["dist/src/**/*.js"]` | Only count production code |
| `exclude` | tests, scripts, configs, node_modules | Exclude non-production files |
| `all` | `true` | Files not loaded by tests also count (0% coverage) |

### 6.3 Ratchet Baseline (`.coverage-baseline.json`)

Global thresholds:

| Metric | Current Baseline |
|--------|-----------------|
| Lines | 82.0% |
| Statements | 82.0% |
| Functions | 87.0% |
| Branches | 78.3% |

**Ratchet rule**: `check-coverage-baseline.mjs` compares current coverage with baseline:
- Any metric **below** baseline -> CI fails (exit code 1)
- Any directory **not in** baseline -> CI fails (untracked directory)
- After coverage **increases**, run `npm run coverage:baseline:update` to update baseline -> new value becomes new floor

### 6.4 Directory-Level Baselines (OAPEFLIR Related)

| Directory | Lines | Functions | Branches |
|-----------|-------|-----------|----------|
| `src/core/agent-loop` | 87.3% | 71.4% | 73.6% |
| `src/core/knowledge` | 90.8% | 98.2% | 76.5% |
| `src/core/feedback` | 87.9% | 82.6% | 69.6% |
| `src/core/learning` | 90.4% | 88.9% | 85.7% |
| `src/core/planning` | 76.5% | 69.2% | 72.3% |
| `src/core/improvement` | 88.5% | 84.6% | 52.4% |
| `src/core/memory` | 86.9% | 83.7% | 84.0% |
| `src/core/artifacts` | 93.4% | 93.8% | 78.4% |
| `src/plugins` | 57.3% | 60.0% | 86.7% |

**Weak areas**: `improvement` branches at only 52.4%, `plugins` lines at only 57.3%, `planning` lines at only 76.5%.

### 6.5 Update Process

```bash
npm test                          # Run full test suite
npm run coverage:baseline:update  # Only execute after all tests pass
git diff .coverage-baseline.json  # Verify changes are reasonable
git add .coverage-baseline.json   # Commit new baseline
```

---

## 7. Test Coverage Assurance System

This section is the core methodology of the entire manual - answering the question **"How to ensure tests have no gaps"**. The system consists of five layers of protection, each addressing different levels of gap risk.

### 7.1 Five-Layer Protection Model

```
+------------------------------------------------------------------+
| Layer 5: PR Review Checklist (Human Review)                      |
+------------------------------------------------------------------+
| Layer 4: Mutation Testing Stryker (Assertion Validity Verification)|
+------------------------------------------------------------------+
| Layer 3: Coverage Ratchet + Directory-Level Baselines (Numbers Don't Roll Back)|
+------------------------------------------------------------------+
| Layer 2: Traceability Matrix (Source File <-> Test File Mapping) |
+------------------------------------------------------------------+
| Layer 1: Layered Testing Strategy (Unit / Integration / E2E)     |
+------------------------------------------------------------------+
```

### 7.2 Layer 1: Layered Testing Strategy

**Addresses gap type**: Blind spots caused by improper test granularity.

Each feature point must be tested at the correct layer:

| Concern | Correct Test Layer | Anti-pattern |
|---------|-------------------|--------------|
| Pure function logic (parsing, validation, transformation) | Unit | Use E2E to test logic branches |
| Database read/write, transactions, migrations | Integration | Use mock DB to hide SQL errors |
| Multi-service collaboration, event propagation | Integration | Mock each service separately then skip collaboration tests |
| Security boundaries (sandbox, path traversal) | Integration | Only use Unit to test regex |
| API contracts (HTTP status codes, response body) | Integration / E2E | Only test service layer, not HTTP layer |
| Full-flow business scenarios | E2E | N/A |
| Output format stability | Golden | Hand-write expected strings |
| Concurrency safety | Integration + concurrent-runner | Single-thread test then assume thread-safe |

**Execution rules**:

1. Every `src/core/<module>/` directory must have a corresponding `tests/unit/core/<module>/` directory
2. Every externally exposed service class must have at least 1 unit test file
3. Features involving DB / filesystem / subprocesses must have integration tests
4. Security-related changes must have denial-path regression tests

### 7.3 Layer 2: Traceability Matrix

**Addresses gap type**: Source files without corresponding test files.

Build **source file -> test file** mapping to ensure every production file has corresponding tests.

**Generation method**:

```bash
# Step 1: List all production source files (exclude index.ts, types)
find src/core -name "*.ts" ! -name "index.ts" ! -name "*.d.ts" ! -path "*/types/*" | sort > /tmp/src-files.txt

# Step 2: List all test files
find tests/unit tests/integration -name "*.test.ts" | sort > /tmp/test-files.txt

# Step 3: Compare, find source files without test coverage
while read src; do
  base=$(basename "$src" .ts)
  if ! grep -q "$base" /tmp/test-files.txt; then
    echo "UNCOVERED: $src"
  fi
done < /tmp/src-files.txt
```

**Matrix maintenance rules**:

- Every `.ts` source file added in a PR must have a corresponding `.test.ts` file
- If a file genuinely doesn't need testing (pure type definitions, barrel exports), mark `N/A` + reason in the matrix
- Run the above script at the end of each sprint, update the gaps list

### 7.4 Layer 3: Coverage Ratchet

**Addresses gap type**: Existing tests deleted or new code not covered.

See [Section 6 Coverage Gate Mechanism](#6-coverage-gate-mechanism). Key points:

- **Global gate**: lines/statements/functions/branches four dimensions
- **Directory-level gate**: Each `src/core/<module>` has its own baseline
- **`all: true`**: Files not imported by any test also count (shown as 0% coverage), preventing "no one references it so no one tests it"
- **Only increases**: Baseline values monotonically increase via `npm run coverage:baseline:update`

**Limitations of coverage**: Coverage only says "code was executed", not "behavior was verified". For example:

```typescript
test("calls the function", () => {
  myFunction();  // 100% line coverage, but 0 assertions
});
```

This is why Layer 4 is needed.

### 7.5 Layer 4: Mutation Testing

**Addresses gap type**: Code executed but lacking valid assertions.

Stryker injects **mutants** into code, for example:
- `>` changed to `>=`
- `true` changed to `false`
- Delete entire statement
- String `"error"` changed to `""`

If tests still pass after mutant injection (mutant survived), it means tests failed to effectively detect this logic change.

See [Section 11 Mutation Testing (Stryker)](#11-mutation-testing-stryker). Thresholds:
- **break = 50%**: Below this CI fails directly
- **low = 60%**: Yellow warning
- **high = 80%**: Green target

**Complementary relationship between mutation testing and coverage**:

| Scenario | Line Coverage | Mutation Score | Problem |
|----------|--------------|-----------------|---------|
| Executed with assertions | High | High | None |
| Executed without assertions | High | **Low** | Missing assertions |
| Not executed | **Low** | Low | Missing tests |
| Dead code | Low | Low | Needs removal |

### 7.6 Layer 5: PR Review Checklist

**Addresses gap type**: Logic gaps that automated tools cannot detect.

Before merging any PR, reviewer checks the following:

- [ ] Every new/modified public function has corresponding tests
- [ ] Both happy path AND error path are covered
- [ ] Boundary conditions are tested (empty array, null, 0, MAX_INT, timeout)
- [ ] Security changes have denial-path regression
- [ ] Async functions test reject/error paths
- [ ] Config changes have corresponding config validation tests
- [ ] Coverage improved or unchanged (not degraded)
- [ ] Mutation test score improved or unchanged

### 7.7 Gap Type Classification and Corresponding Protection

| Gap Type | Description | Detection Layer |
|----------|-------------|-----------------|
| **File-level gap** | Entire source file has no tests | Layer 2 (Matrix) + Layer 3 (`all: true`) |
| **Function-level gap** |某个 exported function has no tests | Layer 3 (function coverage) + Layer 5 (Review) |
| **Branch-level gap** | if/else/switch some branch not covered | Layer 3 (branch coverage) + Layer 4 (Stryker) |
| **Assertion-level gap** | Code executed but no result verification | Layer 4 (Stryker mutant survived) |
| **Scenario-level gap** | Missing specific business scenario tests | Layer 5 (Review) |
| **Boundary condition gap** | Empty input/extreme/concurrency not covered | Layer 4 + Layer 5 |
| **Regression gap** | Bug fix without adding regression test | Layer 5 (Review) + Layer 3 (ratchet doesn't roll back) |
| **Security gap** | Attack vectors not tested | Layer 1 (denial-path standards) + Layer 5 |

### 7.8 Test Completion Priority Sorting Method

When gaps are found, prioritize completion in this order:

```
P0 - Security boundary untested (sandbox escape, path traversal, injection attack)
P1 - Core orchestrator / service has no tests (0% coverage)
P2 - Existing tests but branch coverage < 60%
P3 - Existing tests but mutation score < 50% (insufficient assertions)
P4 - Helper functions / utility classes missing boundary condition tests
P5 - Type definition Schema validation tests
```

### 7.9 Continuous Assurance Process

```
Development -> Write code + Write tests (TDD or Code-then-Test)
               |
Local verification -> npm test (coverage + gate)
               |
PR submission -> CI auto-runs: lint -> typecheck -> test -> coverage:gate
               |
PR Review -> Human Checklist (Section 7.6)
               |
Main merge -> Stryker mutation testing (triggered on push to main)
               |
Sprint end -> Run Traceability Matrix script, update gaps list
```

---

## 8. Security Regression Testing Standards

### 8.1 Denial-Path Regression Methodology

Core principle of security testing: **One test per attack vector, assert rejection status + specific error code**.

```
Attack surface identification -> Build malicious input -> Call interface under test -> Assert blocked/denied + error code
```

### 8.2 Attack Surface Classification

| Attack Surface | Test Target | Typical Attack Vectors |
|----------------|-------------|------------------------|
| **Path traversal** | Sandbox filesystem isolation | `../`, symlink, double-encoded `%2f`, null-byte `\x00` |
| **Command injection** | Command executor parameter filtering | `;`, `$()`, backtick, `&&`, `\|\|`, `|`, `${VAR}` |
| **Privilege bypass** | Execution-level tool authorization | Modify allowedToolsJson, malformed allowlist |
| **Script escape** | Interpreter path restrictions | Script paths outside workspace, absolute paths pointing outside |
| **Input validation** | Schema / config validation | Overlong strings, type mismatch, missing required fields |
| **Concurrency attack** | Lock and transaction isolation | Concurrently approve same request, concurrently write same resource |

### 8.3 Security Test Structure Template

```typescript
test("<component> blocks <attack type> <specific description>", async () => {
  const workspace = createTempWorkspace("aa-security-");
  try {
    // 1. Build attack input
    const maliciousInput = buildAttackPayload();

    // 2. Execute interface under test
    const result = await targetService.execute({
      ...validBaseRequest,
      ...maliciousInput,
    });

    // 3. Assert rejection
    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "specific.error_code");
  } finally {
    cleanupPath(workspace);
  }
});
```

### 8.4 Security Test Naming Standards

Title must clearly state **who rejected what**:

```
+ "command executor blocks symlink cwd traversal before spawning the process"
+ "command executor blocks null-byte injection in path argument"
+ "sandbox policy denies write outside workspace root"
- "security test 1"
- "test injection"
```

### 8.5 Required Scenarios for Security Tests

For each component involving security boundaries, cover at least:

1. **Normal legitimate request** - Confirm happy path works (at least 1 positive test)
2. **Path escape** - Cover at least three vectors: `../`, symlink, absolute path
3. **Input injection** - Cover at least two vectors: shell metachar, null-byte
4. **Insufficient permissions** - Unauthorized tool, wrong domain/role
5. **Malformed input** - malformed JSON, type mismatch, null values
6. **Fail-close** - When security check logic itself has an error, default to rejection rather than allow

---

## 9. Golden / Snapshot Testing

### 9.1 Applicable Scenarios

Golden tests apply to scenarios where **output format needs to be stable**:

- CLI output format (`inspect`, `doctor`, `dispatch-execution` command output)
- API response body structure
- Configuration file generation results
- Log format

### 9.2 How It Works

```
First run (UPDATE_GOLDEN=1) -> Write actual output to tests/golden/snapshots/<name>.golden
Subsequent runs -> Compare actual output with .golden file
  Match -> Test passes
  Mismatch -> Test fails, prompt to run UPDATE_GOLDEN=1
```

### 9.3 Usage

```typescript
import test from "node:test";
import { assertGolden } from "../../helpers/golden.js";

test("inspect output matches golden snapshot", () => {
  const output = inspectService.generateReport();
  assertGolden("inspect-report-v1", output);
});
```

Three assertion APIs:

| API | Purpose |
|-----|---------|
| `assertGolden(name, actual)` | JSON exact match |
| `assertGoldenContains(name, substring)` | Contains substring |
| `assertGoldenMatches(name, regex)` | Regex match |

### 9.4 Updating Snapshots

```bash
UPDATE_GOLDEN=1 npm run test:golden
git diff tests/golden/snapshots/       # Review changes
git add tests/golden/snapshots/
```

### 9.5 Golden Test Notes

- **Do not** include timestamps, random IDs and other unstable fields in golden files - normalize first then snapshot
- Snapshot files must be under git version control
- Golden file naming uses version suffix (`-v1`, `-v2`), create new version when output format intentionally changes

---

## 10. Performance Benchmark Testing

### 10.1 Applicable Scenarios

- Key path latency regression detection
- Throughput benchmark (tasks/sec, queries/sec)
- Memory usage benchmark

### 10.2 Test Location

`tests/performance/` directory, filename `*.test.ts`, run via `npm run test:performance`.

### 10.3 Writing Pattern

```typescript
import test from "node:test";
import assert from "node:assert/strict";

test("task insertion throughput exceeds 1000 ops/sec", () => {
  const iterations = 5000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    store.insertTask(createMinimalTask({ id: `perf-task-${i}` }));
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  assert.ok(opsPerSec > 1000, `Expected > 1000 ops/sec, got ${opsPerSec.toFixed(0)}`);
});
```

### 10.4 Performance Test Principles

- **Isolated execution**: `npm run test:performance` is independent from main test suite to avoid interference
- **Absolute thresholds**: Assert absolute performance metrics (e.g., >1000 ops/sec), not relative changes
- **Warmup**: Execute a few warmup iterations before timing to exclude JIT compilation effects
- **Multiple runs median**: For latency-sensitive tests, take median of multiple runs to reduce variance
- **Optional in CI**: Performance tests run as optional job in CI, not blocking merge (due to high machine variance)

---

## 11. Mutation Testing (Stryker)

### 11.1 Concept

Mutation testing answers the question coverage cannot answer: **Are test assertions truly effective?**

Stryker injects tiny mutations (mutants) into source code, then runs the test suite. If tests still pass (mutant survived), it means no assertion can detect this code change - meaning there's an assertion gap.

### 11.2 Configuration (`stryker.config.mjs`)

| Parameter | Value | Description |
|-----------|-------|-------------|
| `testRunner` | `"command"` | Runs via `npm run test:unit` |
| `mutate` | `src/core/**/*.ts` | Mutation scope: core business code |
| Exclude | `.d.ts`, `index.ts`, `types/**` | Don't mutate type definitions and barrels |
| `thresholds.break` | 50 | Below 50% -> CI fails |
| `thresholds.low` | 60 | Below 60% -> Yellow warning |
| `thresholds.high` | 80 | Above 80% -> Green |
| `coverageAnalysis` | `"perTest"` | Each test individually analyzes coverage |

### 11.3 Running

```bash
npm run test:mutation         # Run locally
# In CI, only runs on push to main (time-consuming)
```

Report output to `reports/mutation/`, includes HTML visualization report.

### 11.4 Reading Reports

| Status | Meaning | Action |
|--------|---------|--------|
| **Killed** | Test detected mutation and failed | No action needed |
| **Survived** | Test still passes after mutation | **Need stronger assertions** |
| **No coverage** | Mutated code not executed by any test | Need to add tests |
| **Timeout** | Mutation caused infinite loop/timeout | Treated as killed |
| **Runtime error** | Mutation caused runtime crash | Treated as killed |

### 11.5 Handling Survived Mutants

```typescript
// Assume Stryker reports: mutant survived after changing `>` to `>=`
// Original code: if (retries > maxRetries) throw new Error("exceeded");

// Indicates missing boundary test. Need to add:
test("throws when retries equals maxRetries", () => {
  // Test behavior when retries === maxRetries
  // If should throw, add assert.throws
  // If should not throw, add assert.doesNotThrow
});
```

### 11.6 Mutation Testing Collaboration with Other Layers

- **Coverage** tells you "which code was not executed" -> Add tests
- **Stryker** tells you "which code was executed but assertions insufficient" -> Strengthen assertions
- The two complement each other, cannot replace each other

---

## 12. CI Integration and Workflow

### 12.1 CI Pipeline Architecture

```yaml
CI (GitHub Actions)
+-- validate (matrix: Node 20 + 22)
|   +-- npm ci
|   +-- lint
|   +-- npm audit --audit-level=high
|   +-- typecheck
|   +-- changelog:check
|   +-- test:raw
|   +-- coverage:gate (Node 22 only)
|   +-- validate:stable
+-- pg-integration
|   +-- test:pg-integration (Postgres 16 service container)
+-- mutation-test (main branch only)
|   +-- stryker
+-- security
|   +-- CodeQL analysis
+-- trivy-scan
    +-- Docker image vulnerability scan
```

### 12.2 Trigger Conditions

| Job | Push to main | PR | Other |
|-----|-------------|-----|-------|
| validate | Yes | Yes | `codex/**` branches |
| pg-integration | Yes | Yes | - |
| mutation-test | Yes | No | Main only |
| security | Yes | Yes | - |
| trivy-scan | Yes | Yes | - |

### 12.3 Test Assurance Points in CI

| Assurance Point | Tool | Failure Condition |
|-----------------|------|------------------|
| Code style | ESLint | Any lint error |
| Type safety | tsc --noEmit | Any type error |
| Dependency security | npm audit | HIGH/CRITICAL vulnerabilities |
| Functional correctness | node --test | Any test failure |
| Coverage not rolling back | check-coverage-baseline.mjs | Below baseline |
| Mutation score | Stryker | Below break=50% |
| Static analysis | CodeQL | Security defects found |
| Container security | Trivy | CRITICAL/HIGH vulnerabilities |

### 12.4 Test Result Archival

CI automatically uploads the following artifacts:
- `test-results/` - Test execution logs
- `coverage/` - HTML coverage report
- `reports/mutation/` - Stryker HTML report

---

## 13. New Module Testing Checklist

When creating a new module, follow this checklist to ensure testing is complete:

### 13.1 Directories and Files

- [ ] Create `tests/unit/core/<module>/` directory
- [ ] Create corresponding `<service-name>.test.ts` for each service class
- [ ] If DB is needed -> Create `tests/integration/core/<module>/` directory

### 13.2 Test Layers

- [ ] **Unit tests**: Every exported function / class method
  - [ ] Happy path (normal input -> expected output)
  - [ ] Error path (illegal input -> expected exception/error code)
  - [ ] Boundary conditions (null, zero, very large value, empty array)
- [ ] **Schema tests** (if using Zod):
  - [ ] Valid minimal payload -> `doesNotThrow`
  - [ ] Invalid payload -> `throws`
  - [ ] Missing optional fields -> `doesNotThrow`
- [ ] **Integration tests** (if involving DB/files/subprocesses):
  - [ ] Use `createIntegrationContext()` or `createRepositoryHarness()`
  - [ ] `try/finally` ensures cleanup
- [ ] **Security tests** (if involving security boundaries):
  - [ ] Denial-path regression covers each attack vector
  - [ ] Fail-close tests

### 13.3 Coverage

- [ ] Run `npm test` locally to confirm coverage is not below global baseline
- [ ] Run `npm run coverage:baseline:update` to update baseline
- [ ] Confirm new directory appears in `.coverage-baseline.json`

### 13.4 Mutation Testing

- [ ] Confirm new module path is within `mutate` glob in `stryker.config.mjs`
- [ ] Run `npm run test:mutation` locally to confirm no large number of survived mutants

### 13.5 CI Compatibility

- [ ] Tests pass on both Node 20 and Node 22
- [ ] Tests support `--test-concurrency=12` parallel execution without shared state conflicts
- [ ] No hardcoded absolute paths, port numbers, timestamps

### 13.6 Documentation

- [ ] Update source file <-> test file mapping in Traceability Matrix (Section 7.3)
- [ ] If introducing new Helper / Fixture, update Section 5 tool inventory

---

---

# Part II - Architectural Semantics Coverage (Added in v1.1)

> Part I addresses "code coverage governance" - ensuring every line of code is executed and every assertion is effective.
> Part II addresses "architectural semantics coverage" - ensuring system key design semantics (state machines, events, concurrency, stage contracts) are all tested.

---

## 14. State Machine Testing Standards

### 14.1 Why Separate Standards Are Needed

This system contains **5 core state machines** (Task / Workflow / Session / Execution / Approval) and **40+ auxiliary lifecycle enums** (Worker, Plugin, Rollout, Circuit Breaker, Lease, Repair Pipeline, etc.).

Regular line/branch coverage cannot guarantee:
- Every legal state transition is tested
- Every illegal state transition is rejected
- Terminal states cannot transition further
- Atomicity of cross-entity cascade transitions

### 14.2 Core State Machine List

| State Machine | Definition File | Validation File | States | Terminal States |
|---------------|----------------|----------------|--------|-----------------|
| **Task** | `src/core/types/status.ts` | `src/core/runtime/transition-service.ts` | 7 | done, failed, cancelled |
| **Workflow** | Same as above | Same as above | 7 | completed, failed, cancelled |
| **Session** | Same as above | Same as above | 7 | completed, failed, cancelled |
| **Execution** | Same as above | Same as above | 8 | succeeded, failed, cancelled, superseded |
| **Approval** | Same as above | Same as above | 5 | approved, rejected, expired, cancelled |

These 5 state machines are implemented via `StateTransitionMachine<T>` generic class, `assertTransition()` method uses CAS to prevent concurrent overwrites.

### 14.3 State Machine Testing Three-Layer Requirements

#### A. Full Coverage of Legal Transitions (Transition Coverage)

Every **legal transition edge** of each state machine must have at least one test:

```typescript
test("task transition: queued -> in_progress is allowed", () => {
  assert.doesNotThrow(() =>
    taskStateMachine.assertTransition("queued", "in_progress")
  );
});
```

**Quantification standard**: Legal edge coverage = tested legal edges / total legal edges = **100%**

Task state machine legal edge list (example):

```
queued -> pending, in_progress, cancelled
pending -> in_progress, cancelled
in_progress -> awaiting_decision, done, failed, cancelled
awaiting_decision -> in_progress, failed, cancelled
```

#### B. Full Rejection of Illegal Transitions (Denial Coverage)

Transitions from **every terminal state** to any non-self state must be tested for rejection:

```typescript
test("task transition: done -> in_progress is rejected", () => {
  assert.throws(
    () => taskStateMachine.assertTransition("done", "in_progress"),
    { message: /invalid_transition/ }
  );
});

test("task transition: done -> done is idempotent (allowed)", () => {
  assert.doesNotThrow(() =>
    taskStateMachine.assertTransition("done", "done")
  );
});
```

**Quantification standard**: All terminal states x all non-self states = must test rejection

#### C. Cross-Entity Cascade Transitions (Cascade Coverage)

`TransitionService` provides `applyTaskTerminalState` and `ApprovalBlockingTransitionService`, which atomically cascade transition multiple entities.

Cascade scenarios that must be tested:

| Trigger | Task | Workflow | Session | Execution | Approval |
|---------|------|----------|---------|-----------|----------|
| task -> done | done | completed | completed | succeeded | - |
| task -> failed | failed | failed | failed | failed | - |
| task -> cancelled | cancelled | cancelled | cancelled | cancelled | - |
| approval needed | awaiting_decision | paused | awaiting_user | blocked | requested |
| approval granted | in_progress | running | streaming | executing | approved |

### 14.4 Auxiliary State Machine Testing Requirements

For non-core state machines (Circuit Breaker, Rollout, Repair Pipeline, Plugin, etc.), requirements are:

| Category | Requirement |
|----------|-------------|
| Has `assertTransition()` validation | Same as core three-layer requirements |
| Has `transitionTo()` without validation | Cover at least happy path + terminal states |
| Only used as enum values | Each enum value appears in at least one test |

### 14.5 Circuit Breaker State Machine Special Requirements

Circuit Breaker (`closed -> open -> half_open -> closed`) involves time and counting, requires additional testing:

- [ ] Consecutive failures >= threshold -> triggers open
- [ ] Failure rate >= 50% -> triggers open
- [ ] Requests in open state are rejected + return `retryAfterMs`
- [ ] After resetTimeoutMs -> transitions to half_open
- [ ] half_open single probe success / failure behavior
- [ ] Consecutive successes >= halfOpenSuccessThreshold -> returns to closed

### 14.6 Transition Table Single Source Rule

**Hard requirement**: The canonical transition map in `transition-service.ts` is the **only authoritative source** for state transitions. Test cases **forbid** manually hard-coding a copy of the transition table.

#### A. Principles

| Item | Rule |
|------|------|
| Single source | All legal/illegal transition judgments must come from `TransitionService`'s production map |
| No copies | Test must not have hand-written copies like `const allowedTransitions = { pending: ["running", ...] }` |
| Data-driven | Test matrix must be **automatically generated** from production map, not manually enumerated |
| Sync guarantee | If production map adds/deletes transitions, tests automatically detect, no manual sync needed |

#### B. Data-Driven Test Generation Template

```typescript
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { TRANSITION_MAP, ALL_STATES } from "../../src/core/types/status.js";

// Auto-generate valid transition pairs from production map
const validPairs: Array<[string, string]> = [];
for (const [from, toSet] of Object.entries(TRANSITION_MAP)) {
  for (const to of toSet) {
    validPairs.push([from, to]);
  }
}

// Auto-generate invalid transition pairs (all pairs - valid pairs - self transitions)
const invalidPairs: Array<[string, string]> = [];
for (const from of ALL_STATES) {
  for (const to of ALL_STATES) {
    if (from === to) continue;
    const allowed = TRANSITION_MAP[from] ?? [];
    if (!allowed.includes(to)) {
      invalidPairs.push([from, to]);
    }
  }
}

test("all valid transitions succeed", () => {
  for (const [from, to] of validPairs) {
    assert.doesNotThrow(
      () => transitionService.assertTransition(from, to),
      `${from} -> ${to} should be valid`
    );
  }
});

test("all invalid transitions are rejected", () => {
  for (const [from, to] of invalidPairs) {
    assert.throws(
      () => transitionService.assertTransition(from, to),
      `${from} -> ${to} should be rejected`
    );
  }
});
```

#### C. CI Guard

- Coverage gate adds check: if test file has hardcoded object literal with same key names as `TRANSITION_MAP`, CI reports warning
- PR Review checklist adds one item: "Are state machine tests auto-derived from production map?"

---

## 15. Event-Driven Testing Standards

### 15.1 Event System Architecture

```
Producer -> TypedEventBus -> DurableEventBus -> SQLite
                                              |
                            EventOpsService -> deliverPending() -> Consumer
                                              |
                              (after 3 retries)
                                         Dead Letter Table
```

This system defines **48 typed events**, divided into 3 Tiers:

| Tier | Semantics | Ack Required | Events | Example |
|------|-----------|-------------|--------|---------|
| **Tier 1** | Must persist + must ack | Required | 9 | `task:status_changed`, `decision:requested` |
| **Tier 2** | Persist, ack optional | Recommended | ~35 | `dispatch:*`, `worker:*`, `plugin:*`, `skill:*` |
| **Tier 3** | Best-effort | None | ~4 | `stream:chunk_emitted`, `perf:*` |

### 15.2 Tier-Based Testing Requirements

#### Tier 1 Events (9 types) - Highest Testing Requirements

Each Tier 1 event must cover complete lifecycle:

| Phase | Test Content |
|-------|-------------|
| **Schema** | payload satisfies Zod validator (valid + invalid) |
| **Publish** | Correctly writes to events table + creates ack record |
| **Deliver** | `deliverPending()` delivers event to registered consumer |
| **Ack** | Consumer processes successfully -> ack status = `"acked"` |
| **Retry** | Consumer processing fails -> exponential backoff retry (100ms -> 5s) |
| **Dead Letter** | After 3 retries -> writes to dead_letter table |
| **Replay** | `EventOpsService.replayConsumer()` redelivers |
| **Integrity** | SHA-256 hash chain not tampered with |

#### Tier 2 Events - Medium Testing Requirements

| Phase | Test Content |
|-------|-------------|
| **Schema** | payload satisfies Zod validator |
| **Publish** | Correctly writes to events table |
| **Deliver** | At least one consumer can receive |
| **Idempotency** | Events with `idempotencyKey` are not consumed multiple times |

#### Tier 3 Events - Basic Testing Requirements

| Phase | Test Content |
|-------|-------------|
| **Publish** | Does not throw exception |
| **Best-effort** | Event does not block when consumer is offline |

### 15.3 DLQ Testing Requirements

System has **3 independent DLQs**:

| DLQ | Location | Test Focus |
|-----|----------|------------|
| Event DLQ | `event_dead_letters` table | After 3 retries correctly enters DLQ + `dlq-manager list` queryable |
| Gateway DLQ | `gateway_dead_letters` table | Non-retryable status codes go directly to DLQ, retryable status codes retry then go to DLQ |
| Jobs DLQ | `queue_jobs.status = "dead_letter"` | Goes to DLQ after exceeding `maxAttempts` |

Each DLQ must test:
- [ ] Messages enter DLQ under correct conditions
- [ ] DLQ messages queryable (list / count)
- [ ] DLQ messages can be cleared (purge)
- [ ] Retriable DLQ messages can re-queue

### 15.4 Event Schema Drift Regression

`RAW_EVENT_SCHEMA_REGISTRY` in `event-registry.ts` defines schema for all events:

```typescript
test("all TypedEventPayloadMap keys are registered in EVENT_SCHEMA_REGISTRY", () => {
  // Already has MissingTypedEventDefinitions type check at compile time
  // Runtime supplement verification
  for (const eventType of Object.keys(TypedEventPayloadMap)) {
    assert.ok(hasEventSchema(eventType), `Missing schema for ${eventType}`);
  }
});
```

### 15.5 Consumer Registration Completeness

Each Tier 1 event has specified consumers in `REQUIRED_CONSUMERS_BY_EVENT_TYPE`. Tests must verify:

```typescript
test("all Tier 1 events have at least one required consumer", () => {
  for (const eventType of TIER_1_EVENT_TYPES) {
    const consumers = getRequiredConsumers(eventType);
    assert.ok(consumers.length > 0, `${eventType} has no required consumers`);
  }
});
```

### 15.6 Consumer Side Effect Idempotency (Hard Requirement)

All **retryable consumers** (Tier 1 must retry, Tier 2 recommended to retry) must pass idempotency tests. Re-consuming the same event **must not** produce:

| Forbidden Behavior | Verification Method |
|-------------------|---------------------|
| Duplicate DB writes | After delivering same event 2 times, related table row count unchanged |
| Duplicate notifications / outbound messages | Mock notification channel, assert call count = 1 |
| Duplicate downstream side effects | Mock downstream service, assert idempotency key is deduplicated |
| Duplicate state machine transitions | Second delivery does not trigger `assertTransition()` (state already at terminal or target) |

#### Idempotency Test Template

```typescript
test("consumer handles duplicate delivery idempotently", async () => {
  const event = buildEvent("task.completed", { taskId: "t-1" });
  const db = await createTestDb();
  const notifier = { send: mock.fn() };

  // First consumption
  await consumer.handle(event, { db, notifier });
  const rowsAfterFirst = await db.count("task_completions");
  assert.equal(notifier.send.mock.calls.length, 1);

  // Duplicate consumption (simulating retry / at-least-once delivery)
  await consumer.handle(event, { db, notifier });
  const rowsAfterSecond = await db.count("task_completions");

  // Assert no duplicate side effects
  assert.equal(rowsAfterSecond, rowsAfterFirst, "duplicate delivery must not create extra rows");
  assert.equal(notifier.send.mock.calls.length, 1, "duplicate delivery must not re-send notification");
});
```

#### Scope

- All consumers registered in `REQUIRED_CONSUMERS_BY_EVENT_TYPE`
- All handlers implementing `onEvent()` / `handleEvent()` interfaces
- Gateway DLQ replay consumer

---

## 16. OAPEFLIR Stage Coverage Matrix

### 16.1 Coverage Matrix Definition

Not by directory, not by file, but defined by **OAPEFLIR 8-stage design semantics** to define minimum test set.

Each stage must cover **7 standard paths**:

| Path Number | Path Name | Description |
|-------------|-----------|-------------|
| P1 | **Happy Path** | Standard input -> stage complete -> correct output |
| P2 | **Degraded Path** | Partial input missing/insufficient -> degraded processing -> output with warnings |
| P3 | **Invalid Input Path** | Illegal/malformed input -> rejection or fail-fast |
| P4 | **Timeout Path** | Stage execution timeout -> correct abort + resource cleanup |
| P5 | **Skip Path** | Stage skipped (condition not met) -> stage status = `"skipped"` |
| P6 | **Downstream Contract Violation** | Upstream output doesn't satisfy current stage input contract -> rejection or rollback |
| P7 | **Human Intervention Path** | Stage requires human intervention -> pause waiting for approval/confirmation -> resume or terminate |

### 16.2 Stage-by-Stage Coverage Matrix

#### Observe

| Path | Test Scenario | Assertion Focus |
|------|--------------|-----------------|
| P1 | Standard task input -> TaskSituation | `objective`, `currentPhase`, `codebaseSnapshot` fields complete |
| P2 | Empty codebase / no fileRefs | TaskSituation still generated, `fileRefs: []` |
| P3 | Illegal taskId / empty objective | Schema rejection |
| P4 | Collection timeout | Timeout abort + return existing snapshot |
| P5 | Input already cached / no changes | Skip re-collection |
| P6 | - | As first stage, no upstream |
| P7 | Task requires human confirmation of scope | Pause collection -> wait for human confirmation -> resume after |

#### Assess

| Path | Test Scenario | Assertion Focus |
|------|--------------|-----------------|
| P1 | Standard TaskSituation -> UnifiedAssessment | complexity / risk / routingDecision / resourceAllocation reasonable |
| P2 | High uncertainty task | Correctly upgrade executionMode to `"supervised"` |
| P3 | Malformed situationRef | Schema rejection |
| P4 | Assessment timeout | Degrade to default assessment |
| P5 | Simple task skips deep assessment | Use fast assessment path directly |
| P6 | TaskSituation missing required fields | Rejection + rollback to Observe |
| P7 | High uncertainty -> requires human supervision | executionMode upgraded to `"supervised"`, wait for approval then continue |

#### Plan

| Path | Test Scenario | Assertion Focus |
|------|--------------|-----------------|
| P1 | Standard assessment -> Plan with steps | stepId unique, dependencies legal, strategy correct |
| P2 | High complexity task | Multi-step DAG + parallel steps |
| P3 | version = 0 / steps empty | Schema rejection |
| P4 | Planning timeout | Return minimal viable plan |
| P5 | Assessment indicates no planning needed | Stage skipped |
| P6 | AssessmentRef doesn't exist | Rejection |
| P7 | High-risk plan requires human review | plan status = `"pending_approval"` -> begin execution after approval |

#### Execute

| Path | Test Scenario | Assertion Focus |
|------|--------------|-----------------|
| P1 | Single-step execution -> DualChannelStepOutput | userFacingResult + systemTelemetry complete |
| P2 | Partial step failures -> partial success | Successful step outputs preserved |
| P3 | Illegal tool call / sandbox rejection | `status: "blocked"` + error code |
| P4 | Step timeout | Step marked `"failed"` + `code: "tool.timeout"` |
| P5 | All steps already completed (replay) | Skip |
| P6 | Step references non-existent tool in Plan | Rejection + rollback to Plan |
| P7 | Step triggers approval block | `status: "blocked_awaiting_approval"` -> resume execution after approval |

#### Feedback

| Path | Test Scenario | Assertion Focus |
|------|--------------|-----------------|
| P1 | Execution result -> FeedbackSignal set | signal correctly classified (success/failure/correction) |
| P2 | Duplicate signals | deduplication takes effect |
| P3 | Empty signal list | Returns empty set, no error |
| P4 | Signal collection timeout | Return partially collected |
| P5 | No execution output | Skip feedback |
| P6 | stepOutputRefs reference non-existent | Ignore + warning |
| P7 | Feedback result requires human confirmation of accuracy | signal marked `"pending_review"` -> takes effect after human confirmation |

#### Learn

| Path | Test Scenario | Assertion Focus |
|------|--------------|-----------------|
| P1 | Feedback signals -> LearningSignal (failure_pattern / recovery_playbook) | learningType + sourceSignalIds correct |
| P2 | Low confidence pattern | Marked as tentative |
| P3 | Illegal learningType | Rejection |
| P4 | Mining timeout | Return empty |
| P5 | No failure signals | Skip learning |
| P6 | FeedbackSignal structure incomplete | Rejection |
| P7 | Learning conclusion requires expert review | learning marked `"expert_review_required"` -> entered after review |

#### Improve

| Path | Test Scenario | Assertion Focus |
|------|--------------|-----------------|
| P1 | Learning output -> ImprovementCandidate (status: proposed -> approved) | changeScope + expectedBenefit reasonable |
| P2 | Improvement exceeds autonomy boundary | status stays `"proposed"`, requires human approval |
| P3 | Empty learning output | No candidate produced |
| P4 | Assessment timeout | candidate marked `"rejected"` |
| P5 | No improvable items | Skip |
| P6 | LearningSignal references illegal sourceSignalRefs | Rejection |
| P7 | Improvement exceeds autonomy boundary -> requires human approval | candidate stays `"proposed"` -> advance or reject after approval |

#### Release (Rollout)

| Path | Test Scenario | Assertion Focus |
|------|--------------|-----------------|
| P1 | approved candidate -> RolloutRecord (shadow -> suggest -> stable) | level progresses correctly |
| P2 | Metrics gate not passed | Stay at current level |
| P3 | Illegal candidateId | Rejection |
| P4 | Rollout timeout | Auto rollback |
| P5 | Candidate rejected | Skip rollout |
| P6 | Candidate references expired evidence | Rejection + re-evaluate |
| P7 | Rollout requires human approval release | rollout stays `"pending_approval"` -> continue advancing level after approval |

### 16.3 Coverage Quantification

```
OAPEFLIR stage coverage = (tested paths) / (8 stages x 7 paths = 56) x 100%
```

**Target**: >= 85% (at least 48/56 paths have tests)

---

## 17. Concurrency and Timing Testing Standards

### 17.1 Modules That Must Have Concurrency Tests

| Module | Concurrency Risk | Test Type |
|--------|-----------------|-----------|
| `execution-lease-service` | Race to acquire lease | Race Test + Idempotency |
| `execution-dispatch-service` | Concurrent dispatch of same ticket | Race Test |
| `execution-worker-handshake-service` | Concurrent claim of same execution | Race Test |
| `distributed-lock-adapter` (SQLite/Redis/PG) | Race to acquire lock | Critical Section Test |
| `durable-event-bus` | Concurrent publish + deliverPending | Race Test |
| `approval-service` | Concurrent approval of same request | Idempotency Test |
| `sqlite-queue-adapter` / `redis-queue-adapter` | Concurrent enqueue + dequeue | Race Test + Idempotency |
| `circuit-breaker` | Concurrent requests trigger state transition | Race Test |
| `transition-service` | Concurrent state transitions (CAS) | Race Test |
| `channel-gateway-retry-executor` | Overlapping polling passes | Non-overlap Test |

### 17.2 Test Type Definitions

#### Race Test

Verify concurrent operations don't cause data corruption or invariant violations:

```typescript
test("concurrent lease acquisition grants exactly one", async () => {
  const result = await runConcurrentInvariant(
    async (workerId) => {
      return leaseService.acquireLease({
        executionId: "exec-1",
        workerId: `worker-${workerId}`,
        ttlMs: 30000,
      });
    },
    { concurrency: 10 }
  );

  const granted = result.values.filter(r => r.decision === "granted");
  assert.equal(granted.length, 1, "Exactly one lease should be granted");
});
```

#### Idempotency Test

Verify duplicate operations produce same result:

```typescript
test("duplicate enqueue with same idempotency key returns existing job", async () => {
  const job1 = queue.enqueue({ data: "test", idempotencyKey: "key-1" });
  const job2 = queue.enqueue({ data: "test", idempotencyKey: "key-1" });
  assert.equal(job1.id, job2.id);
});
```

#### Critical Section Test

Verify mutex only allows one worker to enter:

```typescript
test("distributed lock enforces mutual exclusion", async () => {
  const result = await runCriticalSectionTest(
    async (workerId) => lock.acquire({ lockKey: "shared", owner: `w-${workerId}` }),
    async () => lock.release({ lockKey: "shared", owner: currentOwner }),
    { concurrency: 5 }
  );

  assert.equal(result.violations, 0, "No concurrent access violations");
});
```

#### Timeout Recovery Test

Verify resources are correctly released after timeout:

```typescript
test("expired lease is reclaimed and execution can be re-dispatched", async () => {
  // 1. Acquire lease
  await leaseService.acquireLease({ executionId: "e1", workerId: "w1", ttlMs: 100 });
  // 2. Wait for expiration
  await new Promise(r => setTimeout(r, 200));
  // 3. Reclaim
  const reclaimed = await leaseService.reclaimExpiredLeases();
  assert.equal(reclaimed.length, 1);
  // 4. New worker can acquire
  const result = await leaseService.acquireLease({ executionId: "e1", workerId: "w2", ttlMs: 30000 });
  assert.equal(result.decision, "granted");
});
```

#### Crash Consistency Test

Use `WorkflowCrashSimulator` to verify crash recovery:

```typescript
test("recovery repairs partial commit after crash at step_started", async () => {
  // Inject crash point
  process.env.AA_WORKFLOW_CRASH_POINT = "step_started";
  try {
    await executeWorkflow(...);
  } catch (e) {
    assert.ok(e instanceof InjectedWorkflowCrashError);
  }
  // Verify recovery
  const repairs = await repairService.repair();
  assert.ok(repairs.length > 0);
  // Verify data consistency
  const execution = store.getExecution("e1");
  assert.notEqual(execution.status, "executing"); // Should not be in intermediate state
});
```

### 17.3 Concurrency Test Quantification Standards

| Module Category | Minimum Concurrency | Must Cover |
|-----------------|--------------------|-----------|
| Lock/lease | 10 workers | acquire/release/extend/steal |
| Queue | 20 workers | enqueue/dequeue/ack/dead-letter |
| State transition | 5 workers | CAS competition + terminal state idempotent |
| Event delivery | 10 workers | publish + consumer ack |
| Dispatch | 5 workers | ticket claim + handshake |

### 17.4 Stale Write Prevention Tests

`ExecutionLeaseService.validateWriteAccess()` is the last defense line against dirty writes, must cover all 5 rejection reasons:

- [ ] `lease_not_found` - execution has no lease record
- [ ] `no_active_lease` - lease has expired/released
- [ ] `stale_fencing_token` - fencing token mismatch (old worker writes)
- [ ] `worker_mismatch` - requesting worker is not lease holder
- [ ] `lease_mismatch` - lease ID mismatch

### 17.5 Time Control Strategy

The most common cause of flaky tests in concurrency and timing tests is reliance on real time. This section specifies a unified time control layered strategy.

#### A. Three-Layer Time Control

| Layer | Applicable Scenario | Strategy | Example |
|-------|---------------------|----------|---------|
| L1 - Controllable clock | Logic involving timeout, TTL, interval in Unit tests | Inject `Clock` interface, test passes `FakeClock`, manually advance time | lease expiration, circuit breaker resetTimeout, retry delay |
| L2 - Bounded real time | Integration tests requiring real async/timer interaction | Allow `setTimeout` / `setInterval`, but single sleep <= 500ms, per-test total sleep <= 2s | Queue delivery then wait for consumer consumption |
| L3 - No unbounded wait | All tests | Forbidden `while(true) await sleep()`, `waitForEvent()` without timeout | - |

#### B. Hard Rules

1. **Unit tests forbid direct `setTimeout` / `Date.now()` calls** - must go through injected Clock interface
2. **All `await sleep()` calls must have `{ timeout }` parameter upper bound** - must self-terminate before CI timeout
3. **Integration test total sleep budget**: single test case <= 2s, single test file <= 10s
4. **Retry loops must have `maxAttempts` + `maxWaitMs` dual limits** - prevent infinite retry

#### C. FakeClock Template

```typescript
class FakeClock {
  private _now: number;
  constructor(initialMs = 0) { this._now = initialMs; }
  now(): number { return this._now; }
  advance(ms: number): void { this._now += ms; }
}

test("lease expires after TTL", () => {
  const clock = new FakeClock(1000);
  const lease = createLease({ clock, ttlMs: 5000 });

  assert.equal(lease.isExpired(), false);
  clock.advance(5001);
  assert.equal(lease.isExpired(), true);
});
```

#### D. CI Guard

- Lint rule (or grep CI step) detects bare `Date.now()`, `new Date()`, `setTimeout` calls in unit test directory, flags as warning
- `--test-timeout=30000` as global fallback, test cases exceeding 30s automatically fail

---

## 18. Design Specification to Test Traceability

### 18.1 Goal

Establish **bidirectional traceability between design documents and test cases**, so that:
- Every P0/P1 design specification has corresponding tests
- Every test can be traced back to design requirements

### 18.2 Spec ID Encoding Rules

This project uses **4 prefixes** to distinguish traceable specifications from different sources:

| Prefix | Meaning | Source |
|--------|---------|--------|
| `SPEC-` | Design specification | `opeli_detailed_design.md` and other design documents |
| `ADR-` | Architecture Decision Record | ADR documents in `doc/adr/` directory |
| `CONTRACT-` | Interface/behavior contract | Contract documents in `doc/contracts/` directory |
| `INC-` | Production incident | Incident review records, triggering regression tests |

#### Encoding Format

```
{prefix}{module}-{subsystem}-{sequence}

SPEC examples:
SPEC-OAPEFLIR-EXEC-001     # OAPEFLIR Execute stage specification #1
SPEC-ROLLOUT-STATE-003     # Rollout state machine specification #3
SPEC-PLUGIN-SANDBOX-002    # Plugin sandbox specification #2
SPEC-EVENT-TIER1-DLQ-001   # Tier 1 event DLQ specification #1
SPEC-LEASE-FENCING-001     # Lease fencing token specification #1

ADR examples:
ADR-LOCK-BACKEND-001       # Distributed lock selection ADR #1
ADR-EVENT-DURABILITY-002   # Event durability strategy ADR #2

CONTRACT examples:
CONTRACT-SANDBOX-FS-001    # Sandbox filesystem contract #1
CONTRACT-API-GATEWAY-003   # API Gateway interface contract #3

INC examples:
INC-20250312-LEASE-STALE-001  # 2025-03-12 lease dirty-write incident #1
INC-20250401-DLQ-OVERFLOW-001 # 2025-04-01 DLQ overflow incident #1
```

### 18.3 Referencing Spec IDs in Tests

Include spec ID in test title (supports all 4 prefixes):

```typescript
test("[SPEC-LEASE-FENCING-001] validateWriteAccess rejects stale fencing token", () => {
  // ...
});

test("[ADR-LOCK-BACKEND-001] distributed lock uses SQLite in single-node mode", () => {
  // ...
});

test("[CONTRACT-SANDBOX-FS-001] sandbox rejects symlink traversal", () => {
  // ...
});

test("[INC-20250312-LEASE-STALE-001] regression: stale worker cannot write after lease expiry", () => {
  // ...
});
```

Or maintain a mapping table at the top of the test file:

```typescript
/**
 * Spec coverage:
 *   SPEC-EVENT-TIER1-DLQ-001 — test at line 45
 *   SPEC-EVENT-TIER1-DLQ-002 — test at line 78
 *   CONTRACT-API-GATEWAY-003 — test at line 95
 *   INC-20250401-DLQ-OVERFLOW-001 — test at line 130
 */
```

### 18.4 Traceability Relationship Three Tables

#### Table 1: Source File -> Unit Test

```
src/core/feedback/feedback-collector.ts -> tests/unit/core/feedback/feedback-collector.test.ts
```

(See Section 7.3 Traceability Matrix)

#### Table 2: Source File -> Integration Test

```
src/core/tools/command-executor.ts -> tests/integration/security/sandbox-command-executor.test.ts
```

#### Table 3: Design Specification -> Test

```
opeli_detailed_design.md Section 5 Execute  -> SPEC-OAPEFLIR-EXEC-001 -> tests/unit/core/agent-loop/execute.test.ts:L45
opeli_detailed_design.md Section 12 Rollout -> SPEC-ROLLOUT-STATE-003 -> tests/unit/core/improvement/rollout.test.ts:L88
doc/contracts/sandbox-contract.md    -> SPEC-PLUGIN-SANDBOX-002 -> tests/integration/security/plugin-sandbox.test.ts:L30
```

### 18.5 Maintenance Process

1. **New design specification** -> Assign Spec ID -> Write into design document
2. **Write tests** -> Reference Spec ID in test title or file header
3. **Sprint Review** -> Run traceability script, output list of uncovered Spec IDs
4. **Gap handling** -> Uncovered Spec IDs enter test debt list (Section 20)

Traceability script example (covers all 4 prefixes):

```bash
ID_PATTERN='(SPEC|ADR|CONTRACT|INC)-[\w-]+'

# Extract defined IDs from all source documents
grep -oP "$ID_PATTERN" doc/reviews/opeli_detailed_design.md \
                        doc/adr/*.md \
                        doc/contracts/*.md \
                        doc/incidents/*.md \
  2>/dev/null | sort -u > /tmp/all-spec-ids.txt

# Extract covered IDs from test files
grep -roPh "$ID_PATTERN" tests/ | sort -u > /tmp/tested-specs.txt

# Difference = uncovered
comm -23 /tmp/all-spec-ids.txt /tmp/tested-specs.txt

# Classified statistics by prefix
echo "=== Uncovered Statistics ==="
for prefix in SPEC ADR CONTRACT INC; do
  count=$(grep -c "^${prefix}-" /tmp/uncovered.txt 2>/dev/null || echo 0)
  echo "  ${prefix}: ${count}"
done
```

---

## 19. Real Execution vs Mock Execution Boundary

### 19.1 Problem Background

The most common test trap in Agent systems: **test coverage is high, but core execution is all mock**. The Execute stage in this project currently has completely mock implementation.

Must clearly define which test layers allow mock, which must use real execution.

### 19.2 Mock Permission Matrix

| Component | Unit Test | Integration Test | E2E Test |
|-----------|-----------|------------------|----------|
| **LLM Provider** | Yes Mock | Yes Mock | Yes Mock (provider not under our control) |
| **Tool Execution Bridge** | Yes Mock | No Must be real | No Must be real |
| **Sandbox / Security Policy** | Yes Mock | No Must be real | No Must be real |
| **Database (SQLite)** | No Forbidden mock | No Real in-memory | No Real |
| **Database (PostgreSQL)** | Yes Mock (unit uses SQLite) | No Must be real PG | No Must be real PG |
| **File system** | Yes Mock or temp dir | No Must use temp dir | No Must be real |
| **Subprocess (spawn)** | Yes Mock | No Must be real | No Must be real |
| **Event Bus** | Yes Mock | No Real DurableEventBus | No Real |
| **Distributed lock** | Yes Mock | No Real SQLite/Redis adapter | No Real |
| **Network HTTP** | Yes Mock | Yes Mock (external API) | Yes Mock |
| **OAPEFLIR stage output** | Yes Mock (isolate test single stage) | No Stages need real chaining | No Full chain |

### 19.3 Mock Layer Prohibitions

The following combinations are **strictly forbidden**:

| Prohibition | Reason |
|-------------|--------|
| Mock DB in Integration test | Cannot verify SQL correctness, transaction isolation, migration compatibility |
| Mock sandbox in Integration test | Cannot verify path traversal/command injection protection |
| Mock tool bridge in E2E test | Cannot verify real tool chain behavior |
| Mock `StateTransitionMachine.assertTransition` at any layer | Cannot verify state machine constraints |
| Mock `validateWriteAccess` at any layer | Cannot verify fencing token protection |

### 19.4 Provider Mock Standards

LLM Provider is the only component allowed to be mocked at all layers (because real calls are uncertain, expensive, slow).

Provider mock must follow:

```typescript
const mockProvider = unsafeCast<LlmProvider>({
  async generate(input) {
    return {
      text: "deterministic mock response",
      tokens: input.maxTokens ?? 100,
      finishReason: "stop",
      model: "mock-model",
    };
  },
});
```

- Return value must conform to complete Provider interface type
- Return value must be **deterministic** (fixed content)
- Forbidden to add `Math.random()` or `Date.now()` in mock

---

## 20. Test Debt Classification

### 20.1 Classification Definition

| Level | Definition | Fix Deadline | Example |
|-------|------------|-------------|---------|
| **TD-P0** | Security boundary / state machine / execution main chain untested | Current Sprint | Sandbox new attack vector has no denial-path test |
| **TD-P1** | Core orchestrator low branch/mutation coverage | Next Sprint | `OapeflirLoopService` has no unit test |
| **TD-P2** | Auxiliary service branch < 60% or mutation < 50% | Within 2 Sprints | `improvement` branches at 52.4% |
| **TD-P3** | Utility classes / helper functions missing boundary conditions | Backlog | Pure function missing null value test |
| **TD-P4** | Golden / performance test documentation supplement | Backlog | New CLI command has no golden snapshot |

### 20.2 Debt Registration Format

```
TD-{level}-{sequence}: {description}
  Module: {src/core/xxx}
  Current coverage: {lines}% / {branches}% / mutation {x}%
  Target coverage: {lines}% / {branches}%
  Related Spec: {SPEC-xxx} (if applicable)
  Owner: {owner}
  Due date: {date}
```

### 20.3 Debt Entry and Exit Conditions

**Entry conditions**:
- Section 7 Traceability Matrix script finds uncovered source files
- Coverage gate has directory below safety threshold (Section 23)
- Stryker report shows survived mutants rate > 50%
- PR Review finds missing test scenarios
- Incident replay doesn't produce corresponding regression test

**Exit conditions**:
- Corresponding tests written and merged to main
- Coverage baseline updated
- Mutation score improved to >= low threshold

### 20.4 Sprint Test Debt Auto-Report

At the end of each Sprint, automatically generate test debt report, as necessary input for Sprint Review.

#### A. Report Content

| Section | Data Source | Description |
|---------|-------------|-------------|
| New TD | New TD entries created this Sprint | Statistics by priority |
| Closed TD | TD entries closed this Sprint | Distribution by close reason (fixed / cancelled / demoted) |
| Threshold violations | Section 23 coverage quality threshold check | List directories below safety threshold and gaps |
| Uncovered Spec ID | Section 18.5 traceability script output | Classified by prefix (SPEC / ADR / CONTRACT / INC) |
| Top-N Survived Mutants | Stryker report | Top 10 source files with most survived |
| Unreplayed incidents | Section 21 failure case replay list | Recorded incidents without corresponding regression tests |

#### B. Automation Script Requirements

```bash
#!/usr/bin/env bash
# scripts/ci/sprint-test-debt-report.sh

echo "=== Sprint Test Debt Report ==="
echo "Date: $(date -I)"
echo ""

echo "## 1. Threshold Violations"
node scripts/ci/check-coverage-baseline.mjs --report-only 2>&1 | grep "BELOW"

echo ""
echo "## 2. Uncovered Spec ID"
ID_PATTERN='(SPEC|ADR|CONTRACT|INC)-[\w-]+'
comm -23 \
  <(grep -oP "$ID_PATTERN" doc/reviews/*.md doc/adr/*.md doc/contracts/*.md doc/incidents/*.md 2>/dev/null | sort -u) \
  <(grep -roPh "$ID_PATTERN" tests/ | sort -u)

echo ""
echo "## 3. Top-10 Survived Mutants"
npx stryker run --reporters json 2>/dev/null \
  | node -e "
    const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const byFile = {};
    for (const m of Object.values(r.files)) {
      const survived = m.mutants.filter(x => x.status === 'Survived').length;
      if (survived > 0) byFile[m.source] = survived;
    }
    Object.entries(byFile).sort((a,b) => b[1]-a[1]).slice(0,10)
      .forEach(([f,n]) => console.log('  ' + f + ': ' + n + ' survived'));
  "

echo ""
echo "## 4. Unreplayed Incidents"
# Find incidents in incidents directory that don't yet have corresponding INC- prefix tests
comm -23 \
  <(grep -oP 'INC-[\w-]+' doc/incidents/*.md 2>/dev/null | sort -u) \
  <(grep -roPh 'INC-[\w-]+' tests/ | sort -u)
```

#### C. CI Integration

- Report script runs on every `main` branch merge, output archived to `data/sprint-reports/` directory
- If number of threshold violations > previous report, CI issues warning (not blocking)
- Sprint Review agenda must include interpretation of this report

---

## 21. Failure Case Replay Rules

### 21.1 Core Principle

> **Every production incident, rollback, security escape, high-priority user correction, must be replayed into at least one regression test.**

### 21.2 Replay Trigger Conditions

| Trigger Event | Required Replay Test Type |
|--------------|--------------------------|
| Production incident (P0/P1) | Integration regression + root cause unit test |
| Rollback (Rollout rollback) | State machine transition test + condition gate test |
| Security escape (sandbox bypass) | Denial-path regression (Section 8) |
| User correction (manual correction) | Unit test covering corrected logic branch |
| Data inconsistency fix | Concurrency/transaction isolation test (Section 17) |
| Dead letter backlog | Event lifecycle test (Section 15) |

### 21.3 Replay Process

```
Incident occurs -> Root cause analysis -> Fix code
                             |
               Write regression test (test title includes incident ID)
                             |
               Verify: Delete fix code -> Regression test fails (confirm test effective)
                             |
               Restore fix code -> Test passes -> Merge
```

### 21.4 Replay Test Naming

```typescript
test("[INC-2026-0417] stale fencing token causes duplicate writeback", () => {
  // Reproduce incident root cause
});
```

### 21.5 Replay Verification

Replay tests must pass **reverse verification**:

1. Comment out fix code
2. Run replay test -> Must fail
3. Restore fix code
4. Run replay test -> Must pass

If step 2 test still passes, the test didn't effectively cover the root cause and needs rewrite.

---

## 22. Test Data Governance

### 22.1 Fixture Minimalization Principle

Fixtures only contain **required** fields for the scenario under test, rest use factory defaults:

```typescript
// Good - only specify fields the test cares about
const task = createMinimalTask({ priority: "critical" });

// Bad - copy-paste full record
const task = {
  id: "task-001", parentId: null, rootId: "task-001",
  divisionId: "general_ops", title: "test", status: "queued",
  source: "user", priority: "critical", inputJson: "{}",
  // ... 20 more fields
};
```

### 22.2 Determinism Control

The following non-deterministic sources are **forbidden** in tests:

| Non-deterministic Source | Alternative |
|-------------------------|-------------|
| `Date.now()` / `new Date()` | Use fixed timestamp or `withEnv({ AA_FIXED_TIME: "..." })` |
| `Math.random()` | Use fixed seed or hardcoded value |
| `crypto.randomUUID()` | Use fixed ID (e.g., `"task-test-001"`) |
| Network requests | Mock provider |
| File system timestamps | Normalize in golden tests |
| PIDs in subprocess output | Strip before assertion |

### 22.3 Golden Snapshot Normalization

Normalize unstable fields before writing golden files:

```typescript
function normalizeForGolden(output: unknown): unknown {
  const json = JSON.stringify(output, null, 2);
  return json
    .replace(/"createdAt":\s*"[^"]+"/g, '"createdAt": "<TIMESTAMP>"')
    .replace(/"id":\s*"[a-f0-9-]+"/g, '"id": "<UUID>"')
    .replace(/"pid":\s*\d+/g, '"pid": <PID>');
}
```

### 22.4 Scenario Fixtures vs Domain Fixtures Separation

| Type | File | Purpose |
|------|------|---------|
| **Domain Fixture** | `tests/helpers/fixtures/base.ts` | Minimal valid domain records (Task, Execution, Approval) |
| **Scenario Fixture** | `tests/helpers/fixtures/composite.ts` | Multi-entity association scenarios (BlockedTask, CompletedTask, FailedTask) |
| **Seed Fixture** | `tests/helpers/api.ts` | Complete API environment seed |

When adding new fixture:
- Single entity -> Add to `base.ts`
- Multi-entity association -> Add to `composite.ts`
- Test-specific -> Inline in test file (don't extract)

### 22.5 Test Isolation

- Each test independently creates temp workspace, `try/finally` cleanup
- No shared state between tests (global variables, singletons, static properties)
- Environment variables isolated via `withEnv()`
- Database isolated via separate DB files (don't share in-memory DB)

---

## 23. Coverage Quality Thresholds

### 23.1 Problem

Global 82% line coverage may mask low coverage in critical modules. Need to define **hard minimum thresholds** for different modules.

### 23.2 Tiered Thresholds

| Level | Applicable Modules | Lines Threshold | Branches Threshold | Mutation Threshold |
|-------|-------------------|----------------|-------------------|-------------------|
| **Critical** | security, locking, transition-service, execution-lease | >= 90% | >= 80% | >= 70% |
| **High** | agent-loop, memory, knowledge, events, runtime | >= 85% | >= 75% | >= 60% |
| **Standard** | feedback, learning, planning, improvement, artifacts | >= 80% | >= 70% | >= 50% |
| **Baseline** | plugins, cli, gateway, tools | >= 75% | >= 60% | >= 50% |

### 23.3 Current Gaps

| Module | Level | Current Lines | Threshold | Current Branches | Threshold | Status |
|--------|-------|--------------|-----------|-----------------|-----------|--------|
| `security` | Critical | 91.9% | 90% | 81.4% | 80% | Pass |
| `locking` | Critical | 70.2% | 90% | 81.3% | 80% | Lines gap 19.8% |
| `agent-loop` | High | 87.3% | 85% | 73.6% | 75% | Branches gap 1.4% |
| `planning` | Standard | 76.5% | 80% | 72.3% | 70% | Lines gap 3.5% |
| `improvement` | Standard | 88.5% | 80% | 52.4% | 70% | Branches gap 17.6% |
| `plugins` | Baseline | 57.3% | 75% | 86.7% | 60% | Lines gap 17.7% |

### 23.4 Threshold Enforcement Method

Write thresholds into directory-level minimums in `.coverage-baseline.json`, enforced by `check-coverage-baseline.mjs`.

Current baseline only records "observed values", suggested extension:

```json
{
  "src/core/security": {
    "fileCount": 19,
    "metrics": { "lines": 91.9, ... },
    "minimums": { "lines": 90, "branches": 80 }
  }
}
```

### 23.5 State Machine / Security Special Thresholds

Beyond coverage, the following modules have special thresholds:

| Special | Threshold | Measurement Method |
|---------|-----------|-------------------|
| State machine legal transition coverage | 100% | Tested legal edges / total legal edges |
| State machine illegal transition coverage | All terminal states x all non-self states 100% | Tested rejections / should reject |
| Security denial-path | Each attack surface >= 3 | denial tests / attack surfaces |
| Tier 1 event lifecycle | 9 event types x 8 phases 100% | Tested phases / 72 |
| Fencing token rejection | 5 reasons 100% | Tested rejections / 5 |

---

> **Document End (v1.1)** - This manual upgraded from v1.0 "code coverage governance" to v1.1 "architectural semantics coverage governance".
>
> **Part I** guarantees: sufficient tests, good quality, no obvious gaps.
> **Part II** guarantees: system key design semantics (state machines, events, concurrency, stage contracts) are all covered.
>
> Core philosophy upgraded to: **Coverage ratchet guarantees quantity, mutation testing guarantees quality, Traceability Matrix guarantees completeness, PR Review guarantees context, architectural semantics matrix guarantees design contracts. All five are indispensable.**
