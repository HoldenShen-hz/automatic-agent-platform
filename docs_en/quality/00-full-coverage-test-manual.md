# Full-Coverage Testing Methodology Manual

> **Document Version**: v4.1 (v4.0 main text + v4.1 gap supplements)
> **Applicable Project**: automatic-agent-platform
> **Test Framework**: Node.js built-in test runner (`node:test`) + `node:assert/strict`
> **Coverage Tool**: c8 v11.0.0 (V8 native coverage) + Istanbul reporter
> **Mutation Testing**: Stryker Mutator v9.6.1
> **Node.js Requirement**: v22+ (`--test` + `--test-concurrency` flags)
> **Last Updated**: 2026-05-18 (supplements for under-covered product-level, ops-level, UI, Mission, LLM, migration, and supply-chain testing)
> **Latest Supplement**: See [v4.1 Supplement: Under-Considered Test Types and Completion Plans](#v41-supplement-under-considered-test-types-and-completion-plans)

---

## Table of Contents

**Part I — Test Governance Fundamentals**

1. [Test Infrastructure Overview](#1-test-infrastructure-overview)
2. [Command Quick Reference](#2-command-quick-reference)
3. [Directory Structure and Layering Conventions](#3-directory-structure-and-layering-conventions)
4. [Test Authoring Conventions and Patterns](#4-test-authoring-conventions-and-patterns)
5. [Mock and Helper Toolbox](#5-mock-and-helper-toolbox)
6. [Coverage Gate Mechanism](#6-coverage-gate-mechanism)
7. [Test Gap-Proof Assurance System](#7-test-gap-proof-assurance-system)
8. [Security Regression Test Conventions](#8-security-regression-test-conventions)
9. [Golden / Snapshot Testing](#9-golden--snapshot-testing)
10. [Performance Benchmark Testing](#10-performance-benchmark-testing)
11. [Mutation Testing (Stryker)](#11-mutation-testing-stryker)
12. [CI Integration and Workflow](#12-ci-integration-and-workflow)
13. [New Module Test Checklist](#13-new-module-test-checklist)

**Part II — Architecture Semantic Coverage (v1.1 new, v1.2 supplements, v3.0 expanded)**

14. [State Machine Test Conventions](#14-state-machine-test-conventions)
15. [Event-Driven Test Conventions](#15-event-driven-test-conventions)
16. [OAPEFLIR Phase Coverage Matrix](#16-oapeflir-phase-coverage-matrix)
17. [Concurrency and Timing Test Conventions](#17-concurrency-and-timing-test-conventions)
18. [Design Specification to Test Traceability Conventions](#18-design-specification-to-test-traceability-conventions)
19. [Real Execution vs Mock Execution Boundary Conventions](#19-real-execution-vs-mock-execution-boundary-conventions)
20. [Test Debt Tiering](#20-test-debt-tiering)
21. [Failure Sample Replay Rules](#21-failure-sample-replay-rules)
22. [Test Data Governance](#22-test-data-governance)
23. [Coverage Quality Red Lines](#23-coverage-quality-red-lines)

**Part III — Architecture Gap Regression Test Matrix (v4.0 rewrite, aligned with Architecture Review v8.0)**

24. [Architecture Review-Driven Regression Testing](#24-architecture-review-driven-regression-testing)
25. [P0 Architecture Violation Gap Test Conventions](#25-p0-architecture-violation-gap-test-conventions)
26. [P1 High-Priority Gap Test Conventions](#26-p1-high-priority-gap-test-conventions)
27. [P2 Detail Completion Gap Test Conventions](#27-p2-detail-completion-gap-test-conventions)

**Part IV — System Engineering Defect Regression Testing (v2.0 original Part III preserved, v4.0 updated)**

29. [P0 Blocking Engineering Defect Test Conventions](#29-p0-blocking-engineering-defect-test-conventions)
30. [P1 Severe Engineering Defect Test Conventions](#30-p1-severe-engineering-defect-test-conventions)
31. [P2 Important Engineering Defect Test Conventions](#31-p2-important-engineering-defect-test-conventions)
32. [Architecture Invariant Auto-Guard Tests](#32-architecture-invariant-auto-guard-tests)
33. [Stub File Coverage Gap Tracking](#33-stub-file-coverage-gap-tracking)
34. [Test Gap and Coverage Status Summary](#34-test-gap-and-coverage-status-summary)

**Part V — Product-Level and Ops-Level Acceptance Testing (v4.1 supplement)**

35. [Under-Covered Test Checklist](#35-under-covered-test-checklist)
36. [New Special Test Plans](#36-new-special-test-plans)
37. [Completion Execution Roadmap](#37-completion-execution-roadmap)
38. [New Test Entry Gate Rules](#38-new-test-entry-gate-rules)
39. [Documentation Maintenance Rules](#39-documentation-maintenance-rules)
40. [Formal Interaction Acceptance Criteria](#40-formal-interaction-acceptance-criteria)

---

## 1. Test Infrastructure Overview

### 1.1 Technology Stack

| Component     | Selection                                              | Version  |
| ------------- | ------------------------------------------------------ | -------- |
| Test runner   | `node:test` (Node.js built-in)                          | Node 22+ |
| Assertions    | `node:assert/strict`                                    | Node 22+ |
| Mocking       | Hand-written mock objects + `tests/helpers/typed-factories.ts` | —        |
| Coverage      | c8 (V8 native)                                          | v11.0.0  |
| Mutation      | Stryker Mutator                                         | v9.6.1   |
| Lint          | ESLint                                                  | —        |
| Typecheck     | TypeScript `tsc --noEmit`                               | —        |

### 1.2 Key Design Decisions

- **No external test framework**: Does not use Jest / Vitest / Mocha, reducing dependencies (devDependencies only 12)
- **No external mock library**: Does not use Sinon / testdouble; creates mocks via type-safe factory functions
- **Compile-then-run**: `npm run build:test` compiles `src/` + `tests/` → `dist/`; tests run `dist/tests/**/*.test.js`
- **Coverage ratchet**: `.coverage-baseline.json` baseline can only rise, never fall; CI enforces this
- **TypeScript strict mode**: `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- **ESM modules**: Compile target ES2023 + NodeNext module system; all imports must include `.js` extension

### 1.3 Current Scale

| Metric                             | Value          |
| ---------------------------------- | -------------- |
| Total source files (`src/**/*.ts`) | **1,387**      |
| Lines of source code               | **265,020**    |
| Total test files (`tests/**/*.ts`) | **1,823**      |
| Number of `.test.ts` files         | **1,803**      |
| Lines of test code                 | **439,448**    |
| Total assertions (`assert.*` calls) | **~52,480**   |
| Test/source file ratio             | **1.30**       |
| Unit test files                    | **1,398**      |
| Integration test files             | **358**        |
| E2E test files                     | **17**         |
| Golden test files                  | **11**         |
| Performance test files             | **10**         |
| Global line coverage (c8 measured) | **0.75%**      |
| Global statement coverage (c8 measured) | **0.75%** |
| Global function coverage (c8 measured) | **0.61%**  |
| Global branch coverage (c8 measured) | **0.61%**    |

> **v4.0 Change**: Source files grew from 1,335 → 1,387 (+52); test files grew from 1,341 → 1,803 (+462); assertions grew from ~34,061 → ~52,480 (+18,419). E2E from 10 → 17, Performance from 7 → 10. **Major coverage correction**: v3.0 documentation claimed a global line coverage of 82.4%, but verification by this c8 measurement is only **0.75%** (only 1,384 of 182,253 lines are covered, all located in 6 `authoritative-task-store-delegating-*.ts` files in `src/platform/five-plane-state-evidence/truth/sqlite/`). All values in the `.coverage-baseline.json` baseline file are `null` and have never been truly populated. This indicates the coverage data cited by v3.0 came from incremental builds rather than full c8 analysis; this version corrects it to measured values.

---

## 2. Command Quick Reference

```bash
# Full test suite (including coverage gate)
npm test

# Run tests only (no gate)
npm run test:raw

# Run by layer
npm run test:unit
npm run test:integration
npm run test:golden

# Specific file
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

# Ops diagnostics
npm run doctor
npm run inspect
npm run dispatch-execution
npm run worker-handshake
npm run worker-writeback
```

---

## 3. Directory Structure and Layering Conventions

### 3.1 Directory Layout

```
tests/
├── unit/                       # Isolated logic tests (1,398 files)
│   ├── platform/               # Mirrors src/platform/ (902 files)
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
│   ├── ops-maturity/           # Ops maturity (103 files)
│   ├── scale-ecosystem/        # Scale ecosystem (70 files)
│   ├── sdk/                    # SDK (65 files)
│   ├── domains/                # Domains (55 files)
│   ├── runtime/                # Runtime cross-tests (48 files)
│   ├── interaction/            # Interaction (47 files)
│   ├── org-governance/         # Org governance (42 files)
│   ├── plugins/                # Plugins (24 files)
│   ├── core/                   # Core (13 files)
│   ├── apps/                   # Apps (6 files)
│   ├── deploy/                 # Deploy config guards (4 files)
│   └── docs/                   # Documentation guards (2 files)
├── integration/                # Cross-service / runtime tests (358 files)
│   ├── platform/               # Platform integration (269 files, includes security/ subdir)
│   ├── sdk/                    # SDK/CLI integration (35 files)
│   ├── domains/                # Domains (17 files)
│   ├── ops-maturity/           # Ops maturity (17 files)
│   ├── scale-ecosystem/        # Scale ecosystem (7 files)
│   ├── interaction/            # Interaction (3 files)
│   ├── org-governance/         # Org governance (2 files)
│   ├── stability/              # Stability (2 files)
│   ├── workflow/               # Workflow (2 files)
│   ├── orchestration/          # Orchestration (1 file)
│   ├── deploy/                 # Deploy (1 file)
│   ├── interaction-governance/ # Interaction governance (1 file)
│   └── scale-ops/              # Scale ops (1 file)
├── golden/                     # Snapshot / Golden tests (11 files)
│   └── snapshots/              # Golden file storage
├── e2e/                        # End-to-end scenarios (17 files)
├── performance/                # Performance benchmarks (10 files)
├── helpers/                    # Shared utilities (19 files + fixtures/ subdir)
│   ├── typed-factories.ts      # unsafeCast / partial / mock factories
│   ├── fixtures/               # base.ts + composite.ts
│   ├── integration-context.ts  # SQLite + TaskStore integration context
│   ├── repository-harness.ts   # Repository-layer DB tests
│   ├── e2e-harness.ts          # Full-stack E2E context
│   ├── golden.ts               # Snapshot assertion
│   ├── env.ts                  # Environment variable isolation
│   ├── fs.ts                   # Temporary file system
│   ├── concurrent-runner.ts    # Concurrent invariant verification
│   ├── process-guard.ts        # Subprocess leak detection
│   ├── api.ts                  # API integration seeding
│   ├── pg-test-helper.ts       # PostgreSQL testing
│   ├── cli.ts                  # CLI testing
│   ├── seed.ts                 # Data seeding
│   ├── test-cleanup.ts         # Singleton reset
│   ├── billing.ts              # Billing tests
│   ├── perception.ts           # Perception tests
│   └── pmf.ts                  # PMF tests
└── fixtures/                   # Migration test fixtures
```

### 3.2 Layering Rules

| Layer             | Directory                | Rule                                       | Dependencies                              |
| ----------------- | ------------------------ | ------------------------------------------ | ----------------------------------------- |
| **Unit**          | `tests/unit/`            | Single-module isolated test; mock all external dependencies | No DB, no network, no file I/O            |
| **Integration**   | `tests/integration/`     | Cross-module, CLI, runtime, sandbox         | May use SQLite in-memory, temp directories |
| **Golden**        | `tests/golden/`          | Output snapshot comparison                 | May depend on real services                |
| **E2E**           | `tests/e2e/`             | Full business flow                          | Full stack, mock provider                  |
| **Performance**   | `tests/performance/`     | Latency / throughput benchmark              | May use real DB                            |

---

## 4. Test Authoring Conventions and Patterns

### 4.1 Basic Structure

This project uses **flat `test()` calls**, not `describe()` nesting. Each test file directly imports `node:test` and `node:assert/strict`.

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

| Dimension      | Rule                                | Example                                                              |
| -------------- | ----------------------------------- | -------------------------------------------------------------------- |
| File name      | `<module-under-test>.test.ts`, kebab-case | `feedback-collector.test.ts`                                  |
| Test title     | Behavior description; subject + condition + expected | `"FeedbackCollector deduplicates signals and emits learning signals"` |
| Variable name  | camelCase consistent with production code | `const collector = new FeedbackCollector()`                  |

### 4.3 Import Paths

All imports use **relative path + `.js` extension** (because compiled to ESM):

```typescript
// Correct
import { FeedbackCollector } from "../../../../src/platform/feedback/feedback-collector.js";

// Wrong — missing .js extension
import { FeedbackCollector } from "../../../../src/platform/feedback/feedback-collector";
```

### 4.4 Assertion Patterns

This project only uses `node:assert/strict`; common APIs:

```typescript
// Value equality (===)
assert.equal(result.status, "blocked");

// Deep equality (object / array)
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

// No throw (commonly used for schema validation)
assert.doesNotThrow(() => schema.parse(validPayload));
```

### 4.5 Sync vs Async

- **Unit tests**: prefer sync. Pure functions, schema parsing, and in-memory services are all sync
- **Integration tests**: usually `async`, since they involve DB / file / subprocess
- **Principle**: If the function-under-test returns a `Promise`, mark the test function `async`; otherwise keep it sync

### 4.6 Resource Cleanup Patterns

Integration and E2E tests use the `try/finally` pattern to ensure cleanup:

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

**Prohibited** from using `afterEach` or global teardown — Node.js test runner has limited support for them, and `try/finally` is more reliable.

### 4.7 Test Data Construction

Use the fixture factory + spread overrides pattern to avoid large amounts of inline data:

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

Security tests follow the **denial-path regression** pattern — each test verifies that an attack vector is denied:

```typescript
test("command executor blocks null-byte injection in path argument", async () => {
  // 1. Build attack input
  const nullBytePath = "somefile\x00.txt";
  // 2. Execute
  const result = await executor.execute({ ..., args: [nullBytePath] });
  // 3. Assert denial + specific error code
  assert.equal(result.status, "blocked");
  assert.equal(result.error?.code, "sandbox.command_arg_path_denied");
});
```

---

## 5. Mock and Helper Toolbox

This project **does not use Sinon / testdouble**; all mocks are implemented via hand-written factory functions, centralized in `tests/helpers/`.

### 5.1 Tool Inventory

| File                    | Core Exports                                                                                                          | Purpose                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `typed-factories.ts`    | `unsafeCast<T>()`, `partial<T>()`, `createMockCacheStore()`, `createMockCacheFacade()`, `createMockCacheMetrics()`    | Type-safe mock object creation                |
| `fixtures/base.ts`      | `createMinimalTask()`, `createMinimalExecution()`, `createMinimalApproval()`                                         | Minimal valid domain records                  |
| `fixtures/composite.ts` | `createBlockedTask()`, `createApprovalRequest()`, `createCompletedTask()`, `createFailedTask()`                      | Multi-entity related scenarios                |
| `env.ts`                | `withEnv(overrides, fn)`, `withEnvSync(overrides, fn)`                                                                | Environment variable isolation                |
| `fs.ts`                 | `createTempWorkspace()`, `cleanupPath()`, `createFile()`, `createSymlink()`                                          | Temporary file system                         |
| `integration-context.ts`| `createIntegrationContext()`, `createSeededIntegrationContext()`                                                     | SQLite + TaskStore integration context        |
| `repository-harness.ts` | `createRepositoryHarness()`, `createRepositoryWithStoreHarness()`                                                     | Repository-layer DB tests                     |
| `e2e-harness.ts`        | `createE2EHarness()`, `createSeededE2EHarness()`                                                                      | Full-stack E2E context                        |
| `golden.ts`             | `assertGolden()`, `assertGoldenContains()`, `assertGoldenMatches()`                                                   | Snapshot assertion                             |
| `process-guard.ts`      | `createProcessGuard()`, `withProcessGuard()`                                                                          | Subprocess leak detection (ADR-072)           |
| `concurrent-runner.ts`  | `runConcurrentInvariant()`, `runConcurrentStateModification()`, `runCriticalSectionTest()`                          | Concurrent invariant verification             |
| `api.ts`                | `createSeededApiContext()`                                                                                            | Complete API integration seed (DB + 12 services) |

### 5.2 `unsafeCast<T>()` and `partial<T>()`

`unsafeCast<T>()` replaces scattered `as any`, making it searchable and auditable:

```typescript
import { unsafeCast } from "../../../helpers/typed-factories.js";

const fakeProvider = unsafeCast<LlmProvider>({
  generate: async () => ({ text: "mock response", tokens: 10 }),
});
```

`partial<T>()` is used to construct partially implemented interface objects (a type-correct `Partial<T>`):

```typescript
import { partial } from "../../../helpers/typed-factories.js";

const config = partial<RuntimeConfig>({ maxRetries: 3, timeoutMs: 5000 });
```

### 5.3 Mock Creation Pattern

The project uniformly uses the **object literal + interface type** style to create mocks:

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

**Do not** use `jest.fn()` / `sinon.stub()` — if you need to record calls, use a closure array:

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
// ... execute code-under-test ...
assert.equal(calls.length, 2);
assert.ok(calls[0]?.includes("started"));
```

### 5.4 Environment Variable Isolation

`withEnv()` saves the original value before the callback and restores it after the callback (even if an exception is thrown):

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

| Scenario                 | Use                                                                  |
| ------------------------ | -------------------------------------------------------------------- |
| Pure-logic unit test     | Direct `new Service()` + inline mock                                 |
| Repository test          | `createRepositoryHarness()`                                          |
| Cross-service integration test | `createIntegrationContext()` or `createSeededIntegrationContext()` |
| API endpoint test        | `createSeededApiContext()` → `ctx.createServer()`                    |
| E2E full flow            | `createE2EHarness()` or `createSeededE2EHarness()`                   |
| Subprocess-related       | Wrap with `withProcessGuard(fn)`                                     |
| Concurrency safety       | `runConcurrentInvariant()` / `runCriticalSectionTest()`              |

---

## 6. Coverage Gate Mechanism

### 6.1 Three-Layer Architecture

```
c8 (V8 native) → generate-coverage-report.mjs → check-coverage-baseline.mjs
                                                          ↓
                                                 .coverage-baseline.json (ratchet)
```

### 6.2 c8 Configuration (`.c8rc.json`)

| Parameter   | Value                                      | Description                                    |
| ----------- | ------------------------------------------ | ---------------------------------------------- |
| `reporter`  | `["text", "html", "lcov", "json-summary"]` | Output in four formats                         |
| `include`   | `["dist/src/**/*.js"]`                     | Measure production code only                   |
| `exclude`   | tests, scripts, configs, node_modules      | Exclude non-production files                   |
| `all`       | `true`                                     | Files not loaded by tests are also counted (0% coverage) |

### 6.3 Ratchet Baseline (`.coverage-baseline.json`)

Global thresholds (v4.0 c8 measured data):

| Metric      | Current Measured | v3.0 Doc Claimed | Description                          |
| ----------- | ---------------- | ---------------- | ------------------------------------ |
| Lines       | **0.75%**        | 82.4%            | Only 1,384 of 182,253 lines covered  |
| Statements  | **0.75%**        | 82.4%            | Same as above                        |
| Functions   | **0.61%**        | 88.5%            | Only 6 of 983 functions covered      |
| Branches    | **0.61%**        | 80.6%            | Same as above                        |

> **v4.0 Major Correction**: All values in `.coverage-baseline.json` are currently `null` (`directories: {}`); the baseline has never been truly populated. The 82.4% line coverage claimed by v3.0 documentation was verified by c8 `all: true` full analysis to be **0.75%**. The files actually covered are only 6 `authoritative-task-store-delegating-*.ts` files under `src/platform/five-plane-state-evidence/truth/sqlite/` (1,384 lines total, all 100% covered). The remaining 977 source files have 0% coverage. This indicates that v3.0's coverage data may have come from incomplete incremental builds or outdated reports.
>
> **Action Items**: Need to (1) run the complete `npm test` + c8 full coverage analysis, (2) populate the `.coverage-baseline.json` baseline, (3) enable the coverage gate in CI.

**Ratchet Rule**: `check-coverage-baseline.mjs` compares the current coverage to the baseline:

- Any metric **below** baseline → CI fails (exit code 1)
- Any directory **not in** baseline → CI fails (untracked directory)
- After coverage **rises**, run `npm run coverage:baseline:update` to update the baseline → new value becomes the new floor
- **Current State**: Baseline not populated; gate mechanism exists but is not in effect

### 6.4 Directory-Level Baseline (v4.0 c8 Measured Data)

> **Note**: The following data comes from `coverage/coverage-summary.json` c8 full analysis (`all: true`). Since `.coverage-baseline.json` is not populated, actual coverage status is listed here.

**Directories with coverage** (only 1 directory has non-zero coverage):

| Directory                                       | File Count | Covered Files | Lines                  | Functions |
| ----------------------------------------------- | ---------- | ------------- | ---------------------- | --------- |
| `src/platform/five-plane-state-evidence/truth/sqlite/` | 25         | 6             | 1,384/36,219 (3.82%)   | 6/167     |

The 6 covered files (all 100%):

- `authoritative-task-store-delegating-governance.ts` (346 lines)
- `authoritative-task-store-delegating-engagement.ts` (345 lines)
- `authoritative-task-store-delegating-lifecycle.ts` (246 lines)
- `authoritative-task-store-delegating-base.ts` (224 lines)
- `authoritative-task-store-delegating-runtime.ts` (213 lines)
- `authoritative-task-store-delegating-core.ts` (10 lines)

**Zero-coverage major directories** (sorted by code volume, Top-15):

| Directory                                 | File Count | Total Lines | Lines Coverage |
| ----------------------------------------- | ---------- | ----------- | -------------- |
| `src/platform/five-plane-execution/`            | 162        | 43,202      | 0%             |
| `src/platform/shared/`               | 100        | 24,079      | 0%             |
| `src/platform/five-plane-control-plane/`        | 75         | 23,555      | 0%             |
| `src/platform/five-plane-orchestration/`        | 81         | 9,332       | 0%             |
| `src/platform/five-plane-interface/`            | 49         | 8,705       | 0%             |
| `src/scale-ecosystem/marketplace/`   | 26         | 7,737       | 0%             |
| `src/sdk/cli/`                       | 78         | 6,148       | 0%             |
| `src/platform/model-gateway/`        | 17         | 5,012       | 0%             |
| `src/platform/contracts/`            | 34         | 4,041       | 0%             |
| `src/domains/registry/`              | 14         | 2,456       | 0%             |
| `src/ops-maturity/drift-detection/`  | 15         | 2,271       | 0%             |
| `src/domains/governance/`            | 4          | 1,632       | 0%             |
| `src/platform/prompt-engine/`        | 9          | 1,432       | 0%             |
| `src/scale-ecosystem/feedback-loop/` | 7          | 578         | 0%             |
| `src/interaction/nl-gateway/`        | 4          | 549         | 0%             |

> **v4.0 Note**: The high-coverage directories listed in v3.0 (e.g., execution/queue 99.7%, workflow-debugger 99.5%) are all 0% in the c8 full analysis. This further confirms that v3.0's data source is inaccurate. A real coverage increase requires ensuring `npm run build:test` compiles all source files and test files into `dist/`, and then c8 collects coverage while running tests.

### 6.5 Update Process

```bash
npm test                          # Run the full test suite
npm run coverage:baseline:update  # Execute only after all tests pass
git diff .coverage-baseline.json  # Confirm the change is reasonable
git add .coverage-baseline.json   # Commit the new baseline
```

## 7. Test Gap-Proof Assurance System

This section is the core methodology of the entire manual — answering the question **"how to ensure tests have no gaps"**. The system is composed of five layers of protection, each addressing different levels of gap risk.

### 7.1 Five-Layer Protection Model

```
┌─────────────────────────────────────────────────────────┐
│ Layer 5: PR Review Checklist (human review)              │
├─────────────────────────────────────────────────────────┤
│ Layer 4: Mutation Testing Stryker (assertion validity verification) │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Coverage Ratchet + Directory-level Baseline (numeric no-regression) │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Traceability Matrix (source file ↔ test file mapping) │
├─────────────────────────────────────────────────────────┤
│ Layer 1: Layered Testing Strategy (Unit / Integration / E2E) │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Layer 1: Layered Testing Strategy

**Gap type addressed**: Blind spots caused by improper test granularity.

Each feature point must be tested at the correct layer:

| Concern                                | Correct Test Layer                | Anti-pattern                                  |
| -------------------------------------- | --------------------------------- | --------------------------------------------- |
| Pure function logic (parse, validate, transform) | Unit                              | Using E2E to test logic branches              |
| DB read/write, transactions, migrations | Integration                       | Mocking DB to mask SQL errors                 |
| Multi-service collaboration, event propagation | Integration                  | Mocking each service individually, skipping collaboration tests |
| Security boundary (sandbox, path traversal) | Integration                      | Relying only on Unit tests of regex           |
| API contract (HTTP status codes, response body) | Integration / E2E                | Only testing service layer, not HTTP layer    |
| Full-flow business scenario            | E2E                               | None                                          |
| Output format stability                | Golden                            | Hand-writing expected strings                 |
| Concurrency safety                     | Integration + concurrent-runner   | Single-thread test, then assume thread-safe   |

**Execution Rules**:

1. Every `src/platform/<module>/` directory must have a corresponding `tests/unit/platform/<module>/` directory
2. Every exported service class must have at least 1 unit test file
3. Features involving DB / file system / subprocess must have integration tests
4. Security-related changes must have a denial-path regression test

### 7.3 Layer 2: Traceability Matrix

**Gap type addressed**: Source files with no corresponding test files.

Build a **source file → test file** mapping relationship to ensure every production file has a corresponding test.

**Generation Method**:

```bash
# Step 1: List all production source files (excluding index.ts, types)
find src/core -name "*.ts" ! -name "index.ts" ! -name "*.d.ts" ! -path "*/types/*" | sort > /tmp/src-files.txt

# Step 2: List all test files
find tests/unit tests/integration -name "*.test.ts" | sort > /tmp/test-files.txt

# Step 3: Compare and find source files with no test coverage
while read src; do
  base=$(basename "$src" .ts)
  if ! grep -q "$base" /tmp/test-files.txt; then
    echo "UNCOVERED: $src"
  fi
done < /tmp/src-files.txt
```

**Matrix Maintenance Rules**:

- Every new `.ts` source file in a PR must have a corresponding `.test.ts` file
- If a file truly does not need testing (pure type definition, barrel export), mark `N/A` + reason in the matrix
- At the end of every sprint, run the above script to update the gap list

### 7.4 Layer 3: Coverage Ratchet

**Gap type addressed**: Existing tests are deleted or new code is not covered.

See [§6 Coverage Gate Mechanism](#6-coverage-gate-mechanism). Key points:

- **Global gate**: lines / statements / functions / branches — four dimensions
- **Directory-level gate**: each `src/platform/<module>` has its own baseline
- **`all: true`**: Files not imported by any test are also counted (displayed as 0% coverage), preventing "no one references it, so no one tests it"
- **Can only rise**: Baseline values monotonically increase via `npm run coverage:baseline:update`

**Limitations of Coverage**: Coverage only says "the code was executed", not "the behavior was verified". For example:

```typescript
test("calls the function", () => {
  myFunction(); // 100% line coverage, but 0 assertions
});
```

This is why Layer 4 is needed.

### 7.5 Layer 4: Mutation Testing

**Gap type addressed**: Tests execute the code but lack effective assertions.

Stryker injects **mutants** into the code, for example:

- `>` changed to `>=`
- `true` changed to `false`
- Delete an entire statement
- String `"error"` changed to `""`

If a test still passes after a mutation is injected (mutant survived), it indicates the test does not effectively detect this logic.

See [§11 Mutation Testing (Stryker)](#11-mutation-testing-stryker). Thresholds:

- **break = 50%**: CI fails directly below this value
- **low = 60%**: yellow warning
- **high = 80%**: green target

**Complementary Relationship Between Mutation Testing and Coverage**:

| Scenario             | Line Coverage | Mutation Score | Problem         |
| -------------------- | ------------- | -------------- | --------------- |
| Executed with assertions | High          | High           | None            |
| Executed without assertions | High          | **Low**        | Missing assertions |
| Not executed         | **Low**       | Low            | Missing tests   |
| Dead code            | Low           | Low            | Needs removal   |

### 7.6 Layer 5: PR Review Checklist

**Gap type addressed**: Logical gaps that automated tools cannot detect.

Before each PR is merged, the reviewer checks against the following list:

- [ ] Does every new/modified public function have a corresponding test?
- [ ] Are both the happy path **and** the error path covered?
- [ ] Are boundary conditions tested (empty array, null, 0, MAX_INT, timeout)?
- [ ] Do security changes have a denial-path regression?
- [ ] Do async functions test the reject/error path?
- [ ] Do config changes have a corresponding config validation test?
- [ ] Does coverage rise or stay flat (not decline)?
- [ ] Does mutation test score rise or stay flat?

### 7.7 Gap Type Classification and Corresponding Protection

| Gap Type              | Description                                  | Detection Layer                                |
| --------------------- | -------------------------------------------- | ---------------------------------------------- |
| **File-level gap**    | Whole source file has no test                | Layer 2 (Matrix) + Layer 3 (`all: true`)       |
| **Function-level gap** | An exported function has no test            | Layer 3 (function coverage) + Layer 5 (Review) |
| **Branch-level gap**  | A branch of if/else/switch is not covered    | Layer 3 (branch coverage) + Layer 4 (Stryker)  |
| **Assertion-level gap** | Code executed but no result verified       | Layer 4 (Stryker mutant survived)              |
| **Scenario-level gap** | Missing tests for specific business scenarios | Layer 5 (Review)                              |
| **Boundary condition gap** | Empty input / extremes / concurrency not covered | Layer 4 + Layer 5                       |
| **Regression gap**    | Bug fix has no regression test               | Layer 5 (Review) + Layer 3 (ratchet no-regression) |
| **Security gap**      | Attack vectors untested                      | Layer 1 (denial-path convention) + Layer 5     |

### 7.8 Test Completion Prioritization Method

When gaps are discovered, prioritize completion as follows:

```
P0 — Security boundary untested (sandbox escape, path traversal, injection attack)
P1 — Core orchestrator / service has no test (coverage 0%)
P2 — Has tests but branch coverage < 60%
P3 — Has tests but mutation score < 50% (insufficient assertions)
P4 — Helper functions / utility classes lack boundary condition tests
P5 — Type definition schema validation tests
```

### 7.9 Continuous Assurance Process

```
Development phase → Write code + Write tests (TDD or Code-then-Test)
                    ↓
Local validation → npm test (coverage + gate)
                    ↓
PR submission → CI runs automatically: lint → typecheck → test → coverage:gate
                    ↓
PR Review → Human Checklist (§7.6)
                    ↓
Main merge → Stryker mutation testing (triggered by push to main)
                    ↓
Sprint end → Run Traceability Matrix script, update gap list
```

---

## 8. Security Regression Test Conventions

### 8.1 Denial-Path Regression Methodology

Core principle of security testing: **one test per attack vector, asserting denial status + specific error code**.

```
Attack surface identification → Build malicious input → Call target interface → Assert blocked/denied + error code
```

### 8.2 Attack Surface Classification

| Attack Surface        | Test Target                       | Typical Attack Vectors                                       |
| --------------------- | --------------------------------- | ------------------------------------------------------------ |
| **Path traversal**    | Sandbox file system isolation    | `../`, symlink, double-encoded `%2f`, null-byte `\x00`      |
| **Command injection** | Command executor argument filtering | `;`, `$()`, `` ` ``, `&&`, `\|\|`, `\|`, `${VAR}`            |
| **Permission bypass** | Execution-level tool authorization | Modify allowedToolsJson, malformed allowlist                |
| **Script escape**     | Interpreter path restriction      | Out-of-workspace script path, absolute path to outside      |
| **Input validation**  | Schema / config validation       | Excessively long strings, type mismatch, missing required fields |
| **Concurrency attack** | Locks and transaction isolation | Approve the same request simultaneously, concurrent write to the same resource |

### 8.3 Security Test Structure Template

```typescript
test("<component> blocks <attack type> <specific description>", async () => {
  const workspace = createTempWorkspace("aa-security-");
  try {
    // 1. Build attack input
    const maliciousInput = buildAttackPayload();

    // 2. Execute target interface
    const result = await targetService.execute({
      ...validBaseRequest,
      ...maliciousInput,
    });

    // 3. Assert denial
    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "specific.error_code");
  } finally {
    cleanupPath(workspace);
  }
});
```

### 8.4 Security Test Naming Conventions

The title must clearly state **who denied what**:

```
✓ "command executor blocks symlink cwd traversal before spawning the process"
✓ "command executor blocks null-byte injection in path argument"
✓ "sandbox policy denies write outside workspace root"
✗ "security test 1"
✗ "test injection"
```

### 8.5 Scenarios That Security Tests Must Cover

Each component involving a security boundary must cover at least the following scenarios:

1. **Normal legitimate request** — confirm happy path works (at least 1 positive test)
2. **Path escape** — at least cover `../`, symlink, absolute path — three vectors
3. **Input injection** — at least cover shell metachar and null-byte — two vectors
4. **Insufficient permissions** — unauthorized tool, wrong domain/role
5. **Malformed input** — malformed JSON, type mismatch, null values
6. **Fail-close** — when the security check logic itself errors, default to deny rather than allow

---

## 9. Golden / Snapshot Testing

### 9.1 Applicable Scenarios

Golden testing is suitable for scenarios where **output format needs to be stable**:

- CLI output format (`inspect`, `doctor`, `dispatch-execution` command output)
- API response body structure
- Configuration file generation result
- Log format

### 9.2 How It Works

```
First run (UPDATE_GOLDEN=1) → write actual output to tests/golden/snapshots/<name>.golden
Subsequent runs → compare actual output with .golden file
  Match → test passes
  Mismatch → test fails, prompting to run UPDATE_GOLDEN=1 to update
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

| API                                     | Purpose                |
| --------------------------------------- | ---------------------- |
| `assertGolden(name, actual)`            | Full JSON match        |
| `assertGoldenContains(name, substring)` | Contains substring     |
| `assertGoldenMatches(name, regex)`      | Regex match            |

### 9.4 Updating Snapshots

```bash
UPDATE_GOLDEN=1 npm run test:golden
git diff tests/golden/snapshots/       # Review changes
git add tests/golden/snapshots/
```

### 9.5 Golden Test Notes

- **Do not** include unstable fields like timestamps or random IDs in golden files — normalize before snapshotting
- Snapshot files must be managed in git
- Use a version suffix in Golden file names (`-v1`, `-v2`); create a new version when the output format is intentionally changed

---

## 10. Performance Benchmark Testing

### 10.1 Applicable Scenarios

- Critical path latency regression detection
- Throughput benchmarks (tasks/sec, queries/sec)
- Memory usage benchmarks

### 10.2 Test Location

The `tests/performance/` directory; file name `*.test.ts`; run via `npm run test:performance`.

### 10.3 Authoring Pattern

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

- **Isolated run**: `npm run test:performance` runs independently of the main test suite to avoid interfering with coverage
- **Absolute threshold**: Assert absolute performance metrics (e.g. > 1000 ops/sec), not relative changes
- **Warmup**: Perform a small number of warmup iterations before timing, to exclude JIT compilation effects
- **Multiple runs, take the median**: For latency-sensitive tests, take the median of multiple runs to reduce variance
- **Optional in CI**: Performance tests run as an optional job in CI and do not block merging (due to large machine differences)

---

## 11. Mutation Testing (Stryker)

### 11.1 Concept

Mutation testing answers a question that coverage cannot answer: **Are the test's assertions truly effective?**

Stryker injects small mutations (mutants) into the source code, then runs the test suite. If the tests still pass (mutant survived), it means no assertion can detect this code change — i.e. there is a missing assertion.

### 11.2 Configuration (`stryker.config.mjs`)

| Parameter           | Value                            | Description                                    |
| ------------------- | -------------------------------- | ---------------------------------------------- |
| `testRunner`        | `"command"`                      | Run via `npm run test:unit`                    |
| `mutate`            | `src/platform/**/*.ts`           | Mutation scope: platform business code         |
| Exclude             | `.d.ts`, `index.ts`, `types/**`  | Do not mutate type definitions and barrel      |
| `thresholds.break`  | 50                               | Below 50% → CI fails                           |
| `thresholds.low`    | 60                               | Below 60% → yellow warning                     |
| `thresholds.high`   | 80                               | Above 80% → green                              |
| `coverageAnalysis`  | `"perTest"`                      | Analyze coverage per test individually         |

### 11.3 Running

```bash
npm run test:mutation         # Local run
# In CI, runs only on push to main (time-consuming)
```

The report is output to `reports/mutation/`, including an HTML visualization report.

### 11.4 Interpreting the Report

| Status              | Meaning                                          | Action                                |
| ------------------- | ------------------------------------------------ | ------------------------------------- |
| **Killed**          | Test detected the mutation and failed            | No action needed                      |
| **Survived**        | Tests still pass after mutation                  | **Need to add stronger assertions**   |
| **No coverage**     | Mutated code was not executed by any test        | Need to add tests                     |
| **Timeout**         | Mutation caused infinite loop / timeout          | Treated as killed                     |
| **Runtime error**   | Mutation caused runtime crash                    | Treated as killed                     |

### 11.5 Handling Survived Mutants

```typescript
// Suppose Stryker reports: after mutating `>` to `>=`, mutant survived
// Original code: if (retries > maxRetries) throw new Error("exceeded");

// Indicates missing boundary test. Need to add:
test("throws when retries equals maxRetries", () => {
  // Test the behavior when retries === maxRetries
  // If it should throw, add assert.throws
  // If it should not throw, add assert.doesNotThrow
});
```

### 11.6 Collaboration Between Mutation Testing and Other Layers

- **Coverage** tells you "which code is not executed" → add tests
- **Stryker** tells you "which code is executed but has insufficient assertions" → strengthen assertions
- The two are complementary and not substitutable

---

## 12. CI Integration and Workflow

### 12.1 CI Pipeline Architecture

```yaml
CI (GitHub Actions — .github/workflows/ci.yml)
├── validate (Node 22)
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
- `dr-validation.yml` — DR validation
- `publish-image.yml` — Image publishing
- `secret-provider-integration.yml` — Secret provider integration tests

### 12.2 Trigger Conditions

| Job            | Push to main | PR  | Other                  |
| -------------- | ------------ | --- | ---------------------- |
| validate       | ✓            | ✓   | `codex/**` branches    |
| pg-integration | ✓            | ✓   | —                      |
| mutation-test  | ✓            | ✗   | main only              |
| security       | ✓            | ✓   | —                      |
| trivy-scan     | ✓            | ✓   | —                      |

### 12.3 Test Assurance Points in CI

| Assurance Point      | Tool                          | Failure Condition            |
| -------------------- | ----------------------------- | ---------------------------- |
| Code style           | ESLint                        | Any lint error               |
| Type safety          | tsc --noEmit                  | Any type error               |
| Dependency security  | npm audit                     | HIGH/CRITICAL vulnerabilities|
| Functional correctness | node --test                 | Any test failure             |
| Coverage no-regression | check-coverage-baseline.mjs | Below baseline               |
| Mutation score       | Stryker                       | Below break=50%              |
| Static analysis      | CodeQL                        | Security defects found       |
| Container security   | Trivy                         | CRITICAL/HIGH vulnerabilities |

### 12.4 Test Result Archiving

CI automatically uploads the following artifacts:

- `test-results/` — Test execution logs
- `coverage/` — HTML coverage report
- `reports/mutation/` — Stryker HTML report

---

## 13. New Module Test Checklist

When creating a new module, follow this Checklist to ensure test completeness:

### 13.1 Directory and Files

- [ ] Create `tests/unit/platform/<module>/` or `tests/unit/<area>/<module>/` directory
- [ ] Create corresponding `<service-name>.test.ts` for each service class
- [ ] If DB is needed → create `tests/integration/platform/<module>/` directory

### 13.2 Test Layers

- [ ] **Unit tests**: each exported function / class method
  - [ ] Happy path (normal input → expected output)
  - [ ] Error path (illegal input → expected exception / error code)
  - [ ] Boundary conditions (null, zero, maximum, empty array)
- [ ] **Schema tests** (if using Zod):
  - [ ] Valid minimal payload → `doesNotThrow`
  - [ ] Invalid payload → `throws`
  - [ ] Optional field missing → `doesNotThrow`
- [ ] **Integration tests** (if involving DB / file / subprocess):
  - [ ] Use `createIntegrationContext()` or `createRepositoryHarness()`
  - [ ] `try/finally` to ensure cleanup
- [ ] **Security tests** (if involving security boundaries):
  - [ ] Denial-path regression covers each attack vector
  - [ ] Fail-close test

### 13.3 Coverage

- [ ] Run `npm test` locally to confirm coverage is not below the global baseline
- [ ] Run `npm run coverage:baseline:update` to update the baseline
- [ ] Confirm the new directory appears in `.coverage-baseline.json`

### 13.4 Mutation Testing

- [ ] Confirm the new module path is within the `mutate` glob in `stryker.config.mjs`
- [ ] Run `npm run test:mutation` locally to confirm no large number of survived mutants

### 13.5 CI Compatibility

- [ ] Tests pass under the Node 22 baseline
- [ ] Tests support `--test-concurrency=12` parallel run, with no shared-state conflicts
- [ ] No hardcoded absolute paths, port numbers, or timestamps

### 13.6 Documentation

- [ ] Update the source file ↔ test file mapping in the Traceability Matrix (§7.3)
- [ ] If new Helpers / Fixtures are introduced, update the §5 tool inventory

---

---

---

# Part II — Architecture Semantic Coverage (v1.1 new, v1.2 supplements, v3.0 expanded)

> Part I addresses "code coverage governance" — ensuring every line of code is executed and every assertion is valid.
> Part II addresses "architecture semantic coverage" — ensuring the system's key design semantics (state machine, events, concurrency, phase contracts) are all covered by tests.

---

## 14. State Machine Test Conventions

### 14.1 Why a Separate Convention is Needed

This system contains **5 core state machines** (Task / Workflow / Session / Execution / Approval) and **40+ auxiliary lifecycle enumerations** (Worker, Plugin, Rollout, Circuit Breaker, Lease, Repair Pipeline, etc.).

Ordinary line / branch coverage cannot guarantee:

- Each legal state transition is tested
- Each illegal state transition is rejected
- Terminal states cannot be transitioned again
- Atomicity of cross-entity cascading transitions

### 14.2 Core State Machine Inventory

| State Machine   | Definition File                                                    | Validation File                                                                          | State Count | Terminal States                          |
| --------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ----------- | ---------------------------------------- |
| **Task**        | `src/platform/five-plane-execution/state-transition/types.ts`      | `src/platform/five-plane-execution/state-transition/transition-service.ts`               | 7           | done, failed, cancelled                  |
| **Workflow**    | Same as above                                                      | Same as above                                                                             | 7           | completed, failed, cancelled             |
| **Session**     | Same as above                                                      | Same as above                                                                             | 7           | completed, failed, cancelled             |
| **Execution**   | Same as above                                                      | Same as above                                                                             | 8           | succeeded, failed, cancelled, superseded |
| **Approval**    | Same as above                                                      | Same as above                                                                             | 5           | approved, rejected, expired, cancelled   |

These 5 state machines are implemented via the `StateTransitionMachine<T>` generic class; the `assertTransition()` method uses CAS to prevent concurrent overwrites.

### 14.3 Three-Layer State Machine Test Requirements

#### A. Full Coverage of Legal Transitions (Transition Coverage)

Each **legal transition edge** of each state machine must have at least one test:

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

Transitions from **each terminal state** to any non-self state must be rejection-tested:

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

**Quantitative standard**: All terminal states × all non-self states = rejection must be tested

#### C. Cross-Entity Cascading Transitions (Cascade Coverage)

`TransitionService` provides `applyTaskTerminalState` and `ApprovalBlockingTransitionService`, which atomically cascade transitions across multiple entities.

Cascade scenarios that must be tested:

| Trigger             | Task              | Workflow  | Session       | Execution | Approval  |
| ------------------- | ----------------- | --------- | ------------- | --------- | --------- |
| task → done         | done              | completed | completed     | succeeded | —         |
| task → failed       | failed            | failed    | failed        | failed    | —         |
| task → cancelled    | cancelled         | cancelled | cancelled     | cancelled | —         |
| approval needed     | awaiting_decision | paused    | awaiting_user | blocked   | requested |
| approval granted    | in_progress       | running   | streaming     | executing | approved  |

### 14.4 Auxiliary State Machine Test Requirements

For non-core state machines (Circuit Breaker, Rollout, Repair Pipeline, Plugin, etc.), requirements:

| Category                              | Requirement                                            |
| ------------------------------------- | ------------------------------------------------------ |
| Has `assertTransition()` validation   | Same as core three-layer requirement                   |
| Has `transitionTo()` without validation | At least cover happy path + terminal states           |
| Only used as enumeration values       | Cover each enumeration value appearing in at least one test |

### 14.5 Special Circuit Breaker State Machine Requirements

The Circuit Breaker (`closed → open → half_open → closed`) involves time and counts, so additional tests are required:

- [ ] Consecutive failures ≥ threshold → trigger open
- [ ] Failure rate ≥ 50% → trigger open
- [ ] Requests rejected in open state + return `retryAfterMs`
- [ ] After resetTimeoutMs → transition to half_open
- [ ] half_open single probe success / failure behavior
- [ ] Consecutive successes ≥ halfOpenSuccessThreshold → recover closed

### 14.6 Transition Table Single-Source Rule

**Hard requirement**: The canonical transition map in `transition-service.ts` is the **single authoritative source** of state transitions. Test cases **must not** manually hard-code a duplicate transition table.

#### A. Principles

| Entry         | Rule                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------- |
| Single source | All legal / illegal transition judgments must come from the production map in `TransitionService` |
| No copies     | Test code must not contain hand-written copies like `const allowedTransitions = { pending: ["running", ...] }` |
| Data-driven   | Test matrix must be **automatically generated** from the production map, not manually enumerated |
| Sync guarantee | When the production map adds / removes transitions, tests automatically sense this, no manual sync needed |

#### B. Data-Driven Test Generation Template

```typescript
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  TRANSITION_MAP,
  ALL_STATES,
} from "../../src/platform/five-plane-execution/state-transition/types.js";

// Automatically generate legal transition pairs from the production map
const validPairs: Array<[string, string]> = [];
for (const [from, toSet] of Object.entries(TRANSITION_MAP)) {
  for (const to of toSet) {
    validPairs.push([from, to]);
  }
}

// Automatically generate illegal transition pairs (full permutation - legal pairs - self-transition)
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

- Coverage gate adds a check: if a test file contains a hard-coded object literal with the same key set as `TRANSITION_MAP`, CI reports a warning
- PR Review checklist adds an item: "Are the state machine tests automatically derived from the production map?"

---

## 15. Event-Driven Test Conventions

### 15.1 Event System Architecture

```
Producer → TypedEventBus → DurableEventBus → SQLite
                                              ↓
                            EventOpsService → deliverPending() → Consumer
                                              ↓ (after 3 retries)
                                         Dead Letter Table
```

This system defines **48 typed events**, divided into 3 Tiers:

| Tier        | Semantics                       | Ack Required | Event Count | Example                                       |
| ----------- | ------------------------------- | ------------ | ----------- | --------------------------------------------- |
| **Tier 1**  | Must persist + must ack         | Required     | 9           | `task:status_changed`, `decision:requested`   |
| **Tier 2**  | Persist, ack optional           | Recommended  | ~35         | `dispatch:*`, `worker:*`, `plugin:*`, `skill:*` |
| **Tier 3**  | Best-effort delivery            | None         | ~4          | `stream:chunk_emitted`, `perf:*`              |

### 15.2 Tiered Test Requirements

#### Tier 1 Events (9 types) — Highest Test Requirements

Each Tier 1 event must cover the complete lifecycle:

| Phase          | Test Content                                              |
| -------------- | --------------------------------------------------------- |
| **Schema**     | Payload satisfies Zod validator (valid + invalid)         |
| **Publish**    | Correctly written to events table + creates ack record     |
| **Deliver**    | `deliverPending()` delivers the event to registered consumer |
| **Ack**        | Consumer processes successfully → ack status = `"acked"`  |
| **Retry**      | Consumer processing fails → exponential backoff retry (100ms → 5s) |
| **Dead Letter**| 3 failed retries → write to dead_letter table             |
| **Replay**     | `EventOpsService.replayConsumer()` redelivers             |
| **Integrity**  | SHA-256 hash chain not tampered with                      |

#### Tier 2 Events — Medium Test Requirements

| Phase          | Test Content                                |
| -------------- | ------------------------------------------- |
| **Schema**     | Payload satisfies Zod validator              |
| **Publish**    | Correctly written to events table            |
| **Deliver**    | At least one consumer can receive it         |
| **Idempotency**| Events with `idempotencyKey` are not consumed repeatedly |

#### Tier 3 Events — Basic Test Requirements

| Phase          | Test Content                              |
| -------------- | ----------------------------------------- |
| **Publish**    | Does not throw                            |
| **Best-effort**| Consumer offline does not block event     |

### 15.3 DLQ Test Requirements

The system has **3 independent DLQs**:

| DLQ         | Location                            | Test Focus                                                  |
| ----------- | ----------------------------------- | ----------------------------------------------------------- |
| Event DLQ   | `event_dead_letters` table          | Correctly entering DLQ after 3 retries + `dlq-manager list` queryable |
| Gateway DLQ | `gateway_dead_letters` table        | Non-retryable status code goes directly to DLQ, retryable status code goes to DLQ after retry |
| Jobs DLQ    | `queue_jobs.status = "dead_letter"` | Goes to DLQ after exceeding `maxAttempts`                   |

Each DLQ must test:

- [ ] Messages enter DLQ under correct conditions
- [ ] DLQ messages are queryable (list / count)
- [ ] DLQ messages can be cleared (purge)
- [ ] Retryable DLQ messages can be re-enqueued

### 15.4 Event Schema Drift Regression

The `RAW_EVENT_SCHEMA_REGISTRY` in `event-registry.ts` defines the schema for all events:

```typescript
test("all TypedEventPayloadMap keys are registered in EVENT_SCHEMA_REGISTRY", () => {
  // Compile-time already has MissingTypedEventDefinitions type check
  // Runtime supplementary validation
  for (const eventType of Object.keys(TypedEventPayloadMap)) {
    assert.ok(hasEventSchema(eventType), `Missing schema for ${eventType}`);
  }
});
```

### 15.5 Consumer Registration Completeness

Each Tier 1 event has a specified consumer in `REQUIRED_CONSUMERS_BY_EVENT_TYPE`. Tests must verify:

```typescript
test("all Tier 1 events have at least one required consumer", () => {
  for (const eventType of TIER_1_EVENT_TYPES) {
    const consumers = getRequiredConsumers(eventType);
    assert.ok(consumers.length > 0, `${eventType} has no required consumers`);
  }
});
```

### 15.6 Consumer Side-Effect Idempotency (Hard Requirement)

All **retryable consumers** (Tier 1 must retry, Tier 2 recommended to retry) must pass idempotency tests. Repeated consumption of the same event **must not** produce:

| Prohibited Behavior        | Verification Method                                                       |
| -------------------------- | ------------------------------------------------------------------------- |
| Duplicate DB writes        | After delivering the same event 2 times, the relevant table row count does not change |
| Duplicate notifications / outbound messages | Mock notification channel, assert call count = 1         |
| Duplicate downstream side effects | Mock downstream service, assert idempotency key is deduplicated     |
| State machine repeated transition | Second delivery does not trigger `assertTransition()` (state is already in terminal or target) |

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

  // Duplicate consumption (simulate retry / at-least-once delivery)
  await consumer.handle(event, { db, notifier });
  const rowsAfterSecond = await db.count("task_completions");

  // Assert no side-effect duplication
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
- All handlers that implement the `onEvent()` / `handleEvent()` interface
- Gateway DLQ replay consumer

---

## 16. OAPEFLIR Phase Coverage Matrix

### 16.1 Coverage Matrix Definition

Not by directory, not by file, but by **the design semantics of the 8 OAPEFLIR phases** to define the minimum test set.

Each phase must cover **7 standard paths**:

| Path Code | Path Name                            | Description                                                            |
| --------- | ------------------------------------ | ---------------------------------------------------------------------- |
| P1        | **Happy Path**                       | Standard input → phase completes → correct output                      |
| P2        | **Degraded Path**                    | Partial input missing / insufficient quality → degraded handling → output with warning |
| P3        | **Invalid Input Path**               | Illegal / malformed input → reject or fail-fast                        |
| P4        | **Timeout Path**                     | Phase execution times out → correctly abort + cleanup resources         |
| P5        | **Skip Path**                        | Phase skipped (conditions not met) → stage status = `"skipped"`        |
| P6        | **Downstream Contract Violation**    | Upstream output does not satisfy current phase's input contract → reject or fall back |
| P7        | **Human Intervention Path**          | Phase needs human intervention → pause waiting for approval / confirmation → resume or terminate |

### 16.2 Per-Phase Coverage Matrix

#### Observe

| Path | Test Scenario                              | Assertion Focus                                       |
| ---- | ------------------------------------------ | ----------------------------------------------------- |
| P1   | Standard task input → generate TaskSituation | `objective`, `currentPhase`, `codebaseSnapshot` fields complete |
| P2   | Empty codebase / no fileRefs               | TaskSituation can still be generated, `fileRefs: []`  |
| P3   | Illegal taskId / empty objective           | Schema rejection                                      |
| P4   | Collection timeout                         | Timeout abort + return existing snapshot              |
| P5   | Input cached / no changes                  | Skip re-collection                                    |
| P6   | —                                          | No upstream as first phase                            |
| P7   | Task requires human scope confirmation     | Pause collection → wait for human confirmation → resume |

#### Assess

| Path | Test Scenario                                  | Assertion Focus                                                    |
| ---- | ---------------------------------------------- | ----------------------------------------------------------------- |
| P1   | Standard TaskSituation → UnifiedAssessment    | complexity / risk / routingDecision / resourceAllocation reasonable |
| P2   | High-uncertainty task                          | Correctly upgrade executionMode to `"supervised"`                |
| P3   | Malformed situationRef                         | Schema rejection                                                  |
| P4   | Assessment timeout                             | Degrade to default assessment                                    |
| P5   | Simple task skip deep assessment               | Use the quick-assessment path directly                            |
| P6   | TaskSituation missing required fields          | Reject + fall back to Observe                                     |
| P7   | High uncertainty → need human supervision      | executionMode upgraded to `"supervised"`, continue after approval |

#### Plan

| Path | Test Scenario                                | Assertion Focus                                                |
| ---- | -------------------------------------------- | ------------------------------------------------------------- |
| P1   | Standard assessment → Plan with steps        | stepId unique, dependencies legal, strategy correct           |
| P2   | High-complexity task                         | Multi-step DAG + parallel steps                               |
| P3   | version = 0 / steps empty                    | Schema rejection                                              |
| P4   | Planning timeout                             | Return minimum viable plan                                    |
| P5   | Assessment result indicates no planning needed | stage skipped                                               |
| P6   | AssessmentRef does not exist                 | Reject                                                        |
| P7   | High-risk plan needs human review            | plan status = `"pending_approval"` → begin execution after approval |

#### Execute

| Path | Test Scenario                              | Assertion Focus                                               |
| ---- | ------------------------------------------ | ------------------------------------------------------------- |
| P1   | Single-step execution → DualChannelStepOutput | userFacingResult + systemTelemetry complete                  |
| P2   | Partial step failure → partial success     | Output of successful steps is preserved                      |
| P3   | Illegal tool call / sandbox rejection      | `status: "blocked"` + error code                              |
| P4   | Step timeout                               | Step marked `"failed"` + `code: "tool.timeout"`              |
| P5   | All steps already completed (replay)       | Skip                                                          |
| P6   | Plan step references a non-existent tool   | Reject + fall back to Plan                                    |
| P7   | Step triggers approval blocking            | `status: "blocked_awaiting_approval"` → resume execution after approval |

#### Feedback

| Path | Test Scenario                            | Assertion Focus                                              |
| ---- | ---------------------------------------- | ------------------------------------------------------------ |
| P1   | Execution result → FeedbackSignal set    | Signals correctly classified (success / failure / correction) |
| P2   | Duplicate signal                         | Deduplication takes effect                                   |
| P3   | Empty signal list                        | Return empty set, no error                                    |
| P4   | Signal collection timeout                | Return collected portion                                     |
| P5   | No execution output                      | Skip feedback                                                |
| P6   | stepOutputRefs reference non-existent    | Ignore + warning                                             |
| P7   | Feedback result needs human accuracy confirmation | Signal marked `"pending_review"` → takes effect after human confirmation |

#### Learn

| Path | Test Scenario                                                     | Assertion Focus                                              |
| ---- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| P1   | Feedback signals → LearningSignal (failure_pattern / recovery_playbook) | learningType + sourceSignalIds correct                       |
| P2   | Low-confidence pattern                                            | Marked as tentative                                          |
| P3   | Illegal learningType                                             | Reject                                                        |
| P4   | Mining timeout                                                    | Return empty                                                 |
| P5   | No failure signals                                                | Skip learning                                                |
| P6   | FeedbackSignal structure incomplete                              | Reject                                                        |
| P7   | Learning conclusion needs expert review                           | learning marked `"expert_review_required"` → recorded after review |

#### Improve

| Path | Test Scenario                                                     | Assertion Focus                                              |
| ---- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| P1   | Learning output → ImprovementCandidate (status: proposed → approved) | changeScope + expectedBenefit reasonable                     |
| P2   | Improvement exceeds autonomy boundary                             | status remains `"proposed"`, needs human approval            |
| P3   | Empty learning output                                             | Do not produce candidate                                      |
| P4   | Evaluation timeout                                                | candidate marked `"rejected"`                               |
| P5   | No improvements available                                         | Skip                                                          |
| P6   | LearningSignal references illegal sourceSignalRefs                | Reject                                                        |
| P7   | Improvement exceeds autonomy boundary → needs human approval       | candidate remains `"proposed"` → proceed or reject after approval |

#### Release (Release / Rollout)

| Path | Test Scenario                                                     | Assertion Focus                                              |
| ---- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| P1   | approved candidate → RolloutRecord (shadow → suggest → stable)   | level progresses correctly                                    |
| P2   | metrics gate not passed                                           | Stay at current level                                        |
| P3   | Illegal candidateId                                              | Reject                                                        |
| P4   | rollout timeout                                                   | Auto rollback                                                 |
| P5   | candidate rejected                                                | Skip rollout                                                 |
| P6   | candidate references expired evidence                             | Reject + re-evaluate                                         |
| P7   | rollout needs human approval to proceed                          | rollout remains `"pending_approval"` → continue level progression after approval |

### 16.3 Coverage Quantification

```
OAPEFLIR phase coverage = (tested path count) / (8 phases × 7 paths = 56) × 100%
```

**Goal**: ≥ 85% (at least 48/56 paths have tests)

### 16.4 OAPEFLIR-Harness Semantic Mapping (v3.0 new)

> Corresponding to Architecture Review v6.0 gap I-2 (§13.5 OAPEFLIR-Harness External Semantic Mapping)

Architecture design §13.5 requires an explicit semantic mapping between the 8 OAPEFLIR phases and the three Harness roles (Planner / Generator / Evaluator). This mapping is not yet codified (gap I-2), but tests should define the expected mapping in advance:

| OAPEFLIR Phase | Harness Role       | Mapping Semantics                                |
| -------------- | ------------------ | ------------------------------------------------ |
| Observe        | —                  | External input collection, not entering Harness loop |
| Assess         | Planner            | Task assessment → PlanBundle input               |
| Plan           | Planner            | Generate PlanBundle (stepId / DAG / tools)       |
| Execute        | Generator          | Generate WorkProduct (code / document / operation) |
| Feedback       | Evaluator          | Generate EvaluationReport (pass / fail)          |
| Learn          | Evaluator          | Extract LearningSignal from EvaluationReport     |
| Improve        | Planner+Evaluator  | Improvement candidate assessment + approval      |
| Release        | —                  | Rollout control, not directly participating in Harness loop |

**Test requirements**: After gap I-2 is implemented, verify:

- [ ] Mapping configuration exists and contains all 8 phases
- [ ] Planner role covers Assess / Plan / Improve three phases
- [ ] Generator role covers Execute phase
- [ ] Evaluator role covers Feedback / Learn / Improve three phases
- [ ] Observe and Release are marked as external phases, not entering Harness loop

---

## 17. Concurrency and Timing Test Conventions

### 17.1 Modules That Must Have Concurrency Tests

| Module                                            | Concurrency Risk                          | Test Type                |
| ------------------------------------------------- | ----------------------------------------- | ------------------------ |
| `execution-lease-service`                         | Race to acquire lease                     | Race Test + Idempotency  |
| `execution-dispatch-service`                      | Concurrent dispatch of the same ticket    | Race Test                |
| `execution-worker-handshake-service`              | Concurrent claim of the same execution    | Race Test                |
| `distributed-lock-adapter` (SQLite / Redis / PG)  | Race to acquire lock                      | Critical Section Test    |
| `durable-event-bus`                            | Concurrent publish + deliverPending | Race Test               |
| `approval-service`                             | Concurrent approval of the same request | Idempotency Test        |
| `sqlite-queue-adapter` / `redis-queue-adapter` | Concurrent enqueue + dequeue        | Race Test + Idempotency |
| `circuit-breaker`                              | Concurrent requests trigger state transition | Race Test               |
| `transition-service`                           | Concurrent state transition (CAS)   | Race Test               |
| `channel-gateway-retry-executor`               | Overlapping polling passes          | Non-overlap Test        |

### 17.2 Test Type Definitions

#### Race Test

Verify that concurrent operations do not cause data corruption or invariant violations:

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

Verify that repeated operations produce the same result:

```typescript
test("duplicate enqueue with same idempotency key returns existing job", async () => {
  const job1 = queue.enqueue({ data: "test", idempotencyKey: "key-1" });
  const job2 = queue.enqueue({ data: "test", idempotencyKey: "key-1" });
  assert.equal(job1.id, job2.id);
});
```

#### Critical Section Test

Verify that the mutual-exclusion section only allows one worker to enter:

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

Verify that resources are correctly released after timeout:

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
  // Verify recovery
  const repairs = await repairService.repair();
  assert.ok(repairs.length > 0);
  // Verify data consistency
  const execution = store.getExecution("e1");
  assert.notEqual(execution.status, "executing"); // Should not stay in intermediate state
});
```

### 17.3 Concurrency Test Quantitative Standards

| Module Category | Minimum Concurrency | Must Cover                              |
| --------------- | ------------------- | --------------------------------------- |
| Lock / lease    | 10 workers          | acquire / release / extend / steal      |
| Queue           | 20 workers          | enqueue / dequeue / ack / dead-letter   |
| State transition | 5 workers          | CAS race + terminal-state idempotency   |
| Event delivery  | 10 workers          | publish + consumer ack                  |
| Dispatch        | 5 workers           | ticket claim + handshake                |

### 17.4 Stale Write Prevention Tests

`ExecutionLeaseService.validateWriteAccess()` is the last line of defense against dirty writes and must cover all 5 denial reasons:

- [ ] `lease_not_found` — execution has no lease record
- [ ] `no_active_lease` — lease has expired / been released
- [ ] `stale_fencing_token` — fencing token mismatch (old worker write)
- [ ] `worker_mismatch` — requesting worker is not the lease holder
- [ ] `lease_mismatch` — lease ID mismatch

### 17.5 Time Control Strategy

The most common flaky root cause in concurrency and timing tests is dependence on real time. This section defines a unified time-control layering strategy.

#### A. Three-Layer Time Control

| Layer                | Applicable Scenario                              | Strategy                                                                       | Example                                                  |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| L1 — Controllable clock | Unit tests involving timeout, TTL, interval logic | Inject `Clock` interface; test passes `FakeClock` and manually advances time   | lease expiration, circuit breaker resetTimeout, retry delay |
| L2 — Bounded real time | Integration tests requiring real async / timer interaction | Allow `setTimeout` / `setInterval`, but single sleep ≤ 500ms, single-test total sleep ≤ 2s | Wait for consumer to consume after queue delivery        |
| L3 — No unbounded wait | All tests                                         | Forbid `while(true) await sleep()`, forbid unbounded `waitForEvent()`          | —                                                        |

#### B. Hard Rules

1. **Unit tests forbid direct `setTimeout` / `Date.now()` calls** — must go through the injected Clock interface
2. **All `await sleep()` calls must have a `{ timeout }` parameter upper bound** — must self-abort before CI timeout
3. **Total sleep budget for integration tests**: single test case ≤ 2s, single test file ≤ 10s
4. **Retry loops must have `maxAttempts` + `maxWaitMs` double limit** — prevent infinite retry

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

- Lint rule (or grep CI step) detects bare `Date.now()`, `new Date()`, `setTimeout` calls in test files; flagged as warning under the unit test directory
- `--test-timeout=30000` as a global fallback; a single test case exceeding 30s auto-fails

---

## 18. Design Specification to Test Traceability Conventions

### 18.1 Goal

Establish **design document → test case** two-way traceability, so that:

- Every P0 / P1 design specification has a corresponding test
- Every test can be traced back to a design requirement

### 18.2 Spec ID Encoding Rules

This project uses **4 prefixes** to distinguish traceable specifications from different sources:

| Prefix       | Meaning                       | Source                                              |
| ------------ | ----------------------------- | --------------------------------------------------- |
| `SPEC-`      | Design specification         | `opeli_detailed_design.md` and other design documents |
| `ADR-`       | Architecture Decision Record | ADR documents under `doc/adr/` directory            |
| `CONTRACT-`  | Interface / behavior contract | Contract documents under `doc/contracts/` directory |
| `INC-`       | Production incident          | Incident postmortem records, trigger regression tests |

#### Encoding Format

```
{prefix}{module}-{subsystem}-{sequence}

SPEC example:
SPEC-OAPEFLIR-EXEC-001     # OAPEFLIR Execute phase specification #1
SPEC-ROLLOUT-STATE-003      # Rollout state machine specification #3
SPEC-PLUGIN-SANDBOX-002     # Plugin sandbox specification #2
SPEC-EVENT-TIER1-DLQ-001    # Tier 1 event DLQ specification #1
SPEC-LEASE-FENCING-001      # Lease fencing token specification #1

ADR example:
ADR-LOCK-BACKEND-001        # Distributed lock selection ADR #1
ADR-EVENT-DURABILITY-002    # Event persistence strategy ADR #2

CONTRACT example:
CONTRACT-SANDBOX-FS-001     # Sandbox file system contract #1
CONTRACT-API-GATEWAY-003    # API Gateway interface contract #3

INC example:
INC-20250312-LEASE-STALE-001  # 2025-03-12 lease stale-write incident #1
INC-20250401-DLQ-OVERFLOW-001 # 2025-04-01 DLQ overflow incident #1
```

### 18.3 Referencing Spec IDs in Tests

Include the spec ID in the test title (supports all 4 prefixes):

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

Or maintain a mapping table at the head of the test file:

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

(That is, the Traceability Matrix in §7.3)

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

1. **New design specification** → assign Spec ID → write into design document
2. **Write test** → reference Spec ID in test title or file header
3. **Sprint Review** → run traceability script, output uncovered Spec ID list
4. **Gap handling** → uncovered Spec IDs enter the test debt list (§20)

Traceability script example (covering all 4 prefixes):

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

# Statistics by prefix category
echo "=== Uncovered statistics ==="
for prefix in SPEC ADR CONTRACT INC; do
  count=$(grep -c "^${prefix}-" /tmp/uncovered.txt 2>/dev/null || echo 0)
  echo "  ${prefix}: ${count}"
done
```

---

## 19. Real Execution vs Mock Execution Boundary Conventions

### 19.1 Problem Background

The most common testing pitfall in agent systems: **test coverage is high, but core execution is all mocked**. The Execute phase of this project is currently a fully mocked implementation.

It is necessary to clearly define which test layers allow mocks and which must use real execution.

### 19.2 Mock Permission Matrix

| Component                       | Unit Test                 | Integration Test             | E2E Test                       |
| ------------------------------- | ------------------------- | ---------------------------- | ------------------------------ |
| **LLM Provider**                | ✅ Mock                   | ✅ Mock                      | ✅ Mock (provider not under our control) |
| **Tool Execution Bridge**       | ✅ Mock                   | ❌ Must be real              | ❌ Must be real                |
| **Sandbox / Security Policy**   | ✅ Mock                   | ❌ Must be real              | ❌ Must be real                |
| **Database (SQLite)**           | ❌ Mock forbidden         | ❌ Real in-memory            | ❌ Real                        |
| **Database (PostgreSQL)**       | ✅ Mock (unit uses SQLite) | ❌ Must be real PG          | ❌ Must be real PG             |
| **File system**                 | ✅ Mock or temp dir        | ❌ Must use temp dir         | ❌ Must be real                |
| **Subprocess (spawn)**          | ✅ Mock                   | ❌ Must be real              | ❌ Must be real                |
| **Event Bus**                   | ✅ Mock                   | ❌ Real DurableEventBus      | ❌ Real                        |
| **Distributed lock**            | ✅ Mock                   | ❌ Real SQLite / Redis adapter | ❌ Real                      |
| **Network HTTP**                | ✅ Mock                   | ✅ Mock (external API)       | ✅ Mock                        |
| **OAPEFLIR phase output**       | ✅ Mock (isolated test of a single phase) | ❌ Phases need real chaining | ❌ Full chain             |

### 19.3 Mock Layer Prohibitions

The following combinations are **strictly forbidden**:

| Prohibition                                          | Reason                                              |
| ---------------------------------------------------- | --------------------------------------------------- |
| Mock DB in integration test                          | Cannot verify SQL correctness, transaction isolation, migration compatibility |
| Mock sandbox in integration test                     | Cannot verify path traversal / command injection protection |
| Mock tool bridge in E2E test                         | Cannot verify real tool-chain behavior              |
| Mock `StateTransitionMachine.assertTransition` at any layer | Cannot verify state machine constraints            |
| Mock `validateWriteAccess` at any layer              | Cannot verify fencing token protection              |

### 19.4 Provider Mock Conventions

LLM Provider is the only component allowed to be mocked at all layers (because real calls are uncertain, expensive, and slow).

Provider mocks must follow:

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

- Return value must conform to the full type of the Provider interface
- Return value must be **deterministic** (fixed content)
- Forbid `Math.random()` or `Date.now()` in mocks

---

## 20. Test Debt Tiering

### 20.1 Tier Definitions

| Tier      | Definition                                          | Fix Deadline     | Example                                  |
| --------- | --------------------------------------------------- | ---------------- | ---------------------------------------- |
| **TD-P0** | Security boundary / state machine / execution main chain has no test | Current Sprint   | New sandbox attack vector has no denial-path test |
| **TD-P1** | Core orchestrator has low branch / mutation coverage | Next Sprint      | `OapeflirLoopService` has no unit test   |
| **TD-P2** | Auxiliary services branch < 60% or mutation < 50%   | Within 2 Sprints | `improvement` branches 52.4%             |
| **TD-P3** | Utility / helper functions missing boundary conditions | Backlog          | Pure functions missing null-value tests  |
| **TD-P4** | Golden / performance test documentation enhancement | Backlog          | New CLI command has no golden snapshot   |

### 20.2 Debt Entry Format

```
TD-{tier}-{sequence}: {description}
  Module: {src/platform/xxx}
  Current coverage: {lines}% / {branches}% / mutation {x}%
  Target coverage: {lines}% / {branches}%
  Related Spec: {SPEC-xxx} (if applicable)
  Owner: {owner}
  Deadline: {date}
```

### 20.3 Debt Entry and Exit Conditions

**Entry Conditions**:

- §7 Traceability Matrix script discovers uncovered source file
- Some directory in coverage gate is below the safety red line (§23)
- Stryker report shows survived mutants rate > 50%
- PR Review discovers missing test scenarios
- Incident replay did not produce a corresponding regression test

**Exit Conditions**:

- Corresponding test has been written and merged into main
- Coverage baseline has been updated
- Mutation score improved to ≥ low threshold

### 20.4 Sprint Test Debt Auto-Report

At the end of each Sprint, a test debt report is automatically generated as required input for the Sprint Review.

#### A. Report Content

| Section                 | Data Source                     | Description                                      |
| ----------------------- | ------------------------------- | ------------------------------------------------ |
| New TD                  | TDs created this Sprint         | Statistics by priority distribution              |
| Closed TD               | TDs closed this Sprint          | Distribution of close reasons (fixed / canceled / downgraded) |
| Red-line violating directories | §23 coverage quality red line check | List directories below safety red line and gap |
| Uncovered Spec IDs      | §18.5 traceability script output | Categorized by prefix (SPEC / ADR / CONTRACT / INC) |
| Top-N Survived Mutants  | Stryker report                  | Top 10 source files with most survived           |
| Unreplayed incidents    | §21 failure sample replay list  | Incidents recorded but not yet producing regression tests |

#### B. Automation Script Requirements

```bash
#!/usr/bin/env bash
# scripts/ci/sprint-test-debt-report.sh

echo "=== Sprint Test Debt Report ==="
echo "Date: $(date -I)"
echo ""

echo "## 1. Red-line violating directories"
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
echo "## 4. Unreplayed incidents"
# Find incidents in the incidents directory that don't have corresponding INC- prefixed tests yet
comm -23 \
  <(grep -oP 'INC-[\w-]+' doc/incidents/*.md 2>/dev/null | sort -u) \
  <(grep -roPh 'INC-[\w-]+' tests/ | sort -u)
```

#### C. CI Integration

- Report script runs on every `main` branch merge; output archived to `data/sprint-reports/` directory
- If the number of red-line violating directories is more than the last report, CI emits a warning (does not block)
- Sprint Review agenda must include interpretation of this report

---

## 21. Failure Sample Replay Rules

### 21.1 Core Principle

> **Every production incident, rollback, security escape, and high-priority user correction must be replayed into at least one regression test.**

### 21.2 Replay Trigger Conditions

| Trigger Event                   | Test Type That Must Be Replayed                |
| ------------------------------- | ---------------------------------------------- |
| Production incident (P0 / P1)   | Integration regression + root cause unit test  |
| Rollback (Rollout fallback)     | State machine transition test + condition gate test |
| Security escape (sandbox bypass) | Denial-path regression (§8)                   |
| User correction (manual fix)    | Unit test covering the corrected logic branch  |
| Data inconsistency fix          | Concurrency / transaction isolation test (§17) |
| Dead letter backlog             | Event lifecycle test (§15)                     |

### 21.3 Replay Process

```
Incident occurs → Root cause analysis → Fix code
                              ↓
                  Write regression test (test title includes incident ID)
                              ↓
                  Verify: remove fix code → regression test fails (confirm test is effective)
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
2. Run the replay test → must fail
3. Restore the fix code
4. Run the replay test → must pass

If in step 2 the test still passes, the test does not effectively cover the root cause and must be rewritten.

---

## 22. Test Data Governance

### 22.1 Fixture Minimalism Principle

Fixtures should contain only the fields **required** by the scenario under test; the rest use factory defaults:

```typescript
// ✓ Good — only specify fields the test cares about
const task = createMinimalTask({ priority: "critical" });

// ✗ Bad — copy-paste a complete record
const task = {
  id: "task-001",
  parentId: null,
  rootId: "task-001",
  divisionId: "general-ops",
  title: "test",
  status: "queued",
  source: "user",
  priority: "critical",
  inputJson: "{}",
  // ... 20 more fields
};
```

### 22.2 Determinism Control

Tests **forbid** the following non-deterministic sources:

| Non-deterministic source       | Alternative                                                |
| ------------------------------ | ---------------------------------------------------------- |
| `Date.now()` / `new Date()`    | Use a fixed timestamp or `withEnv({ AA_FIXED_TIME: "..." })` |
| `Math.random()`                | Use a fixed seed or hard-coded value                       |
| `crypto.randomUUID()`          | Use a fixed ID (e.g., `"task-test-001"`)                   |
| Network requests               | Mock provider                                              |
| File system timestamps         | Normalize in golden tests                                  |
| PID in subprocess output       | Strip before assertion                                     |

### 22.3 Golden Snapshot Normalization

Before writing to golden files, normalize unstable fields:

```typescript
function normalizeForGolden(output: unknown): unknown {
  const json = JSON.stringify(output, null, 2);
  return json
    .replace(/"createdAt":\s*"[^"]+"/g, '"createdAt": "<TIMESTAMP>"')
    .replace(/"id":\s*"[a-f0-9-]+"/g, '"id": "<UUID>"')
    .replace(/"pid":\s*\d+/g, '"pid": <PID>');
}
```

### 22.4 Separation of Scenario Fixtures and Domain Fixtures

| Type             | File                                  | Purpose                                              |
| ---------------- | ------------------------------------- | ---------------------------------------------------- |
| **Domain Fixture** | `tests/helpers/fixtures/base.ts`      | Minimum valid domain records (Task, Execution, Approval) |
| **Scenario Fixture** | `tests/helpers/fixtures/composite.ts` | Multi-entity related scenarios (BlockedTask, CompletedTask, FailedTask) |
| **Seed Fixture** | `tests/helpers/api.ts`                | Complete API environment seed                         |

When adding new fixtures:

- Single entity → add to `base.ts`
- Multi-entity related → add to `composite.ts`
- Test-specific → inline in the test file (do not extract)

### 22.5 Test Isolation

- Each test independently creates a temp workspace, with `try/finally` cleanup
- Forbid sharing state between tests (global variables, singletons, static properties)
- Environment variables are isolated via `withEnv()`
- Databases are isolated via independent DB files (do not share in-memory DB)

---

## 23. Coverage Quality Red Lines

### 23.1 Problem

A global 82.4% line coverage can mask low coverage of critical modules. We need to define **hard minimum thresholds** for different modules.

### 23.2 Tiered Red Lines (v3.0 updated directory mapping)

| Level        | Applicable Modules                                                                        | Lines Red Line | Branches Red Line | Mutation Red Line |
| ------------ | ----------------------------------------------------------------------------------------- | -------------- | ----------------- | ----------------- |
| **Critical** | compliance, distributed-lock, state-transition, execution-lease, control-plane/iam        | ≥ 90%          | ≥ 80%             | ≥ 70%             |
| **High**     | orchestration/oapeflir, state-evidence/memory, knowledge, events, execution-engine        | ≥ 85%          | ≥ 75%             | ≥ 60%             |
| **Standard** | orchestration/oapeflir/learn, planning, improvement, artifacts, prompt-engine            | ≥ 80%          | ≥ 70%             | ≥ 50%             |
| **Baseline** | plugins, sdk/cli, model-gateway, tool-executor, domains                                   | ≥ 75%          | ≥ 60%             | ≥ 50%             |

### 23.3 Current Gap (v4.0 c8 Measured Data)

> **Important**: c8 full analysis (`all: true`) shows all module coverage is **0%**, with the sole exception of 6 files under `state-evidence/truth/sqlite/` (100%). Therefore, all Critical and High modules below currently **fail to meet the standard**.

| Module                                    | Level    | Current Lines | Red Line | Current Branches | Red Line | Status                |
| ----------------------------------------- | -------- | ------------- | -------- | ---------------- | -------- | --------------------- |
| `platform/five-plane-execution/distributed-lock`   | Critical | 0%            | 90%      | 0%               | 80%      | ❌ Lines **gap 90%**  |
| `platform/five-plane-execution/state-transition`   | Critical | 0%            | 90%      | 0%               | 80%      | ❌ Lines **gap 90%**  |
| `platform/five-plane-control-plane/iam`            | Critical | 0%            | 90%      | 0%               | 80%      | ❌ Lines **gap 90%**  |
| `platform/compliance`                   | Critical | 0%            | 90%      | 0%               | 80%      | ❌ Lines **gap 90%**  |
| `platform/five-plane-orchestration/oapeflir`       | High     | 0%            | 85%      | 0%               | 75%      | ❌ Lines **gap 85%**  |
| `platform/five-plane-state-evidence/memory`        | High     | 0%            | 85%      | 0%               | 75%      | ❌ Lines **gap 85%**  |
| `platform/five-plane-state-evidence/events`        | High     | 0%            | 85%      | 0%               | 75%      | ❌ Lines **gap 85%**  |
| `platform/five-plane-execution/execution-engine`   | High     | 0%            | 85%      | 0%               | 75%      | ❌ Lines **gap 85%**  |
| `platform/five-plane-state-evidence/knowledge`     | High     | 0%            | 85%      | 0%               | 75%      | ❌ Lines **gap 85%**  |
| `platform/five-plane-orchestration/oapeflir/learn` | Standard | 0%            | 80%      | 0%               | 70%      | ❌ Lines **gap 80%**  |
| `platform/five-plane-state-evidence/artifacts`     | Standard | 0%            | 80%      | 0%               | 70%      | ❌ Lines **gap 80%**  |
| `platform/prompt-engine`                | Standard | 0%            | 80%      | 0%               | 70%      | ❌ Lines **gap 80%**  |
| `plugins`                               | Baseline | 0%            | 75%      | 0%               | 60%      | ❌ Lines **gap 75%**  |
| `sdk/cli`                               | Baseline | 0%            | 75%      | 0%               | 60%      | ❌ Lines **gap 75%**  |
| `platform/model-gateway`                | Baseline | 0%            | 75%      | 0%               | 60%      | ❌ Lines **gap 75%**  |
| `domains`                               | Baseline | 0%            | 75%      | 0%               | 60%      | ❌ Lines **gap 75%**  |

> **v4.0 Major Change**: c8 full analysis shows all module coverage is 0% (except 6 files under `state-evidence/truth/sqlite/`). The high coverage data claimed by v3.0 has been verified to be inaccurate. **Root cause analysis**: test code exists (1,803 `.test.ts` files, 52,480 assertions), but c8 coverage collection may not be correctly linked to all compiled `dist/src/` files, or the `build:test` compilation process did not include all source files in c8's instrumentation scope. Need to investigate the integration of c8 configuration with the build chain.

### 23.4 Red Line Enforcement

Write red lines into the directory-level `minimums` in `.coverage-baseline.json`, enforced by `check-coverage-baseline.mjs`.

The current baseline only records "observed values"; it is recommended to extend it to:

```json
{
  "src/platform/security": {
    "fileCount": 19,
    "metrics": { "lines": 91.9, ... },
    "minimums": { "lines": 90, "branches": 80 }  // ← newly added
  }
}
```

### 23.5 State Machine / Security-Specific Red Lines

In addition to coverage, the following modules have specific red lines:

| Special Item                       | Red Line                              | Measurement Method                  |
| ---------------------------------- | ------------------------------------- | ----------------------------------- |
| State machine legal transition coverage | 100%                                  | Legal edges / total legal edges     |
| State machine illegal transition coverage | Terminal states × all non-self states 100% | Rejection test count / required rejection count |
| Security denial-path               | Each attack surface ≥ 3 items         | Denial test count / attack surface count |
| Tier 1 event lifecycle             | 9 events × 8 phases 100%              | Tested phases / 72                  |
| Fencing token rejection            | 5 reasons 100%                        | Rejection test count / 5            |

---

---

# Part III — Architecture Gap Regression Test Matrix (v4.0 rewrite, aligned with Architecture Review v8.0)

> Part I addresses "code coverage governance"; Part II addresses "architecture semantic coverage".
> Part III addresses "**regression protection for architecture design vs implementation gaps**" — based on the **13 architecture gaps** found by Architecture Review v8.0 (`docs_zh/reviews/architecture-design-vs-implementation-review.md`), define the corresponding test conventions to ensure each gap has complete test coverage after implementation.
>
> **v4.0 Change**: Completely rewritten. v3.0 was based on 29 gaps (GAP-\* numbering) from Architecture Review v6.0. This version is based on Architecture Review v8.0's full gap review of the entire codebase (1,387 files / 265,020 lines) vs design document v3.2 (§1-§94), covering **3 P0 architecture violations + 7 P1 implementation shortcomings + 3 P2 detail completions**. The Harness-related gaps in v3.0 (GAP-VI-\*) have been partially implemented in code (29 files, 1,471 lines); this version focuses on design-implementation gaps at the security / classification / authorization framework layer.

---

## 24. Architecture Review-Driven Regression Testing

### 24.1 Background

Architecture Review v8.0 conducted a full review of 1,387 source files / 265,020 lines of code, compared with architecture design document v3.2 (approx. 8,000 lines / 94 chapters), and found **13 architecture design vs implementation gaps**:

| Priority                  | Count | Key Gaps                                                                            |
| ------------------------- | ----- | ----------------------------------------------------------------------------------- |
| P0 Architecture violations | 3     | E1-E6 anomaly classification missing, SEV1-4 unified severity missing, STRIDE threat model missing |
| P1 Clear requirement implementation shortcomings | 7     | Principal type, Sandbox tier, Cursor pagination, HITL mode, RBAC three-layer authorization, vertical domain, multimodal |
| P2 Detail completions      | 3     | Webhook-Outbox coupling, logical table reconciliation, metamodel 12 questions        |

### 24.2 Gap ID to Test Traceability

Test titles use the `[ARCH-P{level}-{sequence}]` prefix, mapping one-to-one with the gap numbers from Architecture Review v8.0:

```
Architecture Review v8.0: P0-1 §12.1 Anomaly event classification system E1-E6 completely missing
    ↓
Test title: [ARCH-P0-1] AnomalyEventClass enum defines all 6 categories E1-E6
    ↓
File location: tests/unit/platform/contracts/anomaly-event-classification.test.ts
```

| Prefix       | Meaning                          | Gap Count |
| ------------ | -------------------------------- | --------- |
| `ARCH-P0-`   | Architecture violation (completely missing) | 3         |
| `ARCH-P1-`   | Clearly required but implementation insufficient | 7         |
| `ARCH-P2-`   | Detail completion                | 3         |

### 24.3 Priority Execution Plan

| Priority | Fix Deadline | Gap ID                                                                                                      |
| -------- | ------------ | ------------------------------------------------------------------------------------------------------------ |
| **P0**   | 1-2 weeks    | P0-1 (E1-E6 classification), P0-2 (SEV1-4 unified severity), P0-3 (STRIDE)                                  |
| **P1**   | 2-4 weeks    | P1-1 (Principal), P1-2 (Sandbox), P1-3 (Pagination), P1-4 (HITL), P1-5 (RBAC), P1-6 (Vertical domain), P1-7 (Multimodal) |
| **P2**   | Ongoing      | P2-1 (Webhook-Outbox), P2-2 (Logical table), P2-3 (Metamodel 12 questions)                                 |

---

## 25. P0 Architecture Violation Gap Test Conventions

### 25.1 [ARCH-P0-1] §12.1 Anomaly Event Classification System E1-E6 Completely Missing

**Gap**: The design defines 6 categories of anomaly event classification (E1 business / E2 execution / E3 external dependency / E4 security / E5 data / E6 governance), but in the code `AnomalyDetectionService` uses `AnomalyCategory` (spike / trend_change / level_shift), which is completely different from the design classification system.

**Test Type**: Unit

**Test Goal**: The anomaly event classification enum must include all 6 categories E1-E6, and the classification mapping logic must be correct.

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

| Scenario                          | Assertion                                |
| --------------------------------- | ---------------------------------------- |
| Each E1-E6 classification enum value exists | Enum length = 6, contains all values     |
| Schema validates legal event      | `doesNotThrow`                           |
| Schema rejects event missing class | `throws`                                |
| Statistical detection → E1-E6 mapping covers all | Each `source_plane` mapped to at least one E class |
| Event publication carries class field | outbox / event message contains `AnomalyEventClass` |

### 25.2 [ARCH-P0-2] §12.2 Unified Severity Levels SEV1-SEV4 Missing

**Gap**: Three mutually incompatible severity systems exist in the code: Incident uses P0-P3, Anomaly uses warning / critical / emergency, SLO uses AlertSeverity. The design requires unified use of SEV1-SEV4.

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

**Gap**: The design requires 6-dimension STRIDE threat assessment + supplementary threat matrix, but there is no STRIDE implementation in the code.

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

## 26. P1 High-Priority Gap Test Conventions

### 26.1 [ARCH-P1-1] Principal Type Incomplete (3/6)

**Gap**: Architecture §11.1 defines 6 Principal types (Human / ServiceAccount / Agent / System / External / Anonymous), but the code only implements the first 3.

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

**Gap**: Architecture §11.4 defines 4 Sandbox tiers (none / process / container / vm), but the code only implements the first 3.

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

### 26.3 [ARCH-P1-3] Cursor-Based Pagination Incomplete

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

### 26.4 [ARCH-P1-4] HITL 7 Mode Coverage To Be Verified

**Gap**: Architecture §21.1 defines 7 Human-in-the-Loop modes (approve / reject / escalate / override / inspect / patch / takeover). Code coverage is to be verified.

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

### 26.5 [ARCH-P1-5] RBAC + Capability + Context-Aware Three-Layer Authorization Incomplete

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

**Gap**: Architecture §71-§94 defines 24 vertical domains with specialized workflows, tool bundles, risk policies, and evaluation metrics. Currently all domains use the generic skeleton.

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

### 26.7 [ARCH-P1-7] Multimodal Capability Video Processing Is Skeleton

**Gap**: Architecture §68 defines multimodal processing capabilities (text / image / audio / video). Video processing only has a skeleton stub, with no actual implementation.

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

## 27. P2 Detail Completion Gap Test Conventions

### 27.1 [ARCH-P2-1] Webhook + Outbox Coupling Missing

**Gap**: Architecture §6.7 requires event notifications to use the Transactional Outbox pattern to guarantee at-least-once delivery. Currently webhook is sent synchronously, with no outbox table, no retry tracking.

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

### 27.2 [ARCH-P2-2] Logical Table Count Difference

**Gap**: There is a count difference between the logical table set defined in Architecture §26.3 and the actual schema definitions in the code. It is necessary to verify that all tables required by the architecture have corresponding definitions in the code.

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

### 27.3 [ARCH-P2-3] Unified Domain Meta-Model 12-Question Coverage

**Gap**: Architecture §37.11 defines 12 mandatory questions for the unified domain meta-model (domain boundary, core entities, workflows, tool bundle, risk policy, evaluation metrics, budget constraints, security level, latency requirement, data sensitivity, compliance requirements, SLA targets). It is necessary to verify that each domain's meta-model answer coverage.

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

# Part IV — System Engineering Defect Regression Testing (v2.0 original Part III preserved, v3.0 numbering updated)

> Part III addresses "architecture design-implementation gaps".
> Part IV addresses "**regression protection for system engineering defects**" — based on engineering defects found by Architecture Review v4.1 (Redis error handling, concurrency races, silent task loss, etc.), define the corresponding regression test conventions.
>
> **v3.0 Change**: Migrated from v2.0 Part III (§24-§30) to Part IV (§29-§34), numbering updated, content preserved. SYS-\* defect numbering unchanged.

---

## 29. P0 Blocking Engineering Defect Test Conventions

> Corresponds to v2.0 §25.

### 29.1 [SYS-REL-2.1] Redis Error Handler Silently Swallows Errors

**Defect**: In `distributed-lock/redis-lock-adapter.ts`, `queue/redis-queue-adapter.ts`, `ingress/redis-rate-limiter.ts`, `cache/stores/redis-cache-store.ts`, `this.redis.on("error", () => {})` silently swallows all Redis errors.

**Test Type**: Unit + Integration

**Test Goal**: Redis connection errors must (1) be logged to StructuredLogger, (2) update the health status flag, (3) increment the Prometheus counter.

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

**Files Covered** (one set of tests per file):

| File                                               | Test File                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `execution/distributed-lock/redis-lock-adapter.ts` | `tests/unit/platform/five-plane-execution/redis-lock-error.test.ts`         |
| `execution/queue/redis-queue-adapter.ts`           | `tests/unit/platform/five-plane-execution/redis-queue-error.test.ts`        |
| `interface/ingress/redis-rate-limiter.ts`          | `tests/unit/platform/five-plane-interface/redis-rate-limiter-error.test.ts` |
| `shared/cache/stores/redis-cache-store.ts`         | `tests/unit/platform/shared/redis-cache-error.test.ts`           |

### 29.2 [SYS-REL-2.3] DLQ In-Memory Only, Lost on Restart

**Defect**: `state-evidence/dlq/index.ts` uses `Map<string, DeadLetterRecord>` to store dead letters; all data is lost after a process restart.

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

**Defect**: In `execution/queue/redis-queue-adapter.ts`, 5 critical enqueue operations use `.catch(() => {})`.

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

**Defect**: Line 46 of the `Dockerfile` CMD references a non-existent path.

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

## 30. P1 Severe Defect Test Conventions

### 30.1 [SYS-REL-2.2] Redis Lock TOCTOU Race

**Defect**: `extendAsync()` in `distributed-lock/redis-lock-adapter.ts` uses non-atomic GET+SET; `forceStealAsync()` uses non-atomic DEL+SET. In concurrent scenarios, two processes can hold the same lock simultaneously.

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

### 30.2 [SYS-REL-2.7] Workflow State Transition Lacks CAS

**Defect**: `execution/state-transition/transition-service.ts` has CAS for task transitions, but workflow transitions have no CAS protection.

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

**Defect**: Lines 172/227/281/339 of `shared/observability/slo-alerting-service.ts` use `.catch(() => {})` on alert delivery failures.

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

### 30.4 [SYS-REL-2.6] Outbox Not Integrated into Critical Write Path

**Defect**: The complete implementation of `shared/outbox/outbox-service.ts` exists, but `transition-service.ts` writes task state transitions directly to the events table without going through Outbox.

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

**Defect**: A crash between two `appendFileSync` calls in `state-evidence/truth/session-dual-storage.ts` leads to inconsistency.

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

**Defect**: `shared/observability/structured-logger.ts:295` calls `appendFileSync` for every log entry, blocking the event loop.

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

**Defect**: All three receivers in `deploy/prometheus/alertmanager.yml` point to the same internal webhook.

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

**Defect**: `deploy/terraform/main.tf` has no `backend {}` block; the state file is stored locally.

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

## 31. P2 Important Defect Test Conventions

### 31.1 [SYS-ARCH-1.1] Five-Plane Cross-Plane Import Guard

**Defect**: 394 cross-plane imports violate the five-plane architecture (e.g., state-evidence imports execution).

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

**Forbidden Import Directions** (tests must cover all):

| Source Plane     | Forbidden Import Targets                  |
| ---------------- | ----------------------------------------- |
| state-evidence   | execution, control-plane                  |
| control-plane    | state-evidence (direct), execution (direct) |
| interface        | Only allowed to import shared/, contracts/ |
| orchestration    | execution (directly bypassing shared adapter) |

### 31.2 [SYS-OBS-5.1] Critical Path console.\* Disabled

**Defect**: 37 critical path locations use `console.*` to bypass StructuredLogger.

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

### 31.3 [SYS-OBS-5.2] Prometheus Alert Rule Completeness

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

### 31.4 [SYS-PERF-3.2] Redis KEYS Command Disabled

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

**Defect**: 20+ `Map`s only grow and never shrink, leading to memory leaks during long-running operations.

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

**Defect**: `knowledge-snapshot-store.ts:29` directly calls `readFileSync(this.snapshotPath)` with no sandbox check.

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

**Defect**: Plugin / security-related `AA_*` environment variables are not within the Zod startup validation scope.

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

## 32. Architecture Invariant Auto-Guard Tests

> Corresponds to v2.0 §28.

### 32.1 Purpose

Convert structural problems found in architecture reviews into **continuously running automated guard tests** to prevent architecture decay from recurring.

### 32.2 Guard Test List

| Guard Item                       | Test File                                                        | Frequency  |
| -------------------------------- | ---------------------------------------------------------------- | ---------- |
| Five-plane import isolation      | `tests/unit/platform/contracts/plane-isolation.test.ts`         | Every CI   |
| console.\* disabled (non-SDK/CLI) | `tests/unit/platform/contracts/no-console-in-runtime.test.ts`   | Every CI   |
| `as any` count upper limit       | `tests/unit/platform/contracts/type-safety-bounds.test.ts`      | Every CI   |
| Redis KEYS command disabled      | `tests/unit/platform/contracts/no-redis-keys.test.ts`           | Every CI   |
| Routes with no duplicate registration | `tests/unit/platform/contracts/no-duplicate-routes.test.ts`     | Every CI   |
| Zod boundary validation coverage | `tests/unit/platform/contracts/zod-boundary-validation.test.ts` | Every CI   |
| Stub files don't grow            | `tests/unit/platform/contracts/stub-count-ratchet.test.ts`      | Every CI   |
| Dockerfile CMD path valid        | `tests/integration/deploy/dockerfile-entrypoint.test.ts`        | Every CI   |

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

`src/ops-maturity/` is a hard-hit area for stub files; the following subdirectories have a high stub rate:

| Subdirectory           | Total Files | Current Lines Coverage | Corresponding Architecture Section |
| ---------------------- | ----------- | ---------------------- | ---------------------------------- |
| `platform-ops-agent/`  | 9           | 38.7%                  | §69 Platform Ops Agent             |
| `edge-runtime/`        | 5           | 96.6%                  | §63 Edge Inference                 |
| `capacity-planner/`    | 5           | 94.0%                  | §68 Capacity Planning              |
| `compliance-reporter/` | 3           | —                      | §67 Compliance Reporting           |
| `cost-optimizer/`      | 3           | —                      | §65 Cost Optimization              |
| `emergency/`           | 4           | 95.0%                  | §60 Emergency Braking              |
| `multimodal/`          | 7           | 97.1%                  | §68B Multimodal                    |
| `workflow-debugger/`   | 5           | 99.5%                  | §62 Workflow Debugger              |
| `explainability/`      | 2           | —                      | §59 Explainability                 |

### 33.2 Stub File Exit Conditions

A stub file is considered "implemented" when:

| Condition         | Standard                                  |
| ----------------- | ----------------------------------------- |
| Code line count   | ≥ 50 non-empty non-comment lines          |
| Class method count | ≥ 3 non-empty method bodies               |
| Test coverage     | Branch coverage ≥ 60%                     |
| Mutation score    | Mutation score ≥ 50%                      |
| External callers  | Imported by at least 1 non-test file      |

---

## 34. Test Gap and Coverage Status Summary

> Corresponds to v2.0 §30, v4.0 fully updated based on codebase measured data.

### 34.1 Source Area → Test File Count Comparison (v4.0 measured)

| Source Directory        | Source Files | Unit Tests | Integration Tests | Total    | Ratio  |
| ----------------------- | ------------ | ---------- | ----------------- | -------- | ------ |
| `src/platform/`         | 926          | 902        | 269               | 1,171    | 1.26   |
| `src/scale-ecosystem/`  | 78           | 68         | 10                | 78       | 1.00   |
| `src/domains/`          | 55           | 55         | 17                | 72       | 1.31   |
| `src/ops-maturity/`     | 97           | 103        | 17                | 120      | 1.24   |
| `src/interaction/`      | 44           | 47         | 3                 | 50       | 1.14   |
| `src/org-governance/`   | 44           | 42         | 3                 | 45       | 1.02   |
| `src/sdk/`              | 96           | 65         | 39                | 104      | 1.08   |
| `src/plugins/`          | 25           | 27         | 0                 | 27       | 1.08   |
| `src/core/`             | 8            | 7          | 0                 | 7        | 0.88   |
| `src/apps/`             | 4            | 4          | 0                 | 4        | 1.00   |
| **Total**               | **1,387**    | **1,398**  | **358**           | **1,803**| **1.30** |

### 34.2 E2E Test File List (17 files)

| File                                | Covered Scenario          |
| ----------------------------------- | ------------------------- |
| `task-lifecycle.test.ts`            | Task full lifecycle       |
| `oapeflir-full-loop.test.ts`        | OAPEFLIR complete loop    |
| `multi-step-workflow.test.ts`       | Multi-step workflow       |
| `approval-event-flow.test.ts`       | Approval event flow       |
| `gateway-webhook-flow.test.ts`      | Gateway Webhook flow      |
| `streaming-response.test.ts`        | Streaming response        |
| `session-memory-flow.test.ts`       | Session memory flow       |
| `operator-takeover.test.ts`         | Operator takeover         |
| `lease-recovery.test.ts`            | Lease recovery            |
| `error-propagation.test.ts`         | Error propagation         |
| `delegation-chain-flow.test.ts`     | Delegation chain flow     |
| `domain-onboarding-flow.test.ts`    | Domain onboarding flow    |
| `execution-flow.test.ts`            | Execution flow            |
| `harness-loop-e2e.test.ts`          | Harness loop end-to-end   |
| `multi-region.test.ts`              | Multi-region              |
| `multi-step-task-execution.test.ts` | Multi-step task execution |
| `rollback-scenario.test.ts`         | Rollback scenario         |

### 34.3 Golden Test File List (11 files)

| File                           | Guarded Target              |
| ------------------------------ | --------------------------- |
| `openapi-document.test.ts`     | OpenAPI document structure  |
| `cli-help-text.test.ts`        | CLI help text               |
| `diagnostics-bundle.test.ts`   | Diagnostics bundle structure |
| `prompt-assembly.test.ts`      | Prompt assembly + cache key |
| `session-summary.test.ts`      | Session summary structure   |
| `release-plan-output.test.ts`  | Release plan Markdown       |
| `workflow-validation.test.ts`  | Workflow validation         |
| `golden-tasks.test.ts`         | Golden task suite           |
| `domain-baseline.test.ts`      | Domain baseline snapshot    |
| `config-schema.test.ts`        | Config schema snapshot      |
| `harness-protocol.test.ts`     | Harness protocol snapshot   |

### 34.4 Performance Test File List (10 files)

| File                                    | Benchmark Target           |
| --------------------------------------- | -------------------------- |
| `oapeflir-perf.test.ts`                 | OAPEFLIR loop throughput   |
| `knowledge-perf.test.ts`                | Knowledge retrieval latency |
| `planning-perf.test.ts`                 | Planning generation latency |
| `feedback-perf.test.ts`                 | Feedback processing throughput |
| `plugin-perf.test.ts`                   | Plugin execution latency   |
| `handoff-perf.test.ts`                  | Handoff flow latency       |
| `execution-performance.test.ts`         | Execution engine throughput |
| `harness-component-performance.test.ts` | Harness component latency  |
| `harness-loop-performance.test.ts`      | Harness loop throughput    |
| `prompt-engine-performance.test.ts`     | Prompt engine latency      |

### 34.5 Current Coverage Blind Spots Top-5 (v4.0 updated)

| Rank | Blind Spot                                          | Current Status                                                                              | Suggestion                                                       |
| ---- | --------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1    | **Global line coverage** (c8 measured 0.75%)         | Of 182,253 lines, only 1,384 are covered (6 SQLite delegating files); 977 source files are 0% | Configure test framework to correctly collect coverage, establish real baseline |
| 2    | **E1-E6 anomaly event classification** (ARCH-P0-1)  | Completely missing, no unified anomaly classification system                                  | Add classification completeness + routing tests after implementation (§25.1) |
| 3    | **SEV1-SEV4 unified severity** (ARCH-P0-2)          | 3 mutually incompatible systems exist in the code                                            | Add mapping + degradation tests after unification (§25.2)        |
| 4    | **STRIDE threat model** (ARCH-P0-3)                 | Completely missing                                                                          | Add 6 threat category tests after implementation (§25.3)         |
| 5    | **Principal type / Sandbox tier** (ARCH-P1)         | Only 3/6 and 3/4 implemented respectively                                                   | Add type completeness + isolation verification tests after completion (§26.1/§26.2) |

---

> **End of Document (v4.0)** — This manual has been upgraded from v3.0 to v4.0.
>
> **Part I** guarantees: tests are not missing, quality is not poor, and there are no obvious omissions.
> **Part II** guarantees: system critical design semantics (state machine, events, concurrency, phase contracts, Harness semantic mapping) are all covered.
> **Part III** guarantees: the **13 architecture design-implementation gaps** (3 P0 + 7 P1 + 3 P2) found by Architecture Review v8.0 have corresponding test conventions, and there will be no test blind spots after implementation.
> **Part IV** guarantees: **engineering defects** (Redis errors, concurrency races, configuration issues, etc.) have corresponding regression test conventions, and they will not recur after fixes.
>
> **v4.0 Key Correction**: c8 measured global line coverage is only 0.75% (not the 82.4% claimed by v3.0); all values in `.coverage-baseline.json` are `null`. The number of test files (1,803) has exceeded the number of source files (1,387), but the coverage collection pipeline is not correctly linked — this is the top priority for repair.
>
> Core idea: **Coverage ratchet guarantees quantity, mutation testing guarantees quality, Traceability Matrix guarantees completeness, PR Review guarantees context, architecture semantic matrix guarantees design contracts, architecture gap regression matrix guarantees design-implementation alignment, system issue regression matrix guarantees engineering defects don't recur. All seven are indispensable.**
>
> **Latest Supplement Hint**: This document has added [v4.1 Supplement: Under-Considered Test Types and Completion Plans](#v41-supplement-under-considered-test-types-and-completion-plans) after the v4.0 main text, covering UI six platforms, Mission, Yono Business, LLM/Eval, API compatibility, migration rollback, Chaos/DR, observability, privacy compliance, plugin supply chain, fuzz, and other test plans not previously systematically incorporated.

---

# v4.1 Supplement: Under-Considered Test Types and Completion Plans

> **Supplement Date**: 2026-05-18
> **Supplement Purpose**: v4.0 already covers backend unit, integration, E2E, Golden, performance, mutation, security, and architecture gap regression, but coverage is insufficient for system-level risks in the newly added UI Monorepo, Mission / Yono business domains, LLM behavior evaluation, deployment upgrades, DR, supply chain, data governance, etc. This section serves as a v4.1 supplement; duplicate v4.0 copies have been cleaned up, and the current file is retained as the single authoritative version.

## 35. Under-Covered Test Checklist

### 35.1 Gap Overview

| Number    | Test Type                                | Current Manual Coverage                                  | Risk                                                                                              | Recommended Test Level                                                              | Priority |
| --------- | ---------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| T-GAP-01  | UI six-platform testing                  | Backend E2E only, `ui/` Monorepo not covered              | Web runs but desktop / mobile shell, adapter, routing, state layer may drift                      | Unit / Component / Contract / E2E / Accessibility / Visual                          | P0       |
| T-GAP-02  | Real PlatformAdapter integration         | Mock-first not distinguished from real Electron IPC, Tauri invoke, RN Native Module | Frontend mocks pass but real platform capabilities unavailable                                     | Contract / Native smoke / Adapter parity                                            | P0       |
| T-GAP-03  | Mission long-term goal governance        | Mission-dimension special matrix not formed              | Task, budget, permission, freeze, evidence chain may bypass Mission context                       | Contract / Integration / E2E / Governance                                           | P0       |
| T-GAP-04  | Yono Business business domain            | End-to-end business acceptance of new business domains not covered | Domain config exists but business flow, data permission, SLA not verified                        | Domain smoke / E2E / Compliance                                                     | P0       |
| T-GAP-05  | LLM / Prompt / Eval behavior testing     | Only prompt golden and partial OAPEFLIR tests             | Model output uncontrollable, regression hard to find, hallucination / over-permission unquantified | Eval harness / Golden / Red team / Cost                                             | P0       |
| T-GAP-06  | API contract compatibility and version evolution | OpenAPI golden exists, but backward compatibility gate missing | SDK / UI / external callers break on field changes                                                  | Contract diff / Consumer-driven contract                                            | P0       |
| T-GAP-07  | Data migration and upgrade rollback      | Some migration / rehearsal, but no unified strategy in manual | Irreversible schema / data corruption after production upgrade                                     | Migration rehearsal / Rollback / Backup restore                                     | P0       |
| T-GAP-08  | Chaos / fault injection                  | deploy/chaos config exists but no systematic manual       | Reliability degradation under Redis / PG / network / worker failures unknown                       | Chaos / Recovery / Soak                                                             | P1       |
| T-GAP-09  | DR and multi-region drill                | DR workflow exists, but manual does not include acceptance | RTO / RPO, cross-region consistency, failover cannot be proven                                     | DR drill / Multi-region E2E                                                         | P1       |
| T-GAP-10  | Observability semantics testing          | Alert rule tests exist, but trace / log / metric end-to-end semantics missing        | Cannot locate on failure or metric high-cardinality explosion                                      | Observability contract / Golden / Cardinality guard                                 | P1       |
| T-GAP-11  | Cost and budget defense                  | Budget tests scattered, no cross-model / tool / task closed loop | Provider / tool calls still issued after budget exhausted                                          | Unit / Integration / E2E / Cost simulation                                          | P1       |
| T-GAP-12  | Privacy, data retention, and redaction   | Security tests biased toward attack surface, privacy compliance insufficient         | Logs, events, learning objects leak PII / secret                                                   | Privacy scan / Retention / Redaction                                                | P1       |
| T-GAP-13  | Plugin / Pack ecosystem compatibility    | SDK tests exist, but version matrix and malicious plugin verification missing        | Plugin damages host, permission overreach, upgrade incompatibility                                  | SDK compatibility / Sandbox / Supply chain                                          | P1       |
| T-GAP-14  | Supply chain and dependency governance   | CI has audit / Trivy, but manual does not require lockfile, SBOM, license            | Dependency vulnerabilities, license non-compliance, build irreproducibility                        | SBOM / License / Lockfile / Provenance                                              | P1       |
| T-GAP-15  | Performance capacity and resource leak   | Performance benchmarks exist, but long-stability, leak, capacity boundary missing    | Short test passes, long-running memory / handle / queue out of control                             | Soak / Leak / Capacity / Backpressure                                               | P1       |
| T-GAP-16  | Parallel test isolation and flakiness governance | Concurrency spec exists, but flaky detection mechanism missing                       | Test intermittent failure, misjudged as code issue or skipped                                       | Repeat-run / Quarantine / Flaky budget                                              | P1       |
| T-GAP-17  | Configuration combination matrix         | Env var validation exists, but dev / test / staging / prod combination acceptance missing | Prod-only configuration errors cannot be discovered in advance                                       | Config matrix / Helm / Terraform contract                                            | P1       |
| T-GAP-18  | Accessibility / i18n / Theme             | UI architecture requirements not entered in test manual   | Cross-platform UI inaccessible, translation missing, theme broken                                  | axe / Keyboard / Locale / Visual                                                    | P1       |
| T-GAP-19  | Documentation health and example executability | Only a few docs tests                                       | Doc commands, paths, API examples outdated                                                          | Docs lint / Snippet execution / Link check                                          | P2       |
| T-GAP-20  | Property-based / fuzz testing            | Not included                                              | schema / parser / router vulnerable to unknown input                                                | Fuzz / Property invariant                                                           | P2       |

### 35.2 Tests Already in the Manual But Needing Upgrade

| Existing Test          | Current Problem                                                  | Upgrade Direction                                                                                                                |
| ---------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Coverage test          | Only emphasizes c8 metrics, and current baseline is not in effect | Add "coverage pipeline self-test": verify that `src/` files are actually counted in `coverage-summary.json`, to avoid falsely high or low values again |
| E2E test               | File list is outdated, not covering UI, Mission, Yono, real deployment pre-checks | Add E2E organized by product journey: login, task, Mission, approval, HITL, cost, fault recovery, UI six-platform smoke |
| Performance test       | Biased toward short-run benchmarks                              | Add soak, memory leak, handle leak, queue backlog, backpressure tests                                                            |
| Security test          | Biased toward sandbox / path / command injection                | Add PII / secret leak, OAuth / JWT lifecycle, CSRF / CORS, SSRF, dependency supply chain, plugin permission escape              |
| Golden test            | Biased toward output format                                      | Add prompt lineage, OpenTelemetry span structure, alert rules, UI route map, API compatibility diff                            |
| Architecture invariant test | Biased toward static scan                                       | Add runtime invariants: Mission live guard, budget fail-close, event / outbox same transaction, consumer idempotency            |

## 36. New Special Test Plans

### 36.1 UI Six-Platform Special Test

| Layer                 | Covered Object                                                  | Required Test Content                                                                                                  | Recommended Location                                  |
| --------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Shared unit           | `ui/packages/shared/*`                                          | REST / WS client, token, offline queue, DTO → VM mapper, permission / redaction                                        | `ui/packages/**/__tests__/` or `ui/tests/unit/`       |
| Component             | `ui/packages/ui-core`, `ui/packages/ui-mobile`                  | Component props contract, empty state, error state, loading, theme, high contrast                                       | `ui/tests/component/`                                  |
| Feature integration   | `dashboard`, `task-cockpit`, `workflow-cockpit`, `approval`, `hitl`, `settings` | Route registration, feature gate, query invalidation, WS event mapping                                                 | `ui/tests/integration/features/`                      |
| Platform adapter      | web / electron / tauri / mobile adapter                         | secureStorage, filesystem, clipboard, lifecycle, deepLink, screenSecurity parity                                       | `ui/tests/contracts/platform-adapter/`                |
| App shell smoke       | Web / Electron / Tauri / RN                                     | app bootstrap, provider injection, navigation, auth guard, error boundary                                              | `ui/tests/smoke/`                                      |
| Accessibility        | Web / desktop / mobile                                          | axe, keyboard navigation, ARIA, focus trap, color contrast                                                              | `ui/tests/accessibility/`                             |
| Visual                | design system + key pages                                       | dashboard, task cockpit, approval, HITL, settings screenshot diff                                                       | `ui/tests/visual/`                                     |

Acceptance Rules:

- Web must have runnable smoke + key journey E2E.
- Electron / Tauri / RN must at least have shell bootstrap, adapter injection, navigation / auth boot smoke.
- Each feature must have `web/`, `mobile/`, `hooks/` tests simultaneously; testing only the single file entry is not allowed.
- Planned backend capabilities can only be tested via typed mock + feature gate, and must not be disguised as production-ready.

### 36.2 Mission and Long-Term Goal Governance Test

Mission is the long-term goal and governance context root object, not the execution object. Tests must prove that it is neither bypassed nor replaces the Plan / Node / Attempt contract.

| Test Topic                | Required Assertions                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Mission schema            | `MissionRecord`, membership, snapshot, budget, handoff, error envelope strict parse                                          |
| State machine             | created / running / frozen / completed / aborted, etc. legal transitions, illegal transitions, version conflict, idempotent replay |
| Resolution                | explicit / session / auto / ad-hoc / fail-closed paths, low-risk can be auto-created, high-risk without Mission rejected     |
| Governance                | Permission intersection, policy deny, risk approval, membership revoked, freeze blocking new NodeRun                          |
| Budget                    | reserve / settle / release CAS, budget exhausted must not issue provider / tool call                                          |
| Runtime binding           | RequestEnvelope, ConfirmedTaskSpec, PlanGraphBundle, HarnessRun, NodeRun hold missionRef / snapshotRef                       |
| Event / projection        | state change and event append same transaction, event replay projection consistent                                          |
| Observability             | metric label does not contain missionId, trace / log contains correlation but does not leak high-cardinality sensitive fields |

### 36.3 Yono Business Domain Test

After Yono Business joins the system as a business domain, it is not enough to verify that the configuration file exists; the business closed loop must be verified.

| Test Type                  | Required Test Content                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Domain config smoke        | domain id, workflow, tool bundle, risk / eval / SLA / division configuration complete                              |
| Business flow E2E          | Main chain of enterprise account opening / data collection / approval / execution / evidence archive / exception fallback |
| Permission and tenant isolation | Read / write boundaries for enterprise user, operation, reviewer, administrator roles                            |
| Compliance and audit       | KYC / KYB, sensitive field redaction, approval evidence, audit immutability                                        |
| SLA and cost               | High-priority task deadline, budget upper limit, degradation strategy                                              |
| Failure recovery           | Approval rejection, missing data, external system timeout, duplicate submission idempotency                        |

### 36.4 LLM / Prompt / Eval Test

| Dimension                | Test Plan                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Prompt contract          | prompt template schema, variable completeness, forbid undeclared variables, output JSON schema parseable                             |
| Prompt lineage           | Each model call can correlate prompt version, model, provider, cost, trace id                                                       |
| Deterministic fixtures   | Use fixed provider mock / VCR fixture to verify planner / generator / evaluator branches                                            |
| Eval harness             | Build small golden sets for key tasks, verify correctness, safety, completeness, refusal boundary                                  |
| Red team                 | prompt injection, tool exfiltration, over-permission instructions, sensitive information elicitation                                |
| Cost guard               | max tokens, budget exhausted, provider fallback, retry cost attribution                                                              |
| Regression replay        | Online failure samples enter eval corpus, must pass stably after fix                                                                |

### 36.5 Contract Compatibility and Version Evolution Test

When adding or modifying public interfaces, you must test both "new version is correct" and "old callers are not broken".

| Contract           | Required Test Content                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| HTTP / OpenAPI     | OpenAPI diff: delete field, tighten enum, change required, status code change must fail                     |
| Event schema       | New fields are backward-compatible, delete / rename / semantic change must have migration or version bump |
| SDK / CLI          | Old SDK fixture calls new service; CLI output passes golden verification                                    |
| UI API seam        | Layer C endpoint annotations, planned mock and real contract do not drift                                   |
| Config schema      | dev / test / staging / prod config all parse, prod required field missing fail-close                       |

### 36.6 Data Migration, Backup Recovery, and Upgrade Rollback Test

| Scenario              | Required Test Content                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Forward migration     | Upgrade from previous version fixture DB to current schema, data complete and indexes available       |
| Idempotent migration  | Repeated execution of the same migration does not damage data                                          |
| Rollback rehearsal    | After upgrade failure, rollback script can recover to a startable state                                |
| Backup restore        | `backup-sqlite.sh` / `restore-sqlite.sh` output can be restored and pass smoke                          |
| Hot upgrade           | `verify-hot-upgrade.sh` covers worker draining, lease handoff, no event loss                          |
| Data checksum         | Pre / post migration record count, hash, foreign key consistency for key tables                       |

### 36.7 Chaos, DR, and Long-Stability Test

| Scenario                  | Required Test Content                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Redis disconnect          | Enqueue failure visible, retry, DLQ, backlog drain after recovery                                              |
| Postgres / SQLite busy    | WAL, busy retry, transaction rollback, no partial write                                                        |
| Network delay             | provider / tool timeout, circuit breaker, degradation                                                          |
| Pod / worker kill         | lease reclaim, stuck run sweeper, replay, idempotent writeback                                                 |
| Multi-region failover     | Read / write policy, RTO / RPO, event order when primary region is unavailable                                |
| Soak                      | 6h / 24h queue backlog, memory, handle, timer, listener not growing                                            |

### 36.8 Observability and Operations Test

| Object     | Required Test Content                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Metrics    | Required metrics exist, label whitelist, high-cardinality fields forbidden, anomaly path counter increment |
| Logs       | Structured fields, trace / correlation, PII / secret redaction, forbid critical path `console.*`        |
| Traces     | HTTP → service → event / outbox → worker → provider / tool span chain                                  |
| Alerts     | Prometheus rules consistent with real metric names, Alertmanager receiver config parseable              |
| Runbooks   | Alerts can link to runbook, runbook commands executable or statically verifiable                        |

### 36.9 Privacy, Compliance, and Data Lifecycle Test

| Scenario              | Required Test Content                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| PII / secret redaction | Logs, events, learning objects, prompt context, UI VM all redacted                                    |
| Retention             | session, audit, evidence, memory, learning data expired or archived per policy                       |
| Right-to-delete        | Deletable user can delete data, while retaining compliance audit summary                            |
| Consent                | analyticsConsent, model training opt-out, after effect no longer sending related events              |
| Tenant isolation       | Cross-tenant query, event replay, cache key, file namespace all denied                              |

### 36.10 Plugin, Pack, and Supply Chain Test

| Scenario              | Required Test Content                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Plugin sandbox        | File, network, command, environment variable permission boundaries                                    |
| Pack compatibility    | Multi-version pack manifest, API compatibility, install / uninstall / upgrade                        |
| Malicious plugin      | Permission elevation, path escape, secret read, infinite loop, resource exhaustion                   |
| SBOM / provenance     | lockfile pinned, SBOM generation, license allowlist, build artifact traceable                          |
| Marketplace governance | Review, signature, revoke, gray release, rollback                                                    |

### 36.11 Property-Based / Fuzz Test

Objects suitable for introducing fuzz / property-based testing:

- Zod schema parser: random missing fields, wrong types, extra-long strings, unknown enums.
- Cursor pagination: no duplicates, no missing items, stable ordering after random insert / delete.
- State transition: random event sequences must not exceed terminal state or violate CAS.
- Event replay: projection idempotent after random duplicate / out-of-order / missing ack.
- Cost budget: random reserve / settle / release total not negative, not exceeding upper limit.
- Path / security parser: random encoding, Unicode, null-byte, path separator.

## 37. Completion Execution Roadmap

### 37.1 P0 Must Be Completed First

| Priority | Item                                    | Deliverable                                                                                                          |
| -------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| P0-1     | Coverage pipeline self-test             | A test verifying that c8 `all: true` indeed counts unimported `src/` files as 0%, and makes `.coverage-baseline.json` non-empty |
| P0-2     | UI Web smoke + PlatformAdapter contract | Web app startup, core route render, adapter parity, feature gate mock contract                                       |
| P0-3     | Mission governance E2E                  | High-risk without Mission rejected, freeze / revoke / budget exhausted blocking NodeRun                             |
| P0-4     | Yono Business domain smoke              | Configuration, workflow, permission, approval, audit, SLA main chain                                                 |
| P0-5     | API / event backward compatibility      | OpenAPI diff, event schema diff, SDK fixture compatibility                                                           |
| P0-6     | LLM eval / red-team baseline            | Golden set, prompt injection, cost guard, provider fallback                                                          |
| P0-7     | Migration / backup restore rehearsal    | Previous version fixture DB upgrade, backup recovery, rollback smoke                                                 |

### 37.2 P1 Second Batch

| Priority | Item                       | Deliverable                                                                                            |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| P1-1     | Chaos + recovery           | Redis / DB / network / worker kill targeted drills                                                     |
| P1-2     | Observability contract     | metrics / logs / traces / alerts / runbook full chain verification                                     |
| P1-3     | Privacy lifecycle          | redaction, retention, delete, consent, tenant isolation                                                |
| P1-4     | Long soak / leak           | memory, handle, timer, listener, queue backlog long-stability test                                     |
| P1-5     | Plugin / Pack supply chain | sandbox, compatibility, malicious plugin, SBOM / license                                                |
| P1-6     | UI accessibility / visual / i18n | axe, keyboard, theme, locale, visual diff                                                          |

### 37.3 P2 Sustainable Enhancements

| Priority | Item                  | Deliverable                                                                                            |
| -------- | --------------------- | ------------------------------------------------------------------------------------------------------ |
| P2-1     | Property / fuzz        | schema, pagination, state, event, budget, path parser fuzz                                             |
| P2-2     | Docs health            | Doc links, command snippets, path references, example code executable                                 |
| P2-3     | Flaky governance       | repeat-run, quarantine, skip audit, failure sample auto-replay                                        |
| P2-4     | Test inventory dashboard | source directory, test layer, coverage, mutation score, gap ID visualization                       |

### 37.4 New Automated Guard Test Items in This Round

To prevent the v4.1 supplement section from staying at a manual checklist, this round newly adds `tests/unit/quality/full-coverage-test-manual-gaps.test.ts` as the manual landing guard test. This test does not replace each special test itself, but verifies that every test gap in the manual has locatable runtime code evidence and automated test evidence.

Also newly added `tests/integration/quality/full-coverage-real-paths.test.ts` and `tests/integration/quality/full-coverage-operational-real-paths.test.ts`, which directly execute production modules or real repository configurations such as Mission, Yono Business, Prompt Guard, Budget Guard, Startup Env Schema, Prometheus Exporter, Fixture Redactor, Chaos Scheduler, Supply-chain Audit Script, deployment / DR / alert assets, as the minimum executable product-level and operations-level coverage baseline for Part V.

| Guarded Object              | Automated Assertion                                                                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `T-GAP-01` to `T-GAP-20`    | Manual must completely list 20 gaps, and each gap must map to at least one set of real runtime artifact and automated test artifact                                              |
| `GA-01` to `GA-15`          | Formal interaction access items must be completely preserved; not allowed to be accidentally deleted during document organization                                            |
| P0 / P1 / P2 completion roadmap | Key roadmaps like `P0-1`, `P0-7`, `P1-1`, `P1-6`, `P2-4` must continue to exist                                                                                                |
| Test command entry          | `test:unit`, `test:integration`, `test:e2e`, `test:golden`, `test:performance`, `test:leaks`, `test:invariants`, `coverage:gate`, `test:mutation` must exist                  |
| Coverage baseline           | `.coverage-baseline.json` must contain numeric global / minimum metrics, and incorporate `src/` directory-level baseline                                                       |
| Authenticity check          | Test evidence corresponding to each gap must contain executable `test()` / `it()` and assertions; `tests/` and `ui/tests/` must not have unregistered `.skip`; UI features must keep `web/`, `mobile/`, `hooks/` three entry points |
| Property / Fuzz baseline    | Common parsers like Cursor pagination must have deterministic fuzz / schema drift tests, covering unknown fields, wrong types, negative, floating-point, and array payloads   |
| Real-path baseline          | Mission resolution / live guard / budget, Yono market-to-dispute, Prompt injection / canary leakage, Budget cascade / cost attribution, startup config fail-close, Prometheus exporter, privacy redaction, Chaos rollback, supply-chain audit, deploy / DR / alert assets must have tests that directly invoke production code or real repository configurations |

When adding new test types in the future, you must synchronously update the evidence mapping in this guard test; if some gap still has no automated evidence, it should be explicitly marked as residual risk in this document, not written as already covered.

## 38. New Test Entry Gate Rules

Before any new feature enters `main`, in addition to the v4.0 Checklist, the following questions must be answered:

- Does it involve UI? If so, are there Web + corresponding platform adapter tests?
- Does it involve Mission, budget, permission, approval, HITL? If so, are there fail-close tests?
- Does it involve LLM / provider / tool calls? If so, are there cost, degradation, prompt injection, output schema tests?
- Are you adding / modifying API, event, SDK, config? If so, are there compatibility diff tests?
- Does it involve DB schema or persistent format? If so, are there migration, rollback, backup recovery tests?
- Might it write logs, events, memory, learning objects? If so, are there PII / secret redaction tests?
- Are you adding plugin / Pack capabilities? If so, are there sandbox and supply chain tests?
- Are you adding long-running worker / cache / queue / listener? If so, are there resource leak and backpressure tests?

## 39. Documentation Maintenance Rules

- The current file has removed the duplicate v4.0 copy, retaining only one v4.1 authoritative text.
- When subsequently updating test count, E2E file list, Performance file list, prefer auto-generation by script to avoid outdated manual statistics.
- The v4.1 supplement section has been merged into the formal table of contents, maintained as Part V "Product-Level and Operations-Level Acceptance Testing".

## 40. Formal Interaction Acceptance Criteria

Automated test passing is only a necessary condition for "code being deliverable"; it does not mean that the system can be open to interaction with real users, real businesses, or real external systems. Before formal interaction, the following access items must also be completed to form an auditable release evidence bundle.

### 40.1 Content Still To Be Completed Before Formal Interaction

| Number | Access Item                                | Required Content                                                                                                       | Block Level |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------- |
| GA-01  | Test result trustworthy                    | Full test, UI test, contract test, migration test, key E2E all have most recent pass record; all skip / flaky have registration and approval reason | Blocker     |
| GA-02  | Real interaction path                      | Login, create task, Mission binding, plan generation, execution, approval / HITL, result delivery, evidence query, failure recovery can be traversed | Blocker     |
| GA-03  | Permission and tenant isolation            | Administrator, operation, ordinary user, reviewer, external integration account permission matrix passes automation and manual spot check | Blocker     |
| GA-04  | Budget and risk fail-close                 | Budget exhausted, high-risk without approval, Mission freeze / revoke, policy rejection does not trigger model, tool, or external side effects | Blocker     |
| GA-05  | Data persistence and recovery              | Task, event, outbox, DLQ, evidence, audit, memory, Mission data can be recovered after restart; migration / backup / rollback drill passed | Blocker     |
| GA-06  | LLM output controllable                    | Prompt schema, output schema, cost attribution, provider fallback, prompt injection red-team, eval golden set all passed | Blocker     |
| GA-07  | UI usability                               | Web key flow real-operable; desktop / mobile shell at least passes adapter, navigation, auth, error boundary smoke; Planned feature has clear degradation mark | Blocker     |
| GA-08  | Observable and alerting                    | metrics / logs / traces / alerts / runbook chain available; key errors, budget rejection, DLQ growth, worker unhealthy can be found | Blocker     |
| GA-09  | Security and privacy                       | PII / secret redaction, JWT / OAuth lifecycle, CSRF / CORS, SSRF, path escape, plugin permission escape, dependency high-risk vulnerabilities all pass check | Blocker     |
| GA-10  | External system boundary                   | Email, calendar, payment, enterprise IdP, third-party tool and other external integrations must have sandbox / staging verification; capabilities not connected to real systems keep feature gate off | Blocker     |
| GA-11  | Gray release and rollback                  | Feature flag, gray release percentage, fast shutdown, database rollback / compensation, previous version recovery path drilled | Blocker     |
| GA-12  | Operations takeover                        | Manual takeover, pause queue, freeze Mission, replay event, retry DLQ, export diagnostics package, incident escalation process executable | Blocker     |
| GA-13  | Documentation and training                 | User operation manual, administrator manual, common fault handling, permission description, data retention description and release note updated | Major        |
| GA-14  | Legal and compliance                       | Data retention, audit, privacy, industry domain compliance requirements have responsible person confirmation; high-risk domain must not be opened by automated test alone | Major        |
| GA-15  | Evidence archiving                         | This release commit, build artifact, test report, coverage, migration result, rollback drill, risk acceptance record uniformly archived | Major        |

### 40.2 Minimum Formal Interaction Test Matrix

| Interaction Journey                | Automated Acceptance                                                                                                  | Manual Acceptance                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| User login and session             | auth callback, token refresh, session expiry, logout                                                                  | Browser real login, re-login after expiry                          |
| Task creation to completion        | task create, Mission resolution, PlanGraph, HarnessRun, NodeRun, evidence                                              | UI create task, confirm state, log, result readable                |
| High-risk approval                 | risk detect, approval requested, approve / reject, audit evidence                                                     | Reviewer approve, reject, timeout handling                        |
| HITL / takeover                    | pause, resume, takeover, operator action audit                                                                        | Operation takeover a real task and recover                          |
| Cost and budget                    | reserve, settle, release, budget exhausted blocking                                                                  | Management view budget consumption and rejection reason           |
| Failure recovery                   | worker kill, DLQ retry, event replay, checkpoint resume                                                               | Manually trigger retry and confirm result consistent              |
| UI key page                        | dashboard, task cockpit, approval, HITL, settings smoke                                                              | Desktop and mobile at least complete read-only patrol             |
| External integration               | sandbox connector, timeout, retry, idempotency                                                                       | Staging credentials connectivity and failure prompt                |

### 40.3 Conditions Where Formal Interaction Is Not Allowed

- Full test still has unexplained failures, or skip count increased without approval record.
- Coverage / test list shows that key running chain is not reached by automated test.
- Mission, budget, permission, approval, HITL any fail-close test missing.
- Planned / mock capability in UI has no clear mark, user may mistake as production available.
- PII / secret leak found in logs, events, prompt, learning object.
- Data migration, backup recovery, rollback path has no drill evidence.
- Alert cannot reach responsible person, or runbook cannot guide recovery operation.
- External system uses real credentials but has not passed staging / sandbox verification.

### 40.4 Formal Interaction Pass Criteria

Formal interaction must meet the following conclusions:

- All `Blocker` access items pass, `Major` access items either pass or have clear risk acceptance person and due rectification time.
- Automated test report, manual acceptance record, rollback drill result, and release evidence bundle all archived.
- All production-visible capabilities have owner, runbook, alert, shutdown switch, and rollback / compensation path.
- The capability status seen by the user is consistent with the real backend capability, and mock, planned, partial capabilities are not packaged as completed capabilities.
