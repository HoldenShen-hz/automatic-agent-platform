# User Operations Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §77 |
| implementation_module | `src/domains/user-operations/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | User Operations Lead |

## Hard Constraints

- All user touchpoints must enforce frequency limits.
- User profiles, segmentation, and message content must comply with data classification policies.
- High-risk touchpoints must support pause, recall, and audit.

## Acceptance Criteria

- Frequency control, unsubscribe, user segmentation audit, and experiment evaluation evidence must be provided before GA.
