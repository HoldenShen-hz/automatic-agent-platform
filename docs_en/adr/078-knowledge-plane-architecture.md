# ADR-078: Knowledge Plane Architecture and Trust Model

- Status: Partially Superseded by current knowledge-plane contract baseline
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model, ADR-017 Knowledge Architecture Refactor

## Context

Learning outcomes produced by the OAPEFLIR Learn Hub need persistent storage and retrieval for subsequent tasks. The Knowledge Plane is a sub-domain within the P5 State&Evidence plane, providing unified knowledge ingestion, indexing, retrieval, and governance capabilities. It supports three retrieval methods: BM25 keyword indexing, semantic vector indexing, and AST structure indexing.

> Note: The Knowledge Plane is a sub-domain of P5 State&Evidence, not an independent architectural plane. All Knowledge operations ultimately link back to P5's truth/events system.

The existing `knowledge/` module (23 files) already implements a complete pipeline. This ADR formally establishes the governance architecture and trust model for the Knowledge Plane.

## Decision

### 1. KIP 5-Stage Pipeline

```
Intake → Extraction → Archive → Index → Query
   ↓         ↓           ↓         ↓       ↓
 Raw Doc  Semantic   Cold      Three    Three
         Extraction Storage    Index Types Query Levels
```

| Stage | Component | Responsibility |
|-------|-----------|----------------|
| Intake | `KnowledgeIngestionPipeline` | Receives raw documents, performs format validation |
| Extraction | `KnowledgeExtractor` | Semantic extraction, chunking, summarization |
| Archive | `KnowledgeArchive` | Cold data persistence (SQLite) |
| Index | `KeywordIndexer` / `SemanticVectorStore` / `ASTIndexer` | Maintains three index types |
| Query | `KnowledgeQueryService` | Quick/Standard/Deep three-tier query |

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

### 3. Three Index Strategies

| Index | Use Case | Implementation |
|-------|----------|----------------|
| `KeywordIndexer` (BM25) | Exact keyword matching | `keyword-index.ts` |
| `SemanticVectorStore` | Semantic similarity retrieval | `semantic-vector-store.ts` |
| `ASTIndexer` | Code structure retrieval | `ast-index.ts` |

### 4. Three Query Levels

| Level | Response Time Target | Retrieval Scope |
|-------|---------------------|-----------------|
| `quick` | <100ms P99 | Keyword index only |
| `standard` | <500ms P99 | Keyword + semantic vector hybrid |
| `deep` | <2000ms | All indexes + cross-namespace |

### 5. Four-Tier Trust Model

| Trust Level | Source | Usage |
|-------------|--------|-------|
| `verified` | Human-reviewed content | Production decisions |
| `reviewed` | Validated by LearningObjectValidator | Improvement candidates |
| `inferred` | System-inferred | Suggestions/references |
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

LearningObjects are injected into the knowledge plane via `KnowledgePromotionService`:

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
    → Subsequent Observe phase can retrieve learned patterns
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

## Alternative Approaches

### Approach A: External Vector Database (Pinecone/Milvus)

Advantages: Optimal vector retrieval performance.
Disadvantages: Adds external dependency, violates §L R1-NO-EXTERNAL-RUNTIME.

### Approach B: Local SQLite + Vector Extension (selected)

Advantages: No external dependencies, aligns with SQLite-first principle.
Disadvantages: Vector retrieval performance lower than dedicated vector databases.

## Consequences

- `knowledge-plane-service.ts` serves as the Knowledge Plane entry point.
- `knowledge-ingestion-pipeline.ts` handles document ingestion.
- `knowledge-query-service.ts` (374 lines) provides three-tier query.
- `knowledge-promotion-service.ts` implements Learn→Knowledge integration.
- `governance/namespace-policy.ts` manages namespace governance.
- `governance/source-trust-policy.ts` implements the four-tier trust model.
- New event: `learning:knowledge_promoted` (Tier 2)

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-017 Knowledge Architecture Refactor](./017-knowledge-architecture-refactor.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)
- `src/platform/five-plane-state-evidence/knowledge/` module

## Source Sections

- `§10` Knowledge Plane Design
- `§10.2` KIP 5-Stage Pipeline
- `§C.1-C.7` Governance Layer Design
- `§8.7` Learn→Knowledge Integration
- `§L.9` R4-EVIDENCE Constraints
