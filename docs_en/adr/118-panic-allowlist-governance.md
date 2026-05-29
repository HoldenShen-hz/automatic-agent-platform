# ADR-118 Panic Allowlist Governance

- Status: Accepted

## Background

Panic mode allowList has strong break-glass nature, but previously lacked authoritative governance description.

## Decision

- AllowList is only used for break-glass scenarios, not as a regular release mechanism.
- AllowList hit does not equal unlimited permission; audit, rate control, and high-risk action restrictions must still be retained.
- AllowList member addition, change, removal must go through governance approval and audit trail.
- Panic allowList and execution plane admission control must maintain consistent口径; allowing on one side while having no audit on the other is not allowed.

## Results

- "Privileged bypass" converges to a governed emergency capability, not an implicit backdoor.

## Related Implementation

- `src/ops-maturity/emergency/platform-panic-service.ts`