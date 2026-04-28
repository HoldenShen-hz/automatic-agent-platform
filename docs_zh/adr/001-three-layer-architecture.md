# ADR-001 三层分权架构

- 状态：Accepted
- 决策日期：2026-04-02

## 背景

早期思路中，CEO 几乎承担了所有中枢职责：接收任务、分类、路由、拆分、编排、聚合和升级判断。这会让系统在并发任务出现时形成逻辑单点，也让职责边界、恢复边界和成本边界都变得模糊。

## 决策

采用五平面 + X1 横切面架构（v4.3 §4）：

- **P1 接口面（Interface Plane）**：负责用户消息接入、消息分诊、入口规范化和 NL 交互。
- **P2 控制面（Control Plane）**：负责策略判断、路由决策、风险评估、审批路由和治理约束注入。
- **P3 编排面（Orchestration Plane）**：负责跨 domain 拆分、依赖图构建、PlanGraphBundle 生成和 graph patch。
- **P4 执行面（Execution Plane）**：HarnessRuntime 作为唯一执行运行时，承接 P3→P4 handoff，执行 NodeRun/NodeAttempt。
- **P5 状态与证据面（State-Evidence Plane）**：负责 truth 持久化、事件溯源、artifacts 和审计日志。
- **X1 观测与可解释面（Observability Plane）**：跨平面横切，负责 metrics、traces、stage rationale 和审计视图。

domain / division 层级在 P3 内部以 DomainDescriptor + BusinessPack + DomainRiskSpec 表达。

## 五平面职责边界

| 平面 | 核心职责 | 边界约束 |
|------|----------|----------|
| P1 接口面 | 消息接入、分诊、NL 交互 | 不参与执行逻辑 |
| P2 控制面 | 策略、路由、风险、审批 | 不直接操作状态 |
| P3 编排面 | 拆分、依赖图、PlanGraphBundle | 不绕过 HarnessRuntime |
| P4 执行面 | NodeRun/NodeAttempt 执行 | 只接收 PlanGraphBundle |
| P5 状态面 | truth、events、artifacts | 不参与决策 |
| X1 观测面 | metrics、traces、audit | 只读横切 |

## 选择这个方案的原因

- 五平面分离让职责边界、恢复边界和成本边界清晰。
- X1 横切面统一观测能力，避免重复建设。
- 与 HarnessRuntime + RuntimeStateMachine 形成完整运行时主干。
- 为 Ring 1/2/3 渐进式落地提供结构化基础。

## 关键不变量

- P1 不应出现在执行关键路径中。
- P2 必须在不调用 P3 的情况下完成绝大多数路由和风险判断。
- P3 只通过 PlanGraphBundle 与 P4 交互，不得绕过。
- X1 观测面为只读横切，不参与决策。

## 实施影响

对存储和通信的要求：

- 各平面间必须通过显式契约交互。
- P5 状态面必须持久化所有 truth 级别事件。

对成本和监控的要求：

- 各平面成本需独立统计。
- X1 统一观测面需覆盖所有平面。

## 结果

收益：

- 五平面职责清晰，恢复与审计更容易实现。
- X1 横切统一观测能力。
- 平面分离支持渐进式落地和独立演进。

代价：

- 平面间契约需要显式维护。
- 跨平面调用增加少量延迟。

## OAPEFLIR 定位澄清（2026-04-28 更新）

### 重要澄清：OAPEFLIR 是投影而非运行时

§13/§45 明确界定：OAPEFLIR 是 StageRationale/Audit View，不是运行时执行引擎。

- **OAPEFLIR 八阶段是认知投影视图**，供人工审查、解释和审计使用
- **实际运行时编排由 HarnessRuntime 驱动**，通过 RuntimeStateMachine 管理状态转换
- OapeflirLoopService 仅产出 StageRationale 记录，不参与实际执行控制

### 双链拓扑（投影层）

```
主链（实时执行）：
  Observe → Assess → Plan → Execute → Feedback
                                      ↓
副链（异步改进）：                  Feedback → Learn → Improve → Rollout
```

- **主链**：供人工审查的实时执行轨迹投影
- **副链**：异步改进链路的学习与累积投影
- 两条链路通过 `Feedback→Learn` 耦合，但均为只读投影视图

### 三横切面（投影支撑）

| 横切面 | 覆盖阶段 | 说明 |
|--------|---------|------|
| **Knowledge Plane** | Observe/Assess/Plan | 知识检索支撑各阶段上下文 |
| **Artifact Plane** | Plan/Execute | 执行产物（代码/文档）存储与发布 |
| **Memory Layer** | 全部 8 阶段 | L1-L6 记忆支撑上下文连续性 |

### 阶段与五平面+X1 的映射

| 五平面+X1 | OAPEFLIR 阶段角色 |
|-----------|------------------|
| P1 接口面 | Observe（信号采集） |
| P2 控制面 | Assess（评估与风险判断） |
| P3 编排面 | Plan（显式规划） |
| P4 执行面 | Execute（执行与 Dual-Channel 输出） |
| X1 观测面 | Feedback/Learn/Improve/Rollout（审计与改进） |

### 关键架构约束

- **R1-SCOPE**：OAPEFLIR 阶段仅作投影视图，不直接控制执行
- **R2-WHITELIST**：Observe 输出仅限 raw_signals/normalized_snapshot/refs/metrics
- **R2-BLACKLIST**：Observe 禁止输出 recommendedWorkflow/riskLevel/approvalRequired/modelClass/recommendedActions
- **R3-SINGLE**：HarnessRuntime 执行层只接收 PlanGraphBundle，不得绕过
- **R4-TYPES**：Phase 1 仅 3 类学习：failure_pattern/user_correction/recovery_playbook
- **R4-EVIDENCE**：学习对象必须有 FeedbackSignal evidence 链接

## v4.3 ADR Remediation

- A-19: 本 ADR 原先采用 CEO/VP/Lead Agent 三层分权架构作为运行时主动 orchestration loop，根因是 OAPEFLIR spec/ADR 把认知投影视图写成 runtime truth，主架构 §13/§45 明确后引用链没有一起收口。修复：正文现改为五平面+X1 架构，OAPEFLIR 明确为投影/审计视图，运行时编排由 HarnessRuntime 驱动。

## 交叉引用

- [ADR-002 事业部系统](./002-division-system.md)
- [ADR-004 工作流与路由](./004-workflow-routing.md)
- [ADR-009 部署与运维](./009-deployment-ops.md)
- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-079 Feedback Hub](./079-feedback-hub-signals.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)

## 来源章节

注：v4.3 迁移后，原 §2.1/§2.2/§2.2.1/§4.1 节号已重构。本 ADR 相关内容现分布于 §4（五平面架构）、§13（OAPEFLIR 定位）、§45（HarnessRuntime）、§58（决策模型）。

v4.3 有效引用：
- `§4` 五平面+X1 架构
- `§13.1` OAPEFLIR 认知循环定位
- `§45` HarnessRuntime 与状态机
- `§58.6` 决策类型定义
