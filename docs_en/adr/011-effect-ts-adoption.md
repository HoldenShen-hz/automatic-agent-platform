# ADR-011 Whether Effect-TS as Core Runtime Foundation

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The system has clearly required state machine, unified error model, recovery chain, context propagation, resource lifecycle management, and subsequent execution plane evolution. Effect-TS can provide a relatively complete set of effect, resource, layer, and typed error abstractions, but will also significantly increase team learning cost and initial implementation burden.

The real problem at the current stage is not "whether you like Effect-TS" but:

- Is Phase 1a/1b worth introducing a heavier runtime abstraction in advance for future capabilities?
- If not introduced now, when should we re-evaluate?

## Decision

Do not mandate Effect-TS as core runtime foundation in Phase 1a/1b.

Current stage adopts a lighter strategy:

- TypeScript native async/await as main execution model.
- Contract-driven error model, state machine, and repository boundary freeze first.
- Reserve structural space for possible future Effect-TS introduction, but do not let implementation prematurely depend on its programming model.

Re-evaluation timing placed at Phase 2:

- When multi-worker, queue, complex resource lifecycle, and typed effect composition begin to significantly increase, formally evaluate whether to introduce.

## Alternatives

### Option A: Immediately Adopt Effect-TS in Phase 1a

Benefits:

- More unified error, dependency, concurrency, and resource management model.
- Subsequent execution plane may be smoother.

Costs:

- Steep learning curve.
- Significantly increased initial implementation, testing, debugging, and onboarding costs.
- Current team is still closing platform boundaries; switching abstraction layer too early will amplify documentation-to-code translation costs.

### Option B: Completely Exclude Effect-TS

Benefits:

- Lowest mental burden at initial stage.
- Fastest implementation speed.

Costs:

- Once Phase 2 complexity significantly increases, may lack unified effect/resource model.
- If introduced later, migration cost is higher.

### Option C: Current Decision

- Not mandating adoption currently
- Preserving structural space for future introduction
- Using contract and boundary design instead of premature runtime framework lock-in

## Reasons for Choosing This Approach

- Current most important thing is to tighten the five foundations: state, error, event, recovery, and security.
- These problems are first and foremost boundary and contract problems, not runtime framework problems.
- Prematurely introducing Effect-TS would front-load "implementation complexity" to Phase 1a, which is not the current main risk.
- Preserving space for future re-evaluation is more prudent than locking in now.

## Key Invariants

- Current code must not assume Effect-TS will definitely be introduced in the future.
- Current code also must not be written in a form that "absolutely cannot introduce Effect-TS".
- Error model, repository boundary, context propagation, and state push entry must be成立 independently of specific runtime framework.

## Adoption Triggers

If any of the following occur, should reopen evaluation:

- Execution plane enters multi-worker/queue/lease/handover implementation stage.
- Resource lifecycle management begins widely involving sandbox, provider, gateway, worker registry.
- Existing async/await + service organization clearly causes error propagation, resource cleanup, or dependency injection to become uncontrolled.

## Exit Conditions

If after Phase 2 evaluation still find:

- Complexity not yet sufficient to prove introduction benefits
- Team maintenance cost higher than expected
- Contract and service already sufficient to support evolution

Then continue to maintain non-introduction, do not view as "deferred failure".

## Implementation Impact

Requirements for current implementation:

- Continue converging core capabilities as service + repository + contract.
- Use `AppError`, transition service, policy engine, context propagation and other contracts instead of framework coupling.
- Avoid forming隐式global dependencies in code that are difficult to replace.

Requirements for subsequent evolution:

- If future evaluation introduces, should first use ADR to supplement migration scope, benefit proof, and rollback strategy.

## Results

Benefits:

- Phase 1a/1b landing speed and understanding cost more controllable.
- First stabilize platform boundaries, then decide whether to upgrade runtime abstraction.
- Avoid misusing framework preferences as architectural necessities.

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
