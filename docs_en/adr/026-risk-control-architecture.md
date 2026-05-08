# ADR-026 Risk Control Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Agent, as a high-risk automated execution unit, must perform risk assessment before and after execution to prevent dangerous operations from causing business losses.

## Decision

### 8-Factor Weighted Scoring Algorithm

| Factor | Weight | Description |
|--------|--------|-------------|
| operationRisk | 3 | Current operation type and side effect risk |
| targetResourceCriticality | 3 | Criticality of target resource or system |
| dataSensitivity | 3 | Sensitivity level of input/output data |
| autonomyModeRisk | 2 | Automation amplification risk from current runtime mode |
| tenantImpact | 2 | Scope of tenant/organization affected |
| blastRadius | 2 | Failure propagation radius |
| historicalFailureRate | 2 | Historical failure rate of similar actions |
| evidenceConfidence | 1 | Sufficiency of evidence and judgment confidence |

### Risk Scoring Formula

```
risk_score = (
  operationRisk*3 +
  targetResourceCriticality*3 +
  dataSensitivity*3 +
  autonomyModeRisk*2 +
  tenantImpact*2 +
  blastRadius*2 +
  historicalFailureRate*2 +
  evidenceConfidence*1
) / 18
```

### 4-Level Risk Mapping

| Level | Threshold | Handling Strategy |
|-------|-----------|-------------------|
| low | 0-0.25 | Direct execution |
| medium | 0.25-0.5 | Log only |
| high | 0.5-0.75 | Requires human approval |
| critical | 0.75-1.0 | break_glass approval |

### Configuration

- `config/risk/default.json` fully defines 8 factors and thresholds
- RiskEvaluationEngine implements score calculation

## Consequences

Benefits:

- Quantified risk makes decisions traceable
- Tiered handling strategy balances security and efficiency
- Configurable weights adapt to different business scenarios

Costs:

- Risk assessment adds execution latency
- Historical data accumulation takes time

## Cross References

- [ADR-005 Security Model](./005-security-model.md)
- [ADR-021 Inter-Plane Communication Contract](./021-inter-plane-communication-contract.md)

## Source Section

- `§10` Risk Control Architecture

## v4.3 ADR Remediation

- A-18: This ADR originally kept the `stepTypeRisk / targetSystemRisk / dataClassRisk / blastRadius / priorFailureRate / confidence` six-factor model. The root cause was that the risk ADR followed an early step-centric scoring draft and did not upgrade to incorporate autonomy mode, tenant impact scope, and evidence sufficiency into a unified risk assessment. Fix: The text now converges to the 8-factor canonical model and synchronizes the weights and formula.
