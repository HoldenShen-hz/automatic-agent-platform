# Coding Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §76 |
| implementation_module | `src/domains/coding/index.ts` |
| domain_status | spec_ready |
| risk_level | medium |
| accountable_role | Engineering Lead |

## Hard Constraints

- Code changes must have diff, test, and rollback evidence.
- Executed commands must be constrained by sandbox, file root, and approval policies.
- Security-related changes must add denial-path regression.

## Acceptance Criteria

- GA pre-release must provide evidence of code review, test results, security scan, and change audit.
