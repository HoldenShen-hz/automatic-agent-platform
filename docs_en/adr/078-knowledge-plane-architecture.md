# ADR-078 Knowledge Plane Architecturevs信任模型

- Status：Partially Superseded by current knowledge-plane contract baseline
- Decision日期：2026-04-17
- 相关：ADR-016 OAPEFLIR 八阶段认知循环模型，ADR-017 Knowledge Architecture重构

## Background

OAPEFLIR Learn Hub 产出的学习结果需要持久化storage并供后续任务检索。Knowledge Plane（知识平面）is P5 State&Evidence 平面内的子域，提供统一的知识摄取、索references、检索和治理能力，supported BM25 关键词索references、语义向量索references和 AST 结构索references三种检索方式。

> 注意：Knowledge Plane is P5 State&Evidence 的子域，不is独立Architecture平面。所有 Knowledge 操作最终回链到 P5 的 truth/events 体系。

现有 `knowledge/` 模块（23 文件）已实现完整管线，本 ADR 正式确立 Knowledge Plane 的治理Architecture和信任模型。

## Decision

### 1. KIP 5 阶段管线

```
Intake → Extraction → Archive → Index → Query
   ↓         ↓           ↓         ↓       ↓
 原始文档  语义抽取   冷storage    三种索references  三级查询
```

| 阶段 | 组件 | 职责 |
|------|------|------|
| Intake | `KnowledgeIngestionPipeline` | 接收原始文档，格式校验 |
| Extraction | `KnowledgeExtractor` | 语义抽取、分块、摘要 |
| Archive | `KnowledgeArchive` | 冷data持久化（SQLite） |
| Index | `KeywordIndexer` / `SemanticVectorStore` / `ASTIndexer` | 三种索references维护 |
| Query | `KnowledgeQueryService` | Quick/Standard/Deep 三级查询 |

### 2. 核心接口

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
  embedding?: number[];      // 向量table示
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

### 3. 3 种索references策略

| 索references | 适用场景 | 实现 |
|------|---------|------|
| `KeywordIndexer` (BM25) | 精确关键词匹配 | `keyword-index.ts` |
| `SemanticVectorStore` | 语义相似性检索 | `semantic-vector-store.ts` |
| `ASTIndexer` | code结构检索 | `ast-index.ts` |

### 4. 3 级查询

| 级别 | responsetime目标 | 检索范围 |
|------|------------|---------|
| `quick` | <100ms P99 | only关键词索references |
| `standard` | <500ms P99 | 关键词 + 语义向量混合 |
| `deep` | <2000ms | 全部索references + 跨 namespace |

### 5. 4 级信任模型

| 信任级别 | 来源 | 用途 |
|---------|------|------|
| `verified` | 人工审核过的内容 | 生产Decision |
| `reviewed` | LearningObjectValidator 验证 | 改进候选 |
| `inferred` | 系统推断 | Recommendation/参考 |
| `untrusted` | 未验证来源 | only展示 |

### 6. KnowledgeNamespace 治理

```typescript
interface KnowledgeNamespace {
  namespace: string;           // e.g., "system/learned-patterns"
  owner: string;
  retentionPolicy: RetentionPolicy;
  accessPolicy: AccessPolicy;
  chunkingMode: ChunkingMode;    // 'semantic' | 'recursive' | 'fixed_size'
}

interface RetentionPolicy {
  maxAgeDays: number;           // 0 = 永久
  maxSizeMB: number;
  archiveAfterDays: number;
}
```

### 7. Learn→Knowledge 集成

LearningObject via `KnowledgePromotionService` 注入知识平面：

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
    → 后续 Observe 阶段可检索到已学习的模式
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

## 备选方案

### 方案 A：外部向量data库（Pinecone/Milvus）

优点：向量检索性能最优。
代价：增加外部relies on，不符合 §L R1-NO-EXTERNAL-RUNTIME。

### 方案 B：本地 SQLite + 向量扩展（已选）

优点：no外部relies on，符合 SQLite-first principle。
代价：向量检索性能低于专用向量data库。

## Consequences

- `knowledge-plane-service.ts` 作为 Knowledge Plane 入口。
- `knowledge-ingestion-pipeline.ts` handle文档摄取。
- `knowledge-query-service.ts`（374 lines）提供三级查询。
- `knowledge-promotion-service.ts` 实现 Learn→Knowledge 集成。
- `governance/namespace-policy.ts` manage namespace 治理。
- `governance/source-trust-policy.ts` 实现 4 级信任模型。
- 新事件：`learning:knowledge_promoted`（Tier 2）

## 交叉references用

- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-017 Knowledge Architecture重构](./017-knowledge-architecture-refactor.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)
- `src/platform/five-plane-state-evidence/knowledge/` 模块

## 来源章节

- `§10` Knowledge Plane 设计
- `§10.2` KIP 5 阶段管线
- `§C.1-C.7` 治理层设计
- `§8.7` Learn→Knowledge 集成
- `§L.9` R4-EVIDENCE 约束
