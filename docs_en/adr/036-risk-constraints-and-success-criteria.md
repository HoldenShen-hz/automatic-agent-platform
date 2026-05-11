# ADR-036 Risk, Constraints, and Success Criteria

- Status: Accepted
- Decision Date: 2026-04-17

## Context

The platform requires a clear risk register, constraint enforcement mechanism, and success criteria to ensure project objectives are trackable.

## Decision

### 28 Risk Register Items

- `config/risk/register.json` registers 28 design risks
- Coexists with runtime risk scores in `config/risk/default.json`
- Regularly reviewed and updated

### 32 Hard Constraints

| Constraint Type | Constraint Count | Code Enforcement Ratio |
|-----------------|------------------|-----------------------|
| High-risk approval | ~10 | ~60% |
| CAS optimistic lock | All | 100% |
| Sandbox | All | 100% |
| Delegation depth ≤3 | All | 100% |
| Others | ~10 | ~30% |

### Success Criteria Metrics

- `domains/roadmap/success-criteria-service.ts`
- Supports criterion registration
- Metrics collection
- Phase success evaluation
- Gate decision-making

## Consequences

Benefits:

- Risk register improves risk visibility
- Code-level constraint enforcement improves compliance
- Success criteria metrics make delivery assessable

Costs:

- Maintaining risk register requires ongoing investment
- Some constraints are difficult to codify

## Cross References

- [ADR-026 Risk Control Architecture](./026-risk-control-architecture.md)
- [ADR-033 Phased Roadmap](./033-phased-roadmap.md)

## Source Section

- `§36` Risk, Constraints, and Success Criteria