# ADR-098 Harness HITL Runtime

---

## OAPEFLIR Association

- **Observe**: Identify human intervention triggers and evidence
- **Assess**: Select approve / reject / continue / abort
- **Plan**: Form HITL request and resume boundary
- **Execute**: Pause run and wait for human input
- **Feedback**: Record human decisions and accountability chain
- **Learn**: Aggregate high-frequency HITL triggers
- **Improve**: Optimize automation boundary
- **Release**: HITL is a runtime primitive, not a bypass mechanism

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

The architecture document requires HITL to become a native Harness step type, not just a temporary escalation in exception scenarios.

## Decision

- HITL is a native Harness runtime step
- When a run enters `waiting_hitl`, it must have a formal request and evidence refs
- Any human resolution must write to audit and timeline

## Consequences

- Human collaboration upgrades from peripheral approval to main-chain capability