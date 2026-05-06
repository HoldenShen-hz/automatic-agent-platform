# ADR-034 ADR Freeze Recommendation

- Status: Accepted
- Decision Date: 2026-04-17

## Context

As the platform architecture evolves, the number of ADRs continues to grow. To prevent ADR documentation from diverging from actual implementation, an ADR freeze mechanism needs to be established to ensure frozen ADRs are not arbitrarily changed, ensuring stability and traceability of architectural decisions.

## Decision

### ADR Version Number Allocation Strategy

ADR numbers are allocated by version batch, without mandatory filling of historical gaps:

| Version | ADR Number Range | Description |
|---------|------------------|-------------|
| v1.2 | 001-019 | Initial architecture decisions |
| v2.0 | 021-024 | Platform layering and storage architecture |
| v2.1 | 025-033 | Security, LLM, and delegation related |
| v2.2 | 037-040 | Business domain modeling |
| v2.3 | 041-046 | Intelligent interaction and organization governance |
| v2.4 | 047-052 | Organization governance and scaling |
| v2.5 | 053-058 | Scaling ecosystem and integration |
| v2.6 | 059-069 | Operational maturity and self-operations |

Number gaps (such as 020, 034, 045, 071, 074, 076-077) are reserved for special purposes or future additions.

### ADR Status Flow

```
Proposed → Accepted → Superseded
                ↓
           Deprecated
```

- **Draft**: Under discussion, decision not yet made
- **Proposed**: Submitted, awaiting approval
- **Accepted**: Accepted and implemented
- **Superseded**: Superseded by a new ADR
- **Deprecated**: Obsolete

### ADR Freeze Rules

1. **ADRs in Accepted status cannot be deleted**, they can only be marked as Superseded or Deprecated
2. **ADR changes must create a new version or new ADR**, direct modification of frozen content is not allowed
3. **Superseded ADRs must contain cross-references** pointing to the ADR that replaces them
4. **Each ADR must include a source section** linking to the specific section number in platform-architecture.md

### v4.3 Migration Exception Clause

During the v4.3 architecture migration period, the ADR Remediation process requires direct modification of frozen ADRs to correct conflicts with the canonical architecture.

This exception clause applies only to the v4.3 migration window; standard freeze rules resume after migration completes.

ADRs modified during v4.3 migration must be recorded in the "v4.3 ADR Remediation" section:
- Modification reason (root cause analysis)
- Specific fix content
- Alignment confirmation with canonical architecture

### Required ADR Fields

Each ADR must include:

- Title
- Status
- Decision Date
- Context
- Decision
- Consequences
- Cross-references (optional)
- Source Section (optional)

## Consequences

Pros:

- ADR numbers have a clear historical lineage, facilitating tracing architectural decision evolution
- Freeze mechanism prevents validated decisions from being arbitrarily overturned
- Status flow is clear, distinguishing "under discussion" from "decided"

Cons:

- ADR numbers may be non-consecutive
- Superseded ADRs still need to be retained, increasing documentation maintenance costs

## Cross-references

- [ADR-033 Phased Roadmap](./033-phased-roadmap.md)
- [ADR-035 Recommended Code Directory Structure](./035-recommended-code-directory-structure.md)

## Source Section

- `§34` ADR Freeze Recommendation
