# ADR-015 Whether Skill and Plugin Converge to Single Marketplace

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Historical materials of the system have separately appeared with multiple extension entry points like Skill Marketplace, Plugin Marketplace, and template market. If these concepts coexist long-term, it will lead to:

- Scattered installation and permission governance entry points
- Duplicate construction of review, signature, version compatibility, and disable policies
- Users find it difficult to understand "where to actually find extensions"

Current stage will not really implement marketplace, but need to freeze direction first to prevent documentation from continuing to diverge along different market models.

## Decision

Do not implement marketplace in Phase 1a/1b.

Long-term direction: Skill, Plugin, template and other extension capabilities converge to unified governance entry point, rather than maintaining multiple market models.

This means:

- Currently only preserve extension object model and governance contract
- When truly entering Phase 4, prioritize building unified extension marketplace

## Alternatives

### Option A: Long-Term Maintain Multiple Markets

Benefits:

- Each extension type appears more "tailored to its own semantics".

Costs:

- Heavy user mental burden.
- Highly duplicated review, permission, signature, compatibility, deprecation, and billing capabilities.
- Significantly increased platform governance complexity.

### Option B: Implement Unified Market Now

Benefits:

- Most direct path.

Costs:

- Clearly beyond stage.
- Currently even internal extension governance has not yet entered implementation; doing marketplace prematurely will only weigh down the platform.

### Option C: Current Decision

- Currently not implementing marketplace
- Long-term direction converges to unified entry point
- First unify extension object, permission, and lifecycle at contract layer

## Reasons for Choosing This Approach

- Most important at current stage is internal extension boundary, not marketplace product form.
- Unified governance entry point better aligns with long-term needs of permission, approval, signature, compatibility, and billing.
- Freezing direction first can prevent documentation from continuing to show multiple parallel market concepts.

## Key Invariants

- Skill, Plugin, template should all go through unified governance chain in the future.
- Installation units must not bypass ToolRegistry, Policy Engine, and permission review.
- Even if front-end displays in columns, does not mean back-end needs to maintain multiple market kernels.

## Adoption Triggers

Before formally entering the following topics, should continue to abide by this direction:

- ecosystem extension plane
- monetization metering plane
- enterprise operations plane

## Exit Conditions

If future evidence proves:

- Skill and Plugin have completely different lifecycle, risk model, and business model
- Unified governance complexity is反而更高

Then may reopen ADR discussion on splitting, but cannot return to "multiple markets evolving in parallel" without new decision.

## Implementation Impact

Current documentation and subsequent implementation requirements:

- Use unified extension/installable/capability registry language in contracts and documentation
- Phase 1a/1b only do registry, permission, installation boundary, not marketplace UI or commercial distribution
- If Phase 4 begins marketplace, should design directly from unified governance entry point, not first do multiple market sets then merge

## Results

Benefits:

- More consistent long-term governance.
- Simpler user mental model.
- Easier to unify permission, signature, version compatibility, and billing.

Costs:

- Need to, when actually implementing in the future, abstract different extension types into the same governance model.
- Some type-specific capabilities may need additional subtype rules rather than completely flat handling.

## Cross-References

- [ADR-014 Whether Organization Model Directly Maps to Code Objects](./014-org-model-code-boundary.md)
- [ADR-005 Security Model](./005-security-model.md)
- [ADR-010 Commercial Model](./010-commercial-model.md)

## Source Sections

- `tool_skill_plugin_contract.md`
- `ecosystem_extension_plane_contract.md`
