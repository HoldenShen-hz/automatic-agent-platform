# Environment And Configuration Governance Contract

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

本 contract defines环境分层、configure中心治理、发布前门禁和configure变更控制。

相关文档：

- `configuration_layers_and_defaults_contract.md`
- `environment_readiness_registry_contract.md`
- `release_rollout_and_rollback_contract.md`
- `prompt_model_policy_governance_contract.md`
- `enterprise_secret_management_contract.md`

## 2. 目标

- 明确 dev、test、staging、pre-prod、prod 的能力边界。
- 让configure具备版本、审批、diff、回滚和广播能力。
- 让发布门禁在环境维度可执lines，而不is人工凭via验判断。
- 让外部环境 readiness 成为可查询 registry，而不is口头Status。

## 3. 环境分层

| 环境 | 主要用途 | 允许能力 |
|---|-------|--------|
| `dev` | 本地开发 | mock provider、调试开关、宽松 lint |
| `test` | 自动化测试 | fixture / VCR、故障注入 |
| `staging` | 集成验证 | 近生产configure、灰度校验 |
| `pre-prod` | 发布前演练 | 生产模型清单、迁移和回滚验证 |
| `prod` | 正式服务 | 最小permission、正式审计、严格审批 |

## 4. configure中心对象

- `ConfigBundle`
- `ConfigVersion`
- `ConfigApproval`
- `ConfigDiff`
- `ConfigRollbackTicket`
- `ConfigBroadcastEvent`

## 5. configure治理规则

- 每iterationsconfigure变更必须生成版本号。
- 生产configure变更必须有审批record。
- configure变更必须可 diff、可回滚。
- 热更新后必须广播给受Impact组件。
- feature flag、policy、prompt bundle 的生效范围必须可见。
- runtime image / sandbox image / bundled extension tree 也应进入版本vs变更治理，不应游离于configure治理之外。
- config schema 应优先由 authoritative types / protocol schema 生成，而不is长期手写维护。
- 对configure读写、校验、警告和 schema 生成，最好共用同一事实源，避免“文档写法”和“运lines时解析”分叉。
- secret 读取接口defaults to只返回 masked value 或等价脱敏视图，不得把原文 secret 暴露给普通configure查询面。
- custom provider profile、模型清单、permission清单这class高风险configure对象，应优先有正式 API/registry，而不is散落在命令lines或私有 YAML 里。
- provider/model 的defaults to上下文upper limit、request params、canonical limits 等元data应via registry 统一治理，而不is在多个入口each推断。
- 若supported同 provider 多 credential 轮换，应把 pool strategy、cooldown TTL、reset hints、manual pinning 和 disabled Status纳入正式 config / registry，而不is散落在 provider adapter 内部Status里。
- 每个 layer 至少应supported `default.json + <environment>.json` 的确定性 overlay 合成，避免“有环境名但no环境差异”。
- 多环境部署必须有 machine-readable deployment matrix，至少汇总 config version、readiness、deployment binding、promotion prerequisite 和 target release bundle。
- release / deployment config 至少应声明 `config_bundle_ref`、`registry_credential_ref`、`deployment_credential_ref` 三classreferences用，运lines时和 CLI 只传播 ref，不传播 secret 原文。

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

## 6.1 运lines镜像治理

工业级环境至少应supported：

- 多阶段构建，避免把 build toolchain directly带入 runtime image
- 基础镜像 digest pinning 或等价可复现约束
- 按 capability 选择 runtime variant，例如最小 runtime、browser runtime、sandbox runtime
- optional重relies on能力按需安装，而不isdefaults to把所有relies on打进同一镜像

## 7. 优先级链

configure覆盖顺序：

1. secret / secure override
2. environment bundle
3. system config
4. division config
5. role config
6. runtime override

## 7A. dynamicallyconfigure约束覆盖

- configure覆盖不能isno限制的“最后writes生效”，必须显式声明可覆盖范围。
- 至少区分：`global`、`environment`、`tenant/workspace`、`rollout/cohort`、`break-glass` 五class约束层。
- 高风险对象如 provider profile、prompt bundle、policy rule、feature flag，不允许被低信任来源静默覆盖。
- 所有 override 必须产生日志vs审计证据，并可在 readiness / doctor 视图中查询。
- unknown override source、非法约束组合或conflicts链必须 fail-close。

## 7.1 SDK / Runtime 兼容治理

- 嵌入式 SDK 若relies on特定 CLI / app-server runtime，应显式 pin 或声明兼容窗口。
- protocol version、runtime version、schema artifact version 应可同时查询。
- 不得让 SDK、CLI、server 三者each静默漂移后再在运lines时偶然failed。

## 7.2 多环境部署矩阵

- `dev -> test -> staging -> pre-prod -> prod` 必须有明确 promotion 顺序。
- `staging / pre-prod / prod` defaults to要求 environment readiness vs deployment binding 同时满足，缺任一项都应 fail-close。
- `staging / pre-prod / prod` defaults to还要求 secret/config injection plan 完整，缺 `config_bundle_ref`、`registry_credential_ref` 或 `deployment_credential_ref` 任一项都应 fail-close。
- 目标环境发布前，应显式校验前序环境 promotion prerequisite，而不isdirectly跳级部署。

## 8. 收口Conclusion

工业级configure治理不is“能热重载就lines”。

它必须具备：

- 环境隔离
- 版本控制
- 审批和 diff
- 回滚
- 生效广播
- readiness registry
