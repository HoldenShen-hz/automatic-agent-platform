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

- Reports must reference real evidence artifacts and must not manually fabricate compliance conclusions.
- When evidence is missing, a gap explanation must be provided.
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

- Original evidence sources for compliance reports must come from `EvidenceRecord`, `EventEnvelope`, and `AuditAppendCommand`, not from freely assembled report notes or manually uploaded summaries.
- `source_event_type` must be traceable back to `platform.*` truth fact or registered view/evidence events; if only `oapeflir.view.*` exists without a source fact, the report must mark evidence as incomplete.
- Any report paragraph referencing execution, approval, budget, release, or recovery facts must be able to map to corresponding `event_envelope_ref` and `audit_append_id`.

### 4.2 Evidence Mapping Rule

`EvidenceMappingRule` must declare at minimum:

- `required_event_types`
- `required_audit_actions`
- `required_artifact_kinds`
- `missing_evidence_policy`
- `evidence_quality_gate`

Rules:

- `missing_evidence_policy` must at minimum distinguish `block_report`, `mark_partial`, `human_override_required`.
- `evidence_quality_gate` must validate `EvidenceRecord` completeness before report generation, not manually discover gaps after rendering.

## 5. Testing Requirements

- unit: template validation, evidence mapping, render completeness
- integration: evidence store -> report pipeline
- contract: reports with missing evidence must not be marked as complete

## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-30: This document originally only stated "reference real evidence artifacts" but did not write the architecture's `EvidenceRecord`, `EventEnvelope`, `AuditAppendCommand` as explicit evidence sources for the report pipeline. Root cause: Early report contracts treated artifacts as the sole evidence carrier, missing the primary role of factual events and audit append commands in the P3→P5 evidence chain. Fix: The body now supplements `EvidenceRecord` / `AuditAppendCommand` minimum fields and requires report paragraphs to be traceable back to `EventEnvelope` and audit append records.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.