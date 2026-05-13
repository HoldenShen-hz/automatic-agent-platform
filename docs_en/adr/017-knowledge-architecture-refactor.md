# ADR-017 Knowledge Three-Index Architecture Refactor

- Status: Accepted
- Decision Date: 2026-04-17

## Background

The Section 10 design document defines three Knowledge indexes (Keyword, Semantic, Structural) and three query levels (Quick, Standard, Deep). The actual implementation has two significant gaps:

1. **Semantic index uses SHA-256 hash pseudo-vectors**: Not real neural network embeddings. Semantic similarity calculation is degraded.
2. **Three query levels not implemented**: Single query() method, no QueryLevel parameter.

## Decision

### Three Index Types

| Index | Implementation | Description |
|-------|----------------|-------------|
| Keyword and FTS5 | KeywordKnowledgeIndex | Implemented, inverted index |
| Semantic and vector | SemanticVectorStore plus EmbeddingProvider | Currently hash pseudo-vectors, needs upgrade to LLM provider embedding |
| Structural and AST | ASTIndex | Not implemented (GAP-OAPEFLIR-06) |

### Three Query Levels

| Level | Trigger Condition | Data Layer | Latency Target | topK |
|-------|-------------------|------------|---------------|------|
| **Quick** | confidence greater than or equal to 0.5, no cache hit | L1 runtime cache only | less than 50ms | 3 |
| **Standard** | Default level | L1 plus keyword plus semantic | less than 200ms | 10 |
| **Deep** | confidence less than 0.5 or explicit request | Full layer plus graph traversal | less than 2s | 30 |

### Semantic Embedding Upgrade Path

```
Current: SHA-256 hash to 32-dimension pseudo-vector (local-hash-v1: prefix)
Target: LLM provider /embeddings API to Real vector to pgvector storage
Fallback: AA_KNOWLEDGE_EMBEDDING_PROVIDER=hash can fall back to pseudo-vector mode
```

### New Files

- src/core/knowledge/knowledge-query-service.ts (implemented): Three-level query service.
- src/core/knowledge/indexing/embedding-provider.ts: Embedding provider abstraction (partially implemented).

## Consequences

- GAP-V2-02 (hash embedding to real embedding) is the core work for subsequent Knowledge quality.
- GAP-V2-11 (three-level query) is implemented. QueryLevel can be used through KnowledgeQueryService.
- AST Structural index (GAP-OAPEFLIR-06) is pending implementation. Once completed, Deep query can use structured code indexing.

## Alternatives

1. **Continue using hash pseudo-vectors**: Low cost, but semantic similarity calculation degrades and Knowledge quality cannot improve.
2. **Use local embedding models** (e.g., TF-IDF or BM25): No external dependencies, but effect is inferior to LLM embedding.
3. **Adopt this decision**: Upgrade to LLM provider embedding to provide real vector semantics for semantic search.

## Cross-References

- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-020 Memory Six-Plane Model](./020-memory-six-plane-model.md)

## Source Sections

- Section 10 Knowledge Plane
- Section 29 Memory and Knowledge
