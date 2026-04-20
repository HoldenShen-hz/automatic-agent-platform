# ADR-016 OAPEFLIR 八阶段认知循环模型

- 状态：Accepted
- 决策日期：2026-04-17

## 背景

系统早期架构基于"三层分权架构"（控制 / 运行时 / 学习 / 数据）组织。Phase 1 演进过程中，逐步形成了一个更清晰的八阶段认知循环模型 OAPEFLIR（Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Rollout）。本 ADR 正式记录这一架构决策。

## 决策

### OAPEFLIR 八阶段模型

系统采用八阶段串行认知循环：

```
Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Rollout
   ↓                    ↓           ↓           ↓            ↓
   └────────────────────┴───────────┴───────────┴────────────┘
                    （双链拓扑：主链 O→A→P→E→F，副链 F→L→I→R）
```

### 各阶段职责

| 阶段 | 核心职责 | 关键输出 |
|------|---------|---------|
| **O**bserve | 收集任务/上下文/系统状态 | UnifiedObservation (TaskSituation + SystemSituation) |
| **A**ssess | 预执行风险/复杂度/资源评估 | UnifiedAssessment (六维评分) |
| **P**lan | 基于评估生成执行计划 | Plan (steps + DAG + retryPolicy) |
| **E**xecute | 调用 runtime 执行计划 | DualChannelStepOutput + ExecutionOutcome |
| **F**eedback | 收集执行结果反馈信号 | LearningSignal[] |
| **L**earn | 从信号中提取模式/知识 | LearningObject[] |
| **I**mprove | 评估改进候选 + guardrail | ImprovementCandidate |
| **R**ollout | 受控发布改进到生产 | RolloutRecord |

### 与 Phase 1A/1B 执行模型的映射

- **Phase 1A** (`phase1a-happy-path.ts`): 覆盖 O→A→P→E 单步骤执行。
- **Phase 1B** (`phase1b-orchestration.ts`): 覆盖 P→E 多步骤 DAG + 上下文压缩 + streaming。
- **OAPEFLIR Loop** (`OapeflirLoopService`): 完整八阶段闭环，包含 F→L→I→R 副链。

### Execute 层集成要求

Execute 阶段必须调用真实 runtime 执行引擎（AgentExecutor / CommandExecutor），不得使用 mock 数据。具体集成通过 `RuntimeExecuteBridge` 接口实现。

## 备选方案

### 方案 A：维持三层分权架构，不引入 OAPEFLIR

优点：架构简单，无需重构现有模块。
代价：无法清晰表达认知闭环与渐进改进路径。

### 方案 B：OAPEFLIR 与三层架构并列

优点：兼容现有模块。
代价：两套心智模型造成混淆。

## 后果

- `OapeflirLoopService` 是系统的核心编排器。
- 所有新模块（Observe builders、Assess evaluators、Plan strategies 等）必须能在八阶段中找到自己的位置。
- 本 ADR 是后续所有 OAPEFLIR 相关 GAP（V2-01 ~ V2-12）的架构基础。
