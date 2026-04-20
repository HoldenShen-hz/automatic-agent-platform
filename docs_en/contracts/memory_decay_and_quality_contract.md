# Memory Decay And Quality Contract

## 1. Scope

This contract defines the memory system's decay, quality evaluation, revocation, and permission linkage rules.

Related documents:

- `perception_contract.md`
- `perception_intelligence_plane_contract.md`
- `data_classification_and_prompt_handling_contract.md`
- `tenant_and_organization_contract.md`

## 2. Goals

- Let memory system not only store but also expire, degrade, revoke, and isolate.
- Let memory quality be evaluable, not just looking at hit rate.
- Prevent cross-tenant, cross-project, and cross-role memory contamination.

## 3. Decay Strategies

At minimum supports:

- Expiration cleanup
- Confidence degradation
- Conflicting memory merging
- Erroneous memory revocation
- External source memory isolation

## 4. Quality Metrics

Must be recordable and analyzable:

- hit rate
- post-hit usefulness
- false citation rate
- staleness rate
- contamination rate

## 5. Permission Linkage

Memory access must simultaneously be constrained by the following boundaries:

- tenant
- workspace / project
- role
- data classification
- source trust level

## 6. Core Objects

- `MemoryEntry`
- `MemoryDecayProfile`
- `MemoryQualityReport`
- `MemoryRevocation`
- `MemoryScopeBoundary`
- `MemoryRetrievalRecord`
- `ExperienceRecord`

## 6A. Retrieval and Experience Reuse

- Long-term memory and experience cache should not be directly injected by "recent" order; must first go through relevance retrieval.
- Phase 1 allows using `FTS5 / keyword recall`, later can supplement `embedding / rerank`.
- `MemoryRetrievalRecord` at minimum should record: query, matched entries, reason, injected/not_injected, quality outcome.
- `ExperienceRecord` at minimum should support: perfect match cache, similar experience retrieval, few-shot injection provenance.

## 6B. Memory Provider Lifecycle Interface

If the system later supports pluggable memory backend, provider seam at minimum should explicitly define:

- `initialize`
- `system_prompt_block`
- `prefetch`
- `queue_prefetch`
- `sync_turn`
- `shutdown`

Supplementary rules:

- `prefetch` should prioritize serving "next round injection," recommended to form async recall closed loop with `queue_prefetch`, not each round synchronously blocking main execution chain.
- Provider can only provide memory content and retrieval results and cannot bypass `tenant / workspace / role / data classification` boundary.
- The relationship between built-in memory and external memory backend must be clear: whether additive, who is authoritative, who only does augmentation, must be auditable.
- If provider hook fails, should default to "do not inject additional memory" and must not break main task execution.

## 7. Closure Conclusion

Industrial-grade memory system cannot default to "stored and always trusted."

It must have:

- Forgetting and revocation
- Quality evaluation
- Scope isolation
- Pre-model permission check
