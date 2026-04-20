# ADR-017 Knowledge 三索引架构重构

- 状态：Accepted
- 决策日期：2026-04-17

## 背景

§10 设计文档定义了 Knowledge 三种索引（Keyword / Semantic / Structural）和三级查询（Quick / Standard / Deep）。实际实现存在两处重大差距：

1. **Semantic 索引使用 SHA-256 hash 伪向量**：非真实神经网络 embedding，语义相似度计算退化。
2. **三级查询未实现**：单一 `query()` 方法，无 QueryLevel 参数。

## 决策

### 三种索引

| 索引 | 实现 | 说明 |
|------|------|------|
| Keyword / FTS5 | `KeywordKnowledgeIndex` | ✅ 已实现，inverted index |
| Semantic / vector | `SemanticVectorStore` + EmbeddingProvider | ⚠️ 当前为 hash 伪向量，需升级到 LLM provider embedding |
| Structural / AST | `ASTIndex` | ❌ 待实现（GAP-OAPEFLIR-06） |

### 三级查询

| 级别 | 触发条件 | 数据层 | 延迟目标 | topK |
|------|---------|-------|---------|------|
| **Quick** | confidence ≥ 0.5，无缓存命中 | L1 runtime cache only | <50ms | 3 |
| **Standard** | 默认级别 | L1 + keyword + semantic | <200ms | 10 |
| **Deep** | confidence < 0.5 或显式请求 | 全层 + graph traversal | <2s | 30 |

### Semantic Embedding 升级路径

```
当前: SHA-256 hash → 32维伪向量（local-hash-v1: 前缀）
目标: LLM provider /embeddings API → 真实向量 → pgvector 存储
降级: AA_KNOWLEDGE_EMBEDDING_PROVIDER=hash 可回退到伪向量模式
```

### 新增文件

- `src/core/knowledge/knowledge-query-service.ts`（已实现）：三级查询服务。
- `src/core/knowledge/indexing/embedding-provider.ts`：Embedding provider 抽象（部分实现）。

## 后果

- GAP-V2-02（hash embedding → 真实 embedding）是后续 Knowledge 质量的核心工作。
- GAP-V2-11（三级查询）已实现，QueryLevel 可通过 `KnowledgeQueryService` 使用。
- AST Structural 索引（GAP-OAPEFLIR-06）待实现，完成后 Deep 查询可使用结构化代码索引。
