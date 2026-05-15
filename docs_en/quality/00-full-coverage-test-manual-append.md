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

**Part II — Architectural Semantic Coverage (v1.1 new, v1.2 supplement, v3.0 extended)**

14. [State Machine Testing Specification](#14-state-machine-testing-specification)
15. [Event-Driven Testing Specification](#15-event-driven-testing-specification)
16. [OAPEFLIR Stage Coverage Matrix](#16-oapeflir-stage-coverage-matrix)
17. [Concurrency and Timing Testing Specification](#17-concurrency-and-timing-testing-specification)
18. [Design Specification to Test Traceability Specification](#18-design-specification-to-test-traceability-specification)
19. [Real Execution vs Mock Execution Boundary Specification](#19-real-execution-vs-mock-execution-boundary-specification)
20. [Test Debt Classification](#20-test-debt-classification)
21. [Failure Sample Replay Rules](#21-failure-sample-replay-rules)
22. [Test Data Governance](#22-test-data-governance)
23. [Coverage Quality Redlines](#23-coverage-quality-redlines)

**Part III — Architecture Gap Regression Test Matrix (v4.0 rewrite, aligned with architecture review v8.0)**

24. [Architecture Review-Driven Regression Testing](#24-architecture-review-driven-regression-testing)
25. [P0 Architecture Violation Gap Testing Specification](#25-p0-architecture-violation-gap-testing-specification)
26. [P1 High-Priority Gap Testing Specification](#26-p1-high-priority-gap-testing-specification)
27. [P2 Detail Completion Gap Testing Specification](#27-p2-detail-completion-gap-testing-specification)

**Part IV — Systems Engineering Defect Regression Testing (v2.0 original Part III preserved, v4.0 updated)**

29. [P0 Blocker-Level Engineering Defect Testing Specification](#29-p0-blocker-level-engineering-defect-testing-specification)
30. [P1 Critical Engineering Defect Testing Specification](#30-p1-critical-engineering-defect-testing-specification)
31. [P2 Important Engineering Defect Testing Specification](#31-p2-important-engineering-defect-testing-specification)
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
