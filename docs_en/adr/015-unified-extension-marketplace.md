# ADR-015 Convergence of Skills and Plugins into a Single Marketplace

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

Historical materials in the system have referenced multiple extension entry points such as Skill Marketplace, Plugin Marketplace, and Template Marketplace. If these concepts coexist long-term, it would lead to:

- Scattered installation and permission governance entry points.
- Redundant development of review, signing, version compatibility, and disable policies.
- Users struggling to understand where to actually find extensions.

The current phase will not actually implement a marketplace, but the direction needs to be frozen first to prevent documentation from continuing to diverge along different marketplace models.

## Decision

Phase 1a and 1b will not implement a marketplace.

In the long-term direction, Skills, Plugins, Templates and other extension capabilities will converge into a unified governance entry point, rather than maintaining multiple marketplace models.

This means:

- Currently, only the extension object model and governance contract will be preserved.
- When truly entering Phase 4, priority will be given to building a unified extension marketplace.

## Alternatives

### Option A: Maintain Multiple Marketplaces Long-term

Pros:

- Each extension type appears more tailored to its own semantics.

Costs:

- Heavy user mental load.
- Highly duplicated review, permission, signing, compatibility, deprecation, and billing capabilities.
- Significantly increased platform governance complexity.

### Option B: Implement Unified Marketplace Now

Pros:

- Most direct path.

Costs:

- Clearly beyond the current phase.
- Internal extension governance has not yet entered implementation. Doing marketplace now would only weigh down the platform.

### Option C: Current Decision

- Do not implement marketplace now.
- Long-term direction converges to unified entry point.
- First unify extension object, permission, and lifecycle at the contract layer.

## Reasons for Choosing This Option

- The most important thing in the current phase is internal extension boundaries, not marketplace product form.
- A unified governance entry point better aligns with long-term needs for permissions, approvals, signing, compatibility, and billing.
- Freezing the direction early can prevent documentation from continuing to introduce multiple parallel marketplace concepts.

## Key Invariants

- Skills, Plugins, and Templates should all go through the unified governance chain in the future.
- Installation units must not bypass ToolRegistry, Policy Engine, or permission review.
- Even if the frontend displays in separate columns, it does not mean the backend must maintain multiple marketplace kernels.

## Adoption Triggers

This direction should continue to be followed before formally entering the following topics:

- ecosystem extension plane.
- monetization metering plane.
- enterprise operations plane.

## Exit Conditions

If future evidence shows:

- Skills and Plugins have completely different lifecycles, risk models, and business models.
- Unified governance introduces higher complexity instead.

Then a new ADR may be opened to discuss splitting, but returning to multiple marketplaces evolving in parallel without a new decision is not permitted.

## Implementation Impact

Current documentation and subsequent implementation requirements:

- Use unified extension or installable or capability registry language in contracts and documentation.
- Phase 1a and 1b only handles registry, permissions, and installation boundaries. No marketplace UI or commercial distribution.
- If Phase 4 begins marketplace work, design directly from the unified governance entry point rather than building multiple marketplace sets first then merging.

## Results

Benefits:

- More consistent long-term governance.
- Simpler user mental model.
- Easier to unify permissions, signing, version compatibility, and billing.

Costs:

- Requires abstracting different extension types into the same governance model when actually implemented in the future.
- Some type-specific capabilities may require additional subtype rules rather than being handled completely flat.

## Cross-References

- [ADR-014 Organization Model Mapping to Code Objects](./014-org-model-code-boundary.md)
- [ADR-005 Security Model](./005-security-model.md)
- [ADR-010 Commercial Model](./010-commercial-model.md)

## Source Sections

- tool_skill_plugin_contract.md
- ecosystem_extension_plane_contract.md
