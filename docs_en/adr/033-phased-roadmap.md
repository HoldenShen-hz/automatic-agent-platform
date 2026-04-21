# ADR-033 Phased Roadmap

- Status: Accepted
- Decision Date: 2026-04-17

## Context

Platform evolution requires a clear phased roadmap with success gates to ensure systematic delivery and architectural integrity across multiple phases.

## Decision

### 7-Phase Roadmap

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| Phase 1 | Core runtime | Task execution, basic workflow |
| Phase 2 | Platform foundation | API, auth, storage |
| Phase 3 | Intelligence layer | OAPEFLIR, learning |
| Phase 4 | Enterprise features | Multi-tenant, compliance |
| Phase 5 | Scale ecosystem | Marketplace, multi-region |
| Phase 6 | Ops maturity | Explainability, DR |
| Phase 7 | Future innovations | TBD |

### Phase Gate Criteria

- Each phase has specific success criteria
- Criteria registered in `domains/roadmap/success-criteria-service.ts`
- Gateway evaluation via `evaluatePhaseAdvance()`
- Automatic blocking of advancement if criteria not met

### Roadmap Tracking

- `domains/roadmap/roadmap-service.ts` (124 lines)
- Phase tracking and status management
- Completion records

## Consequences

Positive:
- Clear roadmap provides direction and alignment
- Phase gates ensure quality before advancement
- Tracking enables progress visibility

Negative:
- Roadmap requires maintenance and updates
- Phase gates may slow down delivery

Trade-offs:
- Structure vs. agility
- Quality vs. velocity

## Cross-References

- [ADR-034 ADR Freeze Recommendation](./034-adr-freeze-recommendation.md)
- [ADR-036 Risk Constraints and Success Criteria](./036-risk-constraints-and-success-criteria.md)

## Source Sections

- `§33` Roadmap and Phase Planning