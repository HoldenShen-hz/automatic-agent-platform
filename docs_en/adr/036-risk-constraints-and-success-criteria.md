# ADR-036 Risk, Constraints, and Success Criteria

- Status: Accepted
- Decision Date: 2026-04-17

## Context

The platform needs clear risk registry, constraint enforcement mechanisms, and success criteria to ensure project goals are trackable.

## Decision

### 28 Risk Registry

- `config/risk/register.json` registers 28 design risks
- Coexists with runtime risk scoring in `config/risk/default.json`
- Regularly reviewed and updated

### 32 Hard Constraints

| Constraint Type | Count | Code Enforcement Ratio |
|-----------------|-------|----------------------|
| High-risk approval | ~10 | ~60% |
| CAS optimistic lock | All | 100% |
| Sandbox | All | 100% |
| Delegation depth ≤3 | All | 100% |
| Others | ~10 | ~30% |

### Success Criteria Measurement

- `domains/roadmap/success-criteria-service.ts`
- Supports criterion registration
- Metric collection
- Phase success evaluation
- Gateway decisions

## Consequences

Positive:
- Risk registry improves risk visibility
- Code-level constraint enforcement improves compliance
- Success criteria measurement enables evaluable delivery

Negative:
- Risk registry maintenance requires continuous investment
- Some constraints are difficult to code

Trade-offs:
- Visibility vs. effort
- Compliance vs. flexibility

## Cross-References

- [ADR-026 Risk Control Architecture](./026-risk-control-architecture.md)
- [ADR-033 Phased Roadmap](./033-phased-roadmap.md)

## Source Sections

- `§36` Risk, Constraints, and Success Criteria