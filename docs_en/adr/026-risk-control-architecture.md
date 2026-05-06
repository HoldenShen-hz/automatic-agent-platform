# ADR-026 Risk Control Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Background

Agent, as a high-risk automated execution unit, must undergo risk assessment before and after execution to prevent dangerous operations from causing business losses.

## Decision

### Canonical Risk Model

v4.3 §10.2 specifies the canonical risk model adopts a two-dimensional scoring system:

```
risk_score = impact × 4 + irreversibility × 4
```

| Dimension | Description |
|-----------|-------------|
| impact | Business impact degree (0-4 magnitude) |
| irreversibility | Irreversibility/rollback difficulty (0-4 magnitude) |

### 4-Level Risk Mapping

| Level | Threshold | Handling Strategy |
|-------|-----------|-------------------|
| low | 0-8 | Direct execution |
| medium | 9-16 | Log only |
| high | 17-24 | Requires human approval |
| critical | 25-32 | break_glass approval |

### Risk Assessment Constraints

- §10.3 specifies: high/critical risk levels default deny (default deny), auto execution requires explicit approval
- RiskEvaluationEngine implementation must follow §10.2-§10.3 canonical model

## Consequences

Advantages:

- Quantified risk makes decisions traceable
- Tiered handling strategy balances safety and efficiency
- Configurable weights adapt to different business scenarios

Costs:

- Risk assessment adds execution latency
- Historical data accumulation takes time

## Cross References

- [ADR-005 Security Model](./005-security-model.md)
- [ADR-021 Inter-Plane Communication Contract](./021-inter-plane-communication-contract.md)

## Source Sections

- `§10` Risk control architecture

## v4.3 ADR Remediation

- A-18: This ADR originally retained the six-factor model of `stepTypeRisk / targetSystemRisk / dataClassRisk / blastRadius / priorFailureRate / confidence`. The root cause was that risk ADR followed early step-centric scoring draft and did not upgrade along with main architecture migrating from step to node-run. Fix: The text now converges to the v4.3 §10.2 two-dimensional canonical model of `impact × 4 + irreversibility × 4`.
