# Game Publishing Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §86 |
| implementation_module | `src/domains/game-publishing/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | Publishing Lead / Compliance Lead |

## Hard Constraints

- Each target platform must independently pass content, age rating, payment, and privacy compliance checks.
- Reusing review results across platforms as final conclusions is prohibited.
- Publishing failures, rectifications, and re-reviews must retain evidence.

## Acceptance Criteria

- Prior to GA, evidence of platform-independent review, age rating, privacy compliance, and publishing records must be provided.