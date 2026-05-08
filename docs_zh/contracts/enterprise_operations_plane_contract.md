# Enterprise Operations Plane Contract

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

本 contract 定义最终平台的企业运维平面，包括环境注册、升级、回滚、SLA、支持和事件响应。

它用于回答“平台如何在企业环境中被交付、升级、审计和值守”。

## 2. 目标

- 让环境、版本、升级和运维动作进入正式 control plane。
- 让 enterprise 能力具备可审计、可恢复和可支持的交付模式。
- 把运维从 checklist 提升为平台层。

## 3. 关键组件

- `EnvironmentRegistry`
- `UpgradeOrchestrator`
- `RollbackController`
- `IncidentConsole`
- `SlaGovernanceService`

## 4. 关键对象

- `EnvironmentRecord`
- `ReleaseBundle`
- `UpgradePlan`
- `RollbackReceipt`
- `IncidentRecord`

## 5. EnvironmentRecord 最小字段

- `environment_id`
- `tenant_id?`
- `deployment_mode`
- `region`
- `version`
- `health_status`
- `managed_by`

## 6. 行为约束

- 所有升级和回滚都必须生成 receipt。
- enterprise 环境必须有明确 topology、版本和 owner 信息。
- support / incident 入口必须能关联 task、execution、release 和 policy 证据。
- SLA 判断不得依赖人工口径，必须有统一健康和事件定义。
- environment registry、release bundle、upgrade plan 与 rollback receipt 必须可相互追溯，不能只保留最后状态。
- private cloud / on-prem 环境若缺少某些托管能力，必须显式声明降级矩阵，而不是隐式少功能。

## 7. 与现有文档的关系

- `doc/operations/operations-checklist.md` 和阶段文档定义当前基线。
- 本 contract 定义最终 enterprise ops 作为平台层的目标形态。
- `tenant_and_organization_contract.md` 提供环境归属边界。

## 8. 分阶段引入

- Phase 4: environment registry、upgrade control、SLA governance。

## 9. 补充规则

- support routing 至少区分：产品问题、平台事故、安全事件、账务问题。
- on-call policy 至少包含：主值班、备值班、升级路径、交接要求。
- private cloud / on-prem 部署必须明确哪些能力可用、哪些依赖云服务降级。
- 任何升级失败进入回滚时，必须能给出环境级影响范围和 tenant 级影响清单。
