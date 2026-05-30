# Compliance Report Generation Contract

## 1. Scope

This contract defines `§66`'s report template registration, evidence mapping, and report generation pipeline.

## 2. Canonical Objects

- `ComplianceReportTemplate`
- `EvidenceMappingRule`
- `ComplianceReportRequest`
- `ComplianceReportArtifact`
- `EvidenceRecord`
- `AuditAppendCommand`

## 3. `ComplianceReportTemplate` Minimum Fields

- `template_id`
- `framework`
- `report_type`
- `required_evidence_types`
- `render_schema`
- `version`

## 4. Rules

- Reports must reference real evidence artifacts; manually fabricating compliance conclusions is not allowed.
- When evidence is missing, a gap description must be provided.
- Auditor access to reports must be read-only and auditable.

### 4.1 Evidence Source Requirements

`EvidenceRecord` minimum fields:

- `evidence_id`
- `source_event_id`
- `source_event_type`
- `event_envelope_ref`
- `artifact_ref?`
- `trace_id`
- `recorded_at`
- `producer_plane`

`AuditAppendCommand` minimum fields:

- `audit_append_id`
- `actor_type`
- `actor_id`
- `action`
- `resource_ref`
- `decision_ref?`
- `evidence_ref?`
- `trace_id`
- `occurred_at`

Rules:

- Original evidence sources for compliance reports must come from `EvidenceRecord`, `EventEnvelope`, and `AuditAppendCommand`, not freely assembled report notes or manually uploaded summaries.
- `source_event_type` must be traceable to `platform.*` truth fact or registered view/evidence events; if only `oapeflir.view.*` exists without source fact, the report must mark evidence as incomplete.
- Any report paragraph referencing execution, approval, budget, release, or recovery facts must be able to map to corresponding `event_envelope_ref` and `audit_append_id`.

### 4.2 Evidence Mapping Rule

`EvidenceMappingRule` should declare at least:

- `required_event_types`
- `required_audit_actions`
- `required_artifact_kinds`
- `missing_evidence_policy`
- `evidence_quality_gate`

Rules:

- `missing_evidence_policy` must at least distinguish `block_report`, `mark_partial`, `human_override_required`.
- `evidence_quality_gate` must verify `EvidenceRecord` completeness before report generation, not wait until after rendering to manually discover gaps.

## 5. Testing Requirements

- unit: template validation, evidence mapping, render completeness
- integration: evidence store -> report pipeline
- contract: reports with missing evidence must not be marked as complete

## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-30: This document originally only said "reference real evidence artifact" but did not write `EvidenceRecord`, `EventEnvelope`, and `AuditAppendCommand` from architecture as explicit evidence sources for the report pipeline. Root cause: Early report contract treated artifact as the sole evidence carrier, missing the main role of fact events and audit append commands in P3→P5 evidence chain. Fix: The main text now supplements `EvidenceRecord` / `AuditAppendCommand` minimum fields and requires report paragraphs to be traceable to `EventEnvelope` and audit append records.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.