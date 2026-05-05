# ADR-004 工作流与路由

---

## OAPEFLIR 关联

本文档定义 OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：信号采集与统一 DTO
- **Assess**：执行前/后评估与风险判断
- **Plan**：显式规划与 DAG 构建（ADR-060）
- **Execute**：步骤执行与 Dual-Channel 输出
- **Feedback**：信号收集、预处理与 7 类反馈源（ADR-079）
- **Learn**：模式检测与知识提取（ADR-080）
- **Improve**：改进候选评估与 Rollout 状态机（ADR-075）
- **Release**：六级受控发布与自动回滚

---

- 状态：Accepted
- 决策日期：2026-04-02

## 背景

平台需要同时支持简单单任务、标准工作流、多角色协同和跨事业部复合任务。如果所有任务都走同一条重型流程，会明显拖慢速度并放大成本，也会让简单场景承担不必要的协调开销。

## 决策

采用五平面驱动的路由与多路径执行：

- P1 接口面负责接收消息、分诊和入口规范化。
- P2 控制面负责策略判断、路由决策和治理约束注入。
- P3 编排面负责跨 domain 拆分、依赖管理和 `PlanGraphBundle` 生成。
- `HarnessRuntime` 作为唯一执行运行时承接 P3→P4 handoff。
- domain agent / worker 只在 `HarnessRuntime` 分派的 `NodeRun` 边界内执行局部职责。

系统定义四条执行路径：

- `passthrough`：最短链路，适合低复杂度任务。
- `fast`：强调低延迟和低成本。
- `standard`：引入测试、校验或轻量审查。
- `full`：全量角色协作和更强质量保证。

## 任务生命周期

典型链路如下：

1. P1 接收消息并过滤非任务对话。
2. P2 完成规则匹配、风险评估与路由决策。
3. 单 domain 任务直接生成最小 `PlanGraphBundle`。
4. 跨 domain 任务交给 P3 做拆分、依赖图管理与 graph patch。
5. `HarnessRuntime` 执行 `NodeRun / NodeAttempt` 并回传 `NodeAttemptReceipt`。
6. P1/P2 消费投影结果并回到原渠道。

## Workflow 数据传递

v4.3 §5.5 废弃了 WorkflowState/StepOutput，数据传递改用 NodeRun/HarnessRun 模型：

- `HarnessRun` 是顶层执行容器，包含多个 `NodeRun`。
- 每个 `NodeRun` 代表图中的一个节点执行，产出 `NodeAttemptReceipt`。
- 节点间数据传递通过 `NodeAttemptReceipt.output` 和 artifact store 引用。
- 上游 `NodeRun` 完成后，通过 PlanGraphBundle / GraphPatch 将结果注入下游上下文。

关键要求：

- 输出在写入前必须通过 schema 验证。
- 缺失关键字段时允许有限重试。
- partial success 应被显式记录，交由 precondition 决定是否继续。
- 废弃 WorkflowState/StepOutput，仅在兼容投影视图中保留。

## 迁移指南：WorkflowState/StepOutput → NodeRun/HarnessRun

> 详细迁移步骤见 [e2e-workflow-state-migration.md](../migrations/e2e-workflow-state-migration.md)

### 字段映射表

| 旧字段 (WorkflowState/StepOutput) | 新字段 (NodeRun/HarnessRun) | 说明 |
|----------------------------------|---------------------------|------|
| `WorkflowStateRecord.taskId` | `HarnessRun.taskId` (via PlanGraphBundle) | 任务引用通过 bundle 传递 |
| `WorkflowStateRecord.workflowId` | `NodeRun.nodeId` / `PlanGraphBundle.workflowId` | 工作流 ID 对应图节点 |
| `WorkflowStateRecord.currentStepIndex` | `NodeRun.status` + 执行顺序 | 步骤进度由节点状态表示 |
| `WorkflowStateRecord.outputsJson` | `NodeAttemptReceipt.output` | 输出通过 receipt 传递 |
| `StepOutput.stepName` | `NodeRun.nodeId` | 步骤名对应节点 ID |
| `StepOutput.outputValue` | `NodeAttemptReceipt.output[key]` | 输出值在 receipt 中可直接访问 |

### 代码示例

**旧模式 (已废弃)**：
```typescript
// 直接操作 WorkflowStateRecord
store.insertWorkflowState({
  taskId,
  workflowId: "multi_step",
  currentStepIndex: 0,
  outputsJson: JSON.stringify({ step0_output: "result" }),
});

store.updateWorkflowState(taskId, "running", 1, JSON.stringify({ step0_output: "result" }), now, null);
```

**新模式 (NodeRun/HarnessRun)**：
```typescript
import { runMultiStepOrchestration } from "../../src/platform/execution/execution-engine/multi-step-orchestration.js";

const result = await runMultiStepOrchestration({
  dbPath,
  title: "Multi-step workflow",
  request: "Run multi-step test with steps",
  stepOutputOverrides: {
    "step_0": { step0_output: "result_from_step_0" },
  },
});

// 通过 result.snapshot 访问状态
const { task, workflow, execution } = result.snapshot;
```

### 常用模式对照

| 旧模式 | 新模式 |
|--------|--------|
| 手动插入 `WorkflowStateRecord` | `runMultiStepOrchestration()` 自动创建 |
| `store.updateWorkflowState()` | 内置于 orchestrator 执行流程 |
| `TransitionService` 驱动状态机 | `RuntimeStateMachine.transition()` |
| 手动管理 `StepOutput` 数组 | `NodeAttemptReceipt.output` 单点访问 |

### 迁移检查清单

- [ ] 替换 `store.insertWorkflowState()` 为 `runMultiStepOrchestration()`
- [ ] 替换 `store.updateWorkflowState()` 为 orchestrator 自动管理
- [ ] 移除 `WorkflowStateRecord` 类型引用，改用 `HarnessRun` / `NodeRun`
- [ ] 将 `StepOutput` 访问改为 `NodeAttemptReceipt.output[key]`
- [ ] 更新测试用例使用 Option A/B/C 中对应模式
- [ ] 运行 `npm run build && node --test dist/tests/e2e/multi-step-workflow.test.js` 验证

## 路由原则

P2 控制面路由规则：

- 规则优先，LLM 回退次之。
- 简单任务优先命中 `passthrough` 或 `fast`。
- 只有明确跨 domain 依赖时才进入 P3 编排链路。

P3 编排职责：

- 拆分复合任务。
- 建立依赖图。
- 做 schema 兼容性预检。
- 在上游 node 完成后，通过 `PlanGraphBundle` / `GraphPatch` 将结果注入下游上下文。

## 自愈与升级

工作流失败后不直接退出，而是按以下顺序处理：

- 有限次数重试。
- 循环检测，避免反复执行同一失败动作。
- 需要时回退到上游步骤或标记 partial success。
- 超过阈值后升级到 P2 控制面人工接管或更高治理动作。

HITL 触发场景包括：

- 成本接近或超过阈值。
- 安全敏感操作。
- 任务本身存在歧义。
- 自愈超过最大尝试次数。
- 组织变更或高风险 workflow 建议。

## 契约与 HR 的关系

Workflow 不应脱离契约系统单独演进：

- 每个角色应有明确的 input/output schema。
- preconditions 是父级 Agent 对子级 Agent 的前置校验。
- HR Agent 生成的新角色必须遵守同样契约。
- HR 给出的 workflow 变更只能作为建议，不能自动部署。

## 结果

优点：

- 简单任务不会被重型编排拖慢。
- 复杂任务可以获得跨事业部协同能力。
- 工作流状态可持久化，天然支撑恢复和审计。

约束：

- 需要统一的任务、步骤和事件模型。
- workflow DSL 需要严格控制复杂度，避免过早支持过多分支语法。
- 路由、成本和恢复逻辑需要协同设计，不能分散到各处。

## 交叉引用

- [ADR-001 三层分权架构](./001-three-layer-architecture.md)
- [ADR-002 事业部系统](./002-division-system.md)
- [ADR-008 成本模型](./008-cost-model.md)

## 来源章节

注：v4.3 迁移后，原 §4.* 工作流章节已重构。本 ADR 相关内容现分布于 §4（五平面架构）、§5（执行 canonical）、§6（API 与运行时资源）、§14（调度）、§40（目标分解）。

v4.3 有效引用：
- `§4` 五平面+X1 架构
- `§5.3` RequestEnvelope → HarnessRun → PlanGraphBundle handoff
- `§5.5` NodeRun / NodeAttempt / receipt 数据传递
- `§14.9` 图调度与执行排序
- `§40.2` 目标分解与跨域依赖图

## v4.3 ADR Remediation

- A-21: 本 ADR 原先继续使用 `VP 运营 / VP 编排 / 事业部 / Lead Agent / CEO` 这套 v3 代理层级，根因是工作流与路由 ADR 长期承担组织叙事，没有随着 v4.3 五平面和 `HarnessRuntime` 成为运行时主干而重写。修复：正文现改为 P1/P2/P3 与 `HarnessRuntime` 驱动的路由与执行模型。
