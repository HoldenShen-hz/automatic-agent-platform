# ADR-015 Skill and Plugin Convergence to Single Marketplace

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

Historical system materials have separately introduced multiple extension entry points such as Skill Marketplace, Plugin Marketplace, and Template Marketplace. If these concepts coexist long-term, it will lead to:

- Scattered installation and permission governance entry points
- Redundant construction of review, signing, version compatibility, and disable policies
- Users struggling to understand "where to go to find extensions"

The current stage will not truly implement a marketplace, but the direction needs to be frozen first to prevent documentation from continuing to diverge along different marketplace models.

## Decision

Phase 1a / 1b does not implement a marketplace.

The long-term direction is to converge Skills, Plugins, templates, and other extension capabilities into a unified governance entry point, rather than maintaining multiple marketplace models.

This means:

- Only extension object models and governance contracts are preserved currently
- When truly entering Phase 4, priority is given to building a unified extension marketplace

## Alternatives

### Option A: Long-Term Maintenance of Multiple Marketplaces

Pros:

- Each extension type appears more "tailored to its own semantics".

Costs:

- Heavy user mental burden.
- Highly repetitive review, permission, signing, compatibility, deprecation, and billing capabilities.
- Significantly increased platform governance complexity.

### Option B: Implement Unified Marketplace Now

Pros:

- Most direct path.

Costs:

- Clearly beyond the current stage.
- Internal extension governance has not yet entered implementation; doing marketplace prematurely will only make the platform heavier.

### Option C: Current Decision

- Do not implement marketplace currently
- Long-term direction converges to unified entry
- First unify extension object, permission, and lifecycle at the contract layer

## Reasons for Selecting This Option

- The most important thing at this stage is internal extension boundaries, not marketplace product form.
- Unified governance entry better fits the long-term needs of permission, approval, signing, compatibility, and billing.
- Freezing the direction early can prevent documentation from continuing to introduce multiple parallel marketplace concepts.

## Key Invariants

- Skills, Plugins, and templates should all pass through unified governance chain in the future.
- Installation units must not bypass ToolRegistry, Policy Engine, and permission review.
- Even if the frontend displays in separate columns, it does not mean the backend needs to maintain multiple marketplace cores.

## Adoption Conditions

Continue to follow this direction before formally entering:

- ecosystem extension plane
- monetization metering plane
- enterprise operations plane

## Exit Conditions

If future evidence shows:

- Skills and Plugins have completely different lifecycles, risk models, and business models
- Unified governance brings higher complexity instead

Then a new ADR may be opened to discuss splitting, but returning to "multiple marketplaces evolving in parallel" without a new decision is not allowed.

## Implementation Impact

Current documentation and subsequent implementation requirements:

- Contracts and documents use unified extension / installable / capability registry language as much as possible.
- Phase 1a / 1b only does registry, permission, and installation boundaries, not marketplace UI or commercial distribution.
- If Phase 4 begins marketplace work, design should directly proceed from unified governance entry, rather than first doing multiple marketplace sets and then merging.

## Results

Pros:

- More consistent long-term governance.
- Simpler user mental model.
- Easier to unify permission, signing, version compatibility, and billing.

Costs:

- When truly implemented in the future, different extension types need to be abstracted into the same governance model.
- Some type-specific capabilities may require additional subtype rules rather than completely flat handling.

## Cross-References

- [ADR-014 Org Model Direct Mapping to Code Objects](./014-org-model-code-boundary.md)
- [ADR-005 Security Model](./005-security-model.md)
- [ADR-010 Commercial Model](./010-commercial-model.md)

## Source Sections

- `tool_skill_plugin_contract.md`
- `ecosystem_extension_plane_contract.md`
