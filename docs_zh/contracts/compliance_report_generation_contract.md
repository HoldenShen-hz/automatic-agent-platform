# Compliance Report Generation Contract

## 1. 范围

本 contract 定义 `§66` 的报告模板注册、证据映射和报告生成管线。

## 2. Canonical 对象

- `ComplianceReportTemplate`
- `EvidenceMappingRule`
- `ComplianceReportRequest`
- `ComplianceReportArtifact`
- `EvidenceRecord`
- `AuditAppendCommand`

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

### 4.1 证据源要求

`EvidenceRecord` 最少字段：

- `evidence_id`
- `source_event_id`
- `source_event_type`
- `event_envelope_ref`
- `artifact_ref?`
- `trace_id`
- `recorded_at`
- `producer_plane`

`AuditAppendCommand` 最少字段：

- `audit_append_id`
- `actor_type`
- `actor_id`
- `action`
- `resource_ref`
- `decision_ref?`
- `evidence_ref?`
- `trace_id`
- `occurred_at`

规则：

- 合规报告的原始证据源必须来自 `EvidenceRecord`、`EventEnvelope` 和 `AuditAppendCommand`，而不是自由拼接的 report note 或人工上传摘要。
- `source_event_type` 必须可回链到 `platform.*` truth fact 或经注册的 view/evidence 事件；若只存在 `oapeflir.view.*` 而无来源 fact，报告必须标记证据不完整。
- 任意报告段落若引用执行、审批、预算、发布或恢复事实，必须能够落到对应 `event_envelope_ref` 和 `audit_append_id`。

### 4.2 Evidence Mapping Rule

`EvidenceMappingRule` 至少应声明：

- `required_event_types`
- `required_audit_actions`
- `required_artifact_kinds`
- `missing_evidence_policy`
- `evidence_quality_gate`

规则：

- `missing_evidence_policy` 至少区分 `block_report`、`mark_partial`、`human_override_required`。
- `evidence_quality_gate` 必须在报告生成前校验 `EvidenceRecord` 完整性，而不是等渲染后再人工发现缺口。

## 5. 测试要求

- unit：template validation、evidence mapping、render completeness
- integration：evidence store -> report pipeline
- contract：缺证据报告不得标记为 complete



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-30: 本文原先只说“引用真实 evidence artifact”，但没有把架构中的 `EvidenceRecord`、`EventEnvelope`、`AuditAppendCommand` 写成报告管线的显式证据源，根因是早期报告合同把 artifact 当成唯一证据载体，遗漏了事实事件与审计追加命令在 P3→P5 证据链中的主干作用。修复：正文现补入 `EvidenceRecord` / `AuditAppendCommand` 最小字段，并要求报告段落可回链到 `EventEnvelope` 与 audit append 记录。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
