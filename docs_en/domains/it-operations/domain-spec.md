# IT Operations SRE/DevOps Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §93 |
| implementation_module | `src/domains/it-operations/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | SRE Lead / On-call Lead |

## Hard Constraints

- Auto-repair blast radius is limited to a single node or single service.
- Cross-service, cross-region, or production write operations require human approval.
- Diagnosis, repair, rollback, and review must preserve evidence.

## Acceptance Criteria

- Before GA, evidence must be provided for: blast-radius guard, MTTR metrics, rollback drill, and human approval.
