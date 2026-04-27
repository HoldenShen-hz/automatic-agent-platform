# OAPEFLIR v4.4 整合到《企业级 Agent 平台总体技术架构设计文档》的可执行方案

> **文档版本**：v1.0  
> **目标主文档版本**：v3.2 Release Candidate  
> **整合对象**：OAPEFLIR v4.4 Executable Runtime Spec  
> **适用文档**：《企业级 Agent 平台总体技术架构设计文档》v3.1  
> **整合原则**：保持主章节编号稳定；正文承载架构级规范；完整 v4.4 进入附录；每个能力必须具备文档落点、实现落点与验收门。

---

## 1. 整合目标

将主文档从：

```text
v3.1 Release
企业级 Agent 平台总体技术架构设计文档
```

升级为：

```text
v3.2 Release Candidate
企业级 Agent 平台总体技术架构设计文档
—— OAPEFLIR v4.4 Executable Runtime Spec 集成版
```

整合完成后，主文档应形成以下职责分布：

```text
§13 说明 OAPEFLIR v4.4 是什么，以及 PlanGraph / 八阶段 / Runtime Contract 的核心语义
§14 说明 P4 如何执行 PlanGraph Node、调度、重试、副作用、对账、补偿
§25 说明 Run / Node / Budget / VersionLock / Replay 的状态一致性
§28 说明 Event Registry、事件回放语义、Projection、Incident、DLQ
§45 说明 Harness 如何承载 OAPEFLIR v4.4 的运行时契约
§58 说明横切的 Metrics、Error Taxonomy、Replay、Test Matrix、Decision Protocol
§33-§36 说明落地路线、ADR、代码目录、风险约束、成功标准
附录 A / G / 新附录 H 记录版本历史、术语和完整可执行规范
```

---

## 2. 整合原则

### 2.1 保持章节编号稳定

当前主文档已经明确章节编号需要稳定，以兼容历史引用。因此不要重排主章节编号，只新增或替换子章节。

### 2.2 正文承载架构级规范，完整 v4.4 放附录

OAPEFLIR v4.4 包含 TypeScript contract、状态机、事件注册表、测试矩阵等实现级内容。建议采用双层整合：

```text
主文档正文：
  放架构级、治理级、跨章节级内容。

附录 H：
  放 OAPEFLIR v4.4 Executable Runtime Spec 完整版。
```

### 2.3 每个 v4.4 能力必须三点闭环

每个能力都必须明确：

```text
文档章节在哪里写
代码目录在哪里实现
测试/验收怎么判断完成
```

---

## 3. 推荐 PR / Patch 执行顺序

| 批次 | 名称 | 修改范围 | 目的 |
|---|---|---|---|
| PR-0 | 文档元信息升级 | 标题、版本、摘要、目录、全书主骨架 | 把 v3.1 升级为 v3.2 RC |
| PR-1 | 契约层升级 | §5、§6、§13 引用 | 把 ExecutionPlan 升级为 PlanGraphBundle |
| PR-2 | OAPEFLIR 核心章节 | §13 | 让 §13 成为 v4.4 总入口 |
| PR-3 | Runtime 执行层 | §14 | 落 Graph Scheduler、NodeRun、SideEffect、Reconciliation |
| PR-4 | 状态与事件层 | §25、§28 | 落 Run/Node 状态、Event Registry、Replay、Budget Ledger |
| PR-5 | Harness 集成 | §45、§58 | 落 Context、Prompt、Decision、HITL、Evaluation、Guardrails |
| PR-6 | 落地治理 | §33、§34、§35、§36 | 落路线图、ADR、代码目录、风险硬约束、成功标准 |
| PR-7 | 附录与一致性 | 附录 A、附录 G、新附录 H、全文术语替换 | 收口全文一致性 |

---

## 4. PR-0：文档元信息升级

### 4.1 修改文档头部

将：

```markdown
> **文档版本**：v3.1
> **文档状态**：Release
```

替换为：

```markdown
> **文档版本**：v3.2
> **文档状态**：Release Candidate
```

在文档定位中追加：

```markdown
> **v3.2 版本定位**：OAPEFLIR v4.4 Executable Runtime Spec 集成版。本版本将 OAPEFLIR 从“受控认知内核”升级为“可执行运行规范”，引入 PlanGraph、Event Registry、确定性调度、SideEffect Reconciliation、Budget Ledger、Context Assembly、RunVersionLock、HITL Responsibility、Evaluation Gate 与 Learning Release Pipeline，使 Agent Runtime 具备可编码、可测试、可恢复、可审计、可长期运行的生产级语义。
```

### 4.2 更新全书主骨架图 2

将现有运行时主链升级为：

```text
Request
  ─→ ConstraintPack
  ─→ Observe / Assess
  ─→ PlanGraph
  ─→ Deterministic Graph Scheduler
  ─→ Node Execution Runtime
  ─→ SideEffect Manager / HITL / Reconciliation
  ─→ Evaluator
  ─→ HarnessDecision
  ─→ Result + Evidence
```

### 4.3 新增图 5：OAPEFLIR v4.4 可执行运行内核

```text
RequestEnvelope
   │
   ▼
Observe ─→ Assess ─→ PlanGraph ─→ Graph Validate / Risk Propagate
                                      │
                                      ▼
                           Deterministic Graph Scheduler
                                      │
                                      ▼
                               Node Execution
                                      │
                  ┌───────────────────┼───────────────────┐
                  ▼                   ▼                   ▼
              Tool / LLM          HITL Wait          Subgraph
                  │                   │                   │
                  ▼                   ▼                   ▼
            SideEffect Manager   HumanDecision       ChildRun
                  │
                  ▼
         Confirm / Reconcile / Compensate
                  │
                  ▼
              Evaluator
                  │
       accept / retry / replan / escalate / abort
                  │
                  ▼
          Feedback → Learn → Improve → Release
```

---

## 5. PR-1：契约层升级

### 5.1 修改 §5.2 平面间契约矩阵

将：

```text
P3 → P4 | ExecutionPlan
```

替换为：

```text
P3 → P4 | ExecutionPlan / PlanGraphBundle
```

并补充说明：

```markdown
自 v3.2 / OAPEFLIR v4.4 起，`ExecutionPlan` 保留为平面间契约名称，但其内部结构从线性 `steps: Step[]` 升级为 `PlanGraphBundle`。所有复杂任务必须以 PlanGraph 形式下发给 P4，由 Graph Scheduler 按确定性策略调度 NodeRun。
```

### 5.2 替换 §5.3 ExecutionPlan 定义

```markdown
### ExecutionPlan / PlanGraphBundle

P3 → P4 的标准执行计划。v4.4 后，ExecutionPlan 内部采用 PlanGraphBundle，不再以线性 steps 作为主执行结构。

| 字段 | 类型 | 说明 |
|---|---|---|
| planId | string | 计划唯一标识 |
| planGraphId | string | 图计划唯一标识 |
| graphVersion | number | 图版本，GraphPatch 后递增 |
| graph | PlanGraph | 可执行图，包含 node / edge / entry / terminal |
| schedulerPolicy | ReadyNodeSchedulingPolicy | ready node 的确定性调度策略 |
| budget | BudgetEnvelope | token / 时间 / 成本 / 工具调用预算 |
| riskProfile | RiskProfile | 全图风险评估摘要 |
| validationReport | GraphValidationReport | 图校验结果 |
| riskPropagationReport | GraphRiskPropagationReport | 风险传播结果 |
| worstPathAnalysis | GraphWorstPathAnalysis | 最坏路径耗时、成本、风险分析 |
| rollbackStrategy | RollbackStrategy | 回滚 / 补偿策略 |
| evidenceRefs | string[] | 计划生成、校验、评估证据 |
```

新增硬规则：

```markdown
1. 简单任务可以退化为单节点 PlanGraph。
2. 复杂任务不得使用线性 steps 直接执行。
3. PlanGraph 必须经过 Normalize → Validate → Risk Propagation → Worst-Path Analysis 后才能进入 ready。
4. P4 不得执行 validationReport.valid=false 的 PlanGraph。
```

---

## 6. PR-2：重构 §13 OAPEFLIR

### 6.1 修改 §13 标题

将：

```markdown
# 13. OAPEFLIR 受控认知内核
```

替换为：

```markdown
# 13. OAPEFLIR v4.4 受控认知内核与可执行运行规范
```

### 6.2 §13 最终结构

```text
13.1 定位：从认知流程到可执行 Runtime Spec
13.2 八阶段职责边界
13.3 OAPEFLIR 与五平面关系
13.4 阶段间数据流
13.5 Harness 外部语义映射
13.6 v4.4 核心不变量
13.7 Plan 必须是 Graph
13.8 PlanGraph 契约
13.9 Graph Normalization
13.10 Graph Validation
13.11 Graph Risk Propagation
13.12 Graph Worst-Path Analysis
13.13 GraphPatch 与 Replan
13.14 OAPEFLIR 与 Evaluation / Learning / Release 的闭环关系
```

### 6.3 替换 §13.1 定位说明

```markdown
## 13.1 定位：从认知流程到可执行 Runtime Spec

OAPEFLIR v4.4 不再只是 Agent 的认知阶段划分，而是 P3 Orchestration Plane 的可执行运行规范。它定义：

- 八阶段职责边界
- Run / Node 状态机
- PlanGraph 计划结构
- Graph Scheduler 调度语义
- retry / replan / redrive 规则
- SideEffect 提交与确认语义
- HITL 暂停、审批、接管、恢复语义
- Evaluation / Learning / Release 的上线门禁
- Event Registry 与 Replay 规则

OAPEFLIR 不直接执行底层工具和外部副作用；实际工具执行、worker 调度、lease、sandbox、外部调用仍由 P4 Execution Plane 完成。但 OAPEFLIR 定义 P4 必须遵守的执行契约，并将所有状态、事件、证据写入 P5 State & Evidence Plane。
```

### 6.4 新增 §13.6 核心不变量

```markdown
## 13.6 OAPEFLIR v4.4 核心不变量

1. Plan 必须是 Graph，不允许复杂任务以线性 steps 直接执行。
2. 所有 Graph 必须经过 Normalize → Validate → Risk Propagation → Worst-Path Analysis 后才能进入 ready。
3. Graph Scheduler 必须 deterministic；同一 graph + 同一 runtime seed + 同一 event history 必须得到相同调度顺序。
4. 所有 Run / Node 状态迁移必须由 Event 驱动。
5. completed / failed / aborted 等终态不允许迁出。
6. retry / redrive 必须追加新的 attempt / lineage，不得覆盖旧失败记录。
7. LLM / Tool 调用前必须 reserve budget。
8. Tool 执行成功不等于 SideEffect 成功。
9. SideEffect ambiguous 不得自动转 succeeded。
10. irreversible SideEffect 必须支持 confirmation / reconciliation / manual review。
11. Planner / Generator / Evaluator 必须使用不同 ContextAssemblyContract。
12. Evaluator / Judge 不得覆盖确定性 verification / guardrail failure。
13. Tool output 写入长期记忆前必须经过 MemoryWriteGovernance。
14. HITL approve 只批准当前 scope，不默认批准整个 run。
15. Replay 不得产生真实 side effect。
16. Learn / Improve 不得直接改变线上行为，必须经过 EvaluationGate + Release。
17. 每次 HarnessDecision 必须冻结 DecisionInputBundle 并写入 evidence。
18. 每个 high / critical run 必须记录 RunVersionLock。
```

### 6.5 新增 §13.7 Plan 必须是 Graph

```markdown
## 13.7 Plan 必须是 Graph

v4.4 起，Plan 不再允许仅表达为线性步骤。复杂任务必须使用 PlanGraph，因为真实企业任务通常包含并行任务、条件分支、人工审批、外部等待、子图委托、失败补偿、回滚路径和重规划 patch。

简单任务可以被规范化为单节点或少量节点的 PlanGraph；复杂任务不得绕过 PlanGraph 直接执行。
```

### 6.6 新增 §13.8 PlanGraph 契约

```markdown
## 13.8 PlanGraph 契约

PlanGraph 至少包含：

| 组成 | 说明 |
|---|---|
| nodes | 计划节点，例如 llm_call、tool_call、verify、human_gate、join、branch、subgraph、side_effect_commit、compensation |
| edges | 节点间控制流、数据流、条件流、错误流、补偿流、人工恢复流 |
| entryNodeIds | 图入口节点 |
| terminalNodeIds | 图终态节点 |
| variables | 图运行变量 |
| schedulerPolicy | ready node 的确定性调度策略 |
| graphConstraints | maxNodes、maxDepth、maxParallelism、maxLoopIterations、allowCycles=false |

PlanGraph 是 ExecutionPlan 的内部执行结构。所有 PlanGraph 在执行前必须生成 normalizationReport、validationReport、riskPropagationReport 和 worstPathAnalysis。
```

### 6.7 新增 §13.9-§13.12

```markdown
## 13.9 Graph Normalization

Draft Graph 不得直接执行，必须经过标准化：

Draft Graph → Normalize Node Types → Resolve Tool References → Resolve Variable References → Insert Verify Nodes → Insert Human Gate Nodes → Insert Compensation Nodes → Insert Budget Checkpoints → Insert Guardrail Hooks → Validate Graph → Freeze Graph Version

标准化产物为 GraphNormalizationReport，记录自动插入的 verify / human_gate / compensation / budget_check / guardrail hook。

## 13.10 Graph Validation

Graph Validation 至少检查：

1. 必须有 entry node。
2. 必须有 terminal node。
3. 不允许孤立节点。
4. 不允许无界循环。
5. 不允许无 timeout 的 wait / human_gate。
6. 不允许 high risk node 缺少 verification。
7. 不允许 irreversible side effect 缺少 confirmation / reconciliation。
8. 不允许 join 等待永远不会触发的分支。
9. 不允许跨权限数据流。

validationReport.valid=false 时，P4 不得执行该 PlanGraph。

## 13.11 Graph Risk Propagation

Risk Propagation 负责把数据分级、工具风险、副作用风险、外部依赖风险沿图传播。若上游节点读取 restricted 数据，下游消费节点风险至少提升到 medium；若任一分支包含 external write，整个 subgraph risk 不低于 high。

## 13.12 Graph Worst-Path Analysis

Worst-Path Analysis 计算最长耗时路径、最高成本路径、最高风险路径、最大人工等待路径、最大不可逆副作用路径。若 worst-path budget 超限，PlanGraph 不得进入 ready。
```

### 6.8 新增 §13.13 GraphPatch 与 Replan

```markdown
## 13.13 GraphPatch 与 Replan

Replan 不得原地覆盖已有 PlanGraph。所有重规划必须形成 GraphPatch，并生成新的 graphVersion。

硬规则：

1. 已完成节点不得被删除，只能标记为 superseded。
2. 正在运行节点不得被替换，除非先 pause。
3. GraphPatch 后旧 checkpoint 必须能映射到新 graph。
4. join 语义变化必须触发人工审核。
5. GraphPatch 必须重新执行 validation、risk propagation 和 worst-path analysis。
```

---

## 7. PR-3：扩展 §14 Runtime Execution Plane

### 7.1 修改 §14.1 核心职责

替换为：

```text
session / task / workflow_run / OapeflirRun / NodeRun 生命周期 · PlanGraph ready node 调度 · dispatch / queue / worker 调度 · lease / fencing · executor 调用 · side effect proposed / approved / committed / confirmed · reconciliation / compensation · retry / redrive / timeout / recovery · mode-aware execution · 事件发射
```

### 7.2 新增 §14.9 Deterministic Graph Scheduler

```markdown
## 14.9 Deterministic Graph Scheduler

Graph Scheduler 负责从 PlanGraph 中选择 ready node，并按确定性策略下发给 P4 worker。

硬规则：

1. 同一 graph + 同一 runtime seed + 同一 event history，调度顺序必须一致。
2. parallel ready nodes 也必须稳定排序。
3. replay 时不得重新选择调度顺序，必须复用历史 scheduler decision。
4. 调度结果必须记录 `graph.scheduler_decision_recorded` 事件。
```

### 7.3 新增 §14.10 NodeRun State Machine

```markdown
## 14.10 NodeRun State Machine

每个 PlanNode 执行时生成 NodeRun。NodeRun 状态包括：

pending → blocked / ready → leased → running → waiting / succeeded / failed / cancelled

failed 可进入 retrying，但 retry 必须创建新的 attemptId，不得覆盖原失败记录。succeeded / cancelled / compensated 为封闭状态，不允许回到 running。
```

### 7.4 替换 §14.5 Side Effect 两阶段

```markdown
## 14.11 SideEffect Manager v4.4

SideEffect Manager 负责所有外部副作用的提议、审批、提交、确认、对账和补偿。

标准流程：

Executor Output
→ proposed side effect
→ policy / guardrail / budget / approval check
→ dry_run / preflight_check
→ approved
→ commit
→ confirm
→ ambiguous 时进入 reconciliation
→ 失败或误提交时进入 compensation

硬规则：

1. 工具执行成功，不等于副作用成功。
2. SideEffect 必须先 proposed，再 approved，再 committed。
3. SideEffect committed，不等于业务确认成功。
4. irreversible side effect 必须有 confirmationMethod。
5. ambiguous 不得自动转 succeeded。
6. high / critical side effect 必须支持 reconciliation。
7. compensation 不得删除原始 side effect 记录。
```

### 7.5 新增 §14.12 Reconciliation Worker

```markdown
## 14.12 Reconciliation Worker

当外部系统状态不确定时，例如调用超时但外部可能已经执行成功，SideEffect 进入 ambiguous 状态，由 Reconciliation Worker 查询外部状态并给出 resolution。

Reconciliation 状态包括：

pending → checking_external_state → matched_confirmed / matched_failed / ambiguous / requires_manual_review → resolved / expired

硬规则：

1. ambiguous 不得自动转 confirmed。
2. irreversible side effect ambiguous 必须人工处理。
3. reconciliation 超时必须升级 Incident。
4. reconciliation 结果必须反写 SideEffectRecord。
5. manual_resolution 必须记录 HumanResponsibilityRecord。
```

### 7.6 新增 §14.13 Compensation Manager

```markdown
## 14.13 Compensation Manager

Compensation Manager 处理可补偿副作用。补偿不是删除历史，而是追加补偿事件和补偿结果。

补偿示例：

| 原副作用 | 补偿方式 |
|---|---|
| message_send | 发送更正通知 |
| content_publish | 下架 / 版本回滚 |
| deployment | rollback release |
| permission_change | 恢复权限 |
| financial_transaction | 冲正 / 退款 / 人工财务处理 |

irreversible_legal_effect 类型副作用不得自动补偿，必须进入人工处理。
```

### 7.7 新增 §14.14 Retry / Redrive / AttemptLineage

```markdown
## 14.14 Retry / Redrive / AttemptLineage

Retry 是运行时自动重试；Redrive 是人工或 repair worker 发起的重新驱动。两者都必须追加 AttemptLineage。

硬规则：

1. retry 不得覆盖原失败记录。
2. redrive 必须创建新的 attemptId 或 redriveId。
3. 原始 nodeRunId 必须保留。
4. retry / redrive 的触发者、原因、时间、证据必须写入 event log。
```

---

## 8. PR-4：扩展 §25 和 §28

### 8.1 §25 新增子章节

```text
25.8 OAPEFLIR Run / Node 状态一致性
25.9 Budget Ledger 一致性
25.10 RunVersionLock
25.11 AttemptLineage 与 Redrive Lineage
25.12 Replay Determinism 与 Runtime Seed
```

### 8.2 §25.8 OAPEFLIR Run / Node 状态一致性

```markdown
## 25.8 OAPEFLIR Run / Node 状态一致性

OapeflirRun 与 NodeRun 是 v4.4 的核心运行实体。它们遵守以下一致性规则：

1. 所有状态迁移必须通过 StateCommand + Event append 同事务完成。
2. completed / failed / aborted 等终态不允许迁出。
3. retry / redrive 不得修改旧状态，只能追加新的 attempt lineage。
4. paused run 恢复时必须检查 RunVersionLock 兼容性。
5. replay 不得修改 truth state，只能生成 replay report。
```

### 8.3 §25.9 Budget Ledger 一致性

```markdown
## 25.9 Budget Ledger 一致性

Budget Ledger 记录 run / node / tool_call / llm_call / side_effect / evaluation 的预算预留、消耗、释放。

硬规则：

1. LLM call 前必须 reserve budget。
2. Tool call 前必须 reserve budget。
3. SideEffect commit 前必须 reserve budget。
4. Evaluation / Judge 调用也必须计费。
5. budget exhausted 优先级高于 retry / replan。
6. Replan 必须重新做 worst-path budget analysis。
```

### 8.4 §25.10 RunVersionLock

```markdown
## 25.10 RunVersionLock

长时运行和高风险运行必须锁定关键版本：

- runtimeVersion
- policyBundleVersion
- guardrailBundleVersion
- promptBundleVersion
- modelRoutingVersion
- toolRegistryVersion
- domainDescriptorVersion
- evalRuleVersion

high / critical run 默认 lock_for_entire_run。恢复时如果版本不兼容，必须进入 recovery_needed 或 supervised_resume。
```

### 8.5 §28 标题升级

将：

```markdown
# 28. Event / Projection / Incident / DLQ 模型
```

替换为：

```markdown
# 28. Event Registry / Projection / Incident / DLQ 模型
```

### 8.6 §28 新结构

```text
28.1 Event Registry 设计原则
28.2 OapeflirEvent 标准结构
28.3 OapeflirEventType 注册表
28.4 Event Replay Semantics
28.5 Projection 约束
28.6 Incident 约束
28.7 DLQ 约束
28.8 Reconciliation 与 Incident 联动
```

### 8.7 §28.1-§28.4 内容

```markdown
## 28.1 Event Registry 设计原则

OAPEFLIR v4.4 中，Event Registry 是回放、审计、恢复和投影重建的事实来源。

硬规则：

1. 所有状态变更必须由 Event 驱动。
2. Event append 与 truth state 更新必须同事务。
3. Event sequence 在 run 内单调递增。
4. Event payload 必须有 schema version。
5. Event 不允许物理删除。
6. Projection 只能由 Event 重建，不得反写真相。
7. Replay 必须遵守 replayBehavior。

## 28.2 OapeflirEvent 标准结构

OapeflirEvent 必须包含 eventId、eventType、eventVersion、runId、nodeRunId、sequence、causationId、correlationId、occurredAt、recordedAt、principal、traceId、payload、payloadHash、replayBehavior、idempotencyKey。

## 28.3 OapeflirEventType 注册表

事件类型按以下命名空间组织：

- run.*
- graph.*
- node.*
- llm.*
- tool.*
- side_effect.*
- reconciliation.*
- hitl.*
- budget.*
- memory.*
- evaluation.*
- learning.*
- release.*
- incident.*
- redrive.*

## 28.4 Event Replay Semantics

每个事件必须声明 replayBehavior：

| replayBehavior | 说明 |
|---|---|
| replay_state_transition | 回放时重建状态迁移 |
| replay_decision | 回放时复用历史决策 |
| reuse_recorded_result | 回放时复用历史 LLM / tool 结果 |
| ignore_projection_only | 仅用于投影，不参与 truth replay |
| forbidden | 不允许回放，例如真实外部副作用提交 |
```

---

## 9. PR-5：扩展 §45 和 §58

### 9.1 §45 新增子章节

```text
45.22 OAPEFLIR v4.4 Runtime Contract
45.23 Context Assembly Contract
45.24 Prompt Execution Contract
45.25 DecisionInputBundle
45.26 FinalOutputContract
45.27 HITL Responsibility Record
45.28 Runtime Capability Matrix
```

### 9.2 §45.22 OAPEFLIR v4.4 Runtime Contract

```markdown
## 45.22 OAPEFLIR v4.4 Runtime Contract

Harness Runtime 对外保持 Planner / Generator / Evaluator / Loop Controller 四角色语义；对内通过 OAPEFLIR v4.4 Runtime Contract 执行。

映射关系：

| Harness 角色 | OAPEFLIR v4.4 内部契约 |
|---|---|
| Planner | Observe / Assess / PlanGraph / Graph Validation |
| Generator | NodeRun / Tool / LLM / SideEffect Proposal |
| Evaluator | Verification / EvaluationReport / DecisionInputBundle |
| Loop Controller | HarnessDecision / Retry / Replan / HITL / Abort / Release |

Harness 不直接绕过 OAPEFLIR 状态机。所有复杂任务必须生成 OapeflirRun，并通过 PlanGraph 执行。
```

### 9.3 §45.23 Context Assembly Contract

```markdown
## 45.23 Context Assembly Contract

Planner、Generator、Evaluator、Verifier、Judge、HITL Operator 必须使用不同的 ContextAssemblyContract。

硬规则：

1. Planner / Generator / Evaluator 不得共享同一上下文装配结果。
2. Context 必须可哈希、可回放。
3. external_untrusted 只能进入 user/data 区，不得进入 system/developer 区。
4. redacted 字段不得通过 summary 泄漏。
5. restricted 数据不得进入无权限 subgraph / subagent。
```

### 9.4 §45.24 Prompt Execution Contract

```markdown
## 45.24 Prompt Execution Contract

PromptExecutionContract 约束 promptId、promptVersion、role、allowedContextTaintLevels、outputSchemaRef、injectionBoundaryPolicy、canUseTools、canMakeDecisions、canProposeSideEffects。

硬规则：

1. Planner / Generator / Evaluator Prompt 必须独立版本化。
2. Evaluator Prompt 不得与 Generator Prompt 共用。
3. Judge Prompt 不得访问 holdout 标准答案。
4. Planner Prompt 不得接收 forbidden_for_planning 内容。
5. Prompt 变更必须经过 Evaluation Gate。
```

### 9.5 §45.25 DecisionInputBundle

```markdown
## 45.25 DecisionInputBundle

DecisionEngine 只能消费冻结后的 DecisionInputBundle，不得临时读取分散服务状态。

DecisionInputBundle 包含：

- verificationResult
- evaluationReport
- guardrailResults
- policyOutcomes
- sideEffectStates
- budgetState
- runtimeMode
- incidentState

硬规则：

1. DecisionInputBundle 必须在生成 decision 前冻结。
2. 冻结后的 bundle 必须 hash 并写入 evidence。
3. Decision precedence 固定，不允许 Planner 偏好覆盖安全、预算、策略、人工终止等高优先级约束。
```

### 9.6 §45.27 HITL Responsibility Record

```markdown
## 45.27 HITL Responsibility Record

HITL 操作必须记录 HumanResponsibilityRecord，明确人工操作边界。

记录内容包括：

- operatorId
- action
- responsibility
- acknowledgedRisks
- approvalScope
- expiresAt

硬规则：

1. 人工 approve 只批准当前 scope。
2. 人工 override policy 必须具备更高权限。
3. manual_takeover 后 Agent 不得继续自动提交副作用，除非 resume 显式允许。
4. 所有 HITL 操作必须写 audit。
```

### 9.7 §58 新增横切子章节

```text
58.7 OAPEFLIR Runtime Metrics
58.8 OAPEFLIR Incident Rules
58.9 Error Code Taxonomy
58.10 Runtime Test Matrix
58.11 Replay / Simulation Hard Rules
```

### 9.8 §58.9 Error Code Taxonomy

```markdown
## 58.9 Error Code Taxonomy

错误码命名规范：

OAPEFLIR.{LAYER}.{CATEGORY}.{SPECIFIC}

示例：

- OAPEFLIR.GRAPH.VALIDATION.NO_ENTRY_NODE
- OAPEFLIR.GRAPH.VALIDATION.UNBOUNDED_LOOP
- OAPEFLIR.NODE.STATE.INVALID_TRANSITION
- OAPEFLIR.SIDEEFFECT.CONFIRMATION.TIMEOUT
- OAPEFLIR.HITL.LOCK.CONFLICT
- OAPEFLIR.REPLAY.NONDETERMINISTIC_INPUT
- OAPEFLIR.LEARNING.CANDIDATE.PII_DETECTED
```

### 9.9 §58.10 Runtime Test Matrix

```markdown
## 58.10 Runtime Test Matrix

OAPEFLIR v4.4 必须至少覆盖以下测试：

| 测试类别 | 覆盖内容 |
|---|---|
| 状态机测试 | Run / Node 合法迁移、非法迁移、终态封闭 |
| Graph 测试 | DAG 校验、deadlock、join、risk propagation、worst-path、GraphPatch |
| Scheduler 测试 | deterministic scheduling、replay schedule consistency |
| SideEffect 测试 | proposed→approved→committed→confirmed、ambiguous、reconciliation、compensation |
| Guardrail 测试 | critical block 优先级、LLM judge 不能覆盖确定性失败 |
| HITL 测试 | lock、scope approval、timeout escalation、manual takeover |
| Learning 测试 | holdout contamination、PII/secret block、EvaluationGate |
| Fault Injection | worker crash、LLM timeout、tool timeout after commit、event append failure、checkpoint restore |
```

---

## 10. PR-6：§33-§36 落地治理整合

### 10.1 §33 增加 Phase 8d

```markdown
## Phase 8d：OAPEFLIR v4.4 可执行运行规范（8 周）

### 交付物

- Run / Node State Machine
- Event Registry
- PlanGraph
- Graph Normalizer / Validator / Risk Propagator / Worst-Path Analyzer
- Deterministic Graph Scheduler
- Budget Ledger
- SideEffect Manager
- Reconciliation State Machine
- DecisionInputBundle
- ContextAssemblyContract
- PromptExecutionContract
- HITL Responsibility Record
- EvaluationGate
- LearningCandidate State Machine
- Runtime Test Matrix

### 验收门

- [ ] 所有状态迁移有单元测试覆盖。
- [ ] PlanGraph 校验可拦截 deadlock / missing terminal / missing compensation。
- [ ] 同一 graph + seed 可 deterministic replay。
- [ ] SideEffect ambiguous 可进入 reconciliation，不会被误判 success。
- [ ] Budget exhausted 可阻断 retry / replan。
- [ ] HITL approve scope 生效，不会扩大授权。
- [ ] LearningCandidate 污染检查可阻断 holdout / PII / secret。
- [ ] EvaluationGate 可阻断不合格 Prompt / Policy 发布。
- [ ] Replay 不产生真实 side effect。
```

### 10.2 §33.1 Phase 依赖图更新

推荐依赖关系：

```text
Phase 8a
  ├─→ Phase 8d
  └─→ Phase 8b
Phase 8d + Phase 8b → Phase 8c
```

说明：8d 的 PlanGraph / Event / SideEffect 可与 Durable / HITL 并行推进，但 8c 的治理评测依赖 8d。

### 10.3 §34 新增 ADR 组

新增标题：

```markdown
**OAPEFLIR v4.4 可执行运行规范（18 个）**：
```

新增 ADR：

```text
ADR-OAPEFLIR-Plan-Is-Graph
ADR-OAPEFLIR-Event-Registry-As-Source-Of-Replay
ADR-OAPEFLIR-Deterministic-Graph-Scheduler
ADR-OAPEFLIR-Terminal-State-Immutability
ADR-OAPEFLIR-Retry-Append-Only-Lineage
ADR-OAPEFLIR-SideEffect-Delivery-Semantics
ADR-OAPEFLIR-Reconciliation-For-Ambiguous-External-State
ADR-OAPEFLIR-DecisionInputBundle-Frozen-Before-Decision
ADR-OAPEFLIR-Budget-Reservation-Before-LLM-And-Tool
ADR-OAPEFLIR-ContextAssembly-Per-Role
ADR-OAPEFLIR-Prompt-Role-Isolation
ADR-OAPEFLIR-Memory-Write-Governance
ADR-OAPEFLIR-HITL-Responsibility-Record
ADR-OAPEFLIR-Run-Version-Lock
ADR-OAPEFLIR-Learning-Quarantine-Before-Release
ADR-OAPEFLIR-Evaluation-Gate-Before-Online-Change
ADR-OAPEFLIR-LLM-Judge-Cannot-Override-Deterministic-Failure
ADR-OAPEFLIR-Replay-Never-Produces-Real-SideEffect
```

### 10.4 §35 新增代码目录

在 `src/platform/` 下新增：

```text
oapeflir/
  runtime/
  graph/
  events/
  budget/
  context/
  prompt/
  llm/
  side-effects/
  decision/
  guardrails/
  hitl/
  memory/
  evaluation/
  learning/
  release/
  lineage/
  errors/
  observability/
  tests/
```

补充说明：

```markdown
`src/platform/oapeflir/` 是 OAPEFLIR v4.4 的可执行运行规范实现目录。原 `src/platform/orchestration/oapeflir/` 可作为旧路径保留，但新增实现应逐步迁移到统一的 `platform/oapeflir/`，避免 OAPEFLIR 被误认为只是 orchestration 子模块。
```

### 10.5 §36 新增硬约束

```markdown
- **复杂任务 Plan 必须是 PlanGraph，不允许线性 steps 直接执行**
- **PlanGraph 必须经过 Normalize / Validate / Risk Propagation / Worst-Path Analysis**
- **Graph Scheduler 必须 deterministic**
- **所有 Run / Node 状态迁移必须 Event-driven**
- **终态 Run / Node 不得迁出**
- **Retry / Redrive 必须追加 AttemptLineage，不得覆盖旧记录**
- **LLM / Tool / SideEffect / Evaluation 前必须 reserve budget**
- **SideEffect ambiguous 不得自动视为成功**
- **不可逆副作用必须支持 confirmation / reconciliation / manual review**
- **Replay 不得产生真实副作用**
- **DecisionInputBundle 必须冻结后才能裁决**
- **Planner / Generator / Evaluator 必须使用独立 ContextAssemblyContract**
- **Prompt / Policy / Tool / Domain 改进不得绕过 EvaluationGate 直接上线**
```

---

## 11. PR-7：附录整合

### 11.1 附录 A 新增版本记录

```markdown
| v3.2 | 2026-04-27 | **OAPEFLIR v4.4 可执行运行规范集成版**：将 OAPEFLIR 从“受控认知内核”升级为“可执行 Runtime Spec”。新增 PlanGraph 作为 ExecutionPlan 的内部结构；引入 Graph Normalization、Graph Validation、Graph Risk Propagation、Worst-Path Analysis、Deterministic Graph Scheduler、GraphPatch；新增 Run / Node 状态机终态封闭规则、AttemptLineage、Event Registry、Event Replay Semantics、Budget Ledger、SideEffect Delivery Semantics、Reconciliation State Machine、ContextAssemblyContract、PromptExecutionContract、LLM Decision Record、Tool Output Taint、Memory Write Governance、DecisionInputBundle、HITL Responsibility Record、FinalOutputContract、LearningCandidate 状态机、EvaluationGate、Runtime Capability Matrix、Runtime Test Matrix；更新 §13、§14、§25、§28、§45、§58、§33、§34、§35、§36 与附录 G。 |
```

### 11.2 附录 G 新增术语

| 术语 | 说明 |
|---|---|
| PlanGraph | OAPEFLIR v4.4 的图结构计划模型，替代线性 steps |
| Graph Scheduler | 基于 ready node 的确定性图调度器 |
| GraphPatch | 对运行中或暂停中 PlanGraph 的受控变更 |
| Event Registry | OAPEFLIR 事件类型、payload、replay 行为的注册表 |
| AttemptLineage | retry / redrive 的追加式执行谱系 |
| Budget Ledger | 预算预留、消耗、释放的运行账本 |
| SideEffect Delivery Semantics | 副作用 at-most-once / at-least-once / effectively-once 语义 |
| Reconciliation | 外部副作用状态不确定时的对账机制 |
| ContextAssemblyContract | 面向 Planner / Generator / Evaluator 的上下文装配契约 |
| PromptExecutionContract | Prompt 角色、版本、上下文 taint、输出 schema 的执行契约 |
| DecisionInputBundle | DecisionEngine 冻结后的统一裁决输入 |
| HumanResponsibilityRecord | 人工审批、覆盖、接管后的责任边界记录 |
| EvaluationGate | 发布前质量、成本、安全、回归门禁 |
| LearningCandidate | Learn 阶段产生的候选经验对象，需隔离、评测、审批后才能上线 |

### 11.3 新增附录 H

在 Part XI 中加入：

```markdown
[附录 H：OAPEFLIR v4.4 Executable Runtime Spec 完整规范](#附录-hoapeflir-v44-executable-runtime-spec-完整规范)
```

附录 H 放完整 v4.4 文档，正文只保留精简引用。

---

## 12. 全文一致性替换清单

| 检索词 | 处理方式 |
|---|---|
| `steps: Step[]` | 改为 `graph: PlanGraph`，或标注 legacy |
| `ExecutionPlan` | 保留名称，但补充“内部结构升级为 PlanGraphBundle” |
| `Side Effect 两阶段` | 替换为 proposed / approved / committed / confirmed / reconciliation |
| `OAPEFLIR 不等于 Runtime` | 改为“OAPEFLIR 不直接执行工具，但定义 Runtime Contract” |
| `LoopController 五种输出` | 改为 HarnessDecision 六种裁决 |
| `HarnessRunRequest` | 对齐 HarnessRun / OapeflirRun |
| `PlanBuilder` | 改为 PlanGraphBuilder / GraphNormalizer |
| `stepId` | 在 OAPEFLIR v4.4 上下文中改为 nodeId / nodeRunId |
| `retry` | 补充 AttemptLineage |
| `replay` | 补充 replayBehavior / no real side effect |
| `memory write` | 补充 MemoryWriteGovernance |
| `LLM-as-Judge` | 补充不能覆盖确定性失败 |

---

## 13. 可执行验收清单

### 13.1 文档结构检查

```text
[ ] 文档版本已从 v3.1 升级为 v3.2
[ ] 目录中 §13 标题已更新
[ ] 目录中 §28 标题已更新
[ ] Part XI 增加附录 H
[ ] 附录 A 增加 v3.2 记录
[ ] 附录 G 增加 v4.4 术语
```

### 13.2 架构一致性检查

```text
[ ] §5 ExecutionPlan 不再只定义 steps: Step[]
[ ] §13 明确 Plan 必须是 Graph
[ ] §14 SideEffect 已升级为完整状态机
[ ] §25 明确 Run / Node 终态封闭
[ ] §28 明确 Event Registry 和 replayBehavior
[ ] §45 明确 Harness 承载 OAPEFLIR v4.4 Runtime Contract
[ ] §58 明确 Runtime Test Matrix
```

### 13.3 安全可靠性检查

```text
[ ] SideEffect ambiguous 不会被描述为 success
[ ] Replay 不会产生真实 side effect
[ ] LLM-as-Judge 不能覆盖确定性失败
[ ] HITL approve 有 scope 限制
[ ] LearningCandidate 不能直接上线
[ ] Budget exhausted 优先级高于 retry / replan
```

### 13.4 落地可执行性检查

```text
[ ] §33 增加 Phase 8d
[ ] §34 增加 v4.4 ADR
[ ] §35 增加 src/platform/oapeflir/
[ ] §36 增加 v4.4 硬约束
[ ] Runtime Test Matrix 可直接转成测试任务
```

---

## 14. 研发任务拆解建议

### Epic 1：PlanGraph Core

| 任务 | 输出 |
|---|---|
| 定义 PlanGraph Schema | `plan-graph.ts` |
| Graph Normalizer | `graph-normalizer.ts` |
| Graph Validator | `graph-validator.ts` |
| Risk Propagator | `graph-risk-propagator.ts` |
| Worst Path Analyzer | `graph-worst-path-analyzer.ts` |
| GraphPatch | `graph-patch.ts` |

验收：

```text
DAG 校验通过
deadlock 可检测
join 不可达可检测
missing compensation 可检测
worst-path budget 可阻断执行
```

### Epic 2：Runtime State Machine

| 任务 | 输出 |
|---|---|
| Run State Machine | `run-state-machine.ts` |
| Node State Machine | `node-state-machine.ts` |
| AttemptLineage | `attempt-lineage.ts` |
| Redrive | `redrive-service.ts` |

验收：

```text
终态不可迁出
retry 追加 attempt
redrive 保留 lineage
非法状态迁移被拒绝
```

### Epic 3：Event Registry + Replay

| 任务 | 输出 |
|---|---|
| Event Registry | `event-registry.ts` |
| Event Store Schema | `event-store.ts` |
| Replay Behavior | `replay-behavior.ts` |
| Deterministic Runtime Seed | `deterministic-runtime-seed.ts` |

验收：

```text
run 内 sequence 单调递增
event append + truth update 同事务
replay 不产生真实 side effect
same seed 可复现调度顺序
```

### Epic 4：SideEffect + Reconciliation

| 任务 | 输出 |
|---|---|
| SideEffect Manager | `side-effect-manager.ts` |
| Delivery Contract | `side-effect-contract.ts` |
| Reconciliation Worker | `reconciliation-state-machine.ts` |
| Compensation Manager | `compensation-manager.ts` |

验收：

```text
proposed → approved → committed → confirmed 跑通
commit timeout 可进入 ambiguous
irreversible ambiguous 进入人工 review
compensation 追加记录不覆盖原事件
```

### Epic 5：Decision + Guardrails

| 任务 | 输出 |
|---|---|
| DecisionInputBundle | `decision-input-bundle.ts` |
| Decision Engine | `decision-engine.ts` |
| Decision Precedence | `decision-precedence-policy.ts` |
| Guardrails 五层 | `guardrails/*` |

验收：

```text
critical guardrail block 优先于 evaluator accept
budget exhausted 优先于 retry
policy deny 优先于 planner preference
LLM judge 不能覆盖 deterministic failure
```

### Epic 6：HITL Runtime

| 任务 | 输出 |
|---|---|
| HITL Lock | `hitl-lock.ts` |
| Escalation Policy | `hitl-escalation-policy.ts` |
| Human Responsibility Record | `human-responsibility-record.ts` |

验收：

```text
approve scope 不扩散
manual takeover 后 agent 不自动提交副作用
timeout escalation 可触发
override 需要权限
```

### Epic 7：Evaluation + Learning + Release

| 任务 | 输出 |
|---|---|
| EvaluationGate | `evaluation-gate.ts` |
| OutcomeGrader | `outcome-grader.ts` |
| LearningCandidate | `learning-candidate.ts` |
| Learning Quarantine | `learning-quarantine.ts` |
| Release Pipeline | `release-pipeline.ts` |

验收：

```text
holdout contamination 被阻断
PII / secret candidate 被阻断
incident regression 失败阻断发布
canary regression 自动 rollback
```

---

## 15. 最终完成标准

整合后的文档应该能回答以下 10 个问题：

```text
1. 复杂任务的 Plan 为什么必须是 Graph？
2. Graph 执行前经过哪些校验？
3. Graph 中多个 ready node 如何确定性调度？
4. Worker 崩溃后如何恢复到正确 NodeRun？
5. Tool 成功但外部状态不确定时如何处理？
6. 不可逆副作用如何确认、对账、补偿？
7. HITL 审批到底批准哪个 scope？
8. Replay 为什么不会再次发邮件、付款、部署？
9. 学习结果为什么不能直接上线？
10. Prompt / Policy / Tool 改进如何被 EvaluationGate 阻断或发布？
```

最终状态：

```text
v3.2 文档不只是“总体架构设计文档”，而是具备可执行 Runtime 语义的企业级 Agent 平台设计基线。

OAPEFLIR v4.4 成为：
  - §13 的认知与计划内核
  - §14 的执行约束来源
  - §25 的状态一致性对象
  - §28 的事件与回放事实来源
  - §45 的 Harness 内部运行协议
  - §58 的可观测、测试、错误、回放横切模型
  - §33-§36 的落地路线、ADR、目录和验收标准
```
