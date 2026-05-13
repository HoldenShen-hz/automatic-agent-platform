# ADR-098: Harness HITL Runtime

---

## OAPEFLIR Association

- **Observe**: Identify human intervention trigger conditions and evidence
- **Assess**: Choose approve / reject / continue / abort
- **Plan**: Form HITL request and resume boundary
- **Execute**: Pause run and wait for human input
- **Feedback**: Record human decision and responsibility chain
- **Learn**: Summarize high-frequency HITL trigger reasons
- **Improve**: Optimize automation boundary
- **Release**: HITL is runtime primitive, not a bypass mechanism

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Architecture documentation requires HITL to become a Harness native step type, not just temporarily escalate in exception scenarios.

## Decision

- HITL serves as a Harness native runtime step
- When `NodeRun` enters `awaiting_hitl`, there must be formal request and evidence refs
- Any human resolution must write audit and timeline

## Consequences

- Human collaboration upgrades from peripheral approval to main-chain capability

## v4.3 ADR Remediation

- A-26: This ADR originally used `waiting_hitl`. Root cause: Early naming followed old harness draft and did not unify with canonical `NodeRun.status` enumeration to `awaiting_hitl`. Fix: The text now changes to `NodeRun -> awaiting_hitl`.