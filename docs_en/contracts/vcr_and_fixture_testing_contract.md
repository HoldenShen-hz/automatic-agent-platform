# VCR And Fixture Testing Contract

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

本 contract defines provider、LLM、流式输出和外部 API 在测试中的 record / replay vs fixture 规则。

相关文档：

- `testing_singleton_reset_contract.md`
- `tool_and_provider_execution_contract.md`
- `gateway_streaming_contract.md`
- `cost_and_budget_contract.md`

## 2. 目标

VCR / fixture 测试体系至少要做到：

- CI 不relies on真实 provider 才能跑主测试集。
- 回归测试结果稳定、可重放。
- 真实request录制vs离线回放边界清楚。

## 3. 测试模式

### 3.1 `fixture_only`

- 只uses静态 fixture
- defaults to CI 主模式

### 3.2 `vcr_replay`

- 根据request指纹回放既有录制结果
- 若缺少录制则failed

### 3.3 `vcr_record`

- 本地开发时允许真实call provider
- 将request/response录制为 fixture

## 4. `RecordedInteraction`

| 字段 | class型 | Description |
|---|-------|--------|
| `interaction_id` | `string` | 录制 ID |
| `provider` | `string` | provider 标识 |
| `model` | `string` | 模型名 |
| `request_fingerprint` | `string` | 规范化request指纹 |
| `request_summary` | `json` | 脱敏后的request摘要 |
| `response_payload` | `json` | response体 |
| `stream_chunks` | `json[]?` | 流式块 |
| `usage_snapshot` | `json?` | token / cost 信息 |
| `recorded_at` | `timestamp` | 录制time |

## 5. request指纹规则

request指纹至少应contains：

- provider
- model
- system / user prompt 规范化文本
- tool 列table签名
- 关键参数（temperature、reasoning level 等）

规则：

- 不得把易波动但no语义价值的字段directly纳入指纹。
- 指纹生成前必须完成凭据脱敏。

## 6. Fixture 目录规则

Recommendation目录：

- `tests/__fixtures__/llm/`
- `tests/__fixtures__/vcr/`
- `tests/__fixtures__/gateway/`

规则：

- fixture 应按场景命名，而不is只按time戳命名。
- 同class fixture 应能看出对应任务、角色或failed场景。

## 7. 流式response规则

- 流式response可录制为 chunk 列table
- replay 时必须保持顺序、结束信号和 finish reason 一致
- 不要求逐 token 完全一致，但必须满足上层协议断言

## 8. securityvs脱敏

- 录制前必须去除 API key、cookie、token、Authorization header
- 原始敏感request不得directly进入仓库 fixture
- 若no法security脱敏，应禁止录制并要求手工 mock

## 9. failed语义

- `vcr_replay` 模式缺少匹配 fixture 时，测试必须failed
- fixture schema 不合法时，测试必须failed
- 回放结果vs当前协议不兼容时，应提示重新录制或升级 fixture 版本

## 10. vs真实测试分层

Recommendation分层：

- unit / integration：defaults to `fixture_only`
- e2e：优先 `vcr_replay`
- nightly / manual eval：可允许真实 provider

## 11. 成本vs治理

- 录制真实 provider 的成本必须可追踪
- `vcr_record` 不应在 CI defaults to开启
- 重新录制必须有明确触发条件，例如模型升级、协议变更、核心 prompt 变化

## 12. Phase 边界

Phase 1a 做：

- `fixture_only`
- 非流式 provider replay
- 缺 fixture 即 fail

Phase 1b 做：

- `vcr_replay`
- 流式 chunk replay
- 更完整的request指纹vs录制治理

当前不做：

- 大规模 fixture 自动更新服务
- 跨 provider 差异归一自动修复
- 企业级data集评估平台

## 13. 收口Conclusion

VCR / fixture 的核心不is“把一iterationscall存下来”，而is把外部不稳定relies on变成一套可控、可回放、可审计的测试输入。
