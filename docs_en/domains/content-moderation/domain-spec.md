# Content Moderation and Safety Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §92 |
| implementation_module | `src/domains/content-moderation/index.ts` |
| domain_status | spec_ready |
| risk_level | critical |
| accountable_role | Content Safety Lead / Legal Compliance Lead |

## Hard Constraints

- CSAM detection must be reported within 1 minute.
- Illegal content disposal, appeals, and restoration must be auditable.
- High-risk content must not be released solely based on a single model's conclusion.

## Acceptance Criteria

- GA pre-release must provide evidence of CSAM reporting drills, multimodal review, manual review, and appeals workflows.
