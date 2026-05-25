# ADR-016 OAPEFLIR 八阶段认知循环模型

- 状态：Accepted
- 决策日期：2026-04-17

## 背景

系统早期架构基于"三层分权架构"（控制 / 运行时 / 学习 / 数据）组织。随着 HarnessRuntime 成为唯一执行入口，平台需要一套受控认知框架来解释和约束认知循环，而不是再引入第二个执行运行时。OAPEFLIR（Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release）因此被保留为认知/治理语义框架。

## 决策

### OAPEFLIR 八阶段模型

系统采用八阶段认知循环。它是平台中的主动编排/治理控制环，但不是第二套独立执行引擎：

```
Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release
   ↓                    ↓           ↓           ↓            ↓
   └────────────────────┴───────────┴───────────┴────────────┘
                    （双链拓扑：主链 O→A→P→E→F，副链 F→L→I→R）
```

约束：

- `HarnessRuntime` 是唯一执行入口。
- `OapeflirLoopService` 可以主动驱动 Observe/Assess/Plan/Feedback/Learn/Improve/Release 的阶段推进，并把结果回写到执行约束、规划图和改进候选。
- OAPEFLIR 只产出 `oapeflir.view.*` 与 `oapeflir.rationale.*` 投影，不拥有 run status、budget、lease、side effect commit 或错误码命名空间。

### 各阶段职责

| 阶段 | 核心职责 | 关键输出 |
|------|---------|---------|
| **O**bserve | 收集任务/上下文/系统状态 | UnifiedObservation (TaskSituation + SystemSituation) |
| **A**ssess | 预执行风险/复杂度/资源评估 | UnifiedAssessment (六维评分) |
| **P**lan | 形成规划理由并约束执行交接 | PlanRationale + `PlanGraphBundle` 引用 |
| **E**xecute | 读取 Harness 执行结果并生成认知视图 | `NodeAttemptReceipt` 引用 + ExecutionSummaryView |
| **F**eedback | 收集执行结果反馈信号 | LearningSignal[] |
| **L**earn | 从信号中提取模式/知识 | LearningObject[] |
| **I**mprove | 评估改进候选 + guardrail | ImprovementCandidate |
| **R**elease | 受控发布改进到生产 | ReleaseDecisionView / RolloutRecord |

### 与 Phase 1A/1B 执行模型的映射

- `HarnessRuntime` 承接真实的 `PlanGraphBundle -> NodeRun -> NodeAttemptReceipt` 执行主链。
- OAPEFLIR 在 Harness 主链之上生成阶段性 view / rationale，同时主动决定何时进入 Assess/Plan、是否要求 orchestration、如何把 release / guardrail 结论写回控制面。
- 因此 OAPEFLIR 是 active orchestration loop，但它把真实命令执行委托给 HarnessRuntime，而不是自带第二套 executor。
- 不再存在以 `OapeflirLoopService` 作为独立 runtime 入口的 canonical 叙述。

### Execute 层集成要求

Execute 阶段只能消费真实 runtime 已产出的 `NodeAttemptReceipt` / evidence refs，不得自行驱动第二套执行引擎。任何真实状态变化仍由 `RuntimeStateMachine.transition(command)` 和 Harness 主链负责。

## 备选方案

### 方案 A：维持三层分权架构，不引入 OAPEFLIR

优点：架构简单，无需重构现有模块。
代价：无法清晰表达认知闭环与渐进改进路径。

### 方案 B：OAPEFLIR 与三层架构并列

优点：兼容现有模块。
代价：两套心智模型造成混淆。

## 后果

- OAPEFLIR 是系统的认知与治理编排环；`HarnessRuntime` 仍然是唯一执行运行时。
- 所有新模块（Observe builders、Assess evaluators、Plan strategies 等）必须能在八阶段认知框架中找到自己的位置，但不得绕过 Harness 主链。
- 本 ADR 是后续所有 OAPEFLIR 相关 GAP（V2-01 ~ V2-12）的架构基础。

## v4.3 ADR Remediation

- A-1: 本 ADR 原先把 OAPEFLIR 写成独立执行编排器，根因是认知循环模型在早期草案中同时承担了运行时和解释层职责。修复：正文现明确 `HarnessRuntime` 才是唯一执行入口，OAPEFLIR 仅保留为认知/治理语义框架。
- A-10: 本 ADR 原先延续 `Oapeflir*` 风格 DTO 命名语境，根因是早期文档直接以框架名命名输入输出对象。修复：正文现把阶段对象收敛到 `PlanRationale`、`ExecutionSummaryView` 等认知视图对象，并与 `CognitiveFrameInput/CognitiveFrameOutput` 体系对齐。
