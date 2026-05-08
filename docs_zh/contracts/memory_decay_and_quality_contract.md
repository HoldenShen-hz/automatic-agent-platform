# Memory Decay And Quality Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 rollout
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义记忆系统的层级模型、token 预算、晋升、衰减、撤销、freshness 与权限联动规则。

相关文档：

- `perception_contract.md`（Observe 兼容文件）
- `perception_intelligence_plane_contract.md`（Observe/Assess 兼容文件）
- `context_compaction_and_overflow_contract.md`
- `data_classification_and_prompt_handling_contract.md`
- `tenant_and_organization_contract.md`

## 2. 目标

- 让记忆系统不仅会存，还会按层级治理、过期、降权、撤销和隔离。
- 让记忆质量可评估，而不是只看命中率。
- 防止跨租户、跨项目、跨角色的记忆污染。

## 3. 六层记忆模型

记忆 canonical 分为 `L1-L6` 六层：

| 层级 | 作用域 | 典型内容 | 预算特征 |
| --- | --- | --- | --- |
| `L1` | turn / transient | 当前轮临时上下文、工具返回摘要 | 最小且高频替换 |
| `L2` | task | 当前任务工作记忆、短期计划线索 | 小预算、可快速过期 |
| `L3` | session | 会话级稳定事实、局部偏好 | 中小预算 |
| `L4` | project | 项目约定、仓库结构、长期工作模式 | 中预算 |
| `L5` | org / curated | 经审核的组织经验、最佳实践 | 受治理、较高保留优先级 |
| `L6` | evolution | 被 learn/improve/promote 吸收的长期知识 | 无固定容量上限，但必须可审计 |

规则：

- `L1-L4` 允许较积极衰减和裁剪。
- `L5-L6` 进入门槛更高，必须经过分类、trust 和 promotion 规则。
- `L6` 没有固定容量上限，但不能免除 freshness、revocation 和 lineage 约束。

## 4. Token Budget 与注入边界

每层至少声明：

- `token_budget`
- `eviction_threshold`
- `retrieval_priority`
- `promotion_eligibility`

约束：

- 记忆不能按“最近”直接无脑入模，必须先经过相关性检索。
- `L5-L6` 默认不直接全量注入，只能通过检索与 explainability 结果按需注入。
- compaction 时应优先保留与当前 task / workflow / feedback / learning 直接相关的记忆。

## 5. Freshness 与衰减

### 5.1 Freshness 状态

每条记忆至少有以下 freshness 状态之一：

- `fresh`
- `aging`
- `stale`
- `revoked`
- `archived`

### 5.2 衰减策略

至少支持：

- TTL 或时间窗过期
- 置信度下降
- 冲突记忆合并
- 错误记忆撤销
- 外部来源隔离
- freshness 降级

规则：

- `stale` 不等于立即删除；可降权保留 lineage。
- `revoked` 记忆不得再进入模型上下文。
- 外部来源记忆若 trust tier 下降，至少应同步降低检索优先级。

## 6. 晋升规则

### 6.1 Canonical Promotion Path

默认晋升路径：

`L1 -> L2 -> L3 -> L4 -> L5 -> L6`

约束：

- 不允许绕过 `L5` 直接把未治理内容写入 `L6`。
- `L5-L6` 晋升必须保留来源 `ArtifactRef / EvidenceRef / MemoryRef / KnowledgeRef`。
- `FeedbackSignal / LearningObject / ImprovementCandidate` 可以作为晋升依据，但不能替代治理检查。

### 6.2 晋升前检查

进入 `L5-L6` 前至少检查：

- tenant / workspace / role scope
- data classification
- source trust level
- freshness
- conflict / duplication
- 是否已有上游 evidence

## 7. 核心对象

- `MemoryEntry`
- `MemoryLayerPolicy`
- `MemoryPromotionRecord`
- `MemoryDecayProfile`
- `MemoryQualityReport`
- `MemoryRevocation`
- `MemoryScopeBoundary`
- `MemoryRetrievalRecord`
- `ExperienceRecord`

建议最小字段：

```ts
interface MemoryEntry {
  memory_ref: MemoryRef;
  layer: "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
  scope: "task" | "session" | "project" | "org";
  freshness_state: "fresh" | "aging" | "stale" | "revoked" | "archived";
  token_budget?: number;
  source_refs?: Array<ArtifactRef | EvidenceRef | KnowledgeRef | MemoryRef>;
}
```

## 8. 检索与经验复用

- 长期记忆和经验缓存不应直接按“最近”注入模型，必须先经过相关性检索。
- 当前阶段允许使用 `FTS5 / keyword recall`，后续可补 `embedding / rerank`。
- `MemoryRetrievalRecord` 至少记录：query、matched entries、reason、injected / not_injected、quality outcome、target layer。
- `ExperienceRecord` 至少支持：perfect match cache、similar experience retrieval、few-shot injection provenance。

## 9. 质量指标

必须可记录和分析：

- `hit_rate`
- `post_hit_usefulness`
- `false_citation_rate`
- `staleness_rate`
- `contamination_rate`
- `promotion_success_rate`
- `memory_injection_accept_rate`

## 10. 权限联动

记忆访问必须同时受以下边界约束：

- tenant
- workspace / project
- role
- data classification
- source trust level

补充规则：

- `restricted` 数据默认不得进入 `L5-L6`。
- 含 confidential 信息的学习对象或高层记忆必须先脱敏再进入治理链。
- provider 只能提供记忆内容与检索结果，不能绕过权限边界。

## 11. Memory Provider 生命周期接口

若系统支持可插拔 memory backend，则 provider seam 至少定义：

- `initialize`
- `system_prompt_block`
- `prefetch`
- `queue_prefetch`
- `sync_turn`
- `shutdown`

规则：

- `prefetch` 应优先服务下一轮注入，推荐与 `queue_prefetch` 形成异步 recall 闭环。
- built-in memory 与 external memory backend 的 authoritative / additive 关系必须清楚并可审计。
- provider hook 若失败，应默认降级为“不注入额外记忆”，不得破坏主任务执行。

## 12. 收口结论

工业级记忆系统不能默认“存进去就一直可信”。

它必须具备：

- 六层记忆与 token 预算治理
- freshness tracking 与衰减
- 层间晋升与撤销
- 质量评估
- 作用域隔离
- 入模前权限检查
