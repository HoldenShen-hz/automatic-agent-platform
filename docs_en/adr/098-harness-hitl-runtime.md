# ADR-098: Harness HITL Runtime

---

## OAPEFLIR Relationship

- **Observe**: Identify human intervention trigger conditions and evidence
- **Assess**: Choose approve / reject / continue / abort
- **Plan**: Form HITL request and resume boundary
- **Execute**: Pause run and wait for human input
- **Feedback**: Record human decision and responsibility chain
- **Learn**: Aggregate high-frequency HITL trigger reasons
- **Improve**: Optimize automation boundary
- **Release**: HITL is a runtime primitive, not a bypass mechanism

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

The architecture document requires HITL to be a native step type of Harness, not just a temporary escalation in exception scenarios.

## Decision

- HITL as a native runtime step of Harness
- When `NodeRun` enters `awaiting_hitl`, there must be a formal request and evidence refs
- Any human resolution must write audit and timeline

## Consequences

- Human collaboration upgrades from peripheral approval to main-chain capability

## v4.3 ADR Remediation

- A-26: This ADR originally used `waiting_hitl`. Root cause was early naming followed old harness draft and did not unify with canonical `NodeRun.status` enum to `awaiting_hitl`. Fix: The text now uses `NodeRun -> awaiting_hitl`.