# ADR-034 ADR Freeze Recommendation

- Status: Accepted
- Decision Date: 2026-04-17

## Context

As the platform architecture evolves, the ADR population continues to grow. To prevent ADR documents from diverging from actual implementation, an ADR freeze mechanism is needed to ensure that frozen ADRs are not arbitrarily changed, protecting architecture decision stability and traceability.

## Decision

### ADR Version Number Allocation Strategy

ADR numbers are allocated by version batches, without forcing historical gaps to be filled:

| Version | ADR Number Range | Description |
|---------|------------------|-------------|
| v1.2 | 001-019 | Initial architecture decisions |
| v2.0 | 021-024 | Platform layering and storage architecture |
| v2.1 | 025-033 | Security, LLM, delegation related |
| v2.2 | 037-040 | Business domain modeling |
| v2.3 | 041-046 | Intelligent interaction and organization governance |
| v2.4 | 047-052 | Organization governance and scaling |
| v2.5 | 053-058 | Scaling ecosystem and integration |
| v2.6 | 059-069 | Ops maturity and self-operations |

Number gaps (such as 020, 034, 045, 071, 074, 076-077) are reserved for special purposes or future supplements.

### ADR Status Flow

```
Proposed → Accepted → Superseded
                ↓
           Deprecated
```

- **Draft**: Under discussion, decision not yet made
- **Proposed**: Submitted, waiting for approval
- **Accepted**: Accepted and implemented
- **Superseded**: Superseded by new ADR
- **Deprecated**: Deprecated

### ADR Freeze Rules

1. **ADRs in Accepted status cannot be deleted**, can only be marked Superseded or Deprecated
2. **ADR changes must create new versions or new ADRs**, direct modification of frozen content is not allowed
3. **Superseded ADRs must contain cross-references** to the ADR that supersedes them
4. **Each ADR must contain source sections** linking to specific section numbers in platform-architecture.md

### v4.3 Remediation Exception Clause

> Note: v4.3 architecture upgrade requires direct modification of 30+ ADRs to keep documentation in sync with implementation. By authoritative decision, the following remediation scenarios are granted exception permission and do not need to follow the "no direct modification" rule:

**Exception Scenarios**:
- Cross-ADR synchronized modifications during v4.3 main architecture version upgrades
- ADR terminology unified corrections due to the introduction of Five-Plane X1 architecture
- Routing/execution ADR updates due to HarnessRuntime becoming the sole execution runtime

**Permission Conditions**:
- Must include `## v4.3 ADR Remediation` section
- Must record root cause and fix description
- Must explicitly list all original ADR entries modified (such as A-18, A-21, etc.)
- Multiple ADR modifications within the same batch may share one remediation section

**Process Requirements**:
- Remediation modifications still require review but can use fast-track approval
- All remediation modifications must be merged into main branch
- Document administrators audit remediation compliance quarterly

### Required ADR Fields

Each ADR must contain:

- Title
- Status
- Decision Date
- Context
- Decision
- Consequences
- Cross-references (optional)
- Source Sections (optional)

## Consequences

Benefits:

- ADR numbering has clear historical lineage, facilitating traceability of architecture decision evolution
- Freeze mechanism prevents validated decisions from being arbitrarily overturned
- Status flow clearly distinguishes "under discussion" and "determined"

Costs:

- ADR numbers may be skip-based, non-consecutive
- Superseded ADRs still need to be retained, increasing documentation maintenance cost

## Cross References

- [ADR-033 Phased Roadmap](./033-phased-roadmap.md)
- [ADR-035 Recommended Code Directory Structure](./035-recommended-code-directory-structure.md)

## Source Section

- `§34` ADR Freeze Recommendation