# Knowledge SPI Contract

## 1. Scope

This contract defines the Service Provider Interface (SPI) for the Knowledge module, including three types of indexes and three-level query standardization interfaces.

Related documents:
- `artifact_store_contract.md`: Boundary between Knowledge and Artifact.
- `perception_contract.md`: Knowledge as input source for perception layer.

## 2. Three Index SPIs

### 2.1 KeywordIndex (Implemented)

```typescript
interface KeywordIndex {
  upsert(chunk: KnowledgeChunk): void;
  query(keyword: string): RetrievalHit[];
  remove(chunkId: string): void;
}
```

### 2.2 SemanticVectorStore (Interface Exists, Pending Upgrade)

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

**Current Status**: Uses SHA-256 hash pseudo-vector (`local-hash-v1:` prefix). Upgrade path see ADR-017.

### 2.3 ASTIndex (To Implement, GAP-OAPEFLIR-06)

```typescript
interface ASTIndex {
  // Parse and index TypeScript source file
  indexSource(source: string, filePath: string): Promise<void>;
  // Find symbol definition location
  findDefinition(symbolName: string, filePath: string): SymbolLocation | null;
  // Find symbol references
  findReferences(symbolName: string): SymbolLocation[];
  // Find structurally related chunks
  findStructurallyRelated(chunkId: string): KnowledgeRef[];
}
```

## 3. KnowledgeRetrievalService Interface

```typescript
interface KnowledgeRetrievalService {
  // Synchronous query
  query(keyword: string, options?: KnowledgeQueryOptions): RetrievalHit[];

  // Asynchronous query
  queryAsync(keyword: string, options?: KnowledgeQueryOptions): Promise<RetrievalHit[]>;
}

interface KnowledgeQueryOptions {
  namespace?: string;
  domainId?: string | null;
  includeUnverified?: boolean;
  limit?: number;        // Default 10
}
```

## 4. KnowledgeQueryService Three-Level Query SPI

```typescript
enum QueryLevel {
  Quick = "quick",    // L1 cache only, <50ms, topK=3
  Standard = "standard", // keyword+semantic, <200ms, topK=10
  Deep = "deep",      // full+graph, <2s, topK=30
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

  // Adaptive query (based on prior confidence)
  queryAdaptive(keyword: string, options?: KnowledgeQueryOptions): RetrievalHit[];

  // Select query level
  selectQueryLevel(confidence: number): QueryLevel;

  // Confidence
  getLastConfidence(): number;
}
```

## 5. KnowledgeGovernance.selectQueryLevel Strategy

```typescript
// Recommended strategy (KnowledgeGovernance implementation)
function selectQueryLevel(query: string, context: LoopContext): QueryLevel {
  if (context.loopIteration === 1) return QueryLevel.Standard;
  if (context.priorConfidence < 0.5) return QueryLevel.Deep;
  if (query.length < 50) return QueryLevel.Quick;
  return QueryLevel.Standard;
}
```

## 6. Constraints

- **Quick Mode**: Must not access SemanticVectorStore or KeywordIndex, only query L1 cache.
- **Standard Mode**: Must not execute graph traversal or AST query.
- **Deep Mode**: Must include semantic similarity ranking topK=30, optional graph expansion.
- **Namespace Isolation**: Cross-namespace query must be authorized through KnowledgeAccessControl.
