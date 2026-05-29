# Perception Intelligence Plane Contract

---

## OAPEFLIR 关联

本 contract 参vs OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集vs聚合
- **Assess**：执lines前评估vs风险判断
- **Plan**：任务分解vs DAG 构建
- **Execute**：步骤执linesvs容错
- **Feedback**：信号收集vs预handle
- **Learn**：模式检测vs知识提取
- **Improve**：改进候选评估vs rollout
- **Release**：受控发布vs回滚

---

> 兼容Description：文件名保留以维持历史references用稳定；当前目标态语义对齐 `ObserveHub + AssessHub` 双阶段，而不is单一 perception 平面。

## 1. 范围

本 contract defines Observe / Assess 目标态平面，includes source ingestion、dedupe、context build、assessment 和受控Recommendation输出。

它扩展 `perception_contract.md`，used for回答“系统如何持续收集信号、形成 `TaskSituation`，并在 Assess 阶段给出结构化评估Recommendation”。

## 2. 目标

- 把 Observe vs Assess 从松散辅助能力提升为独立阶段平面。
- 保证信号流vs主任务链解耦，但可viaauthorization接入执lines链。
- 让成本、authorization、repeats信息和评估质量成为一等能力。

## 3. 关键组件

- `SourceIngestionPipeline`
- `SignalNormalizer`
- `DeduplicationService`
- `TaskSituationBuilder`
- `SystemSituationBuilder`
- `ObservationAggregator`
- `AssessmentEngine`
- `ExecutionOutcomeEvaluator`

## 4. 关键对象

- `ObserveSource`
- `ObserveSignal`
- `SignalCluster`
- `TaskSituation`
- `SystemSituation`
- `UnifiedObservation`
- `UnifiedAssessment`
- `ExecutionAssessment`

## 5. UnifiedAssessment 最小字段

- `assessment_id`
- `task_id`
- `loop_iteration`
- `task_situation_ref`
- `failure_modes`
- `success_criteria`
- `recommended_path`
- `generated_at`

## 5.1 ExecutionAssessment 最小字段（后执lines评估）

`ExecutionAssessment` is Execute 阶段完成后的四维评估：

- `execution_id`
- `correctness_score`：feedback.signals 中 failure category 比例（0-1）
- `completeness_score`：steps completed / total steps（0-1）
- `efficiency_score`：实际 tokens / 预期 budget 比值（0-1）
- `safety_score`：tool permission denial / sandbox violation signals（0-1）
- `overall_score`：加权平均 (correctness:0.3, completeness:0.3, efficiency:0.2, safety:0.2)
- `verdict`：`pass (≥0.7) | marginal (0.5-0.7) | fail (<0.5)`
- `generated_at`

Verdict 为 `fail` 时自动触发 Replan。

## 6. lines为约束

- Observe / Assess defaults to只产生信号、情境和Recommendation，不directly修改主任务链。
- 主动触发任务前必须viaauthorization、budget和治理校验。
- repeats内容必须via过 dedupe / cluster handle。
- assessment 产物必须可追溯到 signal ref / task situation ref。

## 7. vs现有文档的关系

- `perception_contract.md` 保留 Observe 最小对象模型。
- 本 contract defines Observe + Assess 作为独立平面的完整形态。
- `governance_control_plane_contract.md` 应约束 action proposal / assessment recommendation 的authorization路径。

## 8. 分阶段references入

- Phase 3: source ingestion + task situation + assessment MVP。
- Phase 4: enterprise source、团队共享和多租户 Observe/Assess 边界。

## 9. 补充规则

- ranking 至少综合：相关度、重要度、时效性、来源可信度、for deduplication后覆盖度。
- source trust 评分至少分为：`low | medium | high | verified`。
- assessment freshness 应按 source class型defines SLA，如高频源短窗口、低频源长窗口。
