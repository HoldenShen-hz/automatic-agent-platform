# ADR-026 Risk Control Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Agents as high-risk automated execution units must undergo risk assessment before and after execution to prevent dangerous operations from causing business losses.

## Decision

### 6-Factor Weighted Scoring Algorithm

| Factor | Weight | Description |
|--------|--------|-------------|
| stepTypeRisk | 3 | Step type risk coefficient |
| targetSystemRisk | 4 | Target system risk coefficient |
| dataClassRisk | 3 | Data class risk coefficient |
| blastRadius | 2 | Impact scope coefficient |
| priorFailureRate | 2 | Historical failure rate |
| confidence | 1 | Model confidence |

### Risk Score Formula

```
risk_score = (stepTypeRisk*3 + targetSystemRisk*4 + dataClassRisk*3 + blastRadius*2 + priorFailureRate*2 + confidence*1) / 13
```

### 4-Level Risk Mapping

| Level | Threshold | Handling Strategy |
|-------|-----------|-------------------|
| low | 0-0.25 | Execute directly |
| medium | 0.25-0.5 | Log only |
| high | 0.5-0.75 | Requires human approval |
| critical | 0.75-1.0 | break_glass approval |

### Configuration

- `config/risk/default.json` fully defines 6 factors and thresholds
- RiskEvaluationEngine implements score calculation

## Consequences

Positive:
- Quantified risk enables traceable decisions
- Tiered handling strategy balances security and efficiency
- Configurable weights adapt to different business scenarios

Negative:
- Risk assessment adds execution latency
- Historical data accumulation takes time

Trade-offs:
- Security vs. latency
- Flexibility vs. consistency

## Cross-References

- [ADR-005 Security Model](./005-security-model.md)
- [ADR-021 Inter-Plane Communication Contract](./021-inter-plane-communication-contract.md)

## Source Sections

- `§10` Risk Control Architecture