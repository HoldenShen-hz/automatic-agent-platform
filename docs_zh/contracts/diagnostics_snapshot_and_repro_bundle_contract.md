# Diagnostics Snapshot And Repro Bundle Contract

## 1. 范围

本 contract 定义失败时的诊断快照、最小复现包和解释模式。

相关文档：

- `debug_inspect_health_backpressure_contract.md`
- `result_envelope_contract.md`
- `tool_output_sanitization_contract.md`

## 2. 目标

提升失败定位效率：

- 自动生成诊断快照
- 导出最小复现包
- 支持解释模式与决策链视图

## 3. `DiagnosticSnapshot`

至少包含：

- 当前状态
- 最近事件
- 最近工具调用
- 当前上下文摘要
- OAPEFLIR 当前阶段与 loop iteration 摘要
- 文件锁状态
- 配置版本
- provider 状态
- 基本系统信息（OS、版本、架构、运行模式）
- enabled extensions / plugins 摘要
- prompt bundle / prompt template 版本摘要
- 调度与计划任务相关摘要（若系统支持 schedule / automation / scheduled workflow）

## 4. `MinimalReproBundle`

至少包含：

- task input
- workflow state
- oapeflir timeline
- relevant messages
- tool usage
- feedback signals / learning objects / rollout refs（若相关）
- sanitized artifacts
- config subset
- session / interaction export（若存在交互层）
- prompt bundle 或最小 prompt overlay 快照
- scheduled recipe / automation 定义子集（若与故障相关）

补充规则：

- diagnostics / repro bundle 应支持导出为单一压缩包或等价可共享工件，便于支持与排障。
- 导出前必须明确提醒用户：bundle 可能包含 session messages、日志、配置和其他敏感信息。
- diagnostics 导出不应默认包含 secret 原文、未脱敏 token 或 crash dump 中的敏感字段。
- 若系统支持 issue / incident 创建辅助，应优先生成“预填系统信息的报告入口”，而不是要求用户手工收集环境信息。
- 若系统支持多种 prompt template、计划任务或启用扩展，bundle 应尽量同时携带“实际生效的版本/清单”，而不是只导出通用配置。

## 5. `IncidentTimelineReport`

当任务失败或需要事后排障时，系统应能自动生成事故时间线报告。

### 5.1 最小字段

- `taskId`
- `traceSummary`（traceId / correlationId / spanIds）
- `window`（startedAt / endedAt / durationMs）
- `summary`（含各类来源计数：event / dispatch / step_output / approval / artifact / log / remote_log / message / compaction）
- `highestSeverity`
- `warnings`（结构化警告摘要）
- `candidateRootCauses`（自动推断的可能根因）
- `entries`（按时间排序的事故条目）

### 5.2 IncidentTimelineEntry

每条时间线条目至少包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 条目 ID |
| `source` | `string` | 来源：`event` / `dispatch` / `step_output` / `approval` / `artifact` / `log` / `remote_log` / `message` / `compaction` |
| `occurredAt` | `timestamp` | 发生时间 |
| `title` | `string` | 条目标题 |
| `summary` | `string` | 条目摘要 |
| `severity` | `string` | `info` / `warning` / `critical` |
| `traceId?` | `string` | 关联 trace |
| `spanId?` | `string` | 关联 span |
| `data` | `json` | 条目载荷 |

### 5.3 RemoteTimelineReport

当任务涉及远程 worker 时，应能生成远程执行时间线子视图：

- `taskId`、`traceSummary`
- `totalEntries`、`totalRemoteLogs`、`latestRemoteLogAt`
- `remoteWorkerIds`
- `entries`

## 5A. 诊断警告分类体系

### 5A.1 警告类别

| category | 含义 |
| --- | --- |
| `health` | 健康检查异常（DB 不可写、provider 失败等） |
| `runtime` | 运行时异常（execution stalled、workflow 失败等） |
| `approval` | 审批异常（长时间 pending、级联拒绝等） |
| `takeover` | 人工接管相关 |
| `provider` | LLM provider 降级或不可用 |
| `dispatch` | 调度异常（worker 不可用、隔离不满足等） |
| `remote_authority` | 远程 worker 权限违规或一致性异常 |
| `other` | 未分类 |

### 5A.2 警告严重性

| severity | 含义 |
| --- | --- |
| `info` | 仅供了解，不需立即行动 |
| `warning` | 需要关注，可能需要后续行动 |
| `critical` | 需要立即响应 |

### 5A.3 升级目标

| escalation | 含义 |
| --- | --- |
| `none` | 无需升级 |
| `task` | 升级到任务级别处理 |
| `operator` | 升级到运维人员 |

### 5A.4 `DiagnosticWarningSummary`

聚合警告摘要至少包含：

- `totalEvents`
- `totalUniqueWarnings`
- `suppressedDuplicateCount`（同类去重被抑制的次数）
- `highestSeverity`
- `escalationTargets`
- `entries`（每条含 code / category / severity / escalation / count / suppressedCount）

## 6. `ExplanationRecord`

用于回答：

- 为什么选这个 division
- 为什么升级 HITL
- 为什么拒绝命令
- 为什么触发重试
- 为什么切 fallback provider
- 为什么接受或拒绝 improvement candidate
- 为什么推进或阻断 rollout

## 6. 收口结论

诊断快照、最小复现包和解释模式，是把“系统出了问题只能猜”变成“系统能自己交代上下文”的关键能力。
