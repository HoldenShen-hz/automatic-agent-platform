# Knowledge SPI Contract

> **OAPEFLIR Association**: This contract defines the SPI interface of the OAPEFLIR Knowledge Plane, corresponding to ADR-078.
> **Update date**: 2026-04-17

## 1. Scope

This contract defines the Service Provider Interface (SPI) of the Knowledge Plane, including KIP 5-stage pipeline, three index types, and three-level query normalization interfaces.

Related documents:
- `artifact_store_contract.md`: Boundary between Knowledge and Artifact.
- [ADR-078 Knowledge Plane Architecture](../adr/078-knowledge-plane-architecture.md)

## 2. KIP 5-Stage Pipeline

```
Intake → Extraction → Archive → Index → Query
  ↓        ↓           ↓         ↓       ↓
Raw doc  Semantic   Cold store  3 indexes  3-level
         extraction           3-level    query
```

| Stage | Component | Responsibility |
|------|------|------|
| Intake | `KnowledgeIngestionPipeline` | Receives raw documents, format validation |
| Extraction | `KnowledgeExtractor` | Semantic extraction, chunking, summarization |
| Archive | `KnowledgeArchive` | Cold data persistence (SQLite) |
| Index | `KeywordIndexer` / `SemanticVectorStore` / `ASTIndexer` | Three index maintenance |
| Query | `KnowledgeQueryService` | Quick/Standard/Deep three-level query |

## 3. Core Interfaces

### 3.1 KnowledgeSource

```typescript
interface KnowledgeSource {
  sourceId: string;
  type: 'user_input' | 'system_generated' | 'external_api' | 'file_import';
  uri: string;
  harnessRunId?: string;     // canonical execution context
  nodeRunId?: string;        // canonical node context
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
  embedding?: number[];  // vector representation
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

**Current status**: Using SHA-256 hash pseudo-vector (`local-hash-v1:` prefix).

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
|------|------------|---------|
| `quick` | <100ms P99 | Keywords only (L1 cache) |
| `standard` | <500ms P99 | Keywords + semantic vector hybrid |
| `deep` | <2000ms | All indexes + cross namespace |

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

## 6. 4-Level Trust Model (Aligned with §29 Knowledge Boundary Rules)

| Trust Level | Source | Use | §29 Correspondence |
|---------|------|------|---------|
| `verified` | Human-reviewed content | Production decisions | §29.3 allows use in high-risk domains |
| `reviewed` | LearningObjectValidator verified | Improvement candidates | §29.2 TrustLevel propagation rule |
| `inferred` | System inferred | Suggestions/references | §29.1 Default trust level |
| `untrusted` | Unverified source | Display only | §29.3 prohibited for critical domains |

Constraints:

- TrustLevel must be determined at intake and must not propagate degraded ( §29.2).
- `verified` content can be used for high/critical risk domain decisions; `untrusted` must not be used in production ( §29.3).
- Knowledge boundary check must verify TrustLevel matches domain risk at query time.

## 7. Learn→Knowledge Integration

LearningObject is injected into knowledge plane through `KnowledgePromotionService`:

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

**Data flow**:
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

- **Quick mode**: Must not access SemanticVectorStore or KeywordIndex, only query L1 cache.
- **Standard mode**: Must not execute graph traversal or AST query.
- **Deep mode**: Must include semantic similarity sorting topK=30, optional graph expansion.
- **Namespace isolation**: Cross-namespace query must be authorized through KnowledgeAccessControl.
- **R4-EVIDENCE**: Content injected from Learn→Knowledge must include EvidenceRef links.
- **TrustLevel propagation**: trustLevel must be determined at intake and must not degrade.

## v4.3 Contract Remediation

- T-44: Early version of Knowledge SPI lacked `harness_run_id` integration fields; `KnowledgeSource.harnessRunId` / `nodeRunId` now added. TrustLevel 4-level model formally defined in §29 knowledge boundary rules; Section 6 of this document aligns with §29 correspondence; new implementations must follow TrustLevel propagation constraints and must not degrade.
