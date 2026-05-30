# Memory Decay And Quality Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

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

This contract defines the layered model for the memory system, token budgets, promotion, decay, revocation, freshness, and permission linkage rules.

Related documents:

- `perception_contract.md` (Observe compatibility file)
- `perception_intelligence_plane_contract.md` (Observe/Assess compatibility file)
- `context_compaction_and_overflow_contract.md`
- `data_classification_and_prompt_handling_contract.md`
- `tenant_and_organization_contract.md`

## 2. Objectives

- Enable the memory system to not only store but also govern, expire, demote, revoke, and isolate by layer.
- Make memory quality evaluable, not just looking at hit rate.
- Prevent cross-tenant, cross-project, and cross-role memory contamination.

## 3. Six-Layer Memory Model

Memory canonical is divided into six layers `L1-L6`:

| Layer | Scope | Typical Content | Budget Characteristics |
| --- | --- | --- | --- |
| `L1` | turn / transient | Current turn temporary context, tool return summaries | Smallest and highest frequency replacement |
| `L2` | task | Current task working memory, short-term plan threads | Small budget, can expire quickly |
| `L3` | session | Session-level stable facts, local preferences | Small to medium budget |
| `L4` | project | Project conventions, repository structure, long-term work patterns | Medium budget |
| `L5` | org / curated | Reviewed organizational experience, best practices | Governed, higher retention priority |
| `L6` | evolution | Long-term knowledge absorbed by learn/improve/promote | No fixed capacity upper limit, but must be auditable |

Rules:

- `L1-L4` allow more aggressive decay and pruning.
- `L5-L6` have higher entry barriers and must undergo classification, trust, and promotion rules.
- `L6` has no fixed capacity upper limit but cannot exempt from freshness, revocation, and lineage constraints.

## 4. Token Budget and Injection Boundaries

Each layer must declare at minimum:

- `token_budget`
- `eviction_threshold`
- `retrieval_priority`
- `promotion_eligibility`

Constraints:

- Memory must not be blindly injected by "recency" alone; it must first undergo relevance retrieval.
- `L5-L6` are not directly bulk-injected by default; they are injected on-demand through retrieval and explainability results.
- During compaction, prioritize preserving memory directly related to the current task / workflow / feedback / learning.

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
- Freshness demotion

Rules:

- `stale` does not equal immediate deletion; it may be demoted with lineage preserved.
- `revoked` memory must not re-enter the model context.
- If external source memory trust tier decreases, retrieval priority must be synchronously lowered at minimum.

## 6. Promotion Rules

### 6.1 Canonical Promotion Path

Default promotion path:

`L1 -> L2 -> L3 -> L4 -> L5 -> L6`

Constraints:

- Bypassing `L5` to write ungoverned content to `L6` is not allowed.
- `L5-L6` promotion must preserve source `ArtifactRef / EvidenceRef / MemoryRef / KnowledgeRef`.
- `FeedbackSignal / LearningObject / ImprovementCandidate` may serve as promotion basis but cannot replace governance checks.

### 6.2 Pre-Promotion Checks

Before entering `L5-L6`, check at minimum:

- tenant / workspace / role scope
- data classification
- source trust level
- freshness
- conflict / duplication
- whether upstream evidence exists

## 7. Canonical Objects

- `MemoryEntry`
- `MemoryLayerPolicy`
- `MemoryPromotionRecord`
- `MemoryDecayProfile`
- `MemoryQualityReport`
- `MemoryRevocation`
- `MemoryScopeBoundary`
- `MemoryRetrievalRecord`
- `ExperienceRecord`

Minimum recommended fields:

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

- Long-term memory and experience cache must not be directly injected by "recency"; they must first undergo relevance retrieval.
- The current phase allows `FTS5 / keyword recall`; `embedding / rerank` may be added later.
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

Memory access must simultaneously be constrained by the following boundaries:

- tenant
- workspace / project
- role
- data classification
- source trust level

Supplementary rules:

- `restricted` data must not enter `L5-L6` by default.
- Learning objects or high-layer memory containing confidential information must be desensitized before entering the governance chain.
- Providers may only supply memory content and retrieval results and cannot bypass permission boundaries.

## 11. Memory Provider Lifecycle Interface

If the system supports pluggable memory backends, the provider seam must define at minimum:

- `initialize`
- `system_prompt_block`
- `prefetch`
- `queue_prefetch`
- `sync_turn`
- `shutdown`

Rules:

- `prefetch` should prioritize serving the next round of injection; recommended to form an async recall loop with `queue_prefetch`.
- The authoritative / additive relationship between built-in memory and external memory backend must be clear and auditable.
- If a provider hook fails, it should default to "do not inject additional memory" and must not disrupt primary task execution.

## 12. Conclusion

An industrial-grade memory system cannot default to "once stored, always trusted".

It must have:

- Six-layer memory with token budget governance
- Freshness tracking and decay
- Cross-layer promotion and revocation
- Quality evaluation
- Scope isolation
- Pre-injection permission checks