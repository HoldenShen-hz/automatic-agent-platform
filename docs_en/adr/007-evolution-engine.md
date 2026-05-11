# ADR-007 Evolution Engine

- Status: Partially Superseded by ADR-075
- Decision Date: 2026-04-02
- Partially Supersedes: ADR-075's six-level release model has replaced the description that "Release only allows three tiers: off/suggest/shadow"

## Background

Static prompts, static models, and static policies gradually become ineffective as task distributions change. The platform aims to form a closed loop of "Execute, Evaluate, Optimize, Rollback," but the system must remain controllable and not become unpredictable through self-modification.

## Decision

The evolution is driven by the OAPEFLIR side chain `Feedback → Learn → Improve → Release`, with deterministic guardrails controlling entry to production:

- Supervisor / observability continues to be responsible for lifecycle management, real-time monitoring, health checks, and metric collection.
- Feedback Hub is responsible for normalizing execution signals into structured `FeedbackSignal`.
- Learn Hub only allows evidence-backed learning objects to enter subsequent stages, and explicitly maintains `promotionStatus`.
- Improve Hub only accepts `validated/promoted` LearningObjects.
- Release, in the current phase 1-4, only allows three tiers: `off / suggest / shadow`, and does not directly expose canary/staged.
- Any change must be roll-backable, auditable, gradual, and pausable.

## Supervisor Role

The Supervisor is not just a monitor; it also carries governance responsibilities:

- Manages Agent lifecycle.
- Tracks heartbeats, context usage, tool invocations, and resource consumption.
- Evaluates success rate, cost, latency, and quality signals.
- When necessary, restarts, pauses, upgrades, or terminates anomalous Agents.

## Evolution Dimensions

The 8 dimensions can be summarized as:

1. Prompt optimization.
2. Compute budget adaptation.
3. Tool call optimization and Skill precipitation.
4. Capability profiling and reflection memory.
5. Pre-check failure analysis.
6. Reflexion / Self-Refine / experience replay.
7. Adaptive reasoning strategy selection.
8. Multi-Agent collaboration optimization and evaluation function evolution.

## MVP Scope

The actual MVP scope for current phase 1-4 is limited to:

- Feedback: Deduplication, correlation, and recovery path identification.
- Learn: Only supports three types of learning objects: `failure_pattern`, `user_correction`, `recovery_playbook`.
- Improve: Only allows evidence-backed and validated LearningObjects into candidates.
- Release: Only supports `off / suggest / shadow`.

Other more intensive evolution capabilities, such as multi-stage canary, auto-rollback, and more learning types, continue to be deferred.

## Security Principles

Evolution must adhere to several iron rules:

- No degradation: New strategies must prove they are no worse than the current state before going online.
- Reversible: Every change must have snapshots and rollback points.
- Controllable: Must be one-click pausable.
- Auditable: All changes are written to the evolution log.
- Gradual: First validate on small traffic, then gradually scale up.
- No privilege escalation: Models can only propose LearningObjects / Candidates, and cannot directly advance `promotionStatus`, `candidate.status`, or `rollout.status`.

## Alerts and Observability

Supervisor / observability should raise alerts or notifications for the following events:

- Context approaching threshold.
- Agent suspected of being stuck.
- Agent terminated abnormally.
- Evolution event succeeded or rolled back.
- Cost alert.
- OAPEFLIR stage timeline anomaly.
- Learn validation failure or rollout guardrail blocked.

## Results

Advantages:

- The platform can iterate based on real runtime data, rather than relying solely on manual experience-based tuning.
- Brings the optimization process under unified governance and auditing.
- Transforms evolution from "mysterious parameter tuning" into a constrained engineering process.
- Clarifies the boundary between main chain and side chain, reducing the risk of "stealthy self-modification within execution logic."

Costs:

- Metric quality directly determines optimization quality.
- Without offline backtesting, gradual rollout, and rollback, evolution becomes a new source of instability.
- Introducing all 8 dimensions prematurely will significantly increase system complexity.

## Current Implementation Alignment

As of current phase 1-4 delivery, the aligned components include:

- `FeedbackCollector` + `SignalPreprocessor` have formed structured learning input.
- `LearningObjectValidator` has made evidence and `promotionStatus` a hard boundary.
- `PolicyRolloutService` + `GuardrailEvaluator` have pulled rollout approval back from model suggestions to system code.
- `OapeflirLoopService` has persisted the stage timeline perspective, facilitating auditing of main chain / side chain closed loop.

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
