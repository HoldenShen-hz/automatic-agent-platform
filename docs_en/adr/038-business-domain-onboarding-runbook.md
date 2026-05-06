# ADR-038 Business Domain Onboarding Runbook

- Status: Accepted
- Decision Date: 2026-04-20

## Context

New business domains onboarding to the platform require standardized processes and checklists to ensure onboarding quality.

## Decision

### 4-Phase Onboarding Process

| Phase | Description | Gate |
|-------|-------------|------|
| Gate 0 | Preparation phase | - |
| Gate 1 | Development complete | ≥5 few-shot + eval ≥20 items |
| Gate 2 | Testing passed | Coverage ≥80% |
| Gate 3 | Certification passed | Prompt Injection 100% |
| Gate 4 | Canary release | canary_5 → partial_25 → 50 → 75 → stable |

### Gate 1 Detailed Requirements

- `minFewShotCount: 5` - At least 5 few-shot examples
- `minRegressionCaseCount: 20` - At least 20 regression test cases
- `DomainEvaluationGateService` implements gate checks

### Gate 2 Detailed Requirements

- `coveragePercent >= 80` - Test coverage ≥80%
- Dual checks by pack-lifecycle and pack-test-local

### Gate 3 Detailed Requirements

- `requirePromptInjectionCoverage: true` - Prompt Injection coverage 100%
- Release is directly blocked when regression suite is not fully passed

### Canary Release Configuration

Reference canonical rollout states from [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md):

| Phase | Traffic |
|-------|---------|
| canary_5 | 5% |
| partial_25 | 25% |
| 50 | 50% |
| 75 | 75% |
| stable | 100% |

## Consequences

Pros:

- Standardized onboarding process ensures quality
- Gate mechanism prevents inferior domains from onboarding
- Progressive release reduces risk

Cons:

- Onboarding process is relatively heavy
- Gate checks require tool support

## Cross-references

- [ADR-037 Business Domain Modeling and Onboarding Architecture](./037-domain-modeling-and-onboarding.md)
- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)

## Source Section

- `§38` Business Domain Onboarding Runbook

## v4.3 ADR Remediation

- R6-49: Fixed canary stage definition conflict. ADR-038 originally defined CANARY_5/20/50/100 conflicting with ADR-075 canonical rollout states (canary_5/partial_25/50/75/stable). Fix: Unified to reference ADR-075's canonical definition.
