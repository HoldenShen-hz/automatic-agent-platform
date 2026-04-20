# License And Capability Boundary Contract

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

本 contract 定义社区版、专业版、企业版等未来产品形态下的能力边界工程化方式。

相关文档：

- `billing_and_tenant_contract.md`
- `monetization_metering_plane_contract.md`
- `tenant_and_organization_contract.md`
- `feature` flags in `environment_and_configuration_governance_contract.md`

## 2. 目标

- 提前把功能、配额、并发、审计、多租户能力做成可控开关。
- 避免商业化后再硬切代码路径。
- 让 entitlement 判断进入正式 policy / metering 闭环。

## 3. 能力边界

未来至少可按以下维度开关：

- feature gate
- quota gate
- concurrency gate
- audit gate
- multitenancy gate
- remote worker gate
- enterprise security gate

## 4. 核心对象

- `LicenseTier`
- `CapabilityBundle`
- `EntitlementDecision`
- `QuotaProfile`
- `CommercialFeatureFlag`

## 5. 规则

- 所有商业化能力都应通过 capability check，而不是散落在 UI 或路由里。
- capability check 结果必须可审计。
- 试用、降级、欠费、冻结都必须有明确系统行为。
- 产品分层不得破坏同一套 contract 真相。
- capability check 不得只在前端或网关层生效；runtime、API、admin console 也必须复用同一判断结果。
- 欠费、冻结、降级不应静默放宽现有隔离与审计边界。

## 6. 典型层级

| 层级 | 典型能力 |
| --- | --- |
| `community` | 单租户、本地能力、基础工具 |
| `professional` | 更多并发、更多配额、基础审计 |
| `enterprise` | 多租户、SSO、审计导出、私有模型、私网部署 |

## 7. 收口结论

商业化能力边界必须尽早工程化。

否则后续会出现：

- 代码分叉
- 权限漂移
- 配额规则散落
- 企业能力难以安全上线
