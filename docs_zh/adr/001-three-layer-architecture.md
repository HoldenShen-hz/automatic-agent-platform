# ADR-001 三层分权架构

- 状态：Partially Superseded by v4.3 Five-Plane Baseline
- 决策日期：2026-04-02

## 背景

早期思路中，CEO 几乎承担了所有中枢职责：接收任务、分类、路由、拆分、编排、聚合和升级判断。这会让系统在并发任务出现时形成逻辑单点，也让职责边界、恢复边界和成本边界都变得模糊。

## 决策

采用五平面架构（v4.3 canonical，取代旧 CEO/VP 三层分权）：

- **P1 接口面**：用户消息接入、消息分诊、入口规范化、NL 解析。
- **P2 控制面**：策略判断、路由决策、风险评估、治理约束注入。
- **P3 编排面**：跨 domain 拆分、依赖图构建、PlanGraphBundle 生成、结果聚合。
- **P4 执行面**（HarnessRuntime）：唯一执行运行时，承接 P3→P4 handoff。
- **P5 证据面**：状态持久化、事件记录、checkpoint、artifact storage。
- **X1 扩展面**：感知情报、HR 审批升级（按需触发）。

说明：
- 文档中如需保留 CEO / VP 运营 / VP 编排等旧叙事名称，必须同时给出 canonical 平面 ID，代码、目录、事件和契约层一律以 canonical ID 为准。
- CEO 不是常驻进程，而是按需生成：仅在升级事件、感知情报和 HR 审批场景中触发，通过持久记忆跨升级保留上下文，同时只允许一个 CEO 会话执行，其他升级事件按优先级排队。

说明：

- 文档中如需保留 CEO / VP 运营 / VP 编排等叙事名称，必须同时给出 canonical ID，代码、目录、事件和契约层一律以 canonical ID 为准。

CEO 不是常驻进程，而是按需生成：

- 仅在升级事件、感知情报和 HR 审批场景中触发。
- 通过持久记忆跨升级保留上下文。
- 同时只允许一个 CEO 会话执行，其他升级事件按优先级排队。

## 角色边界（v4.3 五平面映射）

总部角色分工（映射到 P1/P2/P3）：

- P1 接口面只做入口处理，不参与日常路由和常规编排。
- P2 控制面专注任务分诊与资源分配，不做复杂跨 domain 推理。
- P3 编排面只处理跨 domain 协调和异常干预，不接管 domain 内部细节。
- X1 感知模块作为服务模块存在，不参与 Agent 生命周期，但作为 CEO 的外部输入源。

Domain 角色分工：

- 每个 domain 至少有一个 domain agent 承担本地自治编排。
- domain agent 之下的角色只负责各自契约内的输入输出，不直接承担总部协调职责。

## 选择这个方案的原因

- 去除 CEO 在主链路中的性能瓶颈。
- 把“判断”和“执行”彻底分开，降低系统偶发复杂度。
- 让各 domain 在不打扰总部的情况下自治演进。
- 为恢复、审计和成本统计提供更清晰的边界。

## 关键不变量

- CEO 不应出现在普通 happy path 中。
- VP 运营必须可以在不调用 CEO 的情况下完成绝大多数任务接入。
- VP 编排只在跨 domain 或异常场景中介入。
- Lead Agent 对 domain 内部工作流有自治权，但不能越过平台级权限和安全边界。

## 实施影响

对存储和通信的要求：

- 任务看板必须持久化。
- VP 运营和 VP 编排之间必须通过可靠事件与状态表协作。
- CEO 队列必须可恢复，避免崩溃后丢升级请求。

对成本和监控的要求：

- 总部层与 domain 层的成本需分开统计。
- 需要独立观测 CEO、VP 运营、VP 编排和 Lead Agent 的延迟与失败模式。

## 结果

收益：

- CEO 从日常链路中退出，系统吞吐更稳定。
- 总部职责更清晰，恢复与审计更容易实现。
- domain 可独立演化，不需要每一步都回到总部。

代价：

- VP 运营与 VP 编排之间必须建立可靠的状态同步机制。
- 任务看板、消息总线和升级队列成为新的关键基础设施。

## OAPEFLIR 角色澄清（§13/§45 reconciliation）

根据 §13/§45，OAPEFLIR 八阶段认知循环在平台中的定位如下：

### 官方立场

- OAPEFLIR **不是** active orchestration loop（该角色由 HarnessRuntime 承担）
- OAPEFLIR 的定位是 **StageRationale（阶段推理）** 和 **Audit View（审计视图）**
- OapeflirLoopService 仅用于阶段转换时的推理记录和审计追溯，不参与实时执行调度

### 双链拓扑（修订）

```
主链（实时执行）：
  Observe → Assess → Plan → Execute → Feedback
                                      ↓
副链（异步改进）：                  Feedback → Learn → Improve → Rollout
```

- **主链**：用户请求驱动的实时执行链路，强调低延迟和确定性，由 HarnessRuntime 驱动。
- **副链**：事件驱动的异步改进链路，强调学习和积累。
- 两条链路通过 `Feedback→Learn` 耦合，主链不等待副链完成。

### 三横切面

| 横切面 | 覆盖阶段 | 说明 |
|--------|---------|------|
| **Knowledge Plane** | Observe/Assess/Plan | 知识检索支撑各阶段上下文 |
| **Artifact Plane** | Plan/Execute | 执行产物（代码/文档）存储与发布 |
| **Memory Layer** | 全部 8 阶段 | L1-L6 记忆支撑上下文连续性 |

### 阶段与五平面架构的映射

| 五平面 | 对应 OAPEFLIR 组件 |
|--------|-------------------|
| P1 接口面 | StageRationale 入口、Audit View |
| P2 控制面 | 策略判断、风险评估（Assess） |
| P3 编排面 | Plan DTO 生成、GraphBundle |
| HarnessRuntime | Execute 执行（OAPEFLIR 不参与） |

### 关键架构约束

- **R1-SCOPE**：Phase 1 仅限 4 新目录：agent-loop/planning/feedback/improvement（其余 M2 提前实现）
- **R2-WHITELIST**：Observe 输出仅限 raw_signals/normalized_snapshot/refs/metrics
- **R2-BLACKLIST**：Observe 禁止输出 recommendedWorkflow/riskLevel/approvalRequired/modelClass/recommendedActions
- **R3-SINGLE**：Execute 层只能接收 Plan DTO，不得绕过
- **R4-TYPES**：Phase 1 仅 3 类学习：failure_pattern/user_correction/recovery_playbook
- **R4-EVIDENCE**：学习对象必须有 FeedbackSignal evidence 链接

## 交叉引用

- [ADR-002 事业部系统](./002-division-system.md)
- [ADR-004 工作流与路由](./004-workflow-routing.md)
- [ADR-009 部署与运维](./009-deployment-ops.md)
- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-079 Feedback Hub](./079-feedback-hub-signals.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)

## 来源章节

- `§2.1`
- `§2.2`
- `§2.2.1`
- `§4.1`
- `§OAPEFLIR` 八段模型（新增 2026-04-17）
