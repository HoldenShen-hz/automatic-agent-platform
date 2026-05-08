# VCR And Fixture Testing Contract

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

本 contract 定义 provider、LLM、流式输出和外部 API 在测试中的 record / replay 与 fixture 规则。

相关文档：

- `testing_singleton_reset_contract.md`
- `tool_and_provider_execution_contract.md`
- `gateway_streaming_contract.md`
- `cost_and_budget_contract.md`

## 2. 目标

VCR / fixture 测试体系至少要做到：

- CI 不依赖真实 provider 才能跑主测试集。
- 回归测试结果稳定、可重放。
- 真实请求录制与离线回放边界清楚。

## 3. 测试模式

### 3.1 `fixture_only`

- 只使用静态 fixture
- 默认 CI 主模式

### 3.2 `vcr_replay`

- 根据请求指纹回放既有录制结果
- 若缺少录制则失败

### 3.3 `vcr_record`

- 本地开发时允许真实调用 provider
- 将请求/响应录制为 fixture

## 4. `RecordedInteraction`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `interaction_id` | `string` | 录制 ID |
| `provider` | `string` | provider 标识 |
| `model` | `string` | 模型名 |
| `request_fingerprint` | `string` | 规范化请求指纹 |
| `request_summary` | `json` | 脱敏后的请求摘要 |
| `response_payload` | `json` | 响应体 |
| `stream_chunks` | `json[]?` | 流式块 |
| `usage_snapshot` | `json?` | token / cost 信息 |
| `recorded_at` | `timestamp` | 录制时间 |

## 5. 请求指纹规则

请求指纹至少应包含：

- provider
- model
- system / user prompt 规范化文本
- tool 列表签名
- 关键参数（temperature、reasoning level 等）

规则：

- 不得把易波动但无语义价值的字段直接纳入指纹。
- 指纹生成前必须完成凭据脱敏。

## 6. Fixture 目录规则

建议目录：

- `tests/__fixtures__/llm/`
- `tests/__fixtures__/vcr/`
- `tests/__fixtures__/gateway/`

规则：

- fixture 应按场景命名，而不是只按时间戳命名。
- 同类 fixture 应能看出对应任务、角色或失败场景。

## 7. 流式响应规则

- 流式响应可录制为 chunk 列表
- replay 时必须保持顺序、结束信号和 finish reason 一致
- 不要求逐 token 完全一致，但必须满足上层协议断言

## 8. 安全与脱敏

- 录制前必须去除 API key、cookie、token、Authorization header
- 原始敏感请求不得直接进入仓库 fixture
- 若无法安全脱敏，应禁止录制并要求手工 mock

## 9. 失败语义

- `vcr_replay` 模式缺少匹配 fixture 时，测试必须失败
- fixture schema 不合法时，测试必须失败
- 回放结果与当前协议不兼容时，应提示重新录制或升级 fixture 版本

## 10. 与真实测试分层

建议分层：

- unit / integration：默认 `fixture_only`
- e2e：优先 `vcr_replay`
- nightly / manual eval：可允许真实 provider

## 11. 成本与治理

- 录制真实 provider 的成本必须可追踪
- `vcr_record` 不应在 CI 默认开启
- 重新录制必须有明确触发条件，例如模型升级、协议变更、核心 prompt 变化

## 12. Phase 边界

Phase 1a 做：

- `fixture_only`
- 非流式 provider replay
- 缺 fixture 即 fail

Phase 1b 做：

- `vcr_replay`
- 流式 chunk replay
- 更完整的请求指纹与录制治理

当前不做：

- 大规模 fixture 自动更新服务
- 跨 provider 差异归一自动修复
- 企业级数据集评估平台

## 13. 收口结论

VCR / fixture 的核心不是“把一次调用存下来”，而是把外部不稳定依赖变成一套可控、可回放、可审计的测试输入。
