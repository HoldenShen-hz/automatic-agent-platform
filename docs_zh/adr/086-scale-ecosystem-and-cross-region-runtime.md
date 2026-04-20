# ADR-086 Scale Ecosystem And Cross Region Runtime

---

## OAPEFLIR 关联

本文档定义 OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：Region、配额、SLA、反馈、市场、连接器健康信号
- **Assess**：跨 Region 路由、资源竞争、SLA 分层、生态治理
- **Plan**：区域选择、配额分配、连接器执行和生态扩展策略
- **Execute**：多 Region 运行、抢占、公平调度、连接器调用、市场安装
- **Feedback**：用户反馈、质量信号、市场表现和连接器健康回流
- **Learn**：市场表现、资源策略和反馈驱动改进
- **Improve**：SLA、调度器、连接器与生态能力持续优化
- **Release**：跨 Region、生态组件和连接器分级发布

---

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

v2.7 `§52-§57` 要求平台进入规模化运行和开放生态阶段。当前仓库已有：

- `src/scale-ecosystem/multi-region`
- `src/scale-ecosystem/resource-manager`
- `src/scale-ecosystem/sla-engine`
- `src/scale-ecosystem/marketplace`
- `src/scale-ecosystem/feedback-loop`
- `src/scale-ecosystem/integration`

但这些目录的成熟度明显不一致。

## 决策

### 1. 多 Region 路由必须同时受数据驻留与执行就近性约束

区域选择不能只看延迟，还必须同时满足：

- data residency
- legal transfer rule
- workload affinity
- recovery topology

### 2. 配额、抢占、公平调度属于统一调度治理面

资源竞争管理不是零散策略集合，而是统一 scheduler contract。

### 3. SLA tier 必须直接影响调度与隔离

SLA 不是纯报表字段，必须参与：

- queue priority
- reservation
- preemption
- escalation

### 4. 市场、反馈、连接器采用统一生态治理思路

这三类能力虽然场景不同，但都必须遵守：

- manifest / metadata
- lifecycle
- review / certification
- rollback / revoke

## 后果

- `scale-ecosystem` 将成为跨 Region 与开放生态的统一模块边界
- 后续实现将优先补 scheduler、connector 和 cross-region contract

