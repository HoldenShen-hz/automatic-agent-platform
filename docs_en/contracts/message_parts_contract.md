# Message Parts Contract

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

## 1. 范围

本 contract defines消息内容的分段模型，used for统一user消息、assistant 输出、tool use、tool result 和摘要片段。

相关文档：

- `gateway_message_contract.md`
- `gateway_streaming_contract.md`
- `context_compaction_and_overflow_contract.md`

## 2. 目标

- 把消息从“大文本 blob”升级成结构化 parts。
- 为增量持久化、精细裁剪和回放提供统一基础。
- 避免 `text / tool_result / summary / artifact refs` 混在一个字段里。

## 3. Part class型

- `text`
- `reasoning`
- `tool_use`
- `tool_result`
- `summary`
- `artifact_ref`
- `question_prompt`
- `todo_update`
- `decision_prompt`
- `agent_ref`
- `subtask_ref`
- `retry_record`
- `step_boundary`
- `compaction_marker`
- `hook_event`
- `command_execution`
- `mcp_call`

## 4. `MessagePart` 最小字段

| 字段 | class型 | Description |
|---|-------|--------|
| `part_id` | `string` | part ID |
| `message_id` | `string` | 所属消息 |
| `part_type` | `string` | 上述 part class型 |
| `sequence` | `integer` | 同一消息内顺序 |
| `content_json` | `json` | part 载荷 |
| `lineage_json?` | `json` | 来源、压缩、重试或恢复链信息 |
| `created_at` | `timestamp` | 创建time |

## 5. lines为约束

- `sequence` 在同一消息内必须单调递增。
- `tool_result` 不得伪装为纯文本。
- 大体积输出应优先沉淀为 `artifact_ref` 或 `summary`。
- 旧 `tool_result` 在 compaction 后，原始详情应优先沉淀为 `artifact_ref`，并补一条 `summary` part 供模型继续消费。
- context compaction 应优先裁剪 `tool_result` parts，而不isuser输入或最终Conclusion。
- `reasoning` part vs `text` part 必须显式区分，避免把内部推理和面向user文本混成一个展示层字段。
- `retry_record`、`step_boundary`、`compaction_marker` 这class运lines证据 part 必须可security重放，且不得作为普通对话文本再iterations送入模型。
- `agent_ref` / `subtask_ref` 应table达派发事实、来源和目标，不得只靠自由文本record。
- `hook_event`、`command_execution`、`mcp_call` 这class运lines项若进入历史面，应作为独立结构化 part，而不is混入 assistant 普通文本。

## 6. 推荐载荷约束

- `reasoning`: only保存可对外保留的推理摘要，不保存未via治理的隐私或敏感内部链路。
- `tool_result`: 大内容defaults to外置到 artifact，only保留摘要、references用和必要元data。
- `retry_record`: 至少contains `attempt`、`error_code`、`retry_delay_ms`、`source`.
- `step_boundary`: 至少contains `step_id`、`boundary_kind` (`started | completed | failed | skipped`)。
- `compaction_marker`: 至少contains `compaction_id`、`covered_message_ids`、`auto`、`overflow_triggered`.
- `hook_event`: 至少contains `hook_name`、`phase`、`result_kind`.
- `command_execution`: 至少contains `command_ref`、`status`、`cwd`、`duration_ms?`.
- `mcp_call`: 至少contains `server_name`、`tool_name`、`status`、`duration_ms?`.
- `question_prompt`: 至少contains `question_id`、`mode` (`single | multi | text`)、`options?`、`recommended_option_id?`、`timeout_policy?`.
- `todo_update`: 至少contains `todo_id`、`status` (`pending | in_progress | completed | cancelled`) 和 `source`.

## 7. 收口Conclusion

Message parts is消息层的基础抽象，后续 stream replay、partial persistence 和 context compaction 都应建立在这个模型上。
