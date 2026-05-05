# Environment And Configuration Governance Contract

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

本 contract 定义环境分层、配置中心治理、发布前门禁和配置变更控制。

相关文档：

- `configuration_layers_and_defaults_contract.md`
- `environment_readiness_registry_contract.md`
- `release_rollout_and_rollback_contract.md`
- `prompt_model_policy_governance_contract.md`
- `enterprise_secret_management_contract.md`

## 2. 目标

- 明确 dev、test、staging、pre-prod、prod 的能力边界。
- 让配置具备版本、审批、diff、回滚和广播能力。
- 让发布门禁在环境维度可执行，而不是人工凭经验判断。
- 让外部环境 readiness 成为可查询 registry，而不是口头状态。

## 3. 环境分层

| 环境 | 主要用途 | 允许能力 |
| --- | --- | --- |
| `dev` | 本地开发 | mock provider、调试开关、宽松 lint |
| `test` | 自动化测试 | fixture / VCR、故障注入 |
| `staging` | 集成验证 | 近生产配置、灰度校验 |
| `pre-prod` | 发布前演练 | 生产模型清单、迁移和回滚验证 |
| `prod` | 正式服务 | 最小权限、正式审计、严格审批 |

## 4. 配置中心对象

- `ConfigBundle`
- `ConfigVersion`
- `ConfigApproval`
- `ConfigDiff`
- `ConfigRollbackTicket`
- `ConfigBroadcastEvent`

## 5. 配置治理规则

- 每次配置变更必须生成版本号。
- 生产配置变更必须有审批记录。
- 配置变更必须可 diff、可回滚。
- 热更新后必须广播给受影响组件。
- feature flag、policy、prompt bundle 的生效范围必须可见。
- runtime image / sandbox image / bundled extension tree 也应进入版本与变更治理，不应游离于配置治理之外。
- config schema 应优先由 authoritative types / protocol schema 生成，而不是长期手写维护。
- 对配置读写、校验、警告和 schema 生成，最好共用同一事实源，避免“文档写法”和“运行时解析”分叉。
- secret 读取接口默认只返回 masked value 或等价脱敏视图，不得把原文 secret 暴露给普通配置查询面。
- custom provider profile、模型清单、权限清单这类高风险配置对象，应优先有正式 API/registry，而不是散落在命令行或私有 YAML 里。
- provider/model 的默认上下文上限、request params、canonical limits 等元数据应通过 registry 统一治理，而不是在多个入口各自推断。
- 若支持同 provider 多 credential 轮换，应把 pool strategy、cooldown TTL、reset hints、manual pinning 和 disabled 状态纳入正式 config / registry，而不是散落在 provider adapter 内部状态里。
- 每个 layer 至少应支持 `default.json + <environment>.json` 的确定性 overlay 合成，避免“有环境名但无环境差异”。
- 多环境部署必须有 machine-readable deployment matrix，至少汇总 config version、readiness、deployment binding、promotion prerequisite 和 target release bundle。
- release / deployment config 至少应声明 `config_bundle_ref`、`registry_credential_ref`、`deployment_credential_ref` 三类引用，运行时和 CLI 只传播 ref，不传播 secret 原文。

## 6. 发布前门禁

至少自动检查：

- migration compatibility
- config schema validity
- workflow lint pass
- prompt lint pass
- eval threshold pass
- risk flag state healthy
- environment readiness registry pass
- runtime image provenance / digest pinning pass

## 6.1 运行镜像治理

工业级环境至少应支持：

- 多阶段构建，避免把 build toolchain 直接带入 runtime image
- 基础镜像 digest pinning 或等价可复现约束
- 按 capability 选择 runtime variant，例如最小 runtime、browser runtime、sandbox runtime
- 可选重依赖能力按需安装，而不是默认把所有依赖打进同一镜像

## 7. 优先级链

配置覆盖顺序：

1. secret / secure override
2. environment bundle
3. system config
4. division config
5. role config
6. runtime override

## 7A. 动态配置约束覆盖

- 配置覆盖不能是无限制的“最后写入生效”，必须显式声明可覆盖范围。
- 至少区分：`global`、`environment`、`tenant/workspace`、`release/cohort`、`break-glass` 五类约束层。
- 高风险对象如 provider profile、prompt bundle、policy rule、feature flag，不允许被低信任来源静默覆盖。
- 所有 override 必须产生日志与审计证据，并可在 readiness / doctor 视图中查询。
- unknown override source、非法约束组合或冲突链必须 fail-close。

## 7.1 SDK / Runtime 兼容治理

- 嵌入式 SDK 若依赖特定 CLI / app-server runtime，应显式 pin 或声明兼容窗口。
- protocol version、runtime version、schema artifact version 应可同时查询。
- 不得让 SDK、CLI、server 三者各自静默漂移后再在运行时偶然失败。

## 7.2 多环境部署矩阵

- `dev -> test -> staging -> pre-prod -> prod` 必须有明确 promotion 顺序。
- `staging / pre-prod / prod` 默认要求 environment readiness 与 deployment binding 同时满足，缺任一项都应 fail-close。
- `staging / pre-prod / prod` 默认还要求 secret/config injection plan 完整，缺 `config_bundle_ref`、`registry_credential_ref` 或 `deployment_credential_ref` 任一项都应 fail-close。
- 目标环境发布前，应显式校验前序环境 promotion prerequisite，而不是直接跳级部署。

## 8. 收口结论

工业级配置治理不是“能热重载就行”。

它必须具备：

- 环境隔离
- 版本控制
- 审批和 diff
- 回滚
- 生效广播
- readiness registry
