# Enterprise Secret Management Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 release
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义工业级 secret 生命周期、托管方案和使用审计。

相关文档：

- `sandbox_and_auth_contract.md`
- `policy_engine_contract.md`
- `tenant_and_organization_contract.md`

## 2. 目标

- secret 不以明文长期落在应用配置或 worker 文件系统。
- secret 读取、轮换、作用域和使用记录可审计。
- worker 默认拿不到超出自身执行范围的秘密。

## 3. Secret 分类

- `provider_api_key`
- `tenant_credential`
- `oauth_client_secret`
- `signing_key`
- `db_connection_secret`
- `break_glass_secret`

## 4. 推荐托管边界

| 场景 | 推荐方案 |
| --- | --- |
| 本地开发 | `.env` 仅限开发 |
| 共享测试/预发 | Secret Manager / Vault |
| 生产 | Vault / KMS / Cloud Secret Manager |

## 5. 关键规则

- secret 必须有 `scope`，至少区分 system / tenant / workspace / worker。
- secret 必须有 rotation policy。
- worker 只应拿到短时、最小作用域凭证。
- secret 注入型短时凭证必须满足硬 TTL 上限：`TTL <= 300s`。
- secret value 不得出现在日志、event payload、artifact 或 memory。
- secret value 不得进入 prompt、tool 输出回显、debug dump 或 crash snapshot。

## 6. 使用流程

1. 调用方声明所需 secret capability。
2. Policy Engine 校验请求主体是否有权访问。
3. Secret provider 返回临时凭证或受控明文。
4. 使用行为写入 audit trail。
5. 到期或任务结束后回收。

补充规则：

- secret provider 不应把长期明文直接下发给不可信 worker；优先使用短时凭证或受控代理访问。
- provider credential pool / model provider runtime 在消费 `secret_ref` 时，应优先使用 provider-issued short-lived lease；请求或流式会话结束后必须回收对应 lease。
- 紧急模式获取 secret 必须留下 break-glass 审计与事后复盘记录。
- release pipeline、deployment matrix、CI/CD workflow 默认只允许传播 `secret_ref` 与等价 masked metadata，不允许把 registry / deploy secret 明文写入 bundle、artifact、CLI stdout 或 workflow 文件。

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

- authoritative metadata 存储于 `secret_registry`
- 使用审计 append-only 存储于 `secret_usage_audits`
- 轮换事件 append-only 存储于 `secret_rotation_events`
- 短时凭证签发状态 authoritative 存储于 `secret_leases`，记录 `issued_at / expires_at / revoked_at / revoked_by / revocation_reason_code`
- 当前本地 provider seam 允许 `environment / vault / kms / secret_manager` 走统一解析接口；其中 `vault / kms / secret_manager` 现支持 provider-specific JSON/file-backed external adapter，并可通过 `issued_lease` 描述 provider-issued short-lived credential；在真实 provider 接入前仍可由 env-backed adapter 托底
- `deployment-execution` CLI 现已通过统一 secret management seam 解析 registry / deploy secret，而不是直接旁路读取环境变量
- provider credential pool / `MiniMaxChatService` 现已支持保留 managed `secret_ref`，在运行时通过 `SecretManagementService.issueSecretLease(...)` 签发并在请求完成后回收 lease，而不是在启动时长期保留明文 API key

## 8. 轮换要求

- 支持计划性轮换和紧急轮换。
- 轮换失败应触发告警。
- break-glass secret 必须双人知晓或双审批触发。

## 9. 禁止项

- 把生产密钥硬编码进 prompt、yaml、fixture
- worker 持久化长期密钥副本
- 在 CLI 输出或 debug snapshot 中直接暴露 secret
- 在 release bundle、deployment report 或 workflow artifact 中写入明文 registry/deploy secret

## 10. 收口结论

工业级 secret 管理的核心不是“有地方存 key”，而是：

- 最小作用域
- 临时凭证
- 轮换
- 审计


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-50: 本文原先只定性要求“短时凭证”，根因是 secret 合同强调托管和审计，却没有把运行时注入的 TTL 硬上限写成可执行约束。修复：正文现把 secret 注入型短时凭证强制收敛到 `TTL <= 300s`，并要求审计字段显式记录 `ttl_seconds`。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
