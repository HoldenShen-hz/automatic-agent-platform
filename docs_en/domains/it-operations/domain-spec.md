# IT Operations SRE/DevOps Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §93 |
| implementation_module | `src/domains/it-operations/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | SRE Lead / On-Call Lead |

## Hard Constraints

- Automatic fix blast radius is limited to a single node or single service.
- Cross-service, cross-region, or production write operations require human approval.
- Diagnostics, fixes, rollbacks, and postmortems must retain evidence.

## Acceptance Criteria

- Prior to GA, evidence of blast-radius guard, MTTR metrics, rollback drills, and human approval must be provided.