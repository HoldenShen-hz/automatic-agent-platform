# ADR-105 Domain Latency Tier Classification

---

## OAPEFLIR 关联

- **Observe**: 采集领域 latency / SLA 需求
- **Assess**: 分类为超低延迟、实时、准实时、批处理
- **Plan**: 分配资源与调度策略
- **Execute**: 按 latency tier 运行
- **Feedback**: 监控 breach 与拥塞
- **Learn**: 优化资源池分配
- **Improve**: 调整域级 SLA
- **Release**: latency tier 进入域上线门

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

不同领域的时延要求差异很大，统一调度策略会导致资源浪费或 SLA 失效。

## 决策

- 每个域都必须声明 latency tier
- 平台据此分配队列优先级、资源池和恢复顺序
- `deterministic_hot_path_only` 域不得把 latency tier 解释为允许进入自由 LLM loop；LLM 参与必须保持受控边界
- 本 ADR 只定义域级 latency tier，不作为 v4.3 非目标边界之外的“自动开放式 LLM loop”授权来源

## 后果

- 领域配置不再缺失 SLA / latency 维度
