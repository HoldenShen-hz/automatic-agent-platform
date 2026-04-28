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
│   (tests/golden/oapeflir-happy-path.test.ts 等)             │
├─────────────────────────────────────────────────────────────┤
│                   Integration Tests                          │
│   (tests/integration/oapeflir-loop-integration.test.ts 等)  │
├─────────────────────────────────────────────────────────────┤
│                    Unit Tests                                │
│   (tests/unit/{module}/*.test.ts)                           │
├─────────────────────────────────────────────────────────────┤
│               Security / Chaos / Performance                │
│   (tests/security/, tests/chaos/, tests/performance/)       │
└─────────────────────────────────────────────────────────────┘
```

### 2. 新模块测试矩阵（v4.3 runtime 模块结构）

| 模块 | 单元测试 | 集成测试 | Golden | 安全 | 预估用例 |
|------|---------|---------|--------|------|---------|
| `platform/interface/` | API gateway, ingress, scheduler | 8 阶段联调 | O→A→P→E→F happy path | handoff 信息泄露 | ~120 |
| `platform/control-plane/` | IAM, config-center, approval-center | control-plane→orchestration | linear plan happy path | — | ~80 |
| `platform/orchestration/` | OAPEFLIR, routing, planner, HITL | plan→execute 集成 | — | autonomy boundary | ~60 |
| `platform/execution/` | dispatcher, execution-engine, recovery, worker-pool | execution→state-evidence | failure pattern golden | — | ~80 |
| `platform/state-evidence/` | truth, events, checkpoints, artifacts | truth→events 传递 | canary→stable golden | source pollution | ~100 |
| `domains/` | domain-registry, plugin-spi | 插件加载→执行 | retrieval accuracy golden | config injection | ~150 |
| `interaction/` | NL entry, goal decomposition | 摄取→检索 E2E | — | — | ~40 |
| **合计** | | | | | **~730** |

### 3. E2E 测试设计（5 个核心测试）

#### Test 1: Happy Path
```
输入: "modify foo.ts bar function"
验证: O→A→P→E→F→L→I(shadow) 全链路
验证: 每阶段 DTO 通过 Zod 校验
验证: `oapeflir.view.*` 阶段视图连续，且不替代 runtime truth
验证: <60s E2E 延迟
```

#### Test 2: Execution 失败触发 Learn
```
输入: 无效文件路径（必定失败）
验证: Execute 失败 → Feedback → Learn 产出 FailurePattern
验证: FailurePattern 有 evidence 链接
```

#### Test 3: Replan 触发
```
输入: 执行中途 tool_failure
验证: ReplanningService 生成 version N+1
验证: 新 `GraphPatch` 从失败 `NodeRun` 后继续
```

#### Test 4: Canary 升级流程
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

### 4. 性能基准目标

## v4.3 ADR Remediation

- A-66: 本 ADR 原先把 OAPEFLIR 测试描述成“无阶段被跳过”的可执行主链，并使用“失败步骤后继续”表述 replan，根因是测试策略 ADR 把认知阶段视图和 runtime 执行图混在了一起。修复：正文现把 OAPEFLIR 限定为 view 连续性验证，把恢复/重规划锚点切到 `GraphPatch / NodeRun`。

| 模块 | 操作 | P99 目标 | 测试文件 |
|------|------|---------|---------|
| Feedback | signal-preprocessor.preprocess() | <10ms | tests/performance/feedback-perf.test.ts |
| Knowledge | knowledge-query-service.query() (Quick) | <100ms | tests/performance/knowledge-perf.test.ts |
| Knowledge | knowledge-retrieval.retrieve() (Standard) | <500ms | tests/performance/knowledge-perf.test.ts |
| Planning | plan-builder.build() | <50ms | tests/performance/planning-perf.test.ts |
| OAPEFLIR | 完整循环 O→A→P→E→F | <30s | tests/performance/oapeflir-perf.test.ts |
| Handoff | handoff-serializer.serialize() | <5ms | tests/performance/handoff-perf.test.ts |
| Plugin | plugin-spi-registry.invoke() | <200ms | tests/performance/plugin-perf.test.ts |

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
- 新增 `tests/performance/` 性能基准测试。
- 新增 `tests/security/` 安全回归测试。
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
