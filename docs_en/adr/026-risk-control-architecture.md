# ADR-026 Risk Control Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Agent, as a high-risk automated execution unit, must perform risk assessment before and after execution to prevent dangerous operations from causing business losses.

## Decision

### Risk Factor Scoring Algorithm (§10.2 canonical)

| Factor | Weight | Description |
|--------|--------|-------------|
| impact | 4 | Degree of impact on business/system from the operation |
| irreversibility | 4 | Degree to which results are irreversible |
| dataSensitivity | 3 | Sensitivity level of input/output data |
| autonomyModeRisk | 2 | Automation amplification risk from current runtime mode |
| tenantImpact | 2 | Scope of tenant/organization affected |
| blastRadius | 2 | Failure propagation radius |
| historicalFailureRate | 2 | Historical failure rate of similar actions |
| evidenceConfidence | 1 | Evidence sufficiency and judgment confidence |

### Risk Scoring Formula (§10.2 canonical)

```
risk_score = (
  impact*4 +
  irreversibility*4 +
  dataSensitivity*3 +
  autonomyModeRisk*2 +
  tenantImpact*2 +
  blastRadius*2 +
  historicalFailureRate*2 +
  evidenceConfidence*1
) / 20
```

### 4-Level Risk Mapping (§10.2 canonical)

| Level | Threshold | Handling Strategy |
|-------|-----------|-------------------|
| low | 0-0.25 | Execute directly |
| medium | 0.25-0.5 | Log only |
| high | 0.5-0.75 | Requires human approval |
| critical | 0.75-1.0 | break_glass approval |

### Configuration

- `config/risk/default.json` fully defines the 8 factors and thresholds
- RiskEvaluationEngine implements score calculation

## Consequences

Benefits:

- Quantified risk enables traceable decision-making
- Tiered handling strategy balances security and efficiency
- Configurable weights adapt to different business scenarios

Trade-offs:

- Risk assessment adds execution latency
- Historical data accumulation takes time

## Cross-references

- [ADR-005 Security Model](./005-security-model.md)
- [ADR-021 Inter-Plane Communication Contract](./021-inter-plane-communication-contract.md)

## Source Section

- `§10` Risk Control Architecture

## v4.3 ADR Remediation

- A-18: This ADR originally retained a 6-factor model with `stepTypeRisk / targetSystemRisk / dataClassRisk / blastRadius / priorFailureRate / confidence`. The root cause was that the risk ADR reused an early step-centric scoring draft and did not upgrade alongside the main architecture to incorporate autonomous mode, tenant impact scope, and evidence sufficiency into the unified risk assessment. Fix: The main text now converges to the 8-factor canonical model, with weights and formula synchronized accordingly.
