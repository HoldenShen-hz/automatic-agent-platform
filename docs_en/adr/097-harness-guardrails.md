# ADR-097 Harness Guardrails

---

## OAPEFLIR Association

- **Observe**: Read input, planning, tool, memory, and output signals
- **Assess**: Produce guardrail findings and escalation advice
- **Plan**: Define block points for each run
- **Execute**: Intercept or escalate during execution
- **Feedback**: Output findings, codes, and evidence
- **Learn**: Aggregate recurring violation patterns
- **Improve**: Refine guardrail policy
- **Release**: Guardrail pass-rate is a release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Guardrails must be a full-chain control layer, not only an output filter.

## Decision

- Guardrails are fixed to five layers: input / planning / tool / memory / output
- Each layer is independently configured, intercepted, and audited

## Consequences

- Harness risk control becomes chain-based rather than point-based
