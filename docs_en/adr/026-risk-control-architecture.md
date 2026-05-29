# ADR-026 Risk Control Architecture

- Status：Accepted
- Decision Date：2026-04-03

## Background

Agents, as high-risk automated execution units, must undergo risk assessment before and after execution to prevent dangerous operations from causing business losses.

## Decision

### 8-Factor Weighted Scoring Algorithm（§10.2 canonical）

| Factor | Weight | Description |
|------|------|------|
| operationRisk | 4 | Degree of impact on business/system from the operation |
| irreversibility | 4 | Degree to which results are irreversible |
| dataSensitivity | 3 | Sensitivity level of data involved in input/output |
| targetResourceCriticality | 3 | Criticality of target resource |
| autonomyModeRisk | 2 | Automation amplification risk from current runtime mode |
| tenantImpact | 2 | Scope of impact on tenant/organization |
| blastRadius | 2 | Failure propagation radius |
| historicalFailureRate | 2 | Historical failure rate of similar actions |
| evidenceConfidence | 1 | Evidence completeness and judgment confidence |

### Risk Scoring Formula（§10.2 canonical）

```
risk_score = (
  operationRisk*4 +
  irreversibility*4 +
  dataSensitivity*3 +
  targetResourceCriticality*3 +
  autonomyModeRisk*2 +
  tenantImpact*2 +
  blastRadius*2 +
  historicalFailureRate*2 +
  evidenceConfidence*1
) / 20
```

### 4-Level Risk Mapping（§10.2 canonical）

| Level | Threshold | Handling Strategy |
|------|------|----------|
| low | 0-0.25 | Execute directly |
| medium | 0.25-0.5 | Log record |
| high | 0.5-0.75 | Requires human approval |
| critical | 0.75-1.0 | break_glass approval |

### Configuration

- `config/risk/default.json` fully defines 8 factors and thresholds
- RiskEvaluationEngine implements scoring calculation

## Consequences

Advantages:

- Quantitative risk enables traceable decisions
- Tiered handling strategy balances security and efficiency
- Configurable weights adapt to different business scenarios

Costs:

- Risk assessment adds execution latency
- Historical data accumulation takes time

## Cross-references

- [ADR-005 Security Model](./005-security-model.md)
- [ADR-021 Inter-plane Communication Contract](./021-inter-plane-communication-contract.md)

## Source Section

- `§10` Risk Control Architecture

## v4.3 ADR Remediation

- A-18: This ADR originally retained the six-factor model `stepTypeRisk / targetSystemRisk / dataClassRisk / blastRadius / priorFailureRate / confidence`, root cause: the risk ADR followed an early step-centric scoring draft and did not upgrade together with the main architecture's inclusion of autonomy mode, tenant impact scope, and evidence completeness into unified risk assessment. Fix: The body now converges to the 8-factor canonical model, with synchronized correction of weights and formula.