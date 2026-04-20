# ADR-007 Evolution Engine

- Status: Accepted
- Decision Date: 2026-04-02

## Context

Static prompts, static models, and static policies gradually become invalid as task distribution changes. The platform wants to form a "execute, evaluate, optimize, rollback" closed loop, but cannot let the system become uncontrollable due to self-modification.

## Decision

Drive evolution through OAPEFLIR secondary chain `Feedback → Learn → Improve → Release`, with deterministic guardrail controlling entry into production:

- Supervisor/observability continues to be responsible for lifecycle management, real-time monitoring, health checks, and metric collection.
- Feedback Hub is responsible for normalizing execution signals into structured `FeedbackSignal`.
- Learn Hub only allows evidence-backed learning objects to enter subsequent stages, and explicitly maintains `promotionStatus`.
- Improve Hub only receives `validated/promoted` LearningObject.
- Release in current phase1-4 only allows `off/suggest/shadow` three tiers, does not directly open canary/staged.
- Any change must be rollback-able, auditable, gradable, and pausable.

## Supervisor Role

Supervisor is not just a monitor but also bears governance responsibilities:

- Manage Agent lifecycle.
- Track heartbeat, context usage, tool calls, and resource usage.
- Evaluate success rate, cost, latency, and quality signals.
- When necessary, restart, pause, escalate, or terminate abnormal Agents.

## Evolution Dimensions

8 dimensions can be summarized as:

1. Prompt optimization.
2. Compute budget adaptation.
3. Tool call optimization and Skill precipitation.
4. Capability profiling and reflection memory.
5. Pre-check failure analysis.
6. Reflexion/Self-Refine/experience replay.
7. Inference strategy adaptive selection.
8. Multi-Agent collaboration optimization and evaluation function evolution.

## MVP Scope

Current phase1-4 actual MVP closure is:

- Feedback: Deduplication, correlation, recovery path identification.
- Learn: Only support `failure_pattern`, `user_correction`, `recovery_playbook` three types of learning objects.
- Improve: Only allow evidence-backed and validated LearningObject to enter candidates.
- Release: Only support `off/suggest/shadow`.

Other heavier evolution capabilities like multi-stage canary, auto-rollback, more learning types continue to be deferred.

## Security General Principles

Evolution must adhere to several iron rules:

- No degradation: New strategy must prove no worse than current before going online.
- Reversible: Each change requires snapshot and rollback point.
- Controllable: Must be pausable with one click.
- Auditable: All changes write to evolution log.
- Gradable: First verify on small traffic, then gradually scale.
- No unauthorized advancement: Model can only propose LearningObject/Candidate, cannot directly advance `promotionStatus`, `candidate.status`, or `rollout.status`.

## Alerts and Observation

Supervisor/observability should give alerts or notifications for the following events:

- Context approaching threshold.
- Agent suspected of being stuck.
- Agent abnormally terminated.
- Evolution event success or rollback.
- Cost alert.
- OAPEFLIR stage timeline anomaly.
- Learn validation failure or rollout guardrail blocking.

## Results

Benefits:

- Platform can iterate based on real runtime data rather than just manual experience-based tuning.
- Brings optimization process into unified governance and audit.
- Turns evolution from "mysterious parameter tuning" into a constrained engineering process.
- Makes boundary between main chain and secondary chain clearer, reducing risk of "secretly self-modifying in execution logic".

Costs:

- Metric quality directly determines optimization quality.
- Without offline backtesting, grading, and rollback, evolution becomes new instability source.
- Prematurely introducing all 8 dimensions will significantly increase system complexity.

## Current Implementation Alignment

As of current phase1-4 delivery, aligned parts include:

- `FeedbackCollector` + `SignalPreprocessor` have formed structured learning input.
- `LearningObjectValidator` has made evidence and `promotionStatus` a hard boundary.
- `PolicyRolloutService` + `GuardrailEvaluator` have pulled rollout approval from model suggestion back to system code.
- `OapeflirLoopService` has persisted stage timeline perspective, facilitating audit of main/secondary chain closed loop.

## Cross-References

- [ADR-003 Six-Layer Memory and KV Cache Fixed Prefix](./003-memory-seven-layers.md)
- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-008 Cost Model](./008-cost-model.md)

## Source Sections

- `OAPEFLIR §7`
- `OAPEFLIR §8`
- `OAPEFLIR §9`
- `OAPEFLIR §E.1`
- `OAPEFLIR §L.3.2`
