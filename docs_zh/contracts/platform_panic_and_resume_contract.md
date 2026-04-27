# Platform Panic And Resume Contract

## 1. 范围

本 contract 定义 `§60` 的全局熔断、传播机制、恢复协议和演练要求。

## 2. Canonical 对象

- `PlatformPanicDirective`
- `PanicPropagationRecord`
- `ResumePlan`
- `PanicDrillRecord`

## 3. `PlatformPanicDirective` 最小字段

- `directive_id`
- `scope`
- `reason_code`
- `issued_by`
- `issued_at`
- `freeze_modes`
- `allow_list?`

## 4. 规则

- panic 必须可作用于 platform / tenant / org / domain / workflow 多层级。
- panic 生效后，新的高风险执行必须被阻断。
- 恢复必须通过显式 `ResumePlan`，不得靠隐式重启解除。

## 5. 测试要求

- unit：scope match、propagation、resume validation
- integration：panic -> execution block -> resume
- contract：panic 期间不得出现未审计的自动恢复



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-26: Panic scope 含 workflow 但架构§9.5 ModeScope 为 platform>region>tenant>domain>run>node，缺 region/run/node；ResumePlan 无架构要求的人工确认约束。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
