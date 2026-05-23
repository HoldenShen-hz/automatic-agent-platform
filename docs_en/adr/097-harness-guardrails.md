# ADR-097 Harness Guardrails

---

## OAPEFLIR Association

- **Observe**: Read input, plan, tool, memory, output five-layer signals
- **Assess**: Form guardrail findings and escalation suggestions
- **Plan**: Set blocking points for each round of execution
- **Execute**: Implement interception or transfer to human during execution
- **Feedback**: Output findings, codes, evidence
- **Learn**: Summarize high-frequency violation patterns
- **Improve**: Iterate guardrail policy
- **Release**: Guardrail pass rate as release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Guardrails cannot be just a single output filter; Harness needs full-chain risk interception.

## Decision

- Guardrails are fixed as five layers: input / planning / tool / memory / output
- Each layer has independent configuration, independent interception, independent audit
- Evaluation results must enter timeline and feedback

## Consequences

- Harness risk control upgraded from point interception to chain-style control
