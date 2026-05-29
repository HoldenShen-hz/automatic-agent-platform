# ADR-078 Knowledge Plane Architecture and Trust Model

- Status: Partially Superseded by current knowledge-plane contract baseline
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model, ADR-017 Knowledge Architecture Refactor

## Background

OAPEFLIR Learn Hub learning results need persistent storage and retrieval for subsequent tasks. Knowledge Plane is a sub-domain within P5 State&Evidence plane, providing unified knowledge ingestion, indexing, retrieval and governance capabilities, supporting BM25 keyword indexing, semantic vector indexing, and AST structure indexing three retrieval methods.

> Note: Knowledge Plane is a sub-domain of P5 State&Evidence, not an independent architectural plane. All Knowledge operations ultimately chain back to P5's truth/events system.

The existing `knowledge/` module (23 files) has already implemented a complete pipeline. This ADR formally establishes the Knowledge Plane governance architecture and trust model.

## Decision

### 1. KIP 5-Stage Pipeline

```
Intake → Extraction → Archive → Index → Query
   ↓         ↓           ↓         ↓       ↓
 Raw doc  Semantic    Cold      Three    Three
        extraction  storage    indexes  query levels
```

| Stage | Component | Responsibility |
|-------|------------|----------------|
| Intake | `KnowledgeIngestionPipeline` | Receive raw documents, format validation |
| Extraction | `KnowledgeExtractor` | Semantic extraction, chunking, summarization |
| Archive | `KnowledgeArchive` | Cold data persistence (SQLite) |
| Index | `KeywordIndexer` / `SemanticVectorStore` / `ASTIndexer` | Three index types maintenance |
| Query | `KnowledgeQueryService` | Quick/Standard/Deep three-level query |

### 2. Core Interfaces

```typescript
interface KnowledgeSource {
  sourceId: string;
  type: 'user_input' | 'system_generated' | 'external_api' | 'file_import';
  uri: string;
  trustLevel: TrustLevel;
  ingestedAt: string;
}

interface KnowledgeDocument {
  documentId: string;
  namespace: KnowledgeNamespace;
  title: string;
  chunks: KnowledgeChunk[];
  source: KnowledgeSource;
  trustLevel: TrustLevel;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

interface KnowledgeChunk {
  chunkId: string;
  content: string;
  embedding?: number[];      // Vector representation
  metadata: Record<string, unknown>;
}

interface RetrievalHit {
  chunkId: string;
  documentId: string;
  score: number;
  content: string;
  highlights: string[];
  citation: Citation;
}
```

### 3. 3 Index Strategies

| Index | Applicable Scenario | Implementation |
|-------|---------------------|----------------|
| `KeywordIndexer` (BM25) | Precise keyword matching | `keyword-index.ts` |
| `SemanticVectorStore` | Semantic similarity retrieval | `semantic-vector-store.ts` |
| `ASTIndexer` | Code structure retrieval | `ast-index.ts` |

### 4. 3 Query Levels

| Level | Response Time Target | Retrieval Scope |
|-------|---------------------|-----------------|
| `quick` | <100ms P99 | Keyword index only |
| `standard` | <500ms P99 | Keyword + semantic vector mixed |
| `deep` | <2000ms | All indexes + cross namespace |

### 5. 4-Level Trust Model

| Trust Level | Source | Purpose |
|-------------|--------|---------|
| `verified` | Manually reviewed content | Production decisions |
| `reviewed` | Validated by LearningObjectValidator | Improvement candidates |
| `inferred` | System inferred | Suggestions/references |
| `untrusted` | Unverified sources | Display only |

### 6. KnowledgeNamespace Governance

```typescript
interface KnowledgeNamespace {
  namespace: string;           // e.g., "system/learned-patterns"
  owner: string;
  retentionPolicy: RetentionPolicy;
  accessPolicy: AccessPolicy;
  chunkingMode: ChunkingMode;    // 'semantic' | 'recursive' | 'fixed_size'
}

interface RetentionPolicy {
  maxAgeDays: number;           // 0 = permanent
  maxSizeMB: number;
  archiveAfterDays: number;
}
```

### 7. Learn→Knowledge Integration

LearningObject injects into knowledge plane through `KnowledgePromotionService`:

```
FailurePatternMiner.mine()
    → LearningObject { kind: "failure_pattern", evidence: [...] }
    → LearningObjectValidator.validate()
    → KnowledgePromotionService.promote()
        → KnowledgePlaneService.ingest({
            source: { type: "system_generated", uri: "learning://failure_pattern/{id}" },
            document: { title: pattern.description, chunks: [pattern.recommendation] },
            namespace: "system/learned-patterns",
            trustLevel: "reviewed"
          })
    → Subsequent Observe stage can retrieve learned patterns
```

### 8. Citation Builder

```typescript
interface Citation {
  sourceId: string;
  sourceUri: string;
  trustLevel: TrustLevel;
  retrievedAt: string;
  chunkIds: string[];
}
```

## Alternative Solutions

### Option A: External Vector Database (Pinecone/Milvus)

Advantages: Best vector retrieval performance.
Trade-offs: Adds external dependency, does not comply with §L R1-NO-EXTERNAL-RUNTIME.

### Option B: Local SQLite + Vector Extension (selected)

Advantages: No external dependencies, complies with SQLite-first principle.
Trade-offs: Vector retrieval performance lower than dedicated vector databases.

## Consequences

- `knowledge-plane-service.ts` as Knowledge Plane entry point.
- `knowledge-ingestion-pipeline.ts` handles document ingestion.
- `knowledge-query-service.ts` (374 lines) provides three-level query.
- `knowledge-promotion-service.ts` implements Learn→Knowledge integration.
- `governance/namespace-policy.ts` manages namespace governance.
- `governance/source-trust-policy.ts` implements 4-level trust model.
- New event: `learning:knowledge_promoted` (Tier 2)

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-017 Knowledge Architecture Refactor](./017-knowledge-architecture-refactor.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)
- `src/platform/five-plane-state-evidence/knowledge/` module

## Source Section

- `§10` Knowledge Plane Design
- `§10.2` KIP 5-stage pipeline
- `§C.1-C.7` Governance layer design
- `§8.7` Learn→Knowledge integration
- `§L.9` R4-EVIDENCE constraint