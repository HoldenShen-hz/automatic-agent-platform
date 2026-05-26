# ADR-118 Panic Allowlist Governance

## Status
Accepted

## Background
The panic mode allowList has strong break-glass characteristics, but previously had no authoritative governance documentation.

## Decision
- allowList is only used for break-glass scenarios, not as a regular pass-through mechanism.
- allowList hit does not equal unlimited permissions; audit, rate control, and high-risk action limits must still be retained.
- allowList member addition, modification, and removal must go through governance approval and audit trail.
- panic allowList must maintain consistent口径 with execution plane admission control; one side pass-through while the other has no audit is not allowed.

## Result
- Converges "privileged bypass" to a governed emergency capability, rather than an implicit backdoor.

## Related Implementation
- `src/ops-maturity/emergency/platform-panic-service.ts`