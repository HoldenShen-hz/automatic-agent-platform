# ADR-078 Knowledge Plane Architecture and Trust Model

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model, ADR-017 Knowledge Architecture Refactor

## Context

The learning results produced by OAPEFLIR Learn Hub need to be persistently stored and retrievable by subsequent tasks. The Knowledge Plane provides unified knowledge ingestion, indexing, retrieval, and governance capabilities, supporting three retrieval methods: BM25 keyword indexing, semantic vector indexing, and AST structure indexing.

The existing `knowledge/` module (23 files) has implemented a complete pipeline. This ADR formally establishes the Knowledge Plane's governance architecture and trust model.

## Decision

### 1. KIP 5-Stage Pipeline

```
Intake → Extraction → Archive → Index → Query
   ↓         ↓           ↓         ↓       ↓
 Raw Doc  Semantic   Cold     3 Index   3-Tier
          Extraction Storage           Query
```

| Stage | Component | Responsibility |
|------|------|------|
| Intake | `KnowledgeIngestionPipeline` | Receives raw documents, format validation |
| Extraction | `KnowledgeExtractor` | Semantic extraction, chunking, summarization |
| Archive | `KnowledgeArchive` | Cold data persistence (SQLite) |
| Index | `KeywordIndexer` / `SemanticVectorStore` / `ASTIndexer` | Three index types maintained |
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
  embedding?: number[];      // vector representation
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

| Index | Use Case | Implementation |
|------|---------|------|
| `KeywordIndexer` (BM25) | Exact keyword matching | `keyword-index.ts` |
| `SemanticVectorStore` | Semantic similarity retrieval | `semantic-vector-store.ts` |
| `ASTIndexer` | Code structure retrieval | `ast-index.ts` |

### 4. 3 Query Levels

| Level | Response Time Target | Retrieval Scope |
|------|------------|---------|
| `quick` | <100ms P99 | Keyword index only |
| `standard` | <500ms P99 | Keyword + semantic vector hybrid |
| `deep` | <2000ms | All indexes + cross-namespace |

### 5. 4-Level Trust Model

| Trust Level | Source | Usage |
|---------|------|------|
| `verified` | Human-reviewed content | Production decisions |
| `reviewed` | Validated by LearningObjectValidator | Improvement candidate |
| `inferred` | System-inferred | Suggestions/reference |
| `untrusted` | Unverified source | Display only |

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

LearningObject is injected into the Knowledge Plane via `KnowledgePromotionService`:

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

## Alternatives

### Option A: External Vector Database (Pinecone/Milvus)

Pros: Optimal vector retrieval performance.
Cons: Adds external dependency, violates §L R1-NO-EXTERNAL-RUNTIME.

### Option B: Local SQLite + Vector Extension (Chosen)

Pros: No external dependencies, conforms to SQLite-first principle.
Cons: Vector retrieval performance lower than dedicated vector databases.

## Consequences

- `knowledge-plane-service.ts` as the Knowledge Plane entry point.
- `knowledge-ingestion-pipeline.ts` handles document ingestion.
- `knowledge-query-service.ts` (374 lines) provides three-tier query.
- `knowledge-promotion-service.ts` implements Learn→Knowledge integration.
- `governance/namespace-policy.ts` manages namespace governance.
- `governance/source-trust-policy.ts` implements 4-level trust model.
- New event: `learning:knowledge_promoted` (Tier 2)

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-017 Knowledge Architecture Refactor](./017-knowledge-architecture-refactor.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)
- `src/core/knowledge/` module

## Source Sections

- `§10` Knowledge Plane Design
- `§10.2` KIP 5-Stage Pipeline
- `§C.1-C.7` Governance Layer Design
- `§8.7` Learn→Knowledge Integration
- `§L.9` R4-EVIDENCE constraint
