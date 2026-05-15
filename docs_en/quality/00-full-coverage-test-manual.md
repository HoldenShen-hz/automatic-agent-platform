# Full Coverage Testing Manual

> **Document Version**: v4.0
> **Applicable Project**: automatic-agent-platform
> **Test Framework**: Node.js built-in test runner (`node:test`) + `node:assert/strict`
> **Coverage Tool**: c8 v11.0.0 (V8 native coverage) + Istanbul reporter
> **Mutation Testing**: Stryker Mutator v9.6.1
> **Node.js Requirement**: v22+ (`--test` + `--test-concurrency` flags)
> **Last Updated**: 2026-04-23 (based on Architecture Review v8.0 + full codebase measurement)

---

## Table of Contents

**Part I — Testing Governance Fundamentals**

1. [Test Infrastructure Overview](#1-test-infrastructure-overview)
2. [Command Reference](#2-command-reference)
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

**Part II — Architectural Semantics Coverage (added in v1.1, supplemented in v1.2, expanded in v3.0)**

14. [State Machine Testing Standards](#14-state-machine-testing-standards)
15. [Event-Driven Testing Standards](#15-event-driven-testing-standards)
16. [OAPEFLIR Stage Coverage Matrix](#16-oapeflir-stage-coverage-matrix)
17. [Concurrency and Timing Testing Standards](#17-concurrency-and-timing-testing-standards)
18. [Design Specification to Test Traceability Standards](#18-design-specification-to-test-traceability-standards)
19. [Real Execution vs Mock Execution Boundary Standards](#19-real-execution-vs-mock-execution-boundary-standards)
20. [Test Debt Classification](#20-test-debt-classification)
21. [Failure Example Re-injection Rules](#21-failure-example-re-injection-rules)
22. [Test Data Governance](#22-test-data-governance)
23. [Coverage Quality Red Lines](#23-coverage-quality-red-lines)

**Part III — Architectural Gap Regression Test Matrix (rewritten in v4.0, aligned with Architecture Review v8.0)**

24. [Architecture Review-Driven Regression Testing](#24-architecture-review-driven-regression-testing)
25. [P0 Architecture Violation Gap Testing Standards](#25-p0-architecture-violation-gap-testing-standards)
26. [P1 High-Priority Gap Testing Standards](#26-p1-high-priority-gap-testing-standards)
27. [P2 Detail Completion Gap Testing Standards](#27-p2-detail-completion-gap-testing-standards)

**Part IV — Systems Engineering Defect Regression Testing (original Part III preserved in v2.0, updated in v4.0)**

29. [P0 Blocking Engineering Defect Testing Standards](#29-p0-blocking-engineering-defect-testing-standards)
30. [P1 Critical Engineering Defect Testing Standards](#30-p1-critical-engineering-defect-testing-standards)
31. [P2 Important Engineering Defect Testing Standards](#31-p2-important-engineering-defect-testing-standards)
32. [Architecture Invariant Automated Guard Testing](#32-architecture-invariant-automated-guard-testing)
33. [Stub File Coverage Gap Tracking](#33-stub-file-coverage-gap-tracking)
34. [Test Gap and Coverage Status Summary](#34-test-gap-and-coverage-status-summary)

---

## 1. Test Infrastructure Overview

### 1.1 Technology Stack

| Component    | Selection                                              | Version    |
| ------------ | ------------------------------------------------------ | ---------- |
| Test runner  | `node:test` (Node.js built-in)                        | Node 22+   |
| Assertions   | `node:assert/strict`                                  | Node 22+   |
| Mocking      | Hand-written mock objects + `tests/helpers/typed-factories.ts` | —     |
| Coverage     | c8 (V8 native)                                        | v11.0.0    |
| Mutation     | Stryker Mutator                                        | v9.6.1     |
| Lint         | ESLint                                                 | —          |
| Typecheck    | TypeScript `tsc --noEmit`                              | —          |

### 1.2 Key Design Decisions

- **No external test framework**: No Jest / Vitest / Mocha, reducing dependencies (only 12 devDependencies)
- **No external mock library**: No Sinon / testdouble; mocks created via type-safe factory functions
- **Compile before running**: `npm run build:test` compiles `src/` + `tests/` → `dist/`, tests run from `dist/tests/**/*.test.js`
- **Coverage ratchet**: `.coverage-baseline.json` baseline can only go up, never down, enforced by CI
- **TypeScript strict mode**: `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- **ESM modules**: Compile target ES2023 + NodeNext module system, all imports must include `.js` extension

### 1.3 Current Scale

| Metric                              | Value         |
| ----------------------------------- | ------------- |
| Total source files (`src/**/*.ts`)  | **1,387**     |
| Source lines of code                | **265,020**   |
| Total test files (`tests/**/*.ts`)  | **1,823**     |
| Test `.test.ts` file count          | **1,803**     |
| Test lines of code                  | **439,448**   |
| Total assertions (`assert.*` calls) | **~52,480**   |
| Test-to-source file ratio           | **1.30**      |
| Unit test files                     | **1,398**     |
| Integration test files              | **358**       |
| E2E test files                      | **17**        |
| Golden test files                   | **11**        |
| Performance test files              | **10**        |
| Global line coverage (c8 measured)  | **0.75%**     |
| Global statement coverage (c8 measured) | **0.75%** |
| Global function coverage (c8 measured) | **0.61%**  |
| Global branch coverage (c8 measured) | **0.61%**     |

> **v4.0 Changes**: Source files from 1,335 → 1,387 (+52), test files from 1,341 → 1,803 (+462), assertions from ~34,061 → ~52,480 (+18,419). E2E from 10 → 17, Performance from 7 → 10. **Major coverage correction**: v3.0 documentation claimed 82.4% global line coverage, but c8 verification in this release measured only **0.75%** (only 1,384 lines covered out of 182,253 lines, all in 6 files under `src/platform/five-plane-state-evidence/truth/sqlite/`). All values in `.coverage-baseline.json` baseline file are null and have never been truly populated. This indicates v3.0 coverage data came from incremental builds rather than full c8 analysis; this version corrects to measured values.

---

## 2. Command Reference

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
npm run build:test && node --test "dist/tests/unit/platform/five-plane-orchestration/*.test.js"

# PostgreSQL integration tests (requires PG environment)
AA_TEST_PG_DSN="postgres://..." npm run test:pg-integration

# Performance tests
npm run test:performance

# Mutation testing
npm run test:mutation

# Coverage report
npm run coverage:report

# Update coverage baseline
npm run coverage:baseline:update

# Type checking
npm run typecheck

# Operations diagnostics
npm run doctor
npm run inspect
npm run dispatch-execution
npm run worker-handshake
npm run worker-writeback
```

---

## 3. Directory Structure and Layering Rules

### 3.1 Directory Layout

```
tests/
├── unit/                       # Isolated logic tests (1,398 files)
│   ├── platform/               # Mirror structure of src/platform/ (902 files)
│   │   ├── execution/          # Execution plane (151 files)
│   │   ├── state-evidence/     # State evidence plane (164 files)
│   │   ├── control-plane/      # Control plane (117 files)
│   │   ├── orchestration/      # Orchestration plane (112 files)
│   │   ├── shared/             # Shared facilities (140 files)
│   │   ├── interface/          # Interface plane (80 files)
│   │   ├── contracts/          # Contract tests (49 files)
│   │   ├── model-gateway/      # Model gateway (34 files)
│   │   ├── prompt-engine/      # Prompt engine (22 files)
│   │   └── compliance/         # Compliance (11 files)
│   ├── ops-maturity/           # Operations maturity (103 files)
│   ├── scale-ecosystem/        # Scale ecosystem (70 files)
│   ├── sdk/                    # SDK (65 files)
│   ├── domains/                # Domains (55 files)
│   ├── runtime/                # Runtime cross tests (48 files)
│   ├── interaction/            # Interaction (47 files)
│   ├── org-governance/         # Organization governance (42 files)
│   ├── plugins/                # Plugins (24 files)
│   ├── core/                   # Core (13 files)
│   ├── apps/                   # Apps (6 files)
│   ├── deploy/                 # Deployment config guard (4 files)
│   └── docs/                   # Documentation guard (2 files)
├── integration/                # Cross-service/runtime tests (358 files)
│   ├── platform/               # Platform integration (269 files, includes security/ subdirectory)
│   ├── sdk/                    # SDK/CLI integration (35 files)
│   ├── domains/                # Domains (17 files)
│   ├── ops-maturity/           # Operations maturity (17 files)
│   ├── scale-ecosystem/        # Scale ecosystem (7 files)
│   ├── interaction/            # Interaction (3 files)
│   ├── org-governance/         # Organization governance (2 files)
│   ├── stability/              # Stability (2 files)
│   ├── workflow/               # Workflow (2 files)
│   ├── orchestration/          # Orchestration (1 file)
│   ├── deploy/                 # Deployment (1 file)
│   ├── interaction-governance/ # Interaction governance (1 file)
│   └── scale-ops/              # Scale operations (1 file)
├── golden/                     # Snapshot/Golden tests (11 files)
│   └── snapshots/              # Golden file storage
├── e2e/                        # End-to-end scenarios (17 files)
├── performance/                # Performance benchmarks (10 files)
├── helpers/                    # Shared utilities (19 files + fixtures/ subdirectory)
│   ├── typed-factories.ts      # unsafeCast / partial / mock factories
│   ├── fixtures/               # base.ts + composite.ts
│   ├── integration-context.ts  # SQLite + TaskStore integration context
│   ├── repository-harness.ts   # Repository layer DB testing
│   ├── e2e-harness.ts          # Full-stack E2E context
│   ├── golden.ts               # Snapshot assertions
│   ├── env.ts                  # Environment variable isolation
│   ├── fs.ts                   # Temporary filesystem
│   ├── concurrent-runner.ts    # Concurrent invariant verification
│   ├── process-guard.ts        # Subprocess leak detection
│   ├── api.ts                  # API integration seeding
│   ├── pg-test-helper.ts       # PostgreSQL testing
│   ├── cli.ts                  # CLI testing
│   ├── seed.ts                 # Data seeding
│   ├── test-cleanup.ts         # Singleton reset
│   ├── billing.ts              # Billing testing
│   ├── perception.ts           # Perception testing
│   └── pmf.ts                  # PMF testing
└── fixtures/                   # Migration test fixtures
```

### 3.2 Layering Rules

| Layer          | Directory              | Rule                                      | Dependencies                         |
| -------------- | ---------------------- | ----------------------------------------- | ------------------------------------ |
| **Unit**       | `tests/unit/`          | Single-module isolated tests, all external dependencies mocked | No DB, No network, No file I/O      |
| **Integration**| `tests/integration/`   | Cross-module, CLI, runtime, sandbox      | SQLite in-memory, temp directories allowed |
| **Golden**     | `tests/golden/`        | Output snapshot comparison                | May depend on real services         |
| **E2E**        | `tests/e2e/`           | Complete business flow                   | Full stack, mock provider            |
| **Performance**| `tests/performance/`   | Latency/throughput benchmarks             | Real DB allowed                      |

---

## 4. Test Writing Standards and Patterns

### 4.1 Basic Structure

This project uses **flat `test()` calls** without `describe()` nesting. Each test file directly imports `node:test` and `node:assert/strict`.

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { MyService } from "../../../../src/platform/my-module/my-service.js";

test("MyService returns default value when input is empty", () => {
  const service = new MyService();
  const result = service.compute({});
  assert.equal(result, "default");
});

test("MyService rejects illegal arguments", () => {
  const service = new MyService();
  assert.throws(() => service.compute(null as any), {
    message: /invalid input/i,
  });
});
```

### 4.2 Naming Conventions

| Dimension   | Rule                                           | Example                                                        |
| ----------- | ---------------------------------------------- | -------------------------------------------------------------- |
| File name   | `<module-under-test>.test.ts`, kebab-case     | `feedback-collector.test.ts`                                   |
| Test title  | Behavior description: subject + condition + expected | `"FeedbackCollector deduplicates signals and emits learning signals"` |
| Variable name | Same as production code, camelCase          | `const collector = new FeedbackCollector()`                     |

### 4.3 Import Paths

All imports use **relative paths + `.js` extension** (because compilation targets ESM):

```typescript
// Correct
import { FeedbackCollector } from "../../../../src/platform/feedback/feedback-collector.js";

// Incorrect — missing .js extension
import { FeedbackCollector } from "../../../../src/platform/feedback/feedback-collector";
```

### 4.4 Assertion Patterns

This project uses only `node:assert/strict`. Common APIs:

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

// No throw (common for Schema validation)
assert.doesNotThrow(() => schema.parse(validPayload));
```

### 4.5 Sync vs Async

- **Unit tests**: Prefer sync. Pure functions, Schema parsing, in-memory services are all sync
- **Integration tests**: Usually `async`, because they involve DB/file/subprocess
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

**Forbidden**: Do not use `afterEach` or global teardown — Node.js test runner has limited support for these, and `try/finally` is more reliable.

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

### 4.8 Security Test Pattern

Security tests follow **denial-path regression** pattern — each test verifies one attack vector is rejected:

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

This project **does not use Sinon / testdouble**. All mocks are implemented via hand-written factory functions, centralized in `tests/helpers/`.

### 5.1 Tool Inventory

| File                     | Core Exports                                                                                                       | Purpose                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `typed-factories.ts`     | `unsafeCast<T>()`, `partial<T>()`, `createMockCacheStore()`, `createMockCacheFacade()`, `createMockCacheMetrics()` | Type-safe mock object creation   |
| `fixtures/base.ts`       | `createMinimalTask()`, `createMinimalExecution()`, `createMinimalApproval()`                                       | Minimal valid domain records     |
| `fixtures/composite.ts`  | `createBlockedTask()`, `createApprovalRequest()`, `createCompletedTask()`, `createFailedTask()`                    | Multi-entity associated scenarios|
| `env.ts`                 | `withEnv(overrides, fn)`, `withEnvSync(overrides, fn)`                                                             | Environment variable isolation   |
| `fs.ts`                  | `createTempWorkspace()`, `cleanupPath()`, `createFile()`, `createSymlink()`                                        | Temporary filesystem             |
| `integration-context.ts` | `createIntegrationContext()`, `createSeededIntegrationContext()`                                                   | SQLite + TaskStore integration context |
| `repository-harness.ts`  | `createRepositoryHarness()`, `createRepositoryWithStoreHarness()`                                                  | Repository layer DB testing     |
| `e2e-harness.ts`         | `createE2EHarness()`, `createSeededE2EHarness()`                                                                   | Full-stack E2E context           |
| `golden.ts`              | `assertGolden()`, `assertGoldenContains()`, `assertGoldenMatches()`                                                | Snapshot assertions              |
| `process-guard.ts`       | `createProcessGuard()`, `withProcessGuard()`                                                                       | Subprocess leak detection (ADR-072) |
| `concurrent-runner.ts`   | `runConcurrentInvariant()`, `runConcurrentStateModification()`, `runCriticalSectionTest()`                         | Concurrent invariant verification |
| `api.ts`                 | `createSeededApiContext()`                                                                                         | Full API integration seeding (DB + 12 services) |

### 5.2 `unsafeCast<T>()` and `partial<T>()`

`unsafeCast<T>()` replaces scattered `as any` casts, making them searchable and auditable:

```typescript
import { unsafeCast } from "../../../helpers/typed-factories.js";

const fakeProvider = unsafeCast<LlmProvider>({
  generate: async () => ({ text: "mock response", tokens: 10 }),
});
```

`partial<T>()` is used to construct partially-implemented interface objects (type-correct `Partial<T>`):

```typescript
import { partial } from "../../../helpers/typed-factories.js";

const config = partial<RuntimeConfig>({ maxRetries: 3, timeoutMs: 5000 });
```

### 5.3 Mock Creation Pattern

The project uniformly uses **object literals + interface type** to create mocks:

```typescript
const mockStore: CacheStore = {
  async get() {
    return { hit: false, value: null, reason: "not_found" };
  },
  async set() {
    /* no-op */
  },
  async delete() {
    /* no-op */
  },
  async clear() {
    /* no-op */
  },
};
```

**Do NOT use** `jest.fn()` / `sinon.stub()` — if you need to record calls, use closure arrays:

```typescript
const calls: string[] = [];
const mockLogger = {
  info(msg: string) {
    calls.push(msg);
  },
  error(msg: string) {
    calls.push(`ERROR: ${msg}`);
  },
};
// ... execute code under test ...
assert.equal(calls.length, 2);
assert.ok(calls[0]?.includes("started"));
```

### 5.4 Environment Variable Isolation

`withEnv()` saves original values before the callback and restores them after (even if an exception is thrown):

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

| Scenario              | Use                                                               |
| --------------------- | ----------------------------------------------------------------- |
| Pure logic unit test  | Direct `new Service()` + inline mock                              |
| Repository test       | `createRepositoryHarness()`                                       |
| Cross-service integration test | `createIntegrationContext()` or `createSeededIntegrationContext()` |
| API endpoint test     | `createSeededApiContext()` → `ctx.createServer()`                 |
| E2E full flow         | `createE2EHarness()` or `createSeededE2EHarness()`                |
| Subprocess-related    | Wrap with `withProcessGuard(fn)`                                   |
| Concurrency safety    | `runConcurrentInvariant()` / `runCriticalSectionTest()`          |

---

## 6. Coverage Gate Mechanism

### 6.1 Three-Layer Architecture

```
c8 (V8 native) → generate-coverage-report.mjs → check-coverage-baseline.mjs
                                                          ↓
                                                 .coverage-baseline.json (ratchet)
```

### 6.2 c8 Configuration (`.c8rc.json`)

| Parameter   | Value                                         | Description                        |
| ----------- | --------------------------------------------- | ---------------------------------- |
| `reporter`  | `["text", "html", "lcov", "json-summary"]`    | Four-format output                 |
| `include`   | `["dist/src/**/*.js"]`                        | Only measure production code       |
| `exclude`   | tests, scripts, configs, node_modules         | Exclude non-production files       |
| `all`       | `true`                                        | Files not loaded by tests also counted (0% coverage) |

### 6.3 Ratchet Baseline (`.coverage-baseline.json`)

Global thresholds (v4.0 c8 measured data):

| Metric     | Current Measured | v3.0 Claimed | Description                            |
| ---------- | ---------------- | ------------ | -------------------------------------- |
| Lines      | **0.75%**        | 82.4%        | Only 1,384 lines covered out of 182,253 |
| Statements | **0.75%**        | 82.4%        | Same as above                          |
| Functions  | **0.61%**        | 88.5%        | Only 6 out of 983 functions covered    |
| Branches   | **0.61%**        | 80.6%        | Same as above                          |

> **v4.0 Major Correction**: `.coverage-baseline.json` currently has all null values (`directories: {}`), meaning the baseline has never been truly populated. The 82.4% line coverage claimed in v3.0 documentation was verified by c8 `all: true` full analysis to be **0.75%**. The only code actually covered is 6 files under `src/platform/five-plane-state-evidence/truth/sqlite/` (1,384 lines, all at 100% coverage). The remaining 977 source files all have 0% coverage. This confirms v3.0 coverage data may have come from incomplete incremental builds or outdated reports.
>
> **Action Items**: (1) Run full `npm test` + c8 full coverage analysis, (2) populate `.coverage-baseline.json` baseline, (3) enable coverage gate in CI.

**Ratchet Rules**: `check-coverage-baseline.mjs` compares current coverage against baseline:

- Any metric **below** baseline → CI fails (exit code 1)
- Any directory **not in** baseline → CI fails (untracked directory)
- After coverage **improves**, run `npm run coverage:baseline:update` to update baseline → new value becomes new floor
- **Current Status**: Baseline not populated, gate mechanism exists but is not enforced

### 6.4 Directory-Level Baseline (v4.0 c8 Measured Data)

> **Note**: The following data comes from `coverage/coverage-summary.json` c8 full analysis (`all: true`). Since `.coverage-baseline.json` is not populated, the actual coverage status is listed here.

**Directories with coverage** (only 1 directory has non-zero coverage):

| Directory                                    | File Count | Covered Files | Lines                | Functions |
| -------------------------------------------- | ---------- | ------------- | -------------------- | --------- |
| `src/platform/five-plane-state-evidence/truth/sqlite/`  | 25         | 6             | 1,384/36,219 (3.82%) | 6/167     |

The 6 covered files (all at 100%):

- `authoritative-task-store-delegating-governance.ts` (346 lines)
- `authoritative-task-store-delegating-engagement.ts` (345 lines)
- `authoritative-task-store-delegating-lifecycle.ts` (246 lines)
- `authoritative-task-store-delegating-base.ts` (224 lines)
- `authoritative-task-store-delegating-runtime.ts` (213 lines)
- `authoritative-task-store-delegating-core.ts` (10 lines)

**Top 15 zero-coverage directories** (by code volume):

| Directory                              | File Count | Total Lines | Lines Coverage |
| -------------------------------------- | ---------- | ----------- | ------------- |
| `src/platform/five-plane-execution/`              | 162        | 43,202      | 0%            |
| `src/platform/shared/`                 | 100        | 24,079      | 0%            |
| `src/platform/five-plane-control-plane/`          | 75         | 23,555      | 0%            |
| `src/platform/five-plane-orchestration/`          | 81         | 9,332       | 0%            |
| `src/platform/five-plane-interface/`              | 49         | 8,705       | 0%            |
| `src/scale-ecosystem/marketplace/`     | 26         | 7,737       | 0%            |
| `src/sdk/cli/`                         | 78         | 6,148       | 0%            |
| `src/platform/model-gateway/`          | 17         | 5,012       | 0%            |
| `src/platform/contracts/`              | 34         | 4,041       | 0%            |
| `src/domains/registry/`                | 14         | 2,456       | 0%            |
| `src/ops-maturity/drift-detection/`    | 15         | 2,271       | 0%            |
| `src/domains/governance/`              | 4          | 1,632       | 0%            |
| `src/platform/prompt-engine/`          | 9          | 1,432       | 0%            |
| `src/scale-ecosystem/feedback-loop/`   | 7          | 578         | 0%            |
| `src/interaction/nl-gateway/`           | 4          | 549         | 0%            |

> **v4.0 Note**: High-coverage directories listed in v3.0 (e.g., execution/queue 99.7%, workflow-debugger 99.5%) all show 0% in c8 full analysis. This further confirms v3.0 data source was inaccurate. True coverage improvement requires ensuring `npm run build:test` compiles all source and test files to `dist/`, then c8 collects coverage during test execution.

### 6.5 Update Process

```bash
npm test                          # Run full test suite
npm run coverage:baseline:update  # Only execute after all tests pass
git diff .coverage-baseline.json  # Verify changes are reasonable
git add .coverage-baseline.json   # Commit new baseline
```

---

## 7. Test Coverage Assurance System

This section is the core methodology of the entire manual — answering the question **"How do we ensure tests have no gaps?"** The system consists of five layers of protection, each addressing different types of gap risks.

### 7.1 Five-Layer Protection Model

```
┌─────────────────────────────────────────────────────────┐
│ Layer 5: PR Review Checklist (Human Review)             │
├─────────────────────────────────────────────────────────┤
│ Layer 4: Mutation Testing Stryker (Assertion Validity) │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Coverage Ratchet + Directory-Level Baseline   │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Traceability Matrix (Source ↔ Test Mapping)    │
├─────────────────────────────────────────────────────────┤
│ Layer 1: Layered Test Strategy (Unit/Integration/E2E)   │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Layer 1: Layered Test Strategy

**Addresses**: Gaps caused by improper test granularity.

Each feature point must be tested at the correct layer:

| Concern                              | Correct Test Layer                 | Anti-pattern                          |
| ------------------------------------ | ---------------------------------- | ------------------------------------- |
| Pure function logic (parsing, validation, transformation) | Unit                    | Using E2E to test logic branches      |
| Database read/write, transactions, migrations | Integration           | Using mock DB to hide SQL errors      |
| Multi-service collaboration, event propagation | Integration        | Skipping collaboration tests after mocking each service individually |
| Security boundaries (sandbox, path traversal) | Integration         | Relying solely on Unit tests for regex |
| API contracts (HTTP status codes, response body) | Integration / E2E    | Testing only service layer without HTTP layer |
| Full business flow scenarios         | E2E                                 | None                                  |
| Output format stability              | Golden                              | Hand-writing expected strings         |
| Concurrency safety                   | Integration + concurrent-runner    | Assuming thread safety after single-threaded tests |

**Execution Rules**:

1. Every `src/platform/<module>/` directory must have a corresponding `tests/unit/platform/<module>/` directory
2. Every externally exposed service class must have at least 1 unit test file
3. Functions involving DB / filesystem / subprocess must have integration tests
4. Security-related changes must have denial-path regression tests

### 7.3 Layer 2: Traceability Matrix

**Addresses**: Source files with no corresponding test files.

Build a **source file → test file** mapping to ensure every production file has a corresponding test.

**Generation Method**:

```bash
# Step 1: List all production source files (exclude index.ts, types)
find src/core -name "*.ts" ! -name "index.ts" ! -name "*.d.ts" ! -path "*/types/*" | sort > /tmp/src-files.txt

# Step 2: List all test files
find tests/unit tests/integration -name "*.test.ts" | sort > /tmp/test-files.txt

# Step 3: Compare, find source files with no test coverage
while read src; do
  base=$(basename "$src" .ts)
  if ! grep -q "$base" /tmp/test-files.txt; then
    echo "UNCOVERED: $src"
  fi
done < /tmp/src-files.txt
```

**Matrix Maintenance Rules**:

- Every `.ts` source file added/modified in a PR must have a corresponding `.test.ts` file
- If a file genuinely doesn't need testing (pure type definitions, barrel exports), mark it `N/A` + reason in the matrix
- Run the above script at the end of each sprint to update the gap list

### 7.4 Layer 3: Coverage Ratchet

**Addresses**: Existing tests being deleted or new code not being covered.

See [§6 Coverage Gate Mechanism](#6-coverage-gate-mechanism) for details. Key points:

- **Global gate**: lines/statements/functions/branches four dimensions
- **Directory-level gate**: Each `src/platform/<module>` has its own baseline
- **`all: true`**: Files not imported by any test are also counted (shown as 0% coverage), preventing "no one references it so no one tests it"
- **Only goes up**: Baseline values monotonically increase via `npm run coverage:baseline:update`

**Limitations of coverage**: Coverage only indicates "code was executed," not "behavior was verified." For example:

```typescript
test("calls the function", () => {
  myFunction(); // 100% line coverage, but 0 assertions
});
```

This is why Layer 4 is needed.

### 7.5 Layer 4: Mutation Testing

**Addresses**: Code executed but lacking effective assertions.

Stryker injects **mutants** into the code, such as:

- `>` changed to `>=`
- `true` changed to `false`
- Entire statement deleted
- String `"error"` changed to `""`

If tests still pass after mutation injection (mutant survived), it means the tests don't effectively detect this logic.

See [§11 Mutation Testing (Stryker)](#11-mutation-testing-stryker) for details. Thresholds:

- **break = 50%**: Below this CI directly fails
- **low = 60%**: Yellow warning
- **high = 80%**: Green target

**Complementary relationship between mutation testing and coverage**:

| Scenario              | Line Coverage | Mutation Score | Problem           |
| --------------------- | ------------- | -------------- | ----------------- |
| Executed with assertions | High          | High           | None              |
| Executed without assertions | High       | **Low**        | Missing assertions|
| Not executed          | **Low**        | Low            | Missing tests     |
| Dead code             | Low            | Low            | Should be removed  |

### 7.6 Layer 5: PR Review Checklist

**Addresses**: Logic gaps that automated tools cannot detect.

Before each PR is merged, reviewers check the following list:

- [ ] Does every new/modified public function have corresponding tests?
- [ ] Are both happy path AND error path covered?
- [ ] Are boundary conditions tested (empty array, null, 0, MAX_INT, timeout)?
- [ ] Do security changes have denial-path regression?
- [ ] Do async functions test reject/error paths?
- [ ] Do config changes have corresponding config validation tests?
- [ ] Has coverage improved or stayed the same (not decreased)?
- [ ] Has mutation score improved or stayed the same?

### 7.7 Gap Type Classification and Corresponding Protection

| Gap Type            | Description                              | Detection Layer                               |
| ------------------- | ---------------------------------------- | --------------------------------------------- |
| **File-level gap**  | Entire source file has no tests          | Layer 2 (Matrix) + Layer 3 (`all: true`)      |
| **Function-level gap** | A specific exported function has no test | Layer 3 (function coverage) + Layer 5 (Review) |
| **Branch-level gap** | An if/else/switch branch not covered    | Layer 3 (branch coverage) + Layer 4 (Stryker)   |
| **Assertion-level gap** | Code executed but result not verified  | Layer 4 (Stryker mutant survived)             |
| **Scenario-level gap** | Missing specific business scenario tests | Layer 5 (Review)                              |
| **Boundary condition gap** | Empty input/extreme values/concurrency not covered | Layer 4 + Layer 5            |
| **Regression gap**  | Bug fix without adding regression test   | Layer 5 (Review) + Layer 3 (ratchet no-regression) |
| **Security gap**    | Attack vectors not tested                | Layer 1 (denial-path standards) + Layer 5      |

### 7.8 Test Completion Priority Sorting Method

When gaps are found, prioritize completion in this order:

```
P0 — Security boundaries not tested (sandbox escape, path traversal, injection attack)
P1 — Core orchestrator/service has no tests (0% coverage)
P2 — Existing tests but branch coverage < 60%
P3 — Existing tests but mutation score < 50% (insufficient assertions)
P4 — Helper functions / utility classes missing boundary condition tests
P5 — Schema validation tests for type definitions
```

### 7.9 Continuous Assurance Process

```
Development Phase → Write code + Write tests (TDD or Code-then-Test)
          ↓
Local Verification → npm test (coverage + gate)
          ↓
PR Submission → CI automatically runs: lint → typecheck → test → coverage:gate
          ↓
PR Review → Manual Checklist (§7.6)
          ↓
Merge to Main → Stryker mutation testing (triggered by push to main)
          ↓
Sprint End → Run Traceability Matrix script, update gap list
```

---

## 8. Security Regression Testing Standards

### 8.1 Denial-Path Regression Methodology

Core principle of security testing: **One test per attack vector, asserting rejection status + specific error code**.

```
Attack surface identification → Build malicious input → Call interface under test → Assert blocked/denied + error code
```

### 8.2 Attack Surface Classification

| Attack Surface    | Test Target                    | Typical Attack Vectors                                    |
| ----------------- | ------------------------------ | --------------------------------------------------------- |
| **Path traversal** | Sandbox filesystem isolation   | `../`, symlink, double-encoded `%2f`, null-byte `\x00`    |
| **Command injection** | Command executor parameter filtering | `;`, `$()`, `` ` ``, `&&`, `\|\|`, `|`, `${VAR}`        |
| **Privilege bypass** | Execution-level tool authorization | Modify allowedToolsJson, malformed allowlist            |
| **Script escape** | Interpreter path restrictions  | Script path outside workspace, absolute path pointing external |
| **Input validation** | Schema / config validation    | Oversized strings, type mismatch, missing required fields |
| **Concurrent attack** | Locks and transaction isolation | Approve same request simultaneously, concurrent writes to same resource |

### 8.3 Security Test Structure Template

```typescript
test("<component> blocks <attack type> <specific description>", async () => {
  const workspace = createTempWorkspace("aa-security-");
  try {
    // 1. Build attack input
    const maliciousInput = buildAttackPayload();

    // 2. Execute the interface under test
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

### 8.4 Security Test Naming Convention

Title must clearly state **who rejected what**:

```
✓ "command executor blocks symlink cwd traversal before spawning the process"
✓ "command executor blocks null-byte injection in path argument"
✓ "sandbox policy denies write outside workspace root"
✗ "security test 1"
✗ "test injection"
```

### 8.5 Scenarios Security Tests Must Cover

For each component involving security boundaries, cover at least the following:

1. **Normal legitimate request** — Confirm happy path works correctly (at least 1 positive test)
2. **Path escape** — Cover at least three vectors: `../`, symlink, absolute path
3. **Input injection** — Cover at least two vectors: shell metachar, null-byte
4. **Insufficient permissions** — Unauthorized tool, incorrect domain/role
5. **Malformed input** — Malformed JSON, type mismatch, null values
6. **Fail-close** — When security check logic itself errors, default to deny rather than allow

---

## 9. Golden / Snapshot Testing

### 9.1 Applicable Scenarios

Golden testing is suitable for scenarios where **output format needs to remain stable**:

- CLI output format (output from `inspect`, `doctor`, `dispatch-execution` commands)
- API response body structure
- Configuration file generation results
- Log format

### 9.2 How It Works

```
First run (UPDATE_GOLDEN=1) → Write actual output to tests/golden/snapshots/<name>.golden
Subsequent runs → Compare actual output with .golden file
  Match → Test passes
  No match → Test fails, prompt to run UPDATE_GOLDEN=1 to update
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

| API                                  | Purpose          |
| ------------------------------------ | ---------------- |
| `assertGolden(name, actual)`         | JSON exact match |
| `assertGoldenContains(name, substring)` | Contains substring |
| `assertGoldenMatches(name, regex)`   | Regex match      |

### 9.4 Updating Snapshots

```bash
UPDATE_GOLDEN=1 npm run test:golden
git diff tests/golden/snapshots/       # Review changes
git add tests/golden/snapshots/
```

### 9.5 Golden Test Notes

- **Do NOT** include timestamps, random IDs, or other unstable fields in golden files — normalize them first before snapshotting
- Snapshot files must be under git version control
- Golden file naming uses version suffixes (`-v1`, `-v2`), creating new versions when output format intentionally changes

---

## 10. Performance Benchmark Testing

### 10.1 Applicable Scenarios

- Critical path latency regression detection
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

  assert.ok(
    opsPerSec > 1000,
    `Expected > 1000 ops/sec, got ${opsPerSec.toFixed(0)}`,
  );
});
```

### 10.4 Performance Test Principles

- **Isolated execution**: `npm run test:performance` runs independently from the main test suite to avoid interfering with coverage
- **Absolute thresholds**: Assert absolute performance metrics (e.g., >1000 ops/sec), not relative changes
- **Warmup**: Execute a few warmup iterations before timing to exclude JIT compilation effects
- **Median of multiple runs**: For latency-sensitive tests, take the median of multiple runs to reduce variance
- **Optional in CI**: Performance tests run as an optional job in CI and do not block merges (due to high machine variance)

---

## 11. Mutation Testing (Stryker)

### 11.1 Concept

Mutation testing answers the question coverage cannot answer: **Are the test assertions truly effective?**

Stryker injects tiny mutations (mutants) into source code, then runs the test suite. If tests still pass after mutation (mutant survived), it means no assertion can detect this code change — i.e., there is an assertion gap.

### 11.2 Configuration (`stryker.config.mjs`)

| Parameter             | Value                              | Description                          |
| --------------------- | ---------------------------------- | ------------------------------------ |
| `testRunner`          | `"command"`                        | Runs via `npm run test:unit`         |
| `mutate`              | `src/platform/**/*.ts`              | Mutation scope: platform business code |
| Exclusions            | `.d.ts`, `index.ts`, `types/**`    | Type definitions and barrels not mutated |
| `thresholds.break`    | 50                                 | Below 50% → CI fails                 |
| `thresholds.low`      | 60                                 | Below 60% → Yellow warning           |
| `thresholds.high`    | 80                                 | Above 80% → Green                    |
| `coverageAnalysis`    | `"perTest"`                        | Each test analyzed for coverage separately |

### 11.3 Running

```bash
npm run test:mutation         # Local run
# In CI, only runs on push to main (time-consuming)
```

Report output to `reports/mutation/`, including HTML visualization report.

### 11.4 Reading Reports

| Status            | Meaning                                | Action                  |
| ----------------- | -------------------------------------- | ----------------------- |
| **Killed**        | Test detected mutation and failed      | No action needed        |
| **Survived**      | Test still passed after mutation       | **Need stronger assertions** |
| **No coverage**   | Mutated code not executed by any test | Need to add tests       |
| **Timeout**       | Mutation caused infinite loop/timeout  | Treated as killed       |
| **Runtime error** | Mutation caused runtime crash          | Treated as killed       |

### 11.5 Handling Survived Mutants

```typescript
// Assume Stryker reports: mutant survived after mutating `>` to `>=`
// Original code: if (retries > maxRetries) throw new Error("exceeded");

// This indicates missing boundary test. Need to add:
test("throws when retries equals maxRetries", () => {
  // Test behavior when retries === maxRetries
  // If it should throw, add assert.throws
  // If it should not throw, add assert.doesNotThrow
});
```

### 11.6 Mutation Testing Collaboration with Other Layers

- **Coverage** tells you "which code was not executed" → Add tests
- **Stryker** tells you "which code was executed but has insufficient assertions" → Strengthen assertions
- The two are complementary and cannot replace each other

---

## 12. CI Integration and Workflow

### 12.1 CI Pipeline Architecture

```yaml
CI (GitHub Actions — .github/workflows/ci.yml)
├── validate (matrix: Node 20 + 22)
│   ├── npm ci
│   ├── npm run lint
│   ├── npm audit --audit-level=high
│   ├── npm run typecheck
│   ├── npm run changelog:check
│   ├── npm run test:raw
│   ├── npm run coverage:gate          # Node 22 only
│   └── AA_VALIDATION_ITERATIONS=2 npm run validate:stable
├── pg-integration
│   └── test:pg-integration (Postgres 16 service container, port 5433)
├── mutation-test (main branch only)
│   └── npm run stryker → reports/mutation/
├── security
│   └── CodeQL analysis (typescript)
└── trivy-scan
    └── Docker image vulnerability scan (CRITICAL,HIGH → exit-code 1)
```

Other workflow files:

- `deploy-environment.yml` — Environment deployment
- `dr-validation.yml` — Disaster recovery validation
- `publish-image.yml` — Image publishing
- `secret-provider-integration.yml` — Secret provider integration testing

### 12.2 Trigger Conditions

| Job             | Push to main | PR  | Other             |
| --------------- | ------------ | --- | ----------------- |
| validate        | ✓            | ✓   | `codex/**` branch |
| pg-integration  | ✓            | ✓   | —                 |
| mutation-test   | ✓            | ✗   | Main only         |
| security        | ✓            | ✓   | —                 |
| trivy-scan      | ✓            | ✓   | —                 |

### 12.3 Test Assurance Points in CI

| Assurance Point | Tool                          | Failure Condition          |
| --------------- | ----------------------------- | -------------------------- |
| Code style      | ESLint                        | Any lint error             |
| Type safety     | tsc --noEmit                  | Any type error            |
| Dependency security | npm audit                 | HIGH/CRITICAL vulnerabilities |
| Functional correctness | node --test               | Any test failure          |
| Coverage no regression | check-coverage-baseline.mjs | Below baseline        |
| Mutation score  | Stryker                       | Below break=50%            |
| Static analysis | CodeQL                        | Security defects found     |
| Container security | Trivy                      | CRITICAL/HIGH vulnerabilities |

### 12.4 Test Result Archival

CI automatically uploads the following artifacts:

- `test-results/` — Test execution logs
- `coverage/` — HTML coverage report
- `reports/mutation/` — Stryker HTML report

---

## 13. New Module Testing Checklist

When creating a new module, follow this checklist to ensure testing completeness:

### 13.1 Directories and Files

- [ ] Create `tests/unit/platform/<module>/` or `tests/unit/<area>/<module>/` directory
- [ ] Create corresponding `<service-name>.test.ts` for each service class
- [ ] If DB is needed → create `tests/integration/platform/<module>/` directory

### 13.2 Test Layers

- [ ] **Unit tests**: For every exported function / class method
  - [ ] Happy path (normal input → expected output)
  - [ ] Error path (invalid input → expected exception/error code)
  - [ ] Boundary conditions (null, zero, max value, empty array)
- [ ] **Schema tests** (if using Zod):
  - [ ] Valid minimal payload → `doesNotThrow`
  - [ ] Invalid payload → `throws`
  - [ ] Missing optional fields → `doesNotThrow`
- [ ] **Integration tests** (if involving DB/file/subprocess):
  - [ ] Use `createIntegrationContext()` or `createRepositoryHarness()`
  - [ ] `try/finally` ensures cleanup
- [ ] **Security tests** (if involving security boundaries):
  - [ ] Denial-path regression covers various attack vectors
  - [ ] Fail-close test

### 13.3 Coverage

- [ ] Run `npm test` locally to confirm coverage is not below global baseline
- [ ] Run `npm run coverage:baseline:update` to update baseline
- [ ] Confirm new directory appears in `.coverage-baseline.json`

### 13.4 Mutation Testing

- [ ] Confirm new module path is within the `mutate` glob in `stryker.config.mjs`
- [ ] Run `npm run test:mutation` locally to confirm no large number of survived mutants

### 13.5 CI Compatibility

- [ ] Tests pass on both Node 20 and Node 22
- [ ] Tests support `--test-concurrency=12` parallel execution without shared state conflicts
- [ ] No hardcoded absolute paths, port numbers, or timestamps

### 13.6 Documentation

- [ ] Update source file ↔ test file mapping in Traceability Matrix (§7.3)
- [ ] If introducing new Helpers / Fixtures, update §5 tool inventory

---

---

---

# Part II — Architectural Semantics Coverage (added in v1.1, supplemented in v1.2, expanded in v3.0)

> Part I addresses "code coverage governance" — ensuring every line of code is executed and every assertion is effective.
> Part II addresses "architectural semantics coverage" — ensuring key system design semantics (state machines, events, concurrency, stage contracts) are all covered by tests.

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

| State Machine | Definition File                                      | Verification File                                                     | State Count | Terminal States                               |
| ------------- | ---------------------------------------------------- | --------------------------------------------------------------------- | ----------- | --------------------------------------------- |
| **Task**      | `src/platform/five-plane-execution/state-transition/types.ts`   | `src/platform/five-plane-execution/state-transition/transition-service.ts`       | 7           | done, failed, cancelled                        |
| **Workflow**  | Same as above                                        | Same as above                                                         | 7           | completed, failed, cancelled                  |
| **Session**   | Same as above                                        | Same as above                                                         | 7           | completed, failed, cancelled                  |
| **Execution** | Same as above                                        | Same as above                                                         | 8           | succeeded, failed, cancelled, superseded      |
| **Approval**  | Same as above                                        | Same as above                                                         | 5           | approved, rejected, expired, cancelled        |

These 5 state machines are implemented via the `StateTransitionMachine<T>` generic class, with the `assertTransition()` method using CAS to prevent concurrent overwrites.

### 14.3 Three-Layer Requirements for State Machine Testing

#### A. Full Coverage of Legal Transitions (Transition Coverage)

Every **legal transition edge** for each state machine must have at least one test:

```typescript
test("task transition: queued -> in_progress is allowed", () => {
  assert.doesNotThrow(() =>
    taskStateMachine.assertTransition("queued", "in_progress"),
  );
});
```

**Quantitative standard**: Legal edge coverage = tested legal edges / total legal edges = **100%**

Task state machine legal edge list (example):

```
queued → pending, in_progress, cancelled
pending → in_progress, cancelled
in_progress → awaiting_decision, done, failed, cancelled
awaiting_decision → in_progress, failed, cancelled
```

#### B. Full Rejection of Illegal Transitions (Denial Coverage)

Transitions from **every terminal state** to any non-self state must be tested for rejection:

```typescript
test("task transition: done -> in_progress is rejected", () => {
  assert.throws(
    () => taskStateMachine.assertTransition("done", "in_progress"),
    { message: /invalid_transition/ },
  );
});

test("task transition: done -> done is idempotent (allowed)", () => {
  assert.doesNotThrow(() => taskStateMachine.assertTransition("done", "done"));
});
```

**Quantitative standard**: All terminal states × all non-self states = must test rejection

#### C. Cross-Entity Cascade Transitions (Cascade Coverage)

`TransitionService` provides `applyTaskTerminalState` and `ApprovalBlockingTransitionService`, which atomically cascade transitions across multiple entities.

Cascade scenarios that must be tested:

| Trigger            | Task        | Workflow   | Session      | Execution | Approval  |
| ----------------- | ----------- | ---------- | ------------- | --------- | --------- |
| task → done        | done        | completed  | completed    | succeeded | —         |
| task → failed      | failed      | failed     | failed       | failed    | —         |
| task → cancelled  | cancelled   | cancelled  | cancelled    | cancelled | —         |
| approval needed   | awaiting_decision | paused   | awaiting_user | blocked  | requested |
| approval granted  | in_progress | running    | streaming    | executing | approved  |

### 14.4 Auxiliary State Machine Testing Requirements

For non-core state machines (Circuit Breaker, Rollout, Repair Pipeline, Plugin, etc.), requirements are:

| Category                           | Requirement                                     |
| ---------------------------------- | ----------------------------------------------- |
| Has `assertTransition()` validation | Same three-layer requirements as core          |
| Has `transitionTo()` without validation | At least happy path + terminal states covered |
| Only used as enum values           | Each enum value appears in at least one test    |

### 14.5 Circuit Breaker State Machine Special Requirements

Circuit Breaker (`closed → open → half_open → closed`) involves time and counting, requiring additional tests:

- [ ] Consecutive failures ≥ threshold → triggers open
- [ ] Failure rate ≥ 50% → triggers open
- [ ] Requests rejected in open state + return `retryAfterMs`
- [ ] After resetTimeoutMs → transitions to half_open
- [ ] half_open single probe success/failure behavior
- [ ] Consecutive successes ≥ halfOpenSuccessThreshold → recovery to closed

### 14.6 Transition Table Single Source Rule

**Hard requirement**: The canonical transition map in `transition-service.ts` is the **only authoritative source** for state transitions. Test cases **must not** manually hard-code a copy of the transition table.

#### A. Principles

| Item      | Rule                                                                                   |
| --------- | -------------------------------------------------------------------------------------- |
| Single source | All legal/illegal transition judgments must come from `TransitionService` production map |
| No copies  | Test must not have hand-written copies like `const allowedTransitions = { pending: ["running", ...] }` |
| Data-driven | Test matrix must be **auto-generated** from production map, not manually enumerated    |
| Sync guarantee | If production map adds/removes transitions, tests automatically sense change, no manual sync needed |

#### B. Data-Driven Test Generation Template

```typescript
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  TRANSITION_MAP,
  ALL_STATES,
} from "../../src/platform/five-plane-execution/state-transition/types.js";

// Auto-generate legal transition pairs from production map
const validPairs: Array<[string, string]> = [];
for (const [from, toSet] of Object.entries(TRANSITION_MAP)) {
  for (const to of toSet) {
    validPairs.push([from, to]);
  }
}

// Auto-generate illegal transition pairs (all pairs - valid pairs - self-transitions)
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
      `${from} → ${to} should be valid`,
    );
  }
});

test("all invalid transitions are rejected", () => {
  for (const [from, to] of invalidPairs) {
    assert.throws(
      () => transitionService.assertTransition(from, to),
      `${from} → ${to} should be rejected`,
    );
  }
});
```

#### C. CI Guard

- Coverage gate adds check: If hardcoded object literals with same key names as `TRANSITION_MAP` appear in test files, CI reports warning
- PR Review checklist adds one item: "Are state machine tests auto-derived from production map?"

---

## 15. Event-Driven Testing Standards

### 15.1 Event System Architecture

```
Producer → TypedEventBus → DurableEventBus → SQLite
                                              ↓
                            EventOpsService → deliverPending() → Consumer
                                              ↓ (after 3 retries)
                                         Dead Letter Table
```

This system defines **48 typed events**, divided into 3 Tiers:

| Tier       | Semantic                  | Ack Required | Event Count | Example                                    |
| ---------- | ------------------------- | ------------ | ----------- | ------------------------------------------ |
| **Tier 1** | Must persist + must ack   | Required     | 9           | `task:status_changed`, `decision:requested` |
| **Tier 2** | Persist, ack optional     | Recommended  | ~35         | `dispatch:*`, `worker:*`, `plugin:*`, `skill:*` |
| **Tier 3** | Best-effort delivery      | None         | ~4          | `stream:chunk_emitted`, `perf:*`            |

### 15.2 Tier-Based Testing Requirements

#### Tier 1 Events (9 types) — Highest Testing Requirements

Each Tier 1 event must cover complete lifecycle:

| Phase            | Test Content                                               |
| ---------------- | ---------------------------------------------------------- |
| **Schema**        | payload satisfies Zod validator (valid + invalid)          |
| **Publish**       | Correctly writes to events table + creates ack record      |
| **Deliver**       | `deliverPending()` delivers event to registered consumer   |
| **Ack**           | Consumer processes successfully → ack status = `"acked"`    |
| **Retry**         | Consumer processing fails → exponential backoff retry (100ms → 5s) |
| **Dead Letter**   | 3 retries fail → writes to dead_letter table               |
| **Replay**        | `EventOpsService.replayConsumer()` redelivers               |
| **Integrity**     | SHA-256 hash chain not tampered                            |

#### Tier 2 Events — Medium Testing Requirements

| Phase            | Test Content                                           |
| ---------------- | ------------------------------------------------------ |
| **Schema**        | payload satisfies Zod validator                        |
| **Publish**       | Correctly writes to events table                      |
| **Deliver**       | At least one consumer can receive                     |
| **Idempotency**  | Events with `idempotencyKey` are not consumed twice  |

#### Tier 3 Events — Basic Testing Requirements

| Phase            | Test Content                                          |
| ---------------- | ----------------------------------------------------- |
| **Publish**       | Does not throw exception                              |
| **Best-effort**   | Event does not block when consumer is offline        |

### 15.3 DLQ Testing Requirements

System has **3 independent DLQs**:

| DLQ          | Location                              | Test Focus                                                      |
| ------------ | ------------------------------------- | -------------------------------------------------------------- |
| Event DLQ    | `event_dead_letters` table            | After 3 retries correctly enters DLQ + `dlq-manager list` queryable |
| Gateway DLQ  | `gateway_dead_letters` table          | Non-retryable status codes directly enter DLQ, retryable status codes enter DLQ after retry |
| Jobs DLQ     | `queue_jobs.status = "dead_letter"`   | Enters DLQ after exceeding `maxAttempts`                      |

Each DLQ must test:

- [ ] Messages correctly enter DLQ under correct conditions
- [ ] DLQ messages are queryable (list / count)
- [ ] DLQ messages can be cleared (purge)
- [ ] Retryable DLQ messages can be requeued

### 15.4 Event Schema Drift Regression

`RAW_EVENT_SCHEMA_REGISTRY` in `event-registry.ts` defines schemas for all events:

```typescript
test("all TypedEventPayloadMap keys are registered in EVENT_SCHEMA_REGISTRY", () => {
  // Compile-time MissingTypedEventDefinitions type checking already in place
  // Runtime supplementary verification
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

| Forbidden Behavior      | Verification Method                                               |
| ----------------------- | ------------------------------------------------------------------ |
| Duplicate DB writes     | After delivering same event 2 times, related table row count unchanged |
| Duplicate notifications/external messages | Mock notification channel, assert call count = 1          |
| Duplicate downstream side effects | Mock downstream service, assert idempotency key deduplicated    |
| Duplicate state machine transitions | Second delivery does not trigger `assertTransition()` (state already at terminal or target state) |

#### Idempotency Test Template

```typescript
test("consumer handles duplicate delivery idempotently", async () => {
  const event = buildEvent("task.completed", { taskId: "t-1" });
  const db = await createTestDb();
  const notifier = { send: mock.fn() };

  // First consumption
# Full Coverage Testing Manual

> **Document Version**: v4.0
> **Applicable Project**: automatic-agent-platform
> **Test Framework**: Node.js built-in test runner (`node:test`) + `node:assert/strict`
> **Coverage Tool**: c8 v11.0.0 (V8 native coverage) + Istanbul reporter
> **Mutation Testing**: Stryker Mutator v9.6.1
> **Node.js Requirement**: v22+ (`--test` + `--test-concurrency` flags)
> **Last Updated**: 2026-04-23 (based on architecture review v8.0 + full codebase measured testing)

---

## Table of Contents

**Part I — Testing Governance Foundations**

1. [Testing Infrastructure Overview](#1-测试基础设施总览)
2. [Command Reference](#2-命令速查表)
3. [Directory Structure and Layering Rules](#3-目录结构与分层规范)
4. [Test Writing Standards and Patterns](#4-测试编写规范与模式)
5. [Mock and Helper Toolbox](#5-mock-与-helper-工具箱)
6. [Coverage Gate Mechanism](#6-覆盖率门禁机制)
7. [Test Coverage Assurance System](#7-测试无遗漏保障体系)
8. [Security Regression Testing Standards](#8-安全回归测试规范)
9. [Golden / Snapshot Testing](#9-golden--snapshot-测试)
10. [Performance Benchmark Testing](#10-性能基准测试)
11. [Mutation Testing (Stryker)](#11-变异测试stryker)
12. [CI Integration and Workflow](#12-ci-集成与工作流)
13. [New Module Testing Checklist](#13-新模块测试-checklist)

**Part II — Architectural Semantic Coverage (v1.1 new, v1.2 supplement, v3.0 extended)**

14. [State Machine Testing Specification](#14-状态机测试规范)
15. [Event-Driven Testing Specification](#15-事件驱动测试规范)
16. [OAPEFLIR Stage Coverage Matrix](#16-oapeflir-阶段覆盖矩阵)
17. [Concurrency and Timing Testing Specification](#17-并发与时序测试规范)
18. [Design Specification to Test Traceability Specification](#18-设计规格到测试追溯规范)
19. [Real Execution vs Mock Execution Boundary Specification](#19-真实执行-vs-mock-执行边界规范)
20. [Test Debt Classification](#20-测试债务分级)
21. [Failure Sample Replay Rules](#21-失败样例回灌规则)
22. [Test Data Governance](#22-测试数据治理)
23. [Coverage Quality Redlines](#23-覆盖率质量红线)

**Part III — Architecture Gap Regression Test Matrix (v4.0 rewrite, aligned with architecture review v8.0)**

24. [Architecture Review-Driven Regression Testing](#24-架构审查驱动的回归测试)
25. [P0 Architecture Violation Gap Testing Specification](#25-p0-架构违规缺口测试规范)
26. [P1 High-Priority Gap Testing Specification](#26-p1-高优先级缺口测试规范)
27. [P2 Detail Completion Gap Testing Specification](#27-p2-细节补全缺口测试规范)

**Part IV — Systems Engineering Defect Regression Testing (v2.0 original Part III preserved, v4.0 updated)**

29. [P0 Blocker Engineering Defect Testing Specification](#29-p0-阻断级工程缺陷测试规范)
30. [P1 Severe Engineering Defect Testing Specification](#30-p1-严重工程缺陷测试规范)
31. [P2 Important Engineering Defect Testing Specification](#31-p2-重要工程缺陷测试规范)
32. [Architecture Invariant Automated Guard Testing](#32-架构不变量自动守护测试)
33. [Stub File Coverage Gap Tracking](#33-桩文件覆盖缺口追踪)
34. [Test Gap and Coverage Status Summary](#34-测试缺口与覆盖现状汇总)

---

## 14. State Machine Testing Specification

### 14.1 Why a Separate Specification is Needed

This system contains **5 core state machines** (Task / Workflow / Session / Execution / Approval) and **40+ auxiliary lifecycle enums** (Worker, Plugin, Rollout, Circuit Breaker, Lease, Repair Pipeline, etc.).

Regular line/branch coverage cannot guarantee:

- Every legal state transition is tested
- Every illegal state transition is rejected
- Terminal states cannot transition further
- Atomicity of cross-entity cascade transitions

### 14.2 Core State Machine Inventory

| State Machine | Definition File                                           | Validation File                                                        | States | Terminal States                             |
| ------------- | -------------------------------------------------------- | --------------------------------------------------------------------- | ------ | ------------------------------------------ |
| **Task**      | `src/platform/five-plane-execution/state-transition/types.ts` | `src/platform/five-plane-execution/state-transition/transition-service.ts` | 7      | done, failed, cancelled                     |
| **Workflow**  | same                                                      | same                                                                  | 7      | completed, failed, cancelled                |
| **Session**   | same                                                      | same                                                                  | 7      | completed, failed, cancelled               |
| **Execution** | same                                                      | same                                                                  | 8      | succeeded, failed, cancelled, superseded  |
| **Approval**  | same                                                      | same                                                                  | 5      | approved, rejected, expired, cancelled     |

These 5 state machines are implemented through the `StateTransitionMachine<T>` generic class, with the `assertTransition()` method using CAS to prevent concurrent overwrites.

### 14.3 State Machine Testing Three-Layer Requirements

#### A. Full Coverage of Legal Transitions (Transition Coverage)

Every **legal transition edge** for each state machine must have at least one test:

```typescript
test("task transition: queued -> in_progress is allowed", () => {
  assert.doesNotThrow(() =>
    taskStateMachine.assertTransition("queued", "in_progress"),
  );
});
```

**Quantification standard**: Legal edge coverage = tested legal edges / total legal edges = **100%**

Task state machine legal edge list (example):

```
queued → pending, in_progress, cancelled
pending → in_progress, cancelled
in_progress → awaiting_decision, done, failed, cancelled
awaiting_decision → in_progress, failed, cancelled
```

#### B. Full Rejection of Illegal Transitions (Denial Coverage)

Transitions from **each terminal state** to any non-self state must be tested for rejection:

```typescript
test("task transition: done -> in_progress is rejected", () => {
  assert.throws(
    () => taskStateMachine.assertTransition("done", "in_progress"),
    { message: /invalid_transition/ },
  );
});

test("task transition: done -> done is idempotent (allowed)", () => {
  assert.doesNotThrow(() => taskStateMachine.assertTransition("done", "done"));
});
```

**Quantification standard**: All terminal states × all non-self states = must test rejection

#### C. Cross-Entity Cascade Transitions (Cascade Coverage)

`TransitionService` provides `applyTaskTerminalState` and `ApprovalBlockingTransitionService`, which atomically cascade transitions across multiple entities.

Cascade scenarios that must be tested:

| Trigger            | Task          | Workflow  | Session     | Execution | Approval  |
| ------------------ | ------------- | --------- | ----------- | --------- | --------- |
| task → done        | done          | completed | completed   | succeeded | —         |
| task → failed      | failed        | failed    | failed      | failed    | —         |
| task → cancelled   | cancelled     | cancelled | cancelled   | cancelled | —         |
| approval needed    | awaiting_decision | paused    | awaiting_user | blocked   | requested |
| approval granted   | in_progress   | running   | streaming   | executing | approved  |

### 14.4 Auxiliary State Machine Testing Requirements

For non-core state machines (Circuit Breaker, Rollout, Repair Pipeline, Plugin, etc.), requirements are:

| Category                        | Requirement                              |
| ------------------------------ | ---------------------------------------- |
| Has `assertTransition()` validation | Same as core three-layer requirements |
| Has `transitionTo()` without validation | At least cover happy path + terminal states |
| Enum values only               | Each enum value appears in at least one test |

### 14.5 Circuit Breaker State Machine Special Requirements

Circuit Breaker (`closed → open → half_open → closed`) involves time and counting, requiring additional tests:

- [ ] Consecutive failures ≥ threshold → triggers open
- [ ] Failure rate ≥ 50% → triggers open
- [ ] Requests in open state are rejected + return `retryAfterMs`
- [ ] After resetTimeoutMs → transitions to half_open
- [ ] half_open single probe success / failure behavior
- [ ] Consecutive successes ≥ halfOpenSuccessThreshold → restores closed

### 14.6 Transition Table Single Source Rule

**Hard requirement**: The canonical transition map in `transition-service.ts` is the **sole authoritative source** for state transitions. Test cases **prohibit** manually hardcoding a copy of the transition table.

#### A. Principles

| Item       | Rule                                                                                   |
| ---------- | -------------------------------------------------------------------------------------- |
| Single source | All legal/illegal transition judgments must come from `TransitionService`'s production map |
| No copies   | Test must not contain hand-written copies like `const allowedTransitions = { pending: ["running", ...] }` |
| Data-driven | Test matrix must be **automatically generated** from production map, not manually enumerated |
| Sync guarantee | If production map adds/deletes transitions, tests automatically detect, no manual sync needed |

#### B. Data-Driven Test Generation Template

```typescript
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  TRANSITION_MAP,
  ALL_STATES,
} from "../../src/platform/five-plane-execution/state-transition/types.js";

// Auto-generate legal transition pairs from production map
const validPairs: Array<[string, string]> = [];
for (const [from, toSet] of Object.entries(TRANSITION_MAP)) {
  for (const to of toSet) {
    validPairs.push([from, to]);
  }
}

// Auto-generate illegal transition pairs (all permutations - valid pairs - self-transitions)
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
      `${from} → ${to} should be valid`,
    );
  }
});

test("all invalid transitions are rejected", () => {
  for (const [from, to] of invalidPairs) {
    assert.throws(
      () => transitionService.assertTransition(from, to),
      `${from} → ${to} should be rejected`,
    );
  }
});
```

#### C. CI Guard

- Coverage gate adds check: if test file contains hardcoded object literals with the same key names as `TRANSITION_MAP`, CI reports warning
- PR Review checklist adds item: "Do state machine tests derive from production map automatically?"

---

## 15. Event-Driven Testing Specification

### 15.1 Event System Architecture

```
Producer → TypedEventBus → DurableEventBus → SQLite
                                              ↓
                            EventOpsService → deliverPending() → Consumer
                                              ↓ (after 3 retries)
                                         Dead Letter Table
```

This system defines **48 typed events**, divided into 3 Tiers:

| Tier       | Semantics                | Ack Required | Count | Example                                        |
| ---------- | ------------------------ | ------------ | ----- | ---------------------------------------------- |
| **Tier 1** | Must persist + must ack  | Required     | 9     | `task:status_changed`, `decision:requested`     |
| **Tier 2** | Persist, ack optional    | Recommended  | ~35   | `dispatch:*`, `worker:*`, `plugin:*`, `skill:*` |
| **Tier 3** | Best-effort              | None         | ~4    | `stream:chunk_emitted`, `perf:*`               |

### 15.2 Tier-Based Testing Requirements

#### Tier 1 Events (9 types) — Highest Testing Requirements

Each Tier 1 event must cover complete lifecycle:

| Phase             | Test Content                                          |
| ----------------- | ----------------------------------------------------- |
| **Schema**        | payload satisfies Zod validator (valid + invalid)      |
| **Publish**       | Correctly writes to events table + creates ack record |
| **Deliver**       | `deliverPending()` delivers event to registered consumer |
| **Ack**           | Consumer processes successfully → ack status = `"acked"` |
| **Retry**         | Consumer processing fails → exponential backoff retry (100ms → 5s) |
| **Dead Letter**   | 3 retries fail → writes to dead_letter table         |
| **Replay**        | `EventOpsService.replayConsumer()` redelivers         |
| **Integrity**     | SHA-256 hash chain not tampered                       |

#### Tier 2 Events — Medium Testing Requirements

| Phase             | Test Content                              |
| ----------------- | ----------------------------------------- |
| **Schema**        | payload satisfies Zod validator           |
| **Publish**       | Correctly writes to events table         |
| **Deliver**       | At least one consumer can receive        |
| **Idempotency**  | Events with `idempotencyKey` are not consumed multiple times |

#### Tier 3 Events — Basic Testing Requirements

| Phase             | Test Content                              |
| ----------------- | ----------------------------------------- |
| **Publish**       | Does not throw exception                 |
| **Best-effort**   | Event does not block when consumer is offline |

### 15.3 DLQ Testing Requirements

System has **3 independent DLQs**:

| DLQ         | Location                              | Test Focus                                                    |
| ----------- | ------------------------------------- | ------------------------------------------------------------- |
| Event DLQ   | `event_dead_letters` table            | After 3 retries correctly enters DLQ + `dlq-manager list` queryable |
| Gateway DLQ | `gateway_dead_letters` table          | Non-retryable status codes go directly to DLQ, retryable codes retry then DLQ |
| Jobs DLQ    | `queue_jobs.status = "dead_letter"`   | Exceeds `maxAttempts` then enters DLQ                        |

Each DLQ must test:

- [ ] Messages correctly enter DLQ under right conditions
- [ ] DLQ messages are queryable (list / count)
- [ ] DLQ messages can be cleared (purge)
- [ ] Retryable DLQ messages can re-enter queue

### 15.4 Event Schema Drift Regression

`RAW_EVENT_SCHEMA_REGISTRY` in `event-registry.ts` defines schemas for all events:

```typescript
test("all TypedEventPayloadMap keys are registered in EVENT_SCHEMA_REGISTRY", () => {
  // Compile-time MissingTypedEventDefinitions type check already exists
  // Runtime supplementary verification
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

| Prohibited Behavior         | Verification Method                                              |
| --------------------------- | ---------------------------------------------------------------- |
| Duplicate DB writes         | After delivering same event 2 times, related table row count unchanged |
| Duplicate notifications / outbound messages | Mock notification channel, assert call count = 1 |
| Duplicate downstream side effects | Mock downstream service, assert idempotency key deduplicated |
| State machine duplicate transitions | Second delivery does not trigger `assertTransition()` (state already at terminal or target state) |

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

  // Assert no side effect duplication
  assert.equal(
    rowsAfterSecond,
    rowsAfterFirst,
    "duplicate delivery must not create extra rows",
  );
  assert.equal(
    notifier.send.mock.calls.length,
    1,
    "duplicate delivery must not re-send notification",
  );
});
```

#### Scope

- All consumers registered in `REQUIRED_CONSUMERS_BY_EVENT_TYPE`
- All handlers implementing `onEvent()` / `handleEvent()` interfaces
- Gateway DLQ replay consumer

---

## 16. OAPEFLIR Stage Coverage Matrix

### 16.1 Coverage Matrix Definition

Not by directory or file, but defining the minimum test set by **OAPEFLIR 8-stage design semantics**.

Each stage must cover **7 standard paths**:

| Path Number | Path Name                    | Description                                                    |
| ---------- | ---------------------------- | -------------------------------------------------------------- |
| P1         | **Happy Path**               | Standard input → stage complete → correct output              |
| P2         | **Degraded Path**            | Partial input missing/insufficient → degraded handling → output with warnings |
| P3         | **Invalid Input Path**       | Illegal/malformed input → rejection or fail-fast               |
| P4         | **Timeout Path**             | Stage execution timeout → correct abort + resource cleanup    |
| P5         | **Skip Path**                | Stage skipped (condition not met) → stage status = `"skipped"` |
| P6         | **Downstream Contract Violation** | Upstream output does not satisfy current stage input contract → rejection or fallback |
| P7         | **Human Intervention Path**  | Stage requires human intervention → paused waiting approval/confirmation → resume or terminate |

### 16.2 Stage-by-Stage Coverage Matrix

#### Observe

| Path | Test Scenario                          | Assertion Focus                                               |
| ---- | -------------------------------------- | ------------------------------------------------------------- |
| P1   | Standard task input → Generate TaskSituation | `objective`, `currentPhase`, `codebaseSnapshot` fields complete |
| P2   | Empty codebase / no fileRefs           | TaskSituation still generates, `fileRefs: []`                 |
| P3   | Illegal taskId / empty objective       | Schema rejection                                              |
| P4   | Collection timeout                     | Timeout abort + return existing snapshot                     |
| P5   | Input already cached / no changes      | Skip re-collection                                            |
| P6   | —                                      | As first stage, no upstream                                   |
| P7   | Task requires human scope confirmation | Pause collection → wait for human confirmation → resume after |

#### Assess

| Path | Test Scenario                            | Assertion Focus                                                    |
| ---- | ----------------------------------------- | ------------------------------------------------------------------ |
| P1   | Standard TaskSituation → UnifiedAssessment | complexity / risk / routingDecision / resourceAllocation reasonable |
| P2   | High-uncertainty task                    | Correctly upgrade executionMode to `"supervised"`                  |
| P3   | Malformed situationRef                   | Schema rejection                                                   |
| P4   | Assessment timeout                       | Degrade to default assessment                                      |
| P5   | Simple task skips deep assessment         | Use fast assessment path directly                                 |
| P6   | TaskSituation missing required fields     | Reject + fallback to Observe                                      |
| P7   | High uncertainty → requires human supervision | executionMode upgraded to `"supervised"`, wait for approval then continue |

#### Plan

| Path | Test Scenario                         | Assertion Focus                                              |
| ---- | ------------------------------------- | ----------------------------------------------------------- |
| P1   | Standard assessment → Plan with steps | stepId unique, dependencies legal, strategy correct         |
| P2   | High-complexity task                 | Multi-step DAG + parallel steps                             |
| P3   | version = 0 / steps empty            | Schema rejection                                            |
| P4   | Planning timeout                      | Return minimum viable plan                                  |
| P5   | Assessment indicates no planning needed | stage skipped                                              |
| P6   | AssessmentRef does not exist         | Reject                                                      |
| P7   | High-risk plan requires human review | plan status = `"pending_approval"` → execute after approval |

#### Execute

| Path | Test Scenario                        | Assertion Focus                                              |
| ---- | ------------------------------------ | ----------------------------------------------------------- |
| P1   | Single-step execution → DualChannelStepOutput | userFacingResult + systemTelemetry complete              |
| P2   | Partial step failure → partial success | Successful step outputs preserved                         |
| P3   | Illegal tool call / sandbox rejection | `status: "blocked"` + error code                          |
| P4   | Step timeout                         | Step marked `"failed"` + `code: "tool.timeout"`            |
| P5   | All steps already completed (replay) | Skip                                                        |
| P6   | Plan step references non-existent tool | Reject + fallback to Plan                                  |
| P7   | Step triggers approval block         | `status: "blocked_awaiting_approval"` → resume execution after approval |

#### Feedback

| Path | Test Scenario                      | Assertion Focus                                           |
| ---- | ---------------------------------- | -------------------------------------------------------- |
| P1   | Execution result → FeedbackSignal set | signal correctly classified (success/failure/correction) |
| P2   | Duplicate signals                  | deduplication takes effect                               |
| P3   | Empty signal list                 | Returns empty set, no error                              |
| P4   | Signal collection timeout         | Returns collected portion                                |
| P5   | No execution output               | Skip feedback                                            |
| P6   | stepOutputRefs reference non-existent | Ignore + warning                                        |
| P7   | Feedback result requires human confirmation of accuracy | signal marked `"pending_review"` → effective after human confirmation |

#### Learn

| Path | Test Scenario                                                      | Assertion Focus                                             |
| ---- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| P1   | Feedback signals → LearningSignal (failure_pattern / recovery_playbook) | learningType + sourceSignalIds correct                     |
| P2   | Low-confidence pattern                                            | Marked as tentative                                        |
| P3   | Illegal learningType                                              | Reject                                                     |
| P4   | Mining timeout                                                     | Returns empty                                              |
| P5   | No failure signals                                                | Skip learning                                              |
| P6   | FeedbackSignal structure incomplete                               | Reject                                                     |
| P7   | Learning conclusion requires expert review                        | learning marked `"expert_review_required"` → entered after review |

#### Improve

| Path | Test Scenario                                                    | Assertion Focus                                            |
| ---- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| P1   | Learning output → ImprovementCandidate (status: proposed → approved) | changeScope + expectedBenefit reasonable                   |
| P2   | Improvement exceeds autonomy boundary                            | status stays `"proposed"`, requires human approval         |
| P3   | Empty learning output                                           | Does not produce candidate                                |
| P4   | Evaluation timeout                                               | candidate marked `"rejected"`                              |
| P5   | No improvable items                                              | Skip                                                       |
| P6   | LearningSignal references illegal sourceSignalRefs               | Reject                                                     |
| P7   | Improvement exceeds autonomy boundary → requires human approval  | candidate stays `"proposed"` → advance or reject after approval |

#### Release

| Path | Test Scenario                                                     | Assertion Focus                                                     |
| ---- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| P1   | approved candidate → RolloutRecord (shadow → suggest → stable)  | level progresses correctly                                          |
| P2   | metrics gate not passed                                          | Stays at current level                                              |
| P3   | Illegal candidateId                                              | Reject                                                              |
| P4   | Rollout timeout                                                   | Automatic rollback                                                  |
| P5   | Candidate rejected                                                | Skip rollout                                                        |
| P6   | Candidate references expired evidence                             | Reject + re-evaluate                                               |
| P7   | Rollout requires human approval release                           | rollout stays `"pending_approval"` → continue advancing level after approval |

### 16.3 Coverage Quantification

```
OAPEFLIR Stage Coverage = (tested paths) / (8 stages × 7 paths = 56) × 100%
```

**Goal**: ≥ 85% (at least 48/56 paths have tests)

### 16.4 OAPEFLIR-Harness Semantic Mapping (v3.0 new)

> Corresponds to architecture review v6.0 gap I-2 (§13.5 OAPEFLIR-Harness External Semantic Mapping)

Architecture design §13.5 requires establishing explicit semantic mapping between OAPEFLIR 8 stages and Harness three roles (Planner / Generator / Evaluator). This mapping is not yet codified (gap I-2), but tests should preemptively define expected mapping:

| OAPEFLIR Stage | Harness Role    | Mapping Semantics                                      |
| ------------- | ---------------- | ------------------------------------------------------ |
| Observe       | —                | External input collection, does not enter Harness loop |
| Assess        | Planner          | Task evaluation → PlanBundle input                     |
| Plan          | Planner          | Generate PlanBundle (stepId/DAG/tools)                 |
| Execute       | Generator        | Generate WorkProduct (code/docs/operations)            |
| Feedback      | Evaluator        | Generate EvaluationReport (pass/fail)                  |
| Learn         | Evaluator        | Extract LearningSignal from EvaluationReport           |
| Improve       | Planner+Evaluator| Improvement candidate evaluation + approval           |
| Release       | —                | Rollout control, not directly involved in Harness loop |

**Test Requirements**: When gap I-2 is implemented, verify:

- [ ] Mapping configuration exists and includes all 8 stages
- [ ] Planner role covers Assess/Plan/Improve three stages
- [ ] Generator role covers Execute stage
- [ ] Evaluator role covers Feedback/Learn/Improve three stages
- [ ] Observe and Release marked as external stages, not entering Harness loop

---

## 17. Concurrency and Timing Testing Specification

### 17.1 Modules Requiring Concurrency Testing

| Module                                               | Concurrency Risk               | Test Type                |
| --------------------------------------------------- | ------------------------------ | ------------------------ |
| `execution-lease-service`                           | Competing lease acquisition    | Race Test + Idempotency  |
| `execution-dispatch-service`                        | Concurrent dispatch of same ticket | Race Test              |
| `execution-worker-handshake-service`                | Concurrent claim of same execution | Race Test            |
| `distributed-lock-adapter` (SQLite/Redis/PG)         | Competing lock acquisition     | Critical Section Test    |
| `durable-event-bus`                                 | Concurrent publish + deliverPending | Race Test          |
| `approval-service`                                  | Concurrent approval of same request | Idempotency Test     |
| `sqlite-queue-adapter` / `redis-queue-adapter`       | Concurrent enqueue + dequeue   | Race Test + Idempotency |
| `circuit-breaker`                                   | Concurrent requests trigger state transitions | Race Test      |
| `transition-service`                               | Concurrent state transitions (CAS) | Race Test            |
| `channel-gateway-retry-executor`                   | Overlapping polling passes      | Non-overlap Test        |

### 17.2 Test Type Definitions

#### Race Test

Verify concurrent operations do not cause data corruption or invariant violations:

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
    { concurrency: 10 },
  );

  const granted = result.values.filter((r) => r.decision === "granted");
  assert.equal(granted.length, 1, "Exactly one lease should be granted");
});
```

#### Idempotency Test

Verify duplicate operations produce the same result:

```typescript
test("duplicate enqueue with same idempotency key returns existing job", async () => {
  const job1 = queue.enqueue({ data: "test", idempotencyKey: "key-1" });
  const job2 = queue.enqueue({ data: "test", idempotencyKey: "key-1" });
  assert.equal(job1.id, job2.id);
});
```

#### Critical Section Test

Verify mutex section only allows one worker to enter:

```typescript
test("distributed lock enforces mutual exclusion", async () => {
  const result = await runCriticalSectionTest(
    async (workerId) =>
      lock.acquire({ lockKey: "shared", owner: `w-${workerId}` }),
    async () => lock.release({ lockKey: "shared", owner: currentOwner }),
    { concurrency: 5 },
  );

  assert.equal(result.violations, 0, "No concurrent access violations");
});
```

#### Timeout Recovery Test

Verify resources are correctly released after timeout:

```typescript
test("expired lease is reclaimed and execution can be re-dispatched", async () => {
  // 1. Acquire lease
  await leaseService.acquireLease({
    executionId: "e1",
    workerId: "w1",
    ttlMs: 100,
  });
  // 2. Wait for expiration
  await new Promise((r) => setTimeout(r, 200));
  // 3. Reclaim
  const reclaimed = await leaseService.reclaimExpiredLeases();
  assert.equal(reclaimed.length, 1);
  // 4. New worker can acquire
  const result = await leaseService.acquireLease({
    executionId: "e1",
    workerId: "w2",
    ttlMs: 30000,
  });
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
  // Verify repair
  const repairs = await repairService.repair();
  assert.ok(repairs.length > 0);
  // Verify data consistency
  const execution = store.getExecution("e1");
  assert.notEqual(execution.status, "executing"); // Should not be stuck in intermediate state
});
```

### 17.3 Concurrency Testing Quantification Standards

| Module Category | Minimum Concurrency | Must Cover                          |
| -------------- | ------------------- | ----------------------------------- |
| Lock/lease     | 10 workers          | acquire/release/extend/steal        |
| Queue          | 20 workers          | enqueue/dequeue/ack/dead-letter    |
| State transition | 5 workers        | CAS competition + terminal idempotent |
| Event delivery | 10 workers          | publish + consumer ack             |
| Dispatch       | 5 workers           | ticket claim + handshake           |

### 17.4 Stale Write Prevention Testing

`ExecutionLeaseService.validateWriteAccess()` is the last defense against dirty writes. All 5 rejection reasons must be fully covered:

- [ ] `lease_not_found` — execution has no lease record
- [ ] `no_active_lease` — lease has expired/released
- [ ] `stale_fencing_token` — fencing token mismatch (old worker writes)
- [ ] `worker_mismatch` — requesting worker is not the lease holder
- [ ] `lease_mismatch` — lease ID mismatch

### 17.5 Time Control Strategy

The most common root cause of flaky tests in concurrency and timing tests is dependency on real time. This section defines a unified time control layered strategy.

#### A. Three-Layer Time Control

| Layer           | Applicable Scenario                               | Strategy                                                                      | Example                                                    |
| -------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| L1 — Controllable clock | Logic involving timeout, TTL, interval in Unit tests | Inject `Clock` interface, test passes `FakeClock`, manually advance time    | lease expiration, circuit breaker resetTimeout, retry delay |
| L2 — Bounded real time | Integration tests requiring real async/timer interaction | Allow `setTimeout` / `setInterval`, but single sleep ≤ 500ms, total per test ≤ 2s | Queue delivery then wait for consumer to consume           |
| L3 — No unbounded waiting | All tests                                       | Prohibit `while(true) await sleep()`, prohibit timeout-less `waitForEvent()` | —                                                          |

#### B. Hard Rules

1. **Unit tests prohibit direct `setTimeout` / `Date.now()` calls** — must use injected Clock interface
2. **All `await sleep()` calls must have `{ timeout }` parameter upper bound** — must self-terminate before CI timeout
3. **Integration test total sleep budget**: single test case ≤ 2s, single test file ≤ 10s
4. **Retry loops must have `maxAttempts` + `maxWaitMs` dual limits** — prevent infinite retry

#### C. FakeClock Template

```typescript
class FakeClock {
  private _now: number;
  constructor(initialMs = 0) {
    this._now = initialMs;
  }
  now(): number {
    return this._now;
  }
  advance(ms: number): void {
    this._now += ms;
  }
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

- Lint rule (or grep CI step) detects bare `Date.now()`, `new Date()`, `setTimeout` calls in unit test directory, flagged as warning
- `--test-timeout=30000` as global fallback, test cases exceeding 30s automatically fail

---

## 18. Design Specification to Test Traceability Specification

### 18.1 Goal

Establish **bidirectional traceability** between design documents and test cases, such that:

- Every P0/P1 design specification has corresponding tests
- Every test can be traced back to a design requirement

### 18.2 Spec ID Encoding Rules

This project uses **4 prefixes** to distinguish traceable specification sources:

| Prefix      | Meaning           | Source                                              |
| ----------- | ----------------- | --------------------------------------------------- |
| `SPEC-`     | Design spec       | `opeli_detailed_design.md` and other design docs   |
| `ADR-`      | Architecture decision record | ADR documents in `doc/adr/` directory      |
| `CONTRACT-` | Interface/behavior contract | contract documents in `doc/contracts/` directory |
| `INC-`      | Production incident | Incident retrospective records, triggering regression tests |

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
INC-20250312-LEASE-STALE-001  # 2025-03-12 lease dirty write incident #1
INC-20250401-DLQ-OVERFLOW-001 # 2025-04-01 DLQ overflow incident #1
```

### 18.3 Referencing Spec IDs in Tests

Include spec ID in test title (all 4 prefixes supported):

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

#### Table 1: Source File → Unit Test

```
src/platform/feedback/feedback-collector.ts → tests/unit/platform/feedback/feedback-collector.test.ts
```

(i.e., §7.3's Traceability Matrix)

#### Table 2: Source File → Integration Test

```
src/platform/five-plane-execution/tools/command-executor.ts → tests/integration/security/sandbox-command-executor.test.ts
```

#### Table 3: Design Specification → Test

```
opeli_detailed_design.md §5 Execute  → SPEC-OAPEFLIR-EXEC-001 → tests/unit/core/agent-loop/execute.test.ts:L45
opeli_detailed_design.md §12 Rollout → SPEC-ROLLOUT-STATE-003 → tests/unit/core/improvement/rollout.test.ts:L88
doc/contracts/sandbox-contract.md    → SPEC-PLUGIN-SANDBOX-002 → tests/integration/security/plugin-sandbox.test.ts:L30
```

### 18.5 Maintenance Process

1. **New design specification** → Assign Spec ID → Write into design document
2. **Write test** → Reference Spec ID in test title or file header
3. **Sprint Review** → Run traceability script, output uncovered Spec ID list
4. **Gap handling** → Uncovered Spec IDs enter test debt ledger (§20)

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

# Statistics by prefix
echo "=== Uncovered Statistics ==="
for prefix in SPEC ADR CONTRACT INC; do
  count=$(grep -c "^${prefix}-" /tmp/uncovered.txt 2>/dev/null || echo 0)
  echo "  ${prefix}: ${count}"
done
```

---

## 19. Real Execution vs Mock Execution Boundary Specification

### 19.1 Problem Background

The most common testing trap in Agent systems: **test coverage is high, but core execution is entirely mocked**. The Execute stage in this project currently has a completely mock implementation.

Must clearly define which test layers allow mocking and which must use real execution.

### 19.2 Mock Permission Matrix

| Component                     | Unit Test                 | Integration Test              | E2E Test                        |
| ----------------------------- | ------------------------- | ----------------------------- | ------------------------------- |
| **LLM Provider**              | Mock allowed              | Mock allowed                  | Mock allowed (provider not under our control) |
| **Tool Execution Bridge**     | Mock allowed              | Must be real                  | Must be real                    |
| **Sandbox / Security Policy** | Mock allowed              | Must be real                  | Must be real                    |
| **Database (SQLite)**         | Prohibited to mock         | Real in-memory                | Real                            |
| **Database (PostgreSQL)**     | Mock (unit uses SQLite)   | Must be real PG               | Must be real PG                 |
| **File system**               | Mock or temp dir          | Must use temp dir             | Real                            |
| **Child process (spawn)**     | Mock allowed              | Must be real                  | Must be real                    |
| **Event Bus**                 | Mock allowed              | Must be real DurableEventBus  | Must be real                    |
| **Distributed lock**          | Mock allowed              | Must be real SQLite/Redis adapter | Must be real                  |
| **Network HTTP**              | Mock allowed              | Mock (external API)           | Mock                            |
| **OAPEFLIR stage output**     | Mock (isolate test single stage) | Stages must be truly chained | Full chain                      |

### 19.3 Mock Layer Prohibitions

The following combinations are **strictly prohibited**:

| Prohibition                                            | Reason                                              |
| ------------------------------------------------------ | --------------------------------------------------- |
| Mock DB in Integration test                            | Cannot verify SQL correctness, transaction isolation, migration compatibility |
| Mock sandbox in Integration test                       | Cannot verify path traversal/command injection protection |
| Mock tool bridge in E2E test                           | Cannot verify real tool chain behavior              |
| Mock `StateTransitionMachine.assertTransition` at any layer | Cannot verify state machine constraints          |
| Mock `validateWriteAccess` at any layer                | Cannot verify fencing token protection              |

### 19.4 Provider Mock Specification

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
- Prohibited to add `Math.random()` or `Date.now()` in mock

---

## 20. Test Debt Classification

### 20.1 Classification Definition

| Level    | Definition                                       | Fix Timeline    | Example                                        |
| -------- | ------------------------------------------------ | --------------- | --------------------------------------------- |
| **TD-P0** | Security boundary / state machine / execution main chain untested | Current Sprint  | New attack vector on sandbox has no denial-path test |
| **TD-P1** | Core orchestrator low branch/mutation coverage   | Next Sprint     | `OapeflirLoopService` has no unit test        |
| **TD-P2** | Auxiliary service branch < 60% or mutation < 50% | Within 2 Sprints | `improvement` branches 52.4%                  |
| **TD-P3** | Tool class / helper functions missing boundary conditions | Backlog      | Pure function missing null value test          |
| **TD-P4** | Golden / performance test documentation reinforcement | Backlog      | New CLI command has no golden snapshot         |

### 20.2 Debt Registration Format

```
TD-{level}-{sequence}: {description}
  Module: {src/platform/xxx}
  Current coverage: {lines}% / {branches}% / mutation {x}%
  Target coverage: {lines}% / {branches}%
  Associated Spec: {SPEC-xxx} (if applicable)
  Owner: {owner}
  Due date: {date}
```

### 20.3 Debt Entry and Exit Conditions

**Entry conditions**:

- §7 Traceability Matrix script discovers uncovered source files
- Coverage gate directory below safety redline (§23)
- Stryker report survived mutants rate > 50%
- PR Review discovers missing test scenarios
- Incident replay does not produce corresponding regression test

**Exit conditions**:

- Corresponding tests written and merged to main
- Coverage baseline updated
- Mutation score improved to ≥ low threshold

### 20.4 Sprint Test Debt Auto-Report

At the end of each Sprint, a test debt report is automatically generated as a required input for Sprint Review.

#### A. Report Content

| Section               | Data Source                  | Description                                        |
| --------------------- | ---------------------------- | -------------------------------------------------- |
| New TD                | New TD entries this Sprint   | Statistics by priority distribution                 |
| Closed TD            | TD entries closed this Sprint | Distribution by close reason (fixed / cancelled / downgraded) |
| Redline violation directories | §23 coverage quality redlines check | List directories below safety redline and gap    |
| Uncovered Spec ID     | §18.5 traceability script output | By prefix (SPEC / ADR / CONTRACT / INC) classification |
| Top-N Survived Mutants | Stryker report             | Top 10 source files with most survived mutants     |
| Unreplayed incidents  | §21 failure sample replay list | Incidents recorded but not yet producing regression tests |

#### B. Automation Script Requirements

```bash
#!/usr/bin/env bash
# scripts/ci/sprint-test-debt-report.sh

echo "=== Sprint Test Debt Report ==="
echo "Date: $(date -I)"
echo ""

echo "## 1. Redline Violation Directories"
node scripts/ci/check-coverage-baseline.mjs --report-only 2>&1 | grep "BELOW"

echo ""
echo "## 2. Uncovered Spec IDs"
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

- Report script runs on each `main` branch merge, output archived to `data/sprint-reports/` directory
- If number of redline violation directories > last report, CI issues warning (non-blocking)
- Sprint Review agenda must include interpretation of this report

---

## 21. Failure Sample Replay Rules

### 21.1 Core Principle

> **Every production incident, rollback, security escape, high-priority user correction must be replayed as at least one regression test.**

### 21.2 Replay Trigger Conditions

| Trigger Event                | Required Replay Test Type                              |
| ---------------------------- | ------------------------------------------------------ |
| Production incident (P0/P1)  | Integration regression + root cause unit test          |
| Rollback (Rollout revert)    | State machine transition test + condition gate test    |
| Security escape (sandbox bypass) | Denial-path regression (§8)                        |
| User correction (manual fix) | Unit test covering the corrected logic branch          |
| Data inconsistency fix       | Concurrency/transaction isolation test (§17)          |
| Dead letter backlog          | Event lifecycle test (§15)                             |

### 21.3 Replay Process

```
Incident occurs → Root cause analysis → Fix code
                              ↓
                  Write regression test (test title includes incident ID)
                              ↓
                  Verify: delete fix code → regression test fails (confirm test is valid)
                              ↓
                  Restore fix code → test passes → merge
```

### 21.4 Replay Test Naming

```typescript
test("[INC-2026-0417] stale fencing token causes duplicate writeback", () => {
  // Reproduce incident root cause
});
```

### 21.5 Replay Verification

Replay tests must pass **reverse verification**:

1. Comment out the fix code
2. Run replay test → must fail
3. Restore the fix code
4. Run replay test → must pass

If step 2 test still passes, the test does not effectively cover the root cause and needs to be rewritten.

---

## 22. Test Data Governance

### 22.1 Fixture Minimalization Principle

Fixtures only contain fields **required for the test scenario**, with factory defaults for all others:

```typescript
// Good — only specifies fields the test cares about
const task = createMinimalTask({ priority: "critical" });

// Bad — copy-paste complete record
const task = {
  id: "task-001",
  parentId: null,
  rootId: "task-001",
  divisionId: "general_ops",
  title: "test",
  status: "queued",
  source: "user",
  priority: "critical",
  inputJson: "{}",
  // ... 20 more fields
};
```

### 22.2 Determinism Control

The following non-deterministic sources are **prohibited** in tests:

| Non-deterministic Source        | Alternative Solution                                          |
| ------------------------------- | ------------------------------------------------------------- |
| `Date.now()` / `new Date()`     | Use fixed timestamp or `withEnv({ AA_FIXED_TIME: "..." })`    |
| `Math.random()`                 | Use fixed seed or hardcoded value                             |
| `crypto.randomUUID()`           | Use fixed ID (e.g., `"task-test-001"`)                        |
| Network requests                | Mock provider                                                 |
| File system timestamps          | Normalize in golden tests                                     |
| PID in subprocess output        | Strip before assertion                                         |

### 22.3 Golden Snapshot Normalization

Before writing golden files, normalize unstable fields:

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

| Type             | File                                | Purpose                                                      |
| ---------------- | ----------------------------------- | ------------------------------------------------------------ |
| **Domain Fixture** | `tests/helpers/fixtures/base.ts`   | Minimum valid domain records (Task, Execution, Approval)     |
| **Scenario Fixture** | `tests/helpers/fixtures/composite.ts` | Multi-entity associated scenarios (BlockedTask, CompletedTask, FailedTask) |
| **Seed Fixture** | `tests/helpers/api.ts`              | Complete API environment seed                                |

When adding new fixtures:

- Single entity → add to `base.ts`
- Multi-entity associations → add to `composite.ts`
- Test-specific → inline in test file (do not extract)

### 22.5 Test Isolation

- Each test independently creates temp workspace, `try/finally` cleanup
- No shared state between tests (global variables, singletons, static properties)
- Environment variables isolated via `withEnv()`
- Database isolated via independent DB files (do not share in-memory DB)

---

## 23. Coverage Quality Redlines

### 23.1 Problem

Global 82.4% line coverage may mask low coverage in critical modules. Need to define **hard minimum thresholds** for different modules.

### 23.2 Tiered Redlines (v3.0 updated directory mapping)

| Level        | Applicable Modules                                                               | Lines Redline | Branches Redline | Mutation Redline |
| ------------ | ---------------------------------------------------------------------------------- | ------------- | ---------------- | ---------------- |
| **Critical** | compliance, distributed-lock, state-transition, execution-lease, control-plane/iam | ≥ 90%         | ≥ 80%            | ≥ 70%            |
| **High**     | orchestration/oapeflir, state-evidence/memory, knowledge, events, execution-engine | ≥ 85%         | ≥ 75%            | ≥ 60%            |
| **Standard** | orchestration/oapeflir/learn, planning, improvement, artifacts, prompt-engine    | ≥ 80%         | ≥ 70%            | ≥ 50%            |
| **Baseline** | plugins, sdk/cli, model-gateway, tool-executor, domains                           | ≥ 75%         | ≥ 60%            | ≥ 50%            |

### 23.3 Current Gaps (v4.0 c8 measured data)

> **Important**: c8 full analysis (`all: true`) shows all modules at **0%** coverage, with the only exception being 6 files (100%) under `state-evidence/truth/sqlite/`. Therefore, all Critical and High modules below currently **do not meet standards**.

| Module                                       | Level     | Current Lines | Redline | Current Branches | Redline | Status                |
| -------------------------------------------- | --------- | ------------- | ------- | ---------------- | ------- | --------------------- |
| `platform/five-plane-execution/distributed-lock`        | Critical  | 0%            | 90%     | 0%               | 80%     | Lines **gap 90%**     |
| `platform/five-plane-execution/state-transition`        | Critical  | 0%            | 90%     | 0%               | 80%     | Lines **gap 90%**     |
| `platform/five-plane-control-plane/iam`                 | Critical  | 0%            | 90%     | 0%               | 80%     | Lines **gap 90%**     |
| `platform/compliance`                        | Critical  | 0%            | 90%     | 0%               | 80%     | Lines **gap 90%**     |
| `platform/five-plane-orchestration/oapeflir`            | High      | 0%            | 85%     | 0%               | 75%     | Lines **gap 85%**     |
| `platform/five-plane-state-evidence/memory`             | High      | 0%            | 85%     | 0%               | 75%     | Lines **gap 85%**     |
| `platform/five-plane-state-evidence/events`             | High      | 0%            | 85%     | 0%               | 75%     | Lines **gap 85%**     |
| `platform/five-plane-execution/execution-engine`         | High      | 0%            | 85%     | 0%               | 75%     | Lines **gap 85%**     |
| `platform/five-plane-state-evidence/knowledge`          | High      | 0%            | 85%     | 0%               | 75%     | Lines **gap 85%**     |
| `platform/five-plane-orchestration/oapeflir/learn`      | Standard  | 0%            | 80%     | 0%               | 70%     | Lines **gap 80%**     |
| `platform/five-plane-state-evidence/artifacts`          | Standard  | 0%            | 80%     | 0%               | 70%     | Lines **gap 80%**     |
| `platform/prompt-engine`                     | Standard  | 0%            | 80%     | 0%               | 70%     | Lines **gap 80%**     |
| `plugins`                                    | Baseline  | 0%            | 75%     | 0%               | 60%     | Lines **gap 75%**     |
| `sdk/cli`                                    | Baseline  | 0%            | 75%     | 0%               | 60%     | Lines **gap 75%**     |
| `platform/model-gateway`                     | Baseline  | 0%            | 75%     | 0%               | 60%     | Lines **gap 75%**     |
| `domains`                                    | Baseline  | 0%            | 75%     | 0%               | 60%     | Lines **gap 75%**     |

> **v4.0 major change**: c8 full analysis shows all modules at 0% coverage (except 6 files in state-evidence/truth/sqlite/). v3.0's claimed high coverage data has been verified as inaccurate. **Root cause analysis**: Test code exists (1,803 .test.ts files, 52,480 assertions), but c8 coverage collection may not be correctly correlating to all compiled `dist/src/` files, or the `build:test` compilation process did not include all source files within c8's instrumentation scope. Need to investigate c8 configuration and build chain integration issues.

### 23.4 Redline Enforcement

Write redlines into `.coverage-baseline.json` directory-level minimums, enforced by `check-coverage-baseline.mjs`.

Current baseline only records "observed values", suggest extending to:

```json
{
  "src/platform/security": {
    "fileCount": 19,
    "metrics": { "lines": 91.9, ... },
    "minimums": { "lines": 90, "branches": 80 }
  }
}
```

### 23.5 State Machine / Security Special Redlines

Beyond coverage, the following modules have special redlines:

| Special Category           | Redline                            | Measurement Method                          |
| -------------------------- | ---------------------------------- | ------------------------------------------- |
| State machine legal transitions coverage | 100%                  | Tested legal edges / total legal edges     |
| State machine illegal transitions coverage | Terminal × all non-self states 100% | Rejection tests / should-reject count       |
| Security denial-path       | Each attack surface ≥ 3 paths     | Denial tests / attack surface count         |
| Tier 1 event lifecycle    | 9 event types × 8 phases 100%      | Tested phases / 72                          |
| Fencing token rejections   | 5 reasons 100%                    | Rejection tests / 5                         |

---

---

# Part III — Architecture Gap Regression Test Matrix (v4.0 rewrite, aligned with architecture review v8.0)

> Part I solves "code coverage governance", Part II solves "architectural semantic coverage".
> Part III solves "**architectural design vs. implementation gap regression protection**" — Based on **13 architectural gaps** discovered by architecture review v8.0 (`docs_zh/reviews/architecture-design-vs-implementation-review.md`), defining corresponding test specifications to ensure each gap has comprehensive test coverage after implementation.
>
> **v4.0 change**: Complete rewrite. v3.0 was based on architecture review v6.0's 29 gaps (GAP-* numbering). This version is based on architecture review v8.0's full评审 of full codebase (1,387 files / 265,020 lines) vs. design document v3.2 (~8,000 lines / 94 chapters), covering **3 P0 architectural violations + 7 P1 implementation gaps + 3 P2 detail completions**. Harness-related gaps (GAP-VI-*) in v3.0 have been partially implemented in code (29 files 1,471 lines), this version focuses on security/classification/authorization framework level design-implementation gaps.

---

## 24. Architecture Review-Driven Regression Testing

### 24.1 Background

Architecture review v8.0 conducted a full review of 1,387 source files / 265,020 lines of code, comparing against architecture design document v3.2 (~8,000 lines / 94 chapters), discovering **13 architectural design vs. implementation gaps**:

| Priority              | Count | Key Gaps                                                                        |
| --------------------- | ----- | ------------------------------------------------------------------------------- |
| P0 Architecture violations | 3     | E1-E6 anomaly classification missing, SEV1-4 unified severity missing, STRIDE threat model missing |
| P1 Explicit requirements insufficient implementation | 7 | Principal type, Sandbox levels, Cursor pagination, HITL mode, RBAC three-layer authorization, vertical domain, multimodal |
| P2 Detail completions | 3     | Webhook-Outbox coupling, logical table reconciliation, metamodel 12 questions  |

### 24.2 Gap ID to Test Traceability

Tests use `[ARCH-P{level}-{sequence}]` prefix in titles, one-to-one corresponding to architecture review v8.0 gap numbers:

```
Architecture review v8.0: P0-1 §12.1 Anomaly event classification system E1-E6 completely missing
    ↓
Test title: [ARCH-P0-1] AnomalyEventClass enum defines all 6 categories E1-E6
    ↓
File location: tests/unit/platform/contracts/anomaly-event-classification.test.ts
```

| Prefix      | Meaning                              | Gap Count |
| ---------- | ------------------------------------ | --------- |
| `ARCH-P0-` | Architecture violation (completely missing) | 3         |
| `ARCH-P1-` | Explicit requirement but insufficient implementation | 7         |

# Part III — Architecture Gap Regression Test Matrix (v4.0 Rewrite, Aligned with Architecture Review v8.0)

> Part I addresses "code coverage governance," Part II addresses "architectural semantic coverage."
> Part III addresses "**architecture design vs. implementation gap regression protection**" — based on the **13 architectural gaps** discovered in Architecture Review v8.0 (`docs_zh/reviews/architecture-design-vs-implementation-review.md`), defining corresponding test specifications to ensure each gap has comprehensive test coverage after implementation.
>
> **v4.0 Changes**: Complete rewrite. v3.0 was based on 29 gaps (GAP-* numbering) from Architecture Review v6.0. This version is based on Architecture Review v8.0's full-scale review of the entire codebase (1,387 files / 265,020 lines) against design document v3.2 (§1-§94), covering **3 P0 architecture violations + 7 P1 implementation deficiencies + 3 P2 detail completions**. Harness-related gaps (GAP-VI-*) from v3.0 have been partially implemented in code (29 files, 1,471 lines); this version focuses on design-implementation gaps at the security/classification/authorization framework level.

---

## 24. Architecture Review-Driven Regression Testing

### 24.1 Background

Architecture Review v8.0 conducted a full-scale review of 1,387 source files / 265,020 lines of code, comparing against the architectural design document v3.2 (approximately 8,000 lines / 94 chapters), and discovered **13 architectural design vs. implementation gaps**:

| Priority          | Count | Key Gaps                                                                                           |
| ----------------- | ----- | -------------------------------------------------------------------------------------------------- |
| P0 Architecture Violation | 3     | E1-E6 anomaly classification missing, SEV1-4 unified severity missing, STRIDE threat model missing |
| P1 Explicit Requirement Implementation Deficiency | 7     | Principal type, Sandbox tier, Cursor pagination, HITL mode, RBAC three-layer authorization, vertical domain, multimodal |
| P2 Detail Completion | 3     | Webhook-Outbox coupling, logical table reconciliation, meta-model 12 questions                     |

### 24.2 Gap ID to Test Traceability

Test titles use the `[ARCH-P{level}-{sequence}]` prefix, one-to-one corresponding with Architecture Review v8.0 gap numbers:

```
Architecture Review v8.0: P0-1 §12.1 Anomaly event classification system E1-E6 completely missing
    ↓
Test Title: [ARCH-P0-1] AnomalyEventClass enum defines all 6 categories E1-E6
    ↓
File Location: tests/unit/platform/contracts/anomaly-event-classification.test.ts
```

| Prefix      | Meaning                       | Gap Count |
| ----------- | ----------------------------- | --------- |
| `ARCH-P0-`  | Architecture violation (completely missing) | 3         |
| `ARCH-P1-`  | Explicitly required but implementation deficient | 7         |
| `ARCH-P2-`  | Detail completion             | 3         |

### 24.3 Priority Execution Plan

| Priority | Fix Timeline | Gap IDs                                                                                                              |
| -------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| **P0**   | 1-2 weeks    | P0-1 (E1-E6 classification), P0-2 (SEV1-4 unified severity), P0-3 (STRIDE)                                           |
| **P1**   | 2-4 weeks    | P1-1 (Principal), P1-2 (Sandbox), P1-3 (pagination), P1-4 (HITL), P1-5 (RBAC), P1-6 (vertical domain), P1-7 (multimodal) |
| **P2**   | Ongoing      | P2-1 (Webhook-Outbox), P2-2 (logical tables), P2-3 (meta-model 12 questions)                                         |

---

## 25. P0 Architecture Violation Gap Test Specifications

### 25.1 [ARCH-P0-1] §12.1 Anomaly Event Classification System E1-E6 Completely Missing

**Gap**: The design defines 6 types of anomaly event classification (E1 business/E2 execution/E3 external dependency/E4 security/E5 data/E6 governance). `AnomalyDetectionService` in the code uses `AnomalyCategory` (spike/trend_change/level_shift), completely different from the design classification system.

**Test Type**: Unit

**Test Objective**: The anomaly event classification enum must include all 6 categories E1-E6, and the classification mapping logic must be correct.

```typescript
test("[ARCH-P0-1] AnomalyEventClass enum defines all 6 categories", () => {
  const categories = Object.values(AnomalyEventClass);
  assert.equal(categories.length, 6);
  assert.ok(categories.includes("E1_BUSINESS"));
  assert.ok(categories.includes("E2_EXECUTION"));
  assert.ok(categories.includes("E3_EXTERNAL_DEPENDENCY"));
  assert.ok(categories.includes("E4_SECURITY"));
  assert.ok(categories.includes("E5_DATA"));
  assert.ok(categories.includes("E6_GOVERNANCE"));
});

test("[ARCH-P0-1] ClassifiedAnomalyEvent requires class and severity fields", () => {
  const validEvent = {
    event_id: "evt-001",
    class: AnomalyEventClass.E1_BUSINESS,
    severity: UnifiedSeverity.SEV3,
    source_plane: "state-evidence",
    detected_at: "2026-04-23T00:00:00Z",
    details: {},
  };
  assert.doesNotThrow(() => ClassifiedAnomalyEventSchema.parse(validEvent));
});

test("[ARCH-P0-1] statistical detection maps to business classification", () => {
  const spikeOnSla = { category: "spike", source: "slo-alerting" };
  assert.equal(mapToEventClass(spikeOnSla), AnomalyEventClass.E1_BUSINESS);

  const trendOnSecurity = { category: "trend_change", source: "iam-audit" };
  assert.equal(mapToEventClass(trendOnSecurity), AnomalyEventClass.E4_SECURITY);
});
```

**Test Scenario Checklist**:

| Scenario                                    | Assertion                                                   |
| ------------------------------------------- | ----------------------------------------------------------- |
| Each E1-E6 classification enum value exists | Enum length = 6, contains all values                        |
| Schema validates valid event                | `doesNotThrow`                                              |
| Schema rejects event missing class          | `throws`                                                    |
| Statistical detection → E1-E6 mapping covers all | Each source_plane maps to at least one E category      |
| Event published with class field            | outbox/event message contains `AnomalyEventClass`          |

### 25.2 [ARCH-P0-2] §12.2 Unified Severity Levels SEV1-SEV4 Missing

**Gap**: The code contains 3 incompatible severity systems: Incident uses P0-P3, Anomaly uses warning/critical/emergency, SLO uses AlertSeverity. The design requires unified use of SEV1-SEV4.

**Test Type**: Unit + Integration

```typescript
test("[ARCH-P0-2] UnifiedSeverity enum defines SEV1-SEV4", () => {
  const severities = Object.values(UnifiedSeverity);
  assert.deepEqual(severities, ["SEV1", "SEV2", "SEV3", "SEV4"]);
});

test("[ARCH-P0-2] SEVERITY_SLA defines response times for all levels", () => {
  for (const sev of Object.values(UnifiedSeverity)) {
    const sla = SEVERITY_SLA[sev];
    assert.ok(sla, `SLA must exist for ${sev}`);
    assert.ok(sla.response_minutes > 0);
    assert.ok(sla.resolution_minutes > 0);
  }
  assert.ok(
    SEVERITY_SLA.SEV1.response_minutes < SEVERITY_SLA.SEV4.response_minutes,
  );
});

test("[ARCH-P0-2] incident P0-P3 maps to SEV1-SEV4", () => {
  assert.equal(toUnifiedSeverity("P0"), UnifiedSeverity.SEV1);
  assert.equal(toUnifiedSeverity("P1"), UnifiedSeverity.SEV2);
  assert.equal(toUnifiedSeverity("P2"), UnifiedSeverity.SEV3);
  assert.equal(toUnifiedSeverity("P3"), UnifiedSeverity.SEV4);
});

test("[ARCH-P0-2] anomaly warning/critical/emergency maps to SEV levels", () => {
  assert.equal(anomalyToSeverity("emergency"), UnifiedSeverity.SEV1);
  assert.equal(anomalyToSeverity("critical"), UnifiedSeverity.SEV2);
  assert.equal(anomalyToSeverity("warning"), UnifiedSeverity.SEV3);
});
```

### 25.3 [ARCH-P0-3] §11.8 STRIDE Threat Model Completely Missing

**Gap**: The design requires STRIDE six-dimension threat assessment + supplementary threat matrix. There is no STRIDE implementation in the code.

**Test Type**: Unit

```typescript
test("[ARCH-P0-3] StrideCategory enum defines 6 STRIDE dimensions", () => {
  const categories = Object.values(StrideCategory);
  assert.equal(categories.length, 6);
  assert.ok(categories.includes("SPOOFING"));
  assert.ok(categories.includes("TAMPERING"));
  assert.ok(categories.includes("REPUDIATION"));
  assert.ok(categories.includes("INFORMATION_DISCLOSURE"));
  assert.ok(categories.includes("DENIAL_OF_SERVICE"));
  assert.ok(categories.includes("ELEVATION_OF_PRIVILEGE"));
});

test("[ARCH-P0-3] ThreatMatrix has entries for all 6 STRIDE dimensions", () => {
  const matrix = ThreatMatrixRegistry.getMatrix();
  const coveredCategories = new Set(matrix.entries.map((e) => e.category));
  for (const cat of Object.values(StrideCategory)) {
    assert.ok(coveredCategories.has(cat), `No threat entry for ${cat}`);
  }
});

test("[ARCH-P0-3] each STRIDE dimension has at least one mitigation", () => {
  const matrix = ThreatMatrixRegistry.getMatrix();
  for (const cat of Object.values(StrideCategory)) {
    const entries = matrix.entries.filter((e) => e.category === cat);
    const hasMitigation = entries.some((e) => e.mitigations.length > 0);
    assert.ok(hasMitigation, `${cat} must have at least one mitigation`);
  }
});
```

---

## 26. P1 High Priority Gap Test Specifications

### 26.1 [ARCH-P1-1] Principal Type Incomplete (3/6)

**Gap**: Architecture §11.1 defines 6 Principal types (Human / ServiceAccount / Agent / System / External / Anonymous). The code only implements the first 3.

**Test Type**: Unit

```typescript
test("[ARCH-P1-1] PrincipalType enum covers all 6 types", () => {
  const required = [
    "human",
    "service_account",
    "agent",
    "system",
    "external",
    "anonymous",
  ];
  for (const type of required) {
    assert.ok(
      PrincipalType[type] !== undefined,
      `PrincipalType must include "${type}"`,
    );
  }
});

test("[ARCH-P1-1] AuthContext accepts all 6 principal types", () => {
  const required = [
    "human",
    "service_account",
    "agent",
    "system",
    "external",
    "anonymous",
  ];
  for (const type of required) {
    const ctx = createAuthContext({ principalType: type, id: `p-${type}` });
    assert.equal(ctx.principalType, type);
    assert.doesNotThrow(() => AuthContextSchema.parse(ctx));
  }
});
```

### 26.2 [ARCH-P1-2] Sandbox Tier Incomplete (3/4 Tiers)

**Gap**: Architecture §11.4 defines 4 Sandbox tiers (none / process / container / vm). The code only implements the first 3 tiers.

**Test Type**: Unit

```typescript
test("[ARCH-P1-2] SandboxLevel enum covers all 4 tiers", () => {
  const required = ["none", "process", "container", "vm"];
  for (const level of required) {
    assert.ok(
      SandboxLevel[level] !== undefined,
      `SandboxLevel must include "${level}"`,
    );
  }
});

test("[ARCH-P1-2] SandboxFactory creates VM-tier sandbox", async () => {
  const sandbox = await SandboxFactory.create({ level: "vm" });
  assert.equal(sandbox.level, "vm");
  assert.ok(sandbox.isolationId, "VM sandbox must have isolationId");
  await sandbox.destroy();
});
```

### 26.3 [ARCH-P1-3] Cursor-based Pagination Incomplete

**Gap**: Architecture §6.6 requires all list APIs to use cursor-based pagination. Currently some endpoints use offset-based or no pagination.

**Test Type**: Integration

```typescript
test("[ARCH-P1-3] list endpoints return cursor-based pagination fields", async () => {
  const listEndpoints = [
    "/api/tasks",
    "/api/domains",
    "/api/executions",
    "/api/audit-logs",
  ];

  for (const endpoint of listEndpoints) {
    const res = await request(app).get(endpoint).query({ limit: 2 });
    assert.ok(
      res.body.cursor !== undefined || res.body.nextCursor !== undefined,
      `${endpoint} must return cursor field`,
    );
    assert.ok(Array.isArray(res.body.items), `${endpoint} must return items`);
  }
});

test("[ARCH-P1-3] cursor-based pagination traverses all records", async () => {
  const allItems: unknown[] = [];
  let cursor: string | undefined;

  do {
    const res = await request(app)
      .get("/api/tasks")
      .query({ limit: 5, cursor });
    allItems.push(...res.body.items);
    cursor = res.body.nextCursor;
  } while (cursor);

  assert.ok(allItems.length > 0, "Must retrieve records via cursor");
});
```

### 26.4 [ARCH-P1-4] HITL 7-Mode Coverage to be Verified

**Gap**: Architecture §21.1 defines 7 types of Human-in-the-Loop modes (approve / reject / escalate / override / inspect / patch / takeover). Code coverage to be verified.

**Test Type**: Integration

```typescript
test("[ARCH-P1-4] HITL service supports all 7 interaction modes", async () => {
  const modes = [
    "approve",
    "reject",
    "escalate",
    "override",
    "inspect",
    "patch",
    "takeover",
  ];

  for (const mode of modes) {
    const handler = HitlService.getHandler(mode);
    assert.ok(handler, `HITL handler for mode "${mode}" must exist`);
    assert.equal(typeof handler.execute, "function");
  }
});

test("[ARCH-P1-4] HITL takeover transfers control to human operator", async () => {
  const run = await createTestRun();
  const result = await HitlService.execute("takeover", {
    runId: run.id,
    operator: "human-1",
  });
  assert.equal(result.status, "taken_over");
  assert.equal(result.controlledBy, "human-1");
});
```

### 26.5 [ARCH-P1-5] RBAC + Capability + Context-aware Three-Layer Authorization Incomplete

**Gap**: Architecture §11.2 requires three-layer authorization (RBAC role → Capability token → Context-aware dynamic policy). The code only implements the RBAC layer.

**Test Type**: Unit + Integration

```typescript
test("[ARCH-P1-5] AuthZ evaluates all 3 layers", async () => {
  const decision = await AuthZEngine.evaluate({
    principal: { id: "u-1", roles: ["developer"] },
    capability: { token: "cap-write-code", scope: "domain:coding" },
    context: { timeOfDay: "business_hours", riskLevel: "low" },
    action: "execute_task",
    resource: "task:t-123",
  });

  assert.ok(decision.allowed !== undefined);
  assert.ok(decision.evaluatedLayers.includes("rbac"));
  assert.ok(decision.evaluatedLayers.includes("capability"));
  assert.ok(decision.evaluatedLayers.includes("context_aware"));
});

test("[ARCH-P1-5] context-aware layer denies high-risk action outside business hours", async () => {
  const decision = await AuthZEngine.evaluate({
    principal: { id: "u-1", roles: ["developer"] },
    capability: { token: "cap-deploy", scope: "domain:ops" },
    context: { timeOfDay: "off_hours", riskLevel: "high" },
    action: "deploy_production",
    resource: "env:prod",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.deniedBy, "context_aware");
});
```

### 26.6 [ARCH-P1-6] Vertical Domain-Specific Architecture Missing

**Gap**: Architecture §71-§94 defines 24 vertical domains' specialized workflows, tool bundles, risk policies, and evaluation metrics. Currently all domains use generic skeletons.

**Test Type**: Unit (Golden)

```typescript
test("[ARCH-P1-6] each domain has specialized workflow beyond generic 2-step", () => {
  const domains = DomainBaselineCatalog.getAllDomainIds();
  for (const domainId of domains) {
    const workflows = DomainWorkflowRegistry.getWorkflows(domainId);
    assert.ok(workflows.length >= 1, `"${domainId}" needs workflows`);
    const hasSpecialized = workflows.some((w) => w.steps.length > 2);
    assert.ok(
      hasSpecialized,
      `"${domainId}" must have at least one specialized workflow`,
    );
  }
});

test("[ARCH-P1-6] each domain defines domain-specific tool bundle", () => {
  const domains = DomainBaselineCatalog.getAllDomainIds();
  for (const domainId of domains) {
    const bundle = DomainToolBundleRegistry.get(domainId);
    assert.ok(bundle, `"${domainId}" must have a tool bundle`);
    assert.ok(bundle.tools.length > 0, `"${domainId}" tool bundle is empty`);
  }
});

test("[ARCH-P1-6] each domain defines evaluation metrics", () => {
  const domains = DomainBaselineCatalog.getAllDomainIds();
  for (const domainId of domains) {
    const metrics = DomainEvalRegistry.getMetrics(domainId);
    assert.ok(metrics.length > 0, `"${domainId}" must have evaluation metrics`);
  }
});
```

### 26.7 [ARCH-P1-7] Multimodal Capability Video Processing is Skeleton

**Gap**: Architecture §68 defines multimodal processing capabilities (text / image / audio / video). Video processing only has a skeleton stub with no actual implementation.

**Test Type**: Unit + Integration

```typescript
test("[ARCH-P1-7] MultimodalProcessor supports all 4 modalities", () => {
  const modalities = ["text", "image", "audio", "video"];
  for (const modality of modalities) {
    const processor = MultimodalProcessorFactory.create(modality);
    assert.ok(processor, `Processor for "${modality}" must exist`);
    assert.equal(typeof processor.process, "function");
  }
});

test("[ARCH-P1-7] video processor performs actual processing beyond stub", async () => {
  const processor = MultimodalProcessorFactory.create("video");
  const input = createTestVideoInput({ durationMs: 5000 });
  const result = await processor.process(input);

  assert.ok(result.frames, "Video processor must extract frames");
  assert.ok(result.frames.length > 0, "Must produce at least one frame");
  assert.notEqual(result.status, "stub", "Video processor must not be a stub");
});
```

---

## 27. P2 Detail Completion Gap Test Specifications

### 27.1 [ARCH-P2-1] Webhook + Outbox Coupling Missing

**Gap**: Architecture §6.7 requires event notifications to use the Transactional Outbox pattern to guarantee at-least-once delivery. Currently webhooks are sent synchronously directly, with no outbox table and no retry tracking.

**Test Type**: Integration

```typescript
test("[ARCH-P2-1] WebhookService writes to outbox table before sending", async () => {
  const db = await createTestDb();
  const service = new WebhookService({ db, sender: createMockSender() });

  await service.dispatch({
    event: "task:completed",
    payload: { taskId: "t-1" },
    target: "https://example.com/hook",
  });

  const outboxRows = await db.query("SELECT * FROM webhook_outbox");
  assert.ok(outboxRows.length >= 1, "Must write to outbox before sending");
  assert.equal(outboxRows[0].event_type, "task:completed");
});

test("[ARCH-P2-1] OutboxProcessor retries failed webhook deliveries", async () => {
  let attempts = 0;
  const failingSender = {
    async send() {
      attempts++;
      if (attempts < 3) throw new Error("connection refused");
      return { status: 200 };
    },
  };

  const db = await createTestDb();
  const processor = new OutboxProcessor({ db, sender: failingSender });
  await db.insert("webhook_outbox", {
    event_type: "task:completed",
    payload: '{"taskId":"t-1"}',
    status: "pending",
  });

  await processor.processAll();
  assert.equal(attempts, 3);

  const rows = await db.query(
    "SELECT * FROM webhook_outbox WHERE status = 'delivered'",
  );
  assert.equal(rows.length, 1, "Must mark as delivered after success");
});
```

### 27.2 [ARCH-P2-2] Logical Table Count Discrepancy

**Gap**: There is a discrepancy between the logical table set defined in Architecture §26.3 and the actual schema definitions in the code. All architecture-required tables must be verified to have corresponding definitions in the code.

**Test Type**: Unit (Schema Validation)

```typescript
test("[ARCH-P2-2] all architecture-required tables exist in schema definitions", () => {
  const requiredTables = [
    "tasks",
    "executions",
    "audit_logs",
    "approvals",
    "domains",
    "domain_configs",
    "webhooks",
    "webhook_outbox",
    "dead_letter_queue",
    "checkpoints",
    "agent_sessions",
    "billing_records",
    "rate_limits",
    "sandbox_instances",
  ];

  const definedTables = SchemaRegistry.getAllTableNames();
  for (const table of requiredTables) {
    assert.ok(
      definedTables.includes(table),
      `Architecture-required table "${table}" must be defined in schema`,
    );
  }
});

test("[ARCH-P2-2] no orphan tables without architecture mapping", () => {
  const definedTables = SchemaRegistry.getAllTableNames();
  const mappedTables = ArchitectureTableMapping.getAllMappedTables();

  const orphans = definedTables.filter((t) => !mappedTables.includes(t));
  assert.ok(
    orphans.length === 0,
    `Orphan tables without architecture mapping: ${orphans.join(", ")}`,
  );
});
```

### 27.3 [ARCH-P2-3] Unified Domain Meta-model 12-Question Coverage

**Gap**: Architecture §37.11 defines 12 required questions for the unified domain meta-model (domain boundary, core entities, workflows, tool bundles, risk policies, evaluation metrics, budget constraints, security level, latency requirements, data sensitivity, compliance requirements, SLA targets). Each domain's meta-model answer coverage must be verified.

**Test Type**: Unit (Golden)

```typescript
test("[ARCH-P2-3] each domain meta-model answers all 12 questions", () => {
  const twelveQuestions = [
    "domainBoundary",
    "coreEntities",
    "workflows",
    "toolBundle",
    "riskPolicy",
    "evalMetrics",
    "budgetConstraints",
    "securityLevel",
    "latencyRequirement",
    "dataSensitivity",
    "complianceRequirements",
    "slaTargets",
  ];

  const domains = DomainBaselineCatalog.getAllDomainIds();
  for (const domainId of domains) {
    const metaModel = DomainMetaModelRegistry.get(domainId);
    assert.ok(metaModel, `"${domainId}" must have a meta-model`);

    for (const question of twelveQuestions) {
      assert.ok(
        metaModel[question] !== undefined && metaModel[question] !== null,
        `"${domainId}" meta-model missing answer for "${question}"`,
      );
    }
  }
});

test("[ARCH-P2-3] domain meta-model answers are non-trivial", () => {
  const domains = DomainBaselineCatalog.getAllDomainIds();
  for (const domainId of domains) {
    const metaModel = DomainMetaModelRegistry.get(domainId);
    assert.ok(
      metaModel.coreEntities.length > 0,
      `"${domainId}" must define at least one core entity`,
    );
    assert.ok(
      metaModel.workflows.length > 0,
      `"${domainId}" must define at least one workflow`,
    );
    assert.ok(
      metaModel.evalMetrics.length > 0,
      `"${domainId}" must define at least one eval metric`,
    );
  }
});
```

---

# Part IV — System Engineering Defect Regression Testing (v2.0 original Part III retained, v3.0 numbering updated)

> Part III addresses "Architecture Design-Implementation Gaps".
> Part IV addresses "**Regression Protection for System Engineering Defects**" — based on engineering defects found in architecture review v4.1 (Redis error handling, concurrent races, silent task drops, etc.), defining corresponding regression testing specifications.
>
> **v3.0 Changes**: Migrated from v2.0 Part III (§24-§30) to Part IV (§29-§34), numbering updated, content retained. SYS-* defect IDs unchanged.

---

## 29. P0 Blocker-Level Engineering Defect Test Specification

> Corresponds to v2.0 §25.

### 29.1 [SYS-REL-2.1] Redis Error Handler Silently Swallows Errors

**Defect**: In `distributed-lock/redis-lock-adapter.ts`, `queue/redis-queue-adapter.ts`, `ingress/redis-rate-limiter.ts`, and `cache/stores/redis-cache-store.ts`, `this.redis.on("error", () => {})` silently swallows all Redis errors.

**Test Type**: Unit + Integration

**Test Objective**: Redis connection errors must (1) be logged to StructuredLogger, (2) update health status flag, (3) increment Prometheus counter.

```typescript
test("[SYS-REL-2.1] Redis lock adapter logs error and marks unhealthy on connection failure", () => {
  const logs: string[] = [];
  const mockLogger = {
    error(msg: string) {
      logs.push(msg);
    },
  };
  const mockRedis = new EventEmitter();

  const adapter = new RedisLockAdapter({
    redis: mockRedis,
    logger: mockLogger,
  });

  mockRedis.emit("error", new Error("ECONNREFUSED"));

  assert.ok(logs.length > 0, "Error must be logged");
  assert.ok(
    logs[0]?.includes("ECONNREFUSED"),
    "Error message must be preserved",
  );
  assert.equal(
    adapter.isHealthy(),
    false,
    "Health flag must be false after error",
  );
});
```

**Covered Files** (one test group per file):

| File                                                       | Test File                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `execution/distributed-lock/redis-lock-adapter.ts`         | `tests/unit/platform/five-plane-execution/redis-lock-error.test.ts`            |
| `execution/queue/redis-queue-adapter.ts`                   | `tests/unit/platform/five-plane-execution/redis-queue-error.test.ts`           |
| `interface/ingress/redis-rate-limiter.ts`                   | `tests/unit/platform/five-plane-interface/redis-rate-limiter-error.test.ts`    |
| `shared/cache/stores/redis-cache-store.ts`                 | `tests/unit/platform/shared/redis-cache-error.test.ts`             |

### 29.2 [SYS-REL-2.3] DLQ Pure In-Memory, Lost on Restart

**Defect**: `state-evidence/dlq/index.ts` uses `Map<string, DeadLetterRecord>` to store dead letters, all lost after process restart.

**Test Type**: Integration

```typescript
test("[SYS-REL-2.3] DLQ records survive service reconstruction", async () => {
  const db = await createTestDb();

  const dlq1 = new DlqService({ db });
  await dlq1.enqueue({
    eventId: "evt-001",
    eventType: "task:status_changed",
    payload: { taskId: "t-1" },
    reason: "consumer_timeout",
  });
  assert.equal(await dlq1.count(), 1);

  const dlq2 = new DlqService({ db });
  assert.equal(await dlq2.count(), 1, "Records must persist across instances");

  const records = await dlq2.list({ limit: 10 });
  assert.equal(records[0]?.eventId, "evt-001");
});
```

### 29.3 [SYS-REL-2.4] Redis Queue Silently Drops Tasks

**Defect**: 5 critical enqueue operations in `execution/queue/redis-queue-adapter.ts` use `.catch(() => {})`.

**Test Type**: Unit

```typescript
test("[SYS-REL-2.4] Redis queue enqueue propagates write failure", async () => {
  const mockRedis = {
    async hmset() {
      throw new Error("READONLY You can't write against a read only replica");
    },
    async zadd() {
      throw new Error("READONLY");
    },
  };

  const queue = new RedisQueueAdapter({ redis: mockRedis });

  await assert.rejects(
    () => queue.enqueue({ type: "task:execute", payload: { taskId: "t-1" } }),
    { message: /READONLY/ },
    "Enqueue must propagate Redis write failure",
  );
});
```

### 29.4 [SYS-DEPLOY-6.3] Dockerfile CMD Path Does Not Exist

**Defect**: Dockerfile line 46 CMD references a non-existent path.

**Test Type**: CI Build Verification

```typescript
test("[SYS-DEPLOY-6.3] Dockerfile CMD entrypoint exists after build", () => {
  const dockerfilePath = path.resolve("Dockerfile");
  const content = readFileSync(dockerfilePath, "utf8");

  const cmdMatch = content.match(/CMD\s+\["node"[^]]*?"(dist\/[^"]+)"/);
  assert.ok(cmdMatch, "Dockerfile must have a CMD with a dist/ path");

  const entrypoint = cmdMatch[1];
  assert.ok(
    existsSync(path.resolve(entrypoint)),
    `CMD entrypoint "${entrypoint}" must exist after build`,
  );
});
```

## 30. P1 Critical Defect Test Specification

### 30.1 [SYS-REL-2.2] Redis Lock TOCTOU Race Condition

**Defect**: `distributed-lock/redis-lock-adapter.ts` `extendAsync()` uses non-atomic GET+SET, and `forceStealAsync()` uses non-atomic DEL+SET. Under concurrent scenarios, two processes can hold the same lock simultaneously.

**Test Type**: Integration (Concurrency)

```typescript
test("[SYS-REL-2.2] concurrent extendAsync on same lock grants only one", async () => {
  const lock = createRedisLockAdapter();
  await lock.acquireAsync({ lockKey: "shared", owner: "w-1", ttlMs: 10000 });

  const results = await Promise.allSettled([
    lock.extendAsync({ lockKey: "shared", owner: "w-1", ttlMs: 20000 }),
    lock.extendAsync({ lockKey: "shared", owner: "w-2", ttlMs: 20000 }),
  ]);

  const succeeded = results.filter((r) => r.status === "fulfilled");
  assert.equal(succeeded.length, 1, "Exactly one extend must succeed");
});

test("[SYS-REL-2.2] concurrent forceStealAsync does not create double lock", async () => {
  const lock = createRedisLockAdapter();
  await lock.acquireAsync({ lockKey: "shared", owner: "w-1", ttlMs: 10000 });

  const results = await runConcurrentInvariant(
    async (workerId) =>
      lock.forceStealAsync({
        lockKey: "shared",
        newOwner: `w-${workerId}`,
        ttlMs: 10000,
      }),
    { concurrency: 5 },
  );

  const owners = new Set(results.values.filter(Boolean).map((r) => r.owner));
  assert.equal(owners.size, 1, "Only one owner after concurrent steal");
});
```

### 30.2 [SYS-REL-2.7] Workflow State Transition Missing CAS

**Defect**: `execution/state-transition/transition-service.ts` has CAS protection for task transitions, but workflow transitions lack CAS protection.

**Test Type**: Integration (Concurrency)

```typescript
test("[SYS-REL-2.7] concurrent workflow transitions detect conflict", async () => {
  const ctx = await createIntegrationContext();
  try {
    const workflowId = await ctx.store.insertWorkflow({ status: "running" });

    const results = await Promise.allSettled([
      ctx.transitionService.transitionWorkflow(
        workflowId,
        "running",
        "completed",
      ),
      ctx.transitionService.transitionWorkflow(workflowId, "running", "failed"),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(succeeded.length, 1, "Only one transition succeeds");
    assert.equal(rejected.length, 1, "Other transition must be rejected");
  } finally {
    await ctx.cleanup();
  }
});
```

### 30.3 [SYS-REL-2.5] SLO Alert Delivery Silently Lost

**Defect**: `shared/observability/slo-alerting-service.ts` lines 172/227/281/339 use `.catch(() => {})` when alert delivery fails.

**Test Type**: Unit

```typescript
test("[SYS-REL-2.5] PagerDuty delivery failure logs error and increments counter", async () => {
  const logs: string[] = [];
  const counters: Record<string, number> = {};
  const mockFetch = async () => {
    throw new Error("ETIMEDOUT");
  };
  const mockLogger = {
    error(msg: string) {
      logs.push(msg);
    },
  };
  const mockMetrics = {
    inc(name: string) {
      counters[name] = (counters[name] ?? 0) + 1;
    },
  };

  const service = new SloAlertingService({
    fetchImpl: mockFetch,
    logger: mockLogger,
    metrics: mockMetrics,
  });

  await service.sendPagerDutyAlert({ severity: "critical", summary: "test" });

  assert.ok(logs.length > 0, "Delivery failure must be logged");
  assert.equal(counters["alert_delivery_failures_total"], 1);
});
```

### 30.4 [SYS-REL-2.6] Outbox Not Integrated Into Critical Write Path

**Defect**: `shared/outbox/outbox-service.ts` complete implementation exists, but `transition-service.ts` task state transitions write directly to event table without going through Outbox.

**Test Type**: Integration

```typescript
test("[SYS-REL-2.6] task state transition writes outbox entry in same transaction", async () => {
  const ctx = await createIntegrationContext();
  try {
    const taskId = await ctx.store.insertTask(
      createMinimalTask({ status: "queued" }),
    );

    await ctx.transitionService.applyTaskTransition(
      taskId,
      "queued",
      "in_progress",
    );

    const outboxEntries = await ctx.db.all(
      "SELECT * FROM outbox WHERE entity_id = ? AND entity_type = 'task'",
      [taskId],
    );
    assert.ok(
      outboxEntries.length > 0,
      "Outbox entry must exist after transition",
    );
    assert.equal(outboxEntries[0].event_type, "task:status_changed");
  } finally {
    await ctx.cleanup();
  }
});
```

### 30.5 [SYS-REL-2.8] Session Dual Storage Non-Atomic Write

**Defect**: `state-evidence/truth/session-dual-storage.ts` crash between two `appendFileSync` calls causes inconsistency.

**Test Type**: Integration (Fault Injection)

```typescript
test("[SYS-REL-2.8] dual storage detects and repairs partial write", async () => {
  const workspace = createTempWorkspace("aa-dual-storage-");
  try {
    const storage = new SessionDualStorage({ basePath: workspace });

    await storage.append({ sessionId: "s-1", event: { type: "step_started" } });

    const sessionFile = path.join(workspace, "sessions", "s-1.jsonl");
    const taskIndexFile = path.join(workspace, "task-index", "s-1.jsonl");
    const sessionLines = readFileSync(sessionFile, "utf8").trim().split("\n");
    const indexLines = readFileSync(taskIndexFile, "utf8").trim().split("\n");

    assert.equal(
      sessionLines.length,
      indexLines.length,
      "Session file and task index must have same line count",
    );
  } finally {
    cleanupPath(workspace);
  }
});
```

### 30.6 [SYS-PERF-3.1] StructuredLogger Synchronous I/O Blocks Event Loop

**Defect**: `shared/observability/structured-logger.ts:295` each log call uses `appendFileSync` which blocks the event loop.

**Test Type**: Performance / Unit

```typescript
test("[SYS-PERF-3.1] structured logger write does not block event loop > 1ms", async () => {
  const workspace = createTempWorkspace("aa-logger-");
  try {
    const logger = new StructuredLogger({
      filePath: path.join(workspace, "test.log"),
    });
    const iterations = 100;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      logger.info(`test message ${i}`);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    assert.ok(
      avgMs < 1,
      `Average log write ${avgMs.toFixed(3)}ms must be < 1ms`,
    );
  } finally {
    cleanupPath(workspace);
  }
});
```

### 30.7 [SYS-OBS-5.3] Alertmanager Receiver Validation

**Defect**: `deploy/prometheus/alertmanager.yml` all three receivers point to the same internal webhook.

**Test Type**: Golden / Config Validation

```typescript
test("[SYS-OBS-5.3] alertmanager receivers have distinct endpoints", () => {
  const content = readFileSync("deploy/prometheus/alertmanager.yml", "utf8");
  const config = parseYaml(content);

  const urls = config.receivers.map(
    (r: any) =>
      r.webhook_configs?.[0]?.url ??
      r.pagerduty_configs?.[0]?.service_key ??
      "none",
  );
  const uniqueUrls = new Set(urls);

  assert.ok(
    uniqueUrls.size >= config.receivers.length,
    `Expected ${config.receivers.length} distinct receiver endpoints, got ${uniqueUrls.size}`,
  );
});
```

### 30.8 [SYS-DEPLOY-6.1] Terraform Remote Backend Validation

**Defect**: `deploy/terraform/main.tf` has no `backend {}` block, state file stored locally.

**Test Type**: Config Validation

```typescript
test("[SYS-DEPLOY-6.1] terraform main.tf has remote backend configured", () => {
  const content = readFileSync("deploy/terraform/main.tf", "utf8");
  assert.ok(
    content.includes("backend "),
    "main.tf must contain a backend block for remote state",
  );
  assert.ok(!content.includes('backend "local"'), "Backend must not be local");
});
```

---

## 31. P2 Important Defect Test Specification

### 31.1 [SYS-ARCH-1.1] Five-Plane Cross-Plane Import Guard

**Defect**: 394 cross-plane import violations (e.g., state-evidence imports execution).

**Test Type**: Static Analysis (Architectural)

```typescript
test("[SYS-ARCH-1.1] no cross-plane imports from state-evidence to execution", () => {
  const stateEvidenceFiles = globSync("src/platform/five-plane-state-evidence/**/*.ts");
  for (const file of stateEvidenceFiles) {
    const content = readFileSync(file, "utf8");
    assert.ok(
      !content.includes('from "') ||
        !content.match(/from\s+"[^"]*\/execution\//),
      `${file} must not import from execution plane`,
    );
  }
});

test("[SYS-ARCH-1.1] no cross-plane imports from control-plane to state-evidence", () => {
  const controlPlaneFiles = globSync("src/platform/five-plane-control-plane/**/*.ts");
  for (const file of controlPlaneFiles) {
    const content = readFileSync(file, "utf8");
    assert.ok(
      !content.match(/from\s+"[^"]*\/state-evidence\//),
      `${file} must not import from state-evidence plane`,
    );
  }
});
```

**Prohibited Import Directions** (tests must cover all):

| Source Plane    | Prohibited Import Targets                       |
| --------------- | ---------------------------------------------- |
| state-evidence  | execution, control-plane                       |
| control-plane   | state-evidence (direct), execution (direct)    |
| interface       | only allowed to import shared/, contracts/     |
| orchestration   | execution (direct, skipping shared adapters)  |

### 31.2 [SYS-OBS-5.1] Critical Path console.* Disabled

**Defect**: 37 critical path locations use `console.*` bypassing StructuredLogger.

**Test Type**: Static Analysis / Lint

```typescript
test("[SYS-OBS-5.1] OAPEFLIR files do not use console.* directly", () => {
  const oapeflirFiles = globSync("src/platform/five-plane-orchestration/oapeflir/**/*.ts");
  for (const file of oapeflirFiles) {
    const content = readFileSync(file, "utf8");
    const consoleMatches = content.match(/console\.(log|warn|error|info)\(/g);
    assert.equal(
      consoleMatches?.length ?? 0,
      0,
      `${file} has ${consoleMatches?.length} console.* calls — use StructuredLogger`,
    );
  }
});

test("[SYS-OBS-5.1] CDC replication uses StructuredLogger", () => {
  const cdcFile = "src/scale-ecosystem/multi-region/cdc-replication-service.ts";
  const content = readFileSync(cdcFile, "utf8");
  assert.ok(
    !content.match(/console\.(log|warn|error)\(/),
    "cdc-replication-service must use StructuredLogger",
  );
});
```

### 31.3 [SYS-OBS-5.2] Prometheus Alert Rules Completeness

**Defect**: Only 3 Prometheus alert rules, missing critical alerts for DB, Redis, event loop, queue, etc.

**Test Type**: Config Validation

```typescript
test("[SYS-OBS-5.2] prometheus rules cover minimum required alert types", () => {
  const content = readFileSync(
    "deploy/prometheus/rules/automatic-agent.yml",
    "utf8",
  );
  const config = parseYaml(content);
  const alertNames = config.groups
    .flatMap((g: any) => g.rules)
    .map((r: any) => r.alert);

  const required = [
    "AutomaticAgentHighErrorRate",
    "AutomaticAgentTaskFailureRate",
    "AutomaticAgentMemoryPressure",
    "AutomaticAgentRedisDisconnected",
    "AutomaticAgentEventLoopLag",
    "AutomaticAgentQueueDepthHigh",
    "AutomaticAgentDiskUsageHigh",
    "AutomaticAgentWorkerHeartbeatTimeout",
  ];

  for (const name of required) {
    assert.ok(alertNames.includes(name), `Missing required alert: ${name}`);
  }
});
```

### 31.4 [SYS-PERF-3.2] Redis KEYS Command Prohibited

**Defect**: `distributed-lock/redis-lock-adapter.ts:236` uses `redis.keys("lock:*")` O(n) blocking.

**Test Type**: Unit / Static Analysis

```typescript
test("[SYS-PERF-3.2] redis lock adapter uses SCAN instead of KEYS", () => {
  const content = readFileSync(
    "src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts",
    "utf8",
  );
  assert.ok(!content.includes(".keys("), "Must use SCAN, not KEYS command");
  assert.ok(
    content.includes(".scan(") || content.includes("scanStream("),
    "Must use SCAN or scanStream for key iteration",
  );
});
```

### 31.5 [SYS-PERF-3.4] Unbounded Map Memory Guard

**Defect**: 20+ locations use `Map` with only additions, no deletions, causing memory leaks during long-running operations.

**Test Type**: Unit (Stress)

```typescript
test("[SYS-PERF-3.4] anomaly detection metricBuffer has size limit", () => {
  const service = new AnomalyDetectionService();
  for (let i = 0; i < 100_000; i++) {
    service.ingestMetric({
      name: `metric-${i}`,
      value: Math.random(),
      timestamp: Date.now(),
    });
  }
  const bufferSize = service.getMetricBufferSize();
  assert.ok(
    bufferSize <= 10_000,
    `Buffer size ${bufferSize} exceeds limit — must have eviction policy`,
  );
});
```

### 31.6 [SYS-SEC-4.2] Path Traversal Consistency

**Defect**: `knowledge-snapshot-store.ts:29` directly `readFileSync(this.snapshotPath)` without sandbox check.

**Test Type**: Security Unit

```typescript
test("[SYS-SEC-4.2] knowledge snapshot store rejects path traversal", () => {
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "../../etc/passwd" }),
    { message: /sandbox|path|denied/i },
    "Must reject paths outside sandbox root",
  );

  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "/etc/shadow" }),
    { message: /sandbox|path|denied/i },
    "Must reject absolute paths outside sandbox",
  );
});
```

### 31.7 [SYS-SEC-4.1] Environment Variable Startup Validation Completeness

**Defect**: Plugin/security related `AA_*` environment variables not in Zod startup validation scope.

**Test Type**: Unit

```typescript
test("[SYS-SEC-4.1] startup env schema validates plugin sandbox root", async () => {
  await withEnv({ AA_PLUGIN_SANDBOX_ROOT: "" }, () => {
    assert.throws(
      () => validateStartupEnv(),
      { message: /AA_PLUGIN_SANDBOX_ROOT/i },
      "Empty sandbox root must be rejected at startup",
    );
  });
});

test("[SYS-SEC-4.1] startup env schema validates all critical AA_ vars", () => {
  const schema = getStartupEnvSchema();
  const requiredKeys = Object.keys(schema.shape);

  const criticalVars = [
    "AA_STORAGE_DRIVER",
    "AA_API_HOST",
    "AA_API_PORT",
    "AA_PLUGIN_SANDBOX_ROOT",
    "AA_LOG_LEVEL",
  ];

  for (const v of criticalVars) {
    assert.ok(requiredKeys.includes(v), `${v} must be in startup env schema`);
  }
});
```

---

## 32. Architectural Invariant Automated Guard Tests

> Corresponds to v2.0 §28.

### 32.1 Purpose

Convert structural issues found in architecture review into **continuously running automated guard tests** to prevent architecture decay recurrence.

### 32.2 Guard Test Checklist

| Guard Item                     | Test File                                                     | Frequency   |
| ------------------------------ | ------------------------------------------------------------- | ------------ |
| Five-plane import isolation    | `tests/unit/platform/contracts/plane-isolation.test.ts`         | Every CI    |
| console.* disabled (non-SDK/CLI) | `tests/unit/platform/contracts/no-console-in-runtime.test.ts` | Every CI    |
| `as any` count upper bound     | `tests/unit/platform/contracts/type-safety-bounds.test.ts`     | Every CI    |
| Redis KEYS command prohibited   | `tests/unit/platform/contracts/no-redis-keys.test.ts`          | Every CI    |
| No duplicate route registration | `tests/unit/platform/contracts/no-duplicate-routes.test.ts`    | Every CI    |
| Zod boundary validation coverage | `tests/unit/platform/contracts/zod-boundary-validation.test.ts`| Every CI    |
| Stub file count not growing     | `tests/unit/platform/contracts/stub-count-ratchet.test.ts`      | Every CI    |
| Dockerfile CMD path valid      | `tests/integration/deploy/dockerfile-entrypoint.test.ts`       | Every CI    |

### 32.3 Zod Boundary Validation Coverage Guard

```typescript
test("[SYS-QUAL-7.3] API route handlers call schema.parse on request body", () => {
  const routeFiles = globSync(
    "src/platform/five-plane-interface/api/http-server/*-routes.ts",
  );
  let violations = 0;

  for (const file of routeFiles) {
    const content = readFileSync(file, "utf8");
    const handlerCount = (content.match(/router\.(post|put|patch)\(/g) ?? [])
      .length;
    const parseCount = (content.match(/\.parse\(|\.safeParse\(/g) ?? []).length;

    if (handlerCount > 0 && parseCount === 0) {
      violations++;
    }
  }

  assert.equal(
    violations,
    0,
    `${violations} route files have POST/PUT/PATCH handlers without .parse() validation`,
  );
});
```

### 32.4 Stub File Count Ratchet

```typescript
test("[SYS-QUAL-7.1] stub file count does not increase", () => {
  const allFiles = globSync("src/**/*.ts");
  let stubCount = 0;

  for (const file of allFiles) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length <= 20) stubCount++;
  }

  const MAX_STUBS = 221;
  assert.ok(
    stubCount <= MAX_STUBS,
    `Stub count ${stubCount} exceeds ratchet ${MAX_STUBS} — new stubs not allowed`,
  );
});
```

### 32.5 `as any` Count Ratchet

```typescript
test("[SYS-QUAL-7.6] as-any cast count does not increase", () => {
  const files = globSync("src/**/*.ts");
  let total = 0;

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const matches = content.match(/as\s+any\b/g);
    if (matches) total += matches.length;
  }

  const MAX_AS_ANY = 10;
  assert.ok(
    total <= MAX_AS_ANY,
    `as-any count ${total} exceeds ratchet ${MAX_AS_ANY}`,
  );
});
```

---

## 33. Stub File Coverage Gap Tracking

> Corresponds to v2.0 §29.

### 33.1 ops-maturity Stub File Details

`src/ops-maturity/` is a stub file hotspot, with high stub rates in the following subdirectories:

| Subdirectory              | Total Files | Current Line Coverage | Corresponding Architecture Section |
| ------------------------- | ----------- | --------------------- | ----------------------------------- |
| `platform-ops-agent/`     | 9           | 38.7%                 | §69 Platform Ops Agent             |
| `edge-runtime/`           | 5           | 96.6%                 | §63 Edge Inference                  |
| `capacity-planner/`       | 5           | 94.0%                 | §68 Capacity Planning               |
| `compliance-reporter/`     | 3           | —                     | §67 Compliance Reporting            |
| `cost-optimizer/`         | 3           | —                     | §65 Cost Optimization               |
| `emergency/`              | 4           | 95.0%                 | §60 Emergency Brake                 |
| `multimodal/`             | 7           | 97.1%                 | §68B Multimodal                    |
| `workflow-debugger/`       | 5           | 99.5%                 | §62 Workflow Debugger               |
| `explainability/`          | 2           | —                     | §59 Explainability                  |

### 33.2 Stub File Exit Conditions

A stub file is considered "implemented" when:

| Condition       | Standard                                      |
| --------------- | --------------------------------------------- |
| Lines of code   | >= 50 non-empty non-comment lines of code    |
| Class methods   | >= 3 non-empty method bodies                  |
| Test coverage   | Branch coverage >= 60%                       |
| Mutation score  | Mutation score >= 50%                         |
| External caller | At least 1 non-test file imports it         |

---

## 34. Test Gap and Coverage Status Summary

> Corresponds to v2.0 §30, v4.0 fully updated based on codebase measured data.

### 34.1 Source Directory to Test File Count Mapping (v4.0 Measured)

| Source Directory      | Source Files | Unit Tests | Integration Tests | Total    | Ratio   |
| --------------------- | ------------ | ---------- | ----------------- | -------- | ------- |
| `src/platform/`       | 926          | 902        | 269               | 1,171    | 1.26    |
| `src/scale-ecosystem/`| 78           | 68         | 10                | 78       | 1.00    |
| `src/domains/`        | 55           | 55         | 17                | 72       | 1.31    |
| `src/ops-maturity/`   | 97           | 103        | 17                | 120      | 1.24    |
| `src/interaction/`     | 44           | 47         | 3                 | 50       | 1.14    |
| `src/org-governance/`  | 44           | 42         | 3                 | 45       | 1.02    |
| `src/sdk/`            | 96           | 65         | 39                | 104      | 1.08    |
| `src/plugins/`         | 25           | 27         | 0                 | 27       | 1.08    |
| `src/core/`           | 8            | 7          | 0                 | 7        | 0.88    |
| `src/apps/`           | 4            | 4          | 0                 | 4        | 1.00    |
| **Total**             | **1,387**    | **1,398**  | **358**           | **1,803**| **1.30**|

### 34.2 E2E Test File List (17 Files)

| File                                | Covered Scenario              |
| ----------------------------------- | ----------------------------- |
| `task-lifecycle.test.ts`            | Full task lifecycle           |
| `oapeflir-full-loop.test.ts`        | OAPEFLIR complete loop        |
| `multi-step-workflow.test.ts`       | Multi-step workflow           |
| `approval-event-flow.test.ts`       | Approval event flow           |
| `gateway-webhook-flow.test.ts`      | Gateway webhook flow          |
| `streaming-response.test.ts`        | Streaming response            |
| `session-memory-flow.test.ts`       | Session memory flow           |
| `operator-takeover.test.ts`         | Operator takeover             |
| `lease-recovery.test.ts`            | Lease recovery                |
| `error-propagation.test.ts`         | Error propagation             |
| `delegation-chain-flow.test.ts`     | Delegation chain flow         |
| `domain-onboarding-flow.test.ts`   | Domain onboarding flow        |
| `execution-flow.test.ts`            | Execution flow                |
| `harness-loop-e2e.test.ts`          | Harness loop end-to-end       |
| `multi-region.test.ts`              | Multi-region                  |
| `multi-step-task-execution.test.ts` | Multi-step task execution     |
| `rollback-scenario.test.ts`        | Rollback scenario             |

### 34.3 Golden Test File List (11 Files)

| File                           | Guarded Object              |
| ------------------------------ | -------------------------- |
| `openapi-document.test.ts`     | OpenAPI document structure |
| `cli-help-text.test.ts`       | CLI help text              |
| `diagnostics-bundle.test.ts`  | Diagnostics bundle structure |
| `prompt-assembly.test.ts`      | Prompt assembly + cache key |
| `session-summary.test.ts`      | Session summary structure  |
| `release-plan-output.test.ts`  | Release plan Markdown      |
| `workflow-validation.test.ts`  | Workflow validation        |
| `phase1a-golden-tasks.test.ts` | Phase 1a golden task suite |
| `domain-baseline.test.ts`     | Domain baseline snapshot   |
| `config-schema.test.ts`        | Config schema snapshot     |
| `harness-protocol.test.ts`    | Harness protocol snapshot  |

### 34.4 Performance Test File List (10 Files)

| File                                    | Benchmark Object               |
| --------------------------------------- | ------------------------------ |
| `oapeflir-perf.test.ts`                 | OAPEFLIR loop throughput       |
| `knowledge-perf.test.ts`                | Knowledge retrieval latency    |
| `planning-perf.test.ts`                  | Planning generation latency    |
| `feedback-perf.test.ts`                  | Feedback processing throughput |
| `plugin-perf.test.ts`                   | Plugin execution latency       |
| `handoff-perf.test.ts`                  | Handoff process latency        |
| `execution-performance.test.ts`          | Execution engine throughput    |
| `harness-component-performance.test.ts` | Harness component latency      |
| `harness-loop-performance.test.ts`      | Harness loop throughput        |
| `prompt-engine-performance.test.ts`     | Prompt engine latency          |

### 34.5 Current Coverage Blind Spots Top-5 (v4.0 Updated)

| Rank | Blind Spot                             | Current Status                                                                                       | Recommendation                                      |
| ---- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1    | **Global line coverage** (c8 measured 0.75%) | Only 1,384 of 182,253 lines covered (6 SQLite delegating files), 977 source files at 0%           | Configure test framework to correctly collect coverage, establish real baseline |
| 2    | **E1-E6 exception event classification** (ARCH-P0-1) | Completely missing, no unified exception classification system                           | After implementation, add classification completeness + routing tests (§25.1)    |
| 3    | **SEV1-SEV4 unified severity** (ARCH-P0-2) | Code has 3 incompatible systems                                                              | After unification, add mapping + degradation tests (§25.2)                |
| 4    | **STRIDE threat model** (ARCH-P0-3)     | Completely missing                                                                                   | After implementation, add 6 threat category tests (§25.3)                 |
| 5    | **Principal type / Sandbox levels** (ARCH-P1) | Only 3/6 and 3/4 implemented respectively                                                     | After completion, add type completeness + isolation verification tests (§26.1/§26.2) |

---

> **Document End (v4.0)** — This manual upgraded from v3.0 to v4.0.
>
> **Part I** Guarantee: Tests are not few, quality is not poor, no obvious omissions.
> **Part II** Guarantee: System critical design semantics (state machine, events, concurrency, phase contracts, Harness semantic mapping) are all covered.
> **Part III** Guarantee: The **13 architecture design-implementation gaps** (3 P0 + 7 P1 + 3 P2) found by architecture review v8.0 have corresponding test specifications; after implementation, there will be no testing blind spots.
> **Part IV** Guarantee: **Engineering defects** (Redis errors, concurrent races, configuration issues, etc.) have corresponding regression test specifications; after fixing, they will not recur.
>
> **v4.0 Key Correction**: c8 measured global line coverage is only 0.75% (not the 82.4% claimed in v3.0). `.coverage-baseline.json` all values are null. Test file count (1,803) exceeds source files (1,387), but coverage collection pipeline not correctly connected — this is the highest priority fix item.
>
> Core Philosophy: **Coverage ratchet ensures quantity, mutation testing ensures quality, Traceability Matrix ensures completeness, PR Review ensures context, architectural semantics matrix ensures design contracts, architectural gap regression matrix ensures design-implementation alignment, system issue regression matrix ensures engineering defects do not recur. All seven are indispensable.**
## 1. Test Infrastructure Overview

### 1.1 Technology Stack

| Component    | Selection                                              | Version    |
| ------------ | ------------------------------------------------------ | ---------- |
| Test runner  | `node:test` (Node.js built-in)                        | Node 22+   |
| Assertions   | `node:assert/strict`                                  | Node 22+   |
| Mocking      | Hand-written mock objects + `tests/helpers/typed-factories.ts` | —     |
| Coverage     | c8 (V8 native)                                        | v11.0.0    |
| Mutation     | Stryker Mutator                                       | v9.6.1     |
| Lint         | ESLint                                                | —          |
| Typecheck    | TypeScript `tsc --noEmit`                             | —          |

### 1.2 Key Design Decisions

- **No external test framework**: No Jest / Vitest / Mocha, reduced dependencies (devDependencies only 12)
- **No external mock library**: No Sinon / testdouble, mocks created via type-safe factory functions
- **Run after build**: `npm run build:test` compiles `src/` + `tests/` → `dist/`, tests run from `dist/tests/**/*.test.js`
- **Coverage ratchet**: `.coverage-baseline.json` baseline can only increase, not decrease, enforced by CI
- **TypeScript strict mode**: `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- **ESM modules**: Compile target ES2023 + NodeNext module system, all imports must include `.js` extension

### 1.3 Current Scale

| Metric                              | Value         |
| ----------------------------------- | ------------- |
| Total source files (`src/**/*.ts`)  | **1,387**     |
| Source code lines                  | **265,020**   |
| Total test files (`tests/**/*.ts`) | **1,823**     |
| Test `.test.ts` file count          | **1,803**     |
| Test code lines                    | **439,448**   |
| Total assertions (`assert.*` calls) | **~52,480**   |
| Test/Source ratio                  | **1.30**      |
| Unit test files                    | **1,398**     |
| Integration test files             | **358**       |
| E2E test files                    | **17**        |
| Golden test files                 | **11**        |
| Performance test files             | **10**        |
| Global line coverage (c8 measured) | **0.75%**     |
| Global statement coverage (c8)     | **0.75%**     |
| Global function coverage (c8)       | **0.61%**     |
| Global branch coverage (c8)         | **0.61%**     |

> **v4.0 Changes**: Source files from 1,335 → 1,387 (+52), test files from 1,341 → 1,803 (+462), assertions from ~34,061 → ~52,480 (+18,419). E2E from 10 → 17, Performance from 7 → 10. **Major coverage correction**: v3.0 claimed global line coverage of 82.4%, but c8 full analysis this time verified it is only **0.75%** (only 1,384 of 182,253 lines covered, all in 6 `src/platform/five-plane-state-evidence/truth/sqlite/` authoritative-task-store-delegating-\*.ts files). `.coverage-baseline.json` baseline file has all null values, never actually populated. This indicates v3.0 coverage data came from incremental builds rather than full c8 analysis, corrected to measured values in this version.

---

## 2. Command Reference

```bash
# Full test (with coverage gate)
npm test

# Run tests only (without gate)
npm run test:raw

# Layered runs
npm run test:unit
npm run test:integration
npm run test:golden

# Specific files
npm run build:test && node --test "dist/tests/unit/platform/five-plane-orchestration/*.test.js"

# PostgreSQL integration tests (requires PG environment)
AA_TEST_PG_DSN="postgres://..." npm run test:pg-integration

# Performance tests
npm run test:performance

# Mutation tests
npm run test:mutation

# Coverage report
npm run coverage:report

# Update coverage baseline
npm run coverage:baseline:update

# Type check
npm run typecheck

# Operations diagnostics
npm run doctor
npm run inspect
npm run dispatch-execution
npm run worker-handshake
npm run worker-writeback
```

---

## 3. Directory Structure and Layering Rules

### 3.1 Directory Layout

```
tests/
├── unit/                       # Isolated logic tests (1,398 files)
│   ├── platform/               # Mirror of src/platform/ structure (902 files)
│   │   ├── execution/          # Execution plane (151 files)
│   │   ├── state-evidence/     # State evidence plane (164 files)
│   │   ├── control-plane/      # Control plane (117 files)
│   │   ├── orchestration/      # Orchestration plane (112 files)
│   │   ├── shared/             # Shared facilities (140 files)
│   │   ├── interface/          # Interface plane (80 files)
│   │   ├── contracts/          # Contract tests (49 files)
│   │   ├── model-gateway/      # Model gateway (34 files)
│   │   ├── prompt-engine/      # Prompt engine (22 files)
│   │   └── compliance/         # Compliance (11 files)
│   ├── ops-maturity/           # Operations maturity (103 files)
│   ├── scale-ecosystem/        # Scale ecosystem (70 files)
│   ├── sdk/                    # SDK (65 files)
│   ├── domains/                # Domains (55 files)
│   ├── runtime/                # Runtime cross tests (48 files)
│   ├── interaction/            # Interaction (47 files)
│   ├── org-governance/         # Organization governance (42 files)
│   ├── plugins/                # Plugins (24 files)
│   ├── core/                   # Core (13 files)
│   ├── apps/                   # Applications (6 files)
│   ├── deploy/                 # Deployment config guard (4 files)
│   └── docs/                   # Documentation guard (2 files)
├── integration/                # Cross-service/runtime tests (358 files)
│   ├── platform/               # Platform integration (269 files, includes security/ subdirectory)
│   ├── sdk/                    # SDK/CLI integration (35 files)
│   ├── domains/                # Domains (17 files)
│   ├── ops-maturity/           # Operations maturity (17 files)
│   ├── scale-ecosystem/        # Scale ecosystem (7 files)
│   ├── interaction/            # Interaction (3 files)
│   ├── org-governance/         # Organization governance (2 files)
│   ├── stability/              # Stability (2 files)
│   ├── workflow/               # Workflow (2 files)
│   ├── orchestration/          # Orchestration (1 file)
│   ├── deploy/                 # Deployment (1 file)
│   ├── interaction-governance/ # Interaction governance (1 file)
│   └── scale-ops/              # Scale operations (1 file)
├── golden/                     # Snapshot/Golden tests (11 files)
│   └── snapshots/              # Golden file storage
├── e2e/                        # End-to-end scenarios (17 files)
├── performance/                # Performance benchmarks (10 files)
├── helpers/                    # Shared utilities (19 files + fixtures/ subdirectory)
│   ├── typed-factories.ts      # unsafeCast / partial / mock factories
│   ├── fixtures/               # base.ts + composite.ts
│   ├── integration-context.ts  # SQLite + TaskStore integration context
│   ├── repository-harness.ts   # Repository layer DB testing
│   ├── e2e-harness.ts          # Full-stack E2E context
│   ├── golden.ts               # Snapshot assertions
│   ├── env.ts                  # Environment variable isolation
│   ├── fs.ts                   # Temporary filesystem
│   ├── concurrent-runner.ts    # Concurrent invariant verification
│   ├── process-guard.ts        # Subprocess leak detection
│   ├── api.ts                  # API integration seeding
│   ├── pg-test-helper.ts       # PostgreSQL testing
│   ├── cli.ts                  # CLI testing
│   ├── seed.ts                 # Data seeding
│   ├── test-cleanup.ts         # Singleton reset
│   ├── billing.ts              # Billing testing
│   ├── perception.ts           # Perception testing
│   └── pmf.ts                  # PMF testing
└── fixtures/                   # Migration test fixtures
```

### 3.2 Layering Rules

| Layer         | Directory          | Rule                                    | Dependencies                |
| ------------- | ------------------ | --------------------------------------- | --------------------------- |
| **Unit**      | `tests/unit/`      | Single module isolated testing, all external dependencies mocked | No DB, no network, no file I/O |
| **Integration** | `tests/integration/` | Cross-module, CLI, runtime, sandbox | SQLite in-memory, temp directories allowed |
| **Golden**    | `tests/golden/`     | Output snapshot comparison              | Can depend on real services |
| **E2E**       | `tests/e2e/`       | Complete business flow                  | Full stack, mock provider   |
| **Performance** | `tests/performance/` | Latency/throughput benchmarks          | Can use real DB             |

---

## 4. Test Writing Standards and Patterns

### 4.1 Basic Structure

This project uses **flat `test()` calls**, no `describe()` nesting. Each test file directly imports `node:test` and `node:assert/strict`.

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { MyService } from "../../../../src/platform/my-module/my-service.js";

test("MyService returns default value when input is empty", () => {
  const service = new MyService();
  const result = service.compute({});
  assert.equal(result, "default");
});

test("MyService rejects invalid arguments", () => {
  const service = new MyService();
  assert.throws(() => service.compute(null as any), {
    message: /invalid input/i,
  });
});
```

### 4.2 Naming Conventions

| Dimension | Rule                                   | Example                                                                    |
| --------- | -------------------------------------- | -------------------------------------------------------------------------- |
| Filename  | `<module-under-test>.test.ts`, kebab-case | `feedback-collector.test.ts`                                              |
| Test title | Behavior description, subject + condition + expected | `"FeedbackCollector deduplicates signals and emits learning signals"` |
| Variable names | Same camelCase as production code | `const collector = new FeedbackCollector()`                     |

### 4.3 Import Paths

All imports use **relative paths + `.js` extension** (because compiled to ESM):

```typescript
// Correct
import { FeedbackCollector } from "../../../../src/platform/feedback/feedback-collector.js";

// Wrong — missing .js extension
import { FeedbackCollector } from "../../../../src/platform/feedback/feedback-collector";
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

// Async rejection
await assert.rejects(async () => service.execute(), {
  message: /timeout/,
});

// No throw (common for Schema validation)
assert.doesNotThrow(() => schema.parse(validPayload));
```

### 4.5 Sync vs Async

- **Unit tests**: Prefer sync. Pure functions, Schema parsing, in-memory services are all sync
- **Integration tests**: Usually `async`, because involve DB/files/subprocesses
- **Principle**: If the function under test returns `Promise`, mark test function `async`; otherwise keep sync

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

**Forbidden** to use `afterEach` or global teardown — Node.js test runner has limited support, and `try/finally` is more reliable.

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

### 4.8 Security Testing Pattern

Security tests follow **denial-path regression** pattern — each test verifies one attack vector is rejected:

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

| File                     | Core Exports                                                                                                       | Purpose                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| `typed-factories.ts`     | `unsafeCast<T>()`, `partial<T>()`, `createMockCacheStore()`, `createMockCacheFacade()`, `createMockCacheMetrics()` | Type-safe mock object creation       |
| `fixtures/base.ts`       | `createMinimalTask()`, `createMinimalExecution()`, `createMinimalApproval()`                                       | Minimal valid domain records          |
| `fixtures/composite.ts`  | `createBlockedTask()`, `createApprovalRequest()`, `createCompletedTask()`, `createFailedTask()`                    | Multi-entity associated scenarios     |
| `env.ts`                 | `withEnv(overrides, fn)`, `withEnvSync(overrides, fn)`                                                             | Environment variable isolation         |
| `fs.ts`                  | `createTempWorkspace()`, `cleanupPath()`, `createFile()`, `createSymlink()`                                        | Temporary filesystem                  |
| `integration-context.ts` | `createIntegrationContext()`, `createSeededIntegrationContext()`                                                   | SQLite + TaskStore integration context |
| `repository-harness.ts`  | `createRepositoryHarness()`, `createRepositoryWithStoreHarness()`                                                  | Repository layer DB testing          |
| `e2e-harness.ts`         | `createE2EHarness()`, `createSeededE2EHarness()`                                                                   | Full-stack E2E context                |
| `golden.ts`              | `assertGolden()`, `assertGoldenContains()`, `assertGoldenMatches()`                                                | Snapshot assertions                   |
| `process-guard.ts`       | `createProcessGuard()`, `withProcessGuard()`                                                                       | Subprocess leak detection (ADR-072)    |
| `concurrent-runner.ts`   | `runConcurrentInvariant()`, `runConcurrentStateModification()`, `runCriticalSectionTest()`                         | Concurrent invariant verification     |
| `api.ts`                 | `createSeededApiContext()`                                                                                         | Full API integration seeding (DB + 12 services) |

### 5.2 `unsafeCast<T>()` and `partial<T>()`

`unsafeCast<T>()` replaces scattered `as any` casts, making them searchable and auditable:

```typescript
import { unsafeCast } from "../../../helpers/typed-factories.js";

const fakeProvider = unsafeCast<LlmProvider>({
  generate: async () => ({ text: "mock response", tokens: 10 }),
});
```

`partial<T>()` is used to construct partially-implemented interface objects (type-correct `Partial<T>`):

```typescript
import { partial } from "../../../helpers/typed-factories.js";

const config = partial<RuntimeConfig>({ maxRetries: 3, timeoutMs: 5000 });
```

### 5.3 Mock Creation Pattern

The project uniformly uses **object literals + interface type** to create mocks:

```typescript
const mockStore: CacheStore = {
  async get() {
    return { hit: false, value: null, reason: "not_found" };
  },
  async set() {
    /* no-op */
  },
  async delete() {
    /* no-op */
  },
  async clear() {
    /* no-op */
  },
};
```

**Do NOT use** `jest.fn()` / `sinon.stub()` — if you need to record calls, use closure arrays:

```typescript
const calls: string[] = [];
const mockLogger = {
  info(msg: string) {
    calls.push(msg);
  },
  error(msg: string) {
    calls.push(`ERROR: ${msg}`);
  },
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

| Scenario                    | Use                                                               |
| -------------------------- | ----------------------------------------------------------------- |
| Pure logic unit test       | Direct `new Service()` + inline mock                              |
| Repository test            | `createRepositoryHarness()`                                        |
| Cross-service integration  | `createIntegrationContext()` or `createSeededIntegrationContext()` |
| API endpoint test           | `createSeededApiContext()` → `ctx.createServer()`                 |
| E2E full flow              | `createE2EHarness()` or `createSeededE2EHarness()`               |
| Subprocess-related         | Wrap with `withProcessGuard(fn)`                                   |
| Concurrency safety         | `runConcurrentInvariant()` / `runCriticalSectionTest()`            |

---

## 6. Coverage Gate Mechanism

### 6.1 Three-Layer Architecture

```
c8 (V8 native) → generate-coverage-report.mjs → check-coverage-baseline.mjs
                                                          ↓
                                                 .coverage-baseline.json (ratchet)
```

### 6.2 c8 Configuration (`.c8rc.json`)

| Parameter   | Value                                        | Description                         |
| ---------- | -------------------------------------------- | ---------------------------------- |
| `reporter` | `["text", "html", "lcov", "json-summary"]` | Four-format output                  |
| `include`  | `["dist/src/**/*.js"]`                      | Only measure production code        |
| `exclude`  | tests, scripts, configs, node_modules        | Exclude non-production files       |
| `all`      | `true`                                       | Files not loaded by tests also counted (0% coverage) |

### 6.3 Ratchet Baseline (`.coverage-baseline.json`)

Global thresholds (v4.0 c8 measured data):

| Metric     | Current Measured | v3.0 Claimed | Description                            |
| ---------- | --------------- | ------------ | -------------------------------------- |
| Lines      | **0.75%**      | 82.4%        | Only 1,384 of 182,253 lines covered    |
| Statements | **0.75%**      | 82.4%        | Same as above                          |
| Functions  | **0.61%**      | 88.5%        | Only 6 of 983 functions covered        |
| Branches   | **0.61%**      | 80.6%        | Same as above                          |

> **v4.0 Major Correction**: `.coverage-baseline.json` currently has all null values (`directories: {}`), baseline was never truly populated. The 82.4% line coverage claimed in v3.0 was verified by c8 `all: true` full analysis to be **0.75%**. Actually covered are only 6 files in `src/platform/five-plane-state-evidence/truth/sqlite/` (1,384 lines, all 100% covered). The remaining 977 source files all have 0% coverage. This indicates v3.0 coverage data may have come from incomplete incremental builds or outdated reports.
>
> **Action Items**: (1) Run complete `npm test` + c8 full coverage analysis, (2) populate `.coverage-baseline.json` baseline, (3) enable coverage gate in CI.

**Ratchet Rules**: `check-coverage-baseline.mjs` compares current coverage with baseline:

- Any metric **below** baseline → CI fails (exit code 1)
- Any directory **not in** baseline → CI fails (untracked directory)
- After coverage **increases**, run `npm run coverage:baseline:update` → new value becomes new floor
- **Current status**: Baseline not populated, gate mechanism exists but not enforced

### 6.4 Directory-Level Baseline (v4.0 c8 measured data)

> **Note**: The following data comes from `coverage/coverage-summary.json` c8 full analysis (`all: true`). Since `.coverage-baseline.json` is not populated, actual coverage status is listed here.

**Directories with coverage** (only 1 directory has non-zero coverage):

| Directory                              | Files | Covered Files | Lines                  | Functions |
| -------------------------------------- | ----- | ------------- | ---------------------- | --------- |
| `src/platform/five-plane-state-evidence/truth/sqlite/` | 25    | 6             | 1,384/36,219 (3.82%) | 6/167     |

The 6 covered files (all 100%):

- `authoritative-task-store-delegating-governance.ts` (346 lines)
- `authoritative-task-store-delegating-engagement.ts` (345 lines)
- `authoritative-task-store-delegating-lifecycle.ts` (246 lines)
- `authoritative-task-store-delegating-base.ts` (224 lines)
- `authoritative-task-store-delegating-runtime.ts` (213 lines)
- `authoritative-task-store-delegating-core.ts` (10 lines)

**Major zero-coverage directories** (sorted by code size, Top-15):

| Directory                        | Files | Total Lines | Lines Coverage |
| -------------------------------- | ----- | ----------- | -------------- |
| `src/platform/five-plane-execution/`        | 162   | 43,202      | 0%             |
| `src/platform/shared/`           | 100   | 24,079      | 0%             |
| `src/platform/five-plane-control-plane/`    | 75    | 23,555      | 0%             |
| `src/platform/five-plane-orchestration/`    | 81    | 9,332       | 0%             |
| `src/platform/five-plane-interface/`        | 49    | 8,705       | 0%             |
| `src/scale-ecosystem/marketplace/` | 26  | 7,737       | 0%             |
| `src/sdk/cli/`                   | 78    | 6,148       | 0%             |
| `src/platform/model-gateway/`    | 17    | 5,012       | 0%             |
| `src/platform/contracts/`        | 34    | 4,041       | 0%             |
| `src/domains/registry/`          | 14    | 2,456       | 0%             |
| `src/ops-maturity/drift-detection/` | 15  | 2,271       | 0%             |
| `src/domains/governance/`        | 4     | 1,632       | 0%             |
| `src/platform/prompt-engine/`    | 9     | 1,432       | 0%             |
| `src/scale-ecosystem/feedback-loop/` | 7   | 578         | 0%             |
| `src/interaction/nl-gateway/`    | 4     | 549         | 0%             |

> **v4.0 Note**: High-coverage directories listed in v3.0 (like execution/queue 99.7%, workflow-debugger 99.5%) all show 0% in c8 full analysis. This further confirms v3.0 data source was inaccurate. True coverage improvement requires ensuring `npm run build:test` compiles all source and test files to `dist/`, then c8 collects coverage when running tests.

### 6.5 Update Process

```bash
npm test                          # Run complete tests
npm run coverage:baseline:update  # Only execute after all tests pass
git diff .coverage-baseline.json  # Confirm changes are reasonable
git add .coverage-baseline.json   # Commit new baseline
```

---

## 7. Test Coverage Assurance System

This section is the core methodology of the entire manual — answering the question **"How to ensure tests have no omissions?"** The system consists of five layers of protection, each solving different levels of omission risk.

### 7.1 Five-Layer Protection Model

```
┌─────────────────────────────────────────────────────────┐
│ Layer 5: PR Review Checklist (Human Review)            │
├─────────────────────────────────────────────────────────┤
│ Layer 4: Mutation Testing Stryker (Assertion Validity) │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Coverage Ratchet + Directory-Level Baseline    │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Traceability Matrix (Source ↔ Test Mapping)   │
├─────────────────────────────────────────────────────────┤
│ Layer 1: Layered Test Strategy (Unit/Integration/E2E) │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Layer 1: Layered Test Strategy

**Solved omission type**: Blind spots caused by improper test granularity.

Each functional point must be tested at the correct layer:

| Concern                       | Correct Test Layer              | Anti-pattern                           |
| ----------------------------- | ------------------------------- | -------------------------------------- |
| Pure function logic (parsing, validation, transformation) | Unit                            | Using E2E to test logic branches       |
| Database read/write, transactions, migrations | Integration                     | Using mock DB to hide SQL errors        |
| Multi-service collaboration, event propagation | Integration                     | Skipping collaboration tests after mocking each service individually |
| Security boundaries (sandbox, path traversal) | Integration                     | Only using Unit to test regex           |
| API contracts (HTTP status codes, response bodies) | Integration / E2E               | Only testing service layer, not HTTP layer |
| Full-process business scenarios | E2E                             | None                                   |
| Output format stability        | Golden                          | Hand-writing expected strings           |
| Concurrency safety            | Integration + concurrent-runner | Assuming thread safety after single-threaded tests |

**Execution rules**:

1. Every `src/platform/<module>/` directory must have a corresponding `tests/unit/platform/<module>/` directory
2. Every externally exposed service class must have at least 1 unit test file
3. Functions involving DB/filesystem/subprocesses must have integration tests
4. Security-related changes must have denial-path regression tests

### 7.3 Layer 2: Traceability Matrix

**Solved omission type**: Source files without corresponding test files.

Build **source file → test file** mapping to ensure every production file has corresponding tests.

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
- If a file truly doesn't need testing (pure type definitions, barrel exports), mark `N/A` + reason in matrix
- Run above script at end of each sprint, update omission list

### 7.4 Layer 3: Coverage Ratchet

**Solved omission type**: Existing tests deleted or new code not covered.

See [§6 Coverage Gate Mechanism](#6-coverage-gate-mechanism) for details. Key points:

- **Global gate**: lines/statements/functions/branches four dimensions
- **Directory-level gate**: Each `src/platform/<module>` has independent baseline
- **`all: true`**: Files not imported by any test are also counted (show as 0% coverage), preventing "no one references it so no one tests it"
- **Can only increase**: Baseline values monotonically increase via `npm run coverage:baseline:update`

**Coverage limitations**: Coverage only says "code was executed", not "behavior was verified". For example:

```typescript
test("calls the function", () => {
  myFunction(); // 100% line coverage, but 0 assertions
});
```

This is why Layer 4 is needed.

### 7.5 Layer 4: Mutation Testing

**Solved omission type**: Code executed but lacking valid assertions.

Stryker injects **mutants** into code, for example:

- `>` changed to `>=`
- `true` changed to `false`
- Delete entire statement
- String `"error"` changed to `""`

If mutant survives (test still passes after injection), the test doesn't effectively detect this logic.

See [§11 Mutation Testing (Stryker)](#11-mutation-testing-stryker) for details. Thresholds:

- **break = 50%**: Below this CI directly fails
- **low = 60%**: Yellow warning
- **high = 80%**: Green target

**Complementary relationship of mutation testing and coverage**:

| Scenario           | Line Coverage | Mutation Score | Problem       |
| ------------------ | ------------ | ------------- | ------------- |
| Execute with assertions | High       | High          | None          |
| Execute without assertions | High    | **Low**       | Missing assertions |
| No execution       | **Low**      | Low           | Missing tests |
| Dead code          | Low          | Low           | Should remove |

### 7.6 Layer 5: PR Review Checklist

**Solved omission type**: Logic omissions that automated tools cannot detect.

Before each PR merges, reviewer checks following checklist:

- [ ] Does each newly added/modified public function have corresponding tests?
- [ ] Are both normal paths **and** error paths covered?
- [ ] Are boundary conditions tested (empty arrays, null, 0, MAX_INT, timeout)?
- [ ] Do security changes have denial-path regression?
- [ ] Do async functions test reject/error paths?
- [ ] Do config changes have corresponding config validation tests?
- [ ] Has coverage improved or stayed the same (not decreased)?
- [ ] Has mutation test score improved or stayed the same?

### 7.7 Omission Type Classification and Corresponding Protection

| Omission Type        | Description                          | Detection Layer                                   |
| -------------------- | ------------------------------------ | ------------------------------------------------ |
| **File-level omission** | Entire source file has no tests       | Layer 2 (Matrix) + Layer 3 (`all: true`)          |
| **Function-level omission** |某个 exported function has no tests | Layer 3 (function coverage) + Layer 5 (Review)  |
| **Branch-level omission** | Some if/else/switch branch uncovered | Layer 3 (branch coverage) + Layer 4 (Stryker)    |
| **Assertion-level omission** | Code executed but no result verified | Layer 4 (Stryker mutant survived)               |
| **Scenario-level omission** | Missing specific business scenario tests | Layer 5 (Review)                              |
| **Boundary condition omission** | Empty input/extreme/concurrency uncovered | Layer 4 + Layer 5                          |
| **Regression omission** | Bug fix without adding regression test | Layer 5 (Review) + Layer 3 (ratchet rollback) |
| **Security omission**   | Attack vectors untested               | Layer 1 (denial-path spec) + Layer 5            |

### 7.8 Test Completion Priority Sorting Method

When omissions are found, prioritize completion in this order:

```
P0 — Security boundaries untested (sandbox escape, path traversal, injection attack)
P1 — Core orchestrator/service has no tests (0% coverage)
P2 — Existing tests but branch coverage < 60%
P3 — Existing tests but mutation score < 50% (insufficient assertions)
P4 — Helper functions / utility classes lacking boundary condition tests
P5 — Type definition Schema validation tests
```

### 7.9 Continuous Assurance Process

```
Development phase → Write code + Write tests (TDD or Code-then-Test)
           ↓
Local verification → npm test (coverage + gate)
           ↓
PR submission → CI auto-runs: lint → typecheck → test → coverage:gate
           ↓
PR Review → Manual Checklist (§7.6)
           ↓
Merge to main → Stryker mutation testing (triggered by push to main)
           ↓
Sprint end → Run Traceability Matrix script, update omission list
```

---

## 8. Security Regression Testing Standards

### 8.1 Denial-Path Regression Methodology

Core principle of security testing: **One test per attack vector, assert rejection status + specific error code**.

```
Attack surface identification → Build malicious input → Call interface under test → Assert blocked/denied + error code
```

### 8.2 Attack Surface Classification

| Attack Surface    | Test Target                    | Typical Attack Vectors                                        |
| ---------------- | ----------------------------- | ------------------------------------------------------------ |
| **Path traversal** | Sandbox filesystem isolation | `../`, symlink, double-encoded `%2f`, null-byte `\x00`      |
| **Command injection** | Command executor parameter filtering | `;`, `$()`, backtick, `&&`, `\\|\\|`, `\\|`, `${VAR}` |
| **Privilege bypass** | Execution-level tool authorization | Modify allowedToolsJson, malformed allowlist                |
| **Script escape** | Interpreter path restriction | Script path outside workspace, absolute path pointing external |
| **Input validation** | Schema / config validation | Oversized string, type mismatch, missing required fields    |
| **Concurrency attack** | Lock and transaction isolation | Approve same request simultaneously, concurrent write to same resource |

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

### 8.4 Security Test Naming Convention

Title must clearly state **who rejected what**:

```
✓ "command executor blocks symlink cwd traversal before spawning the process"
✓ "command executor blocks null-byte injection in path argument"
✓ "sandbox policy denies write outside workspace root"
✗ "security test 1"
✗ "test injection"
```

### 8.5 Scenes Security Tests Must Cover

For each component involving security boundaries, cover at least:

1. **Normal legitimate request** — Confirm happy path works (at least 1 positive test)
2. **Path escape** — Cover at least three vectors: `../`, symlink, absolute path
3. **Input injection** — Cover at least two vectors: shell metachar, null-byte
4. **Insufficient privileges** — Unauthorized tool, wrong domain/role
5. **Malformed input** — malformed JSON, type mismatch, null values
6. **Fail-close** — When security check logic itself errors, default to rejection rather than allow

---

## 9. Golden / Snapshot Testing

### 9.1 Applicable Scenarios

Golden tests are suitable for scenarios where **output format needs stability**:

- CLI output formats (`inspect`, `doctor`, `dispatch-execution` command outputs)
- API response body structure
- Config file generation results
- Log format

### 9.2 Working Principle

```
First run (UPDATE_GOLDEN=1) → Write actual output to tests/golden/snapshots/<name>.golden
Subsequent runs → Compare actual output with .golden file
  Match → Test passes
  No match → Test fails, prompt to run UPDATE_GOLDEN=1 to update
```

### 9.3 Usage Method

```typescript
import test from "node:test";
import { assertGolden } from "../../helpers/golden.js";

test("inspect output matches golden snapshot", () => {
  const output = inspectService.generateReport();
  assertGolden("inspect-report-v1", output);
});
```

Three assertion APIs:

| API                              | Purpose            |
| -------------------------------- | ------------------ |
| `assertGolden(name, actual)`      | JSON exact match   |
| `assertGoldenContains(name, substring)` | Contains substring |
| `assertGoldenMatches(name, regex)` | Regex match       |

### 9.4 Updating Snapshots

```bash
UPDATE_GOLDEN=1 npm run test:golden
git diff tests/golden/snapshots/       # Review changes
git add tests/golden/snapshots/
```

### 9.5 Golden Test Notes

- **Don't** include timestamps, random IDs and other unstable fields in golden files — normalize first then snapshot
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

  assert.ok(
    opsPerSec > 1000,
    `Expected > 1000 ops/sec, got ${opsPerSec.toFixed(0)}`,
  );
});
```

### 10.4 Performance Test Principles

- **Isolated execution**: `npm run test:performance` runs independently from main test suite, avoids interfering with coverage
- **Absolute thresholds**: Assert absolute performance metrics (e.g., >1000 ops/sec), not relative changes
- **Warmup**: Execute a few warmup iterations before timing, exclude JIT compilation effects
- **Median of multiple runs**: For latency-sensitive tests, take median of multiple runs to reduce variance
- **Optional in CI**: Performance tests run as optional job in CI, don't block merge (due to high machine variance)

---

## 11. Mutation Testing (Stryker)

### 11.1 Concept

Mutation testing answers the question coverage cannot answer: **Are test assertions truly effective?**

Stryker injects tiny mutations (mutants) into source code, then runs test suite. If test still passes (mutant survived), it means no assertion can detect this code change — i.e., assertion deficiency exists.

### 11.2 Configuration (`stryker.config.mjs`)

| Parameter           | Value                           | Description                       |
| ------------------- | ------------------------------- | -------------------------------- |
| `testRunner`        | `"command"`                    | Run via `npm run test:unit`      |
| `mutate`            | `src/platform/**/*.ts`         | Mutation scope: platform business code |
| Exclusions          | `.d.ts`, `index.ts`, `types/**` | Don't mutate type definitions and barrels |
| `thresholds.break`  | 50                              | Below 50% → CI fails             |
| `thresholds.low`    | 60                              | Below 60% → Yellow warning        |
| `thresholds.high`   | 80                              | Above 80% → Green                |
| `coverageAnalysis`   | `"perTest"`                    | Each test analyzed separately    |

### 11.3 Running

```bash
npm run test:mutation         # Local run
# In CI, only run on push to main (takes longer)
```

Report output to `reports/mutation/`, includes HTML visualization report.

### 11.4 Reading Reports

| Status             | Meaning                           | Action               |
| ------------------ | --------------------------------- | ------------------- |
| **Killed**         | Test detected mutant and failed    | No action needed    |
| **Survived**      | Test still passes after mutation   | **Need stronger assertions** |
| **No coverage**    | Mutant code not executed by any test | Need to add tests  |
| **Timeout**        | Mutant caused infinite loop/timeout | Treated as killed  |
| **Runtime error**  | Mutant caused runtime crash        | Treated as killed   |

### 11.5 Handling Survived Mutants

```typescript
// Assume Stryker report: mutant survived after `>` mutated to `>=`
// Original code: if (retries > maxRetries) throw new Error("exceeded");

// Explanation: Missing boundary test. Need to add:
test("throws when retries equals maxRetries", () => {
  // Test behavior when retries === maxRetries
  // If should throw, add assert.throws
  // If should not throw, add assert.doesNotThrow
});
```

### 11.6 Collaboration of Mutation Testing with Other Layers

- **Coverage** tells you "which code was not executed" → Add tests
- **Stryker** tells you "which code was executed but assertions insufficient" → Strengthen assertions
- They complement each other, cannot replace each other

---

## 12. CI Integration and Workflow

### 12.1 CI Pipeline Architecture

```yaml
CI (GitHub Actions — .github/workflows/ci.yml)
├── validate (matrix: Node 20 + 22)
│   ├── npm ci
│   ├── npm run lint
│   ├── npm audit --audit-level=high
│   ├── npm run typecheck
│   ├── npm run changelog:check
│   ├── npm run test:raw
│   ├── npm run coverage:gate          # Node 22 only
│   └── AA_VALIDATION_ITERATIONS=2 npm run validate:stable
├── pg-integration
│   └── test:pg-integration (Postgres 16 service container, port 5433)
├── mutation-test (main branch only)
│   └── npm run stryker → reports/mutation/
├── security
│   └── CodeQL analysis (typescript)
└── trivy-scan
    └── Docker image vulnerability scan (CRITICAL,HIGH → exit-code 1)
```

Other workflow files:

- `deploy-environment.yml` — Environment deployment
- `dr-validation.yml` — Disaster recovery validation
- `publish-image.yml` — Image publishing
- `secret-provider-integration.yml` — Secret provider integration testing

### 12.2 Trigger Conditions

| Job            | Push to main | PR   | Other             |
| -------------- | ------------ | ---- | ----------------- |
| validate       | ✓            | ✓    | `codex/**` branches |
| pg-integration | ✓            | ✓    | —                 |
| mutation-test  | ✓            | ✗    | main only         |
| security       | ✓            | ✓    | —                 |
| trivy-scan     | ✓            | ✓    | —                 |

### 12.3 Test Assurance Points in CI

| Assurance Point | Tool                          | Failure Condition         |
| --------------- | ----------------------------- | ------------------------ |
| Code style      | ESLint                        | Any lint error            |
| Type safety     | tsc --noEmit                  | Any type error           |
| Dependency security | npm audit                   | HIGH/CRITICAL vulnerabilities |
| Functional correctness | node --test              | Any test failure         |
| Coverage rollback | check-coverage-baseline.mjs | Below baseline            |
| Mutation score  | Stryker                       | Below break=50%           |
| Static analysis | CodeQL                       | Security defects found    |
| Container security | Trivy                      | CRITICAL/HIGH vulnerabilities |

### 12.4 Test Result Archival

CI automatically uploads following artifacts:

- `test-results/` — Test execution logs
- `coverage/` — HTML coverage report
- `reports/mutation/` — Stryker HTML report

---

## 13. New Module Testing Checklist

When creating a new module, follow this Checklist to ensure test completeness:

### 13.1 Directories and Files

- [ ] Create `tests/unit/platform/<module>/` or `tests/unit/<area>/<module>/` directory
- [ ] Create corresponding `<service-name>.test.ts` for each service class
- [ ] If DB needed → create `tests/integration/platform/<module>/` directory

### 13.2 Test Layers

- [ ] **Unit tests**: Each exported function / class method
  - [ ] Happy path (normal input → expected output)
  - [ ] Error path (invalid input → expected exception/error code)
  - [ ] Boundary conditions (null, zero, maximum, empty arrays)
- [ ] **Schema tests** (if using Zod):
  - [ ] Valid minimal payload → `doesNotThrow`
  - [ ] Invalid payload → `throws`
  - [ ] Missing optional fields → `doesNotThrow`
- [ ] **Integration tests** (if involving DB/files/subprocesses):
  - [ ] Use `createIntegrationContext()` or `createRepositoryHarness()`
  - [ ] `try/finally` ensures cleanup
- [ ] **Security tests** (if involving security boundaries):
  - [ ] Denial-path regression covers various attack vectors
  - [ ] Fail-close test

### 13.3 Coverage

- [ ] Run `npm test` locally, confirm coverage not below global baseline
- [ ] Run `npm run coverage:baseline:update` to update baseline
- [ ] Confirm new directory appears in `.coverage-baseline.json`

### 13.4 Mutation Testing

- [ ] Confirm new module path is within `mutate` glob in `stryker.config.mjs`
- [ ] Run `npm run test:mutation` locally, confirm no large number of survived mutants

### 13.5 CI Compatibility

- [ ] Tests pass on both Node 20 and Node 22
- [ ] Tests support `--test-concurrency=12` parallel execution, no shared state conflicts
- [ ] No hardcoded absolute paths, port numbers, timestamps

### 13.6 Documentation

- [ ] Update source file ↔ test file mapping in Traceability Matrix (§7.3)
- [ ] If new Helper/Fixture introduced, update §5 tool inventory

---

---

---

# Part II — Architectural Semantic Coverage (v1.1 new, v1.2 supplement, v3.0 extended)

> Part I solves "code coverage governance" — ensuring every line of code is executed and every assertion is effective.
> Part II solves "architectural semantic coverage" — ensuring system critical design semantics (state machine, events, concurrency, phase contracts) are all covered by tests.

---

## 14. State Machine Testing Specification

### 14.1 Why a Separate Specification is Needed

This system contains **5 core state machines** (Task / Workflow / Session / Execution / Approval) and **40+ auxiliary lifecycle enums** (Worker, Plugin, Rollout, Circuit Breaker, Lease, Repair Pipeline, etc.).

Regular line/branch coverage cannot guarantee:

- Every legal state transition is tested
- Every illegal state transition is rejected
- Terminal states cannot transition further
- Atomicity of cross-entity cascade transitions

### 14.2 Core State Machine Inventory

| State Machine | Definition File                                           | Validation File                                                        | States | Terminal States                             |
| ------------- | -------------------------------------------------------- | --------------------------------------------------------------------- | ------ | ------------------------------------------ |
| **Task**      | `src/platform/five-plane-execution/state-transition/types.ts` | `src/platform/five-plane-execution/state-transition/transition-service.ts` | 7      | done, failed, cancelled                     |
| **Workflow**  | same                                                      | same                                                                  | 7      | completed, failed, cancelled                |
| **Session**   | same                                                      | same                                                                  | 7      | completed, failed, cancelled                |
| **Execution** | same                                                      | same                                                                  | 8      | succeeded, failed, cancelled, superseded   |
| **Approval**  | same                                                      | same                                                                  | 5      | approved, rejected, expired, cancelled      |

These 5 state machines are implemented through the `StateTransitionMachine<T>` generic class, with the `assertTransition()` method using CAS to prevent concurrent overwrites.

### 14.3 State Machine Testing Three-Layer Requirements

#### A. Full Coverage of Legal Transitions (Transition Coverage)

Every **legal transition edge** for each state machine must have at least one test:

```typescript
test("task transition: queued -> in_progress is allowed", () => {
  assert.doesNotThrow(() =>
    taskStateMachine.assertTransition("queued", "in_progress"),
  );
});
```

**Quantification standard**: Legal edge coverage = tested legal edges / total legal edges = **100%**

Task state machine legal edge list (example):

```
queued → pending, in_progress, cancelled
pending → in_progress, cancelled
in_progress → awaiting_decision, done, failed, cancelled
awaiting_decision → in_progress, failed, cancelled
```

#### B. Full Rejection of Illegal Transitions (Denial Coverage)

**Every terminal state** transitioning to any non-self state must have a rejection test:

```typescript
test("task transition: done -> in_progress is rejected", () => {
  assert.throws(
    () => taskStateMachine.assertTransition("done", "in_progress"),
    { message: /invalid_transition/ },
  );
});

test("task transition: done -> done is idempotent (allowed)", () => {
  assert.doesNotThrow(() => taskStateMachine.assertTransition("done", "done"));
});
```

**Quantification standard**: All terminal states × all non-self states = must test rejection

#### C. Cross-Entity Cascade Transitions (Cascade Coverage)

`TransitionService` provides `applyTaskTerminalState` and `ApprovalBlockingTransitionService`, which atomically cascade-transition multiple entities.

Cascade scenarios that must be tested:

| Trigger           | Task        | Workflow | Session      | Execution | Approval  |
| ---------------- | ----------- | -------- | ------------ | --------- | --------- |
| task → done      | done        | completed | completed    | succeeded | —         |
| task → failed    | failed      | failed   | failed       | failed    | —         |
| task → cancelled | cancelled   | cancelled | cancelled    | cancelled | —         |
| approval needed  | awaiting_decision | paused | awaiting_user | blocked   | requested |
| approval granted | in_progress  | running  | streaming    | executing | approved  |

### 14.4 Auxiliary State Machine Testing Requirements

For non-core state machines (Circuit Breaker, Rollout, Repair Pipeline, Plugin, etc.), requirements are:

| Category                        | Requirement                                 |
| ------------------------------- | ------------------------------------------- |
| Has `assertTransition()` validation | Same as core three-layer requirements      |
| Has `transitionTo()` without validation | Cover at least happy path + terminal states |
| Only used as enum values        | Each enum value appears in at least one test |

### 14.5 Circuit Breaker State Machine Special Requirements

Circuit Breaker (`closed → open → half_open → closed`) involves time and counting, requires additional testing:

- [ ] Consecutive failures ≥ threshold → trigger open
- [ ] Failure rate ≥ 50% → trigger open
- [ ] Requests in open state are rejected + return `retryAfterMs`
- [ ] After resetTimeoutMs → transition to half_open
- [ ] half_open single probe success/failure behavior
- [ ] Consecutive success ≥ halfOpenSuccessThreshold → restore closed

### 14.6 Transition Table Single Source Rule

**Hard requirement**: The canonical transition map in `transition-service.ts` is the **only authoritative source** for state transitions. Test cases **forbidden** to manually hard-code a copy of the transition table.

#### A. Principles

| Item      | Rule                                                                          |
| --------- | ----------------------------------------------------------------------------- |
| Single source | All legal/illegal transition judgments must come from `TransitionService` production map |
| No copies | Test must not contain manually written copy like `const allowedTransitions = { pending: ["running", ...] }` |
| Data-driven | Test matrix must be **auto-generated** from production map, not manually enumerated |
| Sync guarantee | If production map adds/deletes transitions, tests automatically sense, no manual sync needed |

#### B. Data-Driven Test Generation Template

```typescript
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  TRANSITION_MAP,
  ALL_STATES,
} from "../../src/platform/five-plane-execution/state-transition/types.js";

// Auto-generate legal transition pairs from production map
const validPairs: Array<[string, string]> = [];
for (const [from, toSet] of Object.entries(TRANSITION_MAP)) {
  for (const to of toSet) {
    validPairs.push([from, to]);
  }
}

// Auto-generate illegal transition pairs (all pairs - legal pairs - self-transitions)
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
      `${from} → ${to} should be valid`,
    );
  }
});

test("all invalid transitions are rejected", () => {
  for (const [from, to] of invalidPairs) {
    assert.throws(
      () => transitionService.assertTransition(from, to),
      `${from} → ${to} should be rejected`,
    );
  }
});
```

#### C. CI Guard

- Coverage gate new check: If test file contains hardcoded object literal with same key names as `TRANSITION_MAP`, CI reports warning
- PR Review checklist adds one item: "Are state machine tests auto-derived from production map?"

---

## 15. Event-Driven Testing Specification

### 15.1 Event System Architecture

```
Producer → TypedEventBus → DurableEventBus → SQLite
                                             ↓
                           EventOpsService → deliverPending() → Consumer
                                             ↓ (after 3 retries)
                                        Dead Letter Table
```

This system defines **48 typed events**, divided into 3 Tiers:

| Tier       | Semantic                | Ack Required | Events | Examples                                            |
| ---------- | ---------------------- | ------------ | ------ | --------------------------------------------------- |
| **Tier 1** | Must persist + must ack | Must         | 9      | `task:status_changed`, `decision:requested`          |
| **Tier 2** | Persist, ack optional   | Recommended  | ~35    | `dispatch:*`, `worker:*`, `plugin:*`, `skill:*`     |
| **Tier 3** | Best-effort delivery    | None         | ~4     | `stream:chunk_emitted`, `perf:*`                    |

### 15.2 Tier-Based Testing Requirements

#### Tier 1 Events (9 types) — Highest Testing Requirements

Each Tier 1 event must cover complete lifecycle:

| Phase           | Test Content                                        |
| --------------- | --------------------------------------------------- |
| **Schema**      | payload satisfies Zod validator (valid + invalid) |
| **Publish**     | Correctly writes to events table + creates ack record |
| **Deliver**     | `deliverPending()` delivers event to registered consumer |
| **Ack**         | Consumer processes successfully → ack status = `"acked"` |
| **Retry**       | Consumer processing fails → exponential backoff retry (100ms → 5s) |
| **Dead Letter** | 3 retries fail → write to dead_letter table          |
| **Replay**      | `EventOpsService.replayConsumer()` redelivers       |
| **Integrity**   | SHA-256 hash chain not tampered with                 |

#### Tier 2 Events — Medium Testing Requirements

| Phase            | Test Content                              |
| --------------- | ----------------------------------------- |
| **Schema**      | payload satisfies Zod validator            |
| **Publish**     | Correctly writes to events table          |
| **Deliver**     | At least one consumer can receive         |
| **Idempotency** | Events with `idempotencyKey` not consumed twice |

#### Tier 3 Events — Basic Testing Requirements

| Phase           | Test Content                        |
| --------------- | ------------------------------------ |
| **Publish**     | No exceptions thrown                 |
| **Best-effort** | Event doesn't block when consumer offline |

### 15.3 DLQ Testing Requirements

System has **3 independent DLQs**:

| DLQ          | Location                             | Test Focus                                                  |
| ------------ | ----------------------------------- | ----------------------------------------------------------- |
| Event DLQ    | `event_dead_letters` table          | After 3 retries correctly enters DLQ + `dlq-manager list` can query |
| Gateway DLQ  | `gateway_dead_letters` table        | Non-retryable status codes directly enter DLQ, retryable status codes enter DLQ after retries |
| Jobs DLQ     | `queue_jobs.status = "dead_letter"` | Enters DLQ after exceeding `maxAttempts`                       |

Each DLQ must test:

- [ ] Messages correctly enter DLQ under correct conditions
- [ ] DLQ messages can be queried (list / count)
- [ ] DLQ messages can be cleared (purge)
- [ ] Retryable DLQ messages can be re-queued

### 15.4 Event Schema Drift Regression

`event-registry.ts` defines schemas for all events in `RAW_EVENT_SCHEMA_REGISTRY`:

```typescript
test("all TypedEventPayloadMap keys are registered in EVENT_SCHEMA_REGISTRY", () => {
  // Type check MissingTypedEventDefinitions already at compile time
  // Runtime supplementary verification
  for (const eventType of Object.keys(TypedEventPayloadMap)) {
```

---

## 16. OAPEFLIR Stage Coverage Matrix

### 16.1 Coverage Matrix Definition

Not by directory, not by file, but define minimum test set by **OAPEFLIR 8-stage design semantics**.

Each stage must cover **7 standard paths**:

| Path ID | Path Name               | Description                                                    |
| ------- | ----------------------- | -------------------------------------------------------------- |
| P1      | **Happy Path**          | Standard input → stage complete → correct output               |
| P2      | **Degraded Path**       | Partial input missing/insufficient quality → degraded handling → output with warnings |
| P3      | **Invalid Input Path**  | Illegal/malformed input → rejection or fail-fast               |
| P4      | **Timeout Path**        | Stage execution timeout → correct abort + resource cleanup      |
| P5      | **Skip Path**           | Stage skipped (condition not met) → stage status = `"skipped"` |
| P6      | **Downstream Contract Violation** | Upstream output doesn't satisfy current stage input contract → reject or rollback |
| P7      | **Human Intervention Path** | Stage requires human intervention → pause waiting approval/confirmation → resume or terminate |

### 16.2 Stage-by-Stage Coverage Matrix

#### Observe

| Path | Test Scenario                              | Assertion Focus                                                |
| ---- | ------------------------------------------ | -------------------------------------------------------------- |
| P1   | Standard task input → Generate TaskSituation | `objective`, `currentPhase`, `codebaseSnapshot` fields complete |
| P2   | Empty codebase / no fileRefs               | TaskSituation still generated, `fileRefs: []`                  |
| P3   | Illegal taskId / empty objective           | Schema rejection                                                |
| P4   | Collection timeout                         | Abort with timeout + return existing snapshot                   |
| P5   | Input already cached / no changes         | Skip re-collection                                             |
| P6   | —                                          | As first stage, no upstream                                    |
| P7   | Task requires human confirmation of scope   | Pause collection → wait human confirmation → resume after approval |

#### Assess

| Path | Test Scenario                               | Assertion Focus                                                       |
| ---- | ------------------------------------------- | -------------------------------------------------------------------- |
| P1   | Standard TaskSituation → UnifiedAssessment  | complexity / risk / routingDecision / resourceAllocation reasonable |
| P2   | High uncertainty task                        | Correctly upgrade executionMode to `"supervised"`                     |
| P3   | Malformed situationRef                      | Schema rejection                                                      |
| P4   | Assessment timeout                           | Degrade to default assessment                                        |
| P5   | Simple task skip deep assessment            | Use fast assessment path directly                                    |
| P6   | TaskSituation missing required fields       | Reject + rollback to Observe                                        |
| P7   | High uncertainty → requires human supervision | executionMode upgraded to `"supervised"`, wait approval to continue |

#### Plan

| Path | Test Scenario                              | Assertion Focus                                              |
| ---- | ------------------------------------------ | ------------------------------------------------------------ |
| P1   | Standard assessment → Plan with steps      | stepId unique, dependencies legal, strategy correct          |
| P2   | High complexity task                       | Multi-step DAG + parallel steps                              |
| P3   | version = 0 / steps empty                  | Schema rejection                                             |
| P4   | Planning timeout                           | Return minimal feasible plan                                 |
| P5   | Assessment indicates no planning needed     | stage skipped                                                |
| P6   | AssessmentRef doesn't exist                | Reject                                                      |
| P7   | High-risk plan requires human review       | plan status = `"pending_approval"` → start execution after approval |

#### Execute

| Path | Test Scenario                             | Assertion Focus                                               |
| ---- | ----------------------------------------- | ------------------------------------------------------------- |
| P1   | Single-step execution → DualChannelStepOutput | userFacingResult + systemTelemetry complete                    |
| P2   | Partial step failure → partial success    | Successful step outputs preserved                             |
| P3   | Illegal tool call / sandbox rejection     | `status: "blocked"` + error code                              |
| P4   | Step timeout                              | Step marked `"failed"` + `code: "tool.timeout"`               |
| P5   | All steps completed (replay)             | Skip                                                         |
| P6   | Plan step references non-existent tool    | Reject + rollback to Plan                                     |
| P7   | Step triggers approval block              | `status: "blocked_awaiting_approval"` → resume execution after approval |

#### Feedback

| Path | Test Scenario                        | Assertion Focus                                          |
| ---- | ------------------------------------ | ------------------------------------------------------- |
| P1   | Execution result → FeedbackSignal set | signal correctly classified (success/failure/correction) |
| P2   | Duplicate signal                    | deduplication effective                                   |
| P3   | Empty signal list                   | Return empty set, no error                               |
| P4   | Signal collection timeout           | Return collected portion                                  |
| P5   | No execution output                 | Skip feedback                                            |
| P6   | stepOutputRefs reference non-existent | Ignore + warning                                         |
| P7   | Feedback result requires human confirmation of accuracy | signal marked `"pending_review"` → effective after human confirmation |

#### Learn

| Path | Test Scenario                                                       | Assertion Focus                                             |
| ---- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| P1   | Feedback signals → LearningSignal (failure_pattern / recovery_playbook) | learningType + sourceSignalIds correct                   |
| P2   | Low confidence mode                                                 | Marked as tentative                                         |
| P3   | Illegal learningType                                                 | Reject                                                     |
| P4   | Mining timeout                                                     | Return empty                                               |
| P5   | No failure signals                                                  | Skip learning                                              |
| P6   | FeedbackSignal structure incomplete                                 | Reject                                                     |
| P7   | Learning conclusion requires expert review                          | learning marked `"expert_review_required"` → entered after review |

#### Improve

| Path | Test Scenario                                                      | Assertion Focus                                          |
| ---- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| P1   | Learning output → ImprovementCandidate (status: proposed → approved) | changeScope + expectedBenefit reasonable                 |

#### Finalize

| Path | Test Scenario                  | Assertion Focus                                |
| ---- | ------------------------------ | --------------------------------------------- |
| P1   | All previous stages complete   | Mark workflow/task as completed                |
| P2   | Resource cleanup on completion | All temporary resources released              |
| P3   | Final status persistence       | Final status correctly written to storage      |

### 16.3 Phase Contract Verification

Each stage transition must verify downstream contract:

- [ ] OAPEFLIR loop iteration count within limits (max 10)
- [ ] Each phase's output satisfies next phase's input contract
- [ ] Phase status transitions are atomic

---

## 17. Concurrency and Timing Testing Specification

### 17.1 Concurrent Invariant Definition

System has following **true concurrency invariants** (not serializability):

| Invariant ID | Invariant Description                        | Detection Method              |
| ------------ | ------------------------------------------- | ----------------------------- |
| CONC-1       | Same task not executed by two workers simultaneously | Worker registration in Redis |
| CONC-2       | Lease extension not create new owner        | CAS on lease record           |
| CONC-3       | Dead letter not processed by multiple consumers | Message visibility flag      |
| CONC-4       | Session state updates are atomic            | Version counter               |
| CONC-5       | Approval state transitions are atomic        | CAS on approval record        |

### 17.2 Concurrency Testing Requirements

#### A. Critical Section Test (runCriticalSectionTest)

```typescript
test("task execution concurrent requests handled correctly", async () => {
  const results = await runCriticalSectionTest({
    execute: async (workerId) => {
      const task = await taskQueue.dequeue();
      if (task) {
        await taskExecutor.execute(task);
        return { workerId, taskId: task.id, status: "executed" };
      }
      return { workerId, taskId: null, status: "no_task" };
    },
    concurrency: 10,
    iterations: 100,
  });

  // Verify: Each task executed exactly once
  const executed = results.filter((r) => r.status === "executed");
  const taskIds = executed.map((r) => r.taskId).filter(Boolean);
  const uniqueTaskIds = new Set(taskIds);
  assert.equal(taskIds.length, uniqueTaskIds.size, "Each task executed exactly once");
});
```

#### B. Concurrent State Modification Test (runConcurrentStateModification)

```typescript
test("session concurrent updates maintain consistency", async () => {
  const sessionId = "session-123";
  const ctx = await createIntegrationContext();

  const results = await runConcurrentStateModification({
    update: async (workerId) => {
      return ctx.sessionStore.appendEvent(sessionId, {
        type: "worker_progress",
        workerId,
        timestamp: Date.now(),
      });
    },
    concurrency: 5,
    iterations: 20,
  });

  // Verify: Final state consistent, no lost updates
  const finalSession = await ctx.sessionStore.getSession(sessionId);
  assert.equal(finalSession.events.length, 5 * 20, "All events persisted");
});
```

### 17.3 Race Condition Test Cases

| Test Case                     | Scenario                                        | Assertion                                              |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| Double lock acquisition        | Same worker acquires same lock twice            | Second acquisition returns false or throws             |
| Concurrent lease extension    | Two workers extend same lease simultaneously    | Only one succeeds, other gets false                   |
| Concurrent task dequeue        | Multiple workers dequeue same task             | Task assigned to exactly one worker                   |
| Concurrent approval state      | Two approvers approve conflicting requests     | Second approval rejected or first approval honored     |
| Session event concurrent append | Multiple workers append to same session        | All events present, order non-deterministic but complete |

### 17.4 Timing-Sensitive Test Boundaries

| Test Type        | Max Acceptable Timing Variance | CI Environment   |
| ---------------- | ----------------------------- | --------------- |
| Latency regression | ±10%                          | Dedicated runner |
| Throughput        | ±15%                          | Isolated container |
| Timeout           | 0% (must be deterministic)    | N/A             |

---

## 18. Design Specification to Test Traceability Specification

### 18.1 Objectives

Establish **bidirectional traceability** between design documents and test cases, so that:

- Every P0/P1 design specification has corresponding tests
- Every test can be traced to design requirements

### 18.2 Spec ID Encoding Rules

This project uses **4 prefixes** to distinguish traceability spec sources:

| Prefix       | Meaning            | Source                                       |
| ------------ | ----------------- | ------------------------------------------- |
| `SPEC-`      | Design specs       | `opeli_detailed_design.md` and other design docs |
| `ADR-`       | Architecture Decision Records | ADR documents under `doc/adr/` |
| `CONTRACT-`  | Interface/behavior contracts | Contract documents under `doc/contracts/` |
| `INC-`       | Production incidents | Incident replay records, trigger regression tests |

#### Encoding Format

```
{Prefix}{Module}-{Subsystem}-{Sequence}

SPEC Examples:
SPEC-OAPEFLIR-EXEC-001     # OAPEFLIR Execute stage spec #1
SPEC-ROLLOUT-STATE-003     # Rollout state machine spec #3
SPEC-PLUGIN-SANDBOX-002    # Plugin sandbox spec #2
SPEC-EVENT-TIER1-DLQ-001   # Tier 1 event DLQ spec #1
SPEC-LEASE-FENCING-001     # Lease fencing token spec #1

ADR Examples:
ADR-LOCK-BACKEND-001       # Distributed lock selection ADR #1
ADR-EVENT-DURABILITY-002   # Event durability strategy ADR #2

CONTRACT Examples:
CONTRACT-SANDBOX-FS-001   # Sandbox filesystem contract #1
CONTRACT-API-GATEWAY-003  # API Gateway interface contract #3

INC Examples:
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

Or maintain mapping table at top of test file:

```typescript
/**
 * Spec coverage:
 *   SPEC-EVENT-TIER1-DLQ-001 — test at line 45
 *   SPEC-EVENT-TIER1-DLQ-002 — test at line 78
 *   CONTRACT-API-GATEWAY-003 — test at line 95
 *   INC-20250401-DLQ-OVERFLOW-001 — test at line 130
 */
```

### 18.4 Three Traceability Tables

#### Table 1: Source File → Unit Test

```
src/platform/feedback/feedback-collector.ts → tests/unit/platform/feedback/feedback-collector.test.ts
```

(See §7.3 Traceability Matrix)

#### Table 2: Source File → Integration Test

```
src/platform/five-plane-execution/tools/command-executor.ts → tests/integration/security/sandbox-command-executor.test.ts
```

---

## 19. Real Execution vs Mock Execution Boundary Specification

### 19.1 Boundary Decision Tree

```
Is it testing sandbox security boundary?
  YES → Real execution (Integration)
  NO ↓

Is it testing DB transactions or SQL correctness?
  YES → Real execution (Integration with SQLite)
  NO ↓

Is it testing multi-service event propagation?
  YES → Real execution (Integration)
  NO ↓

Is it testing async service collaboration?
  YES → Real execution with mocks for external services
  NO ↓

Is it pure logic/parsing/validation?
  YES → Unit with inline mock
  NO ↓

Default → Unit with typed-factories mock
```

### 19.2 Boundary Compliance Checklist

| Component              | Correct Layer        | Anti-pattern                          |
| ---------------------- | -------------------- | ------------------------------------ |
| StateTransitionMachine | Unit                 | Integration for CAS logic            |
| Schema validation      | Unit                 | E2E for Zod parse errors            |
| SQLite operations      | Integration          | Mocking SQLite to hide SQL errors   |
| EventBus publish      | Integration          | Mock EventBus to skip event delivery |
| Sandbox execution     | Integration (real subprocess) | Unit with mock executor           |
| Redis operations      | Integration          | Mock Redis to hide connection errors |
| HTTP API endpoints    | Integration          | Unit with mock HTTP client           |

---

## 20. Test Debt Classification

### 20.1 Debt Levels

| Level | Description                          | Example                                     | Action Window |
| ----- | ------------------------------------ | ------------------------------------------- | ------------- |
| **Critical** | Affects production correctness | Untested security boundary                  | Immediate     |
| **High**   | Risk of undetected regression     | 0% coverage on core service                 | This sprint   |
| **Medium** | Technical debt, minor risk       | Branch coverage < 60%                       | Next sprint   |
| **Low**    | Maintenance improvement           | Mutation score < 50%                        | When convenient |

### 20.2 Debt Interest Calculation

Every quarter, calculate test debt interest:

- Critical debt: 2 points/week until resolved
- High debt: 1 point/week until resolved
- Medium debt: 0.5 points/week until resolved
- Low debt: 0.1 points/week until resolved

### 20.3 Debt Retirement

Test debt can be "paid off" by:

- Adding missing tests
- Increasing coverage thresholds
- Refactoring to reduce complexity

---

## 21. Failure Sample Replay Rules

### 21.1 Failure Sample Collection

Every CI failure must:

1. Capture complete error context
2. Serialize to `test-results/failures/{timestamp}-{test-name}.json`
3. Upload as CI artifact

### 21.2 Replay Procedure

```bash
# Download failure artifact
# Run specific failing test with verbose output
npm run test:raw -- --test-name-pattern="failing test" --verbose
```

### 21.3 Replay-to-Test Conversion

If failure reveals missing test coverage:

1. Write new test case reproducing the failure
2. Verify new test fails (confirms bug exists)
3. Fix bug
4. Verify new test passes
5. Commit with `[REPLAY-FROM-FAILURE]` prefix in commit message

---

## 22. Test Data Governance

### 22.1 Test Data Principles

- **Isolation**: Test data must not affect other tests
- **Repeatability**: Same test run multiple times yields same results
- **Realism**: Test data should reflect production data distribution
- **Minimality**: Use smallest dataset that covers test scenarios

### 22.2 Data Cleanup Rules

| Test Type | Cleanup Method         | Timing              |
| --------- | ---------------------- | ------------------- |
| Unit      | No cleanup needed      | N/A                 |
| Integration | `try/finally` + `createIntegrationContext().cleanup()` | After each test |
| E2E       | Database transactions rollback | After each test suite |

### 22.3 Test Data Fixtures

Use factory functions for consistent test data:

```typescript
import { createMinimalTask, createMinimalExecution } from "../../helpers/fixtures/base.js";

test("task store handles high-priority task", () => {
  const task = createMinimalTask({ priority: "critical" });
  // ...
});
```

---

## 23. Coverage Quality Redlines

### 23.1 Coverage Quality Criteria

| Metric              | Minimum | Target | Critical |
| ------------------- | ------- | ------ | -------- |
| Line coverage       | 0%     | 60%    | <0%      |
| Branch coverage     | 0%     | 50%    | <0%      |
| Function coverage   | 0%     | 60%    | <0%      |
| Statement coverage  | 0%     | 60%    | <0%      |

### 23.2 Coverage Quality Anti-Patterns

- **Fake coverage**: 100% line coverage with 0 assertions
- **Impossible coverage**: Covering error paths that cannot actually occur
- **Indirect coverage**: A function covered by integration test but its unit tests don't exist

### 23.3 Coverage Quality Gates

Every PR must satisfy:

- [ ] No new files with 0% coverage added to `src/platform/`
- [ ] No coverage decrease in existing covered files
- [ ] Branch coverage not below 40% for any file > 100 lines

---

## 24. Architecture Review-Driven Regression Testing

### 24.1 Background

Architecture Review v8.0 conducted full review of 1,387 source files / 265,020 lines of code against Architecture Design Document v3.2 (~8,000 lines / 94 chapters), discovering **13 architecture design-implementation gaps**:

| Priority         | Count | Key Gaps                                                                                      |
| ---------------- | ----- | --------------------------------------------------------------------------------------------- |
| P0 Architecture Violation | 3     | E1-E6 exception classification missing, SEV1-4 unified severity missing, STRIDE threat model missing |
| P1 Explicit Requirements Insufficient Implementation | 7     | Principal types, Sandbox levels, Cursor pagination, HITL mode, RBAC three-layer authorization, Vertical domains, Multimodal |
| P2 Detail Completion | 3     | Webhook-Outbox coupling, Logic table reconciliation, Meta-model 12 questions                      |

### 24.2 Gap ID to Test Traceability

Test titles use `[ARCH-P{Level}-{Sequence}]` prefix, one-to-one correspondence with architecture review v8.0 gap IDs:

```
Architecture Review v8.0: P0-1 §12.1 Exception event classification system E1-E6 completely missing
    ↓
Test title: [ARCH-P0-1] AnomalyEventClass enum defines all 6 categories E1-E6
    ↓
File location: tests/unit/platform/contracts/anomaly-event-classification.test.ts
```

| Prefix      | Meaning                      | Gap Count |
| ----------- | ---------------------------- | --------- |
| `ARCH-P0-` | Architecture violation (completely missing) | 3         |
| `ARCH-P1-` | Explicit requirement but insufficient implementation | 7        |
| `ARCH-P2-` | Detail completion             | 3         |

### 24.3 Priority Execution Plan

| Priority | Fix Timeline | Gap IDs                                                                                                   |
| -------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| **P0**   | 1-2 weeks    | P0-1 (E1-E6 classification), P0-2 (SEV1-4 unified severity), P0-3 (STRIDE)                              |
| **P1**   | 2-4 weeks    | P1-1 (Principal), P1-2 (Sandbox), P1-3 (pagination), P1-4 (HITL), P1-5 (RBAC), P1-6 (vertical domain), P1-7 (multimodal) |
| **P2**   | Ongoing      | P2-1 (Webhook-Outbox), P2-2 (logic table), P2-3 (meta-model 12 questions)                              |

---

## 25. P0 Architecture Violation Gap Testing Specification

### 25.1 [ARCH-P0-1] §12.1 Exception Event Classification System E1-E6 Completely Missing

**Gap**: Design defines 6 types of exception event classification (E1 business/E2 execution/E3 external dependency/E4 security/E5 data/E6 governance), code uses `AnomalyCategory` (spike/trend_change/level_shift) in `AnomalyDetectionService`, completely different from design classification system.

**Test Type**: Unit

**Test Objective**: Exception event classification enum must include all 6 categories E1-E6, classification mapping logic must be correct.

```typescript
test("[ARCH-P0-1] AnomalyEventClass enum defines all 6 categories", () => {
  const categories = Object.values(AnomalyEventClass);
  assert.equal(categories.length, 6);
  assert.ok(categories.includes("E1_BUSINESS"));
  assert.ok(categories.includes("E2_EXECUTION"));
  assert.ok(categories.includes("E3_EXTERNAL_DEPENDENCY"));
  assert.ok(categories.includes("E4_SECURITY"));
  assert.ok(categories.includes("E5_DATA"));
  assert.ok(categories.includes("E6_GOVERNANCE"));
});

test("[ARCH-P0-1] ClassifiedAnomalyEvent requires class and severity fields", () => {
  const validEvent = {
    event_id: "evt-001",
    class: AnomalyEventClass.E1_BUSINESS,
    severity: UnifiedSeverity.SEV3,
    source_plane: "state-evidence",
    detected_at: "2026-04-23T00:00:00Z",
    details: {},
  };
  assert.doesNotThrow(() => ClassifiedAnomalyEventSchema.parse(validEvent));
});

test("[ARCH-P0-1] statistical detection maps to business classification", () => {
  const spikeOnSla = { category: "spike", source: "slo-alerting" };
  assert.equal(mapToEventClass(spikeOnSla), AnomalyEventClass.E1_BUSINESS);

  const trendOnSecurity = { category: "trend_change", source: "iam-audit" };
  assert.equal(mapToEventClass(trendOnSecurity), AnomalyEventClass.E4_SECURITY);
});
```

**Test Scenario Checklist**:

| Scenario                                      | Assertion                                                    |
| --------------------------------------------- | ------------------------------------------------------------ |
| Each E1-E6 classification enum value exists    | Enum length = 6, contains all values                        |
| Schema validates valid event                  | `doesNotThrow`                                               |
| Schema rejects event missing class            | `throws`                                                     |
| Statistical detection → E1-E6 mapping covers all | Each source_plane maps to at least one E category        |
| Event published with class field              | outbox/event message contains `AnomalyEventClass`             |

### 25.2 [ARCH-P0-2] §12.2 Unified Severity Levels SEV1-SEV4 Missing

**Gap**: Code contains 3 incompatible severity systems: Incident uses P0-P3, Anomaly uses warning/critical/emergency, SLO uses AlertSeverity. Design requires unified use of SEV1-SEV4.

**Test Type**: Unit + Integration

```typescript
test("[ARCH-P0-2] UnifiedSeverity enum defines SEV1-SEV4", () => {
  const severities = Object.values(UnifiedSeverity);
  assert.deepEqual(severities, ["SEV1", "SEV2", "SEV3", "SEV4"]);
});

test("[ARCH-P0-2] SEVERITY_SLA defines response times for all levels", () => {
  for (const sev of Object.values(UnifiedSeverity)) {
    const sla = SEVERITY_SLA[sev];
    assert.ok(sla, `SLA must exist for ${sev}`);
    assert.ok(sla.response_minutes > 0);
    assert.ok(sla.resolution_minutes > 0);
  }
  assert.ok(
    SEVERITY_SLA.SEV1.response_minutes < SEVERITY_SLA.SEV4.response_minutes,
  );
});

test("[ARCH-P0-2] incident P0-P3 maps to SEV1-SEV4", () => {
  assert.equal(toUnifiedSeverity("P0"), UnifiedSeverity.SEV1);
  assert.equal(toUnifiedSeverity("P1"), UnifiedSeverity.SEV2);
  assert.equal(toUnifiedSeverity("P2"), UnifiedSeverity.SEV3);
  assert.equal(toUnifiedSeverity("P3"), UnifiedSeverity.SEV4);
});

test("[ARCH-P0-2] anomaly warning/critical/emergency maps to SEV levels", () => {
  assert.equal(anomalyToSeverity("emergency"), UnifiedSeverity.SEV1);
  assert.equal(anomalyToSeverity("critical"), UnifiedSeverity.SEV2);
  assert.equal(anomalyToSeverity("warning"), UnifiedSeverity.SEV3);
});
```

### 25.3 [ARCH-P0-3] §11.8 STRIDE Threat Model Completely Missing

**Gap**: Design requires STRIDE six-dimension threat assessment + supplementary threat matrix, no STRIDE implementation in code.

**Test Type**: Unit

```typescript
test("[ARCH-P0-3] StrideCategory enum defines 6 STRIDE dimensions", () => {
  const categories = Object.values(StrideCategory);
  assert.equal(categories.length, 6);
  assert.ok(categories.includes("SPOOFING"));
  assert.ok(categories.includes("TAMPERING"));
  assert.ok(categories.includes("REPUDIATION"));
  assert.ok(categories.includes("INFORMATION_DISCLOSURE"));
  assert.ok(categories.includes("DENIAL_OF_SERVICE"));
  assert.ok(categories.includes("ELEVATION_OF_PRIVILEGE"));
});

test("[ARCH-P0-3] ThreatMatrix has entries for all 6 STRIDE dimensions", () => {
  const matrix = ThreatMatrixRegistry.getMatrix();
  const coveredCategories = new Set(matrix.entries.map((e) => e.category));
  for (const cat of Object.values(StrideCategory)) {
    assert.ok(coveredCategories.has(cat), `No threat entry for ${cat}`);
  }
});

test("[ARCH-P0-3] each STRIDE dimension has at least one mitigation", () => {
  const matrix = ThreatMatrixRegistry.getMatrix();
  for (const cat of Object.values(StrideCategory)) {
    const entries = matrix.entries.filter((e) => e.category === cat);
    const hasMitigation = entries.some((e) => e.mitigations.length > 0);
    assert.ok(hasMitigation, `${cat} must have at least one mitigation`);
  }
});
```

---

## 26. P1 High-Priority Gap Testing Specification

### 26.1 [ARCH-P1-1] Principal Type Incomplete (3/6)

**Gap**: Architecture §11.1 defines 6 Principal types (Human / ServiceAccount / Agent / System / External / Anonymous), code only implements first 3.

**Test Type**: Unit

```typescript
test("[ARCH-P1-1] PrincipalType enum covers all 6 types", () => {
  const required = [
    "human",
    "service_account",
    "agent",
    "system",
    "external",
    "anonymous",
  ];
  for (const type of required) {
    assert.ok(
      PrincipalType[type] !== undefined,
      `PrincipalType must include "${type}"`,
    );
  }
});
```

---

## 27. P2 Detail Completion Gap Testing Specification

### 27.1 [ARCH-P2-1] Webhook + Outbox Coupling Missing

**Gap**: Architecture §6.7 requires event notifications use Transactional Outbox pattern for at-least-once delivery. Current webhook sends synchronously, no outbox table, no retry tracking.

**Test Type**: Integration

```typescript
test("[ARCH-P2-1] WebhookService writes to outbox table before sending", async () => {
  const db = await createTestDb();
  const service = new WebhookService({ db, sender: createMockSender() });

  await service.dispatch({
    event: "task:completed",
    payload: { taskId: "t-1" },
    target: "https://example.com/hook",
  });

  const outboxRows = await db.query("SELECT * FROM webhook_outbox");
  assert.ok(outboxRows.length >= 1, "Must write to outbox before sending");
  assert.equal(outboxRows[0].event_type, "task:completed");
});

test("[ARCH-P2-1] OutboxProcessor retries failed webhook deliveries", async () => {
  let attempts = 0;
  const failingSender = {
    async send() {
      attempts++;
      throw new Error("network timeout");
    },
  };
```

---

## 29. P0 Blocker-Level Engineering Defect Testing Specification

> Corresponds to v2.0 §25.

### 29.1 [SYS-REL-2.1] Redis Error Handler Silently Swallows Errors

**Defect**: In `distributed-lock/redis-lock-adapter.ts`, `queue/redis-queue-adapter.ts`, `ingress/redis-rate-limiter.ts`, and `cache/stores/redis-cache-store.ts`, `this.redis.on("error", () => {})` silently swallows all Redis errors.

**Test Type**: Unit + Integration

**Test Objective**: Redis connection errors must (1) be logged to StructuredLogger, (2) update health status flag, (3) increment Prometheus counter.

```typescript
test("[SYS-REL-2.1] Redis lock adapter logs error and marks unhealthy on connection failure", () => {
  const logs: string[] = [];
  const mockLogger = {
    error(msg: string) {
      logs.push(msg);
    },
  };
  const mockRedis = new EventEmitter();

  const adapter = new RedisLockAdapter({
    redis: mockRedis,
    logger: mockLogger,
  });

  mockRedis.emit("error", new Error("ECONNREFUSED"));

  assert.ok(logs.length > 0, "Error must be logged");
  assert.ok(
    logs[0]?.includes("ECONNREFUSED"),
    "Error message must be preserved",
  );
  assert.equal(
    adapter.isHealthy(),
    false,
    "Health flag must be false after error",
  );
});
```

**Covered Files** (one test group per file):

| File                                                       | Test File                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `execution/distributed-lock/redis-lock-adapter.ts`         | `tests/unit/platform/five-plane-execution/redis-lock-error.test.ts`            |
| `execution/queue/redis-queue-adapter.ts`                   | `tests/unit/platform/five-plane-execution/redis-queue-error.test.ts`          |
| `interface/ingress/redis-rate-limiter.ts`                   | `tests/unit/platform/five-plane-interface/redis-rate-limiter-error.test.ts`    |
| `shared/cache/stores/redis-cache-store.ts`                 | `tests/unit/platform/shared/redis-cache-error.test.ts`              |

### 29.2 [SYS-REL-2.3] DLQ In-Memory Only, Lost on Restart

**Defect**: `state-evidence/dlq/index.ts` uses `Map<string, DeadLetterRecord>` to store dead letters, all lost after process restart.

**Test Type**: Integration

```typescript
test("[SYS-REL-2.3] DLQ records survive service reconstruction", async () => {
  const db = await createTestDb();

  const dlq1 = new DlqService({ db });
  await dlq1.enqueue({
    eventId: "evt-001",
    eventType: "task:status_changed",
    payload: { taskId: "t-1" },
    reason: "consumer_timeout",
  });
  assert.equal(await dlq1.count(), 1);

  const dlq2 = new DlqService({ db });
  assert.equal(await dlq2.count(), 1, "Records must persist across instances");

  const records = await dlq2.list({ limit: 10 });
  assert.equal(records[0]?.eventId, "evt-001");
});
```

### 29.3 [SYS-REL-2.4] Redis Queue Silently Drops Tasks

**Defect**: 5 critical enqueue operations in `execution/queue/redis-queue-adapter.ts` use `.catch(() => {})`.

**Test Type**: Unit

```typescript
test("[SYS-REL-2.4] Redis queue enqueue propagates write failure", async () => {
  const mockRedis = {
    async hmset() {
      throw new Error("READONLY You can't write against a read only replica");
    },
    async zadd() {
      throw new Error("READONLY");
    },
  };

  const queue = new RedisQueueAdapter({ redis: mockRedis });

  await assert.rejects(
    () => queue.enqueue({ type: "task:execute", payload: { taskId: "t-1" } }),
    { message: /READONLY/ },
    "Enqueue must propagate Redis write failure",
  );
});
```

### 29.4 [SYS-DEPLOY-6.3] Dockerfile CMD Path Does Not Exist

**Defect**: Dockerfile line 46 CMD references non-existent path.

**Test Type**: CI Build Verification

```typescript
test("[SYS-DEPLOY-6.3] Dockerfile CMD entrypoint exists after build", () => {
  const dockerfilePath = path.resolve("Dockerfile");
  const content = readFileSync(dockerfilePath, "utf8");

  const cmdMatch = content.match(/CMD\s+\["node"[^]]*?"(dist\/[^"]+)"/);
  assert.ok(cmdMatch, "Dockerfile must have a CMD with a dist/ path");

  const entrypoint = cmdMatch[1];
  assert.ok(
    existsSync(path.resolve(entrypoint)),
    `CMD entrypoint "${entrypoint}" must exist after build`,
  );
});
```

---

## 30. P1 Critical Defect Testing Specification

### 30.1 [SYS-REL-2.2] Redis Lock TOCTOU Race

**Defect**: `distributed-lock/redis-lock-adapter.ts` `extendAsync()` uses non-atomic GET+SET, `forceStealAsync()` uses non-atomic DEL+SET. In concurrent scenarios, two processes can hold same lock simultaneously.

**Test Type**: Integration (Concurrency)

```typescript
test("[SYS-REL-2.2] concurrent extendAsync on same lock grants only one", async () => {
  const lock = createRedisLockAdapter();
  await lock.acquireAsync({ lockKey: "shared", owner: "w-1", ttlMs: 10000 });

  const results = await Promise.allSettled([
    lock.extendAsync({ lockKey: "shared", owner: "w-1", ttlMs: 20000 }),
    lock.extendAsync({ lockKey: "shared", owner: "w-2", ttlMs: 20000 }),
  ]);

  const succeeded = results.filter((r) => r.status === "fulfilled");
  assert.equal(succeeded.length, 1, "Exactly one extend must succeed");
});

test("[SYS-REL-2.2] concurrent forceStealAsync does not create double lock", async () => {
  const lock = createRedisLockAdapter();
  await lock.acquireAsync({ lockKey: "shared", owner: "w-1", ttlMs: 10000 });

  const results = await runConcurrentInvariant(
    async (workerId) =>
      lock.forceStealAsync({
        lockKey: "shared",
        newOwner: `w-${workerId}`,
        ttlMs: 10000,
      }),
    { concurrency: 5 },
  );

  const owners = new Set(results.values.filter(Boolean).map((r) => r.owner));
  assert.equal(owners.size, 1, "Only one owner after concurrent steal");
});
```

### 30.2 [SYS-REL-2.7] Workflow State Transition Missing CAS

**Defect**: `execution/state-transition/transition-service.ts` has CAS for task transitions, but workflow transitions lack CAS protection.

**Test Type**: Integration (Concurrency)

```typescript
test("[SYS-REL-2.7] concurrent workflow transitions detect conflict", async () => {
  const ctx = await createIntegrationContext();
  try {
    const workflowId = await ctx.store.insertWorkflow({ status: "running" });

    const results = await Promise.allSettled([
      ctx.transitionService.transitionWorkflow(
        workflowId,
        "running",
        "completed",
      ),
      ctx.transitionService.transitionWorkflow(workflowId, "running", "failed"),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(succeeded.length, 1, "Only one transition succeeds");
    assert.equal(rejected.length, 1, "Other transition must be rejected");
  } finally {
    await ctx.cleanup();
  }
});
```

### 30.3 [SYS-REL-2.5] SLO Alert Delivery Silently Drops

**Defect**: `shared/observability/slo-alerting-service.ts` lines 172/227/281/339 alert delivery failures use `.catch(() => {})`.

**Test Type**: Unit

```typescript
test("[SYS-REL-2.5] PagerDuty delivery failure logs error and increments counter", async () => {
  const logs: string[] = [];
  const counters: Record<string, number> = {};
  const mockFetch = async () => {
    throw new Error("ETIMEDOUT");
  };
  const mockLogger = {
    error(msg: string) {
      logs.push(msg);
    },
  };
  const mockMetrics = {
    inc(name: string) {
      counters[name] = (counters[name] ?? 0) + 1;
    },
  };

  const service = new SloAlertingService({
    fetchImpl: mockFetch,
    logger: mockLogger,
    metrics: mockMetrics,
  });

  await service.sendPagerDutyAlert({ severity: "critical", summary: "test" });

  assert.ok(logs.length > 0, "Delivery failure must be logged");
  assert.equal(counters["alert_delivery_failures_total"], 1);
});
```

### 30.4 [SYS-REL-2.6] Outbox Not Connected to Critical Write Path

**Defect**: `shared/outbox/outbox-service.ts` complete implementation exists, but `transition-service.ts` task state transitions write directly to events table bypassing Outbox.

**Test Type**: Integration

```typescript
test("[SYS-REL-2.6] task state transition writes outbox entry in same transaction", async () => {
  const ctx = await createIntegrationContext();
  try {
    const taskId = await ctx.store.insertTask(
      createMinimalTask({ status: "queued" }),
    );

    await ctx.transitionService.applyTaskTransition(
      taskId,
      "queued",
      "in_progress",
    );

    const outboxEntries = await ctx.db.all(
      "SELECT * FROM outbox WHERE entity_id = ? AND entity_type = 'task'",
      [taskId],
    );
    assert.ok(
      outboxEntries.length > 0,
      "Outbox entry must exist after transition",
    );
    assert.equal(outboxEntries[0].event_type, "task:status_changed");
  } finally {
    await ctx.cleanup();
  }
});
```

### 30.5 [SYS-REL-2.8] Session Dual Storage Non-Atomic Write

**Defect**: `state-evidence/truth/session-dual-storage.ts` crash between two `appendFileSync` calls causes inconsistency.

**Test Type**: Integration (Fault Injection)

```typescript
test("[SYS-REL-2.8] dual storage detects and repairs partial write", async () => {
  const workspace = createTempWorkspace("aa-dual-storage-");
  try {
    const storage = new SessionDualStorage({ basePath: workspace });

    await storage.append({ sessionId: "s-1", event: { type: "step_started" } });

    const sessionFile = path.join(workspace, "sessions", "s-1.jsonl");
    const taskIndexFile = path.join(workspace, "task-index", "s-1.jsonl");
    const sessionLines = readFileSync(sessionFile, "utf8").trim().split("\n");
    const indexLines = readFileSync(taskIndexFile, "utf8").trim().split("\n");

    assert.equal(
      sessionLines.length,
```

---

## 31. P2 Important Defect Testing Specification

### 31.1 [SYS-REL-3.1] Missing Request ID Propagation

**Defect**: HTTP headers `X-Request-ID` not propagated through all service calls.

**Test Type**: Integration

```typescript
test("[SYS-REL-3.1] request ID propagates through execution chain", async () => {
  const ctx = await createIntegrationContext();
  const requestId = "req-12345";

  await ctx.executor.execute({
    requestId,
    task: createMinimalTask(),
  });

  const spans = await ctx.traceStore.getSpans(requestId);
  assert.ok(spans.length > 0, "Trace spans created for request ID");
  for (const span of spans) {
    assert.equal(span.requestId, requestId, "Span linked to request ID");
  }
});
```

---

## 32. Architecture Invariant Automated Guard Testing

> Corresponds to v2.0 §28.

### 32.1 Purpose

Convert structural issues found in architecture review into **continuously running automated guard tests** to prevent architecture decay recurrence.

### 32.2 Guard Test Checklist

| Guard Item                     | Test File                                                     | Frequency   |
| ----------------------------- | ------------------------------------------------------------- | ------------ |
| Five-plane import isolation    | `tests/unit/platform/contracts/plane-isolation.test.ts`         | Every CI    |
| console.* disabled (non-SDK/CLI) | `tests/unit/platform/contracts/no-console-in-runtime.test.ts` | Every CI    |
| `as any` count upper bound     | `tests/unit/platform/contracts/type-safety-bounds.test.ts`     | Every CI    |
| Redis KEYS command prohibited   | `tests/unit/platform/contracts/no-redis-keys.test.ts`          | Every CI    |
| No duplicate route registration | `tests/unit/platform/contracts/no-duplicate-routes.test.ts`    | Every CI    |
| Zod boundary validation coverage | `tests/unit/platform/contracts/zod-boundary-validation.test.ts`| Every CI    |
| Stub file count not growing     | `tests/unit/platform/contracts/stub-count-ratchet.test.ts`      | Every CI    |
| Dockerfile CMD path valid      | `tests/integration/deploy/dockerfile-entrypoint.test.ts`       | Every CI    |

### 32.3 Zod Boundary Validation Coverage Guard

```typescript
test("[SYS-QUAL-7.3] API route handlers call schema.parse on request body", () => {
  const routeFiles = globSync(
    "src/platform/five-plane-interface/api/http-server/*-routes.ts",
  );
  let violations = 0;

  for (const file of routeFiles) {
    const content = readFileSync(file, "utf8");
    const handlerCount = (content.match(/router\.(post|put|patch)\(/g) ?? [])
      .length;
    const parseCount = (content.match(/\.parse\(|\.safeParse\(/g) ?? []).length;

    if (handlerCount > 0 && parseCount === 0) {
      violations++;
    }
  }

  assert.equal(
    violations,
    0,
    `${violations} route files have POST/PUT/PATCH handlers without .parse() validation`,
  );
});
```

### 32.4 Stub File Count Ratchet

```typescript
test("[SYS-QUAL-7.1] stub file count does not increase", () => {
  const allFiles = globSync("src/**/*.ts");
  let stubCount = 0;

  for (const file of allFiles) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length <= 20) stubCount++;
  }

  const MAX_STUBS = 221;
  assert.ok(
    stubCount <= MAX_STUBS,
    `Stub count ${stubCount} exceeds ratchet ${MAX_STUBS} — new stubs not allowed`,
  );
});
```

### 32.5 `as any` Count Ratchet

```typescript
test("[SYS-QUAL-7.6] as-any cast count does not increase", () => {
  const files = globSync("src/**/*.ts");
  let total = 0;

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const matches = content.match(/as\s+any\b/g);
    if (matches) total += matches.length;
  }

  const MAX_AS_ANY = 10;
  assert.ok(
    total <= MAX_AS_ANY,
    `as-any count ${total} exceeds ratchet ${MAX_AS_ANY}`,
  );
});
```

---

## 33. Stub File Coverage Gap Tracking

### 33.1 Current Stub File Inventory (v4.0)

| Subdirectory              | Total Files | Current Lines Coverage | Corresponding Architecture Chapter |
| ------------------------- | ----------- | ---------------------- | -------------------------------- |
| `platform-ops-agent/`     | 9           | 38.7%                  | §69 Platform Ops Agent            |
| `edge-runtime/`           | 5           | 96.6%                  | §63 Edge Inference                |
| `capacity-planner/`       | 5           | 94.0%                  | §68 Capacity Planning             |
| `compliance-reporter/`    | 3           | —                      | §67 Compliance Report             |
| `cost-optimizer/`         | 3           | —                      | §65 Cost Optimization            |
| `emergency/`              | 4           | 95.0%                  | §60 Emergency Brake              |
| `multimodal/`              | 7           | 97.1%                  | §68B Multimodal                 |
| `workflow-debugger/`      | 5           | 99.5%                  | §62 Workflow Debugger            |
| `explainability/`         | 2           | —                      | §59 Explainability               |

### 33.2 Stub File Exit Conditions

A stub file is considered "implemented" when:

| Condition       | Standard                          |
| --------------- | --------------------------------- |
| Lines of code   | ≥ 50 lines non-empty non-comment code |
| Class methods   | ≥ 3 non-empty method bodies       |
| Test coverage   | Branch coverage ≥ 60%               |
| Mutation score  | Mutation score ≥ 50%               |
| External callers | At least 1 non-test file imports it |

---

## 34. Test Gap and Coverage Status Summary

> Corresponds to v2.0 §30, v4.0 fully updated based on codebase measured data.

### 34.1 Source Directory → Test File Count Reference (v4.0 Measured)

| Source Directory        | Source Files | Unit Tests | Integration Tests | Total    | Ratio   |
| ---------------------- | ------------ | --------- | ----------------- | -------- | ------- |
| `src/platform/`       | 926          | 902       | 269               | 1,171    | 1.26    |
| `src/scale-ecosystem/` | 78           | 68        | 10                | 78       | 1.00    |
| `src/domains/`         | 55           | 55        | 17                | 72       | 1.31    |
| `src/ops-maturity/`    | 97           | 103       | 17                | 120      | 1.24    |
| `src/interaction/`      | 44           | 47        | 3                 | 50       | 1.14    |
| `src/org-governance/`   | 44           | 42        | 3                 | 45       | 1.02    |
| `src/sdk/`             | 96           | 65        | 39                | 104      | 1.08    |
| `src/plugins/`         | 25           | 27        | 0                 | 27       | 1.08    |
| `src/core/`            | 8            | 7         | 0                 | 7        | 0.88    |
| `src/apps/`            | 4            | 4         | 0                 | 4        | 1.00    |
| **Total**              | **1,387**    | **1,398** | **358**           | **1,803**| **1.30**|

### 34.2 E2E Test File List (17 Files)

| File                                | Covered Scenario              |
| ----------------------------------- | ---------------------------- |
| `task-lifecycle.test.ts`            | Full task lifecycle           |
| `oapeflir-full-loop.test.ts`        | OAPEFLIR complete loop       |
| `multi-step-workflow.test.ts`       | Multi-step workflow          |
| `approval-event-flow.test.ts`        | Approval event flow          |
| `gateway-webhook-flow.test.ts`       | Gateway webhook flow         |
| `streaming-response.test.ts`         | Streaming response           |
| `session-memory-flow.test.ts`        | Session memory flow          |
| `operator-takeover.test.ts`          | Operator takeover           |
| `lease-recovery.test.ts`             | Lease recovery              |
| `error-propagation.test.ts`         | Error propagation           |
| `delegation-chain-flow.test.ts`      | Delegation chain flow       |
| `domain-onboarding-flow.test.ts`    | Domain onboarding flow      |
| `execution-flow.test.ts`             | Execution flow              |
| `harness-loop-e2e.test.ts`         | Harness loop end-to-end     |
| `multi-region.test.ts`             | Multi-region                |
| `multi-step-task-execution.test.ts` | Multi-step task execution   |
| `rollback-scenario.test.ts`         | Rollback scenario           |

### 34.3 Golden Test File List (11 Files)

| File                           | Guarded Object              |
| ------------------------------ | -------------------------- |
| `openapi-document.test.ts`     | OpenAPI document structure  |
| `cli-help-text.test.ts`        | CLI help text              |
| `diagnostics-bundle.test.ts`   | Diagnostics bundle structure |
| `prompt-assembly.test.ts`     | Prompt assembly + cache key |
| `session-summary.test.ts`       | Session summary structure  |
| `release-plan-output.test.ts`   | Release plan Markdown      |
| `workflow-validation.test.ts`   | Workflow validation        |
| `phase1a-golden-tasks.test.ts` | Phase 1a golden task suite |
| `domain-baseline.test.ts`      | Domain baseline snapshot   |
| `config-schema.test.ts`        | Config schema snapshot     |
| `harness-protocol.test.ts`     | Harness protocol snapshot  |

### 34.4 Performance Test File List (10 Files)

| File                                    | Benchmark Object               |
| --------------------------------------- | ----------------------------- |
| `oapeflir-perf.test.ts`                 | OAPEFLIR loop throughput      |
| `knowledge-perf.test.ts`                 | Knowledge retrieval latency    |
| `planning-perf.test.ts`                  | Planning generation latency   |
| `feedback-perf.test.ts`                  | Feedback processing throughput |
| `plugin-perf.test.ts`                    | Plugin execution latency      |
| `handoff-perf.test.ts`                  | Handoff process latency       |
| `execution-performance.test.ts`           | Execution engine throughput   |
| `harness-component-performance.test.ts`  | Harness component latency     |
| `harness-loop-performance.test.ts`       | Harness loop throughput       |
| `prompt-engine-performance.test.ts`      | Prompt engine latency         |

### 34.5 Current Coverage Blind Spots Top-5 (v4.0 Updated)

| Rank | Blind Spot                              | Current Status                                                                                       | Recommendation                                      |
| ---- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1    | **Global line coverage** (c8 measured 0.75%) | Only 1,384 of 182,253 lines covered (6 SQLite delegating files), 977 source files at 0%           | Configure test framework to correctly collect coverage, establish real baseline |
| 2    | **E1-E6 exception event classification** (ARCH-P0-1) | Completely missing, no unified exception classification system                           | After implementation, add classification completeness + routing tests (§25.1)    |
| 3    | **SEV1-SEV4 unified severity** (ARCH-P0-2) | Code has 3 incompatible systems                                                              | After unification, add mapping + degradation tests (§25.2)                |
| 4    | **STRIDE threat model** (ARCH-P0-3)     | Completely missing                                                                                   | After implementation, add 6 threat category tests (§25.3)                 |
| 5    | **Principal type / Sandbox levels** (ARCH-P1) | Only 3/6 and 3/4 implemented respectively                                                     | After completion, add type completeness + isolation verification tests (§26.1/§26.2) |

---

> **Document End (v4.0)** — This manual upgraded from v3.0 to v4.0.
>
> **Part I** Guarantee: Tests are not few, quality is not poor, no obvious omissions.
> **Part II** Guarantee: System critical design semantics (state machine, events, concurrency, phase contracts, Harness semantic mapping) are all covered.
> **Part III** Guarantee: The **13 architecture design-implementation gaps** (3 P0 + 7 P1 + 3 P2) found by architecture review v8.0 have corresponding test specifications; after implementation, there will be no testing blind spots.
> **Part IV** Guarantee: **Engineering defects** (Redis errors, concurrent races, configuration issues, etc.) have corresponding regression test specifications; after fixing, they will not recur.
>
> **v4.0 Key Correction**: c8 measured global line coverage is only 0.75% (not the 82.4% claimed in v3.0). `.coverage-baseline.json` all values are null. Test file count (1,803) exceeds source files (1,387), but coverage collection pipeline not correctly connected — this is the highest priority fix item.
>
> **Core Philosophy**: **Coverage ratchet ensures quantity, mutation testing ensures quality, Traceability Matrix ensures completeness, PR Review ensures context, architectural semantics matrix ensures design contracts, architectural gap regression matrix ensures design-implementation alignment, system issue regression matrix ensures engineering defects do not recur. All seven are indispensable.**

---

### 31.2 [SYS-OBS-5.1] Critical Path console.* Disabled

**Defect**: 37 critical path locations use `console.*` bypassing StructuredLogger.

**Test Type**: Static Analysis / Lint

```typescript
test("[SYS-OBS-5.1] OAPEFLIR files do not use console.* directly", () => {
  const oapeflirFiles = globSync("src/platform/five-plane-orchestration/oapeflir/**/*.ts");
  for (const file of oapeflirFiles) {
    const content = readFileSync(file, "utf8");
    const consoleMatches = content.match(/console\.(log|warn|error|info)\(/g);
    assert.equal(
      consoleMatches?.length ?? 0,
      0,
      `${file} has ${consoleMatches?.length} console.* calls — use StructuredLogger`,
    );
  }
});

test("[SYS-OBS-5.1] CDC replication uses StructuredLogger", () => {
  const cdcFile = "src/scale-ecosystem/multi-region/cdc-replication-service.ts";
  const content = readFileSync(cdcFile, "utf8");
  assert.ok(
    !content.match(/console\.(log|warn|error)\(/),
    "cdc-replication-service must use StructuredLogger",
  );
});
```

### 31.3 [SYS-OBS-5.2] Prometheus Alert Rules Completeness

**Defect**: Only 3 Prometheus alert rules exist, missing DB, Redis, event loop, queue and other critical alerts.

**Test Type**: Config Validation

```typescript
test("[SYS-OBS-5.2] prometheus rules cover minimum required alert types", () => {
  const content = readFileSync(
    "deploy/prometheus/rules/automatic-agent.yml",
    "utf8",
  );
  const config = parseYaml(content);
  const alertNames = config.groups
    .flatMap((g: any) => g.rules)
    .map((r: any) => r.alert);

  const required = [
    "AutomaticAgentHighErrorRate",
    "AutomaticAgentTaskFailureRate",
    "AutomaticAgentMemoryPressure",
    "AutomaticAgentRedisDisconnected",
    "AutomaticAgentEventLoopLag",
    "AutomaticAgentQueueDepthHigh",
    "AutomaticAgentDiskUsageHigh",
    "AutomaticAgentWorkerHeartbeatTimeout",
  ];

  for (const name of required) {
    assert.ok(alertNames.includes(name), `Missing required alert: ${name}`);
  }
});
```

### 31.4 [SYS-PERF-3.2] Redis KEYS Command Prohibited

**Defect**: `distributed-lock/redis-lock-adapter.ts:236` uses `redis.keys("lock:*")` O(n) blocking.

**Test Type**: Unit / Static Analysis

```typescript
test("[SYS-PERF-3.2] redis lock adapter uses SCAN instead of KEYS", () => {
  const content = readFileSync(
    "src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts",
    "utf8",
  );
  assert.ok(!content.includes(".keys("), "Must use SCAN, not KEYS command");
  assert.ok(
    content.includes(".scan(") || content.includes("scanStream("),
    "Must use SCAN or scanStream for key iteration",
  );
});
```

### 31.5 [SYS-PERF-3.4] Unbounded Map Memory Guard

**Defect**: 20+ locations use `Map` with no deletion, causing memory leaks during long runs.

**Test Type**: Unit (Stress)

```typescript
test("[SYS-PERF-3.4] anomaly detection metricBuffer has size limit", () => {
  const service = new AnomalyDetectionService();
  for (let i = 0; i < 100_000; i++) {
    service.ingestMetric({
      name: `metric-${i}`,
      value: Math.random(),
      timestamp: Date.now(),
    });
  }
  const bufferSize = service.getMetricBufferSize();
  assert.ok(
    bufferSize <= 10_000,
    `Buffer size ${bufferSize} exceeds limit — must have eviction policy`,
  );
});
```

### 31.6 [SYS-SEC-4.2] Path Traversal Consistency

**Defect**: `knowledge-snapshot-store.ts:29` directly `readFileSync(this.snapshotPath)` without sandbox check.

**Test Type**: Security Unit

```typescript
test("[SYS-SEC-4.2] knowledge snapshot store rejects path traversal", () => {
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "../../etc/passwd" }),
    { message: /sandbox|path|denied/i },
    "Must reject paths outside sandbox root",
  );

  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "/etc/shadow" }),
    { message: /sandbox|path|denied/i },
    "Must reject absolute paths outside sandbox",
  );
});
```

### 31.7 [SYS-SEC-4.1] Environment Variable Startup Validation Completeness

**Defect**: Plugin/security related `AA_*` environment variables not in Zod startup validation scope.

**Test Type**: Unit

```typescript
test("[SYS-SEC-4.1] startup env schema validates plugin sandbox root", async () => {
  await withEnv({ AA_PLUGIN_SANDBOX_ROOT: "" }, () => {
    assert.throws(
      () => validateStartupEnv(),
      { message: /AA_PLUGIN_SANDBOX_ROOT/i },
      "Empty sandbox root must be rejected at startup",
    );
  });
});

test("[SYS-SEC-4.1] startup env schema validates all critical AA_ vars", () => {
  const schema = getStartupEnvSchema();
  const requiredKeys = Object.keys(schema.shape);

  const criticalVars = [
    "AA_STORAGE_DRIVER",
    "AA_API_HOST",
    "AA_API_PORT",
    "AA_PLUGIN_SANDBOX_ROOT",
    "AA_LOG_LEVEL",
  ];

  for (const v of criticalVars) {
    assert.ok(requiredKeys.includes(v), `${v} must be in startup env schema`);
  }
});
```

---

## 32. Architecture Invariant Automated Guard Tests

> Corresponds to v2.0 §28.

### 32.1 Purpose

Convert structural issues found in architecture review into **continuously running automated guard tests** to prevent architecture decay recurrence.

### 32.2 Guard Test Checklist

| Guard Item                        | Test File                                                        | Frequency    |
| ----------------------------- | --------------------------------------------------------------- | ------- |
| Five-plane import isolation                | `tests/unit/platform/contracts/plane-isolation.test.ts`         | Every CI |
| console.* disabled (non-SDK/CLI) | `tests/unit/platform/contracts/no-console-in-runtime.test.ts`   | Every CI |
| `as any` count upper bound             | `tests/unit/platform/contracts/type-safety-bounds.test.ts`      | Every CI |
| Redis KEYS command prohibited           | `tests/unit/platform/contracts/no-redis-keys.test.ts`           | Every CI |
| No duplicate route registration                | `tests/unit/platform/contracts/no-duplicate-routes.test.ts`     | Every CI |
| Zod boundary validation coverage              | `tests/unit/platform/contracts/zod-boundary-validation.test.ts` | Every CI |
| Stub file count not growing                  | `tests/unit/platform/contracts/stub-count-ratchet.test.ts`      | Every CI |
| Dockerfile CMD path valid       | `tests/integration/deploy/dockerfile-entrypoint.test.ts`        | Every CI |

### 32.3 Zod Boundary Validation Coverage Guard

```typescript
test("[SYS-QUAL-7.3] API route handlers call schema.parse on request body", () => {
  const routeFiles = globSync(
    "src/platform/five-plane-interface/api/http-server/*-routes.ts",
  );
  let violations = 0;

  for (const file of routeFiles) {
    const content = readFileSync(file, "utf8");
    const handlerCount = (content.match(/router\.(post|put|patch)\(/g) ?? [])
      .length;
    const parseCount = (content.match(/\.parse\(|\.safeParse\(/g) ?? []).length;

    if (handlerCount > 0 && parseCount === 0) {
      violations++;
    }
  }

  assert.equal(
    violations,
    0,
    `${violations} route files have POST/PUT/PATCH handlers without .parse() validation`,
  );
});
```

### 32.4 Stub File Count Ratchet

```typescript
test("[SYS-QUAL-7.1] stub file count does not increase", () => {
  const allFiles = globSync("src/**/*.ts");
  let stubCount = 0;

  for (const file of allFiles) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length <= 20) stubCount++;
  }

  const MAX_STUBS = 221;
  assert.ok(
    stubCount <= MAX_STUBS,
    `Stub count ${stubCount} exceeds ratchet ${MAX_STUBS} — new stubs not allowed`,
  );
});
```

### 32.5 `as any` Count Ratchet

```typescript
test("[SYS-QUAL-7.6] as-any cast count does not increase", () => {
  const files = globSync("src/**/*.ts");
  let total = 0;

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const matches = content.match(/as\s+any\b/g);
    if (matches) total += matches.length;
  }

  const MAX_AS_ANY = 10;
  assert.ok(
    total <= MAX_AS_ANY,
    `as-any count ${total} exceeds ratchet ${MAX_AS_ANY}`,
  );
});
```

---

## 33. Stub File Coverage Gap Tracking

> Corresponds to v2.0 §29.

### 33.1 ops-maturity Stub File Details

`src/ops-maturity/` is a stub file hotspot, with high stub rates in the following subdirectories:

| Subdirectory                 | Total Files | Current Line Coverage | Corresponding Architecture Chapter |
| ---------------------- | ------ | ----------------- | ------------------ |
| `platform-ops-agent/`  | 9      | 38.7%             | §69 Platform Ops Agent |
| `edge-runtime/`        | 5      | 96.6%             | §63 Edge Inference       |
| `capacity-planner/`    | 5      | 94.0%             | §68 Capacity Planning       |
| `compliance-reporter/` | 3      | —                 | §67 Compliance Report       |
| `cost-optimizer/`      | 3      | —                 | §65 Cost Optimization       |
| `emergency/`           | 4      | 95.0%             | §60 Emergency Brake       |
| `multimodal/`          | 7      | 97.1%             | §68B Multimodal        |
| `workflow-debugger/`   | 5      | 99.5%             | §62 Workflow Debugger       |
| `explainability/`      | 2      | —                 | §59 Explainability       |

### 33.2 Stub File Exit Conditions

A stub file is considered "implemented" when:

| Condition       | Standard                         |
| ---------- | ---------------------------- |
| Lines of code   | >= 50 non-empty non-comment lines of code        |
| Class methods   | >= 3 non-empty method bodies             |
| Test coverage   | Branch coverage >= 60%        |
| Mutation score   | Mutation score >= 50%         |
| External callers | At least 1 non-test file imports it |

---

## 34. Test Gap and Coverage Status Summary

> Corresponds to v2.0 §30, v4.0 fully updated based on codebase measured data.

### 34.1 Source Directory to Test File Count Mapping (v4.0 Measured)

| Source Directory        | Source Files | Unit Tests | Integration Tests | Total    | Ratio   |
| ---------------------- | --------- | --------- | ---------------- | --------- | -------- |
| `src/platform/`        | 926       | 902       | 269              | 1,171     | 1.26     |
| `src/scale-ecosystem/` | 78        | 68        | 10               | 78        | 1.00     |
| `src/domains/`         | 55        | 55        | 17               | 72        | 1.31     |
| `src/ops-maturity/`    | 97        | 103       | 17               | 120       | 1.24     |
| `src/interaction/`     | 44        | 47        | 3                | 50        | 1.14     |
| `src/org-governance/`  | 44        | 42        | 3                | 45        | 1.02     |
| `src/sdk/`             | 96        | 65        | 39               | 104       | 1.08     |
| `src/plugins/`         | 25        | 27        | 0                | 27        | 1.08     |
| `src/core/`            | 8         | 7         | 0                | 7         | 0.88     |
| `src/apps/`            | 4         | 4         | 0                | 4         | 1.00     |
| **Total**               | **1,387** | **1,398** | **358**          | **1,803** | **1.30** |

### 34.2 E2E Test File List (17 Files)

| File                                | Covered Scenario           |
| ----------------------------------- | ------------------ |
| `task-lifecycle.test.ts`            | Full task lifecycle     |
| `oapeflir-full-loop.test.ts`        | OAPEFLIR complete loop  |
| `multi-step-workflow.test.ts`       | Multi-step workflow       |
| `approval-event-flow.test.ts`       | Approval event flow         |
| `gateway-webhook-flow.test.ts`      | Gateway webhook flow    |
| `streaming-response.test.ts`        | Streaming response           |
| `session-memory-flow.test.ts`       | Session memory flow       |
| `operator-takeover.test.ts`         | Operator takeover           |
| `lease-recovery.test.ts`            | Lease recovery         |
| `error-propagation.test.ts`         | Error propagation           |
| `delegation-chain-flow.test.ts`     | Delegation chain flow       |
| `domain-onboarding-flow.test.ts`    | Domain onboarding flow       |
| `execution-flow.test.ts`            | Execution flow           |
| `harness-loop-e2e.test.ts`          | Harness loop end-to-end |
| `multi-region.test.ts`              | Multi-region             |
| `multi-step-task-execution.test.ts` | Multi-step task execution     |
| `rollback-scenario.test.ts`         | Rollback scenario           |

### 34.3 Golden Test File List (11 Files)

| File                           | Guarded Object              |
| ------------------------------ | --------------------- |
| `openapi-document.test.ts`     | OpenAPI document structure      |
| `cli-help-text.test.ts`        | CLI help text          |
| `diagnostics-bundle.test.ts`   | Diagnostics bundle structure            |
| `prompt-assembly.test.ts`      | Prompt assembly + cache key     |
| `session-summary.test.ts`      | Session summary structure          |
| `release-plan-output.test.ts`  | Release plan Markdown     |
| `workflow-validation.test.ts`  | Workflow validation            |
| `phase1a-golden-tasks.test.ts` | Phase 1a golden task suite |
| `domain-baseline.test.ts`      | Domain baseline snapshot            |
| `config-schema.test.ts`        | Config schema snapshot      |
| `harness-protocol.test.ts`     | Harness protocol snapshot      |

### 34.4 Performance Test File List (10 Files)

| File                                    | Benchmark Object            |
| --------------------------------------- | ------------------- |
| `oapeflir-perf.test.ts`                 | OAPEFLIR loop throughput |
| `knowledge-perf.test.ts`                | Knowledge retrieval latency        |
| `planning-perf.test.ts`                 | Planning generation latency        |
| `feedback-perf.test.ts`                 | Feedback processing throughput      |
| `plugin-perf.test.ts`                   | Plugin execution latency        |
| `handoff-perf.test.ts`                  | Handoff process latency        |
| `execution-performance.test.ts`         | Execution engine throughput      |
| `harness-component-performance.test.ts` | Harness component latency    |
| `harness-loop-performance.test.ts`      | Harness loop throughput  |
| `prompt-engine-performance.test.ts`     | Prompt engine latency     |

### 34.5 Current Coverage Blind Spots Top-5 (v4.0 Updated)

| Rank | Blind Spot                              | Current Status                                                                                       | Recommendation                                      |
| ---- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1    | **Global line coverage** (c8 measured 0.75%) | Only 1,384 of 182,253 lines covered (6 SQLite delegating files), 977 source files at 0%           | Configure test framework to correctly collect coverage, establish real baseline |
| 2    | **E1-E6 exception event classification** (ARCH-P0-1) | Completely missing, no unified exception classification system                           | After implementation, add classification completeness + routing tests (§25.1)    |
| 3    | **SEV1-SEV4 unified severity** (ARCH-P0-2) | Code has 3 incompatible systems                                                              | After unification, add mapping + degradation tests (§25.2)                |
| 4    | **STRIDE threat model** (ARCH-P0-3)     | Completely missing                                                                                   | After implementation, add 6 threat category tests (§25.3)                 |
| 5    | **Principal type / Sandbox levels** (ARCH-P1) | Only 3/6 and 3/4 implemented respectively                                                     | After completion, add type completeness + isolation verification tests (§26.1/§26.2) |

---

> **Document End (v4.0)** — This manual upgraded from v3.0 to v4.0.
>
> **Part I** Guarantee: Tests are not few, quality is not poor, no obvious omissions.
> **Part II** Guarantee: System critical design semantics (state machine, events, concurrency, phase contracts, Harness semantic mapping) are all covered.
> **Part III** Guarantee: The **13 architecture design-implementation gaps** (3 P0 + 7 P1 + 3 P2) found by architecture review v8.0 have corresponding test specifications; after implementation, there will be no testing blind spots.
> **Part IV** Guarantee: **Engineering defects** (Redis errors, concurrent races, configuration issues, etc.) have corresponding regression test specifications; after fixing, they will not recur.
>
> **v4.0 Key Correction**: c8 measured global line coverage is only 0.75% (not the 82.4% claimed in v3.0). `.coverage-baseline.json` all values are null. Test file count (1,803) exceeds source files (1,387), but coverage collection pipeline not correctly connected — this is the highest priority fix item.
>
> **Core Philosophy**: **Coverage ratchet ensures quantity, mutation testing ensures quality, Traceability Matrix ensures completeness, PR Review ensures context, architectural semantics matrix ensures design contracts, architectural gap regression matrix ensures design-implementation alignment, system issue regression matrix ensures engineering defects do not recur. All seven are indispensable.**
