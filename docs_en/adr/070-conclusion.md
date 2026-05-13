# ADR-070 Conclusion

- Status: Accepted
- Decision Date: 2026-04-20

## Context

This ADR summarizes the key decisions and design principles of the platform's overall architecture.

## Core Architecture Decisions

### Five Planes + One Cross-Cutting

```
P1 Interface Plane → P2 Control Plane → P3 Orchestration Plane → P4 Execution Plane → P5 State & Evidence Plane
                        ↑
                   X1 Cross-Cutting Control Mesh
```

### Design Principles

| Principle | Description |
|-----------|-------------|
| Default Untrusted | Models, plugins, and external dependencies are all untrusted |
| Default Failure | Remote calls, workers, and releases may all fail |
| Default Convergence | Configuration changes and behavior drift require governance |
| Recoverability First, Automation Second | Recovery mechanisms take precedence over automated deployment |

### OAPEFLIR Cognitive Loop

```
Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release
```

### Evolution Roadmap

| Phase | Focus |
|-------|-------|
| Ring 1 | Core execution plane + stability baseline |
| Ring 2 | Governance, recovery, durability, and high-trust operations |
| Ring 3 | Business domains, ecosystem, and advanced intelligence capabilities |

## ADR Coverage

This ADR series covers the complete architecture from infrastructure to operational maturity, totaling 70 ADRs.

## Key Invariants

- Five-plane isolation is invariant
- `HarnessRuntime + RuntimeStateMachine` truth authority is invariant
- OAPEFLIR as a cognitive projection only is invariant
- Constitutional principles are invariant

## v4.3 ADR Remediation

- A-63: This ADR originally wrote "Phase 1-7" together with "OAPEFLIR loop invariance" as a primary architectural invariant. The root cause was that the summary ADR consolidated historical roadmap and cognitive model, without distinguishing between roadmap and runtime authority. Fix: The main text now uses the ring perspective, and runtime invariants are explicitly scoped to `HarnessRuntime + RuntimeStateMachine`.

## Follow-up Work

- Continuously improve the ADR index
- Supplement missing scenarios
- Optimize decisions based on implementation experience

## Source Section

- `§70` Conclusion