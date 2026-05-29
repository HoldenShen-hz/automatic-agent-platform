# ADR-017 Knowledge 三索referencesArchitecture重构

- Status：Accepted
- Decision日期：2026-04-17

## Background

§10 设计文档defines了 Knowledge 三种索references（Keyword / Semantic / Structural）和三级查询（Quick / Standard / Deep）。实际实现存在两occurrences重大差距：

1. **Semantic 索referencesuses SHA-256 hash 伪向量**：非真实神vianetwork embedding，语义相似度计算退化。
2. **三级查询未实现**：单一 `query()` 方法，no QueryLevel 参数。

## Decision

### 三种索references

| 索references | 实现 | Description |
|------|------|------|
| Keyword / FTS5 | `KeywordKnowledgeIndex` | ✅ 已实现，inverted index |
| Semantic / vector | `SemanticVectorStore` + EmbeddingProvider | ⚠️ 当前为 hash 伪向量，需升级到 LLM provider embedding |
| Structural / AST | `ASTIndex` | ❌ 待实现（GAP-OAPEFLIR-06） |

### 三级查询

| 级别 | 触发条件 | data层 | delay目标 | topK |
|------|---------|-------|---------|------|
| **Quick** | confidence ≥ 0.5，nocache命中 | L1 runtime cache only | <50ms | 3 |
| **Standard** | defaults to级别 | L1 + keyword + semantic | <200ms | 10 |
| **Deep** | confidence < 0.5 或显式request | 全层 + graph traversal | <2s | 30 |

### Semantic Embedding 升级路径

```
当前: SHA-256 hash → 32维伪向量（local-hash-v1: 前缀）
目标: LLM provider /embeddings API → 真实向量 → pgvector storage
降级: AA_KNOWLEDGE_EMBEDDING_PROVIDER=hash 可回退到伪向量模式
```

### 新增文件

- `src/platform/five-plane-state-evidence/knowledge/knowledge-query-service.ts`（已实现）：三级查询服务。
- `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts`：Embedding provider 抽象（部分实现）。

## Consequences

- GAP-V2-02（hash embedding → 真实 embedding）is后续 Knowledge 质量的核心工作。
- GAP-V2-11（三级查询）已实现，QueryLevel 可via `KnowledgeQueryService` uses。
- AST Structural 索references（GAP-OAPEFLIR-06）待实现，完成后 Deep 查询可uses结构化code索references。

## 备选方案

1. **继续uses hash 伪向量**：成本低，但语义相似度计算退化，Knowledge 质量no法提升。
2. **uses本地 embedding 模型**（如 TF-IDF / BM25）：no需外部relies on，但效果不如 LLM embedding。
3. **采用本Decision**：升级到 LLM provider embedding，为 semantic search 提供真实向量语义。

## 交叉references用

- [ADR-006 LLM Provider 策略](./006-llm-provider-strategy.md)
- [ADR-020 Memory 六层平面](./020-memory-six-plane-model.md)

## 来源章节

- `§10 Knowledge Plane`
- `§29 Memory and Knowledge`
