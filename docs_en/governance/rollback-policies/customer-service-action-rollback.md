# Customer Service Action Rollback

- Scope: `refund.*`, `ticket.*`, `order.read_order`
- Preconditions: retain the policy lookup receipt, entitlement evidence, and operator approval trace.
- Rollback actions: revoke drafts, withdraw assignments, submit a compensation note, and escalate to manual review when required.
- Owner: `enterprise-ops-owner`
