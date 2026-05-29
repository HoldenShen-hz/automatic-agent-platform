# Enterprise Secret Management Contract

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

本 contract defines工业级 secret 生命cycle、托管方案和uses审计。

相关文档：

- `sandbox_and_auth_contract.md`
- `policy_engine_contract.md`
- `tenant_and_organization_contract.md`

## 2. 目标

- secret 不以明文长期落在应用configure或 worker 文件系统。
- secret 读取、轮换、作用域和usesrecord可审计。
- worker defaults to拿不到exceeds出自身执lines范围的秘密。

## 3. Secret 分class

- `provider_api_key`
- `tenant_credential`
- `oauth_client_secret`
- `signing_key`
- `db_connection_secret`
- `break_glass_secret`

## 4. 推荐托管边界

| 场景 | 推荐方案 |
| --- | --- |
| 本地开发 | `.env` only限开发 |
| 共享测试/预发 | Secret Manager / Vault |
| 生产 | Vault / KMS / Cloud Secret Manager |

## 5. 关键规则

- secret 必须有 `scope`，至少区分 system / tenant / workspace / worker。
- secret 必须有 rotation policy。
- worker 只应拿到短时、最小作用域凭证。
- secret 注入型短时凭证必须满足硬 TTL upper limit：`TTL <= 300s`。
- secret value 不得出现在日志、event payload、artifact 或 memory。
- secret value 不得进入 prompt、tool 输出回显、debug dump 或 crash snapshot。

## 6. uses流程

1. call方声明所需 secret capability。
2. Policy Engine 校验request主体isno有权访问。
3. Secret provider 返回临时凭证或受控明文。
4. useslines为writes audit trail。
5. 到期或任务结束后回收。

补充规则：

- secret provider 不应把长期明文directly下发给不可信 worker；优先uses短时凭证或受控代理访问。
- provider credential pool / model provider runtime 在消费 `secret_ref` 时，应优先uses provider-issued short-lived lease；request或流式会话结束后必须回收对应 lease。
- emergency mode获取 secret 必须留下 break-glass 审计vs事后复盘record。
- release pipeline、deployment matrix、CI/CD workflow defaults to只允许传播 `secret_ref` vs等价 masked metadata，不允许把 registry / deploy secret 明文writes bundle、artifact、CLI stdout 或 workflow 文件。

## 7. 审计字段

- `secret_ref`
- `scope`
- `requested_by`
- `granted_to`
- `granted_at`
- `expires_at`
- `ttl_seconds`
- `usage_purpose`

当前基线实现补充：

- authoritative metadata storage于 `secret_registry`
- uses审计 append-only storage于 `secret_usage_audits`
- 轮换事件 append-only storage于 `secret_rotation_events`
- 短时凭证签发Status authoritative storage于 `secret_leases`，record `issued_at / expires_at / revoked_at / revoked_by / revocation_reason_code`
- 当前本地 provider seam 允许 `environment / vault / kms / secret_manager` 走统一解析接口；其中 `vault / kms / secret_manager` 现supported provider-specific JSON/file-backed external adapter，并可via `issued_lease` Description provider-issued short-lived credential；在真实 provider 接入前仍可由 env-backed adapter 托底
- `deployment-execution` CLI 现已via统一 secret management seam 解析 registry / deploy secret，而不isdirectly旁路读取环境variable
- provider credential pool / `MiniMaxChatService` 现已supported保留 managed `secret_ref`，在运lines时via `SecretManagementService.issueSecretLease(...)` 签发并在request完成后回收 lease，而不is在启动时长期保留明文 API key

## 8. 轮换要求

- supported计划性轮换和紧急轮换。
- 轮换failed应触发告警。
- break-glass secret 必须双人知晓或双审批触发。

## 9. 禁止项

- 把生产keyhardcodes进 prompt、yaml、fixture
- worker 持久化长期key副本
- 在 CLI 输出或 debug snapshot 中directly暴露 secret
- 在 release bundle、deployment report 或 workflow artifact 中writes明文 registry/deploy secret

## 10. 收口Conclusion

工业级 secret manage的核心不is“有地方存 key”，而is：

- 最小作用域
- 临时凭证
- 轮换
- 审计


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-50: 本文原先只定性要求“短时凭证”，Root cause:  secret 合同强调托管和审计，却没有把运lines时注入的 TTL 硬upper limit写成可执lines约束。修复：正文现把 secret 注入型短时凭证mandatory收敛到 `TTL <= 300s`，并要求审计字段显式record `ttl_seconds`。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
