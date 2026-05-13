# ADR-097: Harness Guardrails

---

## OAPEFLIR Association

- **Observe**: Read input, plan, tool, memory, and output five-layer signals
- **Assess**: Form guardrail findings and escalation suggestions
- **Plan**: Set blocking points for each run
- **Execute**: Implement intercept or transfer to human during execution
- **Feedback**: Output findings, codes, and evidence
- **Learn**: Summarize high-frequency violation patterns
- **Improve**: Iterate guardrail policy
- **Release**: Guardrail pass rate as release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Guardrails cannot be just a single output filter; Harness needs full-chain risk interception.

## Decision

- Guardrails are fixed as five layers: input / planning / tool / memory / output
- Each layer is independently configured, independently intercepted, and independently audited
- Evaluation results must enter timeline and feedback

## Consequences

- Harness risk control upgrades from point interception to chain-style control