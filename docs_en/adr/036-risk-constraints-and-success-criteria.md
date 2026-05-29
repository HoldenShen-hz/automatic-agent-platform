# ADR-036 Risk, Constraints, and Success Criteria

- Status: Accepted
- Decision Date: 2026-04-17

## Background

The platform needs explicit risk registry, constraint enforcement mechanism, and success criteria to ensure project goals are traceable.

## Decision

### 28 Risk Registry Items

- `config/risk/register.json` registers 28 design risks
- Coexists with `config/risk/default.json` execution-period risk scoring
- Regular review and updates

### 32 Hard Constraints

| Constraint Type | Count | Code Enforcement Ratio |
|----------------|-------|----------------------|
| High-risk approval | ~10 | ~60% |
| CAS optimistic lock | All | 100% |
| Sandbox | All | 100% |
| Delegation depth <=3 | All | 100% |
| Other | ~10 | ~30% |

### Success Criteria Measurement

- `domains/roadmap/success-criteria-service.ts`
- Supports criterion registration
- Metric collection
- Phase success evaluation
- Gate decisions

## Consequences

Benefits:

- Risk registry improves risk visibility
- Code-level constraint enforcement improves compliance
- Success criteria measurement makes delivery evaluable

Costs:

- Maintaining risk registry requires continuous investment
- Some constraints are difficult to codify

## Cross-References

- [ADR-026 Risk Control Architecture](./026-risk-control-architecture.md)
- [ADR-033 Phased Roadmap](./033-phased-roadmap.md)

## Source Sections

- `§36` Risk, Constraints and Success Criteria