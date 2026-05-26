# IT Operations SRE/DevOps Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §93 |
| implementation_module | `src/domains/it-operations/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | SRE Lead / On-Call Lead |

## Hard Constraints

- Auto-remediation blast radius is limited to single node or single service.
- Cross-service, cross-region, or production write operations require human approval.
- Diagnosis, remediation, rollback, and post-mortems must retain evidence.

## Acceptance Entry Criteria

- Prior to GA, evidence of blast-radius guard, MTTR metrics, rollback drills, and human approval must be provided.