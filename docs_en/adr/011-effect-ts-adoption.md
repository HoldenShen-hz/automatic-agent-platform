# ADR-011 Effect-TS Adoption as Core Runtime Foundation

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post-execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and dual-channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback sources (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The system has clearly identified needs for state machines, unified error models, recovery chains, context propagation, resource lifecycle management, and subsequent execution plane evolution. Effect-TS can provide a relatively complete set of abstractions for effects, resources, layers, and typed errors, but it also significantly increases team learning costs and initial implementation burden.

The real question at the current stage is not "whether we like Effect-TS", but rather:

- Is Phase 1a / 1b the right time to introduce a heavier runtime abstraction for future capabilities?
- If we don't introduce it now, when should we re-evaluate?

## Decision

Effect-TS will NOT be mandated as the core runtime foundation in Phase 1a / 1b.

The current stage will adopt a lighter strategy:

- TypeScript native async/await as the primary execution model.
- Contract-driven error models, state machines, and repository boundaries will be frozen first.
- Boundaries will be preserved for possible future Effect-TS adoption, but the implementation will not prematurely depend on its programming model.

The re-evaluation point is set for Phase 2:

- When multi-worker, queue, complex resource lifecycles, and typed effect combinations begin to increase significantly, a formal evaluation of adoption will be conducted.

## Alternatives

### Option A: Immediately adopt Effect-TS comprehensively in Phase 1a

Pros:

- More unified error, dependency, concurrency, and resource management models.
- Smoother subsequent execution plane evolution.

Costs:

- Steep learning curve.
- Significantly higher costs for initial implementation, testing, debugging, and onboarding.
- The team is still closing platform boundaries; switching abstractions prematurely increases translation costs from documentation to code.

### Option B: Completely exclude Effect-TS

Pros:

- Lowest initial mental burden.
- Fastest implementation speed.

Costs:

- If Phase 2 complexity increases significantly, there may be a lack of unified effect/resource model.
- If introduced later, migration costs will be higher.

### Option C: Current Decision

- Do not mandate adoption currently
- Preserve structural space for future introduction
- Use contract and boundary design instead of premature runtime framework lock-in

## Reasons for Selecting This Option

- The most important thing at this stage is to first tighten the five foundations: state, errors, events, recovery, and security.
- These issues are primarily boundary and contract problems, not runtime framework problems.
- Prematurely introducing Effect-TS pushes "implementation complexity" into Phase 1a, which is not the current primary risk.
- Preserving space for future re-evaluation is more prudent than locking in now.

## Key Invariants

- Current code must not assume Effect-TS will definitely be introduced in the future.
- Current code must also not be written in a form that makes it "impossible to ever introduce Effect-TS".
- Error models, repository boundaries, context propagation, and state entry points must be valid independently of any specific runtime framework.

## Adoption Conditions

If any of the following occur, a new evaluation should be initiated:

- The execution plane enters multi-worker / queue / lease / handover implementation phase.
- Resource lifecycle management extensively involves sandbox, provider, gateway, worker registry.
- Existing async/await + service organization clearly causes uncontrolled error propagation, resource cleanup, or dependency injection.

## Exit Conditions

If after Phase 2 evaluation it is still found that:

- Complexity is insufficient to justify adoption benefits
- Team maintenance costs are higher than expected
- Contracts and services are sufficient to support evolution

Then continue to maintain non-adoption and do not treat it as a "postponed failure".

## Implementation Impact

Requirements for current implementation:

- Continue converging core capabilities to service + repository + contract.
- Use `AppError`, transition service, policy engine, context propagation and other contracts instead of framework coupling.
- Avoid forming hard-to-replace implicit global dependencies in code.

Requirements for subsequent evolution:

- If future evaluation leads to adoption, an ADR must first be added to cover migration scope, benefit proof, and rollback strategy.

## Results

Pros:

- Phase 1a / 1b delivery speed and comprehension costs are more manageable.
- Stabilize platform boundaries first, then decide whether to upgrade runtime abstraction.
- Avoid mischaracterizing framework preferences as architectural necessities.

Costs:

- Some typed effect and resource safety advantages are temporarily unavailable at this stage.
- If adopted in Phase 2, a controlled migration will still be required.

## Cross-References

- [ADR-012 SQLite as Phase 1-2 Sole Primary Storage](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-013 EventEmitter Usage Through Phase 2](./013-eventemitter-phase-2-boundary.md)
- [ADR-014 Org Model Direct Mapping to Code Objects](./014-org-model-code-boundary.md)

## Source Sections

- `System Improvement Roadmap / P0-10`
- `reference/16-competitive-differentiation.md`
