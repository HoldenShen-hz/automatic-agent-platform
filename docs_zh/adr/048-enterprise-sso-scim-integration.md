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

### 用户生命周期（Saga 模式）

所有用户生命周期操作采用 prepare/commit/compensate 语义，并记录审计日志：

| 阶段 | 入职 | 转岗 | 离职 |
|------|------|------|------|
| prepare | 验证 IdP 凭证、预分配账号、检查配额 | 获取当前权限、生成变更清单 | 备份数据、生成权限回收清单 |
| commit | 创建账号、加入默认组、发送欢迎通知 | 更新组织信息、同步权限变更 | 禁用账号、回收权限、导出数据 |
| compensate | 回滚账号创建、发送异常通知 | 回滚组织信息、回滚权限变更 | 恢复账号、解冻权限（紧急情况下） |

审计日志记录：操作类型、操作者、时间戳、变更前后状态、补偿动作执行结果。

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
