# ADR-007 Evolution Engine

- Status: Accepted
- Decision Date: 2026-04-02

## Context

Static prompts, static models, and static policies gradually become invalid as task distributions change. The platform aims to form a closed loop of "execute, evaluate, optimize, rollback," but the system must not become uncontrollable due to self-modification.

## Decision

Drive evolution via OAPEFLIR secondary chain `Feedback → Learn → Improve → Release`, with deterministic guardrails controlling entry to production:

- Supervisor/observability continues to manage lifecycle, real-time monitoring, health checks, and metric collection.
- Feedback Hub normalizes execution signals into structured `FeedbackSignal`.
- Learn Hub only allows evidence-backed learning objects into subsequent stages, explicitly maintaining `promotionStatus`.
- Improve Hub only receives `validated/promoted` LearningObjects.
- Release currently allows only `off / suggest / shadow` three tiers in phase1-4; canary/staged not directly opened.
- Any change must be rollbackable, auditable, canary-deployable, and pausable.

## Supervisor Role

Supervisor is not just a monitor; it also bears governance responsibilities:

- Manages Agent lifecycle.
- Tracks heartbeat, context usage, tool calls, and resource usage.
- Evaluates success rate, cost, latency, and quality signals.
- Restarts, pauses, escalates, or terminates anomalous Agents when necessary.

## Evolution Dimensions

Eight dimensions can be summarized as:

1. Prompt optimization.
2. Compute budget adaptation.
3. Tool call optimization and Skill accumulation.
4. Capability profiling and reflection memory.
5. Pre-check failure analysis.
6. Reflexion/Self-Refine/experience replay.
7. Reasoning strategy adaptive selection.
8. Multi-Agent collaboration optimization and evaluation function evolution.

## MVP Scope

Current phase1-4 actual MVP closure is:

- Feedback: Deduplication, correlation, recovery path identification.
- Learn: Only supports `failure_pattern`, `user_correction`, `recovery_playbook` three learning object types.
- Improve: Only allows evidence-backed and validated LearningObjects into candidates.
- Release: Only supports `off / suggest / shadow`.

Other heavier evolution capabilities, such as multi-stage canary, auto-rollback, more learning types, continue to be deferred.

## Security Principles

Evolution must obey several iron rules:

- No demotion: New strategy must prove no worse than current before going online.
- Reversible: Every change needs a snapshot and rollback point.
- Controllable: Must be pausable with one click.
- Auditable: All changes write to evolution log.
- Canary-deployable: First verify on small traffic, then gradually scale.
- No privilege escalation: Model can only propose LearningObject/Candidate; cannot directly advance `promotionStatus`, `candidate.status`, or `rollout.status`.

## Alerting and Observability

Supervisor/observability should alert or notify on these events:

- Context approaching threshold.
- Agent suspected of being stuck.
- Agent abnormally terminated.
- Evolution event success or rollback.
- Cost alert.
- OAPEFLIR phase timeline anomaly.
- Learn validation failure or rollout guardrail block.

## Consequences

Advantages:

- Platform can iterate based on real execution data, not just manual experience tuning.
- Optimization process incorporated into unified governance and audit.
- Evolution changes from "mysterious parameter tuning" to a constrained engineering process.
- Boundary between main chain and secondary chain is clearer; reduces risk of "secret self-modification in execution logic."

Costs:

- Metric quality directly determines optimization quality.
- Without offline backtesting, canary, and rollback, evolution becomes a new instability source.
- Premature introduction of all 8 dimensions significantly increases system complexity.

## Current Implementation Alignment

As of current phase1-4 delivery, aligned parts include:

- `FeedbackCollector` + `SignalPreprocessor` have formed structured learning input.
- `LearningObjectValidator` has made evidence and `promotionStatus` a hard boundary.
- `PolicyRolloutService` + `GuardrailEvaluator` have pulled rollout approval from model suggestion back to system code.
- `OapeflirLoopService` has persisted phase timeline perspective, facilitating audit of main/secondary chain closure.

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
