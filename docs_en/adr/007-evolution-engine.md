# ADR-007 Evolution Engine

- Status: Partially Superseded by ADR-075
- Decision Date: 2026-04-02
- Partially superseded: ADR-075's six-level release model has replaced the description that "Release only allows off/suggest/shadow three modes"

## Background

Static prompts, static models, and static strategies gradually become invalid as task distribution changes. The platform wants to form a closed loop of "execute, evaluate, optimize, rollback", but cannot let the system become uncontrollable due to self-modification.

## Decision

Drive evolution through OAPEFLIR secondary chain `Feedback → Learn → Improve → Release`, with deterministic guardrail controlling production entry:

- HarnessRuntime is responsible for lifecycle management, real-time monitoring, health checks, and metric collection.
- Feedback Hub is responsible for normalizing execution signals into structured `FeedbackSignal`.
- Learn Hub only allows evidence-backed learning objects to enter subsequent stages, and explicitly maintains `promotionStatus`.
- Improve Hub only receives `validated/promoted` LearningObject.
- Release in current phase1-4 only allows `off / suggest / shadow` three modes, not directly opening canary/staged.
- Any change must be rollbackable, auditable,rollable, pausable.

## HarnessRuntime Lifecycle Control

v4.3 §45 consolidates all lifecycle control to HarnessRuntime:

- Manage agent lifecycle.
- Track heartbeat, context usage, tool calls, and resource usage.
- Evaluate success rate, cost, latency, and quality signals.
- Restart, pause, upgrade, or terminate abnormal agents when necessary.

## Evolution Dimensions

8 dimensions can be summarized as:

1. Prompt optimization.
2. Compute budget adaptation.
3. Tool call optimization and Skill precipitation.
4. Capability profiling and reflective memory.
5. Pre-check failure analysis.
6. Reflexion / Self-Refine / experience replay.
7. Reasoning strategy adaptive selection.
8. Multi-agent collaboration optimization and evaluation function evolution.

## MVP Scope

Current phase1-4 actual MVP closure includes:

- Feedback: Deduplication, correlation, recovery path identification.
- Learn: Only supports `failure_pattern`, `user_correction`, `recovery_playbook` three learning object types.
- Improve: Only allows evidence-backed and validated LearningObject to enter candidate.
- Release: Only supports `off / suggest / shadow`.

Other heavier evolution capabilities, such as multi-stage canary, auto-rollback, more learning types, continue to be deferred.

## Safety Principles

Evolution must abide by several iron rules:

- No degradation: New strategy must prove no worse than current state before going online.
- Reversible: Every change must have snapshots and rollback points.
- Controllable: Must be pausable with one click.
- Auditable: All changes are written to evolution log.
- Rollout-controllable: First verify on small traffic, then gradually scale up.
- No privilege escalation: Model can only propose LearningObject / Candidate, cannot directly advance `promotionStatus`, `candidate.status`, or `rollout.status`.

## Alerts and Observability

HarnessRuntime / observability should give alerts or notifications for the following events:

- Context approaching threshold.
- Agent suspected of being stuck.
- Agent abnormal termination.
- Evolution event success or rollback.
- Cost alert.
- OAPEFLIR stage timeline anomaly.
- Learn validation failure or rollout guardrail blocking.

## Results

Advantages:

- Platform can iterate based on real runtime data, not just manual experience-based tuning.
- Incorporates optimization process into unified governance and audit.
- Makes evolution from "mysterious parameter tuning" into a constrained engineering process.
- Makes the boundary between main chain and secondary chain clearer, reducing the risk of "sneakily self-modifying in execution logic".

Constraints:

- Metric quality directly determines optimization quality.
- Without offline backtesting, gray-scale, and rollback, evolution becomes a new instability source.
- Premature introduction of all 8 dimensions significantly increases system complexity.

## Current Implementation Alignment

As of current phase1-4 delivery, aligned parts include:

- `FeedbackCollector` + `SignalPreprocessor` have formed structured learning input.
- `LearningObjectValidator` has made evidence and `promotionStatus` a hard boundary.
- `PolicyRolloutService` + `GuardrailEvaluator` have recovered rollout approval from model suggestion to system code.
- `OapeflirLoopService` has persisted stage timeline perspective, facilitating audit of main chain/secondary chain closure.

## Cross References

- [ADR-003 Six-Layer Memory and KV Cache Fixed Prefix](./003-memory-six-layers.md)
- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-008 Cost Model](./008-cost-model.md)

## Source Sections

- `OAPEFLIR §7`
- `OAPEFLIR §8`
- `OAPEFLIR §9`
- `OAPEFLIR §E.1`
- `OAPEFLIR §L.3.2`

## v4.3 ADR Remediation

- R6-51: Fix lifecycle ownership attribution. ADR-007 originally described "Supervisor / observability continues to be responsible for lifecycle management", conflicting with v4.3 §45's decision to consolidate all lifecycle control to HarnessRuntime. Fix: Changed text to "HarnessRuntime is responsible for lifecycle management, real-time monitoring, health checks, and metric collection".
