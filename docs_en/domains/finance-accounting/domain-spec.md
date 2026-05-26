# Finance and Accounting Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §81 |
| implementation_module | `src/domains/finance-accounting/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Finance Lead / Internal Control Lead |

## Hard Constraints

- Segregation of duties must be enforced: creator must not equal approver.
- Accounting entries, reports, and payment actions must be auditable.
- Agents must not bypass SOX internal controls and manual approval.

## Acceptance Criteria

- Before GA, must provide SoD, audit sampling, payment approval, and financial statement consistency evidence.