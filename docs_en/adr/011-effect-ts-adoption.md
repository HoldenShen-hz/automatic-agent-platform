# ADR-011 Whether Effect-TS Should Be Used as Core Runtime Foundation

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post-execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback source types (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Release state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-03

## Background

The system has clearly required state machine, unified error model, recovery chain, context propagation, resource lifecycle management, and subsequent execution plane evolution. Effect-TS can provide a relatively complete abstraction of effect, resource, layer, and typed error, but will also significantly increase team learning cost and initial implementation burden.

The real question at the current stage is not "whether we like Effect-TS", but:

- Is Ring 1 worth introducing heavier runtime abstraction ahead for future capabilities.
- If not currently introducing, when should we re-evaluate.

## Decision

Do not mandate Effect-TS as the core runtime foundation in Ring 1.

Adopt a lighter strategy at the current stage:

- TypeScript native async/await as the main execution model.
- Contract-driven error model, state machine, and repository boundary frozen first.
- Reserve structural space for possible future introduction of Effect-TS, but do not let implementation prematurely depend on its programming model.

Re-evaluation point placed at Phase 2:

- When multi-worker, queue, complex resource lifecycle, and typed effect composition begin to significantly increase, formally evaluate whether to introduce.

## Alternative Solutions

### Solution A: Immediately Fully Adopt Effect-TS in Ring 1

Advantages:

- More unified error, dependency, concurrency, and resource management model.
- Subsequent execution plane may be smoother.

Costs:

- Steep learning curve.
- Significantly increased cost for initial implementation, testing, debugging, and onboarding.
- Current team is still closing platform boundaries; premature abstraction layer switch amplifies documentation-to-code translation cost.

### Solution B: Completely Exclude Effect-TS

Advantages:

- Lowest mental burden at initial stage.
- Fastest implementation speed.

Costs:

- If Phase 2 complexity significantly increases, may lack unified effect / resource model.
- If introduced later, migration cost is higher.

### Solution C: Current Decision Solution

- Currently not mandating adoption
- Preserve structural space for future introduction
- Use contract and boundary design instead of premature runtime framework lock-in

## Reasons for Choosing This Solution

- Currently most important is to tighten state, error, events, recovery, and security these five foundations.
- These issues are first and foremost boundary and contract issues, not runtime framework issues.
- Premature introduction of Effect-TS would front-load "implementation complexity" to Ring 1, which is not the current main risk.
- Preserving space for future re-evaluation is more prudent than locking in now.

## Key Invariants

- Current code must not assume Effect-TS will definitely be introduced in the future.
- Current code also must not be written in a form that "makes it absolutely impossible to introduce Effect-TS".
- Error model, repository boundaries, context propagation, and state machine entry must be independently valid regardless of specific runtime framework.

## Adoption Triggers

If any of the following occurs, should reopen evaluation:

- Execution plane enters multi-worker / queue / lease / handover implementation stage.
- Resource lifecycle management widely involves sandbox, provider, gateway, worker registry.
- Existing async/await + service organization clearly leads to uncontrolled error propagation, resource cleanup, or dependency injection.

## Exit Conditions

If after Phase 2 evaluation still find:

- Complexity is not enough to prove introduction benefit
- Team maintenance cost higher than expected
- Contract and service already sufficient to support evolution

Then continue to maintain non-introduction, not viewed as "deferred failure".

## Implementation Impact

Requirements for current implementation:

- Continue converging core capabilities to service + repository + contract.
- Use `AppError`, transition service, policy engine, context propagation and other contracts instead of framework coupling.
- Avoid forming hard-to-replace implicit global dependencies in code.

Requirements for subsequent evolution:

- If future evaluation decides to introduce, should first use ADR to supplement migration scope, benefit proof, and rollback strategy.

## Results

Advantages:

- Phase 1a / 1b landing speed and understanding cost more controllable.
- First make platform boundaries solid, then decide whether to upgrade runtime abstraction.
- Avoid misconstruing framework preference as architectural necessity.

Costs:

- Some typed effect and resource safety advantages temporarily unavailable at current stage.
- If Phase 2 decides to introduce, still需要一个受控 migration.

## Cross References

- [ADR-012 Whether SQLite Should Be Phase 1-2 Only Primary Storage](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-013 Whether to Continue Using EventEmitter to Phase 2](./013-eventemitter-phase-2-boundary.md)
- [ADR-014 Whether Org Model Directly Maps to Code Objects](./014-org-model-code-boundary.md)

## Source Sections

- `System Improvement Roadmap / P0-10`
- `reference/16-competitive-differentiation.md`
