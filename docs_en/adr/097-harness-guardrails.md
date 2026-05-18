# ADR-097 Harness Guardrails

---

## OAPEFLIR Association

- **Observe**: Read five-layer signals: input, plan, tool, memory, output
- **Assess**: Form guardrail findings and escalation recommendations
- **Plan**: Set blocking points for each execution round
- **Execute**: Intercept or escalate to human during runtime
- **Feedback**: Output findings, codes, evidence
- **Learn**: Aggregate high-frequency violation patterns
- **Improve**: Iterate guardrail policy
- **Release**: Guardrail pass rate as release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Guardrails cannot be just a single output filter; Harness needs full-chain risk interception.

## Decision

- Guardrails are fixed at five layers: input / planning / tool / memory / output
- Each layer has independent configuration, independent interception, and independent audit
- Evaluation results must enter timeline and feedback

## Consequences

- Harness risk control upgrades from point interception to chain-style control
