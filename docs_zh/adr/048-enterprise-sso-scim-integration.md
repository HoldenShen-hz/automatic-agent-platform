# ADR-048 企业 SSO/SCIM 集成架构

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

企业需要与现有身份提供商（IdP）集成，实现单点登录和自动化用户生命周期管理。

## 决策

### SSO 支持

| 协议 | 说明 |
|------|------|
| SAML 2.0 | 企业 IdP 常用 |
| OIDC | 现代应用推荐 |
| OAuth 2.0 | 第三方授权 |

### SCIM 支持

```typescript
interface SCIMUser {
  user_id: string;
  emails: string[];
  name: Name;
  active: boolean;
  groups: string[];
}

interface SCIMGroup {
  group_id: string;
  name: string;
  members: string[];
}
```

### 用户生命周期（§2.4 Saga 语义）

SCIM 用户生命周期管理遵循四段 Saga 语义：

| 阶段 | 入职 | 转岗 | 离职 |
|------|------|------|------|
| prepare | 验证 IdP 用户属性完整，准备账号模板 | 收集转岗目标组织信息，准备权限变更清单 | 冻结账号，生成权限回收清单 |
| commit | 创建账号，分配初始角色和默认组 | 更新组织信息，应用新权限配置 | 禁用账号，回收全部权限 |
| compensate | 若创建失败则清理已分配资源 | 若更新失败则回滚至原组织信息 | 若禁用失败则重新尝试并记录补偿 |
| audit | 记录账号创建事件，发送欢迎通知 | 记录转岗变更，通知旧/新主管 | 记录离职处理，触发安全审计 |

注：Saga 确保所有用户生命周期操作具备幂等性和补偿能力，防止中间状态导致权限不一致。

### 同步策略

- 实时同步：SCIM webhook
- 定期同步：增量同步 job
- 按需同步：手动触发

## 后果

优点：

- SSO 提高用户体验和安全性
- SCIM 自动化用户管理
- 减少手动操作

代价：

- IdP 集成复杂性
- 同步延迟可能造成权限问题

## 交叉引用

- [ADR-046 组织层次模型](./046-organization-hierarchy-model.md)
- [ADR-027 安全可靠架构](./027-security-architecture.md)

## 来源章节

- `§48` 企业 SSO/SCIM 集成架构
