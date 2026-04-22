# ADR-098 Harness HITL Runtime

---

## OAPEFLIR Association

- **Observe**: Identify human intervention conditions and evidence
- **Assess**: Select approve / reject / continue / abort
- **Plan**: Form review requests and resume boundaries
- **Execute**: Pause the run and wait for human input
- **Feedback**: Record human decision and accountability
- **Learn**: Aggregate high-frequency HITL triggers
- **Improve**: Refine autonomy boundaries
- **Release**: HITL is a runtime primitive, not a side path

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

The architecture requires HITL to be a native Harness step type.

## Decision

- HITL is a native Harness runtime step
- Any run in `waiting_hitl` must have a formal request and evidence refs
- Any human resolution must be written to audit and timeline

## Consequences

- Human collaboration becomes part of the main runtime path
