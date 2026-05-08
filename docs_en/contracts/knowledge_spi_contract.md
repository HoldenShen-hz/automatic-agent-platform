# Knowledge SPI Contract

> **OAPEFLIR Relevance**: This contract defines the SPI interfaces for the OAPEFLIR Knowledge Plane, corresponding to ADR-078.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines the Service Provider Interface (SPI) for the Knowledge Plane, including the KIP 5-stage pipeline, three index types, and three-level query normalization interfaces.

Related documents:
- `artifact_store_contract.md`: Boundaries between Knowledge and Artifact.
- [ADR-078 Knowledge Plane Architecture](../adr/078-knowledge-plane-architecture.md)

## 2. KIP 5-Stage Pipeline

```
Intake → Extraction → Archive → Index → Query
  ↓        ↓           ↓         ↓       ↓
Raw Doc  Semantic    Cold      Three   Three
         Extraction  Storage   Indexes Queries
```

| Stage | Component | Responsibility |
|-------|-----------|----------------|
| Intake | `KnowledgeIngestionPipeline` | Receives raw documents, format validation |
| Extraction | `KnowledgeExtractor` | Semantic extraction, chunking, summarization |
| Archive | `KnowledgeArchive` | Cold data persistence (SQLite) |
| Index | `KeywordIndexer` / `SemanticVectorStore` / `ASTIndexer` | Three index types maintenance |
| Query | `KnowledgeQueryService` | Quick/Standard/Deep three-level query |

## 3. Core Interfaces

### 3.1 KnowledgeSource

```typescript
interface KnowledgeSource {
  sourceId: string;
  type: 'user_input' | 'system_generated' | 'external_api' | 'file_import';
  uri: string;
  trustLevel: TrustLevel;
  ingestedAt: string;
}

type TrustLevel = 'verified' | 'reviewed' | 'inferred' | 'untrusted';
```

### 3.2 KnowledgeDocument

```typescript
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
  embedding?: number[];  // Vector representation
  metadata: Record<string, unknown>;
}
```

### 3.3 KnowledgeNamespace

```typescript
interface KnowledgeNamespace {
  namespace: string;           // e.g., "system/learned-patterns"
  owner: string;
  retentionPolicy: RetentionPolicy;
  accessPolicy: AccessPolicy;
  chunkingMode: ChunkingMode;  // 'semantic' | 'recursive' | 'fixed_size'
}

interface RetentionPolicy {
  maxAgeDays: number;           // 0 = permanent
  maxSizeMB: number;
  archiveAfterDays: number;
}
```

## 4. Three Index SPIs

### 4.1 KeywordIndex (BM25)

```typescript
interface KeywordIndex {
  upsert(chunk: KnowledgeChunk): void;
  query(keyword: string, options?: KeywordQueryOptions): RetrievalHit[];
  remove(chunkId: string): void;
}

interface KeywordQueryOptions {
  namespace?: string;
  limit?: number;
  minScore?: number;
}
```

### 4.2 SemanticVectorStore

```typescript
interface SemanticVectorStore {
  upsert(records: SemanticVectorChunkRecord[]): Promise<void>;
  querySimilar(query: {
    query: string;
    namespace?: string;
    limit: number;
    minSimilarity?: number;
  }): Promise<SemanticVectorCandidate[]>;
  delete(documentId: string): Promise<void>;
}
```

**Current Status**: Using SHA-256 hash pseudo-vectors (`local-hash-v1:` prefix).

### 4.3 ASTIndex

```typescript
interface ASTIndex {
  // Parse and index TypeScript source files
  indexSource(source: string, filePath: string): Promise<void>;
  // Find symbol definition location
  findDefinition(symbolName: string, filePath: string): SymbolLocation | null;
  // Find symbol references
  findReferences(symbolName: string): SymbolLocation[];
  // Find structurally related chunks
  findStructurallyRelated(chunkId: string): KnowledgeRef[];
}
```

## 5. KnowledgeQueryService Three-Level Query SPI

| Level | Response Time Target | Retrieval Scope |
|-------|---------------------|-----------------|
| `quick` | <100ms P99 | Keyword index only (L1 cache) |
| `standard` | <500ms P99 | Keyword + semantic vector hybrid |
| `deep` | <2000ms | All indexes + cross-namespace |

```typescript
enum QueryLevel {
  Quick = "quick",      // <100ms P99, topK=3
  Standard = "standard", // <500ms P99, topK=10
  Deep = "deep",        // <2000ms, topK=30
}

interface KnowledgeQueryService {
  // Default Standard level
  query(keyword: string, options?: KnowledgeQueryOptions): RetrievalHit[];

  // Explicit level
  queryAsync(
    keyword: string,
    options?: KnowledgeQueryOptions,
    level?: QueryLevel
  ): Promise<RetrievalHit[]>;

  // Adaptive query (based on previous round confidence)
  queryAdaptive(keyword: string, options?: KnowledgeQueryOptions): RetrievalHit[];

  // Select query level
  selectQueryLevel(confidence: number): QueryLevel;

  // Confidence
  getLastConfidence(): number;
}

interface KnowledgeQueryOptions {
  namespace?: string;
  domainId?: string | null;
  trustLevel?: TrustLevel;  // Filter minimum trust level
  includeUnverified?: boolean;
  limit?: number;          // Default 10
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

## 6. 4-Level Trust Model

| Trust Level | Source | Usage |
|-------------|--------|-------|
| `verified` | Human-reviewed content | Production decisions |
| `reviewed` | LearningObjectValidator verified | Improvement candidates |
| `inferred` | System-inferred | Suggestions/references |
| `untrusted` | Unverified source | Display only |

## 7. Learn→Knowledge Integration

LearningObject is injected into the knowledge plane through `KnowledgePromotionService`:

```typescript
interface KnowledgePromotionService {
  // Convert LearningObject to KnowledgeDocument and inject
  promote(learningObject: LearningObject): Promise<KnowledgeDocument>;

  // Get promotion history
  getPromotionHistory(objectId: string): PromotionRecord[];
}

interface PromotionRecord {
  objectId: string;
  documentId: string;
  promotedAt: string;
  trustLevel: TrustLevel;
  namespace: string;
}
```

**Data Flow**:
```
FailurePatternMiner.mine()
    → LearningObject { kind: "failure_pattern", evidence: [...] }
    → LearningObjectValidator.validate()
    → KnowledgePromotionService.promote()
        → KnowledgePlaneService.ingest({
            source: { type: "system_generated", uri: "learning://failure_pattern/{id}" },
            namespace: "system/learned-patterns",
            trustLevel: "reviewed"
          })
    → Subsequent Observe phase can retrieve learned patterns
```

## 8. Constraints

- **Quick Mode**: Must not access SemanticVectorStore or KeywordIndex, only query L1 cache.
- **Standard Mode**: Must not execute graph traversal or AST queries.
- **Deep Mode**: Must include semantic similarity ranking topK=30, optional graph expansion.
- **Namespace Isolation**: Cross-namespace queries must be authorized through KnowledgeAccessControl.
- **R4-EVIDENCE**: Content injected from Learn→Knowledge must include EvidenceRef links.
- **Trust Level Propagation**: trustLevel must be determined at intake time, no demotion allowed.
