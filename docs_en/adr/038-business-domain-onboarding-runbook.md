# ADR-038 Business Domain Onboarding Runbook

- Status: Accepted
- Decision Date: 2026-04-20

## Context

New business domain onboarding to the platform requires standardized processes and checklists to ensure onboarding quality.

## Decision

### 4-Phase Onboarding Process

| Phase | Description | Gate |
|-------|-------------|------|
| Gate 0 | Preparation | - |
| Gate 1 | Development Complete | ≥5 few-shot + eval ≥20 items |
| Gate 2 | Tests Passed | Coverage ≥80% |
| Gate 3 | Certification Passed | Prompt Injection 100% |
| Gate 4 | Canary Release | CANARY_5 → CANARY_20 → CANARY_50 → CANARY_100 |

### Gate 1 Detailed Requirements

- `minFewShotCount: 5` - At least 5 few-shot examples
- `minRegressionCaseCount: 20` - At least 20 regression test cases
- `DomainEvaluationGateService` implements gate checks

### Gate 2 Detailed Requirements

- `coveragePercent >= 80` - Test coverage ≥80%
- Dual checks by pack-lifecycle and pack-test-local

### Gate 3 Detailed Requirements

- `requirePromptInjectionCoverage: true` - Prompt Injection coverage 100%
- Regression set failing to fully pass directly blocks release

### Canary Release Configuration

```typescript
const CANARY_STAGES = [5, 20, 50, 100];  // Percentages
const DEFAULT_CANARY_PERCENT = 10;        // Default 10%
```

### Drift Detection Rollout

| Phase | Traffic |
|-------|---------|
| shadow | 0% |
| canary | 5% |
| partial | 25% |
| stable | 100% |

## Consequences

Positive:
- Standardized onboarding process ensures quality
- Gate mechanism prevents inferior domains from onboarding
- Progressive release reduces risk

Negative:
- Onboarding process is heavy
- Gate checks require tool support

Trade-offs:
- Quality vs. velocity
- Safety vs. effort

## Cross-References

- [ADR-037 Domain Modeling and Onboarding Architecture](./037-domain-modeling-and-onboarding.md)
- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)

## Source Sections

- `§38` Four-Phase Onboarding Runbook