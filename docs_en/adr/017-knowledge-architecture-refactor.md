# ADR-017 Knowledge Three-Index Architecture Refactor

- Status: Accepted
- Decision Date: 2026-04-17

## Background

The §10 design document defined three Knowledge indexes (Keyword/Semantic/Structural) and three-level queries (Quick/Standard/Deep). Actual implementation has two significant gaps:

1. **Semantic index uses SHA-256 hash pseudo-vector**: Not real neural network embedding, semantic similarity calculation degraded.
2. **Three-level query not implemented**: Single `query()` method without QueryLevel parameter.

## Decision

### Three Indexes

| Index | Implementation | Description |
|-------|---------------|-------------|
| Keyword / FTS5 | `KeywordKnowledgeIndex` | ✅ Implemented, inverted index |
| Semantic / vector | `SemanticVectorStore` + EmbeddingProvider | ⚠️ Currently hash pseudo-vector, needs upgrade to LLM provider embedding |
| Structural / AST | `ASTIndex` | ❌ To implement (GAP-OAPEFLIR-06) |

### Three-Level Query

| Level | Trigger Condition | Data Layer | Latency Target | topK |
|-------|------------------|-------------|----------------|------|
| **Quick** | confidence >= 0.5, no cache hit | L1 runtime cache only | <50ms | 3 |
| **Standard** | Default level | L1 + keyword + semantic | <200ms | 10 |
| **Deep** | confidence < 0.5 or explicit request | All layers + graph traversal | <2s | 30 |

### Semantic Embedding Upgrade Path

```
Current: SHA-256 hash → 32-dim pseudo-vector (local-hash-v1: prefix)
Target: LLM provider /embeddings API → real vector → pgvector storage
Fallback: AA_KNOWLEDGE_EMBEDDING_PROVIDER=hash can fall back to pseudo-vector mode
```

### New Files

- `src/platform/five-plane-state-evidence/knowledge/knowledge-query-service.ts` (implemented): Three-level query service.
- `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts`: Embedding provider abstraction (partially implemented).

## Consequences

- GAP-V2-02 (hash embedding → real embedding) is core work for subsequent Knowledge quality.
- GAP-V2-11 (three-level query) implemented, QueryLevel available via `KnowledgeQueryService`.
- AST Structural index (GAP-OAPEFLIR-06) to implement; after completion, Deep query can use structured code indexes.

## Alternative Options

1. **Continue using hash pseudo-vector**: Low cost, but semantic similarity calculation degraded, Knowledge quality cannot improve.
2. **Use local embedding model** (e.g., TF-IDF/BM25): No external dependencies, but effect inferior to LLM embedding.
3. **Adopt this decision**: Upgrade to LLM provider embedding, providing real vector semantics for semantic search.

## Cross-References

- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-020 Memory Six-Plane Model](./020-memory-six-plane-model.md)

## Source Sections

- `§10 Knowledge Plane`
- `§29 Memory and Knowledge`