# 内存压力 Runbook

## 症状

- `AutomaticAgentMemoryPressure` 告警持续触发
- RSS 持续高于当前告警阈值 `450MiB`（见 Prometheus rule）
- runtime 延迟与 GC pause time 同步升高

## 诊断

1. 先看内存曲线是否持续单调上升，区分泄漏与短时负载尖峰。
2. 区分增长发生在 RSS、heap 还是 external memory。
3. 把增长窗口与近期 plugin 激活、大 artifact bundle、replay job、批量导入等事件做关联。
4. 同时检查队列 backlog 和 active execution 数，判断是容量不足还是对象未释放。

## 处置

1. 先暂停非关键或批处理 workload，降低继续放大的压力面。
2. 如果增长已定位到单一 plugin、workflow 或 ingestion path，先局部摘除该路径。
3. 只有在证据已保留后才允许重启服务，避免把泄漏线索一起清空。
4. 若确认是容量基线不足，而非泄漏，则同步上调内存 limit 与 replica 数，不要只加单 Pod 内存。

## 验证

1. 确认 RSS 回落到 `450MiB` 阈值以下，并在 10 分钟告警窗口内保持稳定。
2. 验证健康状态回到 `ok` 或稳定的 `degraded`，不能反复震荡。
3. 若已确认泄漏特征或危险 workload 模式，必须补后续整改项，而不是只做一次重启。
