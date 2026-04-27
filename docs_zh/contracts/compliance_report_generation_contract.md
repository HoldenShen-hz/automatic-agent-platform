# Compliance Report Generation Contract

## 1. 范围

本 contract 定义 `§66` 的报告模板注册、证据映射和报告生成管线。

## 2. Canonical 对象

- `ComplianceReportTemplate`
- `EvidenceMappingRule`
- `ComplianceReportRequest`
- `ComplianceReportArtifact`

## 3. `ComplianceReportTemplate` 最小字段

- `template_id`
- `framework`
- `report_type`
- `required_evidence_types`
- `render_schema`
- `version`

## 4. 规则

- 报告必须引用真实 evidence artifact，不得手工伪造合规结论。
- 缺失 evidence 时必须给出缺口说明。
- 审计员访问报告必须是只读且可审计。

## 5. 测试要求

- unit：template validation、evidence mapping、render completeness
- integration：evidence store -> report pipeline
- contract：缺证据报告不得标记为 complete



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-30: 未引用架构的 EvidenceRecord(P3→P5)/EventEnvelope/AuditAppendCommand 作为证据源。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
