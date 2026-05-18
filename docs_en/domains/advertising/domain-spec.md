# Advertising Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §73 |
| implementation_module | `src/domains/advertising/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | Advertising Operations Lead |

## Hard Constraints

- Daily/hourly budgets must be protected by platform hard limits.
- Bid and audience changes must record reason, budget impact, and rollback strategy.
- Low-quality traffic, abnormal spend, and compliance risks must trigger degradation or human review.

## Acceptance Criteria

- Budget hard limits, ROAS evaluation, delivery audit, and abnormal spend alert evidence must be provided before GA.
