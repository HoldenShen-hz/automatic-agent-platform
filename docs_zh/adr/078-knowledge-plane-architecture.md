# ADR-078 Knowledge Plane 架构与信任模型

- 状态：Partially Superseded by current knowledge-plane contract baseline
- 决策日期：2026-04-17
- 相关：ADR-016 OAPEFLIR 八阶段认知循环模型，ADR-017 Knowledge 架构重构

## 背景

OAPEFLIR Learn Hub 产出的学习结果需要持久化存储并供后续任务检索。Knowledge Plane（知识平面）是 P5 State&Evidence 平面内的子域，提供统一的知识摄取、索引、检索和治理能力，支持 BM25 关键词索引、语义向量索引和 AST 结构索引三种检索方式。

> 注意：Knowledge Plane 是 P5 State&Evidence 的子域，不是独立架构平面。所有 Knowledge 操作最终回链到 P5 的 truth/events 体系。

现有 `knowledge/` 模块（23 文件）已实现完整管线，本 ADR 正式确立 Knowledge Plane 的治理架构和信任模型。

## 决策

### 1. KIP 5 阶段管线

```
Intake → Extraction → Archive → Index → Query
   ↓         ↓           ↓         ↓       ↓
 原始文档  语义抽取   冷存储    三种索引  三级查询
```

| 阶段 | 组件 | 职责 |
|------|------|------|
| Intake | `KnowledgeIngestionPipeline` | 接收原始文档，格式校验 |
| Extraction | `KnowledgeExtractor` | 语义抽取、分块、摘要 |
| Archive | `KnowledgeArchive` | 冷数据持久化（SQLite） |
| Index | `KeywordIndexer` / `SemanticVectorStore` / `ASTIndexer` | 三种索引维护 |
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
  embedding?: number[];      // 向量表示
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

### 3. 3 种索引策略

| 索引 | 适用场景 | 实现 |
|------|---------|------|
| `KeywordIndexer` (BM25) | 精确关键词匹配 | `keyword-index.ts` |
| `SemanticVectorStore` | 语义相似性检索 | `semantic-vector-store.ts` |
| `ASTIndexer` | 代码结构检索 | `ast-index.ts` |

### 4. 3 级查询

| 级别 | 响应时间目标 | 检索范围 |
|------|------------|---------|
| `quick` | <100ms P99 | 仅关键词索引 |
| `standard` | <500ms P99 | 关键词 + 语义向量混合 |
| `deep` | <2000ms | 全部索引 + 跨 namespace |

### 5. 4 级信任模型

| 信任级别 | 来源 | 用途 |
|---------|------|------|
| `verified` | 人工审核过的内容 | 生产决策 |
| `reviewed` | LearningObjectValidator 验证 | 改进候选 |
| `inferred` | 系统推断 | 建议/参考 |
| `untrusted` | 未验证来源 | 仅展示 |

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

LearningObject 通过 `KnowledgePromotionService` 注入知识平面：

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

### 方案 A：外部向量数据库（Pinecone/Milvus）

优点：向量检索性能最优。
代价：增加外部依赖，不符合 §L R1-NO-EXTERNAL-RUNTIME。

### 方案 B：本地 SQLite + 向量扩展（已选）

优点：无外部依赖，符合 SQLite-first 原则。
代价：向量检索性能低于专用向量数据库。

## 后果

- `knowledge-plane-service.ts` 作为 Knowledge Plane 入口。
- `knowledge-ingestion-pipeline.ts` 处理文档摄取。
- `knowledge-query-service.ts`（374 行）提供三级查询。
- `knowledge-promotion-service.ts` 实现 Learn→Knowledge 集成。
- `governance/namespace-policy.ts` 管理 namespace 治理。
- `governance/source-trust-policy.ts` 实现 4 级信任模型。
- 新事件：`learning:knowledge_promoted`（Tier 2）

## 交叉引用

- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-017 Knowledge 架构重构](./017-knowledge-architecture-refactor.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)
- `src/platform/five-plane-state-evidence/knowledge/` 模块

## 来源章节

- `§10` Knowledge Plane 设计
- `§10.2` KIP 5 阶段管线
- `§C.1-C.7` 治理层设计
- `§8.7` Learn→Knowledge 集成
- `§L.9` R4-EVIDENCE 约束
