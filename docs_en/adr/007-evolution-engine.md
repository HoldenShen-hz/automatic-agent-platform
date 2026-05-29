# ADR-007 Evolution Engine

- Status: Partially Superseded by ADR-075
- Decision Date: 2026-04-02
- Partially superseded: ADR-075's six-level release model has replaced the "Release only allows off/suggest/shadow three tiers" description

## Background

Static prompts, static models, and static strategies gradually become invalid as task distribution changes. The platform wants to form a "execute, evaluate, optimize, rollback" closed loop, but cannot let the system become uncontrollable due to self-modification.

## Decision

Drive evolution via OAPEFLIR secondary chain `Feedback → Learn → Improve → Release`, with deterministic guardrail controlling entry to production:

- Supervisor/observability continues responsible for lifecycle management, real-time monitoring, health checks, and metric collection.
- Feedback Hub is responsible for normalizing execution signals into structured `FeedbackSignal`.
- Learn Hub only allows evidence-backed learning objects to enter subsequent stages, explicitly maintaining `promotionStatus`.
- Improve Hub only receives `validated/promoted` LearningObjects.
- Release in current phase1-4 only allows `off/suggest/shadow` three tiers, does not directly open canary/staged.
- Any change must be rollbackable, auditable, canary-deployable, and pausable.

## Supervisor Role

Supervisor is not just a monitor, but also undertakes governance responsibilities:

- Manage Agent lifecycle.
- Track heartbeats, context usage, tool calls, and resource usage.
- Evaluate success rate, cost, latency, and quality signals.
- When necessary, restart, pause, escalate, or terminate abnormal Agents.

## Evolution Dimensions

8 dimensions can be summarized as:

1. Prompt optimization.
2. Compute budget adaptive.
3. Tool call optimization and Skill precipitation.
4. Capability profiling and reflective memory.
5. Pre-check failure analysis.
6. Reflexion/Self-Refine/experience replay.
7. Reasoning strategy adaptive selection.
8. Multi-Agent collaboration optimization and evaluation function evolution.

## MVP Scope

Current phase1-4 actual MVP closure includes:

- Feedback: Deduplication, correlation, recovery path identification.
- Learn: Only supports `failure_pattern`, `user_correction`, `recovery_playbook` three types of learning objects.
- Improve: Only allows evidence-backed and validated LearningObject into candidates.
- Release: Only supports `off/suggest/shadow`.

Other heavier evolution capabilities like multi-stage canary, auto-rollback, more learning types, continue to be deferred.

## Security Principles

Evolution must adhere to ironclad rules:

- No degradation: New strategy must prove not inferior to current state before going live.
- Reversible: Every change requires snapshots and rollback points.
- Controllable: Must be able to pause with one click.
- Auditable: All changes written to evolution log.
- Canary-deployable: First verify on small traffic, then gradually increase.
- No privilege escalation: Model can only propose LearningObject/Candidate, cannot directly advance `promotionStatus`, `candidate.status`, or `rollout.status`.

## Alerts and Observability

Supervisor/observability should alert or notify for the following events:

- Context approaching threshold.
- Agent suspected of hanging.
- Agent abnormal termination.
- Evolution event success or rollback.
- Cost alert.
- OAPEFLIR stage timeline anomaly.
- Learn validation failure or rollout guardrail blocking.

## Results

Benefits:

- Platform can iterate based on real runtime data, not just human empirical parameter tuning.
- Bring optimization process into unified governance and audit.
- Transform evolution from "mysterious parameter tuning" into a constrained engineering process.
- Make boundary between main chain and secondary chain clearer, reducing risk of "execution logic quietly self-modifying".

Costs:

- Metric quality directly determines optimization quality.
- Without offline backtesting, canary, and rollback, evolution becomes a new instability source.
- Prematurely introducing all 8 dimensions significantly increases system complexity.

## Current Implementation Alignment

As of current phase1-4 delivery, aligned parts include:

- `FeedbackCollector` + `SignalPreprocessor` have formed structured learning input.
- `LearningObjectValidator` has made evidence and `promotionStatus` a hard boundary.
- `PolicyRolloutService` + `GuardrailEvaluator` have pulled rollout release from model suggestion back to system code.
- `OapeflirLoopService` has persisted stage timeline perspective, facilitating audit of main/secondary chain closed loop.

## Cross-References

- [ADR-003 Six-Layer Memory with KV Cache Fixed Prefix](./003-memory-six-layers.md)
- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-008 Cost Model](./008-cost-model.md)

## Source Sections

- `OAPEFLIR §7`
- `OAPEFLIR §8`
- `OAPEFLIR §9`
- `OAPEFLIR §E.1`
- `OAPEFLIR §L.3.2`