# ADR-011 Whether to Adopt Effect-TS as Core Runtime Foundation

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and dual-channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback sources (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-03

## Background

The system has clearly identified needs for state machine, unified error model, recovery chain, context propagation, resource lifecycle management, and subsequent execution plane evolution. Effect-TS can provide a relatively complete abstraction of effect, resource, layer, and typed error, but simultaneously significantly increases team learning cost and initial implementation burden.

The real question at the current stage is not "whether you like Effect-TS", but:

- Whether Ring 1 is worth introducing heavier runtime abstraction early for future capabilities.
- If not introducing now, when should re-evaluation occur.

## Decision

Do not force adoption of Effect-TS as core runtime foundation in Ring 1.

Current stage adopts a lighter strategy:

- TypeScript native async/await as main execution model.
- Contract-driven error model, state machine, and repository boundaries are frozen first.
- Reserve boundaries for possible future Effect-TS introduction, but do not let implementation prematurely depend on its programming model.

Re-evaluation point placed at Phase 2:

- When multi-worker, queue, complex resource lifecycle, and typed effect combinations begin significantly increasing, formally evaluate whether to introduce.

## Alternative Options

### Option A: Immediately Adopt Effect-TS in Ring 1

Benefits:

- More unified error, dependency, concurrency, and resource management models.
- Smoother subsequent execution plane evolution.

Costs:

- Steep learning curve.
- Significantly higher costs for initial implementation, testing, debugging, and onboarding.
- Current team is still closing platform boundaries; premature abstraction layer switch amplifies documentation-to-code translation cost.

### Option B: Completely Exclude Effect-TS

Benefits:

- Lowest initial mental burden.
- Fastest implementation speed.

Costs:

- If Phase 2 complexity significantly increases, may lack unified effect/resource model.
- Subsequent re-introduction if needed has higher migration cost.

### Option C: Current Decision

- Currently not forcing adoption
- Retain structural space for future introduction
- Use contract and boundary design instead of premature runtime framework lock-in

## Reasons for This Choice

- Current most important thing is to first tighten the five foundations: state, error, events, recovery, and security.
- These issues are first and foremost boundary and contract issues, not runtime framework issues.
- Prematurely introducing Effect-TS pushes "implementation complexity" to Ring 1, which is not the current main risk.
- Retaining room for future re-evaluation is more prudent than locking in now.

## Key Invariants

- Current code must not assume Effect-TS will definitely be introduced in the future.
- Current code must also not be written as "absolutely never introducing Effect-TS" form.
- Error model, repository boundaries, context propagation, and state push入口 must independently hold true regardless of specific runtime framework.

## Adoption Triggers

If any of the following occur, re-evaluation should be opened:

- Execution plane enters multi-worker/queue/lease/handover implementation stage.
- Resource lifecycle management widely involves sandbox, provider, gateway, worker registry.
- Existing async/await + service organization clearly causes error propagation, resource cleanup, or dependency injection to become uncontrolled.

## Exit Conditions

If after Phase 2 evaluation still find:

- Complexity not yet sufficient to prove introduction benefits
- Team maintenance cost higher than expected
- Contract and service already sufficient to support evolution

Then continue to maintain non-introduction, do not treat as "postponement failure".

## Implementation Impact

Requirements for current implementation:

- Continue converging core capabilities to service + repository + contract.
- Use `AppError`, transition service, policy engine, context propagation, etc. contracts instead of framework coupling.
- Avoid forming hard-to-replace implicit global dependencies in code.

Requirements for subsequent evolution:

- If future evaluation introduces, should first use ADR to cover migration scope, benefit proof, and rollback strategy.

## Results

Benefits:

- Phase 1a/1b landing speed and understanding cost more controllable.
- First make platform boundaries solid, then decide whether to upgrade runtime abstraction.
- Avoid mis treating framework preferences as architectural necessities.

Costs:

- Some typed effect and resource safety advantages temporarily not available at current stage.
- If Phase 2 decides to introduce, still need a controlled migration.

## Cross-References

- [ADR-012 Whether SQLite as Phase 1-2 Only Primary Storage](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-013 Whether EventEmitter Continues to Phase 2](./013-eventemitter-phase-2-boundary.md)
- [ADR-014 Whether Organization Model Directly Maps to Code Objects](./014-org-model-code-boundary.md)

## Source Sections

- `System Improvement Roadmap / P0-10`
- `reference/16-competitive-differentiation.md`