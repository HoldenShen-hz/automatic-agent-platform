# IT Operations SRE/DevOps Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §93 |
| implementation_module | `src/domains/it-operations/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | SRE Lead / On-call Lead |

## Hard Constraints

- Auto-repair blast radius is limited to single node or single service.
- Cross-service, cross-region, or production write operations require human approval.
- Diagnosis, repair, rollback, and post-mortem must preserve evidence.

## Acceptance Criteria

- Blast-radius guard, MTTR metrics, rollback drill, and human approval evidence must be provided before GA.
