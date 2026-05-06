# ADR-017 Knowledge Three-Index Architecture Refactor

- Status: Accepted
- Decision Date: 2026-04-17

## Background

The §10 design document defines three Knowledge indexes (Keyword / Semantic / Structural) and three-level queries (Quick / Standard / Deep). There are two major gaps in actual implementation:

1. **Semantic index uses SHA-256 hash pseudo-vector**: Not real neural network embedding, semantic similarity calculation degraded.
2. **Three-level queries not implemented**: Single `query()` method, no QueryLevel parameter.

## Decision

### Three Types of Indexes

| Index | Implementation | Description |
|-------|---------------|-------------|
| Keyword / FTS5 | `KeywordKnowledgeIndex` | Implemented, inverted index |
| Semantic / vector | `SemanticVectorStore` + EmbeddingProvider | Warning: Currently hash pseudo-vector, needs upgrade to LLM provider embedding |
| Structural / AST | `ASTIndex` | Not implemented (GAP-OAPEFLIR-06) |

### Three-Level Queries

| Level | Trigger Condition | Data Layer | Latency Target | topK |
|-------|-------------------|------------|----------------|------|
| **Quick** | confidence ≥ 0.5, no cache hit | L1 runtime cache only | <50ms | 3 |
| **Standard** | Default level | L1 + keyword + semantic | <200ms | 10 |
| **Deep** | confidence < 0.5 or explicit request | Full layers + graph traversal | <2s | 30 |

### Semantic Embedding Upgrade Path

```
Current: SHA-256 hash → 32-dimension pseudo-vector (local-hash-v1: prefix)
Target: LLM provider /embeddings API → real vector → pgvector storage
Degraded: AA_KNOWLEDGE_EMBEDDING_PROVIDER=hash can fall back to pseudo-vector mode
```

### New Files

- `src/core/knowledge/knowledge-query-service.ts` (implemented): Three-level query service.
- `src/core/knowledge/indexing/embedding-provider.ts`: Embedding provider abstraction (partially implemented).

## Consequences

- GAP-V2-02 (hash embedding → real embedding) is core work for subsequent Knowledge quality.
- GAP-V2-11 (three-level queries) already implemented, QueryLevel can be used through `KnowledgeQueryService`.
- AST Structural index (GAP-OAPEFLIR-06) pending implementation, after completion Deep query can use structured code index.

## Alternative Solutions

1. **Continue using hash pseudo-vector**: Low cost, but semantic similarity calculation degraded, Knowledge quality cannot improve.
2. **Use local embedding model** (like TF-IDF / BM25): No external dependencies, but effect less than LLM embedding.
3. **Adopt this decision**: Upgrade to LLM provider embedding, provide real vector semantics for semantic search.

## Cross References

- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-020 Memory Six-Plane Model](./020-memory-six-plane-model.md)

## Source Sections

- `§10 Knowledge Plane`
- `§29 Memory and Knowledge`
