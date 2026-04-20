# ADR-017 Knowledge Three-Index Architecture Refactor

- Status: Accepted
- Decision Date: 2026-04-17

## Context

§10 design document defines Knowledge three indexes (Keyword/Semantic/Structural) and three-level queries (Quick/Standard/Deep). Actual implementation has two major gaps:

1. **Semantic index uses SHA-256 hash pseudo-vector**: Not real neural network embedding, semantic similarity calculation degraded.
2. **Three-level queries not implemented**: Single `query()` method, no QueryLevel parameter.

## Decision

### Three Types of Indexes

| Index | Implementation | Description |
|-------|---------------|-------------|
| Keyword / FTS5 | `KeywordKnowledgeIndex` | ✅ Implemented, inverted index |
| Semantic / vector | `SemanticVectorStore` + EmbeddingProvider | ⚠️ Currently hash pseudo-vector, needs upgrade to LLM provider embedding |
| Structural / AST | `ASTIndex` | ❌ To implement (GAP-OAPEFLIR-06) |

### Three-Level Queries

| Level | Trigger Condition | Data Layer | Latency Target | topK |
|-------|-------------------|------------|-----------------|------|
| **Quick** | confidence ≥ 0.5, no cache hit | L1 runtime cache only | <50ms | 3 |
| **Standard** | Default level | L1 + keyword + semantic | <200ms | 10 |
| **Deep** | confidence < 0.5 or explicit request | Full layer + graph traversal | <2s | 30 |

### Semantic Embedding Upgrade Path

```
Current: SHA-256 hash → 32-dim pseudo-vector (local-hash-v1: prefix)
Target: LLM provider /embeddings API → real vector → pgvector storage
Fallback: AA_KNOWLEDGE_EMBEDDING_PROVIDER=hash can fall back to pseudo-vector mode
```

### New Files

- `src/core/knowledge/knowledge-query-service.ts` (implemented): Three-level query service.
- `src/core/knowledge/indexing/embedding-provider.ts`: Embedding provider abstraction (partially implemented).

## Consequences

- GAP-V2-02 (hash embedding → real embedding) is core work for subsequent Knowledge quality.
- GAP-V2-11 (three-level queries) implemented, QueryLevel can be used through `KnowledgeQueryService`.
- AST Structural index (GAP-OAPEFLIR-06) to implement, after completion Deep queries can use structured code index.
