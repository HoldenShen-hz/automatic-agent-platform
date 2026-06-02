# 全coveragetesting方法手册

> **文档版本**: v4.1 (v4.0 正文 + v4.1 missing口补充) 
> **适用项目**: automatic-agent-platform
> **testing框架**: Node.js built-in test runner (`node:test`) + `node:assert/strict`
> **coverage率工具**: c8 v11.0.0 (V8 native coverage) + Istanbul reporter
> **变异testing**: Stryker Mutator v9.6.1
> **Node.js 要求**: v22+ (`--test` + `--test-concurrency` flags) 
> **上次更新**: 2026-05-18 (补充未充分coverage的产品级, 运营级, UI, Mission, LLM, 迁移与供应链testing) 
> **最新补充**: 见 [v4.1 补充: 尚未充分考虑的testingtype与补全方案](#v41-补充尚未充分考虑的testingtype与补全方案)

---

## 目录

**Part I — testing治理基础**

1. [testing基础设施总览](#1-testing基础设施总览)
2. [命令速查表](#2-命令速查表)
3. [目录结构与分层规范](#3-目录结构与分层规范)
4. [testing编写规范与模式](#4-testing编写规范与模式)
5. [Mock 与 Helper 工具箱](#5-mock-与-helper-工具箱)
6. [coverage率门禁机制](#6-coverage率门禁机制)
7. [testing无misses保障体系](#7-testing无misses保障体系)
8. [安全回归testing规范](#8-安全回归testing规范)
9. [Golden / Snapshot testing](#9-golden--snapshot-testing)
10. [性能基准testing](#10-性能基准testing)
11. [变异testing (Stryker) ](#11-变异testingstryker)
12. [CI 集成与工作流](#12-ci-集成与工作流)
13. [新moduletesting Checklist](#13-新moduletesting-checklist)

**Part II — 架构语义coverage (v1.1 新增, v1.2 增补, v3.0 扩展) **

14. [state机testing规范](#14-state机testing规范)
15. [事件驱动testing规范](#15-事件驱动testing规范)
16. [OAPEFLIR 阶段coverage矩阵](#16-oapeflir-阶段coverage矩阵)
17. [concurrent与时序testing规范](#17-concurrent与时序testing规范)
18. [设计规格到testing追溯规范](#18-设计规格到testing追溯规范)
19. [真实execute vs Mock execute边界规范](#19-真实execute-vs-mock-execute边界规范)
20. [testing债务分级](#20-testing债务分级)
21. [failure样例回灌规则](#21-failure样例回灌规则)
22. [testingdata治理](#22-testingdata治理)
23. [coverage率质量红线](#23-coverage率质量红线)

**Part III — 架构missing口回归testing矩阵 (v4.0 重写, 对齐架构审查 v8.0) **

24. [架构审查驱动的回归testing](#24-架构审查驱动的回归testing)
25. [P0 架构违规missing口testing规范](#25-p0-架构违规missing口testing规范)
26. [P1 高优先级missing口testing规范](#26-p1-高优先级missing口testing规范)
27. [P2 details补全missing口testing规范](#27-p2-details补全missing口testing规范)

**Part IV — system工程missing陷回归testing (v2.0 原 Part III 保留, v4.0 更新) **

29. [P0 阻断级工程missing陷testing规范](#29-p0-阻断级工程missing陷testing规范)
30. [P1 严重工程missing陷testing规范](#30-p1-严重工程missing陷testing规范)
31. [P2 重要工程missing陷testing规范](#31-p2-重要工程missing陷testing规范)
32. [架构不变量auto守护testing](#32-架构不变量auto守护testing)
33. [桩filecoveragemissing口追踪](#33-桩filecoveragemissing口追踪)
34. [testingmissing口与coverage现状汇总](#34-testingmissing口与coverage现状汇总)

**Part V — 产品级与运营级验收testing (v4.1 补充) **

35. [未充分coveragetesting清单](#35-未充分coveragetesting清单)
36. [新增专项testing方案](#36-新增专项testing方案)
37. [补全execute路线](#37-补全execute路线)
38. [新增testing进入门禁规则](#38-新增testing进入门禁规则)
39. [文档maintained规则](#39-文档maintained规则)
40. [正式交互准入标准](#40-正式交互准入标准)

---

## 1. testing基础设施总览

### 1.1 技术栈

| 组件        | 选型                                                | 版本     |
| ----------- | --------------------------------------------------- | -------- |
| Test runner | `node:test` (Node.js built-in)                      | Node 22+ |
| Assertions  | `node:assert/strict`                                | Node 22+ |
| Mocking     | 手写 mock 对象 + `tests/helpers/typed-factories.ts` | —        |
| Coverage    | c8 (V8 native)                                      | v11.0.0  |
| Mutation    | Stryker Mutator                                     | v9.6.1   |
| Lint        | ESLint                                              | —        |
| Typecheck   | TypeScript `tsc --noEmit`                           | —        |

### 1.2 关键设计决策

- **无外部testing框架**: 不uses Jest / Vitest / Mocha, 减少dependency (devDependencies only 12 个) 
- **无外部 mock 库**: 不uses Sinon / testdouble, viatype安全工厂函数创建 mock
- **编译后运行**: `npm run build:test` 编译 `src/` + `tests/` → `dist/`, testing运行 `dist/tests/**/*.test.js`
- **coverage率棘轮**: `.coverage-baseline.json` baseline 只能上升不能下降, CI forceexecute
- **TypeScript 严格模式**: `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- **ESM module**: 编译目标 ES2023 + NodeNext modulesystem, 所有导入必须带 `.js` 扩展名

### 1.3 当前规模

| 指标                            | 数值        |
| ------------------------------- | ----------- |
| 源file总数 (`src/**/*.ts`)      | **1,387**   |
| 源代码行数                      | **265,020** |
| testingfile总数 (`tests/**/*.ts`)  | **1,823**   |
| testing `.test.ts` file数          | **1,803**   |
| testing代码行数                    | **439,448** |
| assertion总数 (`assert.*` call)      | **~52,480** |
| testing/源file比                   | **1.30**    |
| Unit testingfile                   | **1,398**   |
| Integration testingfile            | **358**     |
| E2E testingfile                    | **17**      |
| Golden testingfile                 | **11**      |
| Performance testingfile            | **10**      |
| globally行coverage率 (c8 实测)          | **0.75%**   |
| globally语句coverage率 (c8 实测)        | **0.75%**   |
| globally函数coverage率 (c8 实测)        | **0.61%**   |
| globallybranchcoverage率 (c8 实测)        | **0.61%**   |

> **v4.0 变更**: 源file从 1,335 → 1,387 (+52) , testingfile从 1,341 → 1,803 (+462) , assertion从 ~34,061 → ~52,480 (+18,419) . E2E 从 10 → 17, Performance 从 7 → 10. **coverage率重大修正**: v3.0 文档声称globally行coverage率 82.4%, 经本次 c8 实测验证only为 **0.75%** (182,253 行中only 1,384 行被coverage, 全部位于 `src/platform/five-plane-state-evidence/truth/sqlite/` 的 6 个 authoritative-task-store-delegating-\*.ts file) . `.coverage-baseline.json` 基线file所有值为 null, 从未被真正填充. 这表明 v3.0 references的coverage率data来自增量构建而非full c8 analysis, 本版已修正为实测值. 

---

## 2. 命令速查表

```bash
# 完整testing (含coverage率门禁) 
npm test

# only运行testing (不含门禁) 
npm run test:raw

# 分层运行
npm run test:unit
npm run test:integration
npm run test:golden

# 特定file
npm run build:test && node --test "dist/tests/unit/platform/five-plane-orchestration/*.test.js"

# PostgreSQL 集成testing (需 PG 环境) 
AA_TEST_PG_DSN="postgres://..." npm run test:pg-integration

# 性能testing
npm run test:performance

# 变异testing
npm run test:mutation

# coverage率报告
npm run coverage:report

# 更新coverage率基线
npm run coverage:baseline:update

# typecheck
npm run typecheck

# ops诊断
npm run doctor
npm run inspect
npm run dispatch-execution
npm run worker-handshake
npm run worker-writeback
```

---

## 3. 目录结构与分层规范

### 3.1 目录布局

```
tests/
├── unit/                       # 隔离逻辑testing (1,398 file) 
│   ├── platform/               # 对应 src/platform/ 镜像结构 (902 file) 
│   │   ├── execution/          # Execution Plane (151 file) 
│   │   ├── state-evidence/     # stateEvidence Plane (164 file) 
│   │   ├── control-plane/      # Control Plane (117 file) 
│   │   ├── orchestration/      # Orchestration Plane (112 file) 
│   │   ├── shared/             # shared设施 (140 file) 
│   │   ├── interface/          # Interface Plane (80 file) 
│   │   ├── contracts/          # contracttesting (49 file) 
│   │   ├── model-gateway/      # 模型网关 (34 file) 
│   │   ├── prompt-engine/      # 提示引擎 (22 file) 
│   │   └── compliance/         # 合规 (11 file) 
│   ├── ops-maturity/           # ops成熟度 (103 file) 
│   ├── scale-ecosystem/        # 规模生态 (70 file) 
│   ├── sdk/                    # SDK (65 file) 
│   ├── domains/                # 领域 (55 file) 
│   ├── runtime/                # runtime交叉testing (48 file) 
│   ├── interaction/            # 交互 (47 file) 
│   ├── org-governance/         # 组织治理 (42 file) 
│   ├── plugins/                # 插件 (24 file) 
│   ├── core/                   # 核心 (13 file) 
│   ├── apps/                   # 应用 (6 file) 
│   ├── deploy/                 # 部署configure守护 (4 file) 
│   └── docs/                   # 文档守护 (2 file) 
├── integration/                # 跨服务/runtimetesting (358 file) 
│   ├── platform/               # 平台集成 (269 file, 含 security/ 子目录) 
│   ├── sdk/                    # SDK/CLI 集成 (35 file) 
│   ├── domains/                # 领域 (17 file) 
│   ├── ops-maturity/           # ops成熟度 (17 file) 
│   ├── scale-ecosystem/        # 规模生态 (7 file) 
│   ├── interaction/            # 交互 (3 file) 
│   ├── org-governance/         # 组织治理 (2 file) 
│   ├── stability/              # 稳定性 (2 file) 
│   ├── workflow/               # 工作流 (2 file) 
│   ├── orchestration/          # 编排 (1 file) 
│   ├── deploy/                 # 部署 (1 file) 
│   ├── interaction-governance/ # 交互治理 (1 file) 
│   └── scale-ops/              # 规模ops (1 file) 
├── golden/                     # 快照/Golden testing (11 file) 
│   └── snapshots/              # Golden file存储
├── e2e/                        # 端到端场景 (17 file) 
├── performance/                # 性能基准 (10 file) 
├── helpers/                    # shared工具 (19 file + fixtures/ 子目录) 
│   ├── typed-factories.ts      # unsafeCast / partial / mock 工厂
│   ├── fixtures/               # base.ts + composite.ts
│   ├── integration-context.ts  # SQLite + TaskStore 集成上下文
│   ├── repository-harness.ts   # 仓储层 DB testing
│   ├── e2e-harness.ts          # 全栈 E2E 上下文
│   ├── golden.ts               # 快照assertion
│   ├── env.ts                  # 环境变量隔离
│   ├── fs.ts                   # 临时filesystem
│   ├── concurrent-runner.ts    # concurrent不变量验证
│   ├── process-guard.ts        # 子processleaks检测
│   ├── api.ts                  # API 集成种子
│   ├── pg-test-helper.ts       # PostgreSQL testing
│   ├── cli.ts                  # CLI testing
│   ├── seed.ts                 # data播种
│   ├── test-cleanup.ts         # singletonreset
│   ├── billing.ts              # 计费testing
│   ├── perception.ts           # 感知testing
│   └── pmf.ts                  # PMF testing
└── fixtures/                   # 迁移testing fixtures
```

### 3.2 分层规则

| 层              | 目录                 | 规则                              | dependency                             |
| --------------- | -------------------- | --------------------------------- | -------------------------------- |
| **Unit**        | `tests/unit/`        | 单module隔离testing, 所有外部dependency mock | 无 DB, 无网络, 无file I/O        |
| **Integration** | `tests/integration/` | 跨module, CLI, runtime, sandbox     | 可用 SQLite in-memory, temp 目录 |
| **Golden**      | `tests/golden/`      | output快照对比                      | 可dependency真实服务                   |
| **E2E**         | `tests/e2e/`         | 完整业务流程                      | 全栈, mock provider              |
| **Performance** | `tests/performance/` | 延迟/吞吐量基准                   | 可用真实 DB                      |

---

## 4. testing编写规范与模式

### 4.1 基本结构

本项目uses **扁平 `test()` call**, 不uses `describe()` 嵌套. 每个testingfiledirectly导入 `node:test` 和 `node:assert/strict`. 

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { MyService } from "../../../../src/platform/my-module/my-service.js";

test("MyService 在输入为空时returndefault值", () => {
  const service = new MyService();
  const result = service.compute({});
  assert.equal(result, "default");
});

test("MyService reject非法参数", () => {
  const service = new MyService();
  assert.throws(() => service.compute(null as any), {
    message: /invalid input/i,
  });
});
```

### 4.2 naming规范

| 维度     | 规则                             | 示例                                                                  |
| -------- | -------------------------------- | --------------------------------------------------------------------- |
| file名   | `<被测module>.test.ts`, kebab-case | `feedback-collector.test.ts`                                          |
| testing标题 | 行为描述, 主语 + 条件 + 预期     | `"FeedbackCollector deduplicates signals and emits learning signals"` |
| 变量名   | 与生产代码一致的 camelCase       | `const collector = new FeedbackCollector()`                           |

### 4.3 导入path

所有导入uses **相对path + `.js` 扩展名** (因为编译为 ESM) : 

```typescript
// 正确
import { FeedbackCollector } from "../../../../src/platform/feedback/feedback-collector.js";

// error — missing少 .js 扩展名
import { FeedbackCollector } from "../../../../src/platform/feedback/feedback-collector";
```

### 4.4 assertion模式

本项目onlyuses `node:assert/strict`, 常用 API: 

```typescript
// 值相等 (===) 
assert.equal(result.status, "blocked");

// 深度相等 (对象/array) 
assert.deepEqual(learningSignals[0]?.sourceSignalIds, ["sig_1", "sig_2"]);

// 布尔assertion
assert.ok(result.length > 0);

// 异常assertion
assert.throws(() => schema.parse(badInput));
assert.throws(() => fn(), { message: /expected pattern/ });

// 异步异常
await assert.rejects(async () => service.execute(), {
  message: /timeout/,
});

// 不throws异常 (Schema 验证常用) 
assert.doesNotThrow(() => schema.parse(validPayload));
```

### 4.5 synchronous vs 异步

- **Unit testing**: 优先synchronous. 纯函数, Schema 解析, in-memory服务都是synchronous的
- **Integration testing**: 通常 `async`, 因涉及 DB/file/子process
- **principle**: 如果被测函数return `Promise`, testing函数标记 `async`; 否则保持synchronous

### 4.6 资源cleanup模式

Integration 和 E2E testinguses `try/finally` 模式确保cleanup: 

```typescript
test("sandbox blocks symlink traversal", async () => {
  const workspace = createTempWorkspace("aa-sandbox-");
  const outside = createTempWorkspace("aa-target-");
  try {
    // ... testing逻辑
    assert.equal(result.status, "blocked");
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});
```

**禁止** uses `afterEach` 或globally teardown — Node.js test runner 对此支持有限, 且 `try/finally` 更可靠. 

### 4.7 testingdata构建

uses fixture 工厂函数 + spread overrides 模式, 避免大量内联data: 

```typescript
import { createMinimalTask } from "../../../helpers/fixtures/base.js";

test("task store persists custom priority", () => {
  const task = createMinimalTask({ priority: "critical" });
  store.insertTask(task);
  const loaded = store.getTask(task.id);
  assert.equal(loaded.priority, "critical");
});
```

### 4.8 安全testing模式

安全testing遵循 **denial-path regression** 模式 — 每个testing验证一个攻击向量被reject: 

```typescript
test("command executor blocks null-byte injection in path argument", async () => {
  // 1. 构建攻击输入
  const nullBytePath = "somefile\x00.txt";
  // 2. execute
  const result = await executor.execute({ ..., args: [nullBytePath] });
  // 3. assertionreject + 具体error码
  assert.equal(result.status, "blocked");
  assert.equal(result.error?.code, "sandbox.command_arg_path_denied");
});
```

---

## 5. Mock 与 Helper 工具箱

本项目 **不uses Sinon / testdouble**, 所有 mock via手写工厂函数implementation, concentrated在 `tests/helpers/`. 

### 5.1 工具清单

| file                     | 核心导出                                                                                                           | 用途                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `typed-factories.ts`     | `unsafeCast<T>()`, `partial<T>()`, `createMockCacheStore()`, `createMockCacheFacade()`, `createMockCacheMetrics()` | type安全 mock 对象创建              |
| `fixtures/base.ts`       | `createMinimalTask()`, `createMinimalExecution()`, `createMinimalApproval()`                                       | 最小有效领域record                    |
| `fixtures/composite.ts`  | `createBlockedTask()`, `createApprovalRequest()`, `createCompletedTask()`, `createFailedTask()`                    | 多实体关联场景                      |
| `env.ts`                 | `withEnv(overrides, fn)`, `withEnvSync(overrides, fn)`                                                             | 环境变量隔离                        |
| `fs.ts`                  | `createTempWorkspace()`, `cleanupPath()`, `createFile()`, `createSymlink()`                                        | 临时filesystem                        |
| `integration-context.ts` | `createIntegrationContext()`, `createSeededIntegrationContext()`                                                   | SQLite + TaskStore 集成上下文       |
| `repository-harness.ts`  | `createRepositoryHarness()`, `createRepositoryWithStoreHarness()`                                                  | 仓储层 DB testing                      |
| `e2e-harness.ts`         | `createE2EHarness()`, `createSeededE2EHarness()`                                                                   | 全栈 E2E 上下文                     |
| `golden.ts`              | `assertGolden()`, `assertGoldenContains()`, `assertGoldenMatches()`                                                | 快照assertion                            |
| `process-guard.ts`       | `createProcessGuard()`, `withProcessGuard()`                                                                       | 子processleaks检测 (ADR-072)            |
| `concurrent-runner.ts`   | `runConcurrentInvariant()`, `runConcurrentStateModification()`, `runCriticalSectionTest()`                         | concurrent不变量验证                      |
| `api.ts`                 | `createSeededApiContext()`                                                                                         | 完整 API 集成种子 (DB + 12 个服务)  |

### 5.2 `unsafeCast<T>()` 与 `partial<T>()`

`unsafeCast<T>()` 替代散落的 `as any`, 使其可search, 可审计: 

```typescript
import { unsafeCast } from "../../../helpers/typed-factories.js";

const fakeProvider = unsafeCast<LlmProvider>({
  generate: async () => ({ text: "mock response", tokens: 10 }),
});
```

`partial<T>()` used forconstructionpartialimplementation的interface对象 (type正确的 `Partial<T>`) : 

```typescript
import { partial } from "../../../helpers/typed-factories.js";

const config = partial<RuntimeConfig>({ maxRetries: 3, timeoutMs: 5000 });
```

### 5.3 Mock 创建模式

项目统一uses **对象literal量 + interfacetype** 的方式创建 mock: 

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

**不uses** `jest.fn()` / `sinon.stub()` — 如需recordcall, uses闭包array: 

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
// ... execute被测代码 ...
assert.equal(calls.length, 2);
assert.ok(calls[0]?.includes("started"));
```

### 5.4 环境变量隔离

`withEnv()` 在回调前保存原值, 回调后恢复 (即使throws异常) : 

```typescript
import { withEnv } from "../../../helpers/env.js";

test("respects AA_LOG_LEVEL env var", async () => {
  await withEnv({ AA_LOG_LEVEL: "debug" }, async () => {
    const config = loadConfig();
    assert.equal(config.logLevel, "debug");
  });
});
```

### 5.5 Harness 选择指南

| 场景             | uses                                                               |
| ---------------- | ------------------------------------------------------------------ |
| 纯逻辑 unit testing | directly `new Service()` + inline mock                                 |
| Repository testing  | `createRepositoryHarness()`                                        |
| 跨服务集成testing   | `createIntegrationContext()` 或 `createSeededIntegrationContext()` |
| API 端点testing     | `createSeededApiContext()` → `ctx.createServer()`                  |
| E2E 全流程       | `createE2EHarness()` 或 `createSeededE2EHarness()`                 |
| 子process相关       | `withProcessGuard(fn)` wrapped                                        |
| concurrent安全         | `runConcurrentInvariant()` / `runCriticalSectionTest()`            |

---

## 6. coverage率门禁机制

### 6.1 三层架构

```
c8 (V8 native) → generate-coverage-report.mjs → check-coverage-baseline.mjs
                                                          ↓
                                                 .coverage-baseline.json (棘轮)
```

### 6.2 c8 configure (`.c8rc.json`) 

| 参数       | 值                                         | 说明                                |
| ---------- | ------------------------------------------ | ----------------------------------- |
| `reporter` | `["text", "html", "lcov", "json-summary"]` | 四格式output                          |
| `include`  | `["dist/src/**/*.js"]`                     | only计量生产代码                      |
| `exclude`  | tests, scripts, configs, node_modules      | 排除非生产file                      |
| `all`      | `true`                                     | 未被testing加载的file也计入 (0% coverage)  |

### 6.3 棘轮基线 (`.coverage-baseline.json`) 

globally阈值 (v4.0 c8 实测data) : 

| 指标       | 当前实测  | v3.0 文档声称 | 说明                          |
| ---------- | --------- | ------------- | ----------------------------- |
| Lines      | **0.75%** | 82.4%         | 182,253 行中only 1,384 行被coverage |
| Statements | **0.75%** | 82.4%         | 同上                          |
| Functions  | **0.61%** | 88.5%         | 983 个函数中only 6 个被coverage     |
| Branches   | **0.61%** | 80.6%         | 同上                          |

> **v4.0 重大修正**: `.coverage-baseline.json` 当前所有值为 null (`directories: {}`) , 基线从未被真正填充. v3.0 文档声称的 82.4% 行coverage率经 c8 `all: true` fullanalysis验证为 **0.75%**. 实际被coverage的only有 `src/platform/five-plane-state-evidence/truth/sqlite/` 下 6 个 authoritative-task-store-delegating-\*.ts file (共 1,384 行, 均 100% coverage) . 其余 977 个源filecoverage率均为 0%. 这表明 v3.0 的coverage率data可能来自不完整的增量构建或已过时的报告. 
>
> **行动项**: 需要 (1) 运行完整 `npm test` + c8 fullcoverage率analysis, (2) 填充 `.coverage-baseline.json` 基线, (3) 在 CI 中启用coverage率门禁. 

**棘轮规则**: `check-coverage-baseline.mjs` 对比当前coverage率与基线: 

- 任何指标 **below** 基线 → CI failure (exit code 1) 
- 任何目录 **不在** 基线中 → CI failure (untracked directory) 
- coverage率 **提升** 后运行 `npm run coverage:baseline:update` 更新基线 → 新值成为新的下限
- **当前state**: 基线未填充, 门禁机制exists但未生效

### 6.4 目录级基线 (v4.0 c8 实测data) 

> **注意**: 以下data来自 `coverage/coverage-summary.json` c8 fullanalysis (`all: true`) . 由于 `.coverage-baseline.json` 未填充, 此处列出实际coveragestate. 

**有coverage的目录** (only 1 个目录有非零coverage) : 

| 目录                                        | file数 | 被coveragefile | Lines                | Functions |
| ------------------------------------------- | ------ | ---------- | -------------------- | --------- |
| `src/platform/five-plane-state-evidence/truth/sqlite/` | 25     | 6          | 1,384/36,219 (3.82%) | 6/167     |

被coverage的 6 个file (均 100%) : 

- `authoritative-task-store-delegating-governance.ts` (346 行) 
- `authoritative-task-store-delegating-engagement.ts` (345 行) 
- `authoritative-task-store-delegating-lifecycle.ts` (246 行) 
- `authoritative-task-store-delegating-base.ts` (224 行) 
- `authoritative-task-store-delegating-runtime.ts` (213 行) 
- `authoritative-task-store-delegating-core.ts` (10 行) 

**零coverage的主要目录** (按代码量sort, Top-15) : 

| 目录                                 | file数 | 总行数 | Lines coverage率 |
| ------------------------------------ | ------ | ------ | ------------ |
| `src/platform/five-plane-execution/`            | 162    | 43,202 | 0%           |
| `src/platform/shared/`               | 100    | 24,079 | 0%           |
| `src/platform/five-plane-control-plane/`        | 75     | 23,555 | 0%           |
| `src/platform/five-plane-orchestration/`        | 81     | 9,332  | 0%           |
| `src/platform/five-plane-interface/`            | 49     | 8,705  | 0%           |
| `src/scale-ecosystem/marketplace/`   | 26     | 7,737  | 0%           |
| `src/sdk/cli/`                       | 78     | 6,148  | 0%           |
| `src/platform/model-gateway/`        | 17     | 5,012  | 0%           |
| `src/platform/contracts/`            | 34     | 4,041  | 0%           |
| `src/domains/registry/`              | 14     | 2,456  | 0%           |
| `src/ops-maturity/drift-detection/`  | 15     | 2,271  | 0%           |
| `src/domains/governance/`            | 4      | 1,632  | 0%           |
| `src/platform/prompt-engine/`        | 9      | 1,432  | 0%           |
| `src/scale-ecosystem/feedback-loop/` | 7      | 578    | 0%           |
| `src/interaction/nl-gateway/`        | 4      | 549    | 0%           |

> **v4.0 说明**: v3.0 列出的高coverage目录 (如 execution/queue 99.7%, workflow-debugger 99.5%) 在 c8 fullanalysis中均为 0%. 这进一步confirmation v3.0 data来源不准确. 真正的coverage率提升需要确保 `npm run build:test` 编译所有源file和testingfile到 `dist/`, 然后由 c8 在运行testing时收集coverage率. 

### 6.5 更新流程

```bash
npm test                          # 运行完整testing
npm run coverage:baseline:update  # only在testing全via后execute
git diff .coverage-baseline.json  # confirmation变更合理
git add .coverage-baseline.json   # 提交新基线
```

## 7. testing无misses保障体系

本节是整个手册的核心方法论 — 回答 **"如何确保testing没有misses"** 这一问题. 体系由五层防护构成, 每层解决不同层面的missesrisk. 

### 7.1 五层防护模型

```
┌─────────────────────────────────────────────────────────┐
│ 第 5 层: PR Review Checklist (人工审查)                   │
├─────────────────────────────────────────────────────────┤
│ 第 4 层: 变异testing Stryker (assertion有效性验证)                │
├─────────────────────────────────────────────────────────┤
│ 第 3 层: coverage率棘轮 + 目录级基线 (数值不fallback)            │
├─────────────────────────────────────────────────────────┤
│ 第 2 层: Traceability Matrix (源file ↔ testingfile映射)     │
├─────────────────────────────────────────────────────────┤
│ 第 1 层: 分层testingstrategy (Unit / Integration / E2E)         │
└─────────────────────────────────────────────────────────┘
```

### 7.2 第 1 层: 分层testingstrategy

**解决的missestype**: testing粒度不当导致的盲区. 

每个功能点必须在正确的层级被testing: 

| 关注点                          | 正确的testing层                    | 反模式                           |
| ------------------------------- | ------------------------------- | -------------------------------- |
| 纯函数逻辑 (解析, validation, 转换)   | Unit                            | 用 E2E 测逻辑branch                |
| data库读写, transaction, 迁移          | Integration                     | 用 mock DB 掩盖 SQL error         |
| 多服务协作, 事件传播            | Integration                     | 每个服务单独 mock 后skip协作testing |
| 安全边界 (沙箱, path穿越)       | Integration                     | only靠 Unit 测 regex               |
| API 合约 (HTTP state码, response体)  | Integration / E2E               | 只测 service 层不测 HTTP 层      |
| 全流程业务场景                  | E2E                             | 无                               |
| output格式稳定性                  | Golden                          | 手写 expected 字符串             |
| concurrent安全                        | Integration + concurrent-runner | 单线程testing后假设线程安全         |

**execute规则**: 

1. 每个 `src/platform/<module>/` 目录必须有对应的 `tests/unit/platform/<module>/` 目录
2. 每个对外暴露的 service class 必须至少有 1 个 unit test file
3. 涉及 DB / filesystem / 子process的功能必须有 integration test
4. 安全相关变更必须有 denial-path regression test

### 7.3 第 2 层: Traceability Matrix (可追溯性矩阵) 

**解决的missestype**: 源file没有对应testingfile. 

构建 **源file → testingfile** 的映射关系, 确保每个生产file都有对应testing. 

**生成方法**: 

```bash
# step 1: 列出所有生产源file (排除 index.ts, types) 
find src/core -name "*.ts" ! -name "index.ts" ! -name "*.d.ts" ! -path "*/types/*" | sort > /tmp/src-files.txt

# step 2: 列出所有testingfile
find tests/unit tests/integration -name "*.test.ts" | sort > /tmp/test-files.txt

# step 3: 对比, 找出无testingcoverage的源file
while read src; do
  base=$(basename "$src" .ts)
  if ! grep -q "$base" /tmp/test-files.txt; then
    echo "UNCOVERED: $src"
  fi
done < /tmp/src-files.txt
```

**矩阵maintained规则**: 

- 每个 PR 中新增的 `.ts` 源file, 必须有对应的 `.test.ts` file
- 如果某个file确实无需testing (纯type定义, barrel export) , 在矩阵中标注 `N/A` + 理由
- 每个 sprint 结束时运行上述脚本, 更新misses清单

### 7.4 第 3 层: coverage率棘轮

**解决的missestype**: 已有testing被删除或新代码未被coverage. 

详见 [§6 coverage率门禁机制](#6-coverage率门禁机制). 关键点: 

- **globally门禁**: lines/statements/functions/branches 四维度
- **目录级门禁**: 每个 `src/platform/<module>` 有independent基线
- **`all: true`**: 未被任何testing import 的file也计入 (显示为 0% coverage) , 防止"没人references所以没人测"
- **只能上升**: 基线值via `npm run coverage:baseline:update` monotonic递增

**coverage率的局限性**: coverage率只说明"代码被execute了", 不说明"行为被验证了". 例如: 

```typescript
test("calls the function", () => {
  myFunction(); // 100% 行coverage, 但 0 个assertion
});
```

这就是为什么需要第 4 层. 

### 7.5 第 4 层: 变异testing

**解决的missestype**: testingexecute了代码但missing少有效assertion. 

Stryker 在代码中injection **变异体** (mutants) , 例如: 

- `>` 改为 `>=`
- `true` 改为 `false`
- 删除整条语句
- 字符串 `"error"` 改为 `""`

如果injection变异后testing仍然via (mutant survived) , 说明testing没有有效检测这段逻辑. 

详见 [§11 变异testing (Stryker) ](#11-变异testingstryker). 阈值: 

- **break = 50%**: below此值 CI directlyfailure
- **low = 60%**: 黄色警告
- **high = 80%**: 绿色目标

**变异testing与coverage率的互补关系**: 

| 场景         | 行coverage率 | 变异分数 | 问题     |
| ------------ | -------- | -------- | -------- |
| 有execute有assertion | 高       | 高       | 无       |
| 有execute无assertion | 高       | **低**   | assertionmissing |
| 无execute       | **低**   | 低       | testingmissing |
| Dead code    | 低       | 低       | 需removal   |

### 7.6 第 5 层: PR Review Checklist

**解决的missestype**: auto化工具无法检测的逻辑misses. 

每个 PR 合入前, reviewer 按以下清单check: 

- [ ] 新增/修改的每个 public function 是否有对应testing
- [ ] 是否coverage了正常path **和** errorpath
- [ ] 边界条件是否被testing (空array, null, 0, MAX_INT, timeout) 
- [ ] 安全变更是否有 denial-path regression
- [ ] 异步函数是否testing了 reject/error path
- [ ] configure变更是否有对应的 config validation testing
- [ ] coverage率是否提升或持平 (不下降) 
- [ ] 变异testing分数是否提升或持平

### 7.7 missestype分类与对应防护

| missestype         | 描述                          | 检测层                                          |
| ---------------- | ----------------------------- | ----------------------------------------------- |
| **file级misses**   | 整个源file没有testing            | 第 2 层 (Matrix) + 第 3 层 (`all: true`)        |
| **函数级misses**   | 某个 exported 函数没有testing    | 第 3 层 (function coverage) + 第 5 层 (Review)  |
| **branch级misses**   | if/else/switch 某个branch未coverage | 第 3 层 (branch coverage) + 第 4 层 (Stryker)   |
| **assertion级misses**   | 代码被execute但没有验证结果      | 第 4 层 (Stryker mutant survived)               |
| **场景级misses**   | missing少特定业务场景testing          | 第 5 层 (Review)                                |
| **边界条件misses** | 空输入/极值/concurrent未coverage        | 第 4 层 + 第 5 层                               |
| **回归misses**     | bug 修复没有添加回归testing      | 第 5 层 (Review) + 第 3 层 (棘轮不fallback)         |
| **安全misses**     | 攻击向量未testing                | 第 1 层 (denial-path 规范) + 第 5 层            |

### 7.8 testing补全优先级sort方法

当发现misses后, 按以下优先级sort补全: 

```
P0 — 安全边界未testing (sandbox escape, path穿越, injection攻击) 
P1 — 核心 orchestrator / service 无testing (coverage率 0%) 
P2 — 已有testing但 branch coverage < 60%
P3 — 已有testing但变异分数 < 50% (assertion不充分) 
P4 — 辅助函数 / 工具类missing少边界条件testing
P5 — type定义的 Schema 验证testing
```

### 7.9 持续保障流程

```
开发阶段 → 编写代码 + 编写testing (TDD 或 Code-then-Test) 
          ↓
local验证 → npm test (coverage率 + 门禁) 
          ↓
PR 提交  → CI auto运行: lint → typecheck → test → coverage:gate
          ↓
PR Review → 人工 Checklist (§7.6) 
          ↓
Main 合入 → Stryker 变异testing (push to main 触发) 
          ↓
Sprint 结束 → 运行 Traceability Matrix 脚本, 更新misses清单
```

---

## 8. 安全回归testing规范

### 8.1 Denial-Path Regression 方法论

安全testing的核心principle: **每个攻击向量一个testing, assertionrejectstate + 具体error码**. 

```
攻击面识别 → 构建malicious输入 → call被测interface → assertion blocked/denied + error code
```

### 8.2 攻击面分类

| 攻击面       | testing目标                   | 典型攻击向量                                           |
| ------------ | -------------------------- | ------------------------------------------------------ |
| **path穿越** | sandbox filesystem隔离       | `../`, symlink, double-encoded `%2f`, null-byte `\x00` |
| **命令injection** | command executor 参数filter  | `;`, `$()`, `` ` ``, `&&`, `\|\|`, `\|`, `${VAR}`      |
| **permissionsbypass** | execution-level tool authorization  | 修改 allowedToolsJson, malformed allowlist             |
| **脚本逃逸** | interpreter path limit      | 工作区外脚本path, 绝对path指向外部                     |
| **输入validation** | Schema / config validation | 超长字符串, type不匹配, missing必填field                   |
| **concurrent攻击** | lock和transaction隔离               | 同时审批同一request, concurrent写同一资源                       |

### 8.3 安全testing结构模板

```typescript
test("<组件> blocks <攻击type> <具体描述>", async () => {
  const workspace = createTempWorkspace("aa-security-");
  try {
    // 1. 构建攻击输入
    const maliciousInput = buildAttackPayload();

    // 2. execute被测interface
    const result = await targetService.execute({
      ...validBaseRequest,
      ...maliciousInput,
    });

    // 3. assertionreject
    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "specific.error_code");
  } finally {
    cleanupPath(workspace);
  }
});
```

### 8.4 安全testingnaming规范

标题必须明确说明 **谁reject了什么**: 

```
✓ "command executor blocks symlink cwd traversal before spawning the process"
✓ "command executor blocks null-byte injection in path argument"
✓ "sandbox policy denies write outside workspace root"
✗ "security test 1"
✗ "test injection"
```

### 8.5 安全testing必须coverage的场景

每个涉及安全边界的组件, 至少coverage以下场景: 

1. **正常合法request** — confirmation happy path 正常工作 (至少 1 个正向testing) 
2. **path逃逸** — 至少coverage `../`, symlink, 绝对path三种向量
3. **输入injection** — 至少coverage shell metachar, null-byte 两种向量
4. **permissions不足** — 未authorization tool, error domain/role
5. **畸形输入** — malformed JSON, type mismatch, 空值
6. **Fail-close** — 当安全check逻辑本身出错时, defaultreject而非放行

---

## 9. Golden / Snapshot testing

### 9.1 适用场景

Golden testing适used for **output格式需要稳定** 的场景: 

- CLI output格式 (`inspect`, `doctor`, `dispatch-execution` 命令output) 
- API response体结构
- configurefile生成结果
- log格式

### 9.2 工作原理

```
首次运行 (UPDATE_GOLDEN=1) → 将实际output写入 tests/golden/snapshots/<name>.golden
subsequent运行 → 将实际output与 .golden file对比
  匹配 → testingvia
  不匹配 → testingfailure, 提示运行 UPDATE_GOLDEN=1 更新
```

### 9.3 uses方法

```typescript
import test from "node:test";
import { assertGolden } from "../../helpers/golden.js";

test("inspect output matches golden snapshot", () => {
  const output = inspectService.generateReport();
  assertGolden("inspect-report-v1", output);
});
```

三种assertion API: 

| API                                     | 用途          |
| --------------------------------------- | ------------- |
| `assertGolden(name, actual)`            | JSON 完全匹配 |
| `assertGoldenContains(name, substring)` | contains子串      |
| `assertGoldenMatches(name, regex)`      | regex匹配      |

### 9.4 更新快照

```bash
UPDATE_GOLDEN=1 npm run test:golden
git diff tests/golden/snapshots/       # Review 变更
git add tests/golden/snapshots/
```

### 9.5 Golden testing注意事项

- **不要** 在 golden file中contains时间戳, 随机 ID 等不稳定field — 先 normalize 再 snapshot
- 快照file必须纳入 git 版本manage
- Golden filenaminguses版本后缀 (`-v1`, `-v2`) , 当output格式有意变更时创建新版本

---

## 10. 性能基准testing

### 10.1 适用场景

- 关键path延迟回归检测
- 吞吐量基准 (tasks/sec, queries/sec) 
- in-memoryuses基准

### 10.2 testing位置

`tests/performance/` 目录, file名 `*.test.ts`, via `npm run test:performance` 运行. 

### 10.3 编写模式

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

### 10.4 性能testingprinciple

- **隔离运行**: `npm run test:performance` independent于主testing套件, 避免干扰coverage率
- **绝对阈值**: assertion绝对性能指标 (如 >1000 ops/sec) , 而非相对changes
- **预热**: 在计时前execute少量预热迭代, 排除 JIT 编译影响
- **多次取中位数**: 对延迟敏感testing取多次运行中位数, 减少方差
- **CI 中可选**: 性能testing在 CI 中作为 optional job, 不blocks合入 (因机器差异大) 

---

## 11. 变异testing (Stryker) 

### 11.1 概念

变异testing回答coverage率无法回答的问题: **testing的assertion是否真正有效? **

Stryker 对源代码injection微小变异 (mutant) , 然后运行testing套件. 如果testing仍然via (mutant survived) , 说明没有assertion能检测到这个代码changes — 即existsassertionmissing. 

### 11.2 configure (`stryker.config.mjs`) 

| 参数               | 值                              | 说明                          |
| ------------------ | ------------------------------- | ----------------------------- |
| `testRunner`       | `"command"`                     | via `npm run test:unit` 运行 |
| `mutate`           | `src/platform/**/*.ts`          | 变异range: platform 业务代码   |
| 排除               | `.d.ts`, `index.ts`, `types/**` | 不变异type定义和 barrel       |
| `thresholds.break` | 50                              | below 50% → CI failure            |
| `thresholds.low`   | 60                              | below 60% → 黄色警告           |
| `thresholds.high`  | 80                              | 高于 80% → 绿色               |
| `coverageAnalysis` | `"perTest"`                     | 每个testing单独analysiscoveragerange      |

### 11.3 运行

```bash
npm run test:mutation         # local运行
# CI 中only在 push to main 时运行 (耗时较长) 
```

报告output到 `reports/mutation/`, contains HTML 可视化报告. 

### 11.4 解读报告

| state              | 含义                     | 行动               |
| ----------------- | ------------------------ | ------------------ |
| **Killed**        | testing检测到变异并failure     | 无需行动           |
| **Survived**      | 变异后testing仍via         | **需添加更强assertion** |
| **No coverage**   | 变异代码未被任何testingexecute | 需添加testing         |
| **Timeout**       | 变异导致无限循环/timeout    | 视为 killed        |
| **Runtime error** | 变异导致runtimecrashed       | 视为 killed        |

### 11.5 handle Survived Mutants

```typescript
// 假设 Stryker 报告: 将 `>` 变异为 `>=` 后 mutant survived
// 原始代码: if (retries > maxRetries) throw new Error("exceeded");

// 说明missing少边界testing. 需添加: 
test("throws when retries equals maxRetries", () => {
  // testing retries === maxRetries 的行为
  // 如果应该throws, 添加 assert.throws
  // 如果不应该throws, 添加 assert.doesNotThrow
});
```

### 11.6 变异testing与其他层的协作

- **coverage率**告诉你"哪些代码没被execute" → 添加testing
- **Stryker**告诉你"哪些代码被execute了但assertion不足" → 加强assertion
- 两者互补, 不可替代

---

## 12. CI 集成与工作流

### 12.1 CI Pipeline 架构

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

其他工作流file:

- `deploy-environment.yml` — 环境部署
- `dr-validation.yml` — 灾备验证
- `publish-image.yml` — 镜像发布
- `secret-provider-integration.yml` — 密钥提供者集成testing

### 12.2 触发条件

| Job            | Push to main | PR  | 其他            |
| -------------- | ------------ | --- | --------------- |
| validate       | ✓            | ✓   | `codex/**` branch |
| pg-integration | ✓            | ✓   | —               |
| mutation-test  | ✓            | ✗   | only main         |
| security       | ✓            | ✓   | —               |
| trivy-scan     | ✓            | ✓   | —               |

### 12.3 CI 中的testing保障点

| 保障点       | 工具                        | failure条件           |
| ------------ | --------------------------- | ------------------ |
| 代码风格     | ESLint                      | 任何 lint error    |
| type安全     | tsc --noEmit                | 任何 type error    |
| dependency安全     | npm audit                   | HIGH/CRITICAL 漏洞 |
| 功能正确     | node --test                 | 任何testingfailure       |
| coverage率不fallback | check-coverage-baseline.mjs | below基线           |
| 变异分数     | Stryker                     | below break=50%     |
| staticanalysis     | CodeQL                      | 发现安全missing陷       |
| 容器安全     | Trivy                       | CRITICAL/HIGH 漏洞 |

### 12.4 testing结果归档

CI auto上传以下 artifacts: 

- `test-results/` — testingexecutelog
- `coverage/` — HTML coverage率报告
- `reports/mutation/` — Stryker HTML 报告

---

## 13. 新moduletesting Checklist

当创建新module时, 按以下 Checklist 确保testing完备: 

### 13.1 目录与file

- [ ] 创建 `tests/unit/platform/<module>/` 或 `tests/unit/<area>/<module>/` 目录
- [ ] 每个 service class 创建对应 `<service-name>.test.ts`
- [ ] 如需 DB → 创建 `tests/integration/platform/<module>/` 目录

### 13.2 testing层次

- [ ] **Unit testing**: 每个 exported function / class method
  - [ ] Happy path (正常输入 → 预期output) 
  - [ ] Error path (非法输入 → 预期异常/error码) 
  - [ ] 边界条件 (空值, 零值, 极大值, 空array) 
- [ ] **Schema testing** (如uses Zod) : 
  - [ ] 合法 minimal payload → `doesNotThrow`
  - [ ] 非法 payload → `throws`
  - [ ] 可选fieldmissing → `doesNotThrow`
- [ ] **Integration testing** (如涉及 DB/file/子process) : 
  - [ ] uses `createIntegrationContext()` 或 `createRepositoryHarness()`
  - [ ] `try/finally` 确保cleanup
- [ ] **安全testing** (如涉及安全边界) : 
  - [ ] Denial-path regression coverage各攻击向量
  - [ ] Fail-close testing

### 13.3 coverage率

- [ ] local运行 `npm test` confirmationcoverage率不belowglobally基线
- [ ] 运行 `npm run coverage:baseline:update` 更新基线
- [ ] confirmation新目录出现在 `.coverage-baseline.json` 中

### 13.4 变异testing

- [ ] confirmation新modulepath在 `stryker.config.mjs` 的 `mutate` glob range内
- [ ] local运行 `npm run test:mutation` confirmation无大量 survived mutants

### 13.5 CI compatibility

- [ ] testing在 Node 22 基线下via
- [ ] testing支持 `--test-concurrency=12` parallel运行, 无sharedstateconflict
- [ ] 无hardcoded绝对path, 端口号, 时间戳

### 13.6 文档

- [ ] 在 Traceability Matrix (§7.3) 中更新源file ↔ testingfile映射
- [ ] 如引入新的 Helper / Fixture, 更新 §5 工具清单

---

---

---

# Part II — 架构语义coverage (v1.1 新增, v1.2 增补, v3.0 扩展) 

> Part I 解决的是"代码coverage治理" — 确保每行代码被execute, 每个assertion有效. 
> Part II 解决的是"架构语义coverage" — 确保system关键设计语义 (state机, 事件, concurrent, 阶段contract) 都被testingcoverage到. 

---

## 14. state机testing规范

### 14.1 为什么需要单独规范

本systemcontains **5 个核心state机** (Task / Workflow / Session / Execution / Approval) 和 **40+ 辅助生命周期枚举** (Worker, Plugin, Rollout, Circuit Breaker, Lease, Repair Pipeline 等) . 

普通 line/branch coverage 无法保证: 

- 每个合法state转换被testing
- 每个非法state转换被reject
- 终态不可再转移
- 跨实体级联转换的atomicity

### 14.2 核心state机清单

| state机        | 定义file                                           | 验证file                                                        | state数 | 终态                                     |
| ------------- | -------------------------------------------------- | --------------------------------------------------------------- | ------ | ---------------------------------------- |
| **Task**      | `src/platform/five-plane-execution/state-transition/types.ts` | `src/platform/five-plane-execution/state-transition/transition-service.ts` | 7      | done, failed, cancelled                  |
| **Workflow**  | 同上                                               | 同上                                                            | 7      | completed, failed, cancelled             |
| **Session**   | 同上                                               | 同上                                                            | 7      | completed, failed, cancelled             |
| **Execution** | 同上                                               | 同上                                                            | 8      | succeeded, failed, cancelled, superseded |
| **Approval**  | 同上                                               | 同上                                                            | 5      | approved, rejected, expired, cancelled   |

这 5 个state机via `StateTransitionMachine<T>` 泛型类implementation, `assertTransition()` 方法用 CAS 防止concurrent覆写. 

### 14.3 state机testing三层要求

#### A. 合法转换全coverage (Transition Coverage) 

每个state机的 **每条合法转换边** 必须有至少一个testing: 

```typescript
test("task transition: queued -> in_progress is allowed", () => {
  assert.doesNotThrow(() =>
    taskStateMachine.assertTransition("queued", "in_progress"),
  );
});
```

**量化标准**: 合法边coverage率 = 已测合法边数 / 总合法边数 = **100%**

Task state机合法边列表 (示例) : 

```
queued → pending, in_progress, cancelled
pending → in_progress, cancelled
in_progress → awaiting_decision, done, failed, cancelled
awaiting_decision → in_progress, failed, cancelled
```

#### B. 非法转换全reject (Denial Coverage) 

**每个终态** 向任何非自身state的转换必须被rejecttesting: 

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

**量化标准**: 所有终态 × 所有非自身state = 必须testingreject

#### C. 跨实体级联转换 (Cascade Coverage) 

`TransitionService` 提供 `applyTaskTerminalState` 和 `ApprovalBlockingTransitionService`, 会atomicity地级联转换多个实体. 

必须testing的级联场景: 

| 触发             | Task              | Workflow  | Session       | Execution | Approval  |
| ---------------- | ----------------- | --------- | ------------- | --------- | --------- |
| task → done      | done              | completed | completed     | succeeded | —         |
| task → failed    | failed            | failed    | failed        | failed    | —         |
| task → cancelled | cancelled         | cancelled | cancelled     | cancelled | —         |
| approval needed  | awaiting_decision | paused    | awaiting_user | blocked   | requested |
| approval granted | in_progress       | running   | streaming     | executing | approved  |

### 14.4 辅助state机testing要求

对于非核心state机 (Circuit Breaker, Rollout, Repair Pipeline, Plugin 等) , 要求: 

| 类别                           | 要求                                  |
| ------------------------------ | ------------------------------------- |
| 有 `assertTransition()` 验证的 | 同核心三层要求                        |
| 有 `transitionTo()` 无验证的   | 至少coverage happy path + terminal states |
| only作为枚举值的                 | coverage每个枚举值至少出现在一个testing中    |

### 14.5 Circuit Breaker state机特殊要求

Circuit Breaker (`closed → open → half_open → closed`) 涉及时间和计数, 需额外testing: 

- [ ] 连续failure ≥ threshold → 触发 open
- [ ] failure率 ≥ 50% → 触发 open
- [ ] open state下request被reject + return `retryAfterMs`
- [ ] resetTimeoutMs 过后 → 转为 half_open
- [ ] half_open 单次探测success / failure的行为
- [ ] 连续success ≥ halfOpenSuccessThreshold → 恢复 closed

### 14.6 Transition Table 唯一源规则

**硬性要求**: `transition-service.ts` 中的 canonical transition map 是state迁移的 **唯一权威源**. testing用例 **禁止** 手动hardcoded一份副本 transition table. 

#### A. principle

| 条目     | 规则                                                                                 |
| -------- | ------------------------------------------------------------------------------------ |
| 唯一源   | 所有合法/非法迁移判断必须来自 `TransitionService` 的 production map                  |
| 禁止副本 | testing中不得出现 `const allowedTransitions = { pending: ["running", ...] }` 等手写副本 |
| data驱动 | testing矩阵必须从 production map **auto生成**, 而非手动枚举                             |
| synchronous保障 | 若 production map 新增/删除迁移, testingauto感知, 无需人工synchronous                          |

#### B. data驱动testing生成模板

```typescript
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  TRANSITION_MAP,
  ALL_STATES,
} from "../../src/platform/five-plane-execution/state-transition/types.js";

// 从 production map auto生成合法迁移对
const validPairs: Array<[string, string]> = [];
for (const [from, toSet] of Object.entries(TRANSITION_MAP)) {
  for (const to of toSet) {
    validPairs.push([from, to]);
  }
}

// auto生成非法迁移对 (全排列 - 合法对 - 自迁移) 
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

#### C. CI 守护

- Coverage gate 新增check: testingfile中若出现与 `TRANSITION_MAP` 键名集合相同的hardcoded对象literal量, CI 报 warning
- PR Review checklist 中增加一条: "state机testing是否从 production map auto派生? "

---

## 15. 事件驱动testing规范

### 15.1 事件system架构

```
Producer → TypedEventBus → DurableEventBus → SQLite
                                              ↓
                            EventOpsService → deliverPending() → Consumer
                                              ↓ (3次重试后)
                                         Dead Letter Table
```

本system定义了 **48 种 typed event**, 分为 3 个 Tier: 

| Tier       | 语义                  | Ack 要求 | 事件数 | 示例                                            |
| ---------- | --------------------- | -------- | ------ | ----------------------------------------------- |
| **Tier 1** | 必须persistence + 必须 ack | 必须     | 9      | `task:status_changed`, `decision:requested`     |
| **Tier 2** | persistence, ack 可选      | 推荐     | ~35    | `dispatch:*`, `worker:*`, `plugin:*`, `skill:*` |
| **Tier 3** | 尽力投递              | 无       | ~4     | `stream:chunk_emitted`, `perf:*`                |

### 15.2 按 Tier 分级testing要求

#### Tier 1 事件 (9 种) — 最高testing要求

每种 Tier 1 事件必须coverage完整生命周期: 

| 阶段            | testingcontent                                       |
| --------------- | ---------------------------------------------- |
| **Schema**      | payload 满足 Zod validator (valid + invalid)   |
| **Publish**     | 正确写入 events 表 + 创建 ack record             |
| **Deliver**     | `deliverPending()` 将事件投递到注册 consumer   |
| **Ack**         | consumer handlesuccess → ack status = `"acked"`     |
| **Retry**       | consumer handlefailure → 指数backoff重试 (100ms → 5s)  |
| **Dead Letter** | 3 次重试failure → 写入 dead_letter 表             |
| **Replay**      | `EventOpsService.replayConsumer()` 重新投递    |
| **Integrity**   | SHA-256 hash chain 未被tamper                    |

#### Tier 2 事件 — 中等testing要求

| 阶段            | testingcontent                             |
| --------------- | ------------------------------------ |
| **Schema**      | payload 满足 Zod validator           |
| **Publish**     | 正确写入 events 表                   |
| **Deliver**     | 至少一个 consumer 能收到             |
| **Idempotency** | 带 `idempotencyKey` 的事件不duplicate消费 |

#### Tier 3 事件 — 基本testing要求

| 阶段            | testingcontent                    |
| --------------- | --------------------------- |
| **Publish**     | 不throws异常                  |
| **Best-effort** | consumer 不在线时事件不blocks |

### 15.3 DLQ testing要求

system有 **3 套independent DLQ**: 

| DLQ         | 位置                                | testing重点                                                    |
| ----------- | ----------------------------------- | ----------------------------------------------------------- |
| Event DLQ   | `event_dead_letters` 表             | 3 次重试后正确入 DLQ + `dlq-manager list` 可查              |
| Gateway DLQ | `gateway_dead_letters` 表           | 非 retryable state码directly入 DLQ, retryable state码重试后入 DLQ |
| Jobs DLQ    | `queue_jobs.status = "dead_letter"` | 超过 `maxAttempts` 后入 DLQ                                 |

每套 DLQ 必须testing: 

- [ ] 正确条件下消息进入 DLQ
- [ ] DLQ 消息可query (list / count) 
- [ ] DLQ 消息可clear (purge) 
- [ ] 可重试的 DLQ 消息能重新入队

### 15.4 Event Schema Drift 回归

`event-registry.ts` 中的 `RAW_EVENT_SCHEMA_REGISTRY` 定义了所有事件的 schema: 

```typescript
test("all TypedEventPayloadMap keys are registered in EVENT_SCHEMA_REGISTRY", () => {
  // 编译时已有 MissingTypedEventDefinitions typecheck
  // runtime补充验证
  for (const eventType of Object.keys(TypedEventPayloadMap)) {
    assert.ok(hasEventSchema(eventType), `Missing schema for ${eventType}`);
  }
});
```

### 15.5 Consumer 注册integrity

每种 Tier 1 事件在 `REQUIRED_CONSUMERS_BY_EVENT_TYPE` 中有指定 consumer. testing必须验证: 

```typescript
test("all Tier 1 events have at least one required consumer", () => {
  for (const eventType of TIER_1_EVENT_TYPES) {
    const consumers = getRequiredConsumers(eventType);
    assert.ok(consumers.length > 0, `${eventType} has no required consumers`);
  }
});
```

### 15.6 Consumer 副作用幂等性 (硬性要求) 

所有 **可重试 consumer** (Tier 1 必须重试, Tier 2 推荐重试) 必须via幂等性testing. duplicate消费同一条事件 **不得** 产生: 

| 禁止行为            | 验证方法                                                      |
| ------------------- | ------------------------------------------------------------- |
| duplicate DB 写入        | 同一事件投递 2 次后, 相关表行数不变                           |
| duplicatenotification / 外发消息 | mock notification channel, assertioncall次数 = 1                   |
| duplicate下游副作用      | mock downstream service, assertion幂等 key 被deduplication                  |
| state机duplicate迁移      | 第二次投递不触发 `assertTransition()` (state已在终态或目标态)  |

#### 幂等性testing模板

```typescript
test("consumer handles duplicate delivery idempotently", async () => {
  const event = buildEvent("task.completed", { taskId: "t-1" });
  const db = await createTestDb();
  const notifier = { send: mock.fn() };

  // 首次消费
  await consumer.handle(event, { db, notifier });
  const rowsAfterFirst = await db.count("task_completions");
  assert.equal(notifier.send.mock.calls.length, 1);

  // duplicate消费 (模拟 retry / at-least-once 投递) 
  await consumer.handle(event, { db, notifier });
  const rowsAfterSecond = await db.count("task_completions");

  // assertion无副作用duplicate
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

#### 适用range

- 所有 `REQUIRED_CONSUMERS_BY_EVENT_TYPE` 注册的 consumer
- 所有implementation了 `onEvent()` / `handleEvent()` interface的 handler
- Gateway DLQ replay consumer

---

## 16. OAPEFLIR 阶段coverage矩阵

### 16.1 coverage矩阵定义

不按目录, 不按file, 而是按 **OAPEFLIR 8 个阶段的设计语义** 定义最小testing集. 

每个阶段必须coverage **7 条标准path**: 

| path编号 | path名                            | 描述                                                  |
| -------- | --------------------------------- | ----------------------------------------------------- |
| P1       | **Happy Path**                    | 标准输入 → 阶段完成 → 产出正确                        |
| P2       | **Degraded Path**                 | partial输入missing/质量不足 → 降级handle → 产出带警告         |
| P3       | **Invalid Input Path**            | 非法/畸形输入 → reject或 fail-fast                      |
| P4       | **Timeout Path**                  | 阶段executetimeout → 正确中止 + 资源cleanup                    |
| P5       | **Skip Path**                     | 阶段被skip (条件不满足)  → stage status = `"skipped"` |
| P6       | **Downstream Contract Violation** | 上游产出不满足当前阶段输入contract → reject或fallback           |
| P7       | **Human Intervention Path**       | 阶段需要人工介入 → 暂停等待审批/confirmation → 恢复或终止     |

### 16.2 逐阶段coverage矩阵

#### Observe (观察) 

| path | testing场景                          | assertion重点                                                 |
| ---- | --------------------------------- | -------------------------------------------------------- |
| P1   | 标准task输入 → 生成 TaskSituation | `objective`, `currentPhase`, `codebaseSnapshot` field完整 |
| P2   | 空 codebase / 无 fileRefs         | TaskSituation 仍可生成, `fileRefs: []`                   |
| P3   | 非法 taskId / 空 objective        | Schema reject                                              |
| P4   | 采集timeout                          | timeout中止 + return已有快照                                  |
| P5   | 输入已cached / 无变更               | skip重新采集                                             |
| P6   | —                                 | 作为第一阶段无上游                                       |
| P7   | task需人工confirmationrange                | 暂停采集 → 等待人工confirmation → 恢复后继续                     |

#### Assess (评估) 

| path | testing场景                               | assertion重点                                                      |
| ---- | -------------------------------------- | ------------------------------------------------------------- |
| P1   | 标准 TaskSituation → UnifiedAssessment | complexity / risk / routingDecision / resourceAllocation 合理 |
| P2   | 高不确定性task                         | 正确升级 executionMode 为 `"supervised"`                      |
| P3   | 畸形 situationRef                      | Schema reject                                                   |
| P4   | 评估timeout                               | 降级到default assessment                                         |
| P5   | 简单taskskip深度评估                   | directlyuses快速评估path                                          |
| P6   | TaskSituation missing少必填field             | reject + fallback到 Observe                                         |
| P7   | 高不确定性 → 需人工监督                | executionMode 升级为 `"supervised"`, 等待审批后继续           |

#### Plan (规划) 

| path | testing场景                          | assertion重点                                                |
| ---- | --------------------------------- | ------------------------------------------------------- |
| P1   | 标准 assessment → Plan with steps | stepId 唯一, dependencies 合法, strategy 正确           |
| P2   | 高复杂度task                      | 多step DAG + parallelstep                                   |
| P3   | version = 0 / steps 为空          | Schema reject                                             |
| P4   | 规划timeout                          | return最小可行 plan                                       |
| P5   | 评估结果表明无需规划              | stage skipped                                           |
| P6   | AssessmentRef 不exists              | reject                                                    |
| P7   | 高riskplan需人工审核              | plan status = `"pending_approval"` → 审批via后开始execute |

#### Execute (execute) 

| path | testing场景                         | assertion重点                                               |
| ---- | -------------------------------- | ------------------------------------------------------ |
| P1   | 单步execute → DualChannelStepOutput | userFacingResult + systemTelemetry 完整                |
| P2   | partialstepfailure → partial success   | successstep的产出被保留                                   |
| P3   | 非法 tool call / sandbox reject    | `status: "blocked"` + error码                           |
| P4   | steptimeout                         | step标记 `"failed"` + `code: "tool.timeout"`           |
| P5   | 所有step已完成 (replay)          | skip                                                   |
| P6   | Plan 中stepreferences不exists的 tool     | reject + fallback到 Plan                                     |
| P7   | step触发审批blocks                 | `status: "blocked_awaiting_approval"` → 审批后恢复execute |

#### Feedback (反馈) 

| path | testing场景                       | assertion重点                                        |
| ---- | ------------------------------ | ----------------------------------------------- |
| P1   | execute结果 → FeedbackSignal 集合 | signal 正确分类 (success/failure/correction)    |
| P2   | duplicate signal                    | deduplication 生效                              |
| P3   | 空 signal 列表                 | return空集, 不报错                                |
| P4   | 信号采集timeout                   | return已收集partial                                  |
| P5   | 无execute产出                     | skip反馈                                        |
| P6   | stepOutputRefs references不exists      | 忽略 + 警告                                     |
| P7   | 反馈结果需人工confirmation准确性       | signal 标记 `"pending_review"` → 人工confirmation后生效 |

#### Learn (学习) 

| path | testing场景                                                         | assertion重点                                              |
| ---- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| P1   | 反馈信号 → LearningSignal (failure_pattern / recovery_playbook)  | learningType + sourceSignalIds 正确                   |
| P2   | 低置信度模式                                                     | 标记为 tentative                                      |
| P3   | 非法 learningType                                                | reject                                                  |
| P4   | 挖掘timeout                                                         | return空                                                |
| P5   | 无 failure 信号                                                  | skip学习                                              |
| P6   | FeedbackSignal 结构不完整                                        | reject                                                  |
| P7   | 学习结论需专家审核                                               | learning 标记 `"expert_review_required"` → 审核后录入 |

#### Improve (改进) 

| path | testing场景                                                       | assertion重点                                         |
| ---- | -------------------------------------------------------------- | ------------------------------------------------ |
| P1   | 学习产出 → ImprovementCandidate (status: proposed → approved)  | changeScope + expectedBenefit 合理               |
| P2   | 改进超出自治边界                                               | status 停留在 `"proposed"`, 需人工审批           |
| P3   | 空学习产出                                                     | 不产生 candidate                                 |
| P4   | 评估timeout                                                       | candidate 标记 `"rejected"`                      |
| P5   | 无可改进项                                                     | skip                                             |
| P6   | LearningSignal references非法 sourceSignalRefs                       | reject                                             |
| P7   | 改进超出自治边界 → 需人工审批                                  | candidate 停留在 `"proposed"` → 审批后推进或驳回 |

#### Release (发布/Rollout) 

| path | testing场景                                                        | assertion重点                                                   |
| ---- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| P1   | approved candidate → RolloutRecord (shadow → suggest → stable)  | level 正确递进                                             |
| P2   | metrics gate 未via                                             | 停留在当前 level                                           |
| P3   | 非法 candidateId                                                | reject                                                       |
| P4   | rollout timeout                                                    | auto rollback                                              |
| P5   | candidate 被 rejected                                           | skip rollout                                               |
| P6   | candidate references已expiry的 evidence                                 | reject + 重新评估                                            |
| P7   | rollout 需人工审批放行                                          | rollout 停留在 `"pending_approval"` → 审批后继续推进 level |

### 16.3 coverage率量化

```
OAPEFLIR 阶段coverage率 = (已测path数) / (8 阶段 × 7 path = 56) × 100%
```

**目标**: ≥ 85% (至少 48/56 条path有testing) 

### 16.4 OAPEFLIR-Harness 语义映射 (v3.0 新增) 

> 对应架构审查 v6.0 missing口 I-2 (§13.5 OAPEFLIR-Harness 外部语义映射) 

架构设计 §13.5 要求 OAPEFLIR 8 阶段与 Harness 三角色 (Planner / Generator / Evaluator) 之间建立explicitly语义映射. 此映射尚未代码化 (missing口 I-2) , 但testing应提前定义预期映射: 

| OAPEFLIR 阶段 | Harness 角色      | 映射语义                                |
| ------------- | ----------------- | --------------------------------------- |
| Observe       | —                 | 外部输入采集, 不进入 Harness 循环       |
| Assess        | Planner           | task评估 → PlanBundle 输入              |
| Plan          | Planner           | 生成 PlanBundle (stepId/DAG/tools)      |
| Execute       | Generator         | 生成 WorkProduct (代码/文档/操作)       |
| Feedback      | Evaluator         | 生成 EvaluationReport (pass/fail)       |
| Learn         | Evaluator         | 从 EvaluationReport 提取 LearningSignal |
| Improve       | Planner+Evaluator | 改进候选评估 + 批准                     |
| Release       | —                 | Rollout 控制, 不directly参与 Harness 循环   |

**testing要求**: 当missing口 I-2 implementation后, 需验证: 

- [ ] 映射configureexists且contains全部 8 阶段
- [ ] Planner 角色coverage Assess/Plan/Improve 三阶段
- [ ] Generator 角色coverage Execute 阶段
- [ ] Evaluator 角色coverage Feedback/Learn/Improve 三阶段
- [ ] Observe 和 Release 标记为外部阶段, 不进入 Harness 循环

---

## 17. concurrent与时序testing规范

### 17.1 必须做concurrenttesting的module

| module                                           | concurrentrisk                      | testingtype                |
| ---------------------------------------------- | ----------------------------- | ----------------------- |
| `execution-lease-service`                      | 竞争获取 lease                | Race Test + Idempotency |
| `execution-dispatch-service`                   | concurrent dispatch 同一 ticket     | Race Test               |
| `execution-worker-handshake-service`           | concurrent claim 同一 execution     | Race Test               |
| `distributed-lock-adapter` (SQLite/Redis/PG)   | 竞争获取lock                    | Critical Section Test   |
| `durable-event-bus`                            | concurrent publish + deliverPending | Race Test               |
| `approval-service`                             | concurrent审批同一request              | Idempotency Test        |
| `sqlite-queue-adapter` / `redis-queue-adapter` | concurrent enqueue + dequeue        | Race Test + Idempotency |
| `circuit-breaker`                              | concurrentrequest触发state转换          | Race Test               |
| `transition-service`                           | concurrentstate转换 (CAS)            | Race Test               |
| `channel-gateway-retry-executor`               | overlap polling pass             | Non-overlap Test        |

### 17.2 testingtype定义

#### Race Test

验证concurrent操作不会导致datacorrupted或不变量violates: 

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

验证duplicate操作产生相同结果: 

```typescript
test("duplicate enqueue with same idempotency key returns existing job", async () => {
  const job1 = queue.enqueue({ data: "test", idempotencyKey: "key-1" });
  const job2 = queue.enqueue({ data: "test", idempotencyKey: "key-1" });
  assert.equal(job1.id, job2.id);
});
```

#### Critical Section Test

验证互斥区只allows一个 worker 进入: 

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

验证timeout后资源被正确释放: 

```typescript
test("expired lease is reclaimed and execution can be re-dispatched", async () => {
  // 1. 获取 lease
  await leaseService.acquireLease({
    executionId: "e1",
    workerId: "w1",
    ttlMs: 100,
  });
  // 2. 等待expiry
  await new Promise((r) => setTimeout(r, 200));
  // 3. 回收
  const reclaimed = await leaseService.reclaimExpiredLeases();
  assert.equal(reclaimed.length, 1);
  // 4. 新 worker 可获取
  const result = await leaseService.acquireLease({
    executionId: "e1",
    workerId: "w2",
    ttlMs: 30000,
  });
  assert.equal(result.decision, "granted");
});
```

#### Crash Consistency Test

利用 `WorkflowCrashSimulator` 验证crashed恢复: 

```typescript
test("recovery repairs partial commit after crash at step_started", async () => {
  // injectioncrashed点
  process.env.AA_WORKFLOW_CRASH_POINT = "step_started";
  try {
    await executeWorkflow(...);
  } catch (e) {
    assert.ok(e instanceof InjectedWorkflowCrashError);
  }
  // 验证恢复
  const repairs = await repairService.repair();
  assert.ok(repairs.length > 0);
  // 验证data一致性
  const execution = store.getExecution("e1");
  assert.notEqual(execution.status, "executing"); // 不应停留在中间态
});
```

### 17.3 concurrenttesting量化标准

| module类别 | 最低concurrent度 | 必须coverage                        |
| -------- | ---------- | ------------------------------- |
| lock/lease | 10 workers | acquire/release/extend/steal    |
| 队列     | 20 workers | enqueue/dequeue/ack/dead-letter |
| state转换 | 5 workers  | CAS 竞争 + 终态幂等             |
| 事件投递 | 10 workers | publish + consumer ack          |
| Dispatch | 5 workers  | ticket claim + handshake        |

### 17.4 Stale Write Prevention testing

`ExecutionLeaseService.validateWriteAccess()` 是防止脏写的最后防线, 必须coverage全部 5 种reject原因: 

- [ ] `lease_not_found` — execution 无 lease record
- [ ] `no_active_lease` — lease 已expiry/释放
- [ ] `stale_fencing_token` — fencing token 不匹配 (旧 worker 写入) 
- [ ] `worker_mismatch` — request worker 不是 lease 持有者
- [ ] `lease_mismatch` — lease ID 不匹配

### 17.5 时间控制strategy

concurrent和时序testing中最常见的 flaky Root cause: 对真实时间的dependency. 本节规定统一的时间控制分层strategy. 

#### A. 三层时间控制

| 层级              | 适用场景                                | strategy                                                                       | 示例                                                  |
| ----------------- | --------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| L1 — 可控clock     | Unit testing中涉及timeout, TTL, 间隔的逻辑    | injection `Clock` interface, testing传入 `FakeClock`, 手动推进时间                      | lease expiry, circuit breaker resetTimeout, retry delay |
| L2 — 有界真实时间 | Integration testing需要真实异步/定时器交互 | allows `setTimeout` / `setInterval`, 但单次 sleep ≤ 500ms, 单测总 sleep ≤ 2s | 队列投递后等待 consumer 消费                          |
| L3 — 禁止无界等待 | 所有testing                                | 禁止 `while(true) await sleep()`, 禁止无timeout的 `waitForEvent()`            | —                                                     |

#### B. 硬性规则

1. **Unit testing禁止 `setTimeout` / `Date.now()` directlycall** — 必须viainjection的 Clock interface
2. **所有 `await sleep()` call必须有 `{ timeout }` 参数上界** — CI timeout前必须自行中止
3. **Integration testing的总 sleep 预算**: 单个 test case ≤ 2s, 单个 test file ≤ 10s
4. **Retry 循环必须有 `maxAttempts` + `maxWaitMs` 双重limit** — 防止无限重试

#### C. FakeClock 模板

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

#### D. CI 守护

- Lint rule (或 grep CI step) 检测testingfile中bare露的 `Date.now()`, `new Date()`, `setTimeout` call, unit testing目录下标记为 warning
- `--test-timeout=30000` 作为globally兜底, 超过 30s 的单个 test case auto fail

---

## 18. 设计规格到testing追溯规范

### 18.1 目标

建立 **设计文档 → testing用例** 的双向追溯, 使得: 

- 每个 P0/P1 设计规格都有对应testing
- 每个testing都能追溯到设计需求

### 18.2 Spec ID 编码规则

本项目uses **4 种前缀** distinguish不同来源的可追溯规格: 

| 前缀        | 含义          | 来源                                      |
| ----------- | ------------- | ----------------------------------------- |
| `SPEC-`     | 设计规格      | `opeli_detailed_design.md` 及其他设计文档 |
| `ADR-`      | 架构决策record  | `doc/adr/` 目录下的 ADR 文档              |
| `CONTRACT-` | interface/行为contract | `doc/contracts/` 目录下的 contract 文档   |
| `INC-`      | 线上事故      | 事故复盘record, 触发回归testing                |

#### 编码格式

```
{前缀}{module}-{子system}-{序号}

SPEC 示例: 
SPEC-OAPEFLIR-EXEC-001     # OAPEFLIR Execute 阶段第 1 条规格
SPEC-ROLLOUT-STATE-003      # Rollout state机第 3 条规格
SPEC-PLUGIN-SANDBOX-002     # Plugin sandbox 第 2 条规格
SPEC-EVENT-TIER1-DLQ-001    # Tier 1 事件 DLQ 第 1 条规格
SPEC-LEASE-FENCING-001      # Lease fencing token 第 1 条规格

ADR 示例: 
ADR-LOCK-BACKEND-001        # 分布式lock选型 ADR 第 1 条
ADR-EVENT-DURABILITY-002    # 事件persistencestrategy ADR 第 2 条

CONTRACT 示例: 
CONTRACT-SANDBOX-FS-001     # Sandbox filesystemcontract第 1 条
CONTRACT-API-GATEWAY-003    # API Gateway interfacecontract第 3 条

INC 示例: 
INC-20250312-LEASE-STALE-001  # 2025-03-12 lease 脏写事故第 1 条
INC-20250401-DLQ-OVERFLOW-001 # 2025-04-01 DLQ 溢出事故第 1 条
```

### 18.3 testing中references Spec ID

在testing标题中contains spec ID (支持所有 4 种前缀) : 

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

或在testingfile头部maintained映射表: 

```typescript
/**
 * Spec coverage:
 *   SPEC-EVENT-TIER1-DLQ-001 — test at line 45
 *   SPEC-EVENT-TIER1-DLQ-002 — test at line 78
 *   CONTRACT-API-GATEWAY-003 — test at line 95
 *   INC-20250401-DLQ-OVERFLOW-001 — test at line 130
 */
```

### 18.4 追溯关系三张表

#### 表 1: 源file → Unit testing

```
src/platform/feedback/feedback-collector.ts → tests/unit/platform/feedback/feedback-collector.test.ts
```

 (即 §7.3 的 Traceability Matrix) 

#### 表 2: 源file → Integration testing

```
src/platform/five-plane-execution/tools/command-executor.ts → tests/integration/security/sandbox-command-executor.test.ts
```

#### 表 3: 设计规格 → testing

```
opeli_detailed_design.md §5 Execute  → SPEC-OAPEFLIR-EXEC-001 → tests/unit/core/agent-loop/execute.test.ts:L45
opeli_detailed_design.md §12 Rollout → SPEC-ROLLOUT-STATE-003 → tests/unit/core/improvement/rollout.test.ts:L88
doc/contracts/sandbox-contract.md    → SPEC-PLUGIN-SANDBOX-002 → tests/integration/security/plugin-sandbox.test.ts:L30
```

### 18.5 maintained流程

1. **新增设计规格** → 分配 Spec ID → 写入设计文档
2. **编写testing** → 在testing标题或file头references Spec ID
3. **Sprint Review** → 运行追溯脚本, output未coverage Spec ID 列表
4. **Gap handle** → 未coverage的 Spec ID 进入testing债务清单 (§20) 

追溯脚本示例 (coverage全部 4 种前缀) : 

```bash
ID_PATTERN='(SPEC|ADR|CONTRACT|INC)-[\w-]+'

# 从所有源文档提取已定义的 ID
grep -oP "$ID_PATTERN" doc/reviews/opeli_detailed_design.md \
                        doc/adr/*.md \
                        doc/contracts/*.md \
                        doc/incidents/*.md \
  2>/dev/null | sort -u > /tmp/all-spec-ids.txt

# 从testingfile提取已coverage的 ID
grep -roPh "$ID_PATTERN" tests/ | sort -u > /tmp/tested-specs.txt

# 差集 = 未coverage
comm -23 /tmp/all-spec-ids.txt /tmp/tested-specs.txt

# 按前缀分类统计
echo "=== 未coverage统计 ==="
for prefix in SPEC ADR CONTRACT INC; do
  count=$(grep -c "^${prefix}-" /tmp/uncovered.txt 2>/dev/null || echo 0)
  echo "  ${prefix}: ${count}"
done
```

---

## 19. 真实execute vs Mock execute边界规范

### 19.1 问题背景

Agent system最常见的testing陷阱: **testingcoverage率很高, 但核心execute全是 mock**. 本项目的 Execute 阶段目前即是完全 mock implementation. 

必须明确界定哪些testing层allows mock, 哪些必须真实execute. 

### 19.2 Mock 许可矩阵

| 组件                          | Unit Test                 | Integration Test             | E2E Test                       |
| ----------------------------- | ------------------------- | ---------------------------- | ------------------------------ |
| **LLM Provider**              | ✅ Mock                   | ✅ Mock                      | ✅ Mock (provider 非我方控制)  |
| **Tool Execution Bridge**     | ✅ Mock                   | ❌ 必须真实                  | ❌ 必须真实                    |
| **Sandbox / Security Policy** | ✅ Mock                   | ❌ 必须真实                  | ❌ 必须真实                    |
| **Database (SQLite)**         | ❌ 禁止 mock              | ❌ 真实 in-memory            | ❌ 真实                        |
| **Database (PostgreSQL)**     | ✅ Mock (unit 用 SQLite)  | ❌ 必须真实 PG               | ❌ 必须真实 PG                 |
| **filesystem**                  | ✅ Mock 或 temp dir       | ❌ 必须用 temp dir           | ❌ 必须真实                    |
| **子process (spawn)**            | ✅ Mock                   | ❌ 必须真实                  | ❌ 必须真实                    |
| **Event Bus**                 | ✅ Mock                   | ❌ 真实 DurableEventBus      | ❌ 真实                        |
| **分布式lock**                  | ✅ Mock                   | ❌ 真实 SQLite/Redis adapter | ❌ 真实                        |
| **网络 HTTP**                 | ✅ Mock                   | ✅ Mock (外部 API)           | ✅ Mock                        |
| **OAPEFLIR 阶段产出**         | ✅ Mock (隔离testing单阶段)  | ❌ 阶段间需真实串联          | ❌ 全链路                      |

### 19.3 Mock 层级禁令

以下组合 **严格禁止**: 

| 禁止                                                  | 原因                                    |
| ----------------------------------------------------- | --------------------------------------- |
| Integration test 中 mock DB                           | 无法验证 SQL 正确性, transaction隔离, 迁移compatibility |
| Integration test 中 mock sandbox                      | 无法验证path穿越/命令injection防护           |
| E2E test 中 mock tool bridge                          | 无法验证工具链真实行为                  |
| 任何层 mock `StateTransitionMachine.assertTransition` | 无法验证state机约束                      |
| 任何层 mock `validateWriteAccess`                     | 无法验证 fencing token 防护             |

### 19.4 Provider Mock 规范

LLM Provider 是唯一allows在所有层 mock 的组件 (因为真实call不确定, 昂贵, 慢) . 

Provider mock 必须遵循: 

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

- return值必须符合 Provider interface的完整type
- return值必须 **deterministic** (fixedcontent) 
- 禁止在 mock 中加入 `Math.random()` 或 `Date.now()`

---

## 20. testing债务分级

### 20.1 分级定义

| 等级      | 定义                                          | 修复时限     | 示例                                  |
| --------- | --------------------------------------------- | ------------ | ------------------------------------- |
| **TD-P0** | 安全边界 / state机 / execute主链无testing            | 当前 Sprint  | sandbox 新攻击向量无 denial-path test |
| **TD-P1** | 核心 orchestrator 低 branch/mutation coverage | 下个 Sprint  | `OapeflirLoopService` 无 unit test    |
| **TD-P2** | 辅助服务 branch < 60% 或 mutation < 50%       | 2 Sprints 内 | `improvement` branches 52.4%          |
| **TD-P3** | 工具类 / 辅助函数missing少边界条件                 | Backlog      | 纯函数missing少空值testing                    |
| **TD-P4** | Golden / 性能testing文档性补强                   | Backlog      | 新 CLI 命令无 golden snapshot         |

### 20.2 债务登记格式

```
TD-{等级}-{序号}: {描述}
  module: {src/platform/xxx}
  当前coverage: {lines}% / {branches}% / mutation {x}%
  目标coverage: {lines}% / {branches}%
  关联 Spec: {SPEC-xxx} (如适用)
  责任人: {owner}
  截止日: {date}
```

### 20.3 债务进入与退出条件

**进入条件**: 

- §7 Traceability Matrix 脚本发现未coverage源file
- Coverage gate 中某目录below安全红线 (§23) 
- Stryker 报告 survived mutants 率 > 50%
- PR Review 发现missingtesting场景
- Incident 回灌未产生对应回归testing

**退出条件**: 

- 对应testing已编写并合入 main
- Coverage baseline 已更新
- Mutation score 改善到 ≥ low 阈值

### 20.4 Sprint testing债务auto报告

每个 Sprint 结束时auto生成testing债务报告, 作为 Sprint Review 的必要输入. 

#### A. 报告content

| 板块                   | data来源                 | 说明                                      |
| ---------------------- | ------------------------ | ----------------------------------------- |
| 新增 TD                | 本 Sprint 新建的 TD 条目 | 按优先级分布统计                          |
| 已关闭 TD              | 本 Sprint 关闭的 TD 条目 | 关闭原因分布 (修复 / cancel / 降级)         |
| 红线违规目录           | §23 coverage率质量红线check   | 列出below安全红线的目录及差距              |
| 未coverage Spec ID         | §18.5 追溯脚本output       | 按前缀 (SPEC / ADR / CONTRACT / INC) 分类 |
| Top-N Survived Mutants | Stryker 报告             | 取 survived 最多的前 10 个源file          |
| 未回灌事故             | §21 failure样例回灌清单     | 已record但尚未产生回归testing的 incident       |

#### B. auto化脚本要求

```bash
#!/usr/bin/env bash
# scripts/ci/sprint-test-debt-report.sh

echo "=== Sprint Test Debt Report ==="
echo "Date: $(date -I)"
echo ""

echo "## 1. 红线违规目录"
node scripts/ci/check-coverage-baseline.mjs --report-only 2>&1 | grep "BELOW"

echo ""
echo "## 2. 未coverage Spec ID"
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
echo "## 4. 未回灌事故"
# 从 incidents 目录中找到尚未有对应 INC- 前缀testing的事故
comm -23 \
  <(grep -oP 'INC-[\w-]+' doc/incidents/*.md 2>/dev/null | sort -u) \
  <(grep -roPh 'INC-[\w-]+' tests/ | sort -u)
```

#### C. CI 集成

- 报告脚本在每次 `main` branch合并时运行, 产出物归档到 `data/sprint-reports/` 目录
- 若红线违规目录数量 > 上次报告, CI 发 warning (不blocks) 
- Sprint Review 议程中必须contains该报告的解读

---

## 21. failure样例回灌规则

### 21.1 核心principle

> **每一个线上 incident, rollback, 安全逃逸, 高优先级user修正, 都必须回灌成至少一条回归testing. **

### 21.2 回灌触发条件

| 触发事件                   | 必须回灌的testingtype                            |
| -------------------------- | --------------------------------------------- |
| 线上 incident (P0/P1)      | Integration regression + root cause unit test |
| Rollback (Rollout fallback)    | state机 transition test + 条件 gate test       |
| 安全逃逸 (sandbox bypass)  | Denial-path regression (§8)                   |
| user修正 (人工纠错)        | Unit test coverage被修正的逻辑branch                |
| datainconsistent修复             | concurrent/transaction隔离 test (§17)                      |
| Dead letter 积压           | Event lifecycle test (§15)                    |

### 21.3 回灌流程

```
Incident 发生 → Root Causeanalysis → 修复代码
                              ↓
                  编写回归testing (testing标题contains incident ID) 
                              ↓
                  验证: 删除修复代码 → 回归testingfailure (confirmationtesting有效) 
                              ↓
                  恢复修复代码 → testingvia → 合入
```

### 21.4 回灌testingnaming

```typescript
test("[INC-2026-0417] stale fencing token causes duplicate writeback", () => {
  // 复现 incident Root Cause
});
```

### 21.5 回灌验证

回灌testing必须via **反向验证**: 

1. comment掉修复代码
2. 运行回灌testing → 必须failure
3. 恢复修复代码
4. 运行回灌testing → 必须via

如果step 2 testing仍然via, 说明testing未有效coverageRoot Cause, 需重写. 

---

## 22. testingdata治理

### 22.1 Fixture 最小化principle

Fixture 只contains被测场景 **必需** 的field, 其余uses工厂default值: 

```typescript
// ✓ 好 — 只指定testing关心的field
const task = createMinimalTask({ priority: "critical" });

// ✗ 差 — 复制粘贴完整record
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

### 22.2 确定性控制

testing中 **禁止** 以下非确定性来源: 

| 非确定性来源                | 替代方案                                             |
| --------------------------- | ---------------------------------------------------- |
| `Date.now()` / `new Date()` | usesfixed时间戳或 `withEnv({ AA_FIXED_TIME: "..." })` |
| `Math.random()`             | usesfixed seed 或hardcoded值                             |
| `crypto.randomUUID()`       | usesfixed ID (如 `"task-test-001"`)                   |
| 网络request                    | Mock provider                                        |
| filesystem时间戳              | 在 golden testing中 normalize                           |
| 子processoutput中的 PID          | 在assertion前 strip                                       |

### 22.3 Golden Snapshot Normalization

在写入 golden file前, 对不稳定field做 normalize: 

```typescript
function normalizeForGolden(output: unknown): unknown {
  const json = JSON.stringify(output, null, 2);
  return json
    .replace(/"createdAt":\s*"[^"]+"/g, '"createdAt": "<TIMESTAMP>"')
    .replace(/"id":\s*"[a-f0-9-]+"/g, '"id": "<UUID>"')
    .replace(/"pid":\s*\d+/g, '"pid": <PID>');
}
```

### 22.4 场景 Fixture 与领域 Fixture 分离

| type             | file                                  | 用途                                                     |
| ---------------- | ------------------------------------- | -------------------------------------------------------- |
| **领域 Fixture** | `tests/helpers/fixtures/base.ts`      | 最小有效领域record (Task, Execution, Approval)             |
| **场景 Fixture** | `tests/helpers/fixtures/composite.ts` | 多实体关联场景 (BlockedTask, CompletedTask, FailedTask)  |
| **种子 Fixture** | `tests/helpers/api.ts`                | 完整 API 环境种子                                        |

新增 fixture 时: 

- 单实体 → 加到 `base.ts`
- 多实体关联 → 加到 `composite.ts`
- 特定testing专用 → 内联在testingfile中 (不提取) 

### 22.5 testing隔离

- 每个testingindependent创建 temp workspace, `try/finally` cleanup
- 禁止testing之间sharedstate (globally变量, singleton, static属性) 
- 环境变量via `withEnv()` 隔离
- data库viaindependent DB file隔离 (不shared in-memory DB) 

---

## 23. coverage率质量红线

### 23.1 问题

globally 82.4% 行coverage率可能掩盖关键module的低coverage. 需要对不同module定义 **硬性最低门槛**. 

### 23.2 分级红线 (v3.0 更新目录映射) 

| 级别         | 适用module                                                                           | Lines 红线 | Branches 红线 | Mutation 红线 |
| ------------ | ---------------------------------------------------------------------------------- | ---------- | ------------- | ------------- |
| **Critical** | compliance, distributed-lock, state-transition, execution-lease, control-plane/iam | ≥ 90%      | ≥ 80%         | ≥ 70%         |
| **High**     | orchestration/oapeflir, state-evidence/memory, knowledge, events, execution-engine | ≥ 85%      | ≥ 75%         | ≥ 60%         |
| **Standard** | orchestration/oapeflir/learn, planning, improvement, artifacts, prompt-engine      | ≥ 80%      | ≥ 70%         | ≥ 50%         |
| **Baseline** | plugins, sdk/cli, model-gateway, tool-executor, domains                            | ≥ 75%      | ≥ 60%         | ≥ 50%         |

### 23.3 当前差距 (v4.0 c8 实测data) 

> **重要**: c8 fullanalysis (`all: true`) 显示所有modulecoverage率均为 **0%**, 唯一例外是 `state-evidence/truth/sqlite/` 下 6 个file (100%) . 因此以下所有 Critical 和 High module当前均 **不达标**. 

| module                                    | 级别     | 当前 Lines | 红线 | 当前 Branches | 红线 | state                |
| --------------------------------------- | -------- | ---------- | ---- | ------------- | ---- | ------------------- |
| `platform/five-plane-execution/distributed-lock`   | Critical | 0%         | 90%  | 0%            | 80%  | ❌ Lines **差 90%** |
| `platform/five-plane-execution/state-transition`   | Critical | 0%         | 90%  | 0%            | 80%  | ❌ Lines **差 90%** |
| `platform/five-plane-control-plane/iam`            | Critical | 0%         | 90%  | 0%            | 80%  | ❌ Lines **差 90%** |
| `platform/compliance`                   | Critical | 0%         | 90%  | 0%            | 80%  | ❌ Lines **差 90%** |
| `platform/five-plane-orchestration/oapeflir`       | High     | 0%         | 85%  | 0%            | 75%  | ❌ Lines **差 85%** |
| `platform/five-plane-state-evidence/memory`        | High     | 0%         | 85%  | 0%            | 75%  | ❌ Lines **差 85%** |
| `platform/five-plane-state-evidence/events`        | High     | 0%         | 85%  | 0%            | 75%  | ❌ Lines **差 85%** |
| `platform/five-plane-execution/execution-engine`   | High     | 0%         | 85%  | 0%            | 75%  | ❌ Lines **差 85%** |
| `platform/five-plane-state-evidence/knowledge`     | High     | 0%         | 85%  | 0%            | 75%  | ❌ Lines **差 85%** |
| `platform/five-plane-orchestration/oapeflir/learn` | Standard | 0%         | 80%  | 0%            | 70%  | ❌ Lines **差 80%** |
| `platform/five-plane-state-evidence/artifacts`     | Standard | 0%         | 80%  | 0%            | 70%  | ❌ Lines **差 80%** |
| `platform/prompt-engine`                | Standard | 0%         | 80%  | 0%            | 70%  | ❌ Lines **差 80%** |
| `plugins`                               | Baseline | 0%         | 75%  | 0%            | 60%  | ❌ Lines **差 75%** |
| `sdk/cli`                               | Baseline | 0%         | 75%  | 0%            | 60%  | ❌ Lines **差 75%** |
| `platform/model-gateway`                | Baseline | 0%         | 75%  | 0%            | 60%  | ❌ Lines **差 75%** |
| `domains`                               | Baseline | 0%         | 75%  | 0%            | 60%  | ❌ Lines **差 75%** |

> **v4.0 重大变更**: c8 fullanalysis显示所有modulecoverage率为 0% (除 state-evidence/truth/sqlite/ 的 6 file外) . v3.0 声称的高coverage率data经验证不准确. **Root Causeanalysis**: testing代码exists (1,803 个 .test.ts file, 52,480 个assertion) , 但 c8 coverage率采集可能未正确关联到所有编译后的 `dist/src/` file, 或 `build:test` 编译过程未将全部源filecontains在 c8 的 instrumentation range内. 需要排查 c8 configure与构建链的集成问题. 

### 23.4 红线execute方式

将红线写入 `.coverage-baseline.json` 的目录级 minimums, 由 `check-coverage-baseline.mjs` forceexecute. 

当前基线只record"观察值", 建议扩展为: 

```json
{
  "src/platform/security": {
    "fileCount": 19,
    "metrics": { "lines": 91.9, ... },
    "minimums": { "lines": 90, "branches": 80 }  // ← 新增
  }
}
```

### 23.5 state机 / 安全专项红线

除coverage率外, 以下module有专项红线: 

| 专项                | 红线                       | 度量方式                  |
| ------------------- | -------------------------- | ------------------------- |
| state机合法转换coverage  | 100%                       | 合法边数 / 总合法边数     |
| state机非法转换coverage  | 终态 × 全部非自身state 100% | rejecttesting数 / 应reject数     |
| 安全 denial-path    | 每个攻击面 ≥ 3 条          | denial test 数 / 攻击面数 |
| Tier 1 事件生命周期 | 9 种事件 × 8 阶段 100%     | 已测阶段 / 72             |
| Fencing token reject  | 5 种原因 100%              | rejecttesting数 / 5            |

---

---

# Part III — 架构missing口回归testing矩阵 (v4.0 重写, 对齐架构审查 v8.0) 

> Part I 解决"代码coverage治理", Part II 解决"架构语义coverage". 
> Part III 解决"**架构设计 vs implementation的missing口回归防护**" — based on架构审查 v8.0 (`docs_zh/reviews/architecture-design-vs-implementation-review.md`) 发现的 **13 项架构missing口**, 定义对应的testing规范, 确保每个missing口在implementation后有完备的testingcoverage. 
>
> **v4.0 变更**: 完全重写. v3.0 based on架构审查 v6.0 的 29 项missing口 (GAP-\* 编号) . 本版based on架构审查 v8.0 对全代码库 (1,387 file / 265,020 行) vs 设计文档 v3.2 (§1-§94) 的full差距评审, coverage **3 项 P0 架构违规 + 7 项 P1 implementation不足 + 3 项 P2 details补全**. v3.0 中 Harness 相关missing口 (GAP-VI-\*) 已在代码中partialimplementation (29 file 1,471 行) , 本版聚焦安全/分类/authorization框架层面的设计-implementation差距. 

---

## 24. 架构审查驱动的回归testing

### 24.1 背景

架构审查 v8.0 对 1,387 个源file / 265,020 行代码进行了full审查, 对比架构设计文档 v3.2 (约 8,000 行 / 94 章节) , 发现 **13 项架构设计 vs implementationmissing口**: 

| 优先级              | 数量 | 关键missing口                                                                            |
| ------------------- | ---- | ----------------------------------------------------------------------------------- |
| P0 架构违规         | 3    | E1-E6 异常分类missing, SEV1-4 统一严重度missing, STRIDE 威胁模型missing                      |
| P1 明确要求implementation不足 | 7    | Principal type, Sandbox 层级, Cursor pagination, HITL 模式, RBAC 三层authorization, 垂直域, 多模态 |
| P2 details补全         | 3    | Webhook-Outbox coupling, 逻辑表对账, 元模型 12 问                                       |

### 24.2 missing口 ID 到testing追溯

testing标题uses `[ARCH-P{级别}-{序号}]` 前缀, 与架构审查 v8.0 的missing口编号一一对应: 

```
架构审查 v8.0: P0-1 §12.1 异常事件分类体系 E1-E6 完全missing
    ↓
testing标题: [ARCH-P0-1] AnomalyEventClass enum defines all 6 categories E1-E6
    ↓
file位置: tests/unit/platform/contracts/anomaly-event-classification.test.ts
```

| 前缀       | 含义                 | missing口数 |
| ---------- | -------------------- | ------ |
| `ARCH-P0-` | 架构违规 (完全missing)  | 3      |
| `ARCH-P1-` | 明确要求但implementation不足   | 7      |
| `ARCH-P2-` | details补全             | 3      |

### 24.3 优先级executeplan

| 优先级 | 修复时限 | missing口 ID                                                                                                      |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| **P0** | 1-2 周   | P0-1 (E1-E6 分类) , P0-2 (SEV1-4 统一严重度) , P0-3 (STRIDE)                                                 |
| **P1** | 2-4 周   | P1-1 (Principal) , P1-2 (Sandbox) , P1-3 (pagination) , P1-4 (HITL) , P1-5 (RBAC) , P1-6 (垂直域) , P1-7 (多模态)  |
| **P2** | 持续     | P2-1 (Webhook-Outbox) , P2-2 (逻辑表) , P2-3 (元模型 12 问)                                                  |

---

## 25. P0 架构违规missing口testing规范

### 25.1 [ARCH-P0-1] §12.1 异常事件分类体系 E1-E6 完全missing

**missing口**: 设计定义 6 类异常事件分类 (E1 业务/E2 execute/E3 外部dependency/E4 安全/E5 data/E6 治理) , 代码中 `AnomalyDetectionService` uses `AnomalyCategory` (spike/trend_change/level_shift) , 完全不同于设计分类体系. 

**testingtype**: Unit

**testing目标**: 异常事件分类枚举必须contains E1-E6 全部 6 类, 分类映射逻辑必须正确. 

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

**testing场景清单**:

| 场景                          | assertion                                      |
| ----------------------------- | ----------------------------------------- |
| 每个 E1-E6 分类枚举值exists     | 枚举length = 6, contains所有值                  |
| Schema 验证合法事件           | `doesNotThrow`                            |
| Schema rejectmissing少 class 的事件  | `throws`                                  |
| 统计检测 → E1-E6 映射coverage全部 | 每种 source_plane 至少映射到一个 E 类     |
| 事件发布携带 class field       | outbox/event 消息contains `AnomalyEventClass` |

### 25.2 [ARCH-P0-2] §12.2 统一严重度等级 SEV1-SEV4 missing

**missing口**: 代码中exists 3 套互不compatibility的严重度体系: Incident 用 P0-P3, Anomaly 用 warning/critical/emergency, SLO 用 AlertSeverity. 设计要求统一uses SEV1-SEV4. 

**testingtype**: Unit + Integration

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

### 25.3 [ARCH-P0-3] §11.8 STRIDE 威胁模型完全missing

**missing口**: 设计要求 STRIDE 六维度威胁评估 + 补充威胁矩阵, 代码中无任何 STRIDE implementation. 

**testingtype**: Unit

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

## 26. P1 高优先级missing口testing规范

### 26.1 [ARCH-P1-1] Principal type不完整 (3/6) 

**missing口**: 架构 §11.1 定义 6 种 Principal type (Human / ServiceAccount / Agent / System / External / Anonymous) , 代码onlyimplementation前 3 种. 

**testingtype**: Unit

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

### 26.2 [ARCH-P1-2] Sandbox 层级不完整 (3/4 档) 

**missing口**: 架构 §11.4 定义 4 档 Sandbox (none / process / container / vm) , 代码onlyimplementation前 3 档. 

**testingtype**: Unit

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

### 26.3 [ARCH-P1-3] Cursor-based pagination不完整

**missing口**: 架构 §6.6 要求所有列表 API uses cursor-based pagination. 当前partial端点uses offset-based 或无pagination. 

**testingtype**: Integration

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

### 26.4 [ARCH-P1-4] HITL 7 种模式coverage度待验证

**missing口**: 架构 §21.1 定义 7 种 Human-in-the-Loop 模式 (approve / reject / escalate / override / inspect / patch / takeover) . 代码coverage度待验证. 

**testingtype**: Integration

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

### 26.5 [ARCH-P1-5] RBAC + Capability + Context-aware 三层authorization不完整

**missing口**: 架构 §11.2 要求三层authorization (RBAC 角色 → Capability token → Context-aware dynamicstrategy) . 代码onlyimplementation RBAC 层. 

**testingtype**: Unit + Integration

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

### 26.6 [ARCH-P1-6] 垂直域专属架构missing

**missing口**: 架构 §71-§94 定义 24 个垂直域的专属工作流, 工具束, riskstrategy和评估指标. 当前所有域uses通用骨架. 

**testingtype**: Unit (Golden)

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

### 26.7 [ARCH-P1-7] 多模态能力视频handle为骨架

**missing口**: 架构 §68 定义多模态handle能力 (text / image / audio / video) . 视频handleonly存骨架 stub, 无实际implementation. 

**testingtype**: Unit + Integration

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

## 27. P2 details补全missing口testing规范

### 27.1 [ARCH-P2-1] Webhook + Outbox couplingmissing

**missing口**: 架构 §6.7 要求事件notificationuses Transactional Outbox 模式保证 at-least-once 投递. 当前 webhook directlysynchronous发送, 无 outbox 表, 无重试追踪. 

**testingtype**: Integration

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

### 27.2 [ARCH-P2-2] 逻辑表数量差异

**missing口**: 架构 §26.3 定义的逻辑表集合与代码中实际 schema 定义exists数量差异. 需要验证所有架构要求的表在代码中有对应定义. 

**testingtype**: Unit (Schema Validation)

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

### 27.3 [ARCH-P2-3] 统一领域元模型 12 问coverage度

**missing口**: 架构 §37.11 定义统一领域元模型的 12 个必答问题 (域边界, 核心实体, 工作流, 工具束, riskstrategy, 评估指标, 预算约束, 安全级别, 延迟要求, data敏感度, 合规要求, SLA 目标) . 需验证每个域的元模型回答coverage度. 

**testingtype**: Unit (Golden)

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

# Part IV — system工程missing陷回归testing (v2.0 原 Part III 保留, v3.0 更新编号) 

> Part III 解决"架构设计-implementationmissing口". 
> Part IV 解决"**system工程missing陷的回归防护**" — based on架构审查 v4.1 发现的工程missing陷 (Redis errorhandle, concurrent竞态, silently丢task等) , 定义对应的回归testing规范. 
>
> **v3.0 变更**: 从 v2.0 Part III (§24-§30) 迁移至 Part IV (§29-§34) , 编号更新, content保留. SYS-\* missing陷编号不变. 

---

## 29. P0 阻断级工程missing陷testing规范

> 对应 v2.0 §25. 

### 29.1 [SYS-REL-2.1] Redis errorhandle器silently吞错

**missing陷**: `distributed-lock/redis-lock-adapter.ts`, `queue/redis-queue-adapter.ts`, `ingress/redis-rate-limiter.ts`, `cache/stores/redis-cache-store.ts` 中 `this.redis.on("error", () => {})` silently吞掉所有 Redis error. 

**testingtype**: Unit + Integration

**testing目标**: Redis 连接error必须 (1) record到 StructuredLogger, (2) 更新健康state标志, (3) 递增 Prometheus 计数器. 

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

**coveragefile** (每个file一组testing) :

| file                                               | testingfile                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| `execution/distributed-lock/redis-lock-adapter.ts` | `tests/unit/platform/five-plane-execution/redis-lock-error.test.ts`         |
| `execution/queue/redis-queue-adapter.ts`           | `tests/unit/platform/five-plane-execution/redis-queue-error.test.ts`        |
| `interface/ingress/redis-rate-limiter.ts`          | `tests/unit/platform/five-plane-interface/redis-rate-limiter-error.test.ts` |
| `shared/cache/stores/redis-cache-store.ts`         | `tests/unit/platform/shared/redis-cache-error.test.ts`           |

### 29.2 [SYS-REL-2.3] DLQ 纯in-memory, 重启loss

**missing陷**: `state-evidence/dlq/index.ts` uses `Map<string, DeadLetterRecord>` 存储死信, process重启后全部loss. 

**testingtype**: Integration

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

### 29.3 [SYS-REL-2.4] Redis 队列silently丢task

**missing陷**: `execution/queue/redis-queue-adapter.ts` 中 5 处关键 enqueue 操作uses `.catch(() => {})`. 

**testingtype**: Unit

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

### 29.4 [SYS-DEPLOY-6.3] Dockerfile CMD path不exists

**missing陷**: `Dockerfile` 行 46 的 CMD references不exists的path. 

**testingtype**: CI Build Verification

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

## 30. P1 严重missing陷testing规范

### 30.1 [SYS-REL-2.2] Redis lock TOCTOU 竞态

**missing陷**: `distributed-lock/redis-lock-adapter.ts` 的 `extendAsync()` usesnon-atomic GET+SET, `forceStealAsync()` usesnon-atomic DEL+SET. concurrent场景下两个process可同时持有同一把lock. 

**testingtype**: Integration (Concurrency)

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

### 30.2 [SYS-REL-2.7] 工作流state转换missing少 CAS

**missing陷**: `execution/state-transition/transition-service.ts` task转换有 CAS, 但工作流转换无 CAS 保护. 

**testingtype**: Integration (Concurrency)

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

### 30.3 [SYS-REL-2.5] SLO 告警投递silentlyloss

**missing陷**: `shared/observability/slo-alerting-service.ts` 行 172/227/281/339 告警投递failure时 `.catch(() => {})`. 

**testingtype**: Unit

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

### 30.4 [SYS-REL-2.6] Outbox 未接入关键写path

**missing陷**: `shared/outbox/outbox-service.ts` 完整implementationexists, 但 `transition-service.ts` 的taskstate转换directly写事件表不经 Outbox. 

**testingtype**: Integration

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

### 30.5 [SYS-REL-2.8] 会话双存储non-atomic写入

**missing陷**: `state-evidence/truth/session-dual-storage.ts` 两次 `appendFileSync` 之间crashed导致inconsistent. 

**testingtype**: Integration (Fault Injection)

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

### 30.6 [SYS-PERF-3.1] StructuredLogger synchronous I/O blocks事件循环

**missing陷**: `shared/observability/structured-logger.ts:295` 每条logcall `appendFileSync` blocks事件循环. 

**testingtype**: Performance / Unit

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

### 30.7 [SYS-OBS-5.3] Alertmanager 接收器验证

**missing陷**: `deploy/prometheus/alertmanager.yml` 三个接收器全部指向同一内部 webhook. 

**testingtype**: Golden / Config Validation

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

### 30.8 [SYS-DEPLOY-6.1] Terraform 远程后端验证

**missing陷**: `deploy/terraform/main.tf` 无 `backend {}` 块, statefilelocal存储. 

**testingtype**: Config Validation

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

## 31. P2 重要missing陷testing规范

### 31.1 [SYS-ARCH-1.1] 五面体跨面导入守护

**missing陷**: 394 处跨面导入violates五面体架构 (如 state-evidence 导入 execution) . 

**testingtype**: Static Analysis (Architectural)

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

**禁止的导入方向** (testing必须coverage所有) :

| 源面           | 禁止导入目标                            |
| -------------- | --------------------------------------- |
| state-evidence | execution, control-plane                |
| control-plane  | state-evidence (directly), execution (directly) |
| interface      | onlyallows导入 shared/, contracts/          |
| orchestration  | execution (directlyskip shared 适配器)      |

### 31.2 [SYS-OBS-5.1] 关键path console.\* 禁用

**missing陷**: 37 处关键pathuses `console.*` bypass StructuredLogger. 

**testingtype**: Static Analysis / Lint

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

### 31.3 [SYS-OBS-5.2] Prometheus 告警规则integrity

**missing陷**: only 3 条 Prometheus 告警规则, missing少 DB, Redis, 事件循环, 队列等关键告警. 

**testingtype**: Config Validation

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

### 31.4 [SYS-PERF-3.2] Redis KEYS 命令禁用

**missing陷**: `distributed-lock/redis-lock-adapter.ts:236` uses `redis.keys("lock:*")` O(n) blocks. 

**testingtype**: Unit / Static Analysis

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

### 31.5 [SYS-PERF-3.4] 无界 Map in-memory守护

**missing陷**: 20+ 处 `Map` 只增不删, 长时间运行导致in-memoryleaks. 

**testingtype**: Unit (Stress)

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

### 31.6 [SYS-SEC-4.2] path遍历一致性

**missing陷**: `knowledge-snapshot-store.ts:29` directly `readFileSync(this.snapshotPath)` 无沙箱check. 

**testingtype**: Security Unit

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

### 31.7 [SYS-SEC-4.1] 环境变量启动validationintegrity

**missing陷**: 插件/安全相关 `AA_*` 环境变量不在 Zod 启动validationrange内. 

**testingtype**: Unit

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

## 32. 架构不变量auto守护testing

> 对应 v2.0 §28. 

### 32.1 目的

将架构审查中发现的结构性问题转化为**持续运行的auto化守护testing**, 防止架构腐化复发. 

### 32.2 守护testing清单

| 守护项                        | testingfile                                                        | 频率    |
| ----------------------------- | --------------------------------------------------------------- | ------- |
| 五面体导入隔离                | `tests/unit/platform/contracts/plane-isolation.test.ts`         | 每次 CI |
| console.\* 禁用 (非 SDK/CLI)  | `tests/unit/platform/contracts/no-console-in-runtime.test.ts`   | 每次 CI |
| `as any` 数量upper limit             | `tests/unit/platform/contracts/type-safety-bounds.test.ts`      | 每次 CI |
| Redis KEYS 命令禁用           | `tests/unit/platform/contracts/no-redis-keys.test.ts`           | 每次 CI |
| 路由无duplicate注册                | `tests/unit/platform/contracts/no-duplicate-routes.test.ts`     | 每次 CI |
| Zod 边界validationcoverage              | `tests/unit/platform/contracts/zod-boundary-validation.test.ts` | 每次 CI |
| 桩file不增长                  | `tests/unit/platform/contracts/stub-count-ratchet.test.ts`      | 每次 CI |
| Dockerfile CMD path有效       | `tests/integration/deploy/dockerfile-entrypoint.test.ts`        | 每次 CI |

### 32.3 Zod 边界validationcoverage守护

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

### 32.4 桩file数量棘轮

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

### 32.5 `as any` 数量棘轮

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

## 33. 桩filecoveragemissing口追踪

> 对应 v2.0 §29. 

### 33.1 ops-maturity 桩file明细

`src/ops-maturity/` 是桩file重灾区, 以下子目录桩率较高: 

| 子目录                 | 总file | 当前 Lines coverage率 | 对应架构章节       |
| ---------------------- | ------ | ----------------- | ------------------ |
| `platform-ops-agent/`  | 9      | 38.7%             | §69 平台ops Agent |
| `edge-runtime/`        | 5      | 96.6%             | §63 边缘推理       |
| `capacity-planner/`    | 5      | 94.0%             | §68 容量规划       |
| `compliance-reporter/` | 3      | —                 | §67 合规报告       |
| `cost-optimizer/`      | 3      | —                 | §65 成本优化       |
| `emergency/`           | 4      | 95.0%             | §60 紧急制动       |
| `multimodal/`          | 7      | 97.1%             | §68B 多模态        |
| `workflow-debugger/`   | 5      | 99.5%             | §62 工作流调试     |
| `explainability/`      | 2      | —                 | §59 可解释性       |

### 33.2 桩file退出条件

一个桩file被认为"已implementation"的条件: 

| 条件       | 标准                         |
| ---------- | ---------------------------- |
| 代码行数   | ≥ 50 行非空非comment代码        |
| 类方法数   | ≥ 3 个非空方法体             |
| testingcoverage   | Branch coverage ≥ 60%        |
| 变异分数   | Mutation score ≥ 50%         |
| 外部call者 | 至少被 1 个非testingfile import |

---

## 34. testingmissing口与coverage现状汇总

> 对应 v2.0 §30, v4.0 based on代码库实测data全面更新. 

### 34.1 源区域 → testingfile数量对照 (v4.0 实测) 

| 源目录                 | 源file    | Unit testing | Integration testing | 合计      | 比率     |
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
| **合计**               | **1,387** | **1,398** | **358**          | **1,803** | **1.30** |

### 34.2 E2E testingfile清单 (17 file) 

| file                                | coverage场景           |
| ----------------------------------- | ------------------ |
| `task-lifecycle.test.ts`            | task全生命周期     |
| `oapeflir-full-loop.test.ts`        | OAPEFLIR 完整循环  |
| `multi-step-workflow.test.ts`       | 多step工作流       |
| `approval-event-flow.test.ts`       | 审批事件流         |
| `gateway-webhook-flow.test.ts`      | 网关 Webhook 流    |
| `streaming-response.test.ts`        | 流式response           |
| `session-memory-flow.test.ts`       | 会话记忆流         |
| `operator-takeover.test.ts`         | ops接管           |
| `lease-recovery.test.ts`            | Lease 恢复         |
| `error-propagation.test.ts`         | error传播           |
| `delegation-chain-flow.test.ts`     | 委托链流程         |
| `domain-onboarding-flow.test.ts`    | 域上线流程         |
| `execution-flow.test.ts`            | execute流程           |
| `harness-loop-e2e.test.ts`          | Harness 循环端到端 |
| `multi-region.test.ts`              | 多区域             |
| `multi-step-task-execution.test.ts` | 多steptaskexecute     |
| `rollback-scenario.test.ts`         | rollback场景           |

### 34.3 Golden testingfile清单 (11 file) 

| file                           | 守护对象              |
| ------------------------------ | --------------------- |
| `openapi-document.test.ts`     | OpenAPI 文档结构      |
| `cli-help-text.test.ts`        | CLI 帮助text          |
| `diagnostics-bundle.test.ts`   | 诊断包结构            |
| `prompt-assembly.test.ts`      | 提示组装 + cached键     |
| `session-summary.test.ts`      | 会话摘要结构          |
| `release-plan-output.test.ts`  | 发布plan Markdown     |
| `workflow-validation.test.ts`  | 工作流validation            |
| `golden-tasks.test.ts` | 黄金task套件 |
| `domain-baseline.test.ts`      | 域基线快照            |
| `config-schema.test.ts`        | configure Schema 快照      |
| `harness-protocol.test.ts`     | Harness 协议快照      |

### 34.4 Performance testingfile清单 (10 file) 

| file                                    | 基准对象            |
| --------------------------------------- | ------------------- |
| `oapeflir-perf.test.ts`                 | OAPEFLIR 循环吞吐量 |
| `knowledge-perf.test.ts`                | 知识检索延迟        |
| `planning-perf.test.ts`                 | 规划生成延迟        |
| `feedback-perf.test.ts`                 | 反馈handle吞吐量      |
| `plugin-perf.test.ts`                   | 插件execute延迟        |
| `handoff-perf.test.ts`                  | 交接流程延迟        |
| `execution-performance.test.ts`         | execute引擎吞吐量      |
| `harness-component-performance.test.ts` | Harness 组件延迟    |
| `harness-loop-performance.test.ts`      | Harness 循环吞吐量  |
| `prompt-engine-performance.test.ts`     | Prompt 引擎延迟     |

### 34.5 当前coverage盲区 Top-5 (v4.0 更新) 

| 排名 | 盲区                                        | 现状                                                                              | 建议                                               |
| ---- | ------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1    | **globally行coverage率** (c8 实测 0.75%)            | 182,253 行中only 1,384 行被coverage (6 个 SQLite delegating file) , 977 个源file均为 0% | configuretesting框架正确收集coverage率, 建立真实基线           |
| 2    | **E1-E6 异常事件分类** (ARCH-P0-1)          | 完全missing, 无统一异常分类体系                                                      | implementation后新增分类完备性 + 路由testing (§25.1)            |
| 3    | **SEV1-SEV4 统一严重度** (ARCH-P0-2)        | 代码exists 3 套互不compatibility体系                                                         | 统一后新增映射 + 降级testing (§25.2)                  |
| 4    | **STRIDE 威胁模型** (ARCH-P0-3)             | 完全missing                                                                          | implementation后新增 6 威胁类别testing (§25.3)                  |
| 5    | **Principal type / Sandbox 层级** (ARCH-P1) | 分别onlyimplementation 3/6 和 3/4                                                             | 补全后新增type完备性 + 隔离验证testing (§26.1/§26.2)  |

---

> **文档结束 (v4.0)** — 本手册从 v3.0 升级到 v4.0. 
>
> **Part I** 保证: testing不少, 质量不差, 不会明显misses. 
> **Part II** 保证: system关键设计语义 (state机, 事件, concurrent, 阶段contract, Harness 语义映射) 都被coverage到. 
> **Part III** 保证: 架构审查 v8.0 发现的 **13 项架构设计-implementationmissing口** (3 P0 + 7 P1 + 3 P2) 有对应testing规范, implementation后不会有testing盲区. 
> **Part IV** 保证: **工程missing陷** (Redis error, concurrent竞态, configure问题等) 有对应回归testing规范, 修复后不会复发. 
>
> **v4.0 关键修正**: c8 实测globally行coverage率only 0.75% (非 v3.0 声称的 82.4%) , `.coverage-baseline.json` 所有值为 null. testingfile数量 (1,803) 已超过源file (1,387) , 但coverage率收集管线未正确关联, 是最优先修复项. 
>
> 核心理念: **coverage率棘轮保证数量, 变异testing保证质量, Traceability Matrix 保证integrity, PR Review 保证上下文, 架构语义矩阵保证设计contract, 架构missing口回归矩阵保证设计-implementation对齐, system问题回归矩阵保证工程missing陷不复发. 七者missing一不可. **
>
> **最新补充提示**: 本file在 v4.0 正文后新增了 [v4.1 补充: 尚未充分考虑的testingtype与补全方案](#v41-补充尚未充分考虑的testingtype与补全方案), coverage UI 六平台, Mission, Yono Business, LLM/Eval, API compatibility, 迁移rollback, Chaos/DR, 可观测性, 隐私合规, 插件供应链, fuzz 等此前没有system化纳入的testing方案. 

---

# v4.1 补充: 尚未充分考虑的testingtype与补全方案

> **补充日期**: 2026-05-18
> **补充目的**: v4.0 已coverage后端单元, 集成, E2E, Golden, 性能, 变异, 安全和架构missing口回归, 但对新增 UI Monorepo, Mission/Yono 业务域, LLM 行为评测, 部署升级, 灾备, 供应链, data治理等system级riskcoverage不足. 本节作为 v4.1 补充, 已cleanupduplicate的 v4.0 副本, 并保留当前file为单一权威版本. 

## 35. 未充分coveragetesting清单

### 35.1 missing口总览

| # | testingtype | 当前手册coverage情况 | risk | 建议testing层级 | 优先级 |
| ---- | -------- | ---------------- | ---- | ------------ | ------ |
| T-GAP-01 | UI 六平台testing | only后端 E2E 为主, 未coverage `ui/` Monorepo | Web 可运行但桌面/移动壳层, 适配器, 路由, state层可能drift | Unit / Component / Contract / E2E / Accessibility / Visual | P0 |
| T-GAP-02 | PlatformAdapter 真实集成 | 未distinguish mock-first 与真实 Electron IPC, Tauri invoke, RN Native Module | 前端 mock via但真实平台能力不可用 | Contract / Native smoke / Adapter parity | P0 |
| T-GAP-03 | Mission 长期目标治理 | 未形成 Mission 维度专项矩阵 | task, 预算, permissions, 冻结, 证据链可能bypass Mission 上下文 | Contract / Integration / E2E / Governance | P0 |
| T-GAP-04 | Yono Business 业务域 | 未coverage新增业务域的端到端业务验收 | 领域configureexists但业务流程, datapermissions, SLA 未验证 | Domain smoke / E2E / Compliance | P0 |
| T-GAP-05 | LLM/Prompt/Eval 行为testing | only有 prompt golden 与partial OAPEFLIR testing | 模型output不可控, 回归难发现, 幻觉/越权未量化 | Eval harness / Golden / Red team / Cost | P0 |
| T-GAP-06 | API contractcompatibility与版本演进 | 有 OpenAPI golden, 但missing少 backward compatibility gate | SDK/UI/外部call方在field变更时破坏 | Contract diff / Consumer-driven contract | P0 |
| T-GAP-07 | data迁移与升级rollback | 有partial migration/rehearsal, 但手册未定义统一strategy | 生产升级后 schema/data 不可逆corrupted | Migration rehearsal / Rollback / Backup restore | P0 |
| T-GAP-08 | Chaos / 故障injection | 有 deploy/chaos configure但手册没有system化 | Redis/PG/网络/worker 故障下reliability退化未知 | Chaos / Recovery / Soak | P1 |
| T-GAP-09 | 灾备与多区域演练 | 有 DR workflow, 但testing手册未纳入验收 | RTO/RPO, 跨区域一致性, 故障切换不可证 | DR drill / Multi-region E2E | P1 |
| T-GAP-10 | 可观测性语义testing | 有告警规则testing, 但missing少 trace/log/metric 端到端语义 | 故障发生时无法定位或指标高基数爆炸 | Observability contract / Golden / Cardinality guard | P1 |
| T-GAP-11 | 成本与预算防线 | 分散exists预算testing, missing少跨模型/工具/task闭环 | 预算耗尽后仍发出 provider/tool call | Unit / Integration / E2E / Cost simulation | P1 |
| T-GAP-12 | 隐私, data保留与sanitized | 安全testing偏攻击面, 隐私合规不足 | log, 事件, 学习对象泄露 PII/secret | Privacy scan / Retention / Redaction | P1 |
| T-GAP-13 | 插件/Pack 生态compatibility | SDK 有testing, missing少版本矩阵和malicious插件验证 | 插件破坏宿主, permissionsout of bounds, 升级不compatibility | SDK compatibility / Sandbox / Supply chain | P1 |
| T-GAP-14 | 供应链与dependency治理 | CI 有 audit/Trivy, 但手册未要求lockfile, SBOM, 许可 | dependency漏洞, 许可证不合规, 构建不可复现 | SBOM / License / Lockfile / Provenance | P1 |
| T-GAP-15 | 性能容量与资源leaks | 有性能基准, 但missing少长稳, leaks, 容量边界 | 短测via, 长时间运行in-memory/handle/队列失控 | Soak / Leak / Capacity / Backpressure | P1 |
| T-GAP-16 | paralleltesting隔离与 flakiness 治理 | 有concurrent规范, 但missing少 flaky 检测机制 | testing偶现failure, 被误判为代码问题或被 skip | Repeat-run / Quarantine / Flaky budget | P1 |
| T-GAP-17 | configure组合矩阵 | 有环境变量validation, 但missing少 dev/test/staging/prod 组合验收 | prod-only configureerror无法提前发现 | Config matrix / Helm/Terraform contract | P1 |
| T-GAP-18 | Accessibility / i18n / Theme | UI 架构要求未进入testing手册 | 跨平台 UI 不可访问, 翻译missing, 主题崩坏 | axe / Keyboard / Locale / Visual | P1 |
| T-GAP-19 | 文档健康与示例可execute性 | only有少量 docs testing | 文档命令, path, API 示例expiry | Docs lint / Snippet execution / Link check | P2 |
| T-GAP-20 | Property-based / fuzz testing | 未纳入 | schema/parser/router 对未知输入脆弱 | Fuzz / Property invariant | P2 |

### 35.2 当前手册已有但需要升级的testing

| 已有testing | 当前问题 | 升级方向 |
| -------- | -------- | -------- |
| coverage率testing | 只强调 c8 指标, 且当前基线未生效 | 增加“coverage率管线自测”: 验证 `src/` file确实被计入 `coverage-summary.json`, 避免再次出现虚高或虚低 |
| E2E testing | file清单偏旧, 未coverage UI, Mission, Yono, 真实部署前置check | 增加按产品旅程组织的 E2E: 登录, task, Mission, 审批, HITL, 成本, 故障恢复, UI 六平台 smoke |
| Performance testing | 偏短跑基准 | 增加 soak, in-memoryleaks, handleleaks, 队列积压, 背压testing |
| Security testing | 偏 sandbox/path/命令injection | 增加 PII/secret 泄露, OAuth/JWT 生命周期, CSRF/CORS, SSRF, dependency供应链, 插件permissions逃逸 |
| Golden testing | 偏output格式 | 增加 prompt lineage, OpenTelemetry span 结构, 告警规则, UI route map, API compatibility diff |
| 架构不变量testing | 偏static扫描 | 增加 runtime invariant: Mission live guard, budget fail-close, event/outbox 同transaction, consumer 幂等 |

## 36. 新增专项testing方案

### 36.1 UI 六平台专项testing

| 层级 | coverage对象 | 必测content | 推荐位置 |
| ---- | -------- | -------- | -------- |
| Shared unit | `ui/packages/shared/*` | REST/WS client, token, offline queue, DTO→VM mapper, permission/redaction | `ui/packages/**/__tests__/` 或 `ui/tests/unit/` |
| Component | `ui/packages/ui-core`, `ui/packages/ui-mobile` | 组件 props contract, 空态, error态, loading, 主题, 高对比 | `ui/tests/component/` |
| Feature integration | `dashboard`, `task-cockpit`, `workflow-cockpit`, `approval`, `hitl`, `settings` | route 注册, feature gate, query invalidation, WS event 映射 | `ui/tests/integration/features/` |
| Platform adapter | web/electron/tauri/mobile adapter | secureStorage, filesystem, clipboard, lifecycle, deepLink, screenSecurity parity | `ui/tests/contracts/platform-adapter/` |
| App shell smoke | Web/Electron/Tauri/RN | app bootstrap, provider injection, 导航, auth guard, error边界 | `ui/tests/smoke/` |
| Accessibility | Web/desktop/mobile | axe, 键盘导航, ARIA, focus trap, 色彩对比 | `ui/tests/accessibility/` |
| Visual | design system + 关键页面 | dashboard, task cockpit, approval, HITL, settings 截graph diff | `ui/tests/visual/` |

验收规则: 

- Web 必须有可运行 smoke + 关键旅程 E2E. 
- Electron/Tauri/RN 至少有 shell bootstrap, adapter injection, navigation/auth boot smoke. 
- 每个 feature 必须同时exists `web/`, `mobile/`, `hooks/` testing, 不allows只测单fileentry. 
- Planned 后端能力只能via typed mock + feature gate testing, 不得masks成生产可用. 

### 36.2 Mission 与长期目标治理testing

Mission 是长期目标与治理上下文根对象, 不是execute对象. testing必须证明它不会被bypass, 也不会替代 Plan/Node/Attempt contract. 

| testing主题 | 必测assertion |
| -------- | -------- |
| Mission schema | `MissionRecord`, membership, snapshot, budget, handoff, error envelope strict parse |
| state机 | created/running/frozen/completed/aborted 等合法转换, 非法转换, 版本conflict, 幂等replay |
| Resolution | explicit/session/auto/ad-hoc/fail-closed path, 低risk可auto创建, 高risk无 Mission reject |
| Governance | permissions交集, policy deny, risk approval, membership revoked, freeze 后阻断新 NodeRun |
| Budget | reserve/settle/release CAS, budget exhausted 后不得发出 provider/tool call |
| Runtime binding | RequestEnvelope, ConfirmedTaskSpec, PlanGraphBundle, HarnessRun, NodeRun 持有 missionRef/snapshotRef |
| Event/projection | state change 与 event append 同transaction, event replay 后 projection 一致 |
| Observability | metric label 不含 missionId, trace/log contains correlation 但不泄露高基数敏感field |

### 36.3 Yono Business 业务域testing

Yono Business 作为业务域加入system后, 不能只验证configurefileexists, 必须验证业务闭环. 

| testingtype | 必测content |
| -------- | -------- |
| Domain config smoke | domain id, workflow, tool bundle, risk/eval/SLA/division configure完整 |
| Business flow E2E | 企业开户/资料采集/审批/execute/证据归档/异常fallback的主链路 |
| permissions与tenant隔离 | 企业user, 运营, 审核, manage员角色的读写边界 |
| 合规与审计 | KYC/KYB, 敏感fieldsanitized, 审批证据, 审计不可tamper |
| SLA 与成本 | 高优先级task deadline, 预算upper limit, 降级strategy |
| failure恢复 | 审批reject, 资料missing, 外部systemtimeout, duplicate提交幂等 |

### 36.4 LLM / Prompt / Eval testing

| 维度 | testing方案 |
| ---- | -------- |
| Prompt contract | prompt template schema, 变量integrity, 禁止未声明变量, output JSON schema 可解析 |
| Prompt lineage | 每次模型call能关联 prompt version, model, provider, cost, trace id |
| Deterministic fixtures | usesfixed provider mock/VCR fixture 验证 planner/generator/evaluator branch |
| Eval harness | 对关键task建立小型黄金集, 验证正确性, 安全性, integrity, 拒答边界 |
| Red team | prompt injection, tool exfiltration, 越权指令, 敏感信息诱导 |
| Cost guard | max tokens, 预算耗尽, provider fallback, 重试成本归因 |
| Regression replay | 线上failure样例进入 eval corpus, 修复后必须稳定via |

### 36.5 contractcompatibility与版本演进testing

新增或修改公共interface时必须同时testing“新版本正确”和“旧call方不破坏”. 

| contract | 必测content |
| ---- | -------- |
| HTTP/OpenAPI | OpenAPI diff: 删除field, 收紧 enum, 改变 required, state码变更必须failure |
| Event schema | 新增field向后compatibility, 删除/改名/语义changes必须有 migration 或 version bump |
| SDK/CLI | 旧 SDK fixture call新服务; CLI outputvia golden 验证 |
| UI API seam | Layer C endpoint 注解, planned mock 与真实 contract 不drift |
| Config schema | dev/test/staging/prod configure均能 parse, prod 必填项missing fail-close |

### 36.6 data迁移, 备份恢复与升级rollbacktesting

| 场景 | 必测content |
| ---- | -------- |
| Forward migration | 从上一版本 fixture DB 升级到当前 schema, data完整且index可用 |
| Idempotent migration | 同一 migration duplicateexecute不破坏data |
| Rollback rehearsal | 升级failure后 rollback 脚本可恢复到可启动state |
| Backup restore | `backup-sqlite.sh` / `restore-sqlite.sh` 产物可恢复并via smoke |
| Hot upgrade | `verify-hot-upgrade.sh` coverage worker draining, lease handoff, 事件不loss |
| Data checksum | 关键表迁移前后 record count, hash, 外键一致 |

### 36.7 Chaos, 灾备与长稳testing

| 场景 | 必测content |
| ---- | -------- |
| Redis disconnect | 入队failure可见, 重试, DLQ, 恢复后 backlog drain |
| Postgres/SQLite busy | WAL, busy retry, transactionrollback, 无 partial write |
| Network delay | provider/tool timeout, circuit breaker, 降级 |
| Pod/worker kill | lease reclaim, stuck run sweeper, replay, 幂等写回 |
| Multi-region failover | 主区域不可用时读写strategy, RTO/RPO, 事件order |
| Soak | 6h/24h 队列积压, in-memory, handle, timer, listener 不增长 |

### 36.8 可观测性与运营testing

| 对象 | 必测content |
| ---- | -------- |
| Metrics | 必需指标exists, label 白名单, 高基数field禁止, 异常path计数递增 |
| Logs | 结构化field, trace/correlation, PII/secret redaction, 禁止关键path `console.*` |
| Traces | HTTP → service → event/outbox → worker → provider/tool 的 span 串联 |
| Alerts | Prometheus rules 与真实指标名一致, Alertmanager receiver configure可解析 |
| Runbooks | 告警能链接到 runbook, runbook 命令可execute或可static验证 |

### 36.9 隐私, 合规与data生命周期testing

| 场景 | 必测content |
| ---- | -------- |
| PII/secret redaction | log, 事件, learning object, prompt context, UI VM 均sanitized |
| Retention | session, audit, evidence, memory, learning data按strategyexpiry或归档 |
| Right-to-delete | 可删除user可删data, 同时保留合规审计摘要 |
| Consent | analyticsConsent, model training opt-out, 生效后不再发送相关事件 |
| Tenant isolation | 跨 tenant query, event replay, cache key, file namespace 全reject |

### 36.10 插件, Pack 与供应链testing

| 场景 | 必测content |
| ---- | -------- |
| Plugin sandbox | file, 网络, 命令, 环境变量permissions边界 |
| Pack compatibility | 多版本 pack manifest, API compatibility, install/uninstall/upgrade |
| Malicious plugin | permissions提升, path逃逸, secret 读取, 无限循环, 资源耗尽 |
| SBOM/provenance | lockfile fixed, SBOM 生成, license allowlist, 构建产物可追溯 |
| Marketplace governance | 审核, signature, 撤回, 灰度发布, rollback |

### 36.11 Property-based / Fuzz testing

适合引入 fuzz/property-based testing的对象: 

- Zod schema parser: 随机missingfield, 错type, 超长字符串, 未知 enum. 
- Cursor pagination: 随机insert/删除后不duplicate, 不漏项, 稳定sort. 
- State transition: 随机事件序列不得越过终态或violates CAS. 
- Event replay: 随机duplicate/乱序/missing ack 后 projection 幂等. 
- Cost budget: 随机 reserve/settle/release 总额不为负, 不超过upper limit. 
- Path/security parser: 随机编码, Unicode, null-byte, path分隔符. 

## 37. 补全execute路线

### 37.1 P0 必须优先补齐

| 优先级 | 项目 | 交付物 |
| ------ | ---- | ------ |
| P0-1 | coverage率管线自测 | 一个testing验证 c8 `all: true` 确实把未 import 的 `src/` file计为 0%, 并让 `.coverage-baseline.json` 非空 |
| P0-2 | UI Web smoke + PlatformAdapter contract | Web app 启动, 核心 route render, adapter parity, feature gate mock contract |
| P0-3 | Mission 治理 E2E | 高risk无 Mission reject, freeze/revoke/budget exhausted 阻断 NodeRun |
| P0-4 | Yono Business domain smoke | configure, workflow, permissions, 审批, 审计, SLA 主链路 |
| P0-5 | API/event backward compatibility | OpenAPI diff, event schema diff, SDK fixture compatibility |
| P0-6 | LLM eval/red-team baseline | 黄金集, prompt injection, cost guard, provider fallback |
| P0-7 | Migration/backup restore rehearsal | 上一版 fixture DB 升级, 备份恢复, rollback smoke |

### 37.2 P1 第二批补齐

| 优先级 | 项目 | 交付物 |
| ------ | ---- | ------ |
| P1-1 | Chaos + recovery | Redis/DB/network/worker kill 定向演练 |
| P1-2 | Observability contract | metrics/logs/traces/alerts/runbook 全链验证 |
| P1-3 | Privacy lifecycle | redaction, retention, delete, consent, tenant isolation |
| P1-4 | Long soak/leak | memory, handle, timer, listener, queue backlog 长稳testing |
| P1-5 | Plugin/Pack supply chain | sandbox, compatibility, malicious plugin, SBOM/license |
| P1-6 | UI accessibility/visual/i18n | axe, keyboard, theme, locale, visual diff |

### 37.3 P2 可持续augmentation

| 优先级 | 项目 | 交付物 |
| ------ | ---- | ------ |
| P2-1 | Property/fuzz | schema, pagination, state, event, budget, path parser fuzz |
| P2-2 | Docs health | 文档链接, 命令片段, pathreferences, 示例代码可execute |
| P2-3 | Flaky governance | repeat-run, 隔离区, skip 审计, failure样例auto回灌 |
| P2-4 | Test inventory dashboard | 源目录, testing层, coverage率, 变异分数, missing口 ID 可视化 |

### 37.4 本轮新增auto化守护testing项

为避免 v4.1 补充章停留在人工清单, 本轮新增 `tests/unit/quality/full-coverage-test-manual-gaps.test.ts` 作为手册落地守护testing. 该testing不替代各专项testing本身, 而是验证手册中的每个testingmissing口都有可定位的runtime代码证据和auto化testing证据. 

同时新增 `tests/integration/quality/full-coverage-real-paths.test.ts` 与 `tests/integration/quality/full-coverage-operational-real-paths.test.ts`, directlyexecute Mission, Yono Business, Prompt Guard, Budget Guard, Startup Env Schema, Prometheus Exporter, Fixture Redactor, Chaos Scheduler, Supply-chain Audit Script, 部署/DR/告警资产等生产module或真实仓库configure, 作为 Part V 的最小可execute产品级与运营级coverage基线. 

| 守护对象 | auto化assertion |
| -------- | ---------- |
| `T-GAP-01` 至 `T-GAP-20` | 手册必须完整列出 20 个missing口, 且每个missing口必须映射到至少一组真实 runtime artifact 与 automated test artifact |
| `GA-01` 至 `GA-15` | 正式交互准入项必须完整保留, 不allows在文档整理时被误删 |
| P0/P1/P2 补全路线 | `P0-1`, `P0-7`, `P1-1`, `P1-6`, `P2-4` 等关键路线必须继续exists |
| testing命令entry | `test:unit`, `test:integration`, `test:e2e`, `test:golden`, `test:performance`, `test:leaks`, `test:invariants`, `coverage:gate`, `test:mutation` 必须exists |
| coverage率基线 | `.coverage-baseline.json` 必须contains numeric global/minimum metrics, 并纳入 `src/` 目录级基线 |
| 真实性check | 每个missing口对应的testing证据必须contains可execute `test()`/`it()` 与assertion; `tests/` 和 `ui/tests/` 不allows出现未登记的 `.skip`; UI feature 必须保持 `web/`, `mobile/`, `hooks/` 三entry |
| Property/Fuzz 基线 | Cursor pagination 等公共 parser 必须有 deterministic fuzz / schema drift testing, coverage未知field, 错type, 负数, 浮点和array payload |
| 真实path基线 | Mission resolution/live guard/budget, Yono market-to-dispute, Prompt injection/canary leakage, Budget cascade/cost attribution, startup config fail-close, Prometheus exporter, privacy redaction, Chaos rollback, supply-chain audit, deploy/DR/alert assets 必须有directlycall生产代码或真实仓库configure的testing |

subsequent新增testingtype时, 必须synchronous更新本守护testing中的 evidence mapping; 如果某个missing口仍没有auto化证据, 应在本file中明确标注为 residual risk, 而不是把它写成已coverage. 

## 38. 新增testing进入门禁规则

任何新增功能进入 `main` 前, 除 v4.0 Checklist 外, 必须回答以下问题: 

- 是否涉及 UI? 如果是, 是否有 Web + 对应平台 adapter testing? 
- 是否涉及 Mission, 预算, permissions, 审批, HITL? 如果是, 是否有 fail-close testing? 
- 是否涉及 LLM/provider/tool call? 如果是, 是否有成本, 降级, prompt injection, output schema testing? 
- 是否新增/修改 API, event, SDK, config? 如果是, 是否有compatibility性 diff testing? 
- 是否涉及 DB schema 或persistence格式? 如果是, 是否有迁移, rollback, 备份恢复testing? 
- 是否可能写log, 事件, memory, learning object? 如果是, 是否有 PII/secret redaction testing? 
- 是否新增插件/Pack 能力? 如果是, 是否有 sandbox 与供应链testing? 
- 是否新增长期运行 worker/cache/queue/listener? 如果是, 是否有资源leaks和背压testing? 

## 39. 文档maintained规则

- 当前file已经去除duplicate的 v4.0 副本, 只保留一份 v4.1 权威正文. 
- subsequent更新testing数量, E2E file清单, Performance file清单时, 应优先由脚本auto生成, 避免人工统计expiry. 
- v4.1 补充章已并入正式目录, 作为 Part V “产品级与运营级验收testing”maintained. 

## 40. 正式交互准入标准

auto化testingvia只是“代码可交付”的必要条件, 不等于system已经可以对真实user, 真实业务或真实外部system开放交互. 正式交互前还必须补齐以下准入项, 形成可审计的 release evidence bundle. 

### 40.1 正式交互前仍需完善的content

| # | 准入项 | 必须完善content | 阻断级别 |
| ---- | ------ | ------------ | -------- |
| GA-01 | testing结果可信 | fulltesting, UI testing, contracttesting, 迁移testing, 关键 E2E 均有最近一次viarecord; 所有 skip/flaky 有登记和批准理由 | Blocker |
| GA-02 | 真实交互path | 登录, 创建task, Mission 绑定, plan生成, execute, 审批/HITL, 结果交付, 证据query, failure恢复可走通 | Blocker |
| GA-03 | permissions与tenant隔离 | manage员, 运营, 普通user, 审核人, 外部集成账号的permissions矩阵viaauto化与人工抽查 | Blocker |
| GA-04 | 预算与risk fail-close | 预算耗尽, 高risk无审批, Mission freeze/revoke, strategyreject时不触发模型, 工具或外部副作用 | Blocker |
| GA-05 | datapersistence与恢复 | task, 事件, outbox, DLQ, evidence, audit, memory, Mission data重启后可恢复, 迁移/备份/rollback演练via | Blocker |
| GA-06 | LLM output可控 | Prompt schema, output schema, 成本归因, provider fallback, prompt injection red-team, eval golden set 均via | Blocker |
| GA-07 | UI 可用性 | Web 关键流程可真实操作; 桌面/移动壳层至少via adapter, 导航, auth, error边界 smoke; Planned 功能有明确降级标识 | Blocker |
| GA-08 | 可观测与告警 | metrics/logs/traces/alerts/runbook 链路可用; 关键error, 预算reject, DLQ 增长, worker 不健康可被发现 | Blocker |
| GA-09 | 安全与隐私 | PII/secret sanitized, JWT/OAuth 生命周期, CSRF/CORS, SSRF, path逃逸, 插件permissions逃逸, dependency高危漏洞均viacheck | Blocker |
| GA-10 | 外部system边界 | 邮件, 日历, 支付, 企业 IdP, 第三方工具等外部集成必须有 sandbox/staging 验证; 未接真实system的能力保持 feature gate 关闭 | Blocker |
| GA-11 | 灰度与rollback | 功能开关, 灰度百分比, 快速关闭, data库rollback/补偿, 上一版本恢复path已演练 | Blocker |
| GA-12 | 运营接管 | 人工接管, 暂停队列, 冻结 Mission, replay事件, 重试 DLQ, 导出诊断包, 事故升级流程可execute | Blocker |
| GA-13 | 文档与培训 | user操作手册, manage员手册, 常见故障handle, permissions说明, data保留说明与 release note 已更新 | Major |
| GA-14 | 法务与合规 | data保留, 审计, 隐私, 行业域合规要求有负责人confirmation; 高risk域不得only凭auto化testing开放 | Major |
| GA-15 | 证据归档 | 本次 release commit, 构建产物, testing报告, coverage率, 迁移结果, rollback演练, riskacceptsrecord统一归档 | Major |

### 40.2 最小正式交互testing矩阵

| 交互旅程 | auto化验收 | 人工验收 |
| -------- | ---------- | -------- |
| user登录与会话 | auth callback, token refresh, session expiry, logout | 浏览器真实登录, expiry后重新登录 |
| task创建到完成 | task create, Mission resolution, PlanGraph, HarnessRun, NodeRun, evidence | UI 创建task, confirmationstate, log, 结果can read |
| 高risk审批 | risk detect, approval requested, approve/reject, audit evidence | 审核人审批, reject, timeouthandle |
| HITL/接管 | pause, resume, takeover, operator action audit | 运营接管一次真实task并恢复 |
| 成本与预算 | reserve, settle, release, budget exhausted blocking | manage端查看预算消耗和reject原因 |
| failure恢复 | worker kill, DLQ retry, event replay, checkpoint resume | 人工触发重试并confirmation结果一致 |
| UI 关键页面 | dashboard, task cockpit, approval, HITL, settings smoke | 桌面和移动至少完成只读巡检 |
| 外部集成 | sandbox connector, timeout, retry, idempotency | staging 凭证连通性和failure提示 |

### 40.3 不allows正式交互的情况

- fulltesting仍有未解释failure, 或 skip 数量增加但没有审批record. 
- coverage率/testing清单显示关键运行链路未被auto化testing触达. 
- Mission, 预算, permissions, 审批, HITL 任一 fail-close testingmissing. 
- UI 中 Planned/mock 能力没有明确标识, user可能误以为生产可用. 
- log, 事件, prompt, learning object 中发现 PII/secret 泄露. 
- data迁移, 备份恢复, rollbackpath没有演练证据. 
- 告警无法触达负责人, 或 runbook 不能指导恢复操作. 
- 外部systemuses真实凭证但未via staging/sandbox 验证. 

### 40.4 正式交互via标准

正式交互必须满足以下结论: 

- `Blocker` 准入项全部via, `Major` 准入项要么via, 要么有明确riskaccepts人与到期整改时间. 
- auto化testing报告, 人工验收record, rollback演练结果和 release evidence bundle 均已归档. 
- 所有生产可见能力都有 owner, runbook, 告警, 关闭开关和rollback/补偿path. 
- user看到的功能state与真实后端能力一致, 不把 mock, planned, partial 能力wrapper成已完成能力. 
