# ADR-098 Harness HITL Runtime

---

## OAPEFLIR Association

- **Observe**: Identify human intervention trigger conditions and evidence
- **Assess**: Choose approve / reject / continue / abort
- **Plan**: Form HITL request and resume boundary
- **Execute**: Pause run and wait for human input
- **Feedback**: Record human decision and responsibility chain
- **Learn**: Summarize high-frequency HITL trigger causes
- **Improve**: Optimize automation boundary
- **Release**: HITL is a runtime primitive, not a bypass mechanism

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Architecture document requires HITL to become a Harness native step type, not just temporary upgrade in exception scenarios.

## Decision

- HITL serves as a Harness native runtime step
- When `NodeRun` enters `awaiting_hitl`, there must be formal request and evidence refs
- Any human resolution must write audit and timeline

## Consequences

- Human collaboration upgraded from peripheral approval to main chain capability

## v4.3 ADR Remediation

- A-26: This ADR originally used `waiting_hitl`,根因 was early naming followed旧 harness draft, and did not unify with canonical `NodeRun.status` enumeration to `awaiting_hitl`. Fix: The text now changed to `NodeRun -> awaiting_hitl`.
