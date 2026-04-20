# Memory Decay And Quality Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines the hierarchical model, token budget, promotion, decay, revocation, freshness, and permission linkage rules for the memory system.

Related documents:

- `perception_contract.md` (Observe compatible file)
- `perception_intelligence_plane_contract.md` (Observe/Assess compatible file)
- `context_compaction_and_overflow_contract.md`
- `data_classification_and_prompt_handling_contract.md`
- `tenant_and_organization_contract.md`

## 2. Goals

- Enable the memory system to not only store but also govern, expire, demote, revoke, and isolate by layer.
- Make memory quality evaluable, not just looking at hit rate.
- Prevent cross-tenant, cross-project, and cross-role memory contamination.

## 3. Six-Layer Memory Model

Memory canonical is divided into six layers `L1-L6`:

| Layer | Scope | Typical Content | Budget Characteristics |
| --- | --- | --- | --- |
| `L1` | turn / transient | Current turn temporary context, tool return summary | Smallest and most frequently replaced |
| `L2` | task | Current task working memory, short-term plan clues | Small budget, can expire quickly |
| `L3` | session | Session-level stable facts, local preferences | Small to medium budget |
| `L4` | project | Project conventions, repository structure, long-term work patterns | Medium budget |
| `L5` | org / curated | Audited organizational experience, best practices | Governed, higher retention priority |
| `L6` | evolution | Long-term knowledge absorbed by learn/improve/promote | No fixed capacity limit, but must be auditable |

Rules:

- `L1-L4` allow more aggressive decay and pruning.
- `L5-L6` have higher entry barriers and must go through classification, trust, and promotion rules.
- `L6` has no fixed capacity limit but cannot be exempt from freshness, revocation, and lineage constraints.

## 4. Token Budget and Injection Boundaries

Each layer must declare at least:

- `token_budget`
- `eviction_threshold`
- `retrieval_priority`
- `promotion_eligibility`

Constraints:

- Memory cannot be blindly injected by "recency" alone; it must first go through relevance retrieval.
- `L5-L6` are not directly fully injected by default; they are injected on-demand through retrieval and explainability results.
- During compaction, prioritize preserving memories directly related to current task / workflow / feedback / learning.

## 5. Freshness and Decay

### 5.1 Freshness States

Each memory entry must have at least one of the following freshness states:

- `fresh`
- `aging`
- `stale`
- `revoked`
- `archived`

### 5.2 Decay Strategies

At minimum support:

- TTL or time-window expiration
- Confidence degradation
- Conflicting memory merging
- Erroneous memory revocation
- External source isolation
- Freshness degradation

Rules:

- `stale` does not equal immediate deletion; lineage can be preserved at reduced priority.
- `revoked` memory must not enter the model context again.
- If external source memory trust tier degrades, retrieval priority should be synchronously lowered.

## 6. Promotion Rules

### 6.1 Canonical Promotion Path

Default promotion path:

`L1 -> L2 -> L3 -> L4 -> L5 -> L6`

Constraints:

- Cannot bypass `L5` to write ungoverned content directly to `L6`.
- `L5-L6` promotion must preserve source `ArtifactRef / EvidenceRef / MemoryRef / KnowledgeRef`.
- `FeedbackSignal / LearningObject / ImprovementCandidate` can serve as promotion basis but cannot replace governance checks.

### 6.2 Pre-Promotion Checks

Before entering `L5-L6`, at minimum check:

- tenant / workspace / role scope
- data classification
- source trust level
- freshness
- conflict / duplication
- whether upstream evidence exists

## 7. Core Objects

- `MemoryEntry`
- `MemoryLayerPolicy`
- `MemoryPromotionRecord`
- `MemoryDecayProfile`
- `MemoryQualityReport`
- `MemoryRevocation`
- `MemoryScopeBoundary`
- `MemoryRetrievalRecord`
- `ExperienceRecord`

Recommended minimum fields:

```ts
interface MemoryEntry {
  memory_ref: MemoryRef;
  layer: "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
  scope: "task" | "session" | "project" | "org";
  freshness_state: "fresh" | "aging" | "stale" | "revoked" | "archived";
  token_budget?: number;
  source_refs?: Array<ArtifactRef | EvidenceRef | KnowledgeRef | MemoryRef>;
}
```

## 8. Retrieval and Experience Reuse

- Long-term memory and experience cache should not be directly injected by "recency"; they must first go through relevance retrieval.
- Current phase allows `FTS5 / keyword recall`, with `embedding / rerank` to be added later.
- `MemoryRetrievalRecord` must record at minimum: query, matched entries, reason, injected / not_injected, quality outcome, target layer.
- `ExperienceRecord` must support at minimum: perfect match cache, similar experience retrieval, few-shot injection provenance.

## 9. Quality Metrics

Must be able to record and analyze:

- `hit_rate`
- `post_hit_usefulness`
- `false_citation_rate`
- `staleness_rate`
- `contamination_rate`
- `promotion_success_rate`
- `memory_injection_accept_rate`

## 10. Permission Linkage

Memory access must be constrained by the following boundaries simultaneously:

- tenant
- workspace / project
- role
- data classification
- source trust level

Supplementary rules:

- `restricted` data must not enter `L5-L6` by default.
- Learning objects or high-layer memory containing confidential information must be deidentified before entering the governance chain.
- Providers can only supply memory content and retrieval results; they cannot bypass permission boundaries.

## 11. Memory Provider Lifecycle Interface

If the system supports pluggable memory backend, the provider seam must define at minimum:

- `initialize`
- `system_prompt_block`
- `prefetch`
- `queue_prefetch`
- `sync_turn`
- `shutdown`

Rules:

- `prefetch` should prioritize serving the next round of injection; it is recommended to form an asynchronous recall loop with `queue_prefetch`.
- The authoritative / additive relationship between built-in memory and external memory backend must be clear and auditable.
- If a provider hook fails, it should default to "do not inject additional memory"; it must not break main task execution.

## 12. Closure Conclusion

Industrial-grade memory systems cannot default to "stored and always trusted".

It must have:

- Six-layer memory with token budget governance
- Freshness tracking and decay
- Inter-layer promotion and revocation
- Quality evaluation
- Scope isolation
- Pre-injection permission checks
