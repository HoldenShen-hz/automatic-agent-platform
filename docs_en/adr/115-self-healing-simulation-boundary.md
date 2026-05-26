# ADR-115 Self Healing Simulation Boundary

## Status
Accepted

## Background
The current self-healing service provides a deterministic simulation baseline testable within the repository, not an external real infrastructure orchestrator.

## Decision
- Self-healing execution results may adopt a deterministic outcome model, but must:
  - Have explainable behavior
  - Be constrained by policy
  - Be linked with component health status, retry budget, and cooldown period
- When a component has exceeded maximum failure count, automatically enter fail-closed / cooldown, rather than continuously blind retry.
- Documentation must clearly state this is a simulation baseline layer; real executor may be replaced later.

## Result
- Self-healing logic is no longer a "black box success rate".
- Both operations and testing can base expected behavior on unified rules.

## Related Implementation
- `src/ops-maturity/platform-ops-agent/self-healing-service.ts`