# Gateway Message Contract

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

本 contract defines CLI、Web、Telegram 等渠道vs平台之间交换的统一消息结构。

## 2. 关键对象

- `GatewayMessage`
- `GatewayReply`
- `DecisionRequest`
- `DecisionResponse`
- `ProgressEvent`

## 3. GatewayMessage 最小字段

| 字段 | class型 | Description |
|---|-------|--------|
| `channel` | `string` | 渠道标识 |
| `external_user_id` | `string` | 渠道user标识 |
| `external_session_id` | `string?` | 渠道会话标识 |
| `message_id` | `string` | 外部消息 ID |
| `content` | `string` | 文本内容 |
| `attachments` | `Attachment[]?` | 附件 |
| `created_at` | `timestamp` | 接收time |

## 4. GatewayReply 最小字段

- `channel`
- `target_user_id`
- `target_session_id?`
- `content`
- `artifacts?`
- `buttons?`

## 5. Decision交互

DecisionRequest 至少需要：

- `decision_id`
- `harness_run_id`
- `node_run_id?`
- `task_id?`
- `reason`
- `options`
- `deadline?`

DecisionResponse 至少需要：

- `decision_id`
- `selected_option`
- `comment?`
- `responded_at`

## 6. lines为约束

- 网关层只做适配，不改平台语义。
- 渠道差异应via formatter / adapter 解决。
- Decisionrequest必须可追踪回具体任务和升级原因。

## v4.3 Contract Remediation

- T-65: 本文原先把 `task_id` 写成Decision交互唯一关联键，Root cause: 网关消息 contract 仍按任务级 UI 模型defines审批，而没有下沉到实际运lines实例。修复：正文现把 `harness_run_id / node_run_id` 提升为Decision链权威关联键，`task_id` 只保留渠道聚合语义。

## 7. 补充规则

- 附件统一模型至少contains：`artifact_id`、`display_name`、`mime_type`、`size_bytes`、`download_ref`。
- 渠道能力矩阵至少覆盖：`text`、`buttons`、`attachments`、`stream`、`notifications`。
- 富文本vs按钮若不被渠道supported，必须退化为纯文本 + #选项。
- gateway 可以维护 `ChannelDirectory` 或等价 target registry，used for把平台can enumerate目标vs历史会话来源统一成只读目标目录。
- 发送前若accepts人class可读目标名，应先解析成 canonical target id；只允许精确匹配或唯一前缀匹配，歧义时必须 fail-close。
- 新平台接入不应只改 adapter 文件；至少应synchronous更新 platform enum、adapter factory、auth map、session source、tool delivery、cron delivery vs target directory 入口。

### 7.1 vs MessageParts 的衔接

`GatewayMessage` is渠道侧入站消息，进入平台后必须投影为 `message_parts_contract.md` defines的结构化 `MessagePart` 序列：

| GatewayMessage 字段 | 投影目标 MessagePart class型 | Description |
|---|-------|--------|
| `content`（纯文本） | `text` | user消息主体 |
| `attachments` | `artifact_ref` | 每个附件生成独立 artifact，MessagePart 持有references用 |
| DecisionResponse（审批回传） | `decision_prompt` | 审批结果作为结构化 part，不混入纯文本 |

`GatewayReply` is平台出站消息，由内部 `MessagePart` 序列反向投影生成：

| MessagePart class型 | 投影目标 GatewayReply 字段 | Description |
|---|-------|--------|
| `text` | `content` | 拼接为渠道展示文本 |
| `artifact_ref` | `artifacts` | 转换为渠道附件 |
| `decision_prompt` | `buttons` | 转换为渠道按钮或#选项 |
| `tool_use` / `tool_result` / `reasoning` 等运lines证据 | defaults to不投影到渠道 | only在 debug 模式或user显式request时降级为文本展示 |

规则：

- 投影过程不得丢失结构化语义；`GatewayMessage.content` 进入平台后必须作为 `text` part storage，不得只保留原始字符串。
- 渠道不supported的 part class型必须有明确的降级策略（隐藏或转为纯文本），不得静默丢弃。
- 投影关系由 gateway adapter 层负责，不得散落在 runtime 或 workflow 层。

补充Description：

- 渠道能力矩阵vs命名边界以下钻文档 `naming_and_engineering_boundary_contract.md` 为准。
