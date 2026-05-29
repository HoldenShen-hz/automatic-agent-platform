# ADR-015 Whether Skill and Plugin Converge to Single Marketplace

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

Historical system materials have separately appeared Skill Marketplace, Plugin Marketplace, template marketplace and other extension entry points. If these concepts coexist long-term, will cause:

- Installation and permission governance entry points scattered
- Review, signature, version compatibility, and deprecation strategies built repeatedly
- Users difficult to understand "where to actually find extensions"

Current stage will not truly implement marketplace, but need to freeze direction first, avoid subsequent documents continuing to diverge along different market models.

## Decision

Phase 1a/1b does not implement marketplace.

Long-term direction, Skill, Plugin, template and other extension capabilities converge to unified governance entry point, rather than maintaining multiple market models.

This means:

- Currently only retain extension object model and governance contract
- When truly entering Phase 4, prioritize building unified extension marketplace

## Alternative Options

### Option A: Long-Term Maintain Multiple Markets

Benefits:

- Each extension type appears more "tailored to its own semantics".

Costs:

- Heavy user mental burden.
- Review, permissions, signature, compatibility, deprecation capabilities highly duplicated.
- Platform governance complexity significantly rises.

### Option B: Implement Unified Market Now

Benefits:

- Most direct path.

Costs:

- Clearly over-stage.
- Currently even internal extension governance not yet in implementation, doing marketplace prematurely只会把平台拉重.

### Option C: Current Decision

- Currently not implementing marketplace
- Long-term direction converges to unified entry
- First unify extension object, permission, and lifecycle at contract layer

## Reasons for This Choice

- Current stage most important is internal extension boundaries, not market product form.
- Unified governance entry more aligned with long-term needs of permissions, approval, signature, compatibility, and billing.
- Freezing direction first can prevent documents from continuing to show multiple parallel market concepts.

## Key Invariants

- Skill, Plugin, template future should all pass through unified governance chain.
- Installation units must not bypass ToolRegistry, Policy Engine, and permission review.
- Even if front-end displays in separate columns, does not mean backend needs to maintain multiple market cores.

## Adoption Triggers

Before formally entering the following topics, continue to abide by this direction:

- ecosystem extension plane
- monetization metering plane
- enterprise operations plane

## Exit Conditions

If future proves:

- Skill and Plugin lifecycle, risk model, business models completely different
- Unified governance complexity反而更高

Then may reopen ADR to discuss splitting, but cannot return to "multiple markets evolving in parallel" without new decision.

## Implementation Impact

Current documentation and subsequent implementation requirements:

- Use unified extension/installable/capability registry language in contracts and documentation
- Phase 1a/1b only does registry, permission, installation boundaries, not market UI or commercial distribution
- If Phase 4 starts marketplace, should directly design from unified governance entry, not first do multiple sets of markets then merge

## Results

Benefits:

- More consistent long-term governance.
- Simpler user mental model.
- Permissions, signature, version compatibility, and billing easier to unify.

Costs:

- When truly implementing in future, need to abstract different extension types into same governance model.
- Some type-specific capabilities may need additional subtype rules, not completely flat processing.

## Cross-References

- [ADR-014 Whether Organization Model Directly Maps to Code Objects](./014-org-model-code-boundary.md)
- [ADR-005 Security Model](./005-security-model.md)
- [ADR-010 Commercial Model](./010-commercial-model.md)

## Source Sections

- `tool_skill_plugin_contract.md`
- `ecosystem_extension_plane_contract.md`