# ADR-119 Pack Domain Lifecycle Coordination

- Status: Accepted

## Background

Business Pack lifecycle, domain onboarding four phases, pack-domain association, and `trustTier` / `sandboxTier` constraints previously existed in different modules, lacking unified authoritative rules, easily leading to:

- Domain has entered `gray_rollout` or `active`, but pack still停留在 too early phase
- Pack is already `published` / `running`, but domain certification or canary is not yet complete
- After domain / pack deprecation, association relationship and default primary pack semantics are inconsistent
- `trustTier` and `sandboxTier` have no unified compatibility matrix

## Decision

- `domain_modeling` corresponds to pack `development`
- `pack_development` corresponds to pack `testing`
- `security_certification` corresponds to pack `certified`
- `gray_rollout` corresponds to pack `published` or `running`

- Domain must not advance to next onboarding phase when associated pack is still earlier than corresponding phase
- Before domain completes `gray_rollout` and enters `active`, associated primary pack must be at least `published`
- Before pack enters `published` / `running` from `certified`, associated domain must have completed `security_certification`

- When domain is `deprecated` / `archived`:
  - No new pack associations allowed
  - Packs already associated and in对外发布 state must first enter `deprecated` before domain is finally archived
- When pack is `deprecated` / `archived`:
  - Audit association may be retained
  - But must not continue as primary pack participating in new onboarding / routing decisions

- `trustTier` and `sandboxTier` use fail-closed compatibility matrix:
  - `internal` can use `read_only` / `workspace_write` / `scoped_external_access` / `restricted_exec`
  - `trusted` requires minimum `workspace_write`
  - `community` requires minimum `scoped_external_access`
  - `external` requires minimum `restricted_exec`

## Results

- Pack lifecycle, domain onboarding, association governance use the same set of phase mappings
- Canary, certification, deprecation no longer rely on implicit agreements
- `trustTier` / `sandboxTier` have clear authoritative matrix; subsequent registration and binding logic按此 fail-closed

## Related Implementation

- `src/domains/operations/domain-onboarding-service.ts`
- `src/domains/business-pack/pack-domain-association.ts`
- `src/sdk/pack-sdk/pack-lifecycle-orchestration-service.ts`
- `src/domains/business-pack/business-pack-manifest.ts`
- `src/domains/registry/domain-model.ts`