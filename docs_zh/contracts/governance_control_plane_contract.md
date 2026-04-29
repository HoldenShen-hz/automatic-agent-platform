# Governance Control Plane Contract

## 1. 范围

本 contract 定义最终平台的统一治理平面，包括 policy evaluation、approval、budget、sandbox、kill switch、freeze 和 audit 入口。

它用于回答“高风险动作由谁决定、在哪一层决定、如何审计、如何阻断和如何恢复”。

## 2. 目标

- 把分散的治理判断收拢到统一 `control plane`。
- 让 runtime、tool、approval、budget 和 auth 有一致的决策入口。
- 让 deny、freeze、kill、takeover 成为正式平台能力。
- 让治理决策可追溯、可解释、可回放。

## 3. 非目标

- 本 contract 不规定具体 policy engine 产品。
- 本 contract 不替代审批对象、sandbox 规则或预算字段本身。
- 本 contract 不让治理层直接篡改业务结果。

## 4. 架构角色

- `PolicyDecisionService`
- `ApprovalGateway`
- `BudgetGuard`
- `ExecutionFreezeSwitch`
- `GovernanceAuditLedger`
- `DecisionContextBuilder`
- `EmergencyControlInterface`

```mermaid
flowchart LR
    A["Runtime / API / Tool / Admin"] --> B["DecisionContextBuilder"]
    B --> C["PolicyDecisionService"]
    B --> D["ApprovalGateway"]
    B --> E["BudgetGuard"]
    B --> F["Sandbox / Auth"]
    C --> G["PolicyDecisionResult"]
    D --> G
    E --> G
    F --> G
    G --> H["Execution / Tool / API Outcome"]
    G --> I["GovernanceAuditLedger"]
    J["EmergencyControlInterface"] --> H
    J --> I
```

## 5. 适用动作域

统一治理平面至少覆盖以下动作：

- runtime execution start
- tool call
- network access
- filesystem write
- external side-effect action
- observe / assess action proposal promote
- billing / quota sensitive action
- enterprise admin action

## 6. 关键对象

- `OperationalDirective`
- `DecisionDirective`
- `DenyReason`
- `FreezeOrder`
- `KillOrder`
- `AuditEntry`
- `ApprovalRequirement`

## 7. `OperationalDirective` / `DecisionDirective`

治理平面对 P3 / P4 的 canonical 指令对象分为两类：

| 指令对象 | `type` 枚举 | 作用范围 | 说明 |
| --- | --- | --- |
| `OperationalDirective` | `pause \| resume \| abort \| rollback \| kill \| mode_switch \| quota_adjust` | `HarnessRun`、`NodeRun`、Plane、Tenant、Region | 只改变运行控制状态，不表达业务 approve / deny |
| `DecisionDirective` | `approve \| deny \| override \| request_changes \| expire_approval` | `decisionId`、`sideEffectId`、`hitlTaskId`、`budgetReservationId` | 只能由 HITL / Policy / Approval 流程生成，表达业务裁决 |

`OperationalDirective` minimum fields:

- `directive_id`
- `type`
- `scope_type` (`platform | region | tenant | domain | harness_run | node_run`)
- `scope_ref`
- `issued_by`
- `issued_at`
- `expires_at?`
- `reason_code`
- `constraint_patch?`

`DecisionDirective` minimum fields:

- `directive_id`
- `type`
- `decision_id`
- `scope_type`
- `scope_ref`
- `issued_by`
- `issued_at`
- `expires_at?`
- `evidence_ref?`

规则：

- P2 -> P3 / P4 的常规控制必须通过 `OperationalDirective` 或 `DecisionDirective` 下发，不得再定义平行的 `DecisionRequest` / `DecisionResult` canonical schema。
- `PolicyDecisionRequest` / `PolicyDecisionResult` 仍是策略求值输入输出，但它们属于决策形成过程，不是控制平面发给执行平面的最终指令对象。
- P2 -> P4 的直达通道只允许 `OperationalDirective(type=kill)`，且仅限 panic / emergency 场景。

## 8. 与 `PolicyDecisionRequest` / `PolicyDecisionResult` 的关系

| control-plane 概念 | policy-engine 对象 | 说明 |
| --- | --- | --- |
| 决策形成输入 | `PolicyDecisionRequest` | 进入策略、预算、审批、auth 联合求值 |
| 决策形成输出 | `PolicyDecisionResult` | 表达 allow / deny / allow_with_constraints / escalate_for_approval |
| 运行控制下发 | `OperationalDirective` | 将控制结论发送给 P3 / P4 |
| 业务裁决下发 | `DecisionDirective` | 将审批 / HITL / override 等业务裁决发送给 P3 / P4 |

规则：

- 治理平面不得把 `PolicyDecisionResult` 直接当作执行平面指令对象下发。
- `DecisionDirective` 必须引用上游 `decision_id` 或等价审批/预算/副作用对象，确保裁决链可追溯。
- `OperationalDirective` 只能改变控制状态，不得伪装成业务 approve / deny。

## 9. 决策优先级

建议优先级从高到低：

1. `OperationalDirective(type=kill)` / panic / freeze
2. `policy deny`
3. `auth deny`
4. `budget deny`
5. `DecisionDirective(approve/deny/expire_approval/override/request_changes)`
6. `OperationalDirective(mode_switch/quota_adjust/resume/pause/abort/rollback)`

解释：

- 紧急冻结优先于普通业务允许。
- 显式 deny 优先于 approval required。
- approval 只解决需要人工许可的问题，不覆盖 auth / policy 的硬性禁止。

### 9.1 决策流程图

```mermaid
flowchart TD
    A["PolicyDecisionRequest"] --> B{"Emergency Freeze / Kill?"}
    B -- "Yes" --> C["OperationalDirective(type=kill)"]
    B -- "No" --> D{"Policy Allow?"}
    D -- "No" --> E["Policy Deny"]
    D -- "Yes" --> F{"Auth Allow?"}
    F -- "No" --> G["Auth Deny"]
    F -- "Yes" --> H{"Budget Allow?"}
    H -- "No" --> I["Budget Deny / Degrade"]
    H -- "Yes" --> J{"Approval Required?"}
    J -- "Yes" --> K["DecisionDirective(request_changes / approve / deny)"]
    J -- "No" --> L["OperationalDirective(mode_switch / resume / pause / quota_adjust)"]
    C --> M["Audit Ledger"]
    E --> M
    G --> M
    I --> M
    K --> M
    L --> M
```

## 10. Freeze / Kill 语义

`FreezeOrder`
: 暂停一个 domain 的新执行或新副作用，但不一定杀死已经执行中的动作。

`KillOrder`
: 强制中断指定 `HarnessRun`、`NodeRun`、worker、queue、region 或 tenant 的运行。

最小字段：

- `order_id`
- `domain_type`
- `domain_ref`
- `reason`
- `issued_by`
- `issued_at`
- `expires_at?`

规则：

- freeze 与 kill 都必须写入审计账本。
- kill 不得静默发生，必须能追溯到触发者、范围和原因。
- 被 freeze 的 domain 在恢复前默认 fail-closed。
- `KillOrder` 真正进入执行层时，必须表现为 `OperationalDirective(type=kill)`。

## 11. Approval 联动

- approval gateway 负责生成 approval requirement，不负责最终 policy 解释。
- 高风险动作必须先经 governance control plane 判断是否进入审批。
- 审批通过后仍需再次经过最小决策重评估，不能直接跳过治理层执行。

## 12. Budget 联动

- budget guard 作为 decision source 之一参与统一判断。
- 预算不足应返回明确 deny 或 degrade 语义。
- 预算放行不等于策略放行，两者必须分别有决策来源。

## 13. Sandbox / Auth 联动

- sandbox 决策负责约束“能做什么”。
- auth 决策负责约束“谁有资格做”。
- governance 层负责把两者放进同一决策管道，而不是让调用方分别手写判断。

## 14. Audit Ledger

`AuditEntry` 最小字段：

- `audit_id`
- `request_id`
- `decision_source`
- `decision_summary`
- `actor_ref`
- `created_at`
- `trace_id?`

规则：

- deny / freeze / kill / approval required 均必须写审计记录。
- audit ledger 是治理事实源的一部分，不应只存在日志中。

## 15. Failure Mode

治理平面需明确处理以下失败模式：

- policy engine 不可用
- approval backend 不可用
- budget service 超时
- auth provider 波动
- emergency kill 与普通 allow 冲突

处理原则：

- 高风险动作默认 fail-closed。

## 15A. OAPEFLIR Governance Gates

对 OAPEFLIR Phase 1-4，治理平面至少要覆盖以下 gate：

- `plan_gate`
- `feedback_disposition_gate`
- `improvement_acceptance_gate`
- `release_transition_gate`

规则：

- `Observe / Assess / Plan` 可提交建议，但不得越过治理 gate 直接接受改进或推进 release。
- `release_transition_gate` 的语义是评估生命周期推进请求，例如 `testing -> canary -> active -> paused/deprecated/archived/removed`，不得与 rollout ring 名称混用。
- `off / suggest / shadow` 若存在，只能作为 rollout / evaluate 兼容投影视图，不得冒充生命周期真值。
- `canary_promote / full_release / rollback automation` 可作为 release gate 的动作结果，但必须映射到 canonical lifecycle / rollout authority。
- 低风险只读动作可按配置降级。
- emergency control 始终优先。

## 16. 与现有文档的关系

- `approval_and_hitl_contract.md` 定义审批对象。
- `sandbox_and_auth_contract.md` 定义安全与认证边界。
- `cost_and_budget_contract.md` 定义预算与成本约束。
- `execution_plane_contract.md` 定义 freeze / kill / takeover 对 execution plane 的作用面。
- 本 contract 定义这些能力如何汇合成统一治理平面。

## 17. 分阶段引入

- Phase 2: 最小统一决策入口 + deny taxonomy。
- Phase 3: observe-compatible product slice / monetization 动作纳入治理。
- Phase 4: enterprise policy / compliance / audit 套件。

## 18. 收口结论

治理平面的核心不是“增加更多规则”，而是把审批、预算、权限、策略、紧急控制统一到一个可解释的决策入口。

后续任何高风险动作，只要不能接入该平面，就不应被视为平台级能力。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-24: 本文原先把 `DecisionRequest / DecisionResult` 写成治理平面对 P3/P4 的 canonical 指令，根因是早期文档把“策略求值过程”和“控制平面下发对象”混成了一层，导致 policy output 直接冒充 runtime directive。修复：正文现把 P2 -> P3/P4 指令收敛到 `OperationalDirective` / `DecisionDirective`，并将 `PolicyDecisionRequest / Result` 明确降回决策形成过程对象。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
