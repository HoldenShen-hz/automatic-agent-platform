# ADR-072 OAPEFLIR 测试策略与新模块测试矩阵

- 状态：Accepted
- 决策日期：2026-04-17
- 相关：ADR-016 OAPEFLIR 八阶段认知循环模型

## 背景

OAPEFLIR 八阶段架构新增 7 个核心模块（agent-loop/planning/feedback/learning/improvement/knowledge/domain-registry），共约 130 文件 15,774 行代码。这些模块目前标记为 Unverified，需要建立完整的测试策略确保生产就绪。

## 决策

### 1. 测试分层模型

```
┌─────────────────────────────────────────────────────────────┐
│                    Golden / E2E Tests                        │
│   (tests/golden/harness-run-*.test.ts 等)                   │
├─────────────────────────────────────────────────────────────┤
│                   Integration Tests                          │
│   (tests/integration/platform/orchestration/*.test.ts 等)   │
├─────────────────────────────────────────────────────────────┤
│                    Unit Tests                                │
│   (tests/unit/{module}/*.test.ts)                           │
├─────────────────────────────────────────────────────────────┤
│          Invariants / Docs / Targeted Risk Checks           │
│   (tests/invariants/*.test.ts, tests/unit/docs/*.test.ts)   │
└─────────────────────────────────────────────────────────────┘
```

### 2. 新模块测试矩阵（v4.3 runtime 模块结构）

| 模块 | 单元测试 | 集成测试 | Golden | 安全 | 预估用例 |
|------|---------|---------|--------|------|---------|
| `platform/interface/` | API gateway, ingress, scheduler | intake→admission→projection 联调 | harness-run happy path | handoff 信息泄露 | ~120 |
| `platform/control-plane/` | IAM, config-center, approval-center | control-plane→orchestration | linear plan happy path | — | ~80 |
| `platform/orchestration/` | OAPEFLIR, routing, planner, HITL | plan→execute 集成 | — | autonomy boundary | ~60 |
| `platform/execution/` | dispatcher, execution-engine, recovery, worker-pool | execution→state-evidence | failure pattern golden | — | ~80 |
| `platform/state-evidence/` | truth, events, checkpoints, artifacts | truth→events 传递 | canary→stable golden | source pollution | ~100 |
| `domains/` | domain-registry, plugin-spi | 插件加载→执行 | retrieval accuracy golden | config injection | ~150 |
| `interaction/` | NL entry, goal decomposition | 摄取→检索 E2E | — | — | ~40 |
| **合计** | | | | | **~730** |

### 3. E2E 测试设计（5 个核心测试）

#### Test 1: Runtime Happy Path
```
输入: "modify foo.ts bar function"
验证: intake → admission → `HarnessRun` / `NodeRun` / `NodeAttemptReceipt` 全链路
验证: canonical contract 通过 schema 校验
验证: `oapeflir.view.*` 阶段视图连续，且不替代 runtime truth
验证: <60s E2E 延迟
```

#### Test 2: Runtime Failure Drives Learn
```
输入: 无效文件路径（必定失败）
验证: `NodeRun` 失败后，feedback / learn 视图能回链到同一 `harnessRunId`
验证: FailurePattern 有 evidence 链接
```

#### Test 3: Replan 触发
```
输入: 执行中途 tool_failure
验证: ReplanningService 生成 version N+1
验证: 新 `GraphPatch` 从失败 `NodeRun` 后继续
```

#### Test 4: Release Gate Progression
```
输入: 已有 LearningObject → ImprovementCandidate
验证: shadow → canary_5 → partial_25 → stable 完整流程
验证: 指标不达标时自动回滚
```

#### Test 5: 多 Agent Handoff
```
输入: 需要 2 个 Agent 协作的任务
验证: HandoffBuilder 序列化/反序列化往返
验证: Token budget < 1000
验证: FactLayer 无敏感信息泄露
```

### 4. 性能目标与专用基准落地点

## v4.3 ADR Remediation

- A-66: 本 ADR 原先把 OAPEFLIR 测试描述成“无阶段被跳过”的可执行主链，并使用“失败步骤后继续”表述 replan，根因是测试策略 ADR 把认知阶段视图和 runtime 执行图混在了一起。修复：正文现把 OAPEFLIR 限定为 view 连续性验证，把恢复/重规划锚点切到 `GraphPatch / NodeRun`。
- R8-74: 测试目标已改写为 `HarnessRun / NodeRun / NodeAttemptReceipt` truth + `oapeflir.view.*` 投影连续性，不再把 OAPEFLIR 本身表述为独立执行管线。
- R16-94: 本 ADR 之前把 `tests/security/`、`tests/chaos/`、`tests/performance/` 写成既有目录，根因是把规划中的专项测试资产误写成已落地事实。修复：正文现在只把 `tests/unit/`、`tests/integration/`、`tests/golden/`、`tests/e2e/`、`tests/invariants/` 作为现存权威测试根；专项性能/安全/混沌套件只能在目录和 CI 真正落地后再宣称存在。

| 模块 | 操作 | P99 目标 | 当前验证入口 |
|------|------|---------|-------------|
| Feedback | signal-preprocessor.preprocess() | <10ms | 由对应模块定向单测或后续专用基准承载 |
| Knowledge | knowledge-query-service.query() (Quick) | <100ms | 由对应模块定向单测或后续专用基准承载 |
| Knowledge | knowledge-retrieval.retrieve() (Standard) | <500ms | 由对应模块定向单测或后续专用基准承载 |
| Planning | plan-builder.build() | <50ms | 由对应模块定向单测或后续专用基准承载 |
| Runtime + OAPEFLIR View | `HarnessRun` truth 与 `oapeflir.view.*` 投影连续性 | <30s | 当前以集成测试与 `tests/invariants/` 不变量守护为主 |
| Handoff | handoff-serializer.serialize() | <5ms | 由 handoff 相关单测与不变量测试承载 |
| Plugin | plugin-spi-registry.invoke() | <200ms | 由 plugin SPI 相关单测与不变量测试承载 |

注：

- 当前仓内已存在的权威测试根只有 `tests/unit/`、`tests/integration/`、`tests/golden/`、`tests/e2e/`、`tests/invariants/`。
- 若后续新增 dedicated `performance` / `security` / `chaos` 套件，必须连同目录、测试文件与 CI 接线一起落地，不能只在 ADR 中预声明路径。

### 5. 安全测试覆盖

| 测试类型 | 覆盖内容 |
|---------|---------|
| Handoff 信息泄露 | FactLayer 不泄露 sensitive data |
| Autonomy boundary | 越权操作被 guardrail 拦截 |
| Domain config injection | 恶意配置被 PluginConfigValidator 拒绝 |
| Source pollution | Knowledge ingestion 不引入污染 |
| Tool call injection | CommandExecutor 阻止 shell 注入 |

### 6. 混沌测试（Stable Release Gate）

| 场景 | 注入故障 | 预期恢复 |
|------|---------|---------|
| Agent 节点宕机 | kill -9 模拟节点故障 | Lease 重新分配，任务迁移 |
| 数据库连接断开 | network partition | 事件持久化，本地缓冲 |
| 重规划风暴 | 连续 10 次 tool_failure | 退避策略触发，任务终止 |
| 内存溢出 | 分配超限 | OOM 被捕获，资源释放 |

## 备选方案

### 方案 A：仅做单元测试

优点：快速覆盖核心逻辑。
代价：无 E2E 验证，无法发现阶段间集成问题。

### 方案 B：完整测试金字塔（已选）

优点：单元/集成/golden/security/chaos 分层，覆盖全面。
代价：工作量大（约 730 测试用例 + 性能基准）。

## 后果

- 新增 `tests/unit/{module}/` 目录结构。
- 新增 `tests/integration/` 集成测试文件。
- 新增 `tests/golden/` Golden path 测试。
- 可在后续单独落地 dedicated 性能/安全/混沌套件，但必须先创建真实目录、测试文件和 CI 接线后再更新 ADR。
- `npm test` 必须全量通过作为生产就绪门禁。

## 交叉引用

- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-018 Rollout 11 状态机](./018-rollout-eleven-state-machine.md)
- `docs_zh/reviews/architecture-design-vs-implementation-review.md` §G1 解决方案（原始 design_gap_analysis_v9.md 已归档）

## 来源章节

- `§G1` 测试覆盖解决方案
- `§G3` E2E 测试设计
- `§G4` 性能基准测试
- `§6.1` 工业级标准

## v4.3 ADR Remediation

- R6-55: 修复测试矩阵对齐 v4.3 canonical runtime 模块。ADR-072 原先测试矩阵按 OAPEFLIR 模块目录组织，与 v4.3 canonical runtime 模块结构（platform/interface/、platform/control-plane/、platform/orchestration/、platform/execution/、platform/state-evidence/、domains/、interaction/）不一致。修复：正文测试矩阵已使用 v4.3 runtime 模块结构。
