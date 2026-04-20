# Phase 2b Memory Governance Stability

## 1. 目标

把系统从“能跑”提升到“能持续稳定运行”，重点强化记忆、渠道、监管和稳定性治理。

## 2. 进入条件

- 多 division 已验证可用
- artifact、trace、recovery 在跨 division 场景下稳定
- 基础观测链路已可支撑长期运行分析
- 进入 2b 前已重新通过 `operations-checklist.md` 的当前阶段签收

## 3. 必做范围

- 六层记忆系统与 KV cache 固定前缀的分阶段落地。
- 多渠道接入策略增强。
- 安全、审批、监管策略强化。
- 故障恢复、日志、指标、审计增强。
- 长时运行与成本稳定性治理。

## 4. 非目标

- 全量生态开放。
- 不以一次性完成 Enterprise 高级组织能力为目标。

## 5. 关键 contract / 主文档

- [03_data_feedback_and_learning.md](../../03_data_feedback_and_learning.md)
- [adr/003-memory-seven-layers.md](../../adr/003-memory-seven-layers.md)
- [observability_contract.md](../../contracts/observability_contract.md)
- [slo_alerting_and_runbook_contract.md](../../contracts/slo_alerting_and_runbook_contract.md)
- [memory_decay_and_quality_contract.md](../../contracts/memory_decay_and_quality_contract.md)
- [trace_and_root_cause_observability_contract.md](../../contracts/trace_and_root_cause_observability_contract.md)
- [operations-checklist.md](../operations-checklist.md)

## 6. 核心交付物

- 记忆层最小实现与成本策略。
- 多渠道网关约束文档与实现计划。
- 监管与稳定性专项基线。
- Phase 2b 稳定性评审。

## 7. 验收与退出门槛

- 长时运行稳定。
- 记忆收益明显且成本可控。
- 监管事件可审计。
- 多渠道不会破坏平台主语义。
- 当前阶段涉及模块已满足 `operations-checklist.md` 中对应的“当前阶段可验收”标准。

## 8. 风险与控制点

- 风险：记忆收益不明显但成本快速抬升。
- 控制：按 ROI 分层落地，保留禁用与回滚路径。
- 风险：多渠道适配重新定义平台主语义。
- 控制：渠道只是外层适配，不改 task / approval / event 真相。

## 9. 向下一阶段交接

- 2c 只在稳定性基线已经足够可靠的前提下引入 skill / HR / evolution。
