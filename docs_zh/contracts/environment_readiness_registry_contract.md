# Environment Readiness Registry Contract

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

本 contract 定义外部环境与关键运行依赖的 readiness registry。

它回答的问题是：在进入 staging、pre-prod 或 prod 之前，系统如何统一记录 provider、gateway、sandbox、worker fleet、artifact store 等外部依赖是否已就绪。

相关文档：

- `environment_and_configuration_governance_contract.md`
- `enterprise_secret_management_contract.md`
- `release_rollout_and_rollback_contract.md`
- `slo_alerting_and_runbook_contract.md`

## 2. 目标

- 把 readiness 从“靠人记忆”变成统一 registry。
- 为 release gate、go-live gate 和 incident 诊断提供 authoritative readiness 事实。
- 将 credential、secondary gates、owner、last verified time 统一建模。

## 3. 关键对象

- `EnvironmentReadinessRecord`
- `EnvironmentReadinessGateSet`
- `EnvironmentReadinessSummary`

## 4. `EnvironmentReadinessRecord` 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `readiness_id` | `string` | readiness 记录 ID |
| `environment` | `dev | test | staging | pre-prod | prod` | 所属环境 |
| `component_type` | `provider | gateway | sandbox | worker_fleet | artifact_store | notification_channel | external_service` | 组件类型 |
| `component_id` | `string` | 组件标识 |
| `credential_ready` | `boolean` | 凭据是否就绪 |
| `secondary_gates_json` | `json` | 二级门禁，如 webhook、moderation、quota、attestation |
| `owner` | `string` | 维护 owner |
| `last_verified_at` | `timestamp` | 最近一次验证时间 |
| `is_active` | `boolean` | 是否当前生效 |
| `notes?` | `string` | 补充说明 |

## 5. Gate 语义

最小 gate 模型：

- `credential_ready`
- `network_ready?`
- `webhook_ready?`
- `moderation_ready?`
- `quota_ready?`
- `attestation_ready?`
- `artifact_namespace_ready?`

规则：

- `credential_ready = false` 时，所有依赖该组件的正式操作默认 fail-closed。
- 二级 gate 未通过时，应阻断对应能力，而不是只打 warning。
- `last_verified_at` 过旧时，系统可将 readiness 降为 `stale` 并触发复核。

## 6. `EnvironmentReadinessSummary`

最小字段：

- `environment`
- `component_type`
- `total`
- `ready`
- `not_ready`
- `stale`
- `all_ready`

## 7. 与 release gate 的关系

- staging / pre-prod / prod 的 go-live gate 应引用 readiness registry，而不是人工口头确认。
- release gate 必须能回答：
  - 哪些外部依赖未 ready
  - 由谁负责
  - 最近一次验证是什么时候

## 8. 当前边界

当前优先覆盖：

- provider
- gateway
- sandbox
- artifact store
- worker fleet

当前不做：

- 面向每个第三方业务平台的细粒度 readiness 子表爆炸
- 把业务域特化 readiness 模型直接复制进当前系统

## 9. 收口结论

环境 readiness 不应只存在于 release 口头检查中。

它应当成为可查询、可审计、可被 release gate 消费的一等注册表。
