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