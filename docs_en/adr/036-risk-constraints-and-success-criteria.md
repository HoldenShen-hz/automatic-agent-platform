# ADR-036 Risk, Constraints and Success Criteria

- Status: Accepted
- Decision Date: 2026-04-17

## Context

The platform needs a clear risk register, constraint enforcement mechanism, and success criteria to ensure project goals are trackable.

## Decision

### 28 Risk Register Items

- `config/risk/register.json` registers 28 design risks
- Coexists with execution period risk scores in `config/risk/default.json`
- Regular review and updates

### 32 Hard Constraints

| Constraint Type | Quantity | Code Enforcement Ratio |
|-----------------|----------|------------------------|
| High-risk approval | ~10 | ~60% |
| CAS optimistic lock | All | 100% |
| Sandbox | All | 100% |
| Delegation depth ≤3 | All | 100% |
| Others | ~10 | ~30% |

### Success Criteria Metrics

- `domains/roadmap/success-criteria-service.ts`
- Supports criterion registration
- Metric collection
- Phase success evaluation
- Gate decisions

## Consequences

Pros:

- Risk register improves risk visibility
- Code-level constraint enforcement improves compliance
- Success criteria metrics make delivery evaluable

Cons:

- Maintaining risk register requires ongoing investment
- Some constraints are difficult to codify

## Cross-references

- [ADR-026 Risk Control Architecture](./026-risk-control-architecture.md)
- [ADR-033 Phased Roadmap](./033-phased-roadmap.md)

## Source Section

- `§36` Risk, Constraints and Success Criteria
