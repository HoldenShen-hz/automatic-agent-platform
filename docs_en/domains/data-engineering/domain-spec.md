# Data Engineering Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §75 |
| implementation_module | `src/domains/data-engineering/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | Data Platform Lead |

## Hard Constraints

- Destructive schema changes must require human approval.
- Data processing tasks must record input, output, lineage, and rollback strategy.
- Production data writes must go through RuntimeStateMachine and audit append.

## Acceptance Criteria

- GA must provide downstream impact analysis, schema migration approval, data lineage, and recovery drill evidence before release.