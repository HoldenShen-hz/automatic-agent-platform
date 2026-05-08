# ADR-098 Harness HITL Runtime

---

## OAPEFLIR Association

- **Observe**: Identify human intervention trigger conditions and evidence
- **Assess**: Choose approve / reject / continue / abort
- **Plan**: Form HITL request and resume boundary
- **Execute**: Pause run and wait for human input
- **Feedback**: Record human decision and chain of responsibility
- **Learn**: Aggregate high-frequency HITL trigger reasons
- **Improve**: Optimize automation boundary
- **Release**: HITL is a runtime primitive, not a bypass mechanism

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

The architecture document requires HITL to become a native Harness step type, not just a temporary escalation in exceptional scenarios.

## Decision

- HITL as native Harness runtime step
- When `NodeRun` enters `awaiting_hitl`, there must be a formal request and evidence refs
- Any human resolution must write audit and timeline

## Consequences

- Human collaboration upgrades from peripheral approval to main-chain capability

## v4.3 ADR Remediation

- A-26: This ADR originally used `waiting_hitl`. The root cause was that early naming followed an old harness draft and did not unify with the canonical `NodeRun.status` enum to `awaiting_hitl`. Fix: The body now uses `NodeRun -> awaiting_hitl`.
