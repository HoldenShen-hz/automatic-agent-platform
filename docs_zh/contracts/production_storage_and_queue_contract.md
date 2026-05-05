# Production Storage And Queue Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 release
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义从当前事务存储基线演进到工业级 PostgreSQL + Redis/BullMQ 队列的正式路线。

它回答的问题是：平台进入生产后，哪些数据必须放进 authoritative relational store，哪些职责进入 queue/broker，哪些设计从现在起就必须按 PG 语义约束。

相关文档：

- `storage_schema_contract.md`
- `runtime_repository_and_migration_contract.md`
- `execution_plane_contract.md`
- `event_bus_contract.md`

## 2. 目标

- 把事务真相、队列派发和缓存职责分清。
- 避免实现过度绑定 SQLite 特性。
- 提前冻结 PG 语义优先的 repository / migration 规则。
- 为 Redis/BullMQ 作为 execution queue 提供清晰边界。

## 3. 生产数据分层

| 层 | 主要后端 | 负责内容 |
| --- | --- | --- |
| `transaction store` | PostgreSQL | task、workflow、execution、approval、lease、audit、quota authoritative truth |
| `queue / dispatch` | Redis + BullMQ | execution ticket、delayed queue、retry queue、dead-letter routing |
| `artifact store` | object storage / file store | 大文件、报表、附件、导出包 |
| `knowledge / release store` | PostgreSQL + pgvector | knowledge namespace 元数据、semantic vector index、release record、strategy lineage |
| `analytics / replay` | PG 副表或后续分析存储 | usage、cost、evaluation、ops aggregation |

## 4. 关键不变量

- authoritative task / execution state 不得只存在于 queue。
- queue 消息丢失后，必须能从 transaction store 重建。
- dispatch queue 负责“投递与重试”，不负责“最终真相状态”。
- PG schema 设计优先于 SQLite 便捷特性。
- release / strategy / knowledge namespace 元数据不得只保留在缓存或 artifact 中。
- knowledge semantic embedding 若启用外部向量检索，authoritative vector index 必须可由 PG/pgvector 重建，不得只存在于进程内缓存。

## 5. 生产推荐拓扑

```mermaid
flowchart LR
    A["API / Gateway"] --> B["Coordinator / Control Plane"]
    B --> C["PostgreSQL"]
    B --> D["Redis / BullMQ"]
    D --> E["Execution Workers"]
    E --> C
    E --> F["Artifact Store"]
    C --> G["Audit / Reporting"]
```

## 6. PostgreSQL 语义要求

- 所有 repository 设计必须兼容行级锁、事务、唯一约束、外键和 JSONB。
- 不得把 SQLite 特有实现方式写成 contract 真相。
- migration 必须从一开始就支持在 PG 上验证。
- 任何“只在 SQLite 下能成立”的 shortcut 都必须登记为技术债。
- knowledge semantic infra 的 target 后端是 `pgvector`；schema 应包含 `knowledge_semantic_vectors` 或等价表，用 `knowledge_ref` 作为稳定键，并保留 `chunk_id`、`document_id`、`namespace`、`embedding_id`、`embedding_model`、`embedding vector(32)`、`updated_at`。
- pgvector extension 缺失时 migration 可以 fail-soft 并保留 notice，但显式选择 `AA_KNOWLEDGE_VECTOR_BACKEND=pgvector` 的 runtime 必须 fail-close。
- semantic query 应通过 `embedding <=> query_vector` 或等价 cosine distance 语义排序，不能把 keyword score 伪装成向量相似度。
- 仓库内必须提供可执行的 pgvector readiness / roundtrip 检查入口；当前以 `knowledge-semantic-readiness` CLI 对 `AA_STORAGE_DRIVER=postgres` + `AA_KNOWLEDGE_VECTOR_BACKEND=pgvector` 执行 extension/table/ivfflat/roundtrip 校验，并在失败时 fail-close。

## 7. Queue 语义要求

- dispatch 至少一次投递。
- queue 消费成功不等于业务成功，必须等待 authoritative writeback。
- delay、retry、dead-letter 由 queue 管理，但 decision source 仍来自 control plane。
- 重复投递必须依赖 idempotency key + fencing token 防护。

## 8. 双跑与迁移建议

工业级推进顺序：

1. repository 先按 PG 语义实现接口。
2. migration 在 SQLite 和 PG 两侧都进行兼容校验。
3. queue 先在单实例模式验证，再上 Redis/BullMQ。
4. 生产前完成 PG + queue 演练，不把切换拖到 Phase 4 以后。

Knowledge semantic infra 迁移路线：

1. `Current`：本地 hash embedding + archive scan / in-memory vector store 可用于开发和无 PG 环境。
2. `Transition`：`SemanticVectorStore` 抽象同时支持 `local_hash` 与 `pgvector`；API 查询路径使用 async retrieval，可等待向量索引写入。
3. `Target`：生产启用 PostgreSQL + pgvector，`knowledge_semantic_vectors` 由 ingestion pipeline 写入，semantic query 走 pgvector distance 排序；snapshot restore 后也必须能回填 semantic vector index。仓库内 readiness CLI 与 roundtrip 校验已完成，但真实 PG 环境仍必须完成 live validation 证据。

## 9. 一致性模型

| 对象 | 一致性 |
| --- | --- |
| task / execution / lease | 强一致 |
| approval decision | 强一致 |
| queue delivery | 至少一次 |
| UI progress | 最终一致 |
| analytics aggregation | 延迟一致 |

## 10. 失败与回退

- Redis/BullMQ 不可用时，系统应进入 admission control 或降级，不得默默丢任务。
- PG 不可写时，不得继续接受需要 authoritative state 的任务。
- 当 `AA_STORAGE_DRIVER=postgres` 时，startup preflight / doctor 必须先对 DSN、SSL、pool sizing、dual-run 开关与 shadow SQLite 路径完成 fail-close 校验，未通过不得启用 postgres driver。
- queue 与 DB 写入不一致时，应优先相信 DB 真相并触发 repair job。

## 11. Phase 边界

当前：

- 文档和 repository 先按 PG/queue 语义设计
- 允许实现仍从单机基线起步

进入生产前必须完成：

- PG migration compatibility test
- queue replay / duplicate delivery drill
- DB/queue 断连故障演练
- release / strategy lineage consistency drill

## 12. 收口结论

工业级生产不能把 PostgreSQL 和 queue 只当“未来替换件”。

从文档和 contract 起，就必须按“事务真相在 PG、调度投递在 queue、重复投递由幂等与 fencing 兜底”的结构设计。
