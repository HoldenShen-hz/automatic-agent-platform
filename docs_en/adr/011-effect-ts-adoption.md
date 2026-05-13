# ADR-011 Effect-TS Adoption as Core Runtime Foundation

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing and 7 feedback sources (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-03

## Background

The system has clearly identified the need for state machines, unified error models, recovery chains, context propagation, resource lifecycle management, and subsequent execution plane evolution. Effect-TS can provide a relatively complete set of effect, resource, layer, and typed error abstractions, but it would also significantly increase team learning costs and initial implementation burden.

The real problem at the current stage is not "whether we like Effect-TS", but:

- Whether Ring 1 is worth introducing a heavier runtime abstraction early for future capabilities.
- If not introducing it now, when should we re-evaluate.

## Decision

Do not mandate Effect-TS as the core runtime foundation in Ring 1.

The current phase adopts a lighter strategy:

- TypeScript native async/await as the primary execution model.
- Contract-driven error model, state machines, and repository boundaries are frozen first.
- Leave structural space for possible future Effect-TS adoption, but do not let implementation depend on its programming model prematurely.

Re-evaluation point placed at Phase 2:

- When multi-worker, queue, complex resource lifecycle, and typed effect composition begin to increase significantly, formally evaluate whether to introduce it.

## Alternatives

### Option A: Immediate Full Adoption of Effect-TS in Ring 1

Pros:

- More unified error, dependency, concurrency, and resource management models.
- Smoother subsequent execution plane evolution.

Costs:

- Steep learning curve.
- Significantly higher initial implementation, testing, debugging, and onboarding costs.
- The team is still closing platform boundaries; premature abstraction layer changes would amplify documentation-to-code translation costs.

### Option B: Completely Exclude Effect-TS

Pros:

- Lowest initial mental burden.
- Fastest implementation speed.

Costs:

- If Phase 2 complexity increases significantly, may lack unified effect/resource model.
- Higher migration cost if introduced later.

### Option C: Current Decision

- No mandatory adoption currently
- Preserve structural space for future introduction
- Use contract and boundary design instead of premature runtime framework lock-in

## Reasons for This Choice

- The most important thing now is to tighten the five foundations: state, error, events, recovery, and security.
- These are primarily boundary and contract issues, not runtime framework issues.
- Prematurely introducing Effect-TS would push "implementation complexity" forward to Ring 1, which is not the current primary risk.
- Preserving space for future re-evaluation is more prudent than locking in now.

## Key Invariants

- Current code must not assume Effect-TS will definitely be introduced in the future.
- Current code must also not be written in a form that makes it "absolutely impossible" to introduce Effect-TS.
- Error model, repository boundaries, context propagation, and state machine entry points must hold independently of any specific runtime framework.

## Adoption Triggers

If any of the following occurs, evaluation should be reopened:

- Execution plane enters multi-worker / queue / lease / handover implementation phase.
- Resource lifecycle management extensively involves sandbox, provider, gateway, worker registry.
- Existing async/await + service organization clearly leads to uncontrolled error propagation, resource cleanup, or dependency injection.

## Exit Conditions

If after Phase 2 evaluation it is still found that:

- Complexity is not sufficient to justify introduction benefits
- Team maintenance costs are higher than expected
- Contracts and services are sufficient to support evolution

Then continue to maintain non-adoption and do not treat it as "postponement failure".

## Implementation Impact

Requirements for current implementation:

- Continue converging core capabilities as service + repository + contract.
- Use `AppError`, transition service, policy engine, context propagation, etc. as contract replacements for framework coupling.
- Avoid forming hard-to-replace implicit global dependencies in code.

Requirements for future evolution:

- If future evaluation decides to introduce, use ADR to document migration scope, benefit justification, and rollback strategy first.

## Results

Benefits:

- Phase 1a/1b implementation speed and comprehension costs are more manageable.
- Stabilize platform boundaries first, then decide whether to upgrade runtime abstraction.
- Avoid confusing framework preferences with architectural necessities.

Costs:

- Some typed effect and resource safety advantages are temporarily unavailable at this stage.
- If Phase 2 decides to introduce, a controlled migration is still required.

## Cross-References

- [ADR-012 SQLite as Phase 1-2 Primary Store](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-013 EventEmitter Continued Use to Phase 2](./013-eventemitter-phase-2-boundary.md)
- [ADR-014 Organization Model Direct Mapping to Code Objects](./014-org-model-code-boundary.md)

## Source Sections

- `System Improvement Roadmap / P0-10`
- `reference/16-competitive-differentiation.md`
