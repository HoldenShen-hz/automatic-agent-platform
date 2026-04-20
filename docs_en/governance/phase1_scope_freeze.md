# Phase 1 Scope Freeze

## Purpose

This document freezes the Phase 1 (M0) implementation scope for the OAPEFLIR rollout described in [opeli_detailed_design.md](../reviews/opeli_detailed_design.md) and [reference_new_requierment.md](../reviews/reference_new_requierment.md).

## Frozen Scope

| Category | Phase 1 Included | Explicitly Excluded |
| --- | --- | --- |
| New directories | `src/core/agent-loop/`, `src/core/planning/`, `src/core/feedback/`, `src/core/improvement/rollout/` | `src/core/observe/`, `src/core/knowledge/`, `src/core/artifacts/`, `src/core/domain-registry/`, `src/plugins/`, `src/domains/` |
| New DTOs | `TaskSituation`, `UnifiedAssessment`, `Plan`, `PlanStep`, `DualChannelStepOutput`, `FeedbackSignal`, `ImprovementCandidate`, `RolloutRecord` | `DomainDescriptor`, `PluginManifest`, `KnowledgeEntry`, `ArtifactManifest` |
| Reused modules | `observability/*`, `orchestration/intake-router`, `orchestration/workflow-planner`, `runtime/*`, `evolution/*`, `events/*` | — |
| Modified modules | `AgentExecutor`-facing plan flow, `WorkflowPlanner`-as-input-source pattern, `AssessmentService`, `FeedbackCollector`, `Improve/Release` minimal path | `memory/*`, `providers/*`, `security/*` |
| Learn types | `failure_pattern`, `user_correction`, `recovery_playbook` | `routing_insight`, `provider_profile`, `skill_ranking`, `memory_value` |
| Release levels | `off`, `suggest`, `shadow` | `canary`, `staged`, `auto_rollback` |

## Guardrails

1. Phase 1 does not create a new `src/core/observe/` directory. Observe continues to reuse `src/core/observability/`.
2. Observe output is limited to factual task situation data. Risk and recommended actions are owned by Assess.
3. Plan is the only execution truth source. Execute does not read raw Observe output directly.
4. Learn/Improve failures must not block the runtime chain. They degrade to warnings or skipped actions.
5. Any PR that expands beyond this file requires a separate governance update and review.

## Acceptance

1. `src/core/agent-loop/types/` contains the Phase 1 runtime-validated DTO schemas.
2. The repository has a runnable O→A→P→E→F→L→I(shadow) proof path with tests.
3. Rollout logic is restricted to `off`, `suggest`, and `shadow`.
