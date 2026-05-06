# ADR-015 Whether Skill and Plugin Converge to Single Marketplace

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

Historical materials of the system have separately appeared with multiple extension entry points such as Skill Marketplace, Plugin Marketplace, and Template Marketplace. If these concepts coexist for a long time, it will lead to:

- Scattered installation and permission governance entry points
- Duplicate construction of review, signature, version compatibility, and disable policies
- Users having difficulty understanding "where to actually find extensions"

The current stage will not truly implement marketplace, but need to first freeze direction to prevent documents from continuing to diverge along different market models.

## Decision

Phase 1a / 1b does not implement marketplace.

In the long-term direction, Skill, Plugin, template, and other extension capabilities converge to a unified governance entry point, rather than maintaining multiple market models.

This means:

- Currently only retain extension object model and governance contract
- When truly entering Phase 4, prioritize building unified extension marketplace

## Alternative Solutions

### Solution A: Long-Term Maintain Multiple Markets

Advantages:

- Each extension type looks more "tailored to its own semantics".

Costs:

- Heavy user mental model burden.
- Review, permissions, signature, compatibility, delisting, and billing capabilities highly duplicated.
- Platform governance complexity significantly increases.

### Solution B: Implement Unified Market Now

Advantages:

- Most direct path.

Costs:

- Clearly exceeds current stage.
- Even internal extension governance has not yet entered implementation, doing marketplace prematurely will only weigh down the platform.

### Solution C: Current Decision Solution

- Currently not implementing marketplace
- Long-term direction converges to unified entry
- First unify extension object, permission, and lifecycle at contract layer

## Reasons for Choosing This Solution

- Currently most important is internal extension boundaries, not marketplace product form.
- Unified governance entry better aligns with long-term needs of permissions, approval, signature, compatibility, and billing.
- Freezing direction early can prevent documents from continuing to show multiple parallel market concepts.

## Key Invariants

- Skill, Plugin, and template should all go through unified governance chain in the future.
- Installation units must not bypass ToolRegistry, Policy Engine, and permission review.
- Even if front-end displays in separate columns, does not mean back-end needs to maintain multiple market cores.

## Adoption Triggers

Should continue complying with this direction before formally entering:

- ecosystem extension plane
- monetization metering plane
- enterprise operations plane

## Exit Conditions

If future proof:

- Skill and Plugin have completely different lifecycle, risk model, and business model
- Unified governance brings higher complexity instead

Then can reopen ADR to discuss splitting, but cannot return to "multiple markets evolving in parallel" without new decision.

## Implementation Impact

Current documentation and subsequent implementation requirements:

- Contract and documents try to use unified extension / installable / capability registry language
- Phase 1a / 1b only do registry, permissions, and installation boundaries, not marketplace UI or commercial distribution
- If Phase 4 starts marketplace, should directly design from unified governance entry, rather than first doing multiple sets of markets then merging

## Results

Advantages:

- More consistent long-term governance.
- Simpler user mental model.
- Easier to unify permissions, signature, version compatibility, and billing.

Costs:

- Need to, when truly implementing in the future, abstract different extension types into the same governance model.
- Some type-specific capabilities may need additional subtype rules, rather than completely flat processing.

## Cross References

- [ADR-014 Whether Org Model Directly Maps to Code Objects](./014-org-model-code-boundary.md)
- [ADR-005 Security Model](./005-security-model.md)
- [ADR-010 Commercial Model](./010-commercial-model.md)

## Source Sections

- `tool_skill_plugin_contract.md`
- `ecosystem_extension_plane_contract.md`
