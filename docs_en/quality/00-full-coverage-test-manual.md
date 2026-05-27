# Full Coverage Testing Manual

> **Document Version**: v4.1 (v4.0 body + v4.1 gap supplements)
> **Applicable Project**: automatic-agent-platform
> **Test Framework**: Node.js built-in test runner (`node:test`) + `node:assert/strict`
> **Coverage Tool**: c8 v11.0.0 (V8 native coverage) + Istanbul reporter
> **Mutation Testing**: Stryker Mutator v9.6.1
> **Node.js Requirement**: v22+ (`--test` + `--test-concurrency` flags)
> **Last Updated**: 2026-05-18 (supplementing insufficiently covered product-level, operational, UI, Mission, LLM, migration, and supply chain tests)
> **Latest Supplement**: See [v4.1 Supplement: Test Types Not Yet Fully Considered and Completion Solutions](#v41-supplement-test-types-not-yet-fully-considered-and-completion-solutions)

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

**Part V — Product-Level and Operational Acceptance Testing (v4.1 Supplement)**

35. [Insufficiently Covered Test Checklist](#35-insufficiently-covered-test-checklist)
36. [New Specialized Test Solutions](#36-new-specialized-test-solutions)
37. [Completion Execution Roadmap](#37-completion-execution-roadmap)
38. [New Test Entry Gate Rules](#38-new-test-entry-gate-rules)
39. [Documentation Maintenance Rules](#39-documentation-maintenance-rules)
40. [Formal Interaction Admission Standards](#40-formal-interaction-admission-standards)

---

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

- **No external test framework**: No Jest / Vitest / Mocha, reducing dependencies (only 12 devDependencies)
- **No external mock library**: No Sinon / testdouble; mocks created via type-safe factory functions
- **Compile before running**: `npm run build:test` compiles `src/` + `tests/` → `dist/`, tests run from `dist/tests/**/*.test.js`
- **Coverage ratchet**: `.coverage-baseline.json` baseline can only increase, never decrease, enforced by CI
- **TypeScript strict mode**: `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- **ESM modules**: Compile target ES2023 + NodeNext module system, all imports must include `.js` extension

### 1.3 Current Scale

| Metric                              | Value         |
| ----------------------------------- | ------------- |
| Total source files (`src/**/*.ts`)  | **1,387**     |
| Source lines of code                | **265,020**   |
| Total test files (`tests/**/*.ts`) | **1,823**     |
| Test `.test.ts` file count          | **1,803**     |
| Test lines of code                  | **439,448**   |
| Total assertions (`assert.*` calls) | **~52,480**   |
| Test-to-source file ratio           | **1.30**      |
| Unit test files                     | **1,398**     |
| Integration test files              | **358**       |
| E2E test files                      | **17**        |
| Golden test files                   | **11**        |
| Performance test files             | **10**        |
| Global line coverage (c8 measured)  | **0.75%**     |
| Global statement coverage (c8)      | **0.75%**     |
| Global function coverage (c8)        | **0.61%**     |
| Global branch coverage (c8)          | **0.61%**     |

> **v4.0 Changes**: Source files from 1,335 → 1,387 (+52), test files from 1,341 → 1,803 (+462), assertions from ~34,061 → ~52,480 (+18,419). E2E from 10 → 17, Performance from 7 → 10. **Major coverage correction**: v3.0 documentation claimed 82.4% global line coverage, but c8 verification in this release measured only **0.75%** (only 1,384 lines covered out of 182,253 lines, all in 6 files under `src/platform/five-plane-state-evidence/truth/sqlite/` authoritative-task-store-delegating-\*.ts files). All values in `.coverage-baseline.json` baseline file are null and have never been truly populated. This indicates v3.0 coverage data came from incremental builds rather than full c8 analysis; this version corrects to measured values.

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
├── performance/                 # Performance benchmarks (10 files)
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

test("MyService rejects invalid arguments", () => {
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

`partial<T>()` is used to construct partially implemented interface objects (type-correct `Partial<T>`):

```typescript
import { partial } from "../../../helpers/typed-factories.js";

const config = partial<RuntimeConfig>({ maxRetries: 3, timeoutMs: 5000 });
```

### 5.3 Mock Creation Pattern

The project uniformly uses **object literals + interface types** to create mocks:

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

**Do not use** `jest.fn()` / `sinon.stub()` — if you need to record calls, use closure arrays:

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

`withEnv()` saves the original value before the callback and restores it after (even if an exception is thrown):

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

| Scenario             | Use                                                               |
| -------------------- | ------------------------------------------------------------------ |
| Pure logic unit test | Direct `new Service()` + inline mock                                 |
| Repository test      | `createRepositoryHarness()`                                        |
| Cross-service integration | `createIntegrationContext()` or `createSeededIntegrationContext()` |
| API endpoint test    | `createSeededApiContext()` → `ctx.createServer()`                  |
| E2E full flow        | `createE2EHarness()` or `createSeededE2EHarness()`                 |
| Subprocess-related   | `withProcessGuard(fn)` wrapper                                      |
| Concurrency safety   | `runConcurrentInvariant()` / `runCriticalSectionTest()`            |

---

## 6. Coverage Gate Mechanism

### 6.1 Three-Layer Architecture

```
c8 (V8 native) → generate-coverage-report.mjs → check-coverage-baseline.mjs
                                                          ↓
                                                 .coverage-baseline.json (ratchet)
```

### 6.2 c8 Configuration (`.c8rc.json`)

| Parameter   | Value                                         | Description                                |
| ----------- | --------------------------------------------- | ------------------------------------------ |
| `reporter`  | `["text", "html", "lcov", "json-summary"]`   | Four-format output                          |
| `include`   | `["dist/src/**/*.js"]`                        | Only count production code                 |
| `exclude`   | tests, scripts, configs, node_modules         | Exclude non-production files               |
| `all`       | `true`                                        | Files not loaded by tests also counted (0% coverage) |

### 6.3 Ratchet Baseline (`.coverage-baseline.json`)

Global thresholds (v4.0 c8 measured data):

| Metric       | Current Measured  | v3.0 Claimed | Description                          |
| ------------ | ----------------- | ------------ | ------------------------------------ |
| Lines        | **0.75%**        | 82.4%        | Only 1,384 of 182,253 lines covered  |
| Statements   | **0.75%**        | 82.4%        | Same as above                        |
| Functions    | **0.61%**        | 88.5%        | Only 6 of 983 functions covered      |
| Branches     | **0.61%**        | 80.6%        | Same as above                        |

> **v4.0 Major Correction**: `.coverage-baseline.json` currently has all null values (`directories: {}`), baseline has never been truly populated. v3.0 documentation claimed 82.4% line coverage, verified by c8 `all: true` full analysis to be **0.75%**. The only covered files are 6 authoritative-task-store-delegating-\*.ts files under `src/platform/five-plane-state-evidence/truth/sqlite/` (1,384 lines, all 100% covered). The remaining 977 source files have 0% coverage. This indicates v3.0 coverage data may have come from incomplete incremental builds or outdated reports.
>
> **Action Items**: Need to (1) run complete `npm test` + c8 full coverage analysis, (2) populate `.coverage-baseline.json` baseline, (3) enable coverage gate in CI.

**Ratchet Rule**: `check-coverage-baseline.mjs` compares current coverage against baseline:

- Any metric **below** baseline → CI fails (exit code 1)
- Any directory **not in** baseline → CI fails (untracked directory)
- After coverage **improves**, run `npm run coverage:baseline:update` → new value becomes new floor
- **Current Status**: Baseline not populated, gate mechanism exists but not enforced

### 6.4 Directory-Level Baseline (v4.0 c8 measured data)

> **Note**: The following data comes from `coverage/coverage-summary.json` c8 full analysis (`all: true`). Since `.coverage-baseline.json` is not populated, actual coverage status is listed here.

**Directories with coverage** (only 1 directory has non-zero coverage):

| Directory                                        | Files | Covered Files | Lines                | Functions |
| ----------------------------------------------- | ----- | ------------- | -------------------- | --------- |
| `src/platform/five-plane-state-evidence/truth/sqlite/` | 25    | 6             | 1,384/36,219 (3.82%) | 6/167     |

The 6 covered files (all 100%):

- `authoritative-task-store-delegating-governance.ts` (346 lines)
- `authoritative-task-store-delegating-engagement.ts` (345 lines)
- `authoritative-task-store-delegating-lifecycle.ts` (246 lines)
- `authoritative-task-store-delegating-base.ts` (224 lines)
- `authoritative-task-store-delegating-runtime.ts` (213 lines)
- `authoritative-task-store-delegating-core.ts` (10 lines)

**Top directories with zero coverage** (sorted by code volume, Top-15):

| Directory                                 | Files | Total Lines | Lines Coverage |
| ----------------------------------------- | ----- | ----------- | -------------- |
| `src/platform/five-plane-execution/`                  | 162   | 43,202      | 0%             |
| `src/platform/shared/`                   | 100   | 24,079      | 0%             |
| `src/platform/five-plane-control-plane/`            | 75    | 23,555      | 0%             |
| `src/platform/five-plane-orchestration/`            | 81    | 9,332       | 0%             |
| `src/platform/five-plane-interface/`               | 49    | 8,705       | 0%             |
| `src/scale-ecosystem/marketplace/`   | 26    | 7,737       | 0%             |
| `src/sdk/cli/`                       | 78    | 6,148       | 0%             |
| `src/platform/model-gateway/`        | 17    | 5,012       | 0%             |
| `src/platform/contracts/`            | 34    | 4,041       | 0%             |
| `src/domains/registry/`              | 14    | 2,456       | 0%             |
| `src/ops-maturity/drift-detection/`  | 15    | 2,271       | 0%             |
| `src/domains/governance/`            | 4     | 1,632       | 0%             |
| `src/platform/prompt-engine/`        | 9     | 1,432       | 0%             |
| `src/scale-ecosystem/feedback-loop/` | 7     | 578         | 0%             |
| `src/interaction/nl-gateway/`        | 4     | 549         | 0%             |

> **v4.0 Note**: High-coverage directories listed in v3.0 (like execution/queue 99.7%, workflow-debugger 99.5%) all show 0% in c8 full analysis. This further confirms v3.0 data is inaccurate. Real coverage improvement requires ensuring `npm run build:test` compiles all source and test files to `dist/`, then c8 collects coverage when running tests.

### 6.5 Update Flow

```bash
npm test                          # Run complete tests
npm run coverage:baseline:update  # Only execute after all tests pass
git diff .coverage-baseline.json  # Confirm changes are reasonable
git add .coverage-baseline.json   # Commit new baseline
```

## 7. Test Coverage Assurance System

This section is the core methodology of the entire manual — answering the question **"How to ensure tests are not missed"**. The system consists of five layers of protection, each addressing different levels of miss risk.

### 7.1 Five-Layer Protection Model

```
┌─────────────────────────────────────────────────────────┐
│ Layer 5: PR Review Checklist (human review)             │
├─────────────────────────────────────────────────────────┤
│ Layer 4: Mutation Testing Stryker (assertion validity)  │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Coverage Ratchet + Directory Baseline          │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Traceability Matrix (src file ↔ test file mapping)
├─────────────────────────────────────────────────────────┤
│ Layer 1: Layered Testing Strategy (Unit/Integration/E2E)
└─────────────────────────────────────────────────────────┘
```

### 7.2 Layer 1: Layered Testing Strategy

**Addresses**: Blind spots caused by improper test granularity.

Each functional point must be tested at the correct layer:

| Concern                          | Correct test layer                 | Anti-pattern                           |
| --------------------------------- | ----------------------------------- | -------------------------------------- |
| Pure function logic (parsing, validation, transformation) | Unit                  | Using E2E to test logic branches       |
| Database read/write, transactions, migrations | Integration         | Using mock DB to hide SQL errors       |
| Multi-service collaboration, event propagation | Integration    | Testing each service separately with mocks and skipping collaboration tests |
| Security boundaries (sandbox, path traversal) | Integration       | Relying only on Unit to test regex     |
| API contracts (HTTP status codes, response bodies) | Integration/E2E | Only testing service layer without testing HTTP layer |
| Full business flow               | E2E                                 | None                                   |
| Output format stability          | Golden                              | Manually writing expected strings      |
| Concurrency safety               | Integration + concurrent-runner     | Assuming thread safety after single-thread testing |

**Execution Rules**:

1. Each `src/platform/<module>/` directory must have a corresponding `tests/unit/platform/<module>/` directory
2. Each publicly exposed service class must have at least 1 unit test file
3. Functions involving DB/file/subprocess must have integration tests
4. Security-related changes must have denial-path regression tests

### 7.3 Layer 2: Traceability Matrix

**Addresses**: Source files without corresponding test files.

Build a **source file → test file** mapping to ensure every production file has corresponding tests.

**Generation Method**:

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

**Matrix Maintenance Rules**:

- Every `.ts` source file added in a PR must have a corresponding `.test.ts` file
- If a file truly doesn't need testing (pure type definitions, barrel exports), mark `N/A` + reason in the matrix
- Run the above script at the end of each sprint to update the coverage gap list

### 7.4 Layer 3: Coverage Ratchet

**Addresses**: Existing tests being deleted or new code not covered.

See [§6 Coverage Gate Mechanism](#6-coverage-gate-mechanism). Key points:

- **Global gate**: lines/statements/functions/branches four dimensions
- **Directory-level gate**: each `src/platform/<module>` has independent baseline
- **`all: true`**: Files not imported by any test are also counted (shown as 0% coverage), preventing "no one references it so no one tests it"
- **Can only increase**: Baseline values monotonically increase via `npm run coverage:baseline:update`

**Limitations of coverage**: Coverage only indicates "code was executed", not "behavior was verified". For example:

```typescript
test("calls the function", () => {
  myFunction(); // 100% line coverage, but 0 assertions
});
```

This is why Layer 4 is needed.

### 7.5 Layer 4: Mutation Testing

**Addresses**: Tests execute code but lack effective assertions.

Stryker injects **mutants** into code, for example:

- `>` changed to `>=`
- `true` changed to `false`
- Delete entire statement
- String `"error"` changed to `""`

If a mutant survives after injection (test still passes), the test cannot effectively detect this logic.

See [§11 Mutation Testing (Stryker)](#11-mutation-testing-stryker). Thresholds:

- **break = 50%**: Below this value CI fails immediately
- **low = 60%**: Yellow warning
- **high = 80%**: Green target

**Complementary relationship between mutation testing and coverage**:

| Scenario         | Line Coverage | Mutation Score | Problem     |
| ---------------- | ------------ | -------------- | ----------- |
| Execution with assertion | High       | High           | None        |
| Execution without assertion | High     | **Low**        | Missing assertion |
| No execution     | **Low**      | Low            | Test missing |
| Dead code        | Low          | Low            | Should be removed |

### 7.6 Layer 5: PR Review Checklist

**Addresses**: Logic gaps that automated tools cannot detect.

Before each PR is merged, reviewer checks the following checklist:

- [ ] Does each new/modified public function have corresponding tests?
- [ ] Are both happy path **and** error path covered?
- [ ] Are boundary conditions tested (empty array, null, 0, MAX_INT, timeout)?
- [ ] Do security changes have denial-path regression?
- [ ] Do async functions test reject/error paths?
- [ ] Do configuration changes have corresponding config validation tests?
- [ ] Has coverage improved or stayed the same (not decreased)?
- [ ] Has mutation test score improved or stayed the same?

### 7.7 Gap Type Classification and Corresponding Protection

| Gap Type           | Description                              | Detection Layer                                    |
| ------------------ | ---------------------------------------- | -------------------------------------------------- |
| **File-level gap** | Entire source file has no test           | Layer 2 (Matrix) + Layer 3 (`all: true`)           |
| **Function-level gap** |某个 exported function has no test    | Layer 3 (function coverage) + Layer 5 (Review)      |
| **Branch-level gap** | if/else/switch branch not covered     | Layer 3 (branch coverage) + Layer 4 (Stryker)      |
| **Assertion-level gap** | Code executed but no result verification | Layer 4 (Stryker mutant survived)              |
| **Scenario-level gap** | Missing specific business scenario test | Layer 5 (Review)                               |
| **Boundary condition gap** | Empty input/extreme/concurrent not covered | Layer 4 + Layer 5                      |
| **Regression gap**   | Bug fix doesn't have regression test  | Layer 5 (Review) + Layer 3 (ratchet doesn't roll back) |
| **Security gap**     | Attack vector not tested              | Layer 1 (denial-path standard) + Layer 5           |

### 7.8 Test Completion Priority Sorting Method

When a gap is found, prioritize completion in this order:

```
P0 — Security boundary not tested (sandbox escape, path traversal, injection attack)
P1 — Core orchestrator/service has no test (0% coverage)
P2 — Existing test but branch coverage < 60%
P3 — Existing test but mutation score < 50% (insufficient assertion)
P4 — Helper function/tool class missing boundary condition tests
P5 — Type definition Schema validation test
```

### 7.9 Continuous Assurance Process

```
Development Phase → Write code + Write tests (TDD or Code-then-Test)
          ↓
Local Verification → npm test (coverage + gate)
          ↓
PR Submit → CI automatically runs: lint → typecheck → test → coverage:gate
          ↓
PR Review → Manual Checklist (§7.6)
          ↓
Main Merge → Stryker mutation testing (push to main triggers)
          ↓
Sprint End → Run Traceability Matrix script, update gap list
```

---

## 8. Security Regression Testing Standards

### 8.1 Denial-Path Regression Methodology

Core principle of security testing: **One test per attack vector, assert rejection status + specific error code**.

```
Attack surface identification → Build malicious input → Call tested interface → Assert blocked/denied + error code
```

### 8.2 Attack Surface Classification

| Attack Surface   | Test Target                   | Typical Attack Vector                                           |
| ---------------- | ----------------------------- | --------------------------------------------------------------- |
| **Path traversal** | sandbox filesystem isolation | `../`, symlink, double-encoded `%2f`, null-byte `\x00`         |
| **Command injection** | command executor parameter filtering | `;`, `$()`, backtick, `&&`, `\|\|`, `|`, `${VAR}`            |
| **Privilege bypass** | execution-level tool authorization | Modify allowedToolsJson, malformed allowlist               |
| **Script escape** | interpreter path restriction | Script path outside workspace, absolute path pointing external |
| **Input validation** | Schema/config validation | Oversized string, type mismatch, missing required fields        |
| **Concurrent attack** | locks and transaction isolation | Approve same request simultaneously, concurrent write to same resource |

### 8.3 Security Test Structure Template

```typescript
test("<component> blocks <attack type> <specific description>", async () => {
  const workspace = createTempWorkspace("aa-security-");
  try {
    // 1. Build attack input
    const maliciousInput = buildAttackPayload();

    // 2. Execute tested interface
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

### 8.5 Required Scenarios for Security Tests

For each component involving security boundaries, cover at least the following scenarios:

1. **Normal legitimate request** — confirm happy path works (at least 1 positive test)
2. **Path escape** — cover at least `../`, symlink, absolute path three vectors
3. **Input injection** — cover at least shell metachar, null-byte two vectors
4. **Insufficient privileges** — unauthorized tool, wrong domain/role
5. **Malformed input** — malformed JSON, type mismatch, null value
6. **Fail-close** — when security check logic itself errors, default deny rather than allow

---

## 9. Golden / Snapshot Testing

### 9.1 Applicable Scenarios

Golden tests are suitable for scenarios where **output format needs to be stable**:

- CLI output format (`inspect`, `doctor`, `dispatch-execution` command output)
- API response body structure
- Configuration file generation results
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

| API                                     | Purpose          |
| --------------------------------------- | ---------------- |
| `assertGolden(name, actual)`            | JSON exact match |
| `assertGoldenContains(name, substring)` | Contains substring |
| `assertGoldenMatches(name, regex)`      | Regex match      |

### 9.4 Updating Snapshots

```bash
UPDATE_GOLDEN=1 npm run test:golden
git diff tests/golden/snapshots/       # Review changes
git add tests/golden/snapshots/
```

### 9.5 Golden Test Notes

- **Do not** include timestamps, random IDs and other unstable fields in golden files — normalize first then snapshot
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

- **Isolated execution**: `npm run test:performance` is independent from main test suite to avoid interference
- **Absolute threshold**: Assert absolute performance metrics (like >1000 ops/sec), not relative changes
- **Warmup**: Execute a small number of warmup iterations before timing to exclude JIT compilation effects
- **Multiple median**: Take median of multiple runs for latency-sensitive tests to reduce variance
- **Optional in CI**: Performance tests run as optional job in CI and do not block merge (due to machine differences)

---

## 11. Mutation Testing (Stryker)

### 11.1 Concept

Mutation testing answers the question coverage cannot answer: **Are the test assertions truly effective?**

Stryker injects small mutants into source code, then runs the test suite. If tests still pass (mutant survived), it means no assertion can detect this code change — i.e., assertion is missing.

### 11.2 Configuration (`stryker.config.mjs`)

| Parameter               | Value                              | Description                          |
| ---------------------- | ----------------------------------- | ------------------------------------ |
| `testRunner`           | `"command"`                         | Run via `npm run test:unit`          |
| `mutate`               | `src/platform/**/*.ts`              | Mutation scope: platform business code |
| Exclusions             | `.d.ts`, `index.ts`, `types/**`    | Don't mutate type definitions and barrels |
| `thresholds.break`     | 50                                  | Below 50% → CI fails                 |
| `thresholds.low`       | 60                                  | Below 60% → Yellow warning           |
| `thresholds.high`      | 80                                  | Above 80% → Green                   |
| `coverageAnalysis`     | `"perTest"`                         | Each test separately analyzes coverage scope |

### 11.3 Running

```bash
npm run test:mutation         # Run locally
# In CI, only runs on push to main (takes longer)
```

Report output to `reports/mutation/`, includes HTML visualization report.

### 11.4 Reading Reports

| Status              | Meaning                     | Action               |
| ----------------- | -------------------------- | ------------------ |
| **Killed**        | Test detected mutant and failed | No action needed           |
| **Survived**      | Test still passed after mutation | **Need stronger assertions** |
| **No coverage**   | Mutant code not executed by any test | Need to add tests         |
| **Timeout**       | Mutation caused infinite loop/timeout | Treated as killed        |
| **Runtime error** | Mutation caused runtime crash | Treated as killed        |

### 11.5 Handling Survived Mutants

```typescript
// Suppose Stryker reports: mutant survived after mutating `>` to `>=`
// Original code: if (retries > maxRetries) throw new Error("exceeded");

// Indicates missing boundary test. Need to add:
test("throws when retries equals maxRetries", () => {
  // Test behavior when retries === maxRetries
  // If should throw, add assert.throws
  // If should not throw, add assert.doesNotThrow
});
```

### 11.6 Collaboration Between Mutation Testing and Other Layers

- **Coverage** tells you "which code is not executed" → Add tests
- **Stryker** tells you "which code is executed but assertions are insufficient" → Strengthen assertions
- The two complement each other and cannot replace each other

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
- `secret-provider-integration.yml` — Secret provider integration testing

### 12.2 Trigger Conditions

| Job            | Push to main | PR  | Other            |
| -------------- | ------------ | --- | --------------- |
| validate       | ✓            | ✓   | `codex/**` branches |
| pg-integration | ✓            | ✓   | —               |
| mutation-test  | ✓            | ✗   | Main only       |
| security       | ✓            | ✓   | —               |
| trivy-scan     | ✓            | ✓   | —               |

### 12.3 Test Assurance Points in CI

| Assurance Point | Tool                        | Failure Condition           |
| --------------- | --------------------------- | -------------------------- |
| Code style      | ESLint                      | Any lint error    |
| Type safety     | tsc --noEmit                | Any type error    |
| Dependency security | npm audit                   | HIGH/CRITICAL vulnerability |
| Functional correctness | node --test                 | Any test failure       |
| Coverage doesn't roll back | check-coverage-baseline.mjs | Below baseline           |
| Mutation score  | Stryker                     | Below break=50%     |
| Static analysis | CodeQL                      | Security defect found       |
| Container security | Trivy                       | CRITICAL/HIGH vulnerability |

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

- [ ] **Unit tests**: Each exported function / class method
  - [ ] Happy path (normal input → expected output)
  - [ ] Error path (illegal input → expected exception/error code)
  - [ ] Boundary conditions (null, zero, maximum, empty array)
- [ ] **Schema tests** (if using Zod):
  - [ ] Legal minimal payload → `doesNotThrow`
  - [ ] Illegal payload → `throws`
  - [ ] Missing optional fields → `doesNotThrow`
- [ ] **Integration tests** (if involving DB/file/subprocess):
  - [ ] Use `createIntegrationContext()` or `createRepositoryHarness()`
  - [ ] `try/finally` ensures cleanup
- [ ] **Security tests** (if involving security boundaries):
  - [ ] Denial-path regression covers various attack vectors
  - [ ] Fail-close tests

### 13.3 Coverage

- [ ] Run `npm test` locally to confirm coverage is not below global baseline
- [ ] Run `npm run coverage:baseline:update` to update baseline
- [ ] Confirm new directory appears in `.coverage-baseline.json`

### 13.4 Mutation Testing

- [ ] Confirm new module path is within `mutate` glob range in `stryker.config.mjs`
- [ ] Run `npm run test:mutation` locally to confirm no large number of survived mutants

### 13.5 CI Compatibility

- [ ] Tests pass under both Node 20 and Node 22
- [ ] Tests support `--test-concurrency=12` parallel execution without shared state conflicts
- [ ] No hardcoded absolute paths, port numbers, timestamps

### 13.6 Documentation

- [ ] Update source file ↔ test file mapping in Traceability Matrix (§7.3)
- [ ] If new Helper/Fixture is introduced, update §5 tool inventory

---

---

---

# Part II — Architectural Semantics Coverage (added in v1.1, supplemented in v1.2, expanded in v3.0)

> Part I addresses "code coverage governance" — ensuring every line of code is executed and every assertion is effective.
> Part II addresses "architectural semantics coverage" — ensuring the system's key design semantics (state machines, events, concurrency, stage contracts) are all covered by tests.

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

| State Machine | Definition File                                           | Validation File                                                        | States | Terminal States                            |
| ------------- | ---------------------------------------------------------- | --------------------------------------------------------------- | ------ | ---------------------------------------- |
| **Task**      | `src/platform/five-plane-execution/state-transition/types.ts` | `src/platform/five-plane-execution/state-transition/transition-service.ts` | 7      | done, failed, cancelled                  |
| **Workflow**  | Same as above                                               | Same as above                                                            | 7      | completed, failed, cancelled             |
| **Session**   | Same as above                                               | Same as above                                                            | 7      | completed, failed, cancelled             |
| **Execution** | Same as above                                               | Same as above                                                            | 8      | succeeded, failed, cancelled, superseded |
| **Approval**  | Same as above                                               | Same as above                                                            | 5      | approved, rejected, expired, cancelled   |

These 5 state machines are implemented via `StateTransitionMachine<T>` generic class, `assertTransition()` method uses CAS to prevent concurrent overwrites.

### 14.3 State Machine Test Three-Layer Requirements

#### A. Full Coverage of Legal Transitions (Transition Coverage)

Every **legal transition edge** for each state machine must have at least one test:

```typescript
test("task transition: queued -> in_progress is allowed", () => {
  assert.doesNotThrow(() =>
    taskStateMachine.assertTransition("queued", "in_progress"),
  );
});
```

**Quantification Standard**: Legal edge coverage = tested legal edges / total legal edges = **100%**

Task state machine legal edge list (example):

```
queued → pending, in_progress, cancelled
pending → in_progress, cancelled
in_progress → awaiting_decision, done, failed, cancelled
awaiting_decision → in_progress, failed, cancelled
```

#### B. Full Rejection of Illegal Transitions (Denial Coverage)

Transitions from **each terminal state** to any non-self state must be rejected tested:

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

**Quantification Standard**: All terminal states × all non-self states = must test rejection

#### C. Cross-Entity Cascade Transitions (Cascade Coverage)

`TransitionService` provides `applyTaskTerminalState` and `ApprovalBlockingTransitionService`, which atomically cascade transitions multiple entities.

Cascade scenarios that must be tested:

| Trigger             | Task              | Workflow  | Session       | Execution | Approval  |
| ------------------- | ----------------- | --------- | ------------- | --------- | --------- |
| task → done         | done              | completed | completed     | succeeded | —         |
| task → failed       | failed            | failed    | failed        | failed    | —         |
| task → cancelled    | cancelled         | cancelled | cancelled     | cancelled | —         |
| approval needed     | awaiting_decision | paused    | awaiting_user | blocked   | requested |
| approval granted    | in_progress       | running   | streaming     | executing | approved  |

### 14.4 Auxiliary State Machine Testing Requirements

For non-core state machines (Circuit Breaker, Rollout, Repair Pipeline, Plugin, etc.), requirements:

| Category                           | Requirement                                  |
| ---------------------------------- | -------------------------------------------- |
| Has `assertTransition()` validation | Same as core three-layer requirements        |
| Has `transitionTo()` without validation | At least cover happy path + terminal states |
| Only as enum value                 | Each enum value appears in at least one test |

### 14.5 Circuit Breaker State Machine Special Requirements

Circuit Breaker (`closed → open → half_open → closed`) involves time and counting, requiring additional tests:

- [ ] Consecutive failures ≥ threshold → trigger open
- [ ] Failure rate ≥ 50% → trigger open
- [ ] Requests in open state are rejected + return `retryAfterMs`
- [ ] After resetTimeoutMs → transition to half_open
- [ ] half_open single probe success/failure behavior
- [ ] Consecutive successes ≥ halfOpenSuccessThreshold → recover closed

### 14.6 Transition Table Single Source Rule

**Hard requirement**: The canonical transition map in `transition-service.ts` is the **sole authoritative source** for state transitions. Test cases **forbid** manually creating a copy of the transition table.

#### A. Principles

| Item     | Rule                                                                                 |
| -------- | ------------------------------------------------------------------------------------ |
| Single source | All legal/illegal transition judgments must come from `TransitionService` production map |
| No copies | Test must not have hand-written copies like `const allowedTransitions = { pending: ["running", ...] }` |
| Data-driven | Test matrix must be **auto-generated** from production map, not manually enumerated |
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

// Auto-generate illegal transition pairs (all permutations - legal pairs - self-transitions)
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

- Coverage gate adds check: If test file contains hardcoded object literals with same key names as `TRANSITION_MAP`, CI reports warning
- PR Review checklist adds item: "Are state machine tests derived from production map?"

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

| Tier       | Semantics                  | Ack Required | Events | Example                                            |
| ---------- | -------------------------- | ------------ | ------ | --------------------------------------------------- |
| **Tier 1** | Must persist + must ack    | Must         | 9      | `task:status_changed`, `decision:requested`     |
| **Tier 2** | Persist, ack optional       | Recommended  | ~35    | `dispatch:*`, `worker:*`, `plugin:*`, `skill:*` |
| **Tier 3** | Best-effort                 | None         | ~4     | `stream:chunk_emitted`, `perf:*`                |

### 15.2 Tier-Based Testing Requirements

#### Tier 1 Events (9 types) — Highest Testing Requirements

Each Tier 1 event must cover complete lifecycle:

| Phase            | Test Content                                       |
| --------------- | -------------------------------------------------- |
| **Schema**      | payload satisfies Zod validator (valid + invalid)  |
| **Publish**     | Correctly writes to events table + creates ack record |
| **Deliver**     | `deliverPending()` delivers event to registered consumer |
| **Ack**         | Consumer processes successfully → ack status = `"acked"` |
| **Retry**       | Consumer fails → exponential backoff retry (100ms → 5s) |
| **Dead Letter** | After 3 retries → writes to dead_letter table     |
| **Replay**      | `EventOpsService.replayConsumer()` redelivers       |
| **Integrity**   | SHA-256 hash chain not tampered                    |

#### Tier 2 Events — Medium Testing Requirements

| Phase            | Test Content                             |
| --------------- | ---------------------------------------- |
| **Schema**      | payload satisfies Zod validator           |
| **Publish**     | Correctly writes to events table           |
| **Deliver**     | At least one consumer can receive           |
| **Idempotency** | Events with `idempotencyKey` are not consumed twice |

#### Tier 3 Events — Basic Testing Requirements

| Phase            | Test Content                    |
| --------------- | ------------------------------- |
| **Publish**     | Does not throw exception          |
| **Best-effort** | Event doesn't block when consumer is offline |

### 15.3 DLQ Testing Requirements

The system has **3 independent DLQs**:

| DLQ         | Location                                | Test Focus                                                    |
| ----------- | --------------------------------------- | -------------------------------------------------------------- |
| Event DLQ   | `event_dead_letters` table              | Correctly enters DLQ after 3 retries + `dlq-manager list` queryable |
| Gateway DLQ | `gateway_dead_letters` table             | Non-retryable status codes go directly to DLQ, retryable status codes retry then DLQ |
| Jobs DLQ    | `queue_jobs.status = "dead_letter"`      | Enters DLQ after exceeding `maxAttempts`                       |

Each DLQ must test:

- [ ] Messages correctly enter DLQ under correct conditions
- [ ] DLQ messages are queryable (list / count)
- [ ] DLQ messages can be cleared (purge)
- [ ] Retryable DLQ messages can be re-queued

### 15.4 Event Schema Drift Regression

`RAW_EVENT_SCHEMA_REGISTRY` in `event-registry.ts` defines schemas for all events:

```typescript
test("all TypedEventPayloadMap keys are registered in EVENT_SCHEMA_REGISTRY", () => {
  // MissingTypedEventDefinitions type check already exists at compile time
  // Runtime supplement validation
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

All **retryable consumers** (Tier 1 must retry, Tier 2 recommended retry) must pass idempotency tests. Duplicate consumption of the same event **must not** produce:

| Forbidden Behavior            | Verification Method                                                      |
| ----------------------------- | ----------------------------------------------------------------------- |
| Duplicate DB writes           | After same event delivered 2 times, related table row count unchanged  |
| Duplicate notifications/external messages | Mock notification channel, assert call count = 1                   |
| Duplicate downstream side effects | Mock downstream service, assert idempotency key was deduplicated     |
| Duplicate state machine transitions | Second delivery doesn't trigger `assertTransition()` (state already at terminal or target state) |

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

#### Scope of Application

- All consumers registered in `REQUIRED_CONSUMERS_BY_EVENT_TYPE`
- All handlers implementing `onEvent()` / `handleEvent()` interfaces
- Gateway DLQ replay consumer

---

## 16. OAPEFLIR Stage Coverage Matrix

### 16.1 Coverage Matrix Definition

Not by directory, not by file, but by **OAPEFLIR 8 stages' design semantics** to define the minimum test set.

Each stage must cover **7 standard paths**:

| Path Number | Path Name                            | Description                                                  |
| ----------- | ------------------------------------- | ------------------------------------------------------------ |
| P1          | **Happy Path**                        | Standard input → Stage complete → Correct output            |
| P2          | **Degraded Path**                     | Partial input missing/insufficient quality → Degraded processing → Output with warnings |
| P3          | **Invalid Input Path**                | Illegal/malformed input → Reject or fail-fast                 |
| P4          | **Timeout Path**                      | Stage execution timeout → Correct abort + resource cleanup    |
| P5          | **Skip Path**                         | Stage skipped (condition not met) → stage status = `"skipped"` |
| P6          | **Downstream Contract Violation**      | Upstream output doesn't satisfy current stage input contract → Reject or rollback |
| P7          | **Human Intervention Path**            | Stage requires human intervention → Pause waiting approval/confirmation → Recover or terminate |

### 16.2 Stage-by-Stage Coverage Matrix

#### Observe

| Path | Test Scenario                          | Assertion Focus                                                 |
| ---- | -------------------------------------- | ---------------------------------------------------------------- |
| P1   | Standard task input → Generate TaskSituation | `objective`, `currentPhase`, `codebaseSnapshot` fields complete |
| P2   | Empty codebase / no fileRefs           | TaskSituation can still be generated, `fileRefs: []`             |
| P3   | Illegal taskId / empty objective        | Schema rejection                                              |
| P4   | Collection timeout                     | Timeout abort + return existing snapshot                        |
| P5   | Input already cached / no changes      | Skip re-collection                                             |
| P6   | —                                      | As first stage, no upstream                                       |
| P7   | Task requires human confirmation of scope | Pause collection → Wait for human confirmation → Resume after |

#### Assess

| Path | Test Scenario                               | Assertion Focus                                                      |
| ---- | ------------------------------------------- | --------------------------------------------------------------------- |
| P1   | Standard TaskSituation → UnifiedAssessment  | complexity / risk / routingDecision / resourceAllocation reasonable |
| P2   | High uncertainty task                       | Correctly upgrade executionMode to `"supervised"`                      |
| P3   | Malformed situationRef                      | Schema rejection                                                   |
| P4   | Assessment timeout                          | Degrade to default assessment                                         |
| P5   | Simple task skip deep assessment            | Use fast assessment path directly                                    |
| P6   | TaskSituation missing required fields        | Reject + rollback to Observe                                         |
| P7   | High uncertainty → requires human supervision | executionMode upgraded to `"supervised"`, wait for approval then continue |

#### Plan

| Path | Test Scenario                          | Assertion Focus                                                |
| ---- | --------------------------------------- | -------------------------------------------------------------- |
| P1   | Standard assessment → Plan with steps | stepId unique, dependencies legal, strategy correct           |
| P2   | High complexity task                   | Multi-step DAG + parallel steps                                |
| P3   | version = 0 / steps empty              | Schema rejection                                             |
| P4   | Planning timeout                        | Return minimum viable plan                                      |
| P5   | Assessment indicates no planning needed | stage skipped                                                   |
| P6   | AssessmentRef doesn't exist             | Reject                                                        |
| P7   | High-risk plan requires human review   | plan status = `"pending_approval"` → After approval, execution begins |

#### Execute

| Path | Test Scenario                         | Assertion Focus                                               |
| ---- | -------------------------------------- | ------------------------------------------------------------- |
| P1   | Single-step execution → DualChannelStepOutput | userFacingResult + systemTelemetry complete                |
| P2   | Partial step failure → partial success | Successful step outputs are retained                          |
| P3   | Illegal tool call / sandbox rejection  | `status: "blocked"` + error code                           |
| P4   | Step timeout                           | Step marked `"failed"` + `code: "tool.timeout"`           |
| P5   | All steps completed (replay)            | Skip                                                          |
| P6   | Plan step references non-existent tool | Reject + rollback to Plan                                     |
| P7   | Step triggers approval block            | `status: "blocked_awaiting_approval"` → After approval, resume execution |

#### Feedback

| Path | Test Scenario                       | Assertion Focus                                        |
| ---- | ------------------------------------ | ------------------------------------------------------ |
| P1   | Execution result → FeedbackSignal集合 | signal correctly classified (success/failure/correction) |
| P2   | Duplicate signal                    | deduplication takes effect                              |
| P3   | Empty signal list                   | Return empty set, no error                              |
| P4   | Signal collection timeout           | Return already collected portion                        |
| P5   | No execution output                 | Skip feedback                                          |
| P6   | stepOutputRefs references non-existent | Ignore + warning                                     |
| P7   | Feedback result requires human confirmation of accuracy | signal marked `"pending_review"` → After human confirmation, takes effect |

#### Learn

| Path | Test Scenario                                                         | Assertion Focus                                              |
| ---- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| P1   | Feedback signal → LearningSignal (failure_pattern / recovery_playbook) | learningType + sourceSignalIds correct                   |
| P2   | Low confidence pattern                                                     | Marked as tentative                                      |
| P3   | Illegal learningType                                                | Reject                                                  |
| P4   | Mining timeout                                                       | Return empty                                              |
| P5   | No failure signal                                                    | Skip learning                                             |
| P6   | FeedbackSignal structure incomplete                                   | Reject                                                  |
| P7   | Learning conclusion requires expert review                          | learning marked `"expert_review_required"` → After review, entered |

#### Improve

| Path | Test Scenario                                                       | Assertion Focus                                         |
| ---- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| P1   | Learning output → ImprovementCandidate (status: proposed → approved) | changeScope + expectedBenefit reasonable               |
| P2   | Improvement exceeds autonomy boundary                               | status stays `"proposed"`, requires human approval           |
| P3   | Empty learning output                                               | No candidate generated                                 |
| P4   | Evaluation timeout                                                  | candidate marked `"rejected"`                      |
| P5   | No improvable items                                                | Skip                                                   |
| P6   | LearningSignal references illegal sourceSignalRefs                 | Reject                                                 |
| P7   | Improvement exceeds autonomy boundary → requires human approval    | candidate stays `"proposed"` → After approval, advance or reject |

#### Release

| Path | Test Scenario                                                        | Assertion Focus                                                   |
| ---- | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| P1   | approved candidate → RolloutRecord (shadow → suggest → stable)       | level progresses correctly                                        |
| P2   | metrics gate not passed                                              | Stays at current level                                            |
| P3   | Illegal candidateId                                                  | Reject                                                            |
| P4   | rollout timeout                                                     | Automatic rollback                                                |
| P5   | candidate is rejected                                               | Skip rollout                                                      |
| P6   | candidate references expired evidence                                 | Reject + re-evaluate                                              |
| P7   | rollout requires human approval release                              | rollout stays `"pending_approval"` → After approval, continue advancing level |

### 16.3 Coverage Quantification

```
OAPEFLIR Stage Coverage = (tested paths) / (8 stages × 7 paths = 56) × 100%
```

**Goal**: ≥ 85% (at least 48/56 paths have tests)

### 16.4 OAPEFLIR-Harness Semantic Mapping (v3.0 new)

> Corresponds to Architecture Review v6.0 Gap I-2 (§13.5 OAPEFLIR-Harness External Semantic Mapping)

Architecture Design §13.5 requires explicit semantic mapping between OAPEFLIR 8 stages and Harness three roles (Planner / Generator / Evaluator). This mapping is not yet codified (Gap I-2), but tests should proactively define expected mapping:

| OAPEFLIR Stage | Harness Role      | Mapping Semantics                                |
| ------------- | ----------------- | ---------------------------------------- |
| Observe       | —                 | External input collection, does not enter Harness loop |
| Assess        | Planner           | Task assessment → PlanBundle input              |
| Plan          | Planner           | Generate PlanBundle (stepId/DAG/tools)     |
| Execute       | Generator         | Generate WorkProduct (code/documents/operations) |
| Feedback      | Evaluator         | Generate EvaluationReport (pass/fail)      |
| Learn         | Evaluator         | Extract LearningSignal from EvaluationReport |
| Improve       | Planner+Evaluator | Improvement candidate evaluation + approval |
| Release       | —                 | Rollout control, not directly participating in Harness loop |

**Test Requirements**: When Gap I-2 is implemented, need to verify:

- [ ] Mapping configuration exists and contains all 8 stages
- [ ] Planner role covers Assess/Plan/Improve three stages
- [ ] Generator role covers Execute stage
- [ ] Evaluator role covers Feedback/Learn/Improve three stages
- [ ] Observe and Release marked as external stages, not entering Harness loop

---

## 17. Concurrency and Timing Testing Standards

### 17.1 Modules That Must Do Concurrency Testing

| Module                                           | Concurrency Risk                      | Test Type                |
| ----------------------------------------------- | ------------------------------------- | ----------------------- |
| `execution-lease-service`                        | Competing for lease                   | Race Test + Idempotency |
| `execution-dispatch-service`                    | Concurrent dispatch of same ticket    | Race Test               |
| `execution-worker-handshake-service`            | Concurrent claim of same execution   | Race Test               |
| `distributed-lock-adapter` (SQLite/Redis/PG)    | Competing for lock                   | Critical Section Test   |
| `durable-event-bus`                              | Concurrent publish + deliverPending  | Race Test               |
| `approval-service`                               | Concurrent approval of same request   | Idempotency Test        |
| `sqlite-queue-adapter` / `redis-queue-adapter`   | Concurrent enqueue + dequeue          | Race Test + Idempotency |
| `circuit-breaker`                                | Concurrent requests trigger state transition | Race Test       |
| `transition-service`                             | Concurrent state transitions (CAS)     | Race Test               |
| `channel-gateway-retry-executor`                 | Overlapping polling passes            | Non-overlap Test        |

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
    { concurrency: 10 },
  );

  const granted = result.values.filter((r) => r.decision === "granted");
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
  // 2. Wait for expiry
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
  assert.notEqual(execution.status, "executing"); // Should not be in intermediate state
});
```

### 17.3 Concurrency Test Quantification Standards

| Module Category | Minimum Concurrency | Must Cover                        |
| --------------- | ------------------- | --------------------------------- |
| Lock/lease      | 10 workers          | acquire/release/extend/steal     |
| Queue           | 20 workers          | enqueue/dequeue/ack/dead-letter  |
| State transition| 5 workers           | CAS competition + terminal idempotent |
| Event delivery  | 10 workers          | publish + consumer ack           |
| Dispatch        | 5 workers           | ticket claim + handshake         |

### 17.4 Stale Write Prevention Test

`ExecutionLeaseService.validateWriteAccess()` is the last defense against dirty writes, must cover all 5 rejection reasons:

- [ ] `lease_not_found` — execution has no lease record
- [ ] `no_active_lease` — lease has expired/released
- [ ] `stale_fencing_token` — fencing token doesn't match (old worker write)
- [ ] `worker_mismatch` — requesting worker is not lease holder
- [ ] `lease_mismatch` — lease ID doesn't match

### 17.5 Time Control Strategy

The most common root cause of flakiness in concurrency and timing tests is dependence on real time. This section specifies a unified time control layered strategy.

#### A. Three-Layer Time Control

| Layer              | Applicable Scenario                                | Strategy                                                                       | Example                                                  |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| L1 — Controllable Clock | Logic involving timeout, TTL, interval in Unit tests | Inject `Clock` interface, test passes `FakeClock`, manually advance time      | lease expiry, circuit breaker resetTimeout, retry delay |
| L2 — Bounded Real Time | Integration tests needing real async/timer interaction | Allow `setTimeout` / `setInterval`, but single sleep ≤ 500ms, total sleep per test ≤ 2s | Queue delivery then wait for consumer consumption        |
| L3 — Forbidden Unbounded Wait | All tests                                | Forbidden `while(true) await sleep()`, forbidden `waitForEvent()` without timeout | —                                                     |

#### B. Hard Rules

1. **Unit tests forbid direct `setTimeout` / `Date.now()` calls** — must go through injected Clock interface
2. **All `await sleep()` calls must have `{ timeout }` parameter upper bound** — must self-terminate before CI timeout
3. **Integration test total sleep budget**: single test case ≤ 2s, single test file ≤ 10s
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

- Lint rule (or grep CI step) detects exposed `Date.now()`, `new Date()`, `setTimeout` calls in unit test directory, marked as warning
- `--test-timeout=30000` as global fallback, test cases exceeding 30s automatically fail

---

## 18. Design Specification to Test Traceability Standards

### 18.1 Goal

Establish **bidirectional traceability** between design documents and test cases, so that:

- Every P0/P1 design specification has corresponding tests
- Every test can be traced back to design requirements

### 18.2 Spec ID Encoding Rules

This project uses **4 prefixes** to distinguish different sources of traceable specifications:

| Prefix        | Meaning          | Source                                      |
| ------------- | ---------------- | ------------------------------------------- |
| `SPEC-`       | Design specification | `opeli_detailed_design.md` and other design documents |
| `ADR-`        | Architecture Decision Record  | ADR documents under `doc/adr/`            |
| `CONTRACT-`   | Interface/behavior contract | contract documents under `doc/contracts/` |
| `INC-`        | Online incident      | Incident review records, trigger regression tests |

#### Encoding Format

```
{prefix}{module}-{subsystem}-{sequence}

SPEC Example:
SPEC-OAPEFLIR-EXEC-001     # OAPEFLIR Execute stage spec #1
SPEC-ROLLOUT-STATE-003      # Rollout state machine spec #3
SPEC-PLUGIN-SANDBOX-002     # Plugin sandbox spec #2
SPEC-EVENT-TIER1-DLQ-001    # Tier 1 event DLQ spec #1
SPEC-LEASE-FENCING-001      # Lease fencing token spec #1

ADR Example:
ADR-LOCK-BACKEND-001        # Distributed lock selection ADR #1
ADR-EVENT-DURABILITY-002    # Event durability strategy ADR #2

CONTRACT Example:
CONTRACT-SANDBOX-FS-001     # Sandbox filesystem contract #1
CONTRACT-API-GATEWAY-003    # API Gateway interface contract #3

INC Example:
INC-20250312-LEASE-STALE-001  # 2025-03-12 lease stale write incident #1
INC-20250401-DLQ-OVERFLOW-001 # 2025-04-01 DLQ overflow incident #1
```

### 18.3 Referencing Spec ID in Tests

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

Or maintain mapping table at test file header:

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

(See §7.3 Traceability Matrix)

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
4. **Gap handling** → Uncovered Spec IDs enter test debt list (§20)

Traceability script example (covers all 4 prefixes):

```bash
ID_PATTERN='(SPEC|ADR|CONTRACT|INC)-[\w-]+'

# Extract defined IDs from all source documents
grep -oP "$ID_PATTERN" doc/reviews/opeli_detailed_design.md \
                        doc/adr/*.md \
                        doc/contracts/*.md \
                        > /tmp/spec-ids.txt

# Extract referenced IDs from test files
grep -oP "$ID_PATTERN" tests/**/*.test.ts > /tmp/test-refs.txt

# Compare and output gaps
comm -23 /tmp/spec-ids.txt /tmp/test-refs.txt | sort -u
```

---

## 19. Real Execution vs Mock Execution Boundary Standards

### 19.1 Background

The most common test trap in Agent systems: **test coverage is high, but core execution is entirely mocked**. The Execute stage in this project is currently completely mocked.

We must clearly define which test layers allow mocking and which must use real execution.

### 19.2 Mock Permission Matrix

| Component                    | Unit Test             | Integration Test         | E2E Test                      |
| ----------------------------- | --------------------- | ------------------------ | ----------------------------- |
| **LLM Provider**              | Mock allowed         | Mock allowed             | Mock allowed (provider not under our control) |
| **Tool Execution Bridge**    | Mock allowed         | Real required            | Real required                 |
| **Sandbox / Security Policy**| Mock allowed         | Real required            | Real required                 |
| **Database (SQLite)**        | Mock prohibited       | Real in-memory           | Real required                 |
| **Database (PostgreSQL)**    | Mock (SQLite in unit) | Real PG required         | Real PG required              |
| **File System**               | Mock or temp dir      | Must use temp dir        | Real required                 |
| **Child Process (spawn)**     | Mock allowed          | Real required            | Real required                 |
| **Event Bus**                 | Mock allowed          | Real DurableEventBus     | Real required                 |
| **Distributed Lock**         | Mock allowed          | Real SQLite/Redis adapter| Real required                 |
| **Network HTTP**              | Mock allowed          | Mock (external API)      | Mock allowed                  |
| **OAPEFLIR Stage Output**     | Mock (isolate single stage) | Real chaining between stages | Full pipeline        |

### 19.3 Mock Layer Prohibitions

The following combinations are **strictly prohibited**:

| Prohibition                                      | Reason                                                         |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Mock DB in integration test                      | Cannot verify SQL correctness, transaction isolation, migration compatibility |
| Mock sandbox in integration test                 | Cannot verify path traversal/command injection prevention     |
| Mock tool bridge in E2E test                     | Cannot verify real tool chain behavior                        |
| Mock `StateTransitionMachine.assertTransition` at any layer | Cannot verify state machine constraints |
| Mock `validateWriteAccess` at any layer          | Cannot verify fencing token protection                         |

### 19.4 Provider Mock Standards

LLM Provider is the only component allowed to be mocked at all layers (because real calls are non-deterministic, expensive, and slow).

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
- Adding `Math.random()` or `Date.now()` in mock is prohibited

---

## 20. Test Debt Classification

### 20.1 Classification Definitions

| Level    | Definition                                       | Fix Deadline   | Example                                              |
| -------- | ------------------------------------------------ | -------------- | ---------------------------------------------------- |
| **TD-P0**| No test for security boundary / state machine / execution main chain | Current Sprint | New sandbox attack vector has no denial-path test |
| **TD-P1**| Core orchestrator low branch/mutation coverage   | Next Sprint    | `OapeflirLoopService` has no unit test              |
| **TD-P2**| Auxiliary service branch < 60% or mutation < 50% | Within 2 Sprints | `improvement` branches 52.4%                      |
| **TD-P3**| Tool class / helper function missing boundary cases | Backlog        | Pure function missing null value test                |
| **TD-P4**| Golden / performance test documentation enhancement | Backlog        | New CLI command has no golden snapshot               |

### 20.2 Debt Registration Format

```
TD-{level}-{sequence}: {description}
  Module: {src/platform/xxx}
  Current coverage: {lines}% / {branches}% / mutation {x}%
  Target coverage: {lines}% / {branches}%
  Related Spec: {SPEC-xxx} (if applicable)
  Owner: {owner}
  Due date: {date}
```

### 20.3 Debt Entry and Exit Conditions

**Entry conditions**:

- §7 Traceability Matrix script finds uncovered source files
- Coverage gate directory below safety threshold (§23)
- Stryker report survived mutants rate > 50%
- PR Review finds missing test scenarios
- Incident replay has no corresponding regression test

**Exit conditions**:

- Corresponding test has been written and merged to main
- Coverage baseline has been updated
- Mutation score improved to ≥ low threshold

### 20.4 Sprint Test Debt Auto-Report

At the end of each Sprint, automatically generate a test debt report as a required input for Sprint Review.

#### A. Report Content

| Section              | Data Source               | Description                                      |
| -------------------- | ------------------------- | ------------------------------------------------ |
| New TD               | TD entries created this Sprint | By priority distribution                        |
| Closed TD           | TD entries closed this Sprint | By close reason (fix / cancel / downgrade)      |
| Threshold violations | §23 Coverage quality threshold check | List directories below safety threshold and gaps |
| Uncovered Spec ID    | §18.5 Traceability script output | By prefix (SPEC / ADR / CONTRACT / INC)        |
| Top-N Survived Mutants | Stryker report            | Top 10 files with most survived mutants          |
| Unreplayed incidents | §21 Failure case replay list   | Incidents recorded but without regression tests |

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
# Find incidents in incidents directory without corresponding INC- prefixed tests
comm -23 \
  <(grep -oP 'INC-[\w-]+' doc/incidents/*.md 2>/dev/null | sort -u) \
  <(grep -roPh 'INC-[\w-]+' tests/ | sort -u)
```

#### C. CI Integration

- Report script runs on each `main` branch merge, output archived to `data/sprint-reports/` directory
- If threshold violation count > previous report, CI issues warning (non-blocking)
- Sprint Review agenda must include interpretation of this report

---

## 21. Failure Case Replay Rules

### 21.1 Core Principle

> **Every production incident, rollback, security escape, and high-priority user correction must be replayed into at least one regression test.**

### 21.2 Replay Trigger Conditions

| Trigger Event                  | Required Replay Test Types                            |
| ------------------------------ | ----------------------------------------------------- |
| Production incident (P0/P1)    | Integration regression + root cause unit test         |
| Rollback (Rollout revert)      | State machine transition test + condition gate test   |
| Security escape (sandbox bypass) | Denial-path regression (§8)                         |
| User correction (manual fix)   | Unit test covering the corrected logic branch         |
| Data inconsistency fix         | Concurrency/transaction isolation test (§17)          |
| Dead letter backlog            | Event lifecycle test (§15)                            |

### 21.3 Replay Process

```
Incident occurs → Root cause analysis → Fix code
                              ↓
                  Write regression test (test title contains incident ID)
                              ↓
                  Verify: delete fix code → regression test fails (confirm test is effective)
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

1. Comment out fix code
2. Run replay test → must fail
3. Restore fix code
4. Run replay test → must pass

If step 2 test still passes, the test does not effectively cover the root cause and needs rewrite.

---

## 22. Test Data Governance

### 22.1 Fixture Minimization Principle

Fixtures only include fields **required** by the test scenario; use factory defaults for everything else:

```typescript
// Good — only specify fields that the test cares about
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

| Non-deterministic Source      | Alternative                                                    |
| ----------------------------- | -------------------------------------------------------------- |
| `Date.now()` / `new Date()`   | Use fixed timestamp or `withEnv({ AA_FIXED_TIME: "..." })`   |
| `Math.random()`              | Use fixed seed or hardcoded value                              |
| `crypto.randomUUID()`         | Use fixed ID (e.g., `"task-test-001"`)                        |
| Network requests              | Mock provider                                                  |
| File system timestamps        | Normalize in golden tests                                      |
| PID in subprocess output      | Strip before assertion                                          |

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

### 22.4 Scenario Fixture and Domain Fixture Separation

| Type              | File                                  | Purpose                                                     |
| ----------------- | ------------------------------------- | ----------------------------------------------------------- |
| **Domain Fixture** | `tests/helpers/fixtures/base.ts`      | Minimal valid domain records (Task, Execution, Approval)   |
| **Scenario Fixture** | `tests/helpers/fixtures/composite.ts` | Multi-entity association scenarios (BlockedTask, CompletedTask, FailedTask) |
| **Seed Fixture**   | `tests/helpers/api.ts`                | Complete API environment seed                               |

When adding new fixtures:

- Single entity → add to `base.ts`
- Multi-entity association → add to `composite.ts`
- Test-specific → inline in test file (do not extract)

### 22.5 Test Isolation

- Each test independently creates temp workspace, `try/finally` cleanup
- No sharing state between tests (global variables, singletons, static properties)
- Environment variables isolated via `withEnv()`
- Database isolated via independent DB files (do not share in-memory DB)

---

## 23. Coverage Quality Thresholds

### 23.1 Problem

Global 82.4% line coverage may mask low coverage in critical modules. Need to define **hard minimum thresholds** for different modules.

### 23.2 Tiered Thresholds (v3.0 Updated Directory Mapping)

| Level       | Applicable Modules                                                               | Lines Threshold | Branches Threshold | Mutation Threshold |
| ----------- | -------------------------------------------------------------------------------- | -------------- | ------------------ | ----------------- |
| **Critical** | compliance, distributed-lock, state-transition, execution-lease, control-plane/iam | ≥ 90%          | ≥ 80%              | ≥ 70%             |
| **High**    | orchestration/oapeflir, state-evidence/memory, knowledge, events, execution-engine | ≥ 85%          | ≥ 75%              | ≥ 60%             |
| **Standard**| orchestration/oapeflir/learn, planning, improvement, artifacts, prompt-engine      | ≥ 80%          | ≥ 70%              | ≥ 50%             |
| **Baseline**| plugins, sdk/cli, model-gateway, tool-executor, domains                            | ≥ 75%          | ≥ 60%              | ≥ 50%             |

### 23.3 Current Gaps (v4.0 c8 Measured Data)

> **Important**: c8 full analysis (`all: true`) shows all module coverage at **0%**, with the only exception being 6 files (100%) under `state-evidence/truth/sqlite/`. Therefore, all Critical and High modules below are **not meeting standards**.

| Module                                    | Level     | Current Lines | Threshold | Current Branches | Threshold | Status                 |
| ----------------------------------------- | --------- | ------------- | --------- | ---------------- | --------- | ---------------------- |
| `platform/five-plane-execution/distributed-lock`   | Critical | 0%            | 90%       | 0%               | 80%       | Lines **gap 90%**      |
| `platform/five-plane-execution/state-transition`   | Critical | 0%            | 90%       | 0%               | 80%       | Lines **gap 90%**      |
| `platform/five-plane-control-plane/iam`            | Critical | 0%            | 90%       | 0%               | 80%       | Lines **gap 90%**      |
| `platform/compliance`                   | Critical | 0%            | 90%       | 0%               | 80%       | Lines **gap 90%**      |
| `platform/five-plane-orchestration/oapeflir`       | High     | 0%            | 85%       | 0%               | 75%       | Lines **gap 85%**      |
| `platform/five-plane-state-evidence/memory`        | High     | 0%            | 85%       | 0%               | 75%       | Lines **gap 85%**      |
| `platform/five-plane-state-evidence/events`        | High     | 0%            | 85%       | 0%               | 75%       | Lines **gap 85%**      |
| `platform/five-plane-execution/execution-engine`   | High     | 0%            | 85%       | 0%               | 75%       | Lines **gap 85%**      |
| `platform/five-plane-state-evidence/knowledge`     | High     | 0%            | 85%       | 0%               | 75%       | Lines **gap 85%**      |
| `platform/five-plane-orchestration/oapeflir/learn` | Standard | 0%            | 80%       | 0%               | 70%       | Lines **gap 80%**      |
| `platform/five-plane-state-evidence/artifacts`     | Standard | 0%            | 80%       | 0%               | 70%       | Lines **gap 80%**      |
| `platform/prompt-engine`                | Standard | 0%            | 80%       | 0%               | 70%       | Lines **gap 80%**      |
| `plugins`                               | Baseline | 0%            | 75%       | 0%               | 60%       | Lines **gap 75%**      |
| `sdk/cli`                               | Baseline | 0%            | 75%       | 0%               | 60%       | Lines **gap 75%**      |
| `platform/model-gateway`                | Baseline | 0%            | 75%       | 0%               | 60%       | Lines **gap 75%**      |
| `domains`                               | Baseline | 0%            | 75%       | 0%               | 60%       | Lines **gap 75%**      |

> **v4.0 Major Change**: c8 full analysis shows all modules at 0% coverage (except 6 files under state-evidence/truth/sqlite/). v3.0's claimed high coverage data was verified inaccurate. **Root cause analysis**: Test code exists (1,803 .test.ts files, 52,480 assertions), but c8 coverage collection may not correctly associate with all compiled `dist/src/` files, or `build:test` compilation process did not include all source files in c8's instrumentation scope. Need to investigate c8 configuration and build chain integration.

### 23.4 Threshold Enforcement Method

Write thresholds into `.coverage-baseline.json` directory-level minimums, enforced by `check-coverage-baseline.mjs`.

Current baseline only records "observed values", suggested extension:

```json
{
  "src/platform/security": {
    "fileCount": 19,
    "metrics": { "lines": 91.9, ... },
    "minimums": { "lines": 90, "branches": 80 }
  }
}
```

### 23.5 State Machine / Security Special Thresholds

In addition to coverage, the following modules have special thresholds:

| Special Item                  | Threshold                     | Measurement Method                              |
| ----------------------------- | ----------------------------- | ----------------------------------------------- |
| State machine legal transition coverage | 100%                 | Legal edges / total legal edges                 |
| State machine illegal transition coverage | Terminal × all non-self states 100% | Rejection tests / should reject count |
| Security denial-path          | Each attack surface ≥ 3       | Denial test count / attack surface count        |
| Tier 1 event lifecycle       | 9 event types × 8 stages 100% | Tested stages / 72                              |
| Fencing token rejection       | 5 reasons 100%                | Rejection test count / 5                        |

---

---

# Part III — Architecture Gap Regression Test Matrix (v4.0 Rewrite, aligned with Architecture Review v8.0)

> Part I solves "code coverage governance", Part II solves "architecture semantic coverage".
> Part III solves "**architecture design vs implementation gap regression protection**" — Based on 13 architecture gaps found in Architecture Review v8.0 (`docs_zh/reviews/architecture-design-vs-implementation-review.md`), defining corresponding test specifications to ensure each gap has complete test coverage after implementation.
>
> **v4.0 Change**: Complete rewrite. v3.0 was based on Architecture Review v6.0's 29 gaps (GAP-* numbering). This version is based on Architecture Review v8.0's full gap review of the entire codebase (1,387 files / 265,020 lines) vs design documents v3.2 (§1-§94), covering **3 P0 architecture violations + 7 P1 implementation deficiencies + 3 P2 detail completions**. Harness-related gaps (GAP-VI-*) from v3.0 have been partially implemented in code (29 files 1,471 lines), this version focuses on security/classification/authorization framework level design-implementation gaps.

---

## 24. Architecture Review-Driven Regression Testing

### 24.1 Background

Architecture Review v8.0 conducted a full review of 1,387 source files / 265,020 lines of code, comparing against architecture design document v3.2 (~8,000 lines / 94 chapters), finding **13 architecture design vs implementation gaps**:

| Priority          | Count | Key Gaps                                                                              |
| ----------------- | ----- | ------------------------------------------------------------------------------------- |
| P0 Architecture Violations | 3     | E1-E6 anomaly classification missing, SEV1-4 unified severity missing, STRIDE threat model missing |
| P1 Clear Requirements Implementation Insufficient | 7     | Principal type, Sandbox level, Cursor pagination, HITL mode, RBAC three-layer authorization, vertical domain, multimodal |
| P2 Detail Completion | 3     | Webhook-Outbox coupling, logical table reconciliation, metamodel 12 questions          |

### 24.2 Gap ID to Test Traceability

Test titles use `[ARCH-P{level}-{sequence}]` prefix, one-to-one correspondence with Architecture Review v8.0 gap numbers:

```
Architecture Review v8.0: P0-1 §12.1 Anomaly event classification system E1-E6 completely missing
    ↓
Test title: [ARCH-P0-1] AnomalyEventClass enum defines all 6 categories E1-E6
    ↓
File location: tests/unit/platform/contracts/anomaly-event-classification.test.ts
```

| Prefix       | Meaning                         | Gap Count |
| ------------ | ------------------------------- | ---------- |
| `ARCH-P0-`   | Architecture violation (completely missing) | 3    |
| `ARCH-P1-`   | Clear requirement but insufficient implementation | 7   |
| `ARCH-P2-`   | Detail completion                | 3         |

### 24.3 Priority Execution Plan

| Priority | Fix Deadline | Gap IDs                                                                                                    |
| -------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| **P0**   | 1-2 weeks    | P0-1 (E1-E6 classification), P0-2 (SEV1-4 unified severity), P0-3 (STRIDE)                                |
| **P1**   | 2-4 weeks    | P1-1 (Principal), P1-2 (Sandbox), P1-3 (pagination), P1-4 (HITL), P1-5 (RBAC), P1-6 (vertical domain), P1-7 (multimodal) |
| **P2**   | Ongoing      | P2-1 (Webhook-Outbox), P2-2 (logical table), P2-3 (metamodel 12 questions)                                 |

---

## 25. P0 Architecture Violation Gap Test Specifications

### 25.1 [ARCH-P0-1] §12.1 Anomaly Event Classification System E1-E6 Completely Missing

**Gap**: Design defines 6 anomaly event classifications (E1 business/E2 execution/E3 external dependency/E4 security/E5 data/E6 governance), code uses `AnomalyCategory` (spike/trend_change/level_shift) in `AnomalyDetectionService`, completely different from design classification system.

**Test Type**: Unit

**Test Target**: Anomaly event classification enum must include all 6 E1-E6 categories, classification mapping logic must be correct.

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
});

test("[ARCH-P0-1] statistical detection maps to business classification", () => {
  const spikeOnSla = { category: "spike", source: "slo-alerting" };
  assert.equal(mapToEventClass(spikeOnSla), AnomalyEventClass.E1_BUSINESS);

  const trendOnSecurity = { category: "trend_change", source: "iam-audit" };
  assert.equal(mapToEventClass(trendOnSecurity), AnomalyEventClass.E4_SECURITY);
});

**Test Scenario Checklist**:

| Scenario                            | Assertion                                                    |
| ----------------------------------- | ------------------------------------------------------------ |
| Each E1-E6 classification enum exists | Enum length = 6, includes all values                       |
| Schema validates valid event         | `doesNotThrow`                                              |
| Schema rejects event missing class  | `throws`                                                     |
| Statistical detection → E1-E6 mapping covers all | Each source_plane maps to at least one E class |
| Event publish carries class field   | outbox/event message contains `AnomalyEventClass`           |

### 25.2 [ARCH-P0-2] §12.2 Unified Severity Levels SEV1-SEV4 Missing

**Gap**: Code has 3 incompatible severity systems: Incident uses P0-P3, Anomaly uses warning/critical/emergency, SLO uses AlertSeverity. Design requires unified SEV1-SEV4.

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

**Gap**: Design requires STRIDE six-dimension threat assessment + supplementary threat matrix, code has no STRIDE implementation.

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

### 26.2 [ARCH-P1-2] Sandbox Level Incomplete (3/4 Tiers)

**Gap**: Architecture §11.4 defines 4 Sandbox tiers (none / process / container / vm), code only implements first 3 tiers.

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

**Gap**: Architecture §6.6 requires all list APIs to use cursor-based pagination. Current some endpoints use offset-based or no pagination.

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

### 26.4 [ARCH-P1-4] HITL Mode Implementation Incomplete

**Gap**: Architecture §9.3 defines human-in-the-loop modes (approve/reject/edit/comment), code only implements approve/reject.

**Test Type**: Unit

```typescript
test("[ARCH-P1-4] HitlMode enum defines all 4 modes", () => {
  const required = ["approve", "reject", "edit", "comment"];
  for (const mode of required) {
    assert.ok(
      HitlMode[mode] !== undefined,
      `HitlMode must include "${mode}"`,
    );
  }
});

test("[ARCH-P1-4] HitlService handles edit mode", async () => {
  const task = await createTask({ status: "pending_approval" });
  const editPayload = {
    modifications: [{ field: "priority", value: "high" }],
    comment: "Adjusting priority based on new information",
  };

  const result = await HitlService.process({
    taskId: task.id,
    mode: HitlMode.edit,
    payload: editPayload,
  });

  assert.equal(result.status, "modified");
  assert.ok(result.task.priority === "high");
});
```

### 26.5 [ARCH-P1-5] RBAC Three-Layer Authorization Incomplete

**Gap**: Architecture §11.2 defines three-layer RBAC (resource / operation / scope), code only implements resource + operation layers.

**Test Type**: Integration

```typescript
test("[ARCH-P1-5] Permission check evaluates all three layers", async () => {
  const permission = {
    resource: "task",
    operation: "delete",
    scope: { division: "ops", owner: "user-123" },
  };

  const result = await RBACService.check(permission, authContext);
  assert.equal(result.decision, "allow");
});

test("[ARCH-P1-5] scope layer rejects out-of-division resource", async () => {
  const permission = {
    resource: "task",
    operation: "delete",
    scope: { division: "hr" }, // authContext has ops division
  };

  const result = await RBACService.check(permission, authContext);
  assert.equal(result.decision, "deny");
  assert.equal(result.reason, "scope_violation");
});
```

### 26.6 [ARCH-P1-6] Vertical Domain Division Not Implemented

**Gap**: Architecture §4.3 defines vertical domain divisions (GeneralOps / Security / Compliance / etc.), code uses flat organization only.

**Test Type**: Unit

```typescript
test("[ARCH-P1-6] Domain enum defines vertical divisions", () => {
  const required = [
    "general_ops",
    "security",
    "compliance",
    "development",
    "infrastructure",
  ];
  for (const domain of required) {
    assert.ok(
      Domain[domain] !== undefined,
      `Domain must include "${domain}"`,
    );
  }
});

test("[ARCH-P1-6] Task routing respects domain boundaries", async () => {
  const task = createTask({ domain: "security" });
  const routing = await DomainRoutingService.route(task);

  assert.ok(routing.targetPlane, "security");
  assert.equal(routing.domainsAllowed, "security");
});

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

### 26.7 [ARCH-P1-7] Multimodal Input Handling Not Implemented

**Gap**: Architecture §68 defines multimodal processing capabilities (text / image / audio / video). Video processing only has skeleton stub, no actual implementation.

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

### 27.1 [ARCH-P2-1] Webhook-Outbox Coupling Issue

**Gap**: Architecture §6.7 requires event notifications to use Transactional Outbox pattern for at-least-once delivery. Current webhook is synchronous direct send, no outbox table, no retry tracking.

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

### 27.2 [ARCH-P2-2] Logical Table Count Mismatch

**Gap**: Architecture §26.3 defines logical table collection, there is a count mismatch with actual schema definitions in code. Need to verify all architecture-required tables have corresponding definitions in code.

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

### 27.3 [ARCH-P2-3] Unified Domain Metamodel 12 Questions Coverage

**Gap**: Architecture §37.11 defines 12 required questions for unified domain metamodel (domain boundary, core entities, workflows, tool bundles, risk policies, eval metrics, budget constraints, security levels, latency requirements, data sensitivity, compliance requirements, SLA targets). Need to verify each domain's metamodel answer coverage.

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

# Part IV — System Engineering Defect Regression Tests (v2.0 original Part III retained, v3.0 updated numbering)

> Part III solves "architecture design-implementation gaps".
> Part IV solves "**system engineering defect regression protection**" — Based on engineering defects found in Architecture Review v4.1 (Redis error handling, concurrency races, silent task loss, etc.), defining corresponding regression test specifications.
>
> **v3.0 Change**: Migrated from v2.0 Part III (§24-§30) to Part IV (§29-§34), numbering updated, content retained. SYS-* defect numbering unchanged.

---

## 29. P0 Blocking Engineering Defect Test Specifications

> Corresponds to v2.0 §25.

### 29.1 [SYS-REL-2.1] Redis Error Handler Silently Swallows Errors

**Defect**: `distributed-lock/redis-lock-adapter.ts`, `queue/redis-queue-adapter.ts`, `ingress/redis-rate-limiter.ts`, `cache/stores/redis-cache-store.ts` all have `this.redis.on("error", () => {})` that silently swallow all Redis errors.

**Test Type**: Unit + Integration

**Test Target**: Redis connection errors must (1) log to StructuredLogger, (2) update health status flag, (3) increment Prometheus counter.

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

**Covered Files** (one test set per file):

| File                                               | Test File                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `execution/distributed-lock/redis-lock-adapter.ts` | `tests/unit/platform/five-plane-execution/redis-lock-error.test.ts`          |
| `execution/queue/redis-queue-adapter.ts`           | `tests/unit/platform/five-plane-execution/redis-queue-error.test.ts`         |
| `interface/ingress/redis-rate-limiter.ts`          | `tests/unit/platform/five-plane-interface/redis-rate-limiter-error.test.ts` |
| `shared/cache/stores/redis-cache-store.ts`         | `tests/unit/platform/shared/redis-cache-error.test.ts`                       |

### 29.2 [SYS-REL-2.3] DLQ Pure Memory, Lost After Restart

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

**Defect**: CMD on line 46 of `Dockerfile` references a path that does not exist.

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

## 30. P1 Critical Defect Test Specifications

### 30.1 [SYS-REL-2.2] Redis Lock TOCTOU Race Condition

**Defect**: `distributed-lock/redis-lock-adapter.ts` `extendAsync()` uses non-atomic GET+SET, `forceStealAsync()` uses non-atomic DEL+SET. In concurrent scenarios, two processes can hold the same lock simultaneously.

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

**Defect**: `execution/state-transition/transition-service.ts` has CAS for task transitions but workflow transitions have no CAS protection.

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

**Defect**: Alert delivery failures at lines 172/227/281/339 in `shared/observability/slo-alerting-service.ts` use `.catch(() => {})`.

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

**Defect**: `shared/outbox/outbox-service.ts` implementation exists, but `transition-service.ts` task state transition writes directly to events table without going through Outbox.

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

**Defect**: `state-evidence/truth/session-dual-storage.ts` crashes between two `appendFileSync` calls causing inconsistency.

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

**Defect**: `shared/observability/structured-logger.ts:295` each log call blocks event loop with `appendFileSync`.

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

## 31. P2 Important Defect Test Specifications

### 31.1 [SYS-ARCH-1.1] Five-Plane Cross-Plane Import Guard

**Defect**: 394 cross-plane imports violate five-plane architecture (e.g., state-evidence imports execution).

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

| Source Plane   | Prohibited Import Targets                        |
| -------------- | ------------------------------------------------ |
| state-evidence | execution, control-plane                        |
| control-plane  | state-evidence (direct), execution (direct)      |
| interface      | Only allowed to import shared/, contracts/       |
| orchestration  | execution (direct, skip shared adapter)        |

### 31.2 [SYS-OBS-5.1] Critical Path console.* Ban

**Defect**: 37 critical path uses of `console.*` bypass StructuredLogger.

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

**Defect**: Only 3 Prometheus alert rules, missing DB, Redis, event loop, queue and other critical alerts.

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
  for (const question of metamodelQuestions) {
    assert.ok(
      doc.answers[question],
      `Domain model must answer: "${question}"`,
    );
  }
});
```

---

## 28. Gap Test Execution Summary

### 28.1 Gap Status Tracking

| Gap ID       | Priority | Status        | Test File                                        | Test Count |
| ------------ | -------- | ------------- | ------------------------------------------------ | ---------- |
| ARCH-P0-1    | P0       | Not started   | tests/unit/platform/contracts/anomaly-event-classification.test.ts | 4          |
| ARCH-P0-2    | P0       | Not started   | tests/unit/platform/contracts/unified-severity.test.ts | 4          |
| ARCH-P0-3    | P0       | Not started   | tests/unit/platform/security/stride-threat-model.test.ts | 3          |
| ARCH-P1-1    | P1       | Not started   | tests/unit/platform/auth/principal-types.test.ts | 2          |
| ARCH-P1-2    | P1       | Not started   | tests/unit/platform/security/sandbox-levels.test.ts | 2          |
| ARCH-P1-3    | P1       | Not started   | tests/integration/api/pagination.test.ts | 2          |
| ARCH-P1-4    | P1       | Not started   | tests/unit/platform/control-plane/hitl-modes.test.ts | 2          |
| ARCH-P1-5    | P1       | Not started   | tests/integration/auth/rbac-three-layer.test.ts | 2          |
| ARCH-P1-6    | P1       | Not started   | tests/unit/platform/domains/vertical-divisions.test.ts | 2          |
| ARCH-P1-7    | P1       | Not started   | tests/unit/platform/contracts/multimodal-input.test.ts | 2          |
| ARCH-P2-1    | P2       | Not started   | tests/unit/platform/events/webhook-outbox.test.ts | 2          |
| ARCH-P2-2    | P2       | Not started   | tests/integration/data/reconciliation.test.ts | 2          |
| ARCH-P2-3    | P2       | Not started   | tests/unit/platform/domains/metamodel-documentation.test.ts | 1          |

### 28.2 Test Execution Order

**Phase 1 (Week 1-2)**: P0 Gaps
- ARCH-P0-1 → ARCH-P0-2 → ARCH-P0-3

**Phase 2 (Week 3-4)**: P1 Gaps
- ARCH-P1-1 through ARCH-P1-7 (parallel workstreams)

**Phase 3 (Week 5+)**: P2 Gaps
- ARCH-P2-1 → ARCH-P2-2 → ARCH-P2-3

### 28.3 Verification Criteria

Each gap test must satisfy:
1. **Coverage**: All test scenarios in gap specification are implemented
2. **Isolation**: Each gap test can run independently
3. **Determinism**: All tests produce deterministic results (no flaky tests)
4. **Traceability**: Each test title references gap ID (e.g., `[ARCH-P0-1]`)

---

# Part IV — Quality Assurance Glossary

## Glossary A: Coverage Terminology

| Term                    | Definition                                                       |
| ----------------------- | ---------------------------------------------------------------- |
| **Line Coverage**       | Percentage of code lines executed by tests                       |
| **Branch Coverage**     | Percentage of code branches (if/else, switch) executed           |
| **Mutation Coverage**   | Percentage of mutants killed by tests                            |
| **Path Coverage**       | Coverage of all possible execution paths                        |
| **Transition Coverage** | State machine transition coverage (legal + illegal)             |
| **Critical Path**      | Main execution chain (Happy Path) without which system cannot function |

## Glossary B: Testing Methodology

| Term             | Definition                                                    |
| ---------------- | ------------------------------------------------------------- |
| **Unit Test**    | Test single function/class/module in isolation                |
| **Integration Test** | Test multiple components interacting                         |
| **E2E Test**     | Test complete user workflow from start to finish               |
| **Golden Test**  | Snapshot testing against known good outputs                   |
| **Mutation Test**| Testing by introducing artificial bugs (mutants)              |
| **Fuzz Test**    | Random input testing to find edge case failures               |
| **Contract Test**| Testing API contract compliance between services              |

## Glossary C: Quality Metrics

| Metric                  | Good    | Warning | Critical |
| ----------------------- | ------- | ------- | -------- |
| Line Coverage           | ≥ 85%   | 70-84%  | < 70%    |
| Branch Coverage         | ≥ 75%   | 60-74%  | < 60%    |
| Mutation Score          | ≥ 70%   | 50-69%  | < 50%    |
| Test Flakiness Rate     | < 1%    | 1-5%    | > 5%     |
| Test Execution Time     | < 5min  | 5-15min | > 15min  |

---

# Appendix A: Quick Reference Tables

## A.1 OAPEFLIR Stage Summary

| Stage    | Purpose                        | Key Artifacts                        |
| -------- | ------------------------------ | ------------------------------------ |
| Observe  | Collect task context           | TaskSituation                        |
| Assess   | Evaluate task complexity       | UnifiedAssessment                    |
| Plan     | Generate execution plan        | Plan with Steps                      |
| Execute  | Run step-by-step               | DualChannelStepOutput                |
| Feedback | Collect execution results      | FeedbackSignal[]                     |
| Learn    | Extract patterns              | LearningSignal                       |
| Improve  | Generate improvements          | ImprovementCandidate                  |
| Rollout  | Deploy improvements            | RolloutPlan                          |

## A.2 State Machine States (Execution)

| State         | Meaning                                       |
| ------------- | -------------------------------------------- |
| `queued`      | Waiting to be scheduled                      |
| `running`     | Actively executing                           |
| `waiting`     | Waiting for human approval or downstream     |
| `completed`   | Successfully completed                       |
| `failed`      | Failed with permanent error                  |
| `cancelled`   | Cancelled by user                            |

## A.3 Event Tier Classification

| Tier   | Ack Required | Retry Policy    | Example Events                    |
| ------ | ------------ | --------------- | --------------------------------- |
| Tier 1 | Must         | 3 retries 100ms→5s | `task:status_changed`, `decision:requested` |
| Tier 2 | Recommended  | 2 retries       | `dispatch:*`, `worker:*`           |
| Tier 3 | None         | Best-effort     | `stream:chunk_emitted`, `perf:*`  |

---

# Appendix B: Test File Naming Conventions

```
tests/
├── unit/
│   ├── platform/
│   │   ├── contracts/
│   │   │   ├── [feature].test.ts
│   │   │   └── event-[type].test.ts
│   │   ├── control-plane/
│   │   │   ├── iam/
│   │   │   └── approval-center/
│   │   └── execution/
│   │       ├── state-transition/
│   │       └── distributed-lock/
│   └── domains/
│       └── [domain-name]/
├── integration/
│   ├── api/
│   │   └── [endpoint].test.ts
│   └── security/
│       └── [scenario].test.ts
└── e2e/
    └── [workflow].test.ts
```

---

## 32. Architecture Invariant Automated Guardian Tests

> Corresponds to v2.0 §28.

### 32.1 Purpose

Transform structural issues found in architecture review into **continuously running automated guardian tests** to prevent architecture decay recurrence.

### 32.2 Guardian Test Checklist

| Guardian Item                     | Test File                                                         | Frequency |
| --------------------------------- | ----------------------------------------------------------------- | --------- |
| Five-plane import isolation        | `tests/unit/platform/contracts/plane-isolation.test.ts`         | Every CI  |
| console.* ban (non SDK/CLI)        | `tests/unit/platform/contracts/no-console-in-runtime.test.ts`   | Every CI  |
| `as any` count upper limit        | `tests/unit/platform/contracts/type-safety-bounds.test.ts`        | Every CI  |
| Redis KEYS command ban            | `tests/unit/platform/contracts/no-redis-keys.test.ts`            | Every CI  |
| Route no duplicate registration   | `tests/unit/platform/contracts/no-duplicate-routes.test.ts`      | Every CI  |
| Zod boundary validation coverage  | `tests/unit/platform/contracts/zod-boundary-validation.test.ts`   | Every CI  |
| Stub file count does not grow     | `tests/unit/platform/contracts/stub-count-ratchet.test.ts`        | Every CI  |
| Dockerfile CMD path valid          | `tests/integration/deploy/dockerfile-entrypoint.test.ts`          | Every CI  |

### 32.3 Zod Boundary Validation Coverage Guardian

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

`src/ops-maturity/` is a stub file heavy area, the following subdirectories have high stub rates:

| Subdirectory             | Total Files | Current Lines Coverage | Corresponding Architecture Section |
| ------------------------ | ----------- | ---------------------- | --------------------------------- |
| `platform-ops-agent/`     | 9           | 38.7%                  | §69 Platform Ops Agent            |
| `edge-runtime/`          | 5           | 96.6%                  | §63 Edge Inference                |
| `capacity-planner/`      | 5           | 94.0%                  | §68 Capacity Planning             |
| `compliance-reporter/`   | 3           | —                      | §67 Compliance Report             |
| `cost-optimizer/`        | 3           | —                      | §65 Cost Optimization             |
| `emergency/`             | 4           | 95.0%                  | §60 Emergency Brake               |
| `multimodal/`            | 7           | 97.1%                  | §68B Multimodal                   |
| `workflow-debugger/`     | 5           | 99.5%                  | §62 Workflow Debugger             |
| `explainability/`        | 2           | —                      | §59 Explainability                |

### 33.2 Stub File Exit Conditions

A stub file is considered "implemented" when:

| Condition      | Standard                                      |
| ------------- | --------------------------------------------- |
| Code lines    | ≥ 50 non-empty non-comment lines              |
| Class methods | ≥ 3 non-empty method bodies                   |
| Test coverage | Branch coverage ≥ 60%                         |
| Mutation score | Mutation score ≥ 50%                          |
| External callers | At least 1 non-test file imports it         |

---

## 34. Test Gap and Coverage Summary

> Corresponds to v2.0 §30, v4.0 comprehensively updated based on codebase measured data.

### 34.1 Source Area → Test File Count Comparison (v4.0 Measured)

| Source Directory    | Source Files | Unit Tests | Integration Tests | Total    | Ratio    |
| ------------------- | ------------ | ---------- | ----------------- | -------- | -------- |
| `src/platform/`     | 926          | 902        | 269               | 1,171    | 1.26     |
| `src/scale-ecosystem/` | 78        | 68         | 10                | 78       | 1.00     |
| `src/domains/`      | 55           | 55         | 17                | 72       | 1.31     |
| `src/ops-maturity/` | 97           | 103        | 17                | 120      | 1.24     |
| `src/interaction/`   | 44           | 47         | 3                 | 50       | 1.14     |
| `src/org-governance/` | 44         | 42         | 3                 | 45       | 1.02     |
| `src/sdk/`          | 96           | 65         | 39                | 104      | 1.08     |
| `src/plugins/`       | 25           | 27         | 0                 | 27       | 1.08     |
| `src/core/`         | 8            | 7          | 0                 | 7        | 0.88     |
| `src/apps/`         | 4            | 4          | 0                 | 4        | 1.00     |
| **Total**           | **1,387**    | **1,398**   | **358**           | **1,803** | **1.30** |

### 34.2 E2E Test File List (17 Files)

| File                               | Covered Scenario              |
| ---------------------------------- | ----------------------------- |
| `task-lifecycle.test.ts`           | Task full lifecycle           |
| `oapeflir-full-loop.test.ts`       | OAPEFLIR complete loop       |
| `multi-step-workflow.test.ts`      | Multi-step workflow           |
| `approval-event-flow.test.ts`      | Approval event flow           |
| `gateway-webhook-flow.test.ts`     | Gateway webhook flow          |
| `streaming-response.test.ts`       | Streaming response            |
| `session-memory-flow.test.ts`      | Session memory flow           |
| `operator-takeover.test.ts`        | Operator takeover             |
| `lease-recovery.test.ts`           | Lease recovery                |
| `error-propagation.test.ts`        | Error propagation             |
| `delegation-chain-flow.test.ts`    | Delegation chain flow         |
| `domain-onboarding-flow.test.ts`   | Domain onboarding flow        |
| `execution-flow.test.ts`           | Execution flow                |
| `harness-loop-e2e.test.ts`         | Harness loop end-to-end       |
| `multi-region.test.ts`             | Multi-region                  |
| `multi-step-task-execution.test.ts`| Multi-step task execution     |
| `rollback-scenario.test.ts`        | Rollback scenario              |

### 34.3 Golden Test File List (11 Files)

| File                          | Guarded Object           |
| ----------------------------- | ------------------------ |
| `openapi-document.test.ts`    | OpenAPI document structure |
| `cli-help-text.test.ts`       | CLI help text            |
| `diagnostics-bundle.test.ts`  | Diagnostics bundle structure |
| `prompt-assembly.test.ts`     | Prompt assembly + cache key |
| `session-summary.test.ts`     | Session summary structure |
| `release-plan-output.test.ts` | Release plan Markdown    |
| `workflow-validation.test.ts` | Workflow validation      |
| `phase1a-golden-tasks.test.ts`| Phase 1a golden task suite |
| `domain-baseline.test.ts`     | Domain baseline snapshot  |
| `config-schema.test.ts`       | Config schema snapshot    |
| `harness-protocol.test.ts`    | Harness protocol snapshot |

### 34.4 Performance Test File List (10 Files)

| File                                   | Benchmark Target          |
| -------------------------------------- | ------------------------- |
| `oapeflir-perf.test.ts`                | OAPEFLIR loop throughput   |
| `knowledge-perf.test.ts`               | Knowledge retrieval latency |
| `planning-perf.test.ts`                | Planning generation latency |
| `feedback-perf.test.ts`                | Feedback processing throughput |
| `plugin-perf.test.ts`                  | Plugin execution latency   |
| `handoff-perf.test.ts`                 | Handoff process latency    |
| `execution-performance.test.ts`        | Execution engine throughput |
| `harness-component-performance.test.ts`| Harness component latency  |
| `harness-loop-performance.test.ts`    | Harness loop throughput    |
| `prompt-engine-performance.test.ts`    | Prompt engine latency      |

### 34.5 Current Coverage Blind Spots Top-5 (v4.0 Updated)

| Rank | Blind Spot                                  | Current Status                                                                                 | Recommendation                                               |
| ---- | ------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1    | **Global line coverage** (c8 measured 0.75%) | Only 1,384 of 182,253 lines covered (6 SQLite delegating files), 977 source files at 0%     | Configure test framework to correctly collect coverage, establish real baseline |
| 2    | **E1-E6 anomaly event classification** (ARCH-P0-1) | Completely missing, no unified anomaly classification system                            | After implementation, add classification completeness + routing tests (§25.1) |
| 3    | **SEV1-SEV4 unified severity** (ARCH-P0-2)        | Code has 3 incompatible systems                                           | After unification, add mapping + degradation tests (§25.2)    |
| 4    | **STRIDE threat model** (ARCH-P0-3)               | Completely missing                                                               | After implementation, add 6 threat category tests (§25.3)     |
| 5    | **Principal type / Sandbox level** (ARCH-P1)     | Only 3/6 and 3/4 implemented respectively                              | After completion, add type completeness + isolation verification tests (§26.1/§26.2) |

---

> **Document End (v4.0)** — This manual upgraded from v3.0 to v4.0.
>
> **Part I** guarantees: sufficient tests, sufficient quality, no significant omissions.
> **Part II** guarantees: system key design semantics (state machines, events, concurrency, stage contracts, Harness semantic mapping) are all covered.
> **Part III** guarantees: the **13 architecture design-implementation gaps** found in Architecture Review v8.0 (3 P0 + 7 P1 + 3 P2) have corresponding test specifications, no coverage blind spots after implementation.
> **Part IV** guarantees: **engineering defects** (Redis errors, concurrency races, configuration issues, etc.) have corresponding regression test specifications, won't recur after fixes.
>
> **v4.0 Key Correction**: c8 measured global line coverage is only 0.75% (not v3.0's claimed 82.4%), all values in `.coverage-baseline.json` are null. Test file count (1,803) exceeds source files (1,387), but coverage collection pipeline not correctly linked, most urgent fix item.
>
> Core philosophy: **Coverage ratchet ensures quantity, mutation testing ensures quality, Traceability Matrix ensures completeness, PR Review ensures context, architecture semantic matrix ensures design contracts, architecture gap regression matrix ensures design-implementation alignment, system issue regression matrix ensures engineering defects don't recur. All seven are indispensable.**
>
> **Latest Supplement Note**: This file added [v4.1 Supplement: Test Types Not Yet Fully Considered and Completion Plans](#v41-supplement-test-types-not-yet-fully-considered-and-completion-plans) after v4.0 body, covering UI six platforms, Mission, Yono Business, LLM/Eval, API compatibility, migration rollback, Chaos/DR, observability, privacy compliance, plugin supply chain, fuzz, etc., previously not systematically included in the test manual.

---

# v4.1 Supplement: Test Types Not Yet Fully Considered and Completion Plans

> **Supplement Date**: 2026-05-18
> **Supplement Purpose**: v4.0 covered backend unit, integration, E2E, Golden, performance, mutation, security, and architecture gap regression, but has insufficient coverage for system-level risks such as new UI Monorepo, Mission/Yono business domain, LLM behavior evaluation, deployment upgrades, disaster recovery, and supply chain. This section serves as v4.1 supplement, has removed duplicate v4.0 copies and maintains the current file as the single authoritative version.

## 35. Insufficiently Covered Test Checklist

### 35.1 Gap Overview

| ID   | Test Type                   | Current Manual Coverage | Risk | Recommended Test Layer            | Priority |
| ---- | --------------------------- | ---------------------- | ---- | ---------------------------------- | -------- |
| T-GAP-01 | UI Six Platform Testing | Primarily backend E2E, not covering `ui/` Monorepo | Web works but desktop/mobile shell layer, adapters, routing, state layer may drift | Unit / Component / Contract / E2E / Accessibility / Visual | P0 |
| T-GAP-02 | PlatformAdapter Real Integration | Not distinguishing mock-first from real Electron IPC, Tauri invoke, RN Native Module | Frontend mock passes but real platform capabilities unavailable | Contract / Native smoke / Adapter parity | P0 |
| T-GAP-03 | Mission Long-term Goal Governance | Mission dimension special matrix not formed | Task, budget, permissions, freeze, evidence chain may bypass Mission context | Contract / Integration / E2E / Governance | P0 |
| T-GAP-04 | Yono Business Business Domain | Not covering new business domain end-to-end business acceptance | Domain config exists but business process, data permissions, SLA not verified | Domain smoke / E2E / Compliance | P0 |
| T-GAP-05 | LLM/Prompt/Eval Behavior Testing | Only prompt golden and partial OAPEFLIR tests | Model output uncontrollable, regression hard to find, hallucination/privilege escalation not quantified | Eval harness / Golden / Red team / Cost | P0 |
| T-GAP-06 | API Contract Compatibility and Version Evolution | Has OpenAPI golden but missing backward compatibility gate | SDK/UI/external callers broken when fields change | Contract diff / Consumer-driven contract | P0 |
| T-GAP-07 | Data Migration and Upgrade Rollback | Has partial migration/rehearsal but manual does not define unified strategy | Production upgrade schema/data irreversible damage | Migration rehearsal / Rollback / Backup restore | P0 |
| T-GAP-08 | Chaos / Fault Injection | Has deploy/chaos config but manual has no systematic approach | Redis/PG/network/worker failure reliability degradation unknown | Chaos / Recovery / Soak | P1 |
| T-GAP-09 | Disaster Recovery and Multi-region Drill | Has DR workflow but test manual not included in acceptance | RTO/RPO, cross-region consistency, failover not provable | DR drill / Multi-region E2E | P1 |
| T-GAP-10 | Observability Semantic Testing | Has alert rules test but missing trace/log/metric end-to-end semantics | Cannot locate faults when they occur or metric cardinality explosion | Observability contract / Golden / Cardinality guard | P1 |
| T-GAP-11 | Cost and Budget Defense Line | Scattered budget tests exist, missing cross-model/tool/task closed loop | Budget exhausted but still sends provider/tool call | Unit / Integration / E2E / Cost simulation | P1 |
| T-GAP-12 | Privacy, Data Retention and Redaction | Security testing biased toward attack surface, insufficient privacy compliance | Logs, events, learning objects leak PII/secret | Privacy scan / Retention / Redaction | P1 |
| T-GAP-13 | Plugin/Pack Ecosystem Compatibility | SDK has tests, missing version matrix and malicious plugin verification | Plugin destroys host, permission overflow, upgrade incompatible | SDK compatibility / Sandbox / Supply chain | P1 |
| T-GAP-14 | Supply Chain and Dependency Governance | CI has audit/Trivy but manual does not require lock file, SBOM, license | Dependency vulnerabilities, license non-compliance, build non-reproducible | SBOM / License / Lockfile / Provenance | P1 |
| T-GAP-15 | Performance Capacity and Resource Leak | Has performance benchmarks but missing long-term stability, leak, capacity boundary | Short test passes, long-running memory/handle/queue out of control | Soak / Leak / Capacity / Backpressure | P1 |
| T-GAP-16 | Parallel Test Isolation and Flakiness Governance | Has concurrency specification but missing flaky detection mechanism | Tests occasionally fail, misjudged as code problem or skipped | Repeat-run / Quarantine / Flaky budget | P1 |
| T-GAP-17 | Configuration Combination Matrix | Has env var validation but missing dev/test/staging/prod combination acceptance | prod-only config error cannot be found in advance | Config matrix / Helm/Terraform contract | P1 |
| T-GAP-18 | Accessibility / i18n / Theme | UI architecture requirements not entered test manual | Cross-platform UI inaccessible, translation missing, theme broken | axe / Keyboard / Locale / Visual | P1 |
| T-GAP-19 | Documentation Health and Example Executability | Only a few docs tests | Doc commands, paths, API examples expired | Docs lint / Snippet execution / Link check | P2 |
| T-GAP-20 | Property-based / Fuzz Testing | Not included | schema/parser/router vulnerable to unknown input | Fuzz / Property invariant | P2 |

### 35.2 Tests Already in Manual but Need Upgrade

| Existing Test  | Current Issue    | Upgrade Direction |
| -------------- | ---------------- | ----------------- |
| Coverage test   | Only emphasizes c8 metric, current baseline not effective | Add "coverage pipeline self-test": verify `src/` files are actually included in `coverage-summary.json`, avoid again appearing inflated or deflated |
| E2E test        | File list slightly outdated, not covering UI, Mission, Yono, real deployment pre-check | Add E2E organized by product journey: login, task, Mission, approval, HITL, cost, fault recovery, UI six platform smoke |
| Performance test | Biased toward short-run benchmarks | Add soak, memory leak, handle leak, queue backlog, backpressure tests |
| Security test  | Biased toward sandbox/path/command injection | Add PII/secret leak, OAuth/JWT lifecycle, CSRF/CORS, SSRF, dependency supply chain, plugin permission escape |
| Golden test    | Biased toward output format | Add prompt lineage, OpenTelemetry span structure, alert rules, UI route map, API compatible diff |
| Architecture invariant test | Biased toward static scan | Add runtime invariant: Mission live guard, budget fail-close, event/outbox same transaction, consumer idempotency |

## 36. New Specialized Test Plans

### 36.1 UI Six Platform Specialized Testing

| Layer            | Covered Object                              | Required Content                               | Recommended Location |
| --------------- | ------------------------------------------- | ---------------------------------------------- | -------------------- |
| Shared unit      | `ui/packages/shared/*`                      | REST/WS client, token, offline queue, DTO→VM mapper, permission/redaction | `ui/packages/**/__tests__/` or `ui/tests/unit/` |
| Component        | `ui/packages/ui-core`, `ui/packages/ui-mobile` | Component props contract, empty/error/loading, theme, high contrast | `ui/tests/component/` |
| Feature integration | `dashboard`, `task-cockpit`, `workflow-cockpit`, `approval`, `hitl`, `settings` | Route registration, feature gate, query invalidation, WS event mapping | `ui/tests/integration/features/` |
| Platform adapter | web/electron/tauri/mobile adapter           | secureStorage, filesystem, clipboard, lifecycle, deepLink, screenSecurity parity | `ui/tests/contracts/platform-adapter/` |
| App shell smoke  | Web/Electron/Tauri/RN                      | App bootstrap, provider injection, navigation, auth guard, error boundary | `ui/tests/smoke/` |
| Accessibility    | Web/desktop/mobile                          | axe, keyboard navigation, ARIA, focus trap, color contrast | `ui/tests/accessibility/` |
| Visual           | design system + key pages                   | Dashboard, task cockpit, approval, HITL, settings screenshot diff | `ui/tests/visual/` |

Acceptance criteria:

- Web must have runnable smoke + key journey E2E.
- Electron/Tauri/RN must at least have shell bootstrap, adapter injection, navigation/auth boot smoke.
- Each feature must simultaneously have `web/`, `mobile/`, `hooks/` tests, not allowed to test only single file entry.
- Planned backend capabilities can only be tested via typed mock + feature gate, cannot pretend to be production-ready.

### 36.2 Mission and Long-term Goal Governance Testing

Mission is the root object for long-term goals and governance context, not an execution object. Tests must prove it cannot be bypassed, nor can it replace Plan/Node/Attempt contracts.

| Test Topic              | Required Assertions |
| ---------------------- | ------------------- |
| Mission schema         | `MissionRecord`, membership, snapshot, budget, handoff, error envelope strict parse |
| State machine          | created/running/frozen/completed/aborted legal transitions, illegal transitions, version conflicts, idempotent replay |
| Resolution             | explicit/session/auto/ad-hoc/fail-closed paths, low-risk can auto-create, high-risk without Mission reject |
| Governance             | Permission intersection, policy deny, risk approval, membership revoked, freeze blocks new NodeRun |
| Budget                 | reserve/settle/release CAS, after budget exhausted no provider/tool call allowed |
| Runtime binding        | RequestEnvelope, ConfirmedTaskSpec, PlanGraphBundle, HarnessRun, NodeRun hold missionRef/snapshotRef |
| Event/projection       | state change and event append same transaction, after event replay projection consistent |
| Observability          | metric label does not contain missionId, trace/log includes correlation but does not leak high-cardinality sensitive fields |

### 36.3 Yono Business Business Domain Testing

After Yono Business joins as a business domain, cannot just verify config file exists, must verify business closed loop.

| Test Type          | Required Content |
| ------------------ | ---------------- |
| Domain config smoke | domain id, workflow, tool bundle, risk/eval/SLA/division config complete |
| Business flow E2E | Enterprise account opening/data collection/approval/execution/evidence archiving/error recovery main chain |
| Permission and tenant isolation | Enterprise user, operator, auditor, administrator role read/write boundaries |
| Compliance and audit | KYC/KYB, sensitive field redaction, approval evidence, audit non-tamperable |
| SLA and cost | High priority task deadline, budget upper limit, degradation strategy |
| Failure recovery | Approval rejection, missing data, external system timeout, duplicate submission idempotency |

### 36.4 LLM / Prompt / Eval Testing

| Dimension   | Test Plan                                                        |
| ----------- | ---------------------------------------------------------------- |
| Prompt contract | prompt template schema, variable completeness, no undeclared variables, output JSON schema parseable |
| Prompt lineage | Each model call can associate prompt version, model, provider, cost, trace id |
| Deterministic fixtures | Use fixed provider mock/VCR fixture to verify planner/generator/evaluator branches |
| Eval harness | Establish small golden set for key tasks, verify correctness, safety, completeness, rejection boundary |
| Red team   | prompt injection, tool exfiltration, privilege escalation instructions, sensitive information inducement |
| Cost guard  | max tokens, budget exhausted, provider fallback, retry cost attribution |
| Regression replay | Online failure samples enter eval corpus, after fix must stably pass |

### 36.5 Contract Compatibility and Version Evolution Testing

When adding or modifying public interfaces, must simultaneously test "new version correct" and "old callers not broken".

| Contract    | Required Content                                                |
| ---------- | --------------------------------------------------------------- |
| HTTP/OpenAPI | OpenAPI diff: deleted fields, tightened enum, changed required, status code changes must fail |
| Event schema | New fields backward compatible, deleted/renamed/semantic changes must have migration or version bump |
| SDK/CLI     | Old SDK fixture calls new service; CLI output verified via golden |
| UI API seam  | Layer C endpoint annotation, planned mock and real contract do not drift |
| Config schema | dev/test/staging/prod configs all parse, prod required fields missing fail-close |

### 36.6 Data Migration, Backup Restore and Upgrade Rollback Testing

| Scenario            | Required Content                                                               |
| ------------------- | ------------------------------------------------------------------------------ |
| Forward migration   | Upgrade from previous version fixture DB to current schema, data complete and indexes available |
| Idempotent migration | Same migration executed multiple times does not corrupt data                    |
| Rollback rehearsal  | After upgrade failure, rollback script can restore to bootable state           |
| Backup restore      | `backup-sqlite.sh` / `restore-sqlite.sh` output can restore and pass smoke     |
| Hot upgrade         | `verify-hot-upgrade.sh` covers worker draining, lease handoff, events not lost |
| Data checksum       | Key table before/after migration record count, hash, foreign keys consistent   |

### 36.7 Chaos, Disaster Recovery and Long-Term Stability Testing

| Scenario              | Required Content                                                        |
| --------------------- | ----------------------------------------------------------------------- |
| Redis disconnect      | Enqueue failure visible, retry, DLQ, after recovery backlog drains     |
| Postgres/SQLite busy  | WAL, busy retry, transaction rollback, no partial write                 |
| Network delay        | provider/tool timeout, circuit breaker, degradation                     |
| Pod/worker kill      | lease reclaim, stuck run sweeper, replay, idempotent writeback          |
| Multi-region failover | When primary region unavailable, read/write strategy, RTO/RPO, event order |
| Soak                 | 6h/24h queue backlog, memory, handles, timers, listeners do not grow     |

### 36.8 Observability and Operations Testing

| Object      | Required Content                                                           |
| ---------- | -------------------------------------------------------------------------- |
| Metrics    | Required metrics exist, label whitelist, high-cardinality fields prohibited, anomaly path count increments |
| Logs       | Structured fields, trace/correlation, PII/secret redaction, critical path `console.*` prohibited |
| Traces     | HTTP → service → event/outbox → worker → provider/tool span chaining      |
| Alerts     | Prometheus rules consistent with real metric names, Alertmanager receiver config parseable |
| Runbooks   | Alerts can link to runbook, runbook commands executable or statically verifiable |

### 36.9 Privacy, Compliance and Data Lifecycle Testing

| Scenario                | Required Content                                                        |
| ----------------------- | ----------------------------------------------------------------------- |
| PII/secret redaction    | Logs, events, learning objects, prompt context, UI VMs all redacted    |
| Retention               | session, audit, evidence, memory, learning data expire or archive per policy |
| Right-to-delete         | User deletable data deletable, while retaining compliance audit summary |
| Consent                 | analyticsConsent, model training opt-out, after effective do not send related events |
| Tenant isolation        | Cross-tenant queries, event replay, cache key, file namespace all rejected |

### 36.10 Plugin, Pack and Supply Chain Testing

| Scenario                    | Required Content                                                           |
| -------------------------- | -------------------------------------------------------------------------- |
| Plugin sandbox             | File, network, command, environment variable permission boundaries          |
| Pack compatibility         | Multi-version pack manifest, API compatibility, install/uninstall/upgrade |
| Malicious plugin           | Privilege escalation, path escape, secret reading, infinite loop, resource exhaustion |
| SBOM/provenance            | Lockfile fixed, SBOM generation, license allowlist, build artifacts traceable |
| Marketplace governance     | Review, signature, withdrawal, staged release, rollback                    |

### 36.11 Property-based / Fuzz Testing

Objects suitable for introducing fuzz/property-based testing:

- Zod schema parser: random missing fields, wrong types, overly long strings, unknown enum.
- Cursor pagination: random insert/delete without duplication, missing items, stable sorting.
- State transition: random event sequences cannot cross terminal state or violate CAS.
- Event replay: random repeat/disorder/missing ack after projection idempotent.
- Cost budget: random reserve/settle/release total not negative, not exceeding limit.
- Path/security parser: random encoding, Unicode, null-byte, path separator.

## 37. Completion Execution Roadmap

### 37.1 P0 Must Priority Complete

| Priority | Item                                    | Deliverable                                                                                   |
| -------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| P0-1     | Coverage pipeline self-test            | One test verifying c8 `all: true` actually counts unimported `src/` files as 0%, and `.coverage-baseline.json` non-empty |
| P0-2     | UI Web smoke + PlatformAdapter contract | Web app startup, core route render, adapter parity, feature gate mock contract               |
| P0-3     | Mission governance E2E                 | High-risk without Mission reject, freeze/revoke/budget exhausted block NodeRun               |
| P0-4     | Yono Business domain smoke             | Config, workflow, permissions, approval, audit, SLA main chain                                |
| P0-5     | API/event backward compatibility       | OpenAPI diff, event schema diff, SDK fixture compatibility                                    |
| P0-6     | LLM eval/red-team baseline             | Golden set, prompt injection, cost guard, provider fallback                                   |
| P0-7     | Migration/backup restore rehearsal    | Previous version fixture DB upgrade, backup restore, rollback smoke                           |

### 37.2 P1 Second Batch Complete

| Priority | Item                           | Deliverable                                      |
| -------- | ------------------------------ | ------------------------------------------------ |
| P1-1     | Chaos + recovery              | Redis/DB/network/worker kill directed drill     |
| P1-2     | Observability contract        | metrics/logs/traces/alerts/runbook full chain verification |
| P1-3     | Privacy lifecycle             | redaction, retention, delete, consent, tenant isolation |
| P1-4     | Long soak/leak                | memory, handle, timer, listener, queue backlog long-term test |
| P1-5     | Plugin/Pack supply chain      | sandbox, compatibility, malicious plugin, SBOM/license |
| P1-6     | UI accessibility/visual/i18n  | axe, keyboard, theme, locale, visual diff        |

### 37.3 P2 Sustainable Enhancement

| Priority | Item                        | Deliverable                                  |
| -------- | --------------------------- | -------------------------------------------- |
| P2-1     | Property/fuzz              | schema, pagination, state, event, budget, path parser fuzz |
| P2-2     | Docs health                | Doc links, command snippets, path references, example code executable |
| P2-3     | Flaky governance           | repeat-run, quarantine, skip audit, failure sample auto replay |
| P2-4     | Test inventory dashboard   | Source directory, test layer, coverage, mutation score, gap ID visualization |

### 37.4 New Automated Guardian Tests This Round

To avoid v4.1 supplement chapter remaining as manual checklist, this round adds `tests/unit/quality/full-coverage-test-manual-gaps.test.ts` as manual implementation guardian test. This test does not replace each special test itself, but verifies every test gap in the manual has locatable runtime artifact evidence and automated test artifact evidence.

Also adds `tests/unit/quality/full-coverage-real-paths.test.ts` and `tests/unit/quality/full-coverage-operational-real-paths.test.ts`, directly executing Mission, Yono Business, Prompt Guard, Budget Guard, Startup Env Schema, Prometheus Exporter, Fixture Redactor, Chaos Scheduler, Supply-chain Audit Script, deployment/DR/alert assets etc., as the minimum executable product-level and operational-level coverage baseline for Part V.

| Guarded Object       | Automated Assertion                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `T-GAP-01` to `T-GAP-20` | Manual must completely list 20 gaps, each gap must map to at least one set of real runtime artifact and automated test artifact |
| `GA-01` to `GA-15`      | Formal interaction admission items must be completely retained, not accidentally deleted during documentation cleanup |
| P0/P1/P2 completion roadmap | Key routes like `P0-1`, `P0-7`, `P1-1`, `P1-6`, `P2-4` must continue to exist                          |
| Test command entry   | `test:unit`, `test:integration`, `test:e2e`, `test:golden`, `test:performance`, `test:leaks`, `test:invariants`, `coverage:gate`, `test:mutation` must exist |
| Coverage baseline   | `.coverage-baseline.json` must contain numeric global/minimum metrics, and include `src/` directory-level baseline |
| Reality check       | Each gap corresponding test evidence must include executable `test()`/`it()` with assertions; `tests/` and `ui/tests/` not allowed to have unregistered `.skip`; UI features must maintain `web/`, `mobile/`, `hooks/` three entries |
| Property/Fuzz baseline | Public parsers like cursor pagination must have deterministic fuzz / schema drift tests, covering unknown fields, wrong types, negative numbers, floats and array payloads |
| Real path baseline  | Mission resolution/live guard/budget, Yono market-to-dispute, Prompt injection/canary leakage, Budget cascade/cost attribution, startup config fail-close, Prometheus exporter, privacy redaction, Chaos rollback, supply-chain audit, deploy/DR/alert assets must have tests directly calling production code or real repository config |

When adding new test types in the future, must simultaneously update evidence mapping in this guardian test; if a gap still has no automated evidence, should explicitly mark as residual risk in this file, not write it as covered.

## 38. New Test Entry Gate Rules

Before any new feature enters `main`, besides v4.0 Checklist, must answer the following questions:

- Does it involve UI? If yes, are there Web + corresponding platform adapter tests?
- Does it involve Mission, budget, permissions, approval, HITL? If yes, are there fail-close tests?
- Does it involve LLM/provider/tool calls? If yes, are there cost, degradation, prompt injection, output schema tests?
- Does it add/modify API, event, SDK, config? If yes, are there compatibility diff tests?
- Does it involve DB schema or persistence format? If yes, are there migration, rollback, backup recovery tests?
- Might it write logs, events, memory, learning objects? If yes, are there PII/secret redaction tests?
- Does it add plugin/Pack capability? If yes, are there sandbox and supply chain tests?
- Does it add long-running worker/cache/queue/listener? If yes, are there resource leak and backpressure tests?

## 39. Documentation Maintenance Rules

- Current file has removed duplicate v4.0 copies, only retains one v4.1 authoritative body.
- When updating test count, E2E file list, Performance file list in the future, should prioritize auto-generation via script to avoid manual statistics becoming outdated.
- v4.1 supplement chapter has been incorporated into formal table of contents, maintained as Part V "Product-level and Operational-level Acceptance Testing".

## 40. Formal Interaction Admission Standards

Automated test passing is only a necessary condition for "code deliverable", not equal to system being ready for real users, real business, or real external systems to interact. Before formal interaction, must complete the following admission items, forming auditable release evidence bundle.

### 40.1 Content Still Needs Completion Before Formal Interaction

| ID    | Admission Item           | Must Complete Content                                                    | Blocking Level |
| ---- | ----------------------- | ------------------------------------------------------------------------ | -------------- |
| GA-01 | Test results credible   | Full test, UI test, contract test, migration test, key E2E all have latest pass record; all skip/flaky have registration and approval reasons | Blocker |
| GA-02 | Real interaction paths  | Login, create task, Mission binding, Plan generation, execution, approval/HITL, result delivery, evidence query, failure recovery can go through | Blocker |
| GA-03 | Permissions and tenant isolation | Admin, operator, regular user, auditor, external integration account permission matrix passes automation and spot check | Blocker |
| GA-04 | Budget and risk fail-close | Budget exhausted, high-risk without approval, Mission freeze/revoke, policy rejection does not trigger model, tool or external side effects | Blocker |
| GA-05 | Data persistence and recovery | Tasks, events, outbox, DLQ, evidence, audit, memory, Mission data recoverable after restart, migration/backup/rollback drill passes | Blocker |
| GA-06 | LLM output controllable | Prompt schema, output schema, cost attribution, provider fallback, prompt injection red-team, eval golden set all pass | Blocker |
| GA-07 | UI usability            | Web key flow can be truly operated; desktop/mobile shell at least passes adapter, navigation, auth, error boundary smoke; Planned features have clear degradation markers | Blocker |
| GA-08 | Observability and alerting | metrics/logs/traces/alerts/runbook chain available; key errors, budget rejections, DLQ growth, worker unhealthy can be discovered | Blocker |
| GA-09 | Security and privacy    | PII/secret redaction, JWT/OAuth lifecycle, CSRF/CORS, SSRF, path traversal, plugin permission escape, dependency high-risk vulnerabilities all pass check | Blocker |
| GA-10 | External system boundary | Email, calendar, payment, enterprise IdP, third-party tool and other external integrations must have sandbox/staging verification; capabilities not connected to real system remain feature gated | Blocker |
| GA-11 | Gradual rollout and rollback | Feature flags, gradual percentage, quick shutdown, database rollback/compensation, previous version recovery path already drilled | Blocker |
| GA-12 | Operations takeover     | Manual takeover, pause queue, freeze Mission, replay events, retry DLQ, export diagnostics package, incident escalation process executable | Blocker |
| GA-13 | Documentation and training | User manual, admin manual, troubleshooting guide, permission description, data retention description and release note updated | Major |
| GA-14 | Legal and compliance    | Data retention, audit, privacy, industry domain compliance requirements have owner confirmation; high-risk domains not open based solely on automated tests | Major |
| GA-15 | Evidence archiving      | This release commit, build artifacts, test reports, coverage, migration results, rollback drill, risk acceptance records all archived | Major |

### 40.2 Minimum Formal Interaction Test Matrix

| Interaction Journey       | Automated Acceptance | Manual Acceptance |
| ------------------------- | -------------------- | ------------------ |
| User login and session    | auth callback, token refresh, session expiry, logout | Browser real login, re-login after expiry |
| Task creation to completion | task create, Mission resolution, PlanGraph, HarnessRun, NodeRun, evidence | UI create task, confirm status, logs, results readable |
| High-risk approval        | risk detect, approval requested, approve/reject, audit evidence | Auditor approves, rejects, timeout handling |
| HITL/takeover            | pause, resume, takeover, operator action audit | Operations takeover one real task and recover |
| Cost and budget           | reserve, settle, release, budget exhausted blocking | Management view budget consumption and rejection reasons |
| Failure recovery          | worker kill, DLQ retry, event replay, checkpoint resume | Manually trigger retry and confirm results consistent |
| UI key pages              | dashboard, task cockpit, approval, HITL, settings smoke | Desktop and mobile at least complete read-only inspection |
| External integration      | sandbox connector, timeout, retry, idempotency | staging credential connectivity and failure prompts |

### 40.3 Situations Not Allowed for Formal Interaction

- Full test still has unexplained failures, or skip count increased without approval record.
- Coverage/test manifest shows key running paths not reached by automated tests.
- Mission, budget, permissions, approval, HITL any fail-close test missing.
- UI Planned/mock capabilities without clear markers, users may mistakenly think production-ready.
- PII/secret found in logs, events, prompts, learning objects.
- Data migration, backup recovery, rollback path have no drill evidence.
- Alerts cannot reach responsible parties, or runbooks cannot guide recovery operations.
- External systems use real credentials but not verified via staging/sandbox.

### 40.4 Formal Interaction Passing Criteria

Formal interaction must satisfy the following conclusions:

- All `Blocker` admission items passed, `Major` admission items either passed or have clear risk acceptor and due remediation time.
- Automated test reports, manual acceptance records, rollback drill results and release evidence bundle all archived.
- All production-visible capabilities have owner, runbook, alert, shutdown switch and rollback/compensation path.
- User-seen feature state matches real backend capabilities, not packaging mock, planned, partial capabilities as completed capabilities.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CI Quality Gates                            │
├─────────────────────────────────────────────────────────────────────┤
│  1. Pre-commit (local)                                             │
│     ├── ESLint (no errors)                                          │
│     ├── TypeScript type check (no errors)                           │
│     └── Unit tests (must pass)                                      │
│                                                                     │
│  2. PR pipeline                                                     │
│     ├── ESLint + type check                                         │
│     ├── Unit tests (all pass)                                       │
│     ├── Integration tests                                           │
│     ├── Coverage check (all Critical/High meet thresholds)          │
│     └── Mutation score check (all Critical/High ≥ 60%)              │
│                                                                     │
│  3. Merge to main                                                   │
│     ├── All above checks                                            │
│     ├── Golden tests (all pass)                                    │
│     └── Build succeeds                                              │
│                                                                     │
│  4. Release gate                                                    │
│     ├── Full test suite                                             │
│     ├── E2E tests                                                   │
│     └── Security scan (no critical/high vulnerabilities)            │
└─────────────────────────────────────────────────────────────────────┘
```

---

*End of document*
