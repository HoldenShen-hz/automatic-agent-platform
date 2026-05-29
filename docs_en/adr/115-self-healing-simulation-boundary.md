# ADR-115 Self Healing Simulation Boundary

- Status: Accepted

## Background
The current self-healing service provides a deterministic simulation baseline that is testable inside the repository rather than an external real infrastructure orchestrator.

## Decision
- Self-healing execution results may use deterministic outcome model, but must:
  - Be explainable
  - Be constrained by policy
  - Link with component health status, retry budget, cooldown period
- When component has exceeded maximum failure count, automatically enter fail-closed / cooldown, instead of continuously blind retry.
- Documentation must clearly state this is a simulation baseline layer, real executor can be replaced later.

## Result
- Self-healing logic is no longer a "black box success rate".
- Both ops and tests can judge expected behavior based on unified rules.

## Related Implementation
- `src/ops-maturity/platform-ops-agent/self-healing-service.ts`
