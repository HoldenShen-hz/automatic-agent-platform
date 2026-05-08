# Supply Chain And Dependency Security Contract

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

本 contract 定义依赖、插件、skill、MCP 和第三方分发单元的供应链安全基线。

相关文档：

- `tool_skill_plugin_contract.md`
- `ecosystem_extension_plane_contract.md`
- `enterprise_secret_management_contract.md`
- `sandbox_and_auth_contract.md`

## 2. 目标

- 降低第三方依赖、插件和外部执行单元带来的供应链风险。
- 让安装、更新、签名、扫描、隔离等级有统一规则。
- 为工业级审计和准入提供可追溯证据。

## 3. 最小要求

- 依赖锁定
- 包来源校验
- 签名或完整性校验
- SBOM 生成
- 漏洞扫描
- 第三方插件隔离等级
- `PluginTrustStore`

## 4. 分发单元分类

| 类型 | 最低要求 |
| --- | --- |
| `first_party tool` | locked dependency + review evidence |
| `skill bundle` | source provenance + permission declaration |
| `plugin bundle` | signature / digest + capability declaration |
| `MCP server` | trust level + isolation level + domain allowlist |

## 4A. `PluginTrustStore` 最小字段

- `trust_store_id`
- `trust_roots`
- `active_signing_keys`
- `signing_key_rotation_policy`
- `revocation_list_ref`
- `security_advisory_ref`
- `quarantine_status`
- `tenant_impact_scope`

## 5. 隔离等级

- `trusted_first_party`
- `reviewed_partner`
- `untrusted_third_party`

规则：

- `untrusted_third_party` 不得默认获得 destructive 权限。
- MCP 不得伪装成本地 trusted tool。
- 插件权限不得绕过 ToolRegistry 和 Policy Engine。
- `PluginTrustStore` 必须支持 trust root 管理、签名密钥轮换、撤销列表、安全公告和隔离封禁。
- 被撤销、被公告命中或进入 quarantine 的插件/依赖不得继续新安装或在受影响 tenant 上激活。
- `tenant_impact_scope` 必须允许按 tenant / workspace / organization 定位供应链事件波及面。

## 6. 安全检查流程

```mermaid
flowchart TD
    A["Import Dependency / Plugin"] --> B["Verify Source / Digest / Signature"]
    B --> C["Generate SBOM / Scan Vulnerabilities"]
    C --> D{"Risk Accepted?"}
    D -- "No" --> E["Reject Install"]
    D -- "Yes" --> F["Assign Isolation Level"]
```

## 7. 审计要求

必须记录：

- install source
- version / digest
- approver
- granted capability scope
- scan result summary
- disable / revoke action
- trust root / signing key version
- revocation / advisory / quarantine decision
- tenant impact summary

## 8. 收口结论

工业级扩展生态不能只问“能不能装上去”。

它必须同时回答：

- 来源是否可信
- 权限是否最小
- 更新是否可追踪
- 出问题时能否快速禁用和追责


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-49: 本文原先只覆盖“导入时扫描”和粗粒度 trust level，根因是供应链合同停留在安装前校验视角，没有把插件信任根、签名密钥轮换、撤销/公告和租户影响面做成持续治理对象。修复：正文现新增 `PluginTrustStore`，并把 trust root、signing key rotation、revocation list、security advisory、quarantine、tenant impact 写成必备能力。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
