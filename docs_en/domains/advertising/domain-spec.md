# Advertising Domain Spec

| Field | Value |
| --- | --- |
| architecture_section | §73 |
| implementation_module | `src/domains/advertising/index.ts` |
| domain_status | spec_ready |
| risk_level | high |
| accountable_role | Advertising Lead |

## Hard Constraints

- Daily/hourly budgets must be protected by platform hard limits.
- Bidding and audience changes must record reason, budget impact, and rollback strategy.
- Low-quality traffic, abnormal consumption, and compliance risks must trigger degradation or manual review.

## Acceptance Criteria

- GA pre-release must provide evidence of budget hard limits, ROAS evaluation, campaign audit, and abnormal consumption alerts.
