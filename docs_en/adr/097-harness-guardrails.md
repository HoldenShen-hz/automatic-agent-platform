# ADR-097 Harness Guardrails

---

## OAPEFLIR Association

- **Observe**: Read input, planning, tool, memory, and output five-layer signals
- **Assess**: Form guardrail findings and escalation advice
- **Plan**: Set block points for each run
- **Execute**: Intercept or route to human during execution
- **Feedback**: Output findings, codes, and evidence
- **Learn**: Aggregate high-frequency violation patterns
- **Improve**: Iterate guardrail policy
- **Release**: Guardrail pass rate as release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Guardrails cannot be a single output filter only; Harness needs full-chain risk interception.

## Decision

- Guardrails are fixed to five layers: input / planning / tool / memory / output
- Each layer is independently configured, intercepted, and audited
- Evaluation results must flow into timeline and feedback

## Consequences

- Harness risk control upgrades from point interception to chain-based control