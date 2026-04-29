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

### Latency Tier 定义

| Tier | 目标延迟 | 典型场景 | 约束 |
|------|----------|----------|------|
| 超低延迟（deterministic） | < 50ms P99 | 交易、风控 | `deterministic_hot_path_only`：不可使用 LLM loop 或 Harness 通用路径；必须独立 deterministic 执行路径 |
| 实时 | < 500ms P99 | 对话、协同 | 可用 LLM，但需 budget cap |
| 准实时 | < 5s P99 | 分析、生成 | 可用 LLM + standard harness |
| 批处理 | 小时级 | 报表、训练 | 无严格 SLA 要求 |

### v4.3 非目标边界

超低延迟 tier 的 `deterministic_hot_path_only` 约束是 v4.3 的强制边界（§3.2）。违反此约束的域不得声明为超低延迟 tier，必须降级至实时或准实时 tier。平台在域注册时校验 tier 约束声明与实际 capability 的一致性。

## 后果

- 领域配置不再缺失 SLA / latency 维度
- 超低延迟 tier 受 `deterministic_hot_path_only` 强制约束，v4.3 不允许 LLM/Harness loop 路径
