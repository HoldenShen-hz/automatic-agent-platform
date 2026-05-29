# ADR-038 Business Domain Onboarding Runbook

- Status: Accepted
- Decision Date: 2026-04-20

## Background

New business domains onboarding to the platform require standardized processes and checklists to ensure onboarding quality.

## Decision

### 4-Phase Onboarding Process

| Phase | Description | Gate |
|-------|-------------|------|
| Gate 0 | Preparation phase | - |
| Gate 1 | Development complete | >=5 few-shot + eval >=20 items |
| Gate 2 | Testing passed | Coverage >=80% |
| Gate 3 | Authentication passed | Prompt Injection 100% |
| Gate 4 | Canary release | canary_5 -> partial_25 -> stable_75 -> stable_100 |

### Gate 1 Detailed Requirements

- `minFewShotCount: 5` - At least 5 few-shot examples
- `minRegressionCaseCount: 20` - At least 20 regression test cases
- `DomainEvaluationGateService` implements gate checking

### Gate 2 Detailed Requirements

- `coveragePercent >= 80` - Test coverage >=80%
- pack-lifecycle and pack-test-local dual checks

### Gate 3 Detailed Requirements

- `requirePromptInjectionCoverage: true` - Prompt Injection coverage 100%
- Regression suite blocking release when not fully passed

### Canary Release Configuration

```typescript
const CANARY_STAGES = [5, 25, 75, 100];  // Percentages
const DEFAULT_CANARY_PERCENT = 5;          // Default 5%
```

### Drift Detection Rollout

| Phase | Traffic |
|-------|---------|
| shadow | 0% |
| canary | 5% |
| partial | 25% |
| stable | 100% |

## Consequences

Benefits:

- Standardized onboarding process ensures quality
- Gate mechanism prevents inferior domains from onboarding
- Progressive release reduces risk

Costs:

- Onboarding process is heavyweight
- Gate checking requires tool support

## Cross-References

- [ADR-037 Domain Modeling and Onboarding Architecture](./037-domain-modeling-and-onboarding.md)
- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)

## Source Sections

- `§38` Business Domain Onboarding Runbook