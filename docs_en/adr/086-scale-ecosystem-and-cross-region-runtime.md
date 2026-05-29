# ADR-086 Scale Ecosystem And Cross Region Runtime

---

## OAPEFLIR 关联

本文档defines OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：Region、配额、SLA、反馈、市场、connect器健康信号
- **Assess**：跨 Region 路由、资源竞争、SLA 分层、生态治理
- **Plan**：区域选择、配额分配、connect器执lines和生态扩展策略
- **Execute**：多 Region 运lines、抢占、公平调度、connect器call、市场安装
- **Feedback**：user反馈、质量信号、市场table现和connect器健康回流
- **Learn**：市场table现、资源策略和反馈驱动改进
- **Improve**：SLA、调度器、connect器vs生态能力持续优化
- **Release**：跨 Region、生态组件和connect器分级发布

---

- Status：Accepted
- Decision日期：2026-04-20

## Background

当前权威口径对应 `docs_zh/architecture/00-platform-architecture.md` 中多 Region、SLA vs生态扩展章节。当前仓库已有：

- `src/scale-ecosystem/multi-region`
- `src/scale-ecosystem/resource-manager`
- `src/scale-ecosystem/sla-engine`
- `src/scale-ecosystem/marketplace`
- `src/scale-ecosystem/feedback-loop`
- `src/scale-ecosystem/integration`

但这些目录的成熟度明显inconsistent。

## Decision

### 1. 多 Region 路由必须同时受data驻留vs执lines就近性约束

区域选择不能只看delay，还必须同时满足：

- data residency
- legal transfer rule
- workload affinity
- recovery topology

### 2. 配额、抢占、公平调度belongs to统一调度治理面

资源竞争manage不is零散策略集合，而is统一 scheduler contract。

### 3. SLA tier 必须directlyImpact调度vs隔离

SLA 不is纯报table字段，必须参vs：

- queue priority
- reservation
- preemption
- escalation

### 4. 市场、反馈、connect器采用统一生态治理思路

这三class能力虽然场景不同，但都必须遵守：

- manifest / metadata
- lifecycle
- review / certification
- rollback / revoke

## Consequences

- `scale-ecosystem` 将成为跨 Region vs开放生态的统一模块边界
- 后续实现将优先补 scheduler、connector 和 cross-region contract
