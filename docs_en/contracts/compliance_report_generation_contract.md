# Compliance Report Generation Contract

## 1. 范围

本 contract defines `§66` 的报告模板注册、证据映射和报告生成管线。

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

- 报告必须references用真实 evidence artifact，不得手工伪造合规Conclusion。
- 缺失 evidence 时必须给出缺口Description。
- 审计员访问报告必须is只读且可审计。

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

- 合规报告的原始证据源必须来自 `EvidenceRecord`、`EventEnvelope` 和 `AuditAppendCommand`，而不is自由拼接的 report note 或人工上传摘要。
- `source_event_type` 必须可回链到 `platform.*` truth fact 或via注册的 view/evidence 事件；若只存在 `oapeflir.view.*` 而no来源 fact，报告必须标记证据不完整。
- 任意报告段落若references用执lines、审批、budget、发布或恢复事实，必须能够落到对应 `event_envelope_ref` 和 `audit_append_id`。

### 4.2 Evidence Mapping Rule

`EvidenceMappingRule` 至少应声明：

- `required_event_types`
- `required_audit_actions`
- `required_artifact_kinds`
- `missing_evidence_policy`
- `evidence_quality_gate`

规则：

- `missing_evidence_policy` 至少区分 `block_report`、`mark_partial`、`human_override_required`。
- `evidence_quality_gate` 必须在报告生成前校验 `EvidenceRecord` 完整性，而不is等渲染后再人工发现缺口。

## 5. 测试要求

- unit：template validation、evidence mapping、render completeness
- integration：evidence store -> report pipeline
- contract：缺证据报告不得标记为 complete



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-30: 本文原先只说“references用真实 evidence artifact”，但没有把Architecture中的 `EvidenceRecord`、`EventEnvelope`、`AuditAppendCommand` 写成报告管线的显式证据源，Root cause: 早期报告合同把 artifact 当成唯一证据载体，遗漏了事实事件vs审计追加命令在 P3→P5 证据链中的主干作用。修复：正文现补入 `EvidenceRecord` / `AuditAppendCommand` 最小字段，并要求报告段落可回链到 `EventEnvelope` vs audit append record。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
