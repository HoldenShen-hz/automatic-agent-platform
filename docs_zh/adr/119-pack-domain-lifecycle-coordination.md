# ADR-119 Pack Domain Lifecycle Coordination

## 状态
Accepted

## 背景
Business Pack 生命周期、领域 onboarding 四阶段、pack-domain 关联，以及 `trustTier` / `sandboxTier` 约束此前分别存在于不同模块中，缺少统一权威规则，容易出现：

- domain 已进入 `gray_rollout` 或 `active`，pack 仍停留在过早阶段
- pack 已 `published` / `running`，但 domain 认证或灰度尚未完成
- domain / pack 退役后，关联关系与默认主 pack 语义不一致
- `trustTier` 与 `sandboxTier` 没有统一兼容矩阵

## 决策
- `domain_modeling` 对应 pack `development`
- `pack_development` 对应 pack `testing`
- `security_certification` 对应 pack `certified`
- `gray_rollout` 对应 pack `published` 或 `running`

- domain 不得在关联 pack 仍早于对应阶段时推进到下一 onboarding phase
- domain 完成 `gray_rollout` 并进入 `active` 前，关联主 pack 必须至少 `published`
- pack 从 `certified` 进入 `published` / `running` 前，关联 domain 必须已经完成 `security_certification`

- domain `deprecated` / `archived` 时：
  - 不再允许新增 pack 关联
  - 已关联且处于对外发布态的 pack 必须先进入 `deprecated`，再允许 domain 最终归档
- pack `deprecated` / `archived` 时：
  - 允许保留审计关联
  - 但不得继续作为 primary pack 参与新 onboarding / routing 决策

- `trustTier` 与 `sandboxTier` 采用 fail-closed 兼容矩阵：
  - `internal` 可使用 `read_only` / `workspace_write` / `scoped_external_access` / `restricted_exec`
  - `trusted` 最低要求 `workspace_write`
  - `community` 最低要求 `scoped_external_access`
  - `external` 最低要求 `restricted_exec`

## 结果
- pack lifecycle、domain onboarding、association governance 采用同一套阶段映射
- 灰度、认证、退役不再依赖隐含约定
- `trustTier` / `sandboxTier` 有了明确权威矩阵，后续注册与绑定逻辑按此 fail-closed

## 相关实现
- `src/domains/operations/domain-onboarding-service.ts`
- `src/domains/business-pack/pack-domain-association.ts`
- `src/sdk/pack-sdk/pack-lifecycle-orchestration-service.ts`
- `src/domains/business-pack/business-pack-manifest.ts`
- `src/domains/registry/domain-model.ts`
