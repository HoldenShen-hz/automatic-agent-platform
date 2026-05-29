# ADR-034 ADR Freeze Recommendation

- Status: Historical Context (ADR governance policy carried by current ADR index + docs sync guard)
- Decision Date: 2026-04-17

## Background

As platform architecture evolves, ADR count continues to grow. To prevent ADR documentation from diverging from actual implementation, an ADR freezing mechanism needs to be established to ensure frozen ADRs are not arbitrarily changed, ensuring stability and traceability of architectural decisions.

## Decision

### ADR Version Number Allocation Strategy

ADR numbers are allocated by version batch, not forced to fill historical gaps:

| Version | ADR Number Range | Description |
|---------|-----------------|-------------|
| v1.2 | 001-019 | Initial architectural decisions |
| v2.0 | 021-024 | Platform layering and storage architecture |
| v2.1 | 025-033 | Security, LLM, delegation related |
| v2.2 | 037-040 | Business domain modeling |
| v2.3 | 041-046 | Intelligent interaction and organizational governance |
| v2.4 | 047-052 | Organizational governance and scaling |
| v2.5 | 053-058 | Scaled ecosystem and integration |
| v2.6 | 059-069 | Operations maturity and self-operations |

Number gaps (like 020, 034, 045, 071, 074, 076-077) reserved for special purposes or subsequent supplements.

### ADR Status Flow

```
Proposed → Accepted → Superseded
                ↓
           Deprecated
```

- **Draft**: Under discussion, decision not yet made
- **Proposed**: Proposed, waiting for approval
- **Accepted**: Accepted and implemented
- **Superseded**: Superseded by new ADR
- **Deprecated**: Deprecated

### ADR Freeze Rules

1. **ADRs in Accepted status cannot be deleted**, can only be marked as Superseded or Deprecated
2. **ADR changes must create new version or new ADR**, direct modification of frozen content not allowed
3. **Superseded ADRs must contain cross-references** pointing to the ADR that supersedes it
4. **Each ADR must contain source sections** linking to specific section numbers in platform-architecture.md

### v4.3 Remediation Exception Clause

> Note: v4.3 architecture upgrade requires direct modifications to 30+ ADRs to keep documentation synchronized with implementation. By authoritative decision, the following remediation scenarios are granted exception permits, not needing to follow "no direct modification" rules:

**Exception Scenarios**:
- Cross-ADR synchronized modifications during v4.3 main architecture version upgrades
- ADR terminology unified corrections due to Five-Plane X1 Architecture introduction
- Routing/execution ADR updates due to HarnessRuntime becoming the sole execution runtime

**Permit Conditions**:
- Must include `## v4.3 ADR Remediation` section
- Must record root cause and fix description
- Must explicitly list all modified original ADR entries (like A-18, A-21, etc.)
- Multiple ADR modifications within the same batch can share one remediation section

**Process Requirements**:
- Remediation modifications still need review but can use fast-track approval
- All remediation modifications must be merged into main branch
- Documentation administrator quarterly audits remediation compliance

### ADR Required Fields

Each ADR must contain:

- Title
- Status
- Decision Date
- Background (Context)
- Decision
- Consequences
- Cross-references (optional)
- Source Section (optional)

## Consequences

Benefits:

- ADR numbers have clear historical脉络 for tracing architectural decision evolution
- Freeze mechanism prevents validated decisions from being arbitrarily overturned
- Status flow is clear, distinguishing "under discussion" from "decided"

Costs:

- ADR numbers may be discontinuous
- Superseded ADRs still need retention, increasing documentation maintenance cost

## Cross-References

- [ADR-033 Phased Roadmap](./033-phased-roadmap.md)
- [ADR-035 Recommended Code Directory Structure](./035-recommended-code-directory-structure.md)

## Source Sections

- `§34` ADR Freeze Recommendation