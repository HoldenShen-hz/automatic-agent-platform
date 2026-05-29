# Knowledge SPI Contract

> **OAPEFLIR 相关**：本 contract defines OAPEFLIR Knowledge Plane 的 SPI 接口，对应 ADR-078。
> **更新日期**：2026-04-17

## 1. 范围

本 contract defines Knowledge Plane 的 Service Provider Interface（SPI），includes KIP 5 阶段管线、三种索references和三级查询的规范化接口。

相关文档：
- `artifact_store_contract.md`：Knowledge vs Artifact 的边界。
- [ADR-078 Knowledge Plane Architecture](../adr/078-knowledge-plane-architecture.md)

## 2. KIP 5 阶段管线

```
Intake → Extraction → Archive → Index → Query
  ↓        ↓           ↓         ↓       ↓
原始文档  语义抽取   冷storage    三种索references  三级查询
```

| 阶段 | 组件 | 职责 |
|------|------|------|
| Intake | `KnowledgeIngestionPipeline` | 接收原始文档，格式校验 |
| Extraction | `KnowledgeExtractor` | 语义抽取、分块、摘要 |
| Archive | `KnowledgeArchive` | 冷data持久化（SQLite） |
| Index | `KeywordIndexer` / `SemanticVectorStore` / `ASTIndexer` | 三种索references维护 |
| Query | `KnowledgeQueryService` | Quick/Standard/Deep 三级查询 |

## 3. 核心接口

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
  embedding?: number[];  // 向量table示
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
  maxAgeDays: number;           // 0 = 永久
  maxSizeMB: number;
  archiveAfterDays: number;
}
```

## 4. 三种索references SPI

### 4.1 KeywordIndex（BM25）

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

**当前Status**：uses SHA-256 hash 伪向量（`local-hash-v1:` 前缀）。

### 4.3 ASTIndex

```typescript
interface ASTIndex {
  // 解析并索references TypeScript 源文件
  indexSource(source: string, filePath: string): Promise<void>;
  // 查找符号defines位置
  findDefinition(symbolName: string, filePath: string): SymbolLocation | null;
  // 查找符号references用
  findReferences(symbolName: string): SymbolLocation[];
  // 查找结构相关 chunk
  findStructurallyRelated(chunkId: string): KnowledgeRef[];
}
```

## 5. KnowledgeQueryService 三级查询 SPI

| 级别 | responsetime目标 | 检索范围 |
|------|------------|---------|
| `quick` | <100ms P99 | only关键词索references（L1 cache） |
| `standard` | <500ms P99 | 关键词 + 语义向量混合 |
| `deep` | <2000ms | 全部索references + 跨 namespace |

```typescript
enum QueryLevel {
  Quick = "quick",      // <100ms P99, topK=3
  Standard = "standard", // <500ms P99, topK=10
  Deep = "deep",        // <2000ms, topK=30
}

interface KnowledgeQueryService {
  // defaults to Standard 级别
  query(keyword: string, options?: KnowledgeQueryOptions): RetrievalHit[];

  // 显式级别
  queryAsync(
    keyword: string,
    options?: KnowledgeQueryOptions,
    level?: QueryLevel
  ): Promise<RetrievalHit[]>;

  // 自适应查询（根据上轮 confidence）
  queryAdaptive(keyword: string, options?: KnowledgeQueryOptions): RetrievalHit[];

  // 选择查询级别
  selectQueryLevel(confidence: number): QueryLevel;

  // 置信度
  getLastConfidence(): number;
}

interface KnowledgeQueryOptions {
  namespace?: string;
  domainId?: string | null;
  trustLevel?: TrustLevel;  // 过滤最低信任级别
  includeUnverified?: boolean;
  limit?: number;          // defaults to 10
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

## 6. 4 级信任模型

| 信任级别 | 来源 | 用途 |
|---------|------|------|
| `verified` | 人工审核过的内容 | 生产Decision |
| `reviewed` | LearningObjectValidator 验证 | 改进候选 |
| `inferred` | 系统推断 | Recommendation/参考 |
| `untrusted` | 未验证来源 | only展示 |

## 7. Learn→Knowledge 集成

LearningObject via `KnowledgePromotionService` 注入知识平面：

```typescript
interface KnowledgePromotionService {
  // 将 LearningObject 转换为 KnowledgeDocument 并注入
  promote(learningObject: LearningObject): Promise<KnowledgeDocument>;

  // 获取 promotion 历史
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

**data流**：
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
    → 后续 Observe 阶段可检索到已学习的模式
```

## 8. 约束

- **Quick 模式**：不得访问 SemanticVectorStore 或 KeywordIndex，只查 L1 cache。
- **Standard 模式**：不得执lines graph traversal 或 AST 查询。
- **Deep 模式**：必须contains semantic similarity 排序 topK=30，optional graph expansion。
- **命名空间隔离**：跨 namespace 查询必须via KnowledgeAccessControl authorization。
- **R4-EVIDENCE**：Learn→Knowledge 注入的内容必须contains EvidenceRef 链接。
- **信任级别传播**：trustLevel 必须在 intake 时确定，不得降级。
