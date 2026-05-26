# ADR-119 Pack Domain Lifecycle Coordination

## Status
Accepted

## Background
Business Pack lifecycle stages, the four-phase domain onboarding flow, pack-domain associations, and `trustTier` / `sandboxTier` constraints previously lived in separate modules with no single authoritative rule set. That made it easy to drift into states such as:

- a domain reaching `gray_rollout` or `active` while its pack is still in an earlier stage
- a pack reaching `published` or `running` before domain certification or rollout is complete
- inconsistent association and primary-pack behavior during domain or pack retirement
- no fail-closed compatibility matrix for `trustTier` and `sandboxTier`

## Decision
- `domain_modeling` maps to pack stage `development`
- `pack_development` maps to pack stage `testing`
- `security_certification` maps to pack stage `certified`
- `gray_rollout` maps to pack stage `published` or `running`

- a domain must not advance to the next onboarding phase while its associated pack is still earlier than the required mapped stage
- before a domain completes `gray_rollout` and becomes `active`, its primary associated pack must be at least `published`
- before a pack moves from `certified` to `published` or `running`, its associated domain must already have completed `security_certification`

- when a domain becomes `deprecated` or `archived`:
  - no new pack associations are allowed
  - already-associated externally published packs must first move to `deprecated` before the domain can be fully archived
- when a pack becomes `deprecated` or `archived`:
  - audit associations may remain
  - it must no longer act as the primary pack for new onboarding or routing decisions

- `trustTier` and `sandboxTier` use a fail-closed compatibility matrix:
  - `internal` may use `read_only`, `workspace_write`, `scoped_external_access`, or `restricted_exec`
  - `trusted` requires at least `workspace_write`
  - `community` requires at least `scoped_external_access`
  - `external` requires at least `restricted_exec`

## Consequences
- pack lifecycle, domain onboarding, and association governance now share one stage mapping
- rollout, certification, and retirement no longer depend on implicit conventions
- `trustTier` and `sandboxTier` now have an explicit authoritative matrix, and future registration and binding logic must fail closed against it

## Related Implementation
- `src/domains/operations/domain-onboarding-service.ts`
- `src/domains/business-pack/pack-domain-association.ts`
- `src/sdk/pack-sdk/pack-lifecycle-orchestration-service.ts`
- `src/domains/business-pack/business-pack-manifest.ts`
- `src/domains/registry/domain-model.ts`
