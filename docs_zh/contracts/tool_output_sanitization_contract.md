# Tool Output Sanitization Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 rollout
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义所有外部工具输出在进入消息、日志、事件、artifact 索引前必须经过的统一净化管线。

相关文档：

- `tool_and_provider_execution_contract.md`
- `gateway_streaming_contract.md`
- `observability_contract.md`
- `policy_engine_contract.md`

## 2. 目标

统一净化管线至少要解决：

- ANSI / 控制字符污染输出
- 超长输出拖垮上下文窗口
- 凭据、token、cookie 等敏感信息泄漏
- prompt injection 片段未标记直接流入上游总结

## 3. `SanitizedToolOutput`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `raw_ref` | `string?` | 原始输出引用 |
| `sanitized_text` | `string` | 净化后的文本主体 |
| `truncated` | `boolean` | 是否截断 |
| `redaction_count` | `number` | 脱敏次数 |
| `control_chars_removed` | `number` | 清理控制字符数 |
| `ansi_removed` | `boolean` | 是否去除 ANSI |
| `injection_risk` | `none \| low \| medium \| high` | 注入风险评级 |
| `warnings` | `string[]` | 净化告警 |
| `knowledge_ref` | `string?` | 若输出进入知识链，对应知识引用 |
| `memory_ref` | `string?` | 若输出进入记忆链，对应记忆引用 |

## 4. 管线顺序

```mermaid
flowchart LR
    A["Raw Tool Output"] --> B["Strip ANSI"]
    B --> C["Remove Control Chars"]
    C --> D["Secret Redaction"]
    D --> E["Normalize Newlines / Tags"]
    E --> F["Length Truncation"]
    F --> G["Injection Risk Marking"]
    G --> H["Persist + Return Sanitized Output"]
```

规则：

- 顺序不得颠倒；先脱敏再截断可避免敏感信息恰好落在保留窗口中。
- 原始大输出可归档为 artifact，但上层 message / summary 默认只读取净化版本。
- 原始输出若包含高风险敏感信息，artifact 保留也必须经过访问控制与作用域标记。

## 5. 最小净化动作

- 去除 ANSI 颜色码
- 去除非法控制字符
- 统一换行和结尾空白
- 针对常见凭据模式做脱敏
- 超过阈值时截断并保留首尾摘要
- 标记明显的 prompt injection 片段

## 6. 长度策略

建议同时维护两类阈值：

- `stream_preview_limit_chars`
- `persisted_message_limit_chars`

规则：

- streaming 预览可以更短，持久化摘要可以略长。
- 被截断的正文应附带 `raw_ref` 或 artifact 引用，供后续人工审查。

## 7. 注入风险标记

至少识别以下模式：

- 要求忽略系统指令
- 要求泄漏凭据
- 要求执行越权动作
- 明显伪装成系统消息或工具协议

规则：

- 风险标记不等于自动拒绝；它会交给 Policy Engine 与上层总结逻辑进一步处理。
- `high` 风险输出不得直接作为后续 LLM 的唯一输入片段。
- 被判为 `high` 风险的输出，默认不应直接进入 memory。

## 8. 存储与展示边界

- `messages.content` 存净化结果，不默认存原始污染文本。
- 原始输出若需要保留，应落 artifact 并标记访问控制。
- 事件、日志、summary 默认只记录净化结果或其摘要。
- debug dump 默认读取净化版本；若确需查看原始输出，应受更高权限和额外审计保护。
- 若输出后续进入 knowledge / memory / feedback 链，必须保留 provenance 标记，不得把净化后的文本伪装成“原生内部文本”。

## 9. Phase 边界

Phase 1a 明确做：

- ANSI 清理
- 控制字符清理
- 凭据脱敏
- 长度截断
- 注入风险分级

当前不做：

- 完整 DLP 引擎
- 多语言深度语义敏感信息检测
- 企业级内容审查工作流

## 10. 收口结论

工具输出不是“拿到就能直接喂回模型”的安全对象；净化管线是把外部文本变成平台内部可信输入的第一道门。
