# ADR-118 Panic Allowlist Governance

- Status: Accepted

## Background
Panic mode allowList has strong break-glass nature, but previously lacked authoritative governance explanation.

## Decision
- allowList only used for break-glass scenarios, not as regular release mechanism.
- allowList hit does not equal unlimited permissions; still must retain audit, rate control, and high-risk action restrictions.
- allowList member addition, change, and removal must go through governance approval and leave an audit trail.
- Panic allowList and execution-plane admission control must follow the same rule set; one side cannot allow while the other side skips audit.

## Result
- Converge "privileged bypass" to governed emergency capability, not implicit backdoor.

## Related Implementation
- `src/ops-maturity/emergency/platform-panic-service.ts`
