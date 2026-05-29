# ADR-115 Self Healing Simulation Boundary

- Status: Accepted

## Background

Current self-healing service provides an in-repository testable deterministic simulation baseline, not an external real infrastructure orchestrator.

## Decision

- Self-healing execution results are allowed to use deterministic outcome model, but must:
  - Have explainable behavior
  - Be constrained by policy
  - Link with component health status, retry budget, cooldown period
- When component has exceeded maximum failure count, automatically enter fail-closed / cooldown, not continuously blind retry.
- Documentation must clarify this is a simulation baseline layer; real executor can be replaced later.

## Results

- Self-healing logic is no longer a "black box success rate".
- Both operations and testing can judge expected behavior based on unified rules.

## Related Implementation

- `src/ops-maturity/platform-ops-agent/self-healing-service.ts`