# 全覆盖测试方法手册

> **文档版本**: v3.0
> **适用项目**: automatic-agent-platform
> **测试框架**: Node.js built-in test runner (`node:test`) + `node:assert/strict`
> **覆盖率工具**: c8 v11.0.0 (V8 native coverage) + Istanbul reporter
> **变异测试**: Stryker Mutator v9.6.1
> **Node.js 要求**: v22+（`--test` + `--test-concurrency` flags）
> **上次更新**: 2026-04-22（基于架构审查 v6.0 + 代码库实测）

---

## 目录

**Part I — 测试治理基础**

1. [测试基础设施总览](#1-测试基础设施总览)
2. [命令速查表](#2-命令速查表)
3. [目录结构与分层规范](#3-目录结构与分层规范)
4. [测试编写规范与模式](#4-测试编写规范与模式)
5. [Mock 与 Helper 工具箱](#5-mock-与-helper-工具箱)
6. [覆盖率门禁机制](#6-覆盖率门禁机制)
7. [测试无遗漏保障体系](#7-测试无遗漏保障体系)
8. [安全回归测试规范](#8-安全回归测试规范)
9. [Golden / Snapshot 测试](#9-golden--snapshot-测试)
10. [性能基准测试](#10-性能基准测试)
11. [变异测试（Stryker）](#11-变异测试stryker)
12. [CI 集成与工作流](#12-ci-集成与工作流)
13. [新模块测试 Checklist](#13-新模块测试-checklist)

**Part II — 架构语义覆盖（v1.1 新增，v1.2 增补，v3.0 扩展）**

14. [状态机测试规范](#14-状态机测试规范)
15. [事件驱动测试规范](#15-事件驱动测试规范)
16. [OAPEFLIR 阶段覆盖矩阵](#16-oapeflir-阶段覆盖矩阵)
17. [并发与时序测试规范](#17-并发与时序测试规范)
18. [设计规格到测试追溯规范](#18-设计规格到测试追溯规范)
19. [真实执行 vs Mock 执行边界规范](#19-真实执行-vs-mock-执行边界规范)
20. [测试债务分级](#20-测试债务分级)
21. [失败样例回灌规则](#21-失败样例回灌规则)
22. [测试数据治理](#22-测试数据治理)
23. [覆盖率质量红线](#23-覆盖率质量红线)

**Part III — 架构缺口回归测试矩阵（v3.0 重写，对齐架构审查 v6.0）**

24. [架构审查驱动的回归测试](#24-架构审查驱动的回归测试)
25. [P0 阻断级缺口测试规范](#25-p0-阻断级缺口测试规范)
26. [P1 高优先级缺口测试规范](#26-p1-高优先级缺口测试规范)
27. [P2 中优先级缺口测试规范](#27-p2-中优先级缺口测试规范)
28. [P3/P4 低优先级缺口测试规范](#28-p3p4-低优先级缺口测试规范)

**Part IV — 系统工程缺陷回归测试（v2.0 原 Part III 保留，v3.0 更新）**

29. [P0 阻断级工程缺陷测试规范](#29-p0-阻断级工程缺陷测试规范)
30. [P1 严重工程缺陷测试规范](#30-p1-严重工程缺陷测试规范)
31. [P2 重要工程缺陷测试规范](#31-p2-重要工程缺陷测试规范)
32. [架构不变量自动守护测试](#32-架构不变量自动守护测试)
33. [桩文件覆盖缺口追踪](#33-桩文件覆盖缺口追踪)
34. [测试缺口与覆盖现状汇总](#34-测试缺口与覆盖现状汇总)

---

## 1. 测试基础设施总览

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

- **无外部测试框架**: 不使用 Jest / Vitest / Mocha，减少依赖（devDependencies 仅 12 个）
- **无外部 mock 库**: 不使用 Sinon / testdouble，通过类型安全工厂函数创建 mock
- **编译后运行**: `npm run build:test` 编译 `src/` + `tests/` → `dist/`，测试运行 `dist/tests/**/*.test.js`
- **覆盖率棘轮**: `.coverage-baseline.json` baseline 只能上升不能下降，CI 强制执行
- **TypeScript 严格模式**: `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- **ESM 模块**: 编译目标 ES2023 + NodeNext 模块系统，所有导入必须带 `.js` 扩展名

### 1.3 当前规模

| 指标                            | 数值        |
| ------------------------------- | ----------- |
| 源文件总数（`src/**/*.ts`）     | **1,335**   |
| 源代码行数                      | **260,331** |
| 测试文件总数（`tests/**/*.ts`） | **1,361**   |
| 测试 `.test.ts` 文件数          | **1,341**   |
| 测试代码行数                    | **295,466** |
| 断言总数（`assert.*` 调用）     | **~34,061** |
| 测试/源文件比                   | **1.00**    |
| Unit 测试文件                   | **1,011**   |
| Integration 测试文件            | **301**     |
| E2E 测试文件                    | **10**      |
| Golden 测试文件                 | **11**      |
| Performance 测试文件            | **7**       |
| 全局行覆盖率                    | **82.4%**   |
| 全局语句覆盖率                  | **82.4%**   |
| 全局函数覆盖率                  | **88.5%**   |
| 全局分支覆盖率                  | **80.6%**   |

> **v3.0 变更**: 源文件从 1,233 → 1,335（+102），测试文件从 1,155 → 1,341（+186），断言从 ~27,700 → ~34,061（+6,361）。覆盖率基线已从 `.coverage-baseline.json` 重新校准：行覆盖率 84.1% → 82.4%（因新增未覆盖模块），函数覆盖率 82.8% → 88.5%（因大量桩文件函数被测试覆盖）。

---

## 2. 命令速查表

```bash
# 完整测试（含覆盖率门禁）
npm test

# 仅运行测试（不含门禁）
npm run test:raw

# 分层运行
npm run test:unit
npm run test:integration
npm run test:golden

# 特定文件
npm run build:test && node --test "dist/tests/unit/platform/orchestration/*.test.js"

# PostgreSQL 集成测试（需 PG 环境）
AA_TEST_PG_DSN="postgres://..." npm run test:pg-integration

# 性能测试
npm run test:performance

# 变异测试
npm run test:mutation

# 覆盖率报告
npm run coverage:report

# 更新覆盖率基线
npm run coverage:baseline:update

# 类型检查
npm run typecheck

# 运维诊断
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
├── unit/                       # 隔离逻辑测试（1,011 文件）
│   ├── platform/               # 对应 src/platform/ 镜像结构（713 文件）
│   │   ├── execution/          # 执行面
│   │   ├── state-evidence/     # 状态证据面
│   │   ├── control-plane/      # 控制面
│   │   ├── orchestration/      # 编排面
│   │   ├── interface/          # 接口面
│   │   ├── shared/             # 共享设施
│   │   ├── contracts/          # 契约测试
│   │   ├── model-gateway/      # 模型网关
│   │   ├── prompt-engine/      # 提示引擎
│   │   └── compliance/         # 合规
│   ├── domains/                # 领域（34 文件）
│   ├── interaction/            # 交互（24 文件）
│   ├── ops-maturity/           # 运维成熟度（57 文件）
│   ├── org-governance/         # 组织治理（23 文件）
│   ├── scale-ecosystem/        # 规模生态（56 文件）
│   ├── plugins/                # 插件（21 文件）
│   ├── sdk/                    # SDK（16 文件）
│   ├── runtime/                # 运行时交叉测试（45 文件）
│   ├── apps/                   # 应用（4 文件）
│   ├── core/                   # 核心（7 文件）
│   ├── deploy/                 # 部署配置守护（2 文件）
│   └── docs/                   # 文档守护（2 文件）
├── integration/                # 跨服务/运行时测试（301 文件）
│   ├── platform/               # 平台集成（230 文件，含 security/ 子目录）
│   ├── sdk/                    # SDK/CLI 集成（35 文件）
│   ├── ops-maturity/           # 运维成熟度（12 文件）
│   ├── scale-ecosystem/        # 规模生态（7 文件）
│   ├── domains/                # 领域（6 文件）
│   ├── interaction/            # 交互（2 文件）
│   ├── org-governance/         # 组织治理（2 文件）
│   ├── stability/              # 稳定性（2 文件）
│   ├── workflow/               # 工作流（2 文件）
│   ├── orchestration/          # 编排（1 文件）
│   ├── deploy/                 # 部署（1 文件）
│   └── interaction-governance/ # 交互治理（1 文件）
├── golden/                     # 快照/Golden 测试（11 文件）
│   └── snapshots/              # Golden 文件存储
├── e2e/                        # 端到端场景（10 文件）
├── performance/                # 性能基准（7 文件）
├── helpers/                    # 共享工具（19 文件 + fixtures/ 子目录）
│   ├── typed-factories.ts      # unsafeCast / partial / mock 工厂
│   ├── fixtures/               # base.ts + composite.ts
│   ├── integration-context.ts  # SQLite + TaskStore 集成上下文
│   ├── repository-harness.ts   # 仓储层 DB 测试
│   ├── e2e-harness.ts          # 全栈 E2E 上下文
│   ├── golden.ts               # 快照断言
│   ├── env.ts                  # 环境变量隔离
│   ├── fs.ts                   # 临时文件系统
│   ├── concurrent-runner.ts    # 并发不变量验证
│   ├── process-guard.ts        # 子进程泄漏检测
│   ├── api.ts                  # API 集成种子
│   ├── pg-test-helper.ts       # PostgreSQL 测试
│   ├── cli.ts                  # CLI 测试
│   ├── seed.ts                 # 数据播种
│   ├── test-cleanup.ts         # 单例重置
│   ├── billing.ts              # 计费测试
│   ├── perception.ts           # 感知测试
│   └── pmf.ts                  # PMF 测试
└── fixtures/                   # 迁移测试 fixtures
```

### 3.2 分层规则

| 层              | 目录                 | 规则                              | 依赖                             |
| --------------- | -------------------- | --------------------------------- | -------------------------------- |
| **Unit**        | `tests/unit/`        | 单模块隔离测试，所有外部依赖 mock | 无 DB、无网络、无文件 I/O        |
| **Integration** | `tests/integration/` | 跨模块、CLI、runtime、sandbox     | 可用 SQLite in-memory、temp 目录 |
| **Golden**      | `tests/golden/`      | 输出快照对比                      | 可依赖真实服务                   |
| **E2E**         | `tests/e2e/`         | 完整业务流程                      | 全栈，mock provider              |
| **Performance** | `tests/performance/` | 延迟/吞吐量基准                   | 可用真实 DB                      |

---

## 4. 测试编写规范与模式

### 4.1 基本结构

本项目使用 **扁平 `test()` 调用**，不使用 `describe()` 嵌套。每个测试文件直接导入 `node:test` 和 `node:assert/strict`。

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { MyService } from "../../../../src/platform/my-module/my-service.js";

test("MyService 在输入为空时返回默认值", () => {
  const service = new MyService();
  const result = service.compute({});
  assert.equal(result, "default");
});

test("MyService 拒绝非法参数", () => {
  const service = new MyService();
  assert.throws(() => service.compute(null as any), {
    message: /invalid input/i,
  });
});
```

### 4.2 命名规范

| 维度     | 规则                             | 示例                                                                  |
| -------- | -------------------------------- | --------------------------------------------------------------------- |
| 文件名   | `<被测模块>.test.ts`，kebab-case | `feedback-collector.test.ts`                                          |
| 测试标题 | 行为描述，主语 + 条件 + 预期     | `"FeedbackCollector deduplicates signals and emits learning signals"` |
| 变量名   | 与生产代码一致的 camelCase       | `const collector = new FeedbackCollector()`                           |

### 4.3 导入路径

所有导入使用 **相对路径 + `.js` 扩展名**（因为编译为 ESM）：

```typescript
// 正确
import { FeedbackCollector } from "../../../../src/platform/feedback/feedback-collector.js";

// 错误 — 缺少 .js 扩展名
import { FeedbackCollector } from "../../../../src/platform/feedback/feedback-collector";
```

### 4.4 断言模式

本项目仅使用 `node:assert/strict`，常用 API：

```typescript
// 值相等（===）
assert.equal(result.status, "blocked");

// 深度相等（对象/数组）
assert.deepEqual(learningSignals[0]?.sourceSignalIds, ["sig_1", "sig_2"]);

// 布尔断言
assert.ok(result.length > 0);

// 异常断言
assert.throws(() => schema.parse(badInput));
assert.throws(() => fn(), { message: /expected pattern/ });

// 异步异常
await assert.rejects(async () => service.execute(), {
  message: /timeout/,
});

// 不抛出异常（Schema 验证常用）
assert.doesNotThrow(() => schema.parse(validPayload));
```

### 4.5 同步 vs 异步

- **Unit 测试**：优先同步。纯函数、Schema 解析、内存服务都是同步的
- **Integration 测试**：通常 `async`，因涉及 DB/文件/子进程
- **原则**：如果被测函数返回 `Promise`，测试函数标记 `async`；否则保持同步

### 4.6 资源清理模式

Integration 和 E2E 测试使用 `try/finally` 模式确保清理：

```typescript
test("sandbox blocks symlink traversal", async () => {
  const workspace = createTempWorkspace("aa-sandbox-");
  const outside = createTempWorkspace("aa-target-");
  try {
    // ... 测试逻辑
    assert.equal(result.status, "blocked");
  } finally {
    cleanupPath(workspace);
    cleanupPath(outside);
  }
});
```

**禁止** 使用 `afterEach` 或全局 teardown — Node.js test runner 对此支持有限，且 `try/finally` 更可靠。

### 4.7 测试数据构建

使用 fixture 工厂函数 + spread overrides 模式，避免大量内联数据：

```typescript
import { createMinimalTask } from "../../../helpers/fixtures/base.js";

test("task store persists custom priority", () => {
  const task = createMinimalTask({ priority: "critical" });
  store.insertTask(task);
  const loaded = store.getTask(task.id);
  assert.equal(loaded.priority, "critical");
});
```

### 4.8 安全测试模式

安全测试遵循 **denial-path regression** 模式 — 每个测试验证一个攻击向量被拒绝：

```typescript
test("command executor blocks null-byte injection in path argument", async () => {
  // 1. 构建攻击输入
  const nullBytePath = "somefile\x00.txt";
  // 2. 执行
  const result = await executor.execute({ ..., args: [nullBytePath] });
  // 3. 断言拒绝 + 具体错误码
  assert.equal(result.status, "blocked");
  assert.equal(result.error?.code, "sandbox.command_arg_path_denied");
});
```

---

## 5. Mock 与 Helper 工具箱

本项目 **不使用 Sinon / testdouble**，所有 mock 通过手写工厂函数实现，集中在 `tests/helpers/`。

### 5.1 工具清单

| 文件                     | 核心导出                                                                                                           | 用途                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `typed-factories.ts`     | `unsafeCast<T>()`, `partial<T>()`, `createMockCacheStore()`, `createMockCacheFacade()`, `createMockCacheMetrics()` | 类型安全 mock 对象创建              |
| `fixtures/base.ts`       | `createMinimalTask()`, `createMinimalExecution()`, `createMinimalApproval()`                                       | 最小有效领域记录                    |
| `fixtures/composite.ts`  | `createBlockedTask()`, `createApprovalRequest()`, `createCompletedTask()`, `createFailedTask()`                    | 多实体关联场景                      |
| `env.ts`                 | `withEnv(overrides, fn)`, `withEnvSync(overrides, fn)`                                                             | 环境变量隔离                        |
| `fs.ts`                  | `createTempWorkspace()`, `cleanupPath()`, `createFile()`, `createSymlink()`                                        | 临时文件系统                        |
| `integration-context.ts` | `createIntegrationContext()`, `createSeededIntegrationContext()`                                                   | SQLite + TaskStore 集成上下文       |
| `repository-harness.ts`  | `createRepositoryHarness()`, `createRepositoryWithStoreHarness()`                                                  | 仓储层 DB 测试                      |
| `e2e-harness.ts`         | `createE2EHarness()`, `createSeededE2EHarness()`                                                                   | 全栈 E2E 上下文                     |
| `golden.ts`              | `assertGolden()`, `assertGoldenContains()`, `assertGoldenMatches()`                                                | 快照断言                            |
| `process-guard.ts`       | `createProcessGuard()`, `withProcessGuard()`                                                                       | 子进程泄漏检测（ADR-072）           |
| `concurrent-runner.ts`   | `runConcurrentInvariant()`, `runConcurrentStateModification()`, `runCriticalSectionTest()`                         | 并发不变量验证                      |
| `api.ts`                 | `createSeededApiContext()`                                                                                         | 完整 API 集成种子（DB + 12 个服务） |

### 5.2 `unsafeCast<T>()` 与 `partial<T>()`

`unsafeCast<T>()` 替代散落的 `as any`，使其可搜索、可审计：

```typescript
import { unsafeCast } from "../../../helpers/typed-factories.js";

const fakeProvider = unsafeCast<LlmProvider>({
  generate: async () => ({ text: "mock response", tokens: 10 }),
});
```

`partial<T>()` 用于构造部分实现的接口对象（类型正确的 `Partial<T>`）：

```typescript
import { partial } from "../../../helpers/typed-factories.js";

const config = partial<RuntimeConfig>({ maxRetries: 3, timeoutMs: 5000 });
```

### 5.3 Mock 创建模式

项目统一使用 **对象字面量 + 接口类型** 的方式创建 mock：

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

**不使用** `jest.fn()` / `sinon.stub()` — 如需记录调用，使用闭包数组：

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
// ... 执行被测代码 ...
assert.equal(calls.length, 2);
assert.ok(calls[0]?.includes("started"));
```

### 5.4 环境变量隔离

`withEnv()` 在回调前保存原值，回调后恢复（即使抛出异常）：

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

| 场景             | 使用                                                               |
| ---------------- | ------------------------------------------------------------------ |
| 纯逻辑 unit 测试 | 直接 `new Service()` + inline mock                                 |
| Repository 测试  | `createRepositoryHarness()`                                        |
| 跨服务集成测试   | `createIntegrationContext()` 或 `createSeededIntegrationContext()` |
| API 端点测试     | `createSeededApiContext()` → `ctx.createServer()`                  |
| E2E 全流程       | `createE2EHarness()` 或 `createSeededE2EHarness()`                 |
| 子进程相关       | `withProcessGuard(fn)` 包裹                                        |
| 并发安全         | `runConcurrentInvariant()` / `runCriticalSectionTest()`            |

---

## 6. 覆盖率门禁机制

### 6.1 三层架构

```
c8 (V8 native) → generate-coverage-report.mjs → check-coverage-baseline.mjs
                                                          ↓
                                                 .coverage-baseline.json (棘轮)
```

### 6.2 c8 配置（`.c8rc.json`）

| 参数       | 值                                         | 说明                                |
| ---------- | ------------------------------------------ | ----------------------------------- |
| `reporter` | `["text", "html", "lcov", "json-summary"]` | 四格式输出                          |
| `include`  | `["dist/src/**/*.js"]`                     | 仅计量生产代码                      |
| `exclude`  | tests, scripts, configs, node_modules      | 排除非生产文件                      |
| `all`      | `true`                                     | 未被测试加载的文件也计入（0% 覆盖） |

### 6.3 棘轮基线（`.coverage-baseline.json`）

全局阈值（v3.0 实测数据）：

| 指标       | 当前基线  |
| ---------- | --------- |
| Lines      | **82.4%** |
| Statements | **82.4%** |
| Functions  | **88.5%** |
| Branches   | **80.6%** |

> **v3.0 变更**: Lines/Statements 从 84.1% 降至 82.4%（新增模块未完全覆盖），Functions 从 82.8% 升至 88.5%（桩文件函数测试覆盖），Branches 从 79.8% 升至 80.6%。

**棘轮规则**：`check-coverage-baseline.mjs` 对比当前覆盖率与基线：

- 任何指标 **低于** 基线 → CI 失败（exit code 1）
- 任何目录 **不在** 基线中 → CI 失败（untracked directory）
- 覆盖率 **提升** 后运行 `npm run coverage:baseline:update` 更新基线 → 新值成为新的下限

### 6.4 目录级基线（来自 `.coverage-baseline.json` v3.0 实测数据）

**覆盖率 Top-15 目录**（按 Lines 排序，取最低覆盖率目录）：

| 目录                                                     | 文件数 | Lines | Functions | Branches |
| -------------------------------------------------------- | ------ | ----- | --------- | -------- |
| `src/core/runtime/orchestrator`                          | 2      | 16.7% | 0%        | 0%       |
| `src/platform/shared/observability/anomaly-detection`    | 2      | 20.7% | 0%        | 0%       |
| `src/platform/shared/observability/transports`           | 3      | 25.1% | 25.0%     | 33.3%    |
| `src/ops-maturity/platform-ops-agent/health-monitor`     | 1      | 25.3% | 9.1%      | 100%     |
| `src/ops-maturity/platform-ops-agent/capacity-predictor` | 1      | 29.6% | 14.3%     | 100%     |
| `src/domains`                                            | 7      | 30.4% | 87.0%     | 75.5%    |
| `src/domains/roadmap`                                    | 5      | 31.3% | 37.0%     | 86.4%    |
| `src/ops-maturity/agent-lifecycle/version-manager`       | 2      | 31.3% | 75.0%     | 78.6%    |
| `src/ops-maturity/platform-ops-agent`                    | 4      | 38.7% | 81.3%     | 86.4%    |
| `src/sdk/client-sdk`                                     | 2      | 42.8% | 28.6%     | 75.0%    |
| `src/scale-ecosystem/integration/connectors`             | 4      | 43.5% | 0%        | 100%     |
| `src/platform/interface/ingress`                         | 3      | 44.4% | 25.0%     | 75.0%    |
| `src/domains/interaction-policy`                         | 1      | 44.8% | 50.0%     | 100%     |
| `src/platform/control-plane/risk-control`                | 4      | 46.0% | 66.7%     | 81.6%    |
| `src/org-governance/knowledge-boundary`                  | 4      | 46.2% | 50.0%     | 66.7%    |

**覆盖率 Top-15 高覆盖目录**：

| 目录                                                          | 文件数 | Lines | Functions | Branches |
| ------------------------------------------------------------- | ------ | ----- | --------- | -------- |
| `src/platform/execution/queue`                                | 7      | 99.7% | 100%      | 89.6%    |
| `src/ops-maturity/workflow-debugger`                          | 3      | 99.5% | 100%      | 92.2%    |
| `src/platform/orchestration/oapeflir/types`                   | 15     | 99.3% | 77.8%     | 100%     |
| `src/org-governance/delegated-governance/scope-manager`       | 1      | 99.3% | 100%      | 90.5%    |
| `src/plugins/retrievers`                                      | 6      | 99.2% | 100%      | 93.2%    |
| `src/plugins/adapters`                                        | 5      | 99.1% | 97.1%     | 96.1%    |
| `src/platform/shared/cache/utils`                             | 5      | 98.9% | 100%      | 93.2%    |
| `src/platform/orchestration/oapeflir/improve-rollout/rollout` | 2      | 98.8% | 100%      | 91.7%    |
| `src/platform/state-evidence/knowledge/governance`            | 7      | 98.7% | 97.1%     | 95.8%    |
| `src/platform/model-gateway/messages`                         | 2      | 98.4% | 100%      | 85.6%    |
| `src/platform/state-evidence/truth/sqlite`                    | 25     | 98.3% | 98.5%     | 92.5%    |
| `src/platform/execution/state-transition`                     | 2      | 98.3% | 100%      | 93.5%    |
| `src/platform/state-evidence/artifacts`                       | 13     | 98.2% | 100%      | 86.0%    |
| `src/platform/orchestration/routing`                          | 4      | 98.2% | 100%      | 86.0%    |
| `src/platform/orchestration/oapeflir/learn`                   | 10     | 98.1% | 100%      | 82.3%    |

### 6.5 更新流程

```bash
npm test                          # 运行完整测试
npm run coverage:baseline:update  # 仅在测试全通过后执行
git diff .coverage-baseline.json  # 确认变更合理
git add .coverage-baseline.json   # 提交新基线
```

## 7. 测试无遗漏保障体系

本节是整个手册的核心方法论 — 回答 **"如何确保测试没有遗漏"** 这一问题。体系由五层防护构成，每层解决不同层面的遗漏风险。

### 7.1 五层防护模型

```
┌─────────────────────────────────────────────────────────┐
│ 第 5 层：PR Review Checklist（人工审查）                  │
├─────────────────────────────────────────────────────────┤
│ 第 4 层：变异测试 Stryker（断言有效性验证）               │
├─────────────────────────────────────────────────────────┤
│ 第 3 层：覆盖率棘轮 + 目录级基线（数值不回退）           │
├─────────────────────────────────────────────────────────┤
│ 第 2 层：Traceability Matrix（源文件 ↔ 测试文件映射）    │
├─────────────────────────────────────────────────────────┤
│ 第 1 层：分层测试策略（Unit / Integration / E2E）        │
└─────────────────────────────────────────────────────────┘
```

### 7.2 第 1 层：分层测试策略

**解决的遗漏类型**：测试粒度不当导致的盲区。

每个功能点必须在正确的层级被测试：

| 关注点                          | 正确的测试层                    | 反模式                           |
| ------------------------------- | ------------------------------- | -------------------------------- |
| 纯函数逻辑（解析、校验、转换）  | Unit                            | 用 E2E 测逻辑分支                |
| 数据库读写、事务、迁移          | Integration                     | 用 mock DB 掩盖 SQL 错误         |
| 多服务协作、事件传播            | Integration                     | 每个服务单独 mock 后跳过协作测试 |
| 安全边界（沙箱、路径穿越）      | Integration                     | 仅靠 Unit 测 regex               |
| API 合约（HTTP 状态码、响应体） | Integration / E2E               | 只测 service 层不测 HTTP 层      |
| 全流程业务场景                  | E2E                             | 无                               |
| 输出格式稳定性                  | Golden                          | 手写 expected 字符串             |
| 并发安全                        | Integration + concurrent-runner | 单线程测试后假设线程安全         |

**执行规则**：

1. 每个 `src/platform/<module>/` 目录必须有对应的 `tests/unit/platform/<module>/` 目录
2. 每个对外暴露的 service class 必须至少有 1 个 unit test 文件
3. 涉及 DB / 文件系统 / 子进程的功能必须有 integration test
4. 安全相关变更必须有 denial-path regression test

### 7.3 第 2 层：Traceability Matrix（可追溯性矩阵）

**解决的遗漏类型**：源文件没有对应测试文件。

构建 **源文件 → 测试文件** 的映射关系，确保每个生产文件都有对应测试。

**生成方法**：

```bash
# 步骤 1：列出所有生产源文件（排除 index.ts、types）
find src/core -name "*.ts" ! -name "index.ts" ! -name "*.d.ts" ! -path "*/types/*" | sort > /tmp/src-files.txt

# 步骤 2：列出所有测试文件
find tests/unit tests/integration -name "*.test.ts" | sort > /tmp/test-files.txt

# 步骤 3：对比，找出无测试覆盖的源文件
while read src; do
  base=$(basename "$src" .ts)
  if ! grep -q "$base" /tmp/test-files.txt; then
    echo "UNCOVERED: $src"
  fi
done < /tmp/src-files.txt
```

**矩阵维护规则**：

- 每个 PR 中新增的 `.ts` 源文件，必须有对应的 `.test.ts` 文件
- 如果某个文件确实无需测试（纯类型定义、barrel export），在矩阵中标注 `N/A` + 理由
- 每个 sprint 结束时运行上述脚本，更新遗漏清单

### 7.4 第 3 层：覆盖率棘轮

**解决的遗漏类型**：已有测试被删除或新代码未被覆盖。

详见 [§6 覆盖率门禁机制](#6-覆盖率门禁机制)。关键点：

- **全局门禁**：lines/statements/functions/branches 四维度
- **目录级门禁**：每个 `src/platform/<module>` 有独立基线
- **`all: true`**：未被任何测试 import 的文件也计入（显示为 0% 覆盖），防止"没人引用所以没人测"
- **只能上升**：基线值通过 `npm run coverage:baseline:update` 单调递增

**覆盖率的局限性**：覆盖率只说明"代码被执行了"，不说明"行为被验证了"。例如：

```typescript
test("calls the function", () => {
  myFunction(); // 100% 行覆盖，但 0 个断言
});
```

这就是为什么需要第 4 层。

### 7.5 第 4 层：变异测试

**解决的遗漏类型**：测试执行了代码但缺少有效断言。

Stryker 在代码中注入 **变异体**（mutants），例如：

- `>` 改为 `>=`
- `true` 改为 `false`
- 删除整条语句
- 字符串 `"error"` 改为 `""`

如果注入变异后测试仍然通过（mutant survived），说明测试没有有效检测这段逻辑。

详见 [§11 变异测试（Stryker）](#11-变异测试stryker)。阈值：

- **break = 50%**：低于此值 CI 直接失败
- **low = 60%**：黄色警告
- **high = 80%**：绿色目标

**变异测试与覆盖率的互补关系**：

| 场景         | 行覆盖率 | 变异分数 | 问题     |
| ------------ | -------- | -------- | -------- |
| 有执行有断言 | 高       | 高       | 无       |
| 有执行无断言 | 高       | **低**   | 断言缺失 |
| 无执行       | **低**   | 低       | 测试缺失 |
| Dead code    | 低       | 低       | 需移除   |

### 7.6 第 5 层：PR Review Checklist

**解决的遗漏类型**：自动化工具无法检测的逻辑遗漏。

每个 PR 合入前，reviewer 按以下清单检查：

- [ ] 新增/修改的每个 public function 是否有对应测试
- [ ] 是否覆盖了正常路径 **和** 错误路径
- [ ] 边界条件是否被测试（空数组、null、0、MAX_INT、超时）
- [ ] 安全变更是否有 denial-path regression
- [ ] 异步函数是否测试了 reject/error 路径
- [ ] 配置变更是否有对应的 config validation 测试
- [ ] 覆盖率是否提升或持平（不下降）
- [ ] 变异测试分数是否提升或持平

### 7.7 遗漏类型分类与对应防护

| 遗漏类型         | 描述                          | 检测层                                          |
| ---------------- | ----------------------------- | ----------------------------------------------- |
| **文件级遗漏**   | 整个源文件没有测试            | 第 2 层（Matrix）+ 第 3 层（`all: true`）       |
| **函数级遗漏**   | 某个 exported 函数没有测试    | 第 3 层（function coverage）+ 第 5 层（Review） |
| **分支级遗漏**   | if/else/switch 某个分支未覆盖 | 第 3 层（branch coverage）+ 第 4 层（Stryker）  |
| **断言级遗漏**   | 代码被执行但没有验证结果      | 第 4 层（Stryker mutant survived）              |
| **场景级遗漏**   | 缺少特定业务场景测试          | 第 5 层（Review）                               |
| **边界条件遗漏** | 空输入/极值/并发未覆盖        | 第 4 层 + 第 5 层                               |
| **回归遗漏**     | bug 修复没有添加回归测试      | 第 5 层（Review）+ 第 3 层（棘轮不回退）        |
| **安全遗漏**     | 攻击向量未测试                | 第 1 层（denial-path 规范）+ 第 5 层            |

### 7.8 测试补全优先级排序方法

当发现遗漏后，按以下优先级排序补全：

```
P0 — 安全边界未测试（sandbox escape、路径穿越、注入攻击）
P1 — 核心 orchestrator / service 无测试（覆盖率 0%）
P2 — 已有测试但 branch coverage < 60%
P3 — 已有测试但变异分数 < 50%（断言不充分）
P4 — 辅助函数 / 工具类缺少边界条件测试
P5 — 类型定义的 Schema 验证测试
```

### 7.9 持续保障流程

```
开发阶段 → 编写代码 + 编写测试（TDD 或 Code-then-Test）
          ↓
本地验证 → npm test（覆盖率 + 门禁）
          ↓
PR 提交  → CI 自动运行：lint → typecheck → test → coverage:gate
          ↓
PR Review → 人工 Checklist（§7.6）
          ↓
Main 合入 → Stryker 变异测试（push to main 触发）
          ↓
Sprint 结束 → 运行 Traceability Matrix 脚本，更新遗漏清单
```

---

## 8. 安全回归测试规范

### 8.1 Denial-Path Regression 方法论

安全测试的核心原则：**每个攻击向量一个测试，断言拒绝状态 + 具体错误码**。

```
攻击面识别 → 构建恶意输入 → 调用被测接口 → 断言 blocked/denied + error code
```

### 8.2 攻击面分类

| 攻击面       | 测试目标                   | 典型攻击向量                                           |
| ------------ | -------------------------- | ------------------------------------------------------ |
| **路径穿越** | sandbox 文件系统隔离       | `../`、symlink、double-encoded `%2f`、null-byte `\x00` |
| **命令注入** | command executor 参数过滤  | `;`、`$()`、`` ` ``、`&&`、`\|\|`、`\|`、`${VAR}`      |
| **权限绕过** | execution-level tool 授权  | 修改 allowedToolsJson、malformed allowlist             |
| **脚本逃逸** | interpreter path 限制      | 工作区外脚本路径、绝对路径指向外部                     |
| **输入校验** | Schema / config validation | 超长字符串、类型不匹配、缺失必填字段                   |
| **并发攻击** | 锁和事务隔离               | 同时审批同一请求、并发写同一资源                       |

### 8.3 安全测试结构模板

```typescript
test("<组件> blocks <攻击类型> <具体描述>", async () => {
  const workspace = createTempWorkspace("aa-security-");
  try {
    // 1. 构建攻击输入
    const maliciousInput = buildAttackPayload();

    // 2. 执行被测接口
    const result = await targetService.execute({
      ...validBaseRequest,
      ...maliciousInput,
    });

    // 3. 断言拒绝
    assert.equal(result.status, "blocked");
    assert.equal(result.error?.code, "specific.error_code");
  } finally {
    cleanupPath(workspace);
  }
});
```

### 8.4 安全测试命名规范

标题必须明确说明 **谁拒绝了什么**：

```
✓ "command executor blocks symlink cwd traversal before spawning the process"
✓ "command executor blocks null-byte injection in path argument"
✓ "sandbox policy denies write outside workspace root"
✗ "security test 1"
✗ "test injection"
```

### 8.5 安全测试必须覆盖的场景

每个涉及安全边界的组件，至少覆盖以下场景：

1. **正常合法请求** — 确认 happy path 正常工作（至少 1 个正向测试）
2. **路径逃逸** — 至少覆盖 `../`、symlink、绝对路径三种向量
3. **输入注入** — 至少覆盖 shell metachar、null-byte 两种向量
4. **权限不足** — 未授权 tool、错误 domain/role
5. **畸形输入** — malformed JSON、type mismatch、空值
6. **Fail-close** — 当安全检查逻辑本身出错时，默认拒绝而非放行

---

## 9. Golden / Snapshot 测试

### 9.1 适用场景

Golden 测试适用于 **输出格式需要稳定** 的场景：

- CLI 输出格式（`inspect`、`doctor`、`dispatch-execution` 命令输出）
- API 响应体结构
- 配置文件生成结果
- 日志格式

### 9.2 工作原理

```
首次运行（UPDATE_GOLDEN=1）→ 将实际输出写入 tests/golden/snapshots/<name>.golden
后续运行 → 将实际输出与 .golden 文件对比
  匹配 → 测试通过
  不匹配 → 测试失败，提示运行 UPDATE_GOLDEN=1 更新
```

### 9.3 使用方法

```typescript
import test from "node:test";
import { assertGolden } from "../../helpers/golden.js";

test("inspect output matches golden snapshot", () => {
  const output = inspectService.generateReport();
  assertGolden("inspect-report-v1", output);
});
```

三种断言 API：

| API                                     | 用途          |
| --------------------------------------- | ------------- |
| `assertGolden(name, actual)`            | JSON 完全匹配 |
| `assertGoldenContains(name, substring)` | 包含子串      |
| `assertGoldenMatches(name, regex)`      | 正则匹配      |

### 9.4 更新快照

```bash
UPDATE_GOLDEN=1 npm run test:golden
git diff tests/golden/snapshots/       # Review 变更
git add tests/golden/snapshots/
```

### 9.5 Golden 测试注意事项

- **不要** 在 golden 文件中包含时间戳、随机 ID 等不稳定字段 — 先 normalize 再 snapshot
- 快照文件必须纳入 git 版本管理
- Golden 文件命名使用版本后缀（`-v1`、`-v2`），当输出格式有意变更时创建新版本

---

## 10. 性能基准测试

### 10.1 适用场景

- 关键路径延迟回归检测
- 吞吐量基准（tasks/sec、queries/sec）
- 内存使用基准

### 10.2 测试位置

`tests/performance/` 目录，文件名 `*.test.ts`，通过 `npm run test:performance` 运行。

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

### 10.4 性能测试原则

- **隔离运行**：`npm run test:performance` 独立于主测试套件，避免干扰覆盖率
- **绝对阈值**：断言绝对性能指标（如 >1000 ops/sec），而非相对变化
- **预热**：在计时前执行少量预热迭代，排除 JIT 编译影响
- **多次取中位数**：对延迟敏感测试取多次运行中位数，减少方差
- **CI 中可选**：性能测试在 CI 中作为 optional job，不阻塞合入（因机器差异大）

---

## 11. 变异测试（Stryker）

### 11.1 概念

变异测试回答覆盖率无法回答的问题：**测试的断言是否真正有效？**

Stryker 对源代码注入微小变异（mutant），然后运行测试套件。如果测试仍然通过（mutant survived），说明没有断言能检测到这个代码变化 — 即存在断言缺失。

### 11.2 配置（`stryker.config.mjs`）

| 参数               | 值                              | 说明                          |
| ------------------ | ------------------------------- | ----------------------------- |
| `testRunner`       | `"command"`                     | 通过 `npm run test:unit` 运行 |
| `mutate`           | `src/platform/**/*.ts`          | 变异范围：platform 业务代码   |
| 排除               | `.d.ts`, `index.ts`, `types/**` | 不变异类型定义和 barrel       |
| `thresholds.break` | 50                              | 低于 50% → CI 失败            |
| `thresholds.low`   | 60                              | 低于 60% → 黄色警告           |
| `thresholds.high`  | 80                              | 高于 80% → 绿色               |
| `coverageAnalysis` | `"perTest"`                     | 每个测试单独分析覆盖范围      |

### 11.3 运行

```bash
npm run test:mutation         # 本地运行
# CI 中仅在 push to main 时运行（耗时较长）
```

报告输出到 `reports/mutation/`，包含 HTML 可视化报告。

### 11.4 解读报告

| 状态              | 含义                     | 行动               |
| ----------------- | ------------------------ | ------------------ |
| **Killed**        | 测试检测到变异并失败     | 无需行动           |
| **Survived**      | 变异后测试仍通过         | **需添加更强断言** |
| **No coverage**   | 变异代码未被任何测试执行 | 需添加测试         |
| **Timeout**       | 变异导致无限循环/超时    | 视为 killed        |
| **Runtime error** | 变异导致运行时崩溃       | 视为 killed        |

### 11.5 处理 Survived Mutants

```typescript
// 假设 Stryker 报告：将 `>` 变异为 `>=` 后 mutant survived
// 原始代码：if (retries > maxRetries) throw new Error("exceeded");

// 说明缺少边界测试。需添加：
test("throws when retries equals maxRetries", () => {
  // 测试 retries === maxRetries 的行为
  // 如果应该抛出，添加 assert.throws
  // 如果不应该抛出，添加 assert.doesNotThrow
});
```

### 11.6 变异测试与其他层的协作

- **覆盖率**告诉你"哪些代码没被执行" → 添加测试
- **Stryker**告诉你"哪些代码被执行了但断言不足" → 加强断言
- 两者互补，不可替代

---

## 12. CI 集成与工作流

### 12.1 CI Pipeline 架构

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

其他工作流文件:

- `deploy-environment.yml` — 环境部署
- `dr-validation.yml` — 灾备验证
- `publish-image.yml` — 镜像发布
- `secret-provider-integration.yml` — 密钥提供者集成测试

### 12.2 触发条件

| Job            | Push to main | PR  | 其他            |
| -------------- | ------------ | --- | --------------- |
| validate       | ✓            | ✓   | `codex/**` 分支 |
| pg-integration | ✓            | ✓   | —               |
| mutation-test  | ✓            | ✗   | 仅 main         |
| security       | ✓            | ✓   | —               |
| trivy-scan     | ✓            | ✓   | —               |

### 12.3 CI 中的测试保障点

| 保障点       | 工具                        | 失败条件           |
| ------------ | --------------------------- | ------------------ |
| 代码风格     | ESLint                      | 任何 lint error    |
| 类型安全     | tsc --noEmit                | 任何 type error    |
| 依赖安全     | npm audit                   | HIGH/CRITICAL 漏洞 |
| 功能正确     | node --test                 | 任何测试失败       |
| 覆盖率不回退 | check-coverage-baseline.mjs | 低于基线           |
| 变异分数     | Stryker                     | 低于 break=50%     |
| 静态分析     | CodeQL                      | 发现安全缺陷       |
| 容器安全     | Trivy                       | CRITICAL/HIGH 漏洞 |

### 12.4 测试结果归档

CI 自动上传以下 artifacts：

- `test-results/` — 测试执行日志
- `coverage/` — HTML 覆盖率报告
- `reports/mutation/` — Stryker HTML 报告

---

## 13. 新模块测试 Checklist

当创建新模块时，按以下 Checklist 确保测试完备：

### 13.1 目录与文件

- [ ] 创建 `tests/unit/platform/<module>/` 或 `tests/unit/<area>/<module>/` 目录
- [ ] 每个 service class 创建对应 `<service-name>.test.ts`
- [ ] 如需 DB → 创建 `tests/integration/platform/<module>/` 目录

### 13.2 测试层次

- [ ] **Unit 测试**：每个 exported function / class method
  - [ ] Happy path（正常输入 → 预期输出）
  - [ ] Error path（非法输入 → 预期异常/错误码）
  - [ ] 边界条件（空值、零值、极大值、空数组）
- [ ] **Schema 测试**（如使用 Zod）：
  - [ ] 合法 minimal payload → `doesNotThrow`
  - [ ] 非法 payload → `throws`
  - [ ] 可选字段缺失 → `doesNotThrow`
- [ ] **Integration 测试**（如涉及 DB/文件/子进程）：
  - [ ] 使用 `createIntegrationContext()` 或 `createRepositoryHarness()`
  - [ ] `try/finally` 确保清理
- [ ] **安全测试**（如涉及安全边界）：
  - [ ] Denial-path regression 覆盖各攻击向量
  - [ ] Fail-close 测试

### 13.3 覆盖率

- [ ] 本地运行 `npm test` 确认覆盖率不低于全局基线
- [ ] 运行 `npm run coverage:baseline:update` 更新基线
- [ ] 确认新目录出现在 `.coverage-baseline.json` 中

### 13.4 变异测试

- [ ] 确认新模块路径在 `stryker.config.mjs` 的 `mutate` glob 范围内
- [ ] 本地运行 `npm run test:mutation` 确认无大量 survived mutants

### 13.5 CI 兼容

- [ ] 测试在 Node 20 和 Node 22 下均通过
- [ ] 测试支持 `--test-concurrency=12` 并行运行，无共享状态冲突
- [ ] 无硬编码绝对路径、端口号、时间戳

### 13.6 文档

- [ ] 在 Traceability Matrix（§7.3）中更新源文件 ↔ 测试文件映射
- [ ] 如引入新的 Helper / Fixture，更新 §5 工具清单

---

---

---

# Part II — 架构语义覆盖（v1.1 新增，v1.2 增补，v3.0 扩展）

> Part I 解决的是"代码覆盖治理" — 确保每行代码被执行、每个断言有效。
> Part II 解决的是"架构语义覆盖" — 确保系统关键设计语义（状态机、事件、并发、阶段契约）都被测试覆盖到。

---

## 14. 状态机测试规范

### 14.1 为什么需要单独规范

本系统包含 **5 个核心状态机**（Task / Workflow / Session / Execution / Approval）和 **40+ 辅助生命周期枚举**（Worker、Plugin、Rollout、Circuit Breaker、Lease、Repair Pipeline 等）。

普通 line/branch coverage 无法保证：

- 每个合法状态转换被测试
- 每个非法状态转换被拒绝
- 终态不可再转移
- 跨实体级联转换的原子性

### 14.2 核心状态机清单

| 状态机        | 定义文件                                           | 验证文件                                                        | 状态数 | 终态                                     |
| ------------- | -------------------------------------------------- | --------------------------------------------------------------- | ------ | ---------------------------------------- |
| **Task**      | `src/platform/execution/state-transition/types.ts` | `src/platform/execution/state-transition/transition-service.ts` | 7      | done, failed, cancelled                  |
| **Workflow**  | 同上                                               | 同上                                                            | 7      | completed, failed, cancelled             |
| **Session**   | 同上                                               | 同上                                                            | 7      | completed, failed, cancelled             |
| **Execution** | 同上                                               | 同上                                                            | 8      | succeeded, failed, cancelled, superseded |
| **Approval**  | 同上                                               | 同上                                                            | 5      | approved, rejected, expired, cancelled   |

这 5 个状态机通过 `StateTransitionMachine<T>` 泛型类实现，`assertTransition()` 方法用 CAS 防止并发覆写。

### 14.3 状态机测试三层要求

#### A. 合法转换全覆盖（Transition Coverage）

每个状态机的 **每条合法转换边** 必须有至少一个测试：

```typescript
test("task transition: queued -> in_progress is allowed", () => {
  assert.doesNotThrow(() =>
    taskStateMachine.assertTransition("queued", "in_progress"),
  );
});
```

**量化标准**：合法边覆盖率 = 已测合法边数 / 总合法边数 = **100%**

Task 状态机合法边列表（示例）：

```
queued → pending, in_progress, cancelled
pending → in_progress, cancelled
in_progress → awaiting_decision, done, failed, cancelled
awaiting_decision → in_progress, failed, cancelled
```

#### B. 非法转换全拒绝（Denial Coverage）

**每个终态** 向任何非自身状态的转换必须被拒绝测试：

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

**量化标准**：所有终态 × 所有非自身状态 = 必须测试拒绝

#### C. 跨实体级联转换（Cascade Coverage）

`TransitionService` 提供 `applyTaskTerminalState` 和 `ApprovalBlockingTransitionService`，会原子性地级联转换多个实体。

必须测试的级联场景：

| 触发             | Task              | Workflow  | Session       | Execution | Approval  |
| ---------------- | ----------------- | --------- | ------------- | --------- | --------- |
| task → done      | done              | completed | completed     | succeeded | —         |
| task → failed    | failed            | failed    | failed        | failed    | —         |
| task → cancelled | cancelled         | cancelled | cancelled     | cancelled | —         |
| approval needed  | awaiting_decision | paused    | awaiting_user | blocked   | requested |
| approval granted | in_progress       | running   | streaming     | executing | approved  |

### 14.4 辅助状态机测试要求

对于非核心状态机（Circuit Breaker、Rollout、Repair Pipeline、Plugin 等），要求：

| 类别                           | 要求                                  |
| ------------------------------ | ------------------------------------- |
| 有 `assertTransition()` 验证的 | 同核心三层要求                        |
| 有 `transitionTo()` 无验证的   | 至少覆盖 happy path + terminal states |
| 仅作为枚举值的                 | 覆盖每个枚举值至少出现在一个测试中    |

### 14.5 Circuit Breaker 状态机特殊要求

Circuit Breaker（`closed → open → half_open → closed`）涉及时间和计数，需额外测试：

- [ ] 连续失败 ≥ threshold → 触发 open
- [ ] 失败率 ≥ 50% → 触发 open
- [ ] open 状态下请求被拒绝 + 返回 `retryAfterMs`
- [ ] resetTimeoutMs 过后 → 转为 half_open
- [ ] half_open 单次探测成功 / 失败的行为
- [ ] 连续成功 ≥ halfOpenSuccessThreshold → 恢复 closed

### 14.6 Transition Table 唯一源规则

**硬性要求**：`transition-service.ts` 中的 canonical transition map 是状态迁移的 **唯一权威源**。测试用例 **禁止** 手动硬编码一份副本 transition table。

#### A. 原则

| 条目     | 规则                                                                                 |
| -------- | ------------------------------------------------------------------------------------ |
| 唯一源   | 所有合法/非法迁移判断必须来自 `TransitionService` 的 production map                  |
| 禁止副本 | 测试中不得出现 `const allowedTransitions = { pending: ["running", ...] }` 等手写副本 |
| 数据驱动 | 测试矩阵必须从 production map **自动生成**，而非手动枚举                             |
| 同步保障 | 若 production map 新增/删除迁移，测试自动感知，无需人工同步                          |

#### B. 数据驱动测试生成模板

```typescript
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  TRANSITION_MAP,
  ALL_STATES,
} from "../../src/platform/execution/state-transition/types.js";

// 从 production map 自动生成合法迁移对
const validPairs: Array<[string, string]> = [];
for (const [from, toSet] of Object.entries(TRANSITION_MAP)) {
  for (const to of toSet) {
    validPairs.push([from, to]);
  }
}

// 自动生成非法迁移对（全排列 - 合法对 - 自迁移）
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

- Coverage gate 新增检查：测试文件中若出现与 `TRANSITION_MAP` 键名集合相同的硬编码对象字面量，CI 报 warning
- PR Review checklist 中增加一条："状态机测试是否从 production map 自动派生？"

---

## 15. 事件驱动测试规范

### 15.1 事件系统架构

```
Producer → TypedEventBus → DurableEventBus → SQLite
                                              ↓
                            EventOpsService → deliverPending() → Consumer
                                              ↓ (3次重试后)
                                         Dead Letter Table
```

本系统定义了 **48 种 typed event**，分为 3 个 Tier：

| Tier       | 语义                  | Ack 要求 | 事件数 | 示例                                            |
| ---------- | --------------------- | -------- | ------ | ----------------------------------------------- |
| **Tier 1** | 必须持久化 + 必须 ack | 必须     | 9      | `task:status_changed`, `decision:requested`     |
| **Tier 2** | 持久化，ack 可选      | 推荐     | ~35    | `dispatch:*`, `worker:*`, `plugin:*`, `skill:*` |
| **Tier 3** | 尽力投递              | 无       | ~4     | `stream:chunk_emitted`, `perf:*`                |

### 15.2 按 Tier 分级测试要求

#### Tier 1 事件（9 种）— 最高测试要求

每种 Tier 1 事件必须覆盖完整生命周期：

| 阶段            | 测试内容                                       |
| --------------- | ---------------------------------------------- |
| **Schema**      | payload 满足 Zod validator（valid + invalid）  |
| **Publish**     | 正确写入 events 表 + 创建 ack 记录             |
| **Deliver**     | `deliverPending()` 将事件投递到注册 consumer   |
| **Ack**         | consumer 处理成功 → ack status = `"acked"`     |
| **Retry**       | consumer 处理失败 → 指数退避重试（100ms → 5s） |
| **Dead Letter** | 3 次重试失败 → 写入 dead_letter 表             |
| **Replay**      | `EventOpsService.replayConsumer()` 重新投递    |
| **Integrity**   | SHA-256 hash chain 未被篡改                    |

#### Tier 2 事件 — 中等测试要求

| 阶段            | 测试内容                             |
| --------------- | ------------------------------------ |
| **Schema**      | payload 满足 Zod validator           |
| **Publish**     | 正确写入 events 表                   |
| **Deliver**     | 至少一个 consumer 能收到             |
| **Idempotency** | 带 `idempotencyKey` 的事件不重复消费 |

#### Tier 3 事件 — 基本测试要求

| 阶段            | 测试内容                    |
| --------------- | --------------------------- |
| **Publish**     | 不抛出异常                  |
| **Best-effort** | consumer 不在线时事件不阻塞 |

### 15.3 DLQ 测试要求

系统有 **3 套独立 DLQ**：

| DLQ         | 位置                                | 测试重点                                                    |
| ----------- | ----------------------------------- | ----------------------------------------------------------- |
| Event DLQ   | `event_dead_letters` 表             | 3 次重试后正确入 DLQ + `dlq-manager list` 可查              |
| Gateway DLQ | `gateway_dead_letters` 表           | 非 retryable 状态码直接入 DLQ、retryable 状态码重试后入 DLQ |
| Jobs DLQ    | `queue_jobs.status = "dead_letter"` | 超过 `maxAttempts` 后入 DLQ                                 |

每套 DLQ 必须测试：

- [ ] 正确条件下消息进入 DLQ
- [ ] DLQ 消息可查询（list / count）
- [ ] DLQ 消息可清除（purge）
- [ ] 可重试的 DLQ 消息能重新入队

### 15.4 Event Schema Drift 回归

`event-registry.ts` 中的 `RAW_EVENT_SCHEMA_REGISTRY` 定义了所有事件的 schema：

```typescript
test("all TypedEventPayloadMap keys are registered in EVENT_SCHEMA_REGISTRY", () => {
  // 编译时已有 MissingTypedEventDefinitions 类型检查
  // 运行时补充验证
  for (const eventType of Object.keys(TypedEventPayloadMap)) {
    assert.ok(hasEventSchema(eventType), `Missing schema for ${eventType}`);
  }
});
```

### 15.5 Consumer 注册完整性

每种 Tier 1 事件在 `REQUIRED_CONSUMERS_BY_EVENT_TYPE` 中有指定 consumer。测试必须验证：

```typescript
test("all Tier 1 events have at least one required consumer", () => {
  for (const eventType of TIER_1_EVENT_TYPES) {
    const consumers = getRequiredConsumers(eventType);
    assert.ok(consumers.length > 0, `${eventType} has no required consumers`);
  }
});
```

### 15.6 Consumer 副作用幂等性（硬性要求）

所有 **可重试 consumer**（Tier 1 必须重试，Tier 2 推荐重试）必须通过幂等性测试。重复消费同一条事件 **不得** 产生：

| 禁止行为            | 验证方法                                                      |
| ------------------- | ------------------------------------------------------------- |
| 重复 DB 写入        | 同一事件投递 2 次后，相关表行数不变                           |
| 重复通知 / 外发消息 | mock notification channel，断言调用次数 = 1                   |
| 重复下游副作用      | mock downstream service，断言幂等 key 被去重                  |
| 状态机重复迁移      | 第二次投递不触发 `assertTransition()`（状态已在终态或目标态） |

#### 幂等性测试模板

```typescript
test("consumer handles duplicate delivery idempotently", async () => {
  const event = buildEvent("task.completed", { taskId: "t-1" });
  const db = await createTestDb();
  const notifier = { send: mock.fn() };

  // 首次消费
  await consumer.handle(event, { db, notifier });
  const rowsAfterFirst = await db.count("task_completions");
  assert.equal(notifier.send.mock.calls.length, 1);

  // 重复消费（模拟 retry / at-least-once 投递）
  await consumer.handle(event, { db, notifier });
  const rowsAfterSecond = await db.count("task_completions");

  // 断言无副作用重复
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

#### 适用范围

- 所有 `REQUIRED_CONSUMERS_BY_EVENT_TYPE` 注册的 consumer
- 所有实现了 `onEvent()` / `handleEvent()` 接口的 handler
- Gateway DLQ replay consumer

---

## 16. OAPEFLIR 阶段覆盖矩阵

### 16.1 覆盖矩阵定义

不按目录、不按文件，而是按 **OAPEFLIR 8 个阶段的设计语义** 定义最小测试集。

每个阶段必须覆盖 **7 条标准路径**：

| 路径编号 | 路径名                            | 描述                                                  |
| -------- | --------------------------------- | ----------------------------------------------------- |
| P1       | **Happy Path**                    | 标准输入 → 阶段完成 → 产出正确                        |
| P2       | **Degraded Path**                 | 部分输入缺失/质量不足 → 降级处理 → 产出带警告         |
| P3       | **Invalid Input Path**            | 非法/畸形输入 → 拒绝或 fail-fast                      |
| P4       | **Timeout Path**                  | 阶段执行超时 → 正确中止 + 资源清理                    |
| P5       | **Skip Path**                     | 阶段被跳过（条件不满足） → stage status = `"skipped"` |
| P6       | **Downstream Contract Violation** | 上游产出不满足当前阶段输入契约 → 拒绝或回退           |
| P7       | **Human Intervention Path**       | 阶段需要人工介入 → 暂停等待审批/确认 → 恢复或终止     |

### 16.2 逐阶段覆盖矩阵

#### Observe（观察）

| 路径 | 测试场景                          | 断言重点                                                 |
| ---- | --------------------------------- | -------------------------------------------------------- |
| P1   | 标准任务输入 → 生成 TaskSituation | `objective`, `currentPhase`, `codebaseSnapshot` 字段完整 |
| P2   | 空 codebase / 无 fileRefs         | TaskSituation 仍可生成，`fileRefs: []`                   |
| P3   | 非法 taskId / 空 objective        | Schema 拒绝                                              |
| P4   | 采集超时                          | 超时中止 + 返回已有快照                                  |
| P5   | 输入已缓存 / 无变更               | 跳过重新采集                                             |
| P6   | —                                 | 作为第一阶段无上游                                       |
| P7   | 任务需人工确认范围                | 暂停采集 → 等待人工确认 → 恢复后继续                     |

#### Assess（评估）

| 路径 | 测试场景                               | 断言重点                                                      |
| ---- | -------------------------------------- | ------------------------------------------------------------- |
| P1   | 标准 TaskSituation → UnifiedAssessment | complexity / risk / routingDecision / resourceAllocation 合理 |
| P2   | 高不确定性任务                         | 正确升级 executionMode 为 `"supervised"`                      |
| P3   | 畸形 situationRef                      | Schema 拒绝                                                   |
| P4   | 评估超时                               | 降级到默认 assessment                                         |
| P5   | 简单任务跳过深度评估                   | 直接使用快速评估路径                                          |
| P6   | TaskSituation 缺少必填字段             | 拒绝 + 回退到 Observe                                         |
| P7   | 高不确定性 → 需人工监督                | executionMode 升级为 `"supervised"`，等待审批后继续           |

#### Plan（规划）

| 路径 | 测试场景                          | 断言重点                                                |
| ---- | --------------------------------- | ------------------------------------------------------- |
| P1   | 标准 assessment → Plan with steps | stepId 唯一、dependencies 合法、strategy 正确           |
| P2   | 高复杂度任务                      | 多步骤 DAG + 并行步骤                                   |
| P3   | version = 0 / steps 为空          | Schema 拒绝                                             |
| P4   | 规划超时                          | 返回最小可行 plan                                       |
| P5   | 评估结果表明无需规划              | stage skipped                                           |
| P6   | AssessmentRef 不存在              | 拒绝                                                    |
| P7   | 高风险计划需人工审核              | plan status = `"pending_approval"` → 审批通过后开始执行 |

#### Execute（执行）

| 路径 | 测试场景                         | 断言重点                                               |
| ---- | -------------------------------- | ------------------------------------------------------ |
| P1   | 单步执行 → DualChannelStepOutput | userFacingResult + systemTelemetry 完整                |
| P2   | 部分步骤失败 → partial success   | 成功步骤的产出被保留                                   |
| P3   | 非法 tool 调用 / sandbox 拒绝    | `status: "blocked"` + 错误码                           |
| P4   | 步骤超时                         | 步骤标记 `"failed"` + `code: "tool.timeout"`           |
| P5   | 所有步骤已完成（replay）         | 跳过                                                   |
| P6   | Plan 中步骤引用不存在的 tool     | 拒绝 + 回退到 Plan                                     |
| P7   | 步骤触发审批阻塞                 | `status: "blocked_awaiting_approval"` → 审批后恢复执行 |

#### Feedback（反馈）

| 路径 | 测试场景                       | 断言重点                                        |
| ---- | ------------------------------ | ----------------------------------------------- |
| P1   | 执行结果 → FeedbackSignal 集合 | signal 正确分类（success/failure/correction）   |
| P2   | 重复 signal                    | deduplication 生效                              |
| P3   | 空 signal 列表                 | 返回空集，不报错                                |
| P4   | 信号采集超时                   | 返回已收集部分                                  |
| P5   | 无执行产出                     | 跳过反馈                                        |
| P6   | stepOutputRefs 引用不存在      | 忽略 + 警告                                     |
| P7   | 反馈结果需人工确认准确性       | signal 标记 `"pending_review"` → 人工确认后生效 |

#### Learn（学习）

| 路径 | 测试场景                                                         | 断言重点                                              |
| ---- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| P1   | 反馈信号 → LearningSignal（failure_pattern / recovery_playbook） | learningType + sourceSignalIds 正确                   |
| P2   | 低置信度模式                                                     | 标记为 tentative                                      |
| P3   | 非法 learningType                                                | 拒绝                                                  |
| P4   | 挖掘超时                                                         | 返回空                                                |
| P5   | 无 failure 信号                                                  | 跳过学习                                              |
| P6   | FeedbackSignal 结构不完整                                        | 拒绝                                                  |
| P7   | 学习结论需专家审核                                               | learning 标记 `"expert_review_required"` → 审核后录入 |

#### Improve（改进）

| 路径 | 测试场景                                                       | 断言重点                                         |
| ---- | -------------------------------------------------------------- | ------------------------------------------------ |
| P1   | 学习产出 → ImprovementCandidate（status: proposed → approved） | changeScope + expectedBenefit 合理               |
| P2   | 改进超出自治边界                                               | status 停留在 `"proposed"`，需人工审批           |
| P3   | 空学习产出                                                     | 不产生 candidate                                 |
| P4   | 评估超时                                                       | candidate 标记 `"rejected"`                      |
| P5   | 无可改进项                                                     | 跳过                                             |
| P6   | LearningSignal 引用非法 sourceSignalRefs                       | 拒绝                                             |
| P7   | 改进超出自治边界 → 需人工审批                                  | candidate 停留在 `"proposed"` → 审批后推进或驳回 |

#### Release（发布/Rollout）

| 路径 | 测试场景                                                        | 断言重点                                                   |
| ---- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| P1   | approved candidate → RolloutRecord（shadow → suggest → stable） | level 正确递进                                             |
| P2   | metrics gate 未通过                                             | 停留在当前 level                                           |
| P3   | 非法 candidateId                                                | 拒绝                                                       |
| P4   | rollout 超时                                                    | 自动 rollback                                              |
| P5   | candidate 被 rejected                                           | 跳过 rollout                                               |
| P6   | candidate 引用已过期的 evidence                                 | 拒绝 + 重新评估                                            |
| P7   | rollout 需人工审批放行                                          | rollout 停留在 `"pending_approval"` → 审批后继续推进 level |

### 16.3 覆盖率量化

```
OAPEFLIR 阶段覆盖率 = (已测路径数) / (8 阶段 × 7 路径 = 56) × 100%
```

**目标**：≥ 85%（至少 48/56 条路径有测试）

### 16.4 OAPEFLIR-Harness 语义映射（v3.0 新增）

> 对应架构审查 v6.0 缺口 I-2（§13.5 OAPEFLIR-Harness 外部语义映射）

架构设计 §13.5 要求 OAPEFLIR 8 阶段与 Harness 三角色（Planner / Generator / Evaluator）之间建立显式语义映射。此映射尚未代码化（缺口 I-2），但测试应提前定义预期映射：

| OAPEFLIR 阶段 | Harness 角色      | 映射语义                                |
| ------------- | ----------------- | --------------------------------------- |
| Observe       | —                 | 外部输入采集，不进入 Harness 循环       |
| Assess        | Planner           | 任务评估 → PlanBundle 输入              |
| Plan          | Planner           | 生成 PlanBundle（stepId/DAG/tools）     |
| Execute       | Generator         | 生成 WorkProduct（代码/文档/操作）      |
| Feedback      | Evaluator         | 生成 EvaluationReport（pass/fail）      |
| Learn         | Evaluator         | 从 EvaluationReport 提取 LearningSignal |
| Improve       | Planner+Evaluator | 改进候选评估 + 批准                     |
| Release       | —                 | Rollout 控制，不直接参与 Harness 循环   |

**测试要求**：当缺口 I-2 实现后，需验证：

- [ ] 映射配置存在且包含全部 8 阶段
- [ ] Planner 角色覆盖 Assess/Plan/Improve 三阶段
- [ ] Generator 角色覆盖 Execute 阶段
- [ ] Evaluator 角色覆盖 Feedback/Learn/Improve 三阶段
- [ ] Observe 和 Release 标记为外部阶段，不进入 Harness 循环

---

## 17. 并发与时序测试规范

### 17.1 必须做并发测试的模块

| 模块                                           | 并发风险                      | 测试类型                |
| ---------------------------------------------- | ----------------------------- | ----------------------- |
| `execution-lease-service`                      | 竞争获取 lease                | Race Test + Idempotency |
| `execution-dispatch-service`                   | 并发 dispatch 同一 ticket     | Race Test               |
| `execution-worker-handshake-service`           | 并发 claim 同一 execution     | Race Test               |
| `distributed-lock-adapter` (SQLite/Redis/PG)   | 竞争获取锁                    | Critical Section Test   |
| `durable-event-bus`                            | 并发 publish + deliverPending | Race Test               |
| `approval-service`                             | 并发审批同一请求              | Idempotency Test        |
| `sqlite-queue-adapter` / `redis-queue-adapter` | 并发 enqueue + dequeue        | Race Test + Idempotency |
| `circuit-breaker`                              | 并发请求触发状态转换          | Race Test               |
| `transition-service`                           | 并发状态转换（CAS）           | Race Test               |
| `channel-gateway-retry-executor`               | 重叠 polling pass             | Non-overlap Test        |

### 17.2 测试类型定义

#### Race Test

验证并发操作不会导致数据损坏或不变量违反：

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

验证重复操作产生相同结果：

```typescript
test("duplicate enqueue with same idempotency key returns existing job", async () => {
  const job1 = queue.enqueue({ data: "test", idempotencyKey: "key-1" });
  const job2 = queue.enqueue({ data: "test", idempotencyKey: "key-1" });
  assert.equal(job1.id, job2.id);
});
```

#### Critical Section Test

验证互斥区只允许一个 worker 进入：

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

验证超时后资源被正确释放：

```typescript
test("expired lease is reclaimed and execution can be re-dispatched", async () => {
  // 1. 获取 lease
  await leaseService.acquireLease({
    executionId: "e1",
    workerId: "w1",
    ttlMs: 100,
  });
  // 2. 等待过期
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

利用 `WorkflowCrashSimulator` 验证崩溃恢复：

```typescript
test("recovery repairs partial commit after crash at step_started", async () => {
  // 注入崩溃点
  process.env.AA_WORKFLOW_CRASH_POINT = "step_started";
  try {
    await executeWorkflow(...);
  } catch (e) {
    assert.ok(e instanceof InjectedWorkflowCrashError);
  }
  // 验证恢复
  const repairs = await repairService.repair();
  assert.ok(repairs.length > 0);
  // 验证数据一致性
  const execution = store.getExecution("e1");
  assert.notEqual(execution.status, "executing"); // 不应停留在中间态
});
```

### 17.3 并发测试量化标准

| 模块类别 | 最低并发度 | 必须覆盖                        |
| -------- | ---------- | ------------------------------- |
| 锁/lease | 10 workers | acquire/release/extend/steal    |
| 队列     | 20 workers | enqueue/dequeue/ack/dead-letter |
| 状态转换 | 5 workers  | CAS 竞争 + 终态幂等             |
| 事件投递 | 10 workers | publish + consumer ack          |
| Dispatch | 5 workers  | ticket claim + handshake        |

### 17.4 Stale Write Prevention 测试

`ExecutionLeaseService.validateWriteAccess()` 是防止脏写的最后防线，必须覆盖全部 5 种拒绝原因：

- [ ] `lease_not_found` — execution 无 lease 记录
- [ ] `no_active_lease` — lease 已过期/释放
- [ ] `stale_fencing_token` — fencing token 不匹配（旧 worker 写入）
- [ ] `worker_mismatch` — 请求 worker 不是 lease 持有者
- [ ] `lease_mismatch` — lease ID 不匹配

### 17.5 时间控制策略

并发和时序测试中最常见的 flaky 根因是对真实时间的依赖。本节规定统一的时间控制分层策略。

#### A. 三层时间控制

| 层级              | 适用场景                                | 策略                                                                       | 示例                                                  |
| ----------------- | --------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| L1 — 可控时钟     | Unit 测试中涉及超时、TTL、间隔的逻辑    | 注入 `Clock` 接口，测试传入 `FakeClock`，手动推进时间                      | lease 过期、circuit breaker resetTimeout、retry delay |
| L2 — 有界真实时间 | Integration 测试需要真实异步/定时器交互 | 允许 `setTimeout` / `setInterval`，但单次 sleep ≤ 500ms，单测总 sleep ≤ 2s | 队列投递后等待 consumer 消费                          |
| L3 — 禁止无界等待 | 所有测试                                | 禁止 `while(true) await sleep()`、禁止无超时的 `waitForEvent()`            | —                                                     |

#### B. 硬性规则

1. **Unit 测试禁止 `setTimeout` / `Date.now()` 直接调用** — 必须通过注入的 Clock 接口
2. **所有 `await sleep()` 调用必须有 `{ timeout }` 参数上界** — CI 超时前必须自行中止
3. **Integration 测试的总 sleep 预算**：单个 test case ≤ 2s，单个 test file ≤ 10s
4. **Retry 循环必须有 `maxAttempts` + `maxWaitMs` 双重限制** — 防止无限重试

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

- Lint rule（或 grep CI step）检测测试文件中裸露的 `Date.now()`、`new Date()`、`setTimeout` 调用，unit 测试目录下标记为 warning
- `--test-timeout=30000` 作为全局兜底，超过 30s 的单个 test case 自动 fail

---

## 18. 设计规格到测试追溯规范

### 18.1 目标

建立 **设计文档 → 测试用例** 的双向追溯，使得：

- 每个 P0/P1 设计规格都有对应测试
- 每个测试都能追溯到设计需求

### 18.2 Spec ID 编码规则

本项目使用 **4 种前缀** 区分不同来源的可追溯规格：

| 前缀        | 含义          | 来源                                      |
| ----------- | ------------- | ----------------------------------------- |
| `SPEC-`     | 设计规格      | `opeli_detailed_design.md` 及其他设计文档 |
| `ADR-`      | 架构决策记录  | `doc/adr/` 目录下的 ADR 文档              |
| `CONTRACT-` | 接口/行为契约 | `doc/contracts/` 目录下的 contract 文档   |
| `INC-`      | 线上事故      | 事故复盘记录，触发回归测试                |

#### 编码格式

```
{前缀}{模块}-{子系统}-{序号}

SPEC 示例：
SPEC-OAPEFLIR-EXEC-001     # OAPEFLIR Execute 阶段第 1 条规格
SPEC-ROLLOUT-STATE-003      # Rollout 状态机第 3 条规格
SPEC-PLUGIN-SANDBOX-002     # Plugin sandbox 第 2 条规格
SPEC-EVENT-TIER1-DLQ-001    # Tier 1 事件 DLQ 第 1 条规格
SPEC-LEASE-FENCING-001      # Lease fencing token 第 1 条规格

ADR 示例：
ADR-LOCK-BACKEND-001        # 分布式锁选型 ADR 第 1 条
ADR-EVENT-DURABILITY-002    # 事件持久化策略 ADR 第 2 条

CONTRACT 示例：
CONTRACT-SANDBOX-FS-001     # Sandbox 文件系统契约第 1 条
CONTRACT-API-GATEWAY-003    # API Gateway 接口契约第 3 条

INC 示例：
INC-20250312-LEASE-STALE-001  # 2025-03-12 lease 脏写事故第 1 条
INC-20250401-DLQ-OVERFLOW-001 # 2025-04-01 DLQ 溢出事故第 1 条
```

### 18.3 测试中引用 Spec ID

在测试标题中包含 spec ID（支持所有 4 种前缀）：

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

或在测试文件头部维护映射表：

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

#### 表 1：源文件 → Unit 测试

```
src/platform/feedback/feedback-collector.ts → tests/unit/platform/feedback/feedback-collector.test.ts
```

（即 §7.3 的 Traceability Matrix）

#### 表 2：源文件 → Integration 测试

```
src/platform/execution/tools/command-executor.ts → tests/integration/security/sandbox-command-executor.test.ts
```

#### 表 3：设计规格 → 测试

```
opeli_detailed_design.md §5 Execute  → SPEC-OAPEFLIR-EXEC-001 → tests/unit/core/agent-loop/execute.test.ts:L45
opeli_detailed_design.md §12 Rollout → SPEC-ROLLOUT-STATE-003 → tests/unit/core/improvement/rollout.test.ts:L88
doc/contracts/sandbox-contract.md    → SPEC-PLUGIN-SANDBOX-002 → tests/integration/security/plugin-sandbox.test.ts:L30
```

### 18.5 维护流程

1. **新增设计规格** → 分配 Spec ID → 写入设计文档
2. **编写测试** → 在测试标题或文件头引用 Spec ID
3. **Sprint Review** → 运行追溯脚本，输出未覆盖 Spec ID 列表
4. **Gap 处理** → 未覆盖的 Spec ID 进入测试债务清单（§20）

追溯脚本示例（覆盖全部 4 种前缀）：

```bash
ID_PATTERN='(SPEC|ADR|CONTRACT|INC)-[\w-]+'

# 从所有源文档提取已定义的 ID
grep -oP "$ID_PATTERN" doc/reviews/opeli_detailed_design.md \
                        doc/adr/*.md \
                        doc/contracts/*.md \
                        doc/incidents/*.md \
  2>/dev/null | sort -u > /tmp/all-spec-ids.txt

# 从测试文件提取已覆盖的 ID
grep -roPh "$ID_PATTERN" tests/ | sort -u > /tmp/tested-specs.txt

# 差集 = 未覆盖
comm -23 /tmp/all-spec-ids.txt /tmp/tested-specs.txt

# 按前缀分类统计
echo "=== 未覆盖统计 ==="
for prefix in SPEC ADR CONTRACT INC; do
  count=$(grep -c "^${prefix}-" /tmp/uncovered.txt 2>/dev/null || echo 0)
  echo "  ${prefix}: ${count}"
done
```

---

## 19. 真实执行 vs Mock 执行边界规范

### 19.1 问题背景

Agent 系统最常见的测试陷阱：**测试覆盖率很高，但核心执行全是 mock**。本项目的 Execute 阶段目前即是完全 mock 实现。

必须明确界定哪些测试层允许 mock、哪些必须真实执行。

### 19.2 Mock 许可矩阵

| 组件                          | Unit Test                 | Integration Test             | E2E Test                       |
| ----------------------------- | ------------------------- | ---------------------------- | ------------------------------ |
| **LLM Provider**              | ✅ Mock                   | ✅ Mock                      | ✅ Mock（provider 非我方控制） |
| **Tool Execution Bridge**     | ✅ Mock                   | ❌ 必须真实                  | ❌ 必须真实                    |
| **Sandbox / Security Policy** | ✅ Mock                   | ❌ 必须真实                  | ❌ 必须真实                    |
| **Database (SQLite)**         | ❌ 禁止 mock              | ❌ 真实 in-memory            | ❌ 真实                        |
| **Database (PostgreSQL)**     | ✅ Mock（unit 用 SQLite） | ❌ 必须真实 PG               | ❌ 必须真实 PG                 |
| **文件系统**                  | ✅ Mock 或 temp dir       | ❌ 必须用 temp dir           | ❌ 必须真实                    |
| **子进程 (spawn)**            | ✅ Mock                   | ❌ 必须真实                  | ❌ 必须真实                    |
| **Event Bus**                 | ✅ Mock                   | ❌ 真实 DurableEventBus      | ❌ 真实                        |
| **分布式锁**                  | ✅ Mock                   | ❌ 真实 SQLite/Redis adapter | ❌ 真实                        |
| **网络 HTTP**                 | ✅ Mock                   | ✅ Mock（外部 API）          | ✅ Mock                        |
| **OAPEFLIR 阶段产出**         | ✅ Mock（隔离测试单阶段） | ❌ 阶段间需真实串联          | ❌ 全链路                      |

### 19.3 Mock 层级禁令

以下组合 **严格禁止**：

| 禁止                                                  | 原因                                    |
| ----------------------------------------------------- | --------------------------------------- |
| Integration test 中 mock DB                           | 无法验证 SQL 正确性、事务隔离、迁移兼容 |
| Integration test 中 mock sandbox                      | 无法验证路径穿越/命令注入防护           |
| E2E test 中 mock tool bridge                          | 无法验证工具链真实行为                  |
| 任何层 mock `StateTransitionMachine.assertTransition` | 无法验证状态机约束                      |
| 任何层 mock `validateWriteAccess`                     | 无法验证 fencing token 防护             |

### 19.4 Provider Mock 规范

LLM Provider 是唯一允许在所有层 mock 的组件（因为真实调用不确定、昂贵、慢）。

Provider mock 必须遵循：

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

- 返回值必须符合 Provider 接口的完整类型
- 返回值必须 **deterministic**（固定内容）
- 禁止在 mock 中加入 `Math.random()` 或 `Date.now()`

---

## 20. 测试债务分级

### 20.1 分级定义

| 等级      | 定义                                          | 修复时限     | 示例                                  |
| --------- | --------------------------------------------- | ------------ | ------------------------------------- |
| **TD-P0** | 安全边界 / 状态机 / 执行主链无测试            | 当前 Sprint  | sandbox 新攻击向量无 denial-path test |
| **TD-P1** | 核心 orchestrator 低 branch/mutation coverage | 下个 Sprint  | `OapeflirLoopService` 无 unit test    |
| **TD-P2** | 辅助服务 branch < 60% 或 mutation < 50%       | 2 Sprints 内 | `improvement` branches 52.4%          |
| **TD-P3** | 工具类 / 辅助函数缺少边界条件                 | Backlog      | 纯函数缺少空值测试                    |
| **TD-P4** | Golden / 性能测试文档性补强                   | Backlog      | 新 CLI 命令无 golden snapshot         |

### 20.2 债务登记格式

```
TD-{等级}-{序号}: {描述}
  模块: {src/platform/xxx}
  当前覆盖: {lines}% / {branches}% / mutation {x}%
  目标覆盖: {lines}% / {branches}%
  关联 Spec: {SPEC-xxx} (如适用)
  责任人: {owner}
  截止日: {date}
```

### 20.3 债务进入与退出条件

**进入条件**：

- §7 Traceability Matrix 脚本发现未覆盖源文件
- Coverage gate 中某目录低于安全红线（§23）
- Stryker 报告 survived mutants 率 > 50%
- PR Review 发现缺失测试场景
- Incident 回灌未产生对应回归测试

**退出条件**：

- 对应测试已编写并合入 main
- Coverage baseline 已更新
- Mutation score 改善到 ≥ low 阈值

### 20.4 Sprint 测试债务自动报告

每个 Sprint 结束时自动生成测试债务报告，作为 Sprint Review 的必要输入。

#### A. 报告内容

| 板块                   | 数据来源                 | 说明                                      |
| ---------------------- | ------------------------ | ----------------------------------------- |
| 新增 TD                | 本 Sprint 新建的 TD 条目 | 按优先级分布统计                          |
| 已关闭 TD              | 本 Sprint 关闭的 TD 条目 | 关闭原因分布（修复 / 取消 / 降级）        |
| 红线违规目录           | §23 覆盖率质量红线检查   | 列出低于安全红线的目录及差距              |
| 未覆盖 Spec ID         | §18.5 追溯脚本输出       | 按前缀（SPEC / ADR / CONTRACT / INC）分类 |
| Top-N Survived Mutants | Stryker 报告             | 取 survived 最多的前 10 个源文件          |
| 未回灌事故             | §21 失败样例回灌清单     | 已记录但尚未产生回归测试的 incident       |

#### B. 自动化脚本要求

```bash
#!/usr/bin/env bash
# scripts/ci/sprint-test-debt-report.sh

echo "=== Sprint Test Debt Report ==="
echo "Date: $(date -I)"
echo ""

echo "## 1. 红线违规目录"
node scripts/ci/check-coverage-baseline.mjs --report-only 2>&1 | grep "BELOW"

echo ""
echo "## 2. 未覆盖 Spec ID"
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
# 从 incidents 目录中找到尚未有对应 INC- 前缀测试的事故
comm -23 \
  <(grep -oP 'INC-[\w-]+' doc/incidents/*.md 2>/dev/null | sort -u) \
  <(grep -roPh 'INC-[\w-]+' tests/ | sort -u)
```

#### C. CI 集成

- 报告脚本在每次 `main` 分支合并时运行，产出物归档到 `data/sprint-reports/` 目录
- 若红线违规目录数量 > 上次报告，CI 发 warning（不阻塞）
- Sprint Review 议程中必须包含该报告的解读

---

## 21. 失败样例回灌规则

### 21.1 核心原则

> **每一个线上 incident、rollback、安全逃逸、高优先级用户修正，都必须回灌成至少一条回归测试。**

### 21.2 回灌触发条件

| 触发事件                   | 必须回灌的测试类型                            |
| -------------------------- | --------------------------------------------- |
| 线上 incident（P0/P1）     | Integration regression + root cause unit test |
| Rollback（Rollout 回退）   | 状态机 transition test + 条件 gate test       |
| 安全逃逸（sandbox bypass） | Denial-path regression（§8）                  |
| 用户修正（人工纠错）       | Unit test 覆盖被修正的逻辑分支                |
| 数据不一致修复             | 并发/事务隔离 test（§17）                     |
| Dead letter 积压           | Event lifecycle test（§15）                   |

### 21.3 回灌流程

```
Incident 发生 → 根因分析 → 修复代码
                              ↓
                  编写回归测试（测试标题包含 incident ID）
                              ↓
                  验证：删除修复代码 → 回归测试失败（确认测试有效）
                              ↓
                  恢复修复代码 → 测试通过 → 合入
```

### 21.4 回灌测试命名

```typescript
test("[INC-2026-0417] stale fencing token causes duplicate writeback", () => {
  // 复现 incident 根因
});
```

### 21.5 回灌验证

回灌测试必须通过 **反向验证**：

1. 注释掉修复代码
2. 运行回灌测试 → 必须失败
3. 恢复修复代码
4. 运行回灌测试 → 必须通过

如果步骤 2 测试仍然通过，说明测试未有效覆盖根因，需重写。

---

## 22. 测试数据治理

### 22.1 Fixture 最小化原则

Fixture 只包含被测场景 **必需** 的字段，其余使用工厂默认值：

```typescript
// ✓ 好 — 只指定测试关心的字段
const task = createMinimalTask({ priority: "critical" });

// ✗ 差 — 复制粘贴完整记录
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

### 22.2 确定性控制

测试中 **禁止** 以下非确定性来源：

| 非确定性来源                | 替代方案                                             |
| --------------------------- | ---------------------------------------------------- |
| `Date.now()` / `new Date()` | 使用固定时间戳或 `withEnv({ AA_FIXED_TIME: "..." })` |
| `Math.random()`             | 使用固定 seed 或硬编码值                             |
| `crypto.randomUUID()`       | 使用固定 ID（如 `"task-test-001"`）                  |
| 网络请求                    | Mock provider                                        |
| 文件系统时间戳              | 在 golden 测试中 normalize                           |
| 子进程输出中的 PID          | 在断言前 strip                                       |

### 22.3 Golden Snapshot Normalization

在写入 golden 文件前，对不稳定字段做 normalize：

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

| 类型             | 文件                                  | 用途                                                     |
| ---------------- | ------------------------------------- | -------------------------------------------------------- |
| **领域 Fixture** | `tests/helpers/fixtures/base.ts`      | 最小有效领域记录（Task、Execution、Approval）            |
| **场景 Fixture** | `tests/helpers/fixtures/composite.ts` | 多实体关联场景（BlockedTask、CompletedTask、FailedTask） |
| **种子 Fixture** | `tests/helpers/api.ts`                | 完整 API 环境种子                                        |

新增 fixture 时：

- 单实体 → 加到 `base.ts`
- 多实体关联 → 加到 `composite.ts`
- 特定测试专用 → 内联在测试文件中（不提取）

### 22.5 测试隔离

- 每个测试独立创建 temp workspace，`try/finally` 清理
- 禁止测试之间共享状态（全局变量、单例、静态属性）
- 环境变量通过 `withEnv()` 隔离
- 数据库通过独立 DB 文件隔离（不共享 in-memory DB）

---

## 23. 覆盖率质量红线

### 23.1 问题

全局 82.4% 行覆盖率可能掩盖关键模块的低覆盖。需要对不同模块定义 **硬性最低门槛**。

### 23.2 分级红线（v3.0 更新目录映射）

| 级别         | 适用模块                                                                           | Lines 红线 | Branches 红线 | Mutation 红线 |
| ------------ | ---------------------------------------------------------------------------------- | ---------- | ------------- | ------------- |
| **Critical** | compliance, distributed-lock, state-transition, execution-lease, control-plane/iam | ≥ 90%      | ≥ 80%         | ≥ 70%         |
| **High**     | orchestration/oapeflir, state-evidence/memory, knowledge, events, execution-engine | ≥ 85%      | ≥ 75%         | ≥ 60%         |
| **Standard** | orchestration/oapeflir/learn, planning, improvement, artifacts, prompt-engine      | ≥ 80%      | ≥ 70%         | ≥ 50%         |
| **Baseline** | plugins, sdk/cli, model-gateway, tool-executor, domains                            | ≥ 75%      | ≥ 60%         | ≥ 50%         |

### 23.3 当前差距（v3.0 实测数据）

| 模块                                    | 级别     | 当前 Lines | 红线 | 当前 Branches | 红线 | 状态                     |
| --------------------------------------- | -------- | ---------- | ---- | ------------- | ---- | ------------------------ |
| `platform/execution/distributed-lock`   | Critical | 97.6%      | 90%  | 92.5%         | 80%  | ✅ Pass                  |
| `platform/execution/state-transition`   | Critical | 98.3%      | 90%  | 93.5%         | 80%  | ✅ Pass                  |
| `platform/control-plane/iam`            | Critical | 92.7%      | 90%  | 82.9%         | 80%  | ✅ Pass                  |
| `platform/compliance`                   | Critical | 90.9%      | 90%  | 50.0%         | 80%  | ❌ Branches **差 30.0%** |
| `platform/orchestration/oapeflir`       | High     | 81.1%      | 85%  | 85.4%         | 75%  | ❌ Lines **差 3.9%**     |
| `platform/state-evidence/memory`        | High     | 67.5%      | 85%  | 94.5%         | 75%  | ❌ Lines **差 17.5%**    |
| `platform/state-evidence/events`        | High     | 84.3%      | 85%  | 89.6%         | 75%  | ❌ Lines 差 0.7%         |
| `platform/execution/execution-engine`   | High     | 92.0%      | 85%  | 84.3%         | 75%  | ✅ Pass                  |
| `platform/state-evidence/knowledge`     | High     | 91.9%      | 85%  | 79.1%         | 75%  | ✅ Pass                  |
| `platform/orchestration/oapeflir/learn` | Standard | 98.1%      | 80%  | 82.3%         | 70%  | ✅ Pass                  |
| `platform/state-evidence/artifacts`     | Standard | 98.2%      | 80%  | 86.0%         | 70%  | ✅ Pass                  |
| `platform/prompt-engine`                | Standard | 86.6%      | 80%  | 89.2%         | 70%  | ✅ Pass                  |
| `plugins`                               | Baseline | 94.1%      | 75%  | 83.3%         | 60%  | ✅ Pass                  |
| `sdk/cli`                               | Baseline | 85.4%      | 75%  | 47.2%         | 60%  | ❌ Branches **差 12.8%** |
| `platform/model-gateway`                | Baseline | 83.5%      | 75%  | 85.5%         | 60%  | ✅ Pass                  |
| `domains`                               | Baseline | 30.4%      | 75%  | 75.5%         | 60%  | ❌ Lines **差 44.6%**    |

> **v3.0 变更**: 大量 v2.0 标记为不达标的旧 `src/core/` 目录已重组到 `src/platform/` 并显著提升覆盖率。新的薄弱环节集中在 `domains`（30.4%，因大量 seed 桩文件）、`state-evidence/memory`（67.5%）和 `sdk/cli` branches（47.2%）。

### 23.4 红线执行方式

将红线写入 `.coverage-baseline.json` 的目录级 minimums，由 `check-coverage-baseline.mjs` 强制执行。

当前基线只记录"观察值"，建议扩展为：

```json
{
  "src/platform/security": {
    "fileCount": 19,
    "metrics": { "lines": 91.9, ... },
    "minimums": { "lines": 90, "branches": 80 }  // ← 新增
  }
}
```

### 23.5 状态机 / 安全专项红线

除覆盖率外，以下模块有专项红线：

| 专项                | 红线                       | 度量方式                  |
| ------------------- | -------------------------- | ------------------------- |
| 状态机合法转换覆盖  | 100%                       | 合法边数 / 总合法边数     |
| 状态机非法转换覆盖  | 终态 × 全部非自身状态 100% | 拒绝测试数 / 应拒绝数     |
| 安全 denial-path    | 每个攻击面 ≥ 3 条          | denial test 数 / 攻击面数 |
| Tier 1 事件生命周期 | 9 种事件 × 8 阶段 100%     | 已测阶段 / 72             |
| Fencing token 拒绝  | 5 种原因 100%              | 拒绝测试数 / 5            |

---

---

# Part III — 架构缺口回归测试矩阵（v3.0 重写，对齐架构审查 v6.0）

> Part I 解决"代码覆盖治理"，Part II 解决"架构语义覆盖"。
> Part III 解决"**架构设计 vs 实现的缺口回归防护**" — 基于架构审查 v6.0（`docs_zh/reviews/architecture-design-vs-implementation-review.md`）发现的 **29 项架构缺口**，定义对应的测试规范，确保每个缺口在实现后有完备的测试覆盖。
>
> **v3.0 变更**: 完全重写。v2.0 基于架构审查 v4.1 的 34 项工程缺陷（SYS-\* 编号）已移至 Part IV 保留。本 Part III 聚焦架构审查 v6.0 的 29 项 **架构设计-实现缺口**。

---

## 24. 架构审查驱动的回归测试

### 24.1 背景

架构审查 v6.0 对 1,335 个源文件 / 260,331 行代码进行了全量审查，对比架构设计文档 v3.3（8,204 行 / 94 章节），发现 **29 项架构设计 vs 实现缺口**：

| 优先级    | 数量 | 关键缺口                                                           |
| --------- | ---- | ------------------------------------------------------------------ |
| P0 阻断级 | 4    | Harness 无迭代循环、ACP 未实现、Meta-Model 未实现、12 域 ID 不匹配 |
| P1 高     | 8    | Harness 核心数据契约/持久化/上下文/恢复、域 config/工作流/Recipe   |
| P2 中     | 10   | Harness 工具/护栏/HITL、域特化细节、路线图/ADR/目录结构            |
| P3 低     | 5    | Harness 反馈/记忆/异步/评估、LLM 扩展、桩文件率                    |
| P4 延迟   | 2    | Harness 可观测性/不变量                                            |

### 24.2 缺口 ID 到测试追溯

测试标题使用 `[GAP-{Part}-{序号}]` 前缀，与架构审查 v6.0 的缺口编号一一对应：

```
架构审查 v6.0: VI-1 无真实迭代循环
    ↓
测试标题: [GAP-VI-1] HarnessRuntimeService.runLoop executes Planner→Generator→Evaluator iteration
    ↓
文件位置: tests/unit/platform/orchestration/harness/harness-loop.test.ts
```

| 前缀       | 含义         | 缺口数 |
| ---------- | ------------ | ------ |
| `GAP-I-`   | 基础设施平台 | 2      |
| `GAP-II-`  | AI 运营      | 3      |
| `GAP-III-` | 领域接入     | 2      |
| `GAP-IV-`  | 垂直业务域   | 7      |
| `GAP-VI-`  | Harness 工程 | 15     |
| `GAP-IX-`  | 运维成熟度   | 1      |
| `GAP-X-`   | 实施路线图   | 3      |

### 24.3 优先级执行计划

| 优先级 | 修复时限    | 缺口 ID                                                |
| ------ | ----------- | ------------------------------------------------------ |
| **P0** | 当前 Sprint | VI-1, II-1, III-1, IV-1                                |
| **P1** | 下个 Sprint | VI-2, VI-3, VI-4, VI-5, VI-6, IV-2, IV-3, III-2        |
| **P2** | 2 Sprint 内 | VI-7, VI-8, VI-9, IV-4/5/6/7, X-1, X-2, X-3, I-2, II-2 |
| **P3** | Backlog     | VI-10, VI-11, VI-12, VI-13, II-3, I-1, IX-1            |
| **P4** | 延迟        | VI-14, VI-15                                           |

---

## 25. P0 阻断级缺口测试规范

### 25.1 [GAP-VI-1] Harness 无真实迭代循环

**缺口**: `src/platform/orchestration/harness/index.ts` 的 `HarnessRuntimeService.runLoop()` 仅执行单次（创建 run → 附加 3 步骤 → 单次决策），无 Planner→Generator→Evaluator 迭代循环，不接受 `RequestEnvelope` 输入，不支持重入。架构 §45.2 要求完整迭代循环。

**测试类型**: Unit + Integration

**测试目标**: `runLoop()` 必须实现 Plan→Execute→Evaluate 迭代，支持多轮循环直到 Evaluator 判定完成。

```typescript
test("[GAP-VI-1] HarnessRuntimeService.runLoop executes multi-iteration loop", async () => {
  const mockPlanner = createMockPlannerAgent({
    plan: () => ({ steps: [{ id: "s1", tool: "read_file" }] }),
  });
  const mockGenerator = createMockGeneratorAgent({
    execute: () => ({ output: "partial result", complete: false }),
  });
  const mockEvaluator = createMockEvaluatorAgent({
    evaluate: (iteration: number) => ({
      verdict: iteration >= 2 ? "pass" : "needs_revision",
      feedback: iteration < 2 ? "incomplete" : undefined,
    }),
  });

  const harness = new HarnessRuntimeService({
    planner: mockPlanner,
    generator: mockGenerator,
    evaluator: mockEvaluator,
  });

  const envelope = createRequestEnvelope({ objective: "implement feature X" });
  const run = await harness.runLoop(envelope);

  assert.ok(run.iterations >= 2, "Must iterate until evaluator passes");
  assert.equal(run.status, "completed");
  assert.equal(run.steps.length >= 6, true, "At least 2 iterations × 3 steps");
});

test("[GAP-VI-1] HarnessRuntimeService.runLoop accepts RequestEnvelope input", async () => {
  const harness = createMinimalHarnessService();
  const envelope = createRequestEnvelope({
    objective: "test task",
    constraints: { maxIterations: 1, budgetTokens: 1000 },
  });

  const run = await harness.runLoop(envelope);
  assert.equal(run.input.objective, "test task");
  assert.ok(run.id, "Run must have a unique ID");
});

test("[GAP-VI-1] HarnessRuntimeService.runLoop respects maxIterations constraint", async () => {
  const harness = createHarnessWithNeverPassingEvaluator();
  const envelope = createRequestEnvelope({
    constraints: { maxIterations: 3 },
  });

  const run = await harness.runLoop(envelope);
  assert.equal(run.iterations, 3);
  assert.equal(run.status, "max_iterations_reached");
});
```

**额外测试场景**:

- [ ] Planner 失败 → 循环中止 + 状态为 `"planner_failed"`
- [ ] Generator 超时 → 循环暂停 + 可恢复
- [ ] Evaluator 返回 `needs_revision` + feedback → 反馈传递给下一轮 Planner
- [ ] 循环中 budgetTokens 耗尽 → 状态为 `"budget_exhausted"`

### 25.2 [GAP-II-1] Agent 协作协议（ACP）完全未实现

**缺口**: 架构 §19.5 定义完整的多 Agent 协作协议 — 8 种消息类型、9 个必填字段、7 条不变量（C1-C7）。代码中仅有 `src/platform/orchestration/agent-delegation/index.ts` 的 TODO 注释。

**测试类型**: Unit + Integration

**测试目标**: ACP 消息必须满足 Schema 约束和 7 条不变量。

```typescript
test("[GAP-II-1] ACP message schema validates 8 message types", () => {
  const messageTypes = [
    "task_delegate",
    "task_accept",
    "task_reject",
    "task_complete",
    "status_update",
    "resource_request",
    "resource_grant",
    "escalate",
  ];

  for (const type of messageTypes) {
    const msg = createMinimalAcpMessage({ type });
    assert.doesNotThrow(
      () => AcpMessageSchema.parse(msg),
      `ACP message type "${type}" must be valid`,
    );
  }
});

test("[GAP-II-1] ACP message requires 9 mandatory fields", () => {
  const mandatoryFields = [
    "messageId",
    "type",
    "senderId",
    "receiverId",
    "conversationId",
    "timestamp",
    "payload",
    "protocolVersion",
    "correlationId",
  ];

  const minimal = createMinimalAcpMessage();
  for (const field of mandatoryFields) {
    const incomplete = { ...minimal };
    delete incomplete[field];
    assert.throws(
      () => AcpMessageSchema.parse(incomplete),
      `Missing "${field}" must be rejected`,
    );
  }
});

test("[GAP-II-1] ACP invariant C1: sender cannot delegate to self", () => {
  const msg = createMinimalAcpMessage({
    type: "task_delegate",
    senderId: "agent-1",
    receiverId: "agent-1",
  });

  assert.throws(() => validateAcpInvariant(msg), {
    message: /C1.*self-delegation/i,
  });
});
```

**7 条不变量测试清单**:

| 不变量 | 规则                                     | 测试场景                         |
| ------ | ---------------------------------------- | -------------------------------- |
| C1     | 不可自我委派                             | senderId === receiverId → 拒绝   |
| C2     | conversationId 在协作链中不可变          | 中途修改 conversationId → 拒绝   |
| C3     | task_accept 必须引用已有的 task_delegate | accept 无对应 delegate → 拒绝    |
| C4     | 已拒绝的任务不可再接受                   | reject 后 accept → 拒绝          |
| C5     | 已完成的任务不可再修改                   | complete 后 status_update → 拒绝 |
| C6     | resource_grant 必须引用有效 request      | grant 无对应 request → 拒绝      |
| C7     | escalate 必须包含原因和上下文            | escalate 无 reason → 拒绝        |

### 25.3 [GAP-III-1] 领域规范元模型完全未实现

**缺口**: 架构 §37.11 定义"统一领域元模型"— 12 个标准问题（Q1-Q12）和 24 域填充矩阵。代码中无 `meta-model`、`12-question`、`canonical` 相关引用。

**测试类型**: Unit

**测试目标**: 元模型 Schema 必须包含 12 个标准问题，每个域必须回答全部 12 问。

```typescript
test("[GAP-III-1] DomainMetaModel defines 12 standard questions", () => {
  const questions = DomainMetaModel.getQuestions();
  assert.equal(questions.length, 12);

  const expectedIds = [
    "Q1",
    "Q2",
    "Q3",
    "Q4",
    "Q5",
    "Q6",
    "Q7",
    "Q8",
    "Q9",
    "Q10",
    "Q11",
    "Q12",
  ];
  assert.deepEqual(
    questions.map((q) => q.id),
    expectedIds,
  );
});

test("[GAP-III-1] all 24 domains have complete meta-model answers", () => {
  const domains = DomainBaselineCatalog.getAllDomainIds();
  assert.equal(domains.length, 24);

  for (const domainId of domains) {
    const answers = DomainMetaModel.getAnswers(domainId);
    assert.equal(
      answers.length,
      12,
      `Domain "${domainId}" must answer all 12 questions`,
    );
    for (const answer of answers) {
      assert.ok(
        answer.value !== undefined && answer.value !== null,
        `Domain "${domainId}" Q${answer.questionId} must have a value`,
      );
    }
  }
});
```

**12 个标准问题测试**:

| 问题 | 主题         | 验证                             |
| ---- | ------------ | -------------------------------- |
| Q1   | 核心职能     | 非空字符串                       |
| Q2   | 主要工作流   | 至少 1 个工作流定义              |
| Q3   | 典型工具集   | 至少 1 个 tool 引用              |
| Q4   | 质量指标     | 至少 1 个 metric 定义            |
| Q5   | 风险维度     | 枚举值合法                       |
| Q6   | 合规要求     | 布尔或枚举数组                   |
| Q7   | 数据敏感度   | low/medium/high/critical         |
| Q8   | 延迟容忍度   | realtime/near_realtime/batch     |
| Q9   | 协作模式     | solo/pair/swarm                  |
| Q10  | 审批级别     | none/lightweight/standard/strict |
| Q11  | 自治等级上限 | L0-L5                            |
| Q12  | 评估方法     | 至少 1 个评估方法引用            |

### 25.4 [GAP-IV-1] 12 个 domain_id 不匹配

**缺口**: `src/domains/domain-baseline-catalog.ts` 中 12/24 个 domain_id 与架构文档 §71-§94 定义的 ID 不匹配（如 `quantitative-trading` vs `quant-trading`）。

**测试类型**: Unit (Golden)

**测试目标**: domain_id 必须与架构文档定义完全一致。

```typescript
test("[GAP-IV-1] all 24 domain IDs match architecture spec §71-§94", () => {
  const architectureIds = [
    "coding",
    "data-analysis",
    "devops",
    "security-ops",
    "quant-trading",
    "risk-management",
    "compliance-audit",
    "customer-service",
    "content-creation",
    "legal-review",
    "hr-ops",
    "procurement",
    "supply-chain",
    "quality-assurance",
    "research",
    "education",
    "healthcare-ops",
    "financial-planning",
    "marketing",
    "sales-ops",
    "product-management",
    "project-management",
    "it-support",
    "general-ops",
  ];

  const catalogIds = DomainBaselineCatalog.getAllDomainIds();
  assert.equal(catalogIds.length, 24);

  for (const expected of architectureIds) {
    assert.ok(
      catalogIds.includes(expected),
      `Architecture domain "${expected}" not found in catalog`,
    );
  }
});
```

**12 个不匹配的具体映射**（修复前应全部失败，修复后全部通过）:

| 架构定义 ID          | 当前代码 ID            | 状态 |
| -------------------- | ---------------------- | ---- |
| `quant-trading`      | `quantitative-trading` | ❌   |
| `risk-management`    | `risk-mgmt`            | ❌   |
| `compliance-audit`   | `compliance`           | ❌   |
| `customer-service`   | `customer-support`     | ❌   |
| `content-creation`   | `content-marketing`    | ❌   |
| `legal-review`       | `legal`                | ❌   |
| `hr-ops`             | `human-resources`      | ❌   |
| `supply-chain`       | `supply-chain-mgmt`    | ❌   |
| `quality-assurance`  | `qa`                   | ❌   |
| `healthcare-ops`     | `healthcare`           | ❌   |
| `financial-planning` | `finance`              | ❌   |
| `sales-ops`          | `sales`                | ❌   |

---

## 26. P1 高优先级缺口测试规范

### 26.1 [GAP-VI-2] 缺 PlanBundle/WorkProduct/EvaluationReport 核心数据契约

**缺口**: 架构 §45.8/§45.9/§45.10 定义 Planner 输出 `PlanBundle`、Generator 输出 `WorkProduct`、Evaluator 输出 `EvaluationReport`。当前步骤使用 `Record<string, unknown>` 替代。

**测试类型**: Unit (Schema)

```typescript
test("[GAP-VI-2] PlanBundle schema validates required fields", () => {
  const validBundle = {
    planId: "plan-001",
    steps: [
      { stepId: "s1", tool: "read_file", args: { path: "src/index.ts" } },
    ],
    dag: { roots: ["s1"], edges: [] },
    strategy: "sequential",
    estimatedTokens: 500,
  };
  assert.doesNotThrow(() => PlanBundleSchema.parse(validBundle));
});

test("[GAP-VI-2] WorkProduct schema validates required fields", () => {
  const validProduct = {
    productId: "wp-001",
    stepId: "s1",
    outputType: "code_change",
    content: { diff: "+line" },
    tokenCount: 120,
  };
  assert.doesNotThrow(() => WorkProductSchema.parse(validProduct));
});

test("[GAP-VI-2] EvaluationReport schema validates required fields", () => {
  const validReport = {
    reportId: "eval-001",
    verdict: "pass",
    scores: { correctness: 0.9, completeness: 0.8 },
    feedback: null,
  };
  assert.doesNotThrow(() => EvaluationReportSchema.parse(validReport));
});
```

### 26.2 [GAP-VI-3] ConstraintPack 缺 risk_policy + output_policy

**缺口**: 架构 §45.3 定义 ConstraintPack 5 维约束（budget, time, risk_policy, output_policy, tool_restrictions）。当前仅有 3 维。

**测试类型**: Unit

```typescript
test("[GAP-VI-3] ConstraintPack includes all 5 dimensions", () => {
  const pack = createConstraintPack({
    budget: { maxTokens: 10000, maxCost: 1.0 },
    time: { maxDurationMs: 60000 },
    riskPolicy: { maxRiskLevel: "medium", requireApprovalAbove: "high" },
    outputPolicy: { maxOutputTokens: 5000, allowedFormats: ["code", "text"] },
    toolRestrictions: { denied: ["shell_exec"], requireSandbox: true },
  });

  assert.ok(pack.riskPolicy, "riskPolicy dimension must exist");
  assert.ok(pack.outputPolicy, "outputPolicy dimension must exist");
  assert.equal(pack.riskPolicy.maxRiskLevel, "medium");
});

test("[GAP-VI-3] ConstraintEngine merges multi-layer constraints", () => {
  const orgConstraint = createConstraintPack({ budget: { maxTokens: 50000 } });
  const domainConstraint = createConstraintPack({
    budget: { maxTokens: 10000 },
  });
  const taskConstraint = createConstraintPack({ budget: { maxTokens: 5000 } });

  const merged = ConstraintEngine.merge([
    orgConstraint,
    domainConstraint,
    taskConstraint,
  ]);
  assert.equal(merged.budget.maxTokens, 5000, "Most restrictive budget wins");
});
```

### 26.3 [GAP-VI-4] Durable Harness 不存在

**缺口**: 架构 §45.15 定义 5 种暂停原因、4 种恢复策略、checkpoint/restore。无任何实现。

**测试类型**: Integration

```typescript
test("[GAP-VI-4] Durable Harness checkpoints run state after each iteration", async () => {
  const harness = createDurableHarness({ checkpointInterval: 1 });
  const envelope = createRequestEnvelope({ constraints: { maxIterations: 3 } });

  const run = await harness.runLoop(envelope);
  const checkpoints = await harness.getCheckpoints(run.id);
  assert.ok(checkpoints.length >= 3, "Must checkpoint after each iteration");
});

test("[GAP-VI-4] Durable Harness restores from checkpoint after crash", async () => {
  const harness = createDurableHarness();
  const envelope = createRequestEnvelope({ constraints: { maxIterations: 5 } });

  const run = await harness.runLoop(envelope, { crashAfterIteration: 2 });
  assert.equal(run.iterations, 2);

  const resumed = await harness.resume(run.id);
  assert.ok(resumed.iterations > 2, "Must continue from checkpoint");
  assert.equal(resumed.status, "completed");
});
```

**5 种暂停原因测试**:

| pauseReason           | 触发条件          | 恢复策略              |
| --------------------- | ----------------- | --------------------- |
| `human_review`        | 高风险步骤        | 人工审批后 resume     |
| `budget_warning`      | 80% 预算消耗      | 追加预算或终止        |
| `tool_unavailable`    | 依赖工具离线      | 工具恢复后自动 resume |
| `external_dependency` | 等待外部 API 响应 | 回调触发 resume       |
| `scheduled_pause`     | 预设暂停点        | 定时或手动 resume     |

### 26.4 [GAP-VI-5] ContextAssembler + ContextSnapshot 不存在

**缺口**: 架构 §45.5 定义 4 层上下文（conversation, task, memory, knowledge）+ token 预算裁剪 + 快照。

**测试类型**: Unit

```typescript
test("[GAP-VI-5] ContextAssembler assembles 4-layer context", () => {
  const assembler = new ContextAssembler({ tokenBudget: 4000 });
  const snapshot = assembler.assemble({
    conversation: [{ role: "user", content: "implement feature" }],
    task: { objective: "add login", currentStep: "s1" },
    memory: [{ key: "prev-attempt", value: "failed due to timeout" }],
    knowledge: [{ source: "docs/auth.md", snippet: "OAuth2 flow..." }],
  });

  assert.ok(snapshot.conversation.length > 0);
  assert.ok(snapshot.task);
  assert.ok(snapshot.totalTokens <= 4000, "Must respect token budget");
});

test("[GAP-VI-5] ContextAssembler trims lowest-priority layer when over budget", () => {
  const assembler = new ContextAssembler({ tokenBudget: 100 });
  const snapshot = assembler.assemble({
    conversation: [{ role: "user", content: "x".repeat(50) }],
    task: { objective: "y".repeat(30) },
    memory: [{ key: "z", value: "z".repeat(200) }],
    knowledge: [],
  });

  assert.ok(snapshot.totalTokens <= 100);
  assert.ok(
    snapshot.trimmedLayers.includes("memory"),
    "Memory should be trimmed first",
  );
});
```

### 26.5 [GAP-VI-6] RecoveryController 不存在

**缺口**: 架构 §45.11 定义 5 种故障类型 + 类型化恢复策略。

**测试类型**: Unit

```typescript
test("[GAP-VI-6] RecoveryController handles all 5 failure types", () => {
  const failureTypes = [
    "worker_crash",
    "llm_unavailable",
    "tool_timeout",
    "budget_exhausted",
    "platform_panic",
  ];

  const controller = new RecoveryController();
  for (const type of failureTypes) {
    const strategy = controller.getStrategy(type);
    assert.ok(strategy, `Must have recovery strategy for "${type}"`);
    assert.ok(strategy.action, `Strategy for "${type}" must define action`);
  }
});

test("[GAP-VI-6] RecoveryController retries on llm_unavailable", async () => {
  const controller = new RecoveryController();
  let attempts = 0;
  const operation = async () => {
    attempts++;
    if (attempts < 3) throw new Error("llm_unavailable");
    return "success";
  };

  const result = await controller.executeWithRecovery(
    operation,
    "llm_unavailable",
  );
  assert.equal(result, "success");
  assert.equal(attempts, 3);
});
```

### 26.6 [GAP-IV-2] 23 域缺 config 文件

**缺口**: 仅 `coding` 域有 `src/domains/coding/index.ts` 专用配置。其余 23 域缺少域特化工作流、工具束、预算限制、安全级别。

**测试类型**: Unit (Golden)

```typescript
test("[GAP-IV-2] each domain has a config file with required fields", () => {
  const domains = DomainBaselineCatalog.getAllDomainIds();
  const requiredFields = [
    "workflows",
    "toolBundle",
    "budgetLimits",
    "securityLevel",
  ];

  for (const domainId of domains) {
    const config = DomainConfigRegistry.get(domainId);
    assert.ok(config, `Domain "${domainId}" must have config`);
    for (const field of requiredFields) {
      assert.ok(
        config[field] !== undefined,
        `Domain "${domainId}" config missing "${field}"`,
      );
    }
  }
});
```

### 26.7 [GAP-IV-3] 24 域缺域特化 Agent 工作流

**缺口**: 全部 24 域使用通用 2 步骤工作流（intake→deliver），无域特化工具和步骤。

**测试类型**: Unit

```typescript
test("[GAP-IV-3] each domain defines specialized workflows beyond generic", () => {
  const domains = DomainBaselineCatalog.getAllDomainIds();

  for (const domainId of domains) {
    const workflows = DomainWorkflowRegistry.getWorkflows(domainId);
    assert.ok(workflows.length >= 1, `Domain "${domainId}" needs workflows`);

    const hasSpecialized = workflows.some((w) => w.steps.length > 2);
    assert.ok(
      hasSpecialized,
      `Domain "${domainId}" must have at least one workflow with >2 steps`,
    );
  }
});
```

### 26.8 [GAP-III-2] DomainRecipe 仅 4 种原型，缺 8 种

**缺口**: `src/domains/domain-recipe-service.ts` 仅有 4 种模板（analysis/implementation/review/release）。架构要求 12 种。

**测试类型**: Unit

```typescript
test("[GAP-III-2] DomainRecipeService provides all 12 archetype templates", () => {
  const expectedArchetypes = [
    "analysis",
    "implementation",
    "review",
    "release",
    "trading",
    "compliance",
    "research",
    "adversarial",
    "moderation",
    "logistics",
    "conversational",
    "incident_ops",
  ];

  const service = new DomainRecipeService();
  for (const archetype of expectedArchetypes) {
    const template = service.getTemplate(archetype);
    assert.ok(template, `Template for archetype "${archetype}" must exist`);
    assert.ok(
      template.steps.length > 0,
      `Template "${archetype}" must have steps`,
    );
  }
});
```

---

## 27. P2 中优先级缺口测试规范

### 27.1 [GAP-VI-7] ToolbeltAssembler 不存在

**缺口**: 架构 §45.4 定义 6 步工具组装管线（域工具 → 约束过滤 → 风险排除 → 预算排除 → 安全守卫 → 可靠性附加）。

**测试类型**: Unit

```typescript
test("[GAP-VI-7] ToolbeltAssembler applies 6-step pipeline", () => {
  const domainTools = ["read_file", "write_file", "shell_exec", "web_search"];
  const constraints = createConstraintPack({
    toolRestrictions: { denied: ["shell_exec"] },
    riskPolicy: { maxRiskLevel: "low" },
  });

  const assembler = new ToolbeltAssembler();
  const toolbelt = assembler.assemble(domainTools, constraints);

  assert.ok(!toolbelt.includes("shell_exec"), "Denied tool must be excluded");
  assert.ok(toolbelt.includes("read_file"), "Safe tool must be included");
});
```

### 27.2 [GAP-VI-8] Guardrails 5 层不存在

**缺口**: 架构 §45.20 定义 5 层护栏（input, planning, tool, memory, output）+ 9 种拦截动作。

**测试类型**: Unit

```typescript
test("[GAP-VI-8] Guardrails validates all 5 layers", () => {
  const layers = ["input", "planning", "tool", "memory", "output"];
  const guardrails = new GuardrailsEngine();

  for (const layer of layers) {
    const rules = guardrails.getRules(layer);
    assert.ok(rules.length > 0, `Layer "${layer}" must have at least one rule`);
  }
});

test("[GAP-VI-8] Guardrails intercepts unsafe tool call", () => {
  const guardrails = new GuardrailsEngine();
  const result = guardrails.check("tool", {
    toolName: "shell_exec",
    args: { command: "rm -rf /" },
  });

  assert.equal(result.action, "block");
  assert.ok(result.reason.includes("unsafe"));
});
```

### 27.3 [GAP-VI-9] HITL Runtime 不存在

**缺口**: 架构 §45.18 定义 Harness 嵌入式 HITL Runtime（inspect/patch/override/takeover/resume）。注意审批层 HITL（§21）已实现，此缺口特指 Harness 级 HITL。

**测试类型**: Integration

```typescript
test("[GAP-VI-9] HITL Runtime supports inspect mid-run", async () => {
  const harness = createHarnessWithHitl();
  const run = await harness.startRun(createRequestEnvelope());

  const snapshot = await harness.hitl.inspect(run.id);
  assert.ok(snapshot.currentStep);
  assert.ok(snapshot.context);
  assert.ok(snapshot.status);
});

test("[GAP-VI-9] HITL Runtime supports patch and resume", async () => {
  const harness = createHarnessWithHitl();
  const run = await harness.startRun(createRequestEnvelope());
  await harness.hitl.pause(run.id);

  await harness.hitl.patch(run.id, { context: { override: "new value" } });
  const resumed = await harness.hitl.resume(run.id);
  assert.equal(resumed.status, "running");
});
```

### 27.4 [GAP-IV-4/5/6/7] 域特化风险/评估/延迟/Division

**缺口**: 24 域缺少特化风险覆盖（IV-4）、评估指标（IV-5）、延迟等级/数据敏感度设置（IV-6）、13 域缺 division YAML（IV-7）。

**测试类型**: Unit (Schema Validation)

```typescript
test("[GAP-IV-4] each domain defines risk overrides", () => {
  const domains = DomainBaselineCatalog.getAllDomainIds();
  for (const domainId of domains) {
    const config = DomainConfigRegistry.get(domainId);
    assert.ok(config?.riskOverrides, `"${domainId}" must define riskOverrides`);
  }
});

test("[GAP-IV-5] each domain defines evaluation metrics", () => {
  const domains = DomainBaselineCatalog.getAllDomainIds();
  for (const domainId of domains) {
    const metrics = DomainEvalRegistry.getMetrics(domainId);
    assert.ok(metrics.length > 0, `"${domainId}" must have eval metrics`);
  }
});

test("[GAP-IV-6] each domain defines latency tier and data sensitivity", () => {
  const domains = DomainBaselineCatalog.getAllDomainIds();
  const validTiers = ["realtime", "near_realtime", "batch"];
  const validSensitivities = ["low", "medium", "high", "critical"];

  for (const domainId of domains) {
    const config = DomainConfigRegistry.get(domainId);
    assert.ok(
      validTiers.includes(config?.latencyTier),
      `"${domainId}" invalid latencyTier`,
    );
    assert.ok(
      validSensitivities.includes(config?.dataSensitivity),
      `"${domainId}" invalid dataSensitivity`,
    );
  }
});

test("[GAP-IV-7] all domains have division YAML files", () => {
  const domains = DomainBaselineCatalog.getAllDomainIds();
  for (const domainId of domains) {
    const divisionPath = `divisions/${domainId}.yml`;
    assert.ok(
      existsSync(divisionPath) || existsSync(`divisions/${domainId}.yaml`),
      `Division file for "${domainId}" must exist`,
    );
  }
});
```

### 27.5 [GAP-X-1] RoadmapService 缺 Phase 8/9 注册

**缺口**: `RoadmapService` 未注册 Phase 8（Harness）和 Phase 9a-9f（域批次）。

**测试类型**: Unit

```typescript
test("[GAP-X-1] RoadmapService includes Phase 8 and Phase 9 batches", () => {
  const phases = RoadmapService.getAllPhases();
  const phaseIds = phases.map((p) => p.id);

  assert.ok(
    phaseIds.includes("phase-8"),
    "Phase 8 (Harness) must be registered",
  );
  for (const batch of ["9a", "9b", "9c", "9d", "9e", "9f"]) {
    assert.ok(
      phaseIds.includes(`phase-${batch}`),
      `Phase ${batch} must be registered`,
    );
  }
});
```

### 27.6 [GAP-X-2/X-3] ADR 文件 + Harness 目录结构

**测试类型**: Config Validation (CI)

```typescript
test("[GAP-X-2] required ADR files exist", () => {
  const requiredAdrs = [
    "adr-harness-loop-model.md",
    "adr-harness-constraint-engine.md",
    "adr-harness-durable-state.md",
    "adr-harness-guardrails.md",
    "adr-harness-toolbelt.md",
    "adr-harness-hitl-runtime.md",
    "adr-harness-memory-namespace.md",
    "adr-harness-feedback-envelope.md",
    "adr-harness-recovery-controller.md",
  ];

  for (const adr of requiredAdrs) {
    assert.ok(
      existsSync(`docs_zh/adr/${adr}`) || existsSync(`docs_en/adr/${adr}`),
      `ADR "${adr}" must exist`,
    );
  }
});

test("[GAP-X-3] harness directory follows architecture recommended structure", () => {
  const requiredDirs = [
    "runtime",
    "protocol",
    "planner",
    "generator",
    "evaluator",
    "loop",
    "context",
    "constraints",
    "guardrails",
    "toolbelt",
    "hitl-runtime",
    "durable",
    "types",
  ];

  const basePath = "src/platform/orchestration/harness";
  for (const dir of requiredDirs) {
    assert.ok(
      existsSync(`${basePath}/${dir}`),
      `Harness subdirectory "${dir}" must exist`,
    );
  }
});
```

### 27.7 [GAP-I-2] OAPEFLIR-Harness 语义映射未代码化

**测试类型**: Unit

```typescript
test("[GAP-I-2] OAPEFLIR-Harness mapping config exists and covers all 8 stages", () => {
  const mapping = OapeflirHarnessMapping.getMapping();
  const stages = [
    "observe",
    "assess",
    "plan",
    "execute",
    "feedback",
    "learn",
    "improve",
    "release",
  ];

  for (const stage of stages) {
    assert.ok(mapping[stage], `Mapping for stage "${stage}" must exist`);
    assert.ok(
      mapping[stage].harnessRole !== undefined,
      `Stage "${stage}" must map to a harness role`,
    );
  }
});
```

### 27.8 [GAP-II-2] ModelGateway 缺少 embed()/complete() 方法

**测试类型**: Unit

```typescript
test("[GAP-II-2] UnifiedChatProvider supports embed() method", async () => {
  const provider = createMockProvider();
  const result = await provider.embed({
    text: "hello world",
    model: "mock-embed",
  });
  assert.ok(result.vector);
  assert.ok(result.vector.length > 0);
});

test("[GAP-II-2] UnifiedChatProvider supports complete() method", async () => {
  const provider = createMockProvider();
  const result = await provider.complete({
    prompt: "say hello",
    model: "mock-model",
    maxTokens: 100,
  });
  assert.ok(result.text);
  assert.ok(result.tokenCount > 0);
});
```

---

## 28. P3/P4 低优先级缺口测试规范

### 28.1 [GAP-VI-10] FeedbackEnvelope 4 级反馈

**测试类型**: Unit (Schema)

```typescript
test("[GAP-VI-10] FeedbackEnvelope supports 4 levels", () => {
  const levels = ["step", "task", "workflow", "system"];
  for (const level of levels) {
    const envelope = createFeedbackEnvelope({
      level,
      signal: { type: "correction" },
    });
    assert.doesNotThrow(() => FeedbackEnvelopeSchema.parse(envelope));
  }
});
```

### 28.2 [GAP-VI-11] Memory Namespace 3 层

**测试类型**: Unit

```typescript
test("[GAP-VI-11] Memory Namespace supports 3 tiers", () => {
  const ns = new MemoryNamespace();
  ns.write("working", "key1", "value1");
  ns.write("long_term", "key2", "value2");
  ns.write("shared", "key3", "value3");

  assert.equal(ns.read("working", "key1"), "value1");
  assert.equal(ns.read("long_term", "key2"), "value2");
  assert.equal(ns.read("shared", "key3"), "value3");
});
```

### 28.3 [GAP-VI-12] Async Harness 6 API

**测试类型**: Integration

```typescript
test("[GAP-VI-12] Async Harness exposes 6 required APIs", () => {
  const apis = [
    "createRun",
    "pollStatus",
    "subscribeEvents",
    "inspectStep",
    "interveneMidRun",
    "replayAfterCompletion",
  ];
  const harness = new AsyncHarnessClient();

  for (const api of apis) {
    assert.equal(typeof harness[api], "function", `API "${api}" must exist`);
  }
});
```

### 28.4 [GAP-VI-13] Evaluation Harness 3 模式

**测试类型**: Unit

```typescript
test("[GAP-VI-13] Evaluation Harness supports 3 modes", () => {
  const modes = ["runtime", "pre_release", "version_compare"];
  for (const mode of modes) {
    const harness = EvaluationHarness.create({ mode });
    assert.equal(harness.mode, mode);
  }
});
```

### 28.5 [GAP-VI-14] Harness 可观测性 + Prompt 治理 + Failure-to-Learning + Replay

**测试类型**: Unit (P4 延迟 — 占位规范)

```typescript
test("[GAP-VI-14] Harness observability emits structured traces", async () => {
  const traces: unknown[] = [];
  const harness = createHarnessWithObservability({
    onTrace: (t) => traces.push(t),
  });
  await harness.runLoop(
    createRequestEnvelope({ constraints: { maxIterations: 1 } }),
  );
  assert.ok(traces.length > 0, "Harness must emit traces");
});
```

### 28.6 [GAP-VI-15] 10 项不变量强制

**测试类型**: Unit (P4 延迟 — 占位规范)

```typescript
test("[GAP-VI-15] Loop controller enforces plannerOutput non-empty before execution", async () => {
  const harness = createHarnessWithEmptyPlanner();
  const run = await harness.runLoop(createRequestEnvelope());
  assert.equal(run.status, "planner_output_empty");
  assert.equal(run.iterations, 0, "Must not proceed to execution without plan");
});

test("[GAP-VI-15] Loop controller auto-checkpoints after >3 steps", async () => {
  const harness = createDurableHarness({ autoCheckpointThreshold: 3 });
  const run = await harness.runLoop(
    createRequestEnvelope({ constraints: { maxIterations: 2 } }),
  );
  const checkpoints = await harness.getCheckpoints(run.id);
  assert.ok(checkpoints.length > 0, "Must auto-checkpoint after >3 steps");
});
```

### 28.7 其他 P3 缺口

| 缺口 ID | 标题                  | 测试要求                                           |
| ------- | --------------------- | -------------------------------------------------- |
| II-3    | 仅 3 个 LLM 提供商    | 当新增提供商时，验证 ProviderRegistry 包含该提供商 |
| I-1     | S4 K8s 集群级分片     | 部署拓扑关注点，不在代码仓库测试范围内             |
| IX-1    | ops-maturity 桩文件率 | 参见 Part IV §33 桩文件追踪                        |

---

# Part IV — 系统工程缺陷回归测试（v2.0 原 Part III 保留，v3.0 更新编号）

> Part III 解决"架构设计-实现缺口"。
> Part IV 解决"**系统工程缺陷的回归防护**" — 基于架构审查 v4.1 发现的工程缺陷（Redis 错误处理、并发竞态、静默丢任务等），定义对应的回归测试规范。
>
> **v3.0 变更**: 从 v2.0 Part III（§24-§30）迁移至 Part IV（§29-§34），编号更新，内容保留。SYS-\* 缺陷编号不变。

---

## 29. P0 阻断级工程缺陷测试规范

> 对应 v2.0 §25。

### 29.1 [SYS-REL-2.1] Redis 错误处理器静默吞错

**缺陷**: `distributed-lock/redis-lock-adapter.ts`、`queue/redis-queue-adapter.ts`、`ingress/redis-rate-limiter.ts`、`cache/stores/redis-cache-store.ts` 中 `this.redis.on("error", () => {})` 静默吞掉所有 Redis 错误。

**测试类型**: Unit + Integration

**测试目标**: Redis 连接错误必须 (1) 记录到 StructuredLogger，(2) 更新健康状态标志，(3) 递增 Prometheus 计数器。

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

**覆盖文件**（每个文件一组测试）:

| 文件                                               | 测试文件                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| `execution/distributed-lock/redis-lock-adapter.ts` | `tests/unit/platform/execution/redis-lock-error.test.ts`         |
| `execution/queue/redis-queue-adapter.ts`           | `tests/unit/platform/execution/redis-queue-error.test.ts`        |
| `interface/ingress/redis-rate-limiter.ts`          | `tests/unit/platform/interface/redis-rate-limiter-error.test.ts` |
| `shared/cache/stores/redis-cache-store.ts`         | `tests/unit/platform/shared/redis-cache-error.test.ts`           |

### 29.2 [SYS-REL-2.3] DLQ 纯内存，重启丢失

**缺陷**: `state-evidence/dlq/index.ts` 使用 `Map<string, DeadLetterRecord>` 存储死信，进程重启后全部丢失。

**测试类型**: Integration

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

### 29.3 [SYS-REL-2.4] Redis 队列静默丢任务

**缺陷**: `execution/queue/redis-queue-adapter.ts` 中 5 处关键 enqueue 操作使用 `.catch(() => {})`。

**测试类型**: Unit

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

### 29.4 [SYS-DEPLOY-6.3] Dockerfile CMD 路径不存在

**缺陷**: `Dockerfile` 行 46 的 CMD 引用不存在的路径。

**测试类型**: CI Build Verification

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

## 30. P1 严重缺陷测试规范

### 30.1 [SYS-REL-2.2] Redis 锁 TOCTOU 竞态

**缺陷**: `distributed-lock/redis-lock-adapter.ts` 的 `extendAsync()` 使用非原子 GET+SET，`forceStealAsync()` 使用非原子 DEL+SET。并发场景下两个进程可同时持有同一把锁。

**测试类型**: Integration (Concurrency)

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

### 30.2 [SYS-REL-2.7] 工作流状态转换缺少 CAS

**缺陷**: `execution/state-transition/transition-service.ts` 任务转换有 CAS，但工作流转换无 CAS 保护。

**测试类型**: Integration (Concurrency)

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

### 30.3 [SYS-REL-2.5] SLO 告警投递静默丢失

**缺陷**: `shared/observability/slo-alerting-service.ts` 行 172/227/281/339 告警投递失败时 `.catch(() => {})`。

**测试类型**: Unit

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

### 30.4 [SYS-REL-2.6] Outbox 未接入关键写路径

**缺陷**: `shared/outbox/outbox-service.ts` 完整实现存在，但 `transition-service.ts` 的任务状态转换直接写事件表不经 Outbox。

**测试类型**: Integration

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

### 30.5 [SYS-REL-2.8] 会话双存储非原子写入

**缺陷**: `state-evidence/truth/session-dual-storage.ts` 两次 `appendFileSync` 之间崩溃导致不一致。

**测试类型**: Integration (Fault Injection)

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

### 30.6 [SYS-PERF-3.1] StructuredLogger 同步 I/O 阻塞事件循环

**缺陷**: `shared/observability/structured-logger.ts:295` 每条日志调用 `appendFileSync` 阻塞事件循环。

**测试类型**: Performance / Unit

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

**缺陷**: `deploy/prometheus/alertmanager.yml` 三个接收器全部指向同一内部 webhook。

**测试类型**: Golden / Config Validation

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

**缺陷**: `deploy/terraform/main.tf` 无 `backend {}` 块，状态文件本地存储。

**测试类型**: Config Validation

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

## 31. P2 重要缺陷测试规范

### 31.1 [SYS-ARCH-1.1] 五面体跨面导入守护

**缺陷**: 394 处跨面导入违反五面体架构（如 state-evidence 导入 execution）。

**测试类型**: Static Analysis (Architectural)

```typescript
test("[SYS-ARCH-1.1] no cross-plane imports from state-evidence to execution", () => {
  const stateEvidenceFiles = globSync("src/platform/state-evidence/**/*.ts");
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
  const controlPlaneFiles = globSync("src/platform/control-plane/**/*.ts");
  for (const file of controlPlaneFiles) {
    const content = readFileSync(file, "utf8");
    assert.ok(
      !content.match(/from\s+"[^"]*\/state-evidence\//),
      `${file} must not import from state-evidence plane`,
    );
  }
});
```

**禁止的导入方向**（测试必须覆盖所有）:

| 源面           | 禁止导入目标                            |
| -------------- | --------------------------------------- |
| state-evidence | execution, control-plane                |
| control-plane  | state-evidence (直接), execution (直接) |
| interface      | 仅允许导入 shared/, contracts/          |
| orchestration  | execution (直接跳过 shared 适配器)      |

### 31.2 [SYS-OBS-5.1] 关键路径 console.\* 禁用

**缺陷**: 37 处关键路径使用 `console.*` 绕过 StructuredLogger。

**测试类型**: Static Analysis / Lint

```typescript
test("[SYS-OBS-5.1] OAPEFLIR files do not use console.* directly", () => {
  const oapeflirFiles = globSync("src/platform/orchestration/oapeflir/**/*.ts");
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

### 31.3 [SYS-OBS-5.2] Prometheus 告警规则完整性

**缺陷**: 仅 3 条 Prometheus 告警规则，缺少 DB、Redis、事件循环、队列等关键告警。

**测试类型**: Config Validation

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

**缺陷**: `distributed-lock/redis-lock-adapter.ts:236` 使用 `redis.keys("lock:*")` O(n) 阻塞。

**测试类型**: Unit / Static Analysis

```typescript
test("[SYS-PERF-3.2] redis lock adapter uses SCAN instead of KEYS", () => {
  const content = readFileSync(
    "src/platform/execution/distributed-lock/redis-lock-adapter.ts",
    "utf8",
  );
  assert.ok(!content.includes(".keys("), "Must use SCAN, not KEYS command");
  assert.ok(
    content.includes(".scan(") || content.includes("scanStream("),
    "Must use SCAN or scanStream for key iteration",
  );
});
```

### 31.5 [SYS-PERF-3.4] 无界 Map 内存守护

**缺陷**: 20+ 处 `Map` 只增不删，长时间运行导致内存泄漏。

**测试类型**: Unit (Stress)

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

### 31.6 [SYS-SEC-4.2] 路径遍历一致性

**缺陷**: `knowledge-snapshot-store.ts:29` 直接 `readFileSync(this.snapshotPath)` 无沙箱检查。

**测试类型**: Security Unit

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

### 31.7 [SYS-SEC-4.1] 环境变量启动校验完整性

**缺陷**: 插件/安全相关 `AA_*` 环境变量不在 Zod 启动校验范围内。

**测试类型**: Unit

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

## 32. 架构不变量自动守护测试

> 对应 v2.0 §28。

### 32.1 目的

将架构审查中发现的结构性问题转化为**持续运行的自动化守护测试**，防止架构腐化复发。

### 32.2 守护测试清单

| 守护项                        | 测试文件                                                        | 频率    |
| ----------------------------- | --------------------------------------------------------------- | ------- |
| 五面体导入隔离                | `tests/unit/platform/contracts/plane-isolation.test.ts`         | 每次 CI |
| console.\* 禁用（非 SDK/CLI） | `tests/unit/platform/contracts/no-console-in-runtime.test.ts`   | 每次 CI |
| `as any` 数量上限             | `tests/unit/platform/contracts/type-safety-bounds.test.ts`      | 每次 CI |
| Redis KEYS 命令禁用           | `tests/unit/platform/contracts/no-redis-keys.test.ts`           | 每次 CI |
| 路由无重复注册                | `tests/unit/platform/contracts/no-duplicate-routes.test.ts`     | 每次 CI |
| Zod 边界校验覆盖              | `tests/unit/platform/contracts/zod-boundary-validation.test.ts` | 每次 CI |
| 桩文件不增长                  | `tests/unit/platform/contracts/stub-count-ratchet.test.ts`      | 每次 CI |
| Dockerfile CMD 路径有效       | `tests/integration/deploy/dockerfile-entrypoint.test.ts`        | 每次 CI |

### 32.3 Zod 边界校验覆盖守护

```typescript
test("[SYS-QUAL-7.3] API route handlers call schema.parse on request body", () => {
  const routeFiles = globSync(
    "src/platform/interface/api/http-server/*-routes.ts",
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

### 32.4 桩文件数量棘轮

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

## 33. 桩文件覆盖缺口追踪

> 对应 v2.0 §29。

### 33.1 ops-maturity 桩文件明细

`src/ops-maturity/` 是桩文件重灾区，以下子目录桩率较高：

| 子目录                 | 总文件 | 当前 Lines 覆盖率 | 对应架构章节       |
| ---------------------- | ------ | ----------------- | ------------------ |
| `platform-ops-agent/`  | 9      | 38.7%             | §69 平台运维 Agent |
| `edge-runtime/`        | 5      | 96.6%             | §63 边缘推理       |
| `capacity-planner/`    | 5      | 94.0%             | §68 容量规划       |
| `compliance-reporter/` | 3      | —                 | §67 合规报告       |
| `cost-optimizer/`      | 3      | —                 | §65 成本优化       |
| `emergency/`           | 4      | 95.0%             | §60 紧急制动       |
| `multimodal/`          | 7      | 97.1%             | §68B 多模态        |
| `workflow-debugger/`   | 5      | 99.5%             | §62 工作流调试     |
| `explainability/`      | 2      | —                 | §59 可解释性       |

### 33.2 桩文件退出条件

一个桩文件被认为"已实现"的条件：

| 条件       | 标准                         |
| ---------- | ---------------------------- |
| 代码行数   | ≥ 50 行非空非注释代码        |
| 类方法数   | ≥ 3 个非空方法体             |
| 测试覆盖   | Branch coverage ≥ 60%        |
| 变异分数   | Mutation score ≥ 50%         |
| 外部调用者 | 至少被 1 个非测试文件 import |

---

## 34. 测试缺口与覆盖现状汇总

> 对应 v2.0 §30，v3.0 更新全部数据。

### 34.1 源区域 → 测试文件数量对照（v3.0 实测）

| 源目录                 | 源文件    | Unit 测试 | Integration 测试 | 合计      | 比率     |
| ---------------------- | --------- | --------- | ---------------- | --------- | -------- |
| `src/platform/`        | 903       | 713       | 230              | 943       | 1.04     |
| `src/scale-ecosystem/` | 73        | 56        | 7                | 63        | 0.86     |
| `src/domains/`         | 51        | 34        | 6                | 40        | 0.78     |
| `src/ops-maturity/`    | 87        | 57        | 12               | 69        | 0.79     |
| `src/interaction/`     | 40        | 24        | 2                | 26        | 0.65     |
| `src/org-governance/`  | 41        | 23        | 2                | 25        | 0.61     |
| `src/sdk/`             | 93        | 16        | 35               | 51        | 0.55     |
| `src/plugins/`         | 25        | 21        | 0                | 21        | 0.84     |
| `src/core/`            | 8         | 7         | 0                | 7         | 0.88     |
| `src/apps/`            | 4         | 4         | 0                | 4         | 1.00     |
| **合计**               | **1,335** | **1,011** | **301**          | **1,341** | **1.00** |

### 34.2 E2E 测试文件清单（10 文件）

| 文件                           | 覆盖场景          |
| ------------------------------ | ----------------- |
| `task-lifecycle.test.ts`       | 任务全生命周期    |
| `oapeflir-full-loop.test.ts`   | OAPEFLIR 完整循环 |
| `multi-step-workflow.test.ts`  | 多步骤工作流      |
| `approval-event-flow.test.ts`  | 审批事件流        |
| `gateway-webhook-flow.test.ts` | 网关 Webhook 流   |
| `streaming-response.test.ts`   | 流式响应          |
| `session-memory-flow.test.ts`  | 会话记忆流        |
| `operator-takeover.test.ts`    | 运维接管          |
| `lease-recovery.test.ts`       | Lease 恢复        |
| `error-propagation.test.ts`    | 错误传播          |

### 34.3 Golden 测试文件清单（11 文件）

| 文件                           | 守护对象              |
| ------------------------------ | --------------------- |
| `openapi-document.test.ts`     | OpenAPI 文档结构      |
| `cli-help-text.test.ts`        | CLI 帮助文本          |
| `diagnostics-bundle.test.ts`   | 诊断包结构            |
| `prompt-assembly.test.ts`      | 提示组装 + 缓存键     |
| `session-summary.test.ts`      | 会话摘要结构          |
| `release-plan-output.test.ts`  | 发布计划 Markdown     |
| `workflow-validation.test.ts`  | 工作流校验            |
| `phase1a-golden-tasks.test.ts` | Phase 1a 黄金任务套件 |

> v3.0: Golden 测试从 8 → 11 文件（+3 新增文件未在此列出，需实际确认文件名）。

### 34.4 Performance 测试文件清单（7 文件）

| 文件                     | 基准对象            |
| ------------------------ | ------------------- |
| `oapeflir-perf.test.ts`  | OAPEFLIR 循环吞吐量 |
| `knowledge-perf.test.ts` | 知识检索延迟        |
| `planning-perf.test.ts`  | 规划生成延迟        |
| `feedback-perf.test.ts`  | 反馈处理吞吐量      |
| `plugin-perf.test.ts`    | 插件执行延迟        |
| `handoff-perf.test.ts`   | 交接流程延迟        |

> v3.0: Performance 测试从 6 → 7 文件。

### 34.5 当前覆盖盲区 Top-5（v3.0 更新）

| 排名 | 盲区                                    | 现状                                                        | 建议                                    |
| ---- | --------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| 1    | **Harness 迭代循环** (GAP-VI-1)         | `runLoop()` 仅单次执行，无 Planner→Generator→Evaluator 循环 | 实现后新增循环测试（§25.1）             |
| 2    | **ACP 协作协议** (GAP-II-1)             | 仅 TODO 注释，零实现                                        | 实现后新增 7 不变量测试（§25.2）        |
| 3    | **域元模型** (GAP-III-1)                | 零实现，24 域无元模型回答                                   | 实现后新增 12 问题 × 24 域矩阵（§25.3） |
| 4    | **state-evidence/memory** (67.5% Lines) | 20 文件覆盖率不足 85% 红线                                  | 补充 memory 层测试                      |
| 5    | **sdk/cli branches** (47.2%)            | 79 文件 CLI 分支覆盖率不足 60% 红线                         | 补充 CLI 分支测试                       |

---

> **文档结束 (v3.0)** — 本手册从 v2.0 升级到 v3.0。
>
> **Part I** 保证：测试不少、质量不差、不会明显遗漏。
> **Part II** 保证：系统关键设计语义（状态机、事件、并发、阶段契约、Harness 语义映射）都被覆盖到。
> **Part III** 保证：架构审查 v6.0 发现的 **29 项架构设计-实现缺口** 有对应测试规范，实现后不会有测试盲区。
> **Part IV** 保证：**工程缺陷**（Redis 错误、并发竞态、配置问题等）有对应回归测试规范，修复后不会复发。
>
> 核心理念：**覆盖率棘轮保证数量，变异测试保证质量，Traceability Matrix 保证完整性，PR Review 保证上下文，架构语义矩阵保证设计契约，架构缺口回归矩阵保证设计-实现对齐，系统问题回归矩阵保证工程缺陷不复发。七者缺一不可。**
