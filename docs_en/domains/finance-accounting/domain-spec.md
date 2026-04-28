# Finance and Accounting Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §81 |
| implementation_module | `src/domains/finance-accounting/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Finance Lead / Internal Control Lead |

## Hard Constraints

- Segregation of duties must be enforced: creators cannot be approvers.
- Accounting entries, reports, and payment actions must be auditable.
- Agents must not bypass SOX controls and human approval.

## Acceptance Criteria

- Prior to GA, evidence must be provided for SoD, audit sampling, payment approval, and financial statement consistency.