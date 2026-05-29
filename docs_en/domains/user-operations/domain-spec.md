# User Operations Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §77 |
| implementation_module | `src/domains/user-operations/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | User Operations Lead |

## Hard Constraints

- All user outreach must enforce frequency limits.
- Profiling, segmentation, and message content must comply with data classification policies.
- High-risk outreach must support pause, recall, and audit.

## Acceptance Criteria

- GA must provide frequency control, unsubscribe, user segmentation audit, and experiment evaluation evidence before release.