# ADR-119 Pack Domain Lifecycle Coordination

## Status
Accepted

## Background
Business Pack lifecycle, domain onboarding four phases, pack-domain association, and `trustTier` / `sandboxTier` constraints previously existed in different modules, lacking unified authoritative rules, easily leading to:

- Domain has entered `gray_rollout` or `active`, but pack still at too early phase
- Pack has `published` / `running`, but domain certification or rollout not yet completed
- After domain / pack decommissioning, association and default primary pack semantics inconsistent
- `trustTier` and `sandboxTier` no unified compatibility matrix

## Decision
- `domain_modeling` corresponds to pack `development`
- `pack_development` corresponds to pack `testing`
- `security_certification` corresponds to pack `certified`
- `gray_rollout` corresponds to pack `published` or `running`

- Domain cannot advance to next onboarding phase when associated pack is still earlier than corresponding phase
- Before domain completes `gray_rollout` and enters `active`, associated primary pack must be at least `published`
- Before pack goes from `certified` to `published` / `running`, associated domain must have completed `security_certification`

- When domain is `deprecated` / `archived`:
  - No new pack association allowed
  - Associated packs in external release state must first enter `deprecated`, then allow domain final archive
- When pack is `deprecated` / `archived`:
  - Allow retention of audit association
  - But cannot continue as primary pack for new onboarding / routing decisions

- `trustTier` and `sandboxTier` use fail-closed compatibility matrix:
  - `internal` can use `read_only` / `workspace_write` / `scoped_external_access` / `restricted_exec`
  - `trusted` minimum requires `workspace_write`
  - `community` minimum requires `scoped_external_access`
  - `external` minimum requires `restricted_exec`

## Result
- Pack lifecycle, domain onboarding, association governance adopt same set of phase mappings
- Rollout, certification, decommissioning no longer rely on implicit agreements
- `trustTier` / `sandboxTier` have clear authoritative matrix, subsequent registration and binding logic按此fail-closed

## Related Implementation
- `src/domains/operations/domain-onboarding-service.ts`
- `src/domains/business-pack/pack-domain-association.ts`
- `src/sdk/pack-sdk/pack-lifecycle-orchestration-service.ts`
- `src/domains/business-pack/business-pack-manifest.ts`
- `src/domains/registry/domain-model.ts`
