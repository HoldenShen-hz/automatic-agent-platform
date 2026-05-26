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
- Illegal content handling, appeals, and restoration must be auditable.
- High-risk content must not be released based solely on a single model conclusion.

## Acceptance Criteria

- Before GA, must provide CSAM reporting drill, multimodal review, manual review, and appeals process evidence.