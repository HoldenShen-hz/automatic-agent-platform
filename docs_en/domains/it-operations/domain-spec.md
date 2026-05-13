# IT Operations SRE/DevOps Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §93 |
| implementation_module | `src/domains/it-operations/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | SRE Lead / On-call Lead |

## Hard Constraints

- Automatic fix blast radius limited to single node or single service.
- Cross-service, cross-region, or production write operations require human approval.
- Diagnosis, fix, rollback, and post-mortem must retain evidence.

## Acceptance Criteria

- Prior to GA, must provide blast-radius guard, MTTR metrics, rollback drill, and human approval evidence.