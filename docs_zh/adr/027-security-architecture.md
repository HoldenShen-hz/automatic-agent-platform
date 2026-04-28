# ADR-027 安全可靠架构

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

企业级 Agent 平台处理敏感数据和关键业务流程，必须具备完善的安全机制：身份认证、授权、密钥管理、数据分类和沙箱隔离。

## 决策

### 6 种 Principal 类型

```typescript
type Principal =
  | { type: 'user'; user_id: string }
  | { type: 'service'; service_id: string }
  | { type: 'agent'; agent_id: string }
  | { type: 'worker'; worker_id: string }
  | { type: 'plugin'; plugin_id: string }
  | { type: 'system' };
```

### 3 层授权模型

1. RBAC（角色基础访问控制）
2. Capability（能力列表）
3. 上下文策略（基于环境、时间、风险等因素）

### Secret 管理

- Secret TTL ≤ 300s
- SecretManagementService (Vault/KMS) 集中管理
- 密钥轮换 90 天

### 4 层沙箱

| 层级 | 模式 | 说明 |
|------|------|------|
| L1 | read_only | 只读文件系统，无写权限 |
| L2 | workspace_write | 仅允许写入受控 workspace |
| L3 | scoped_external_access | 允许受控外部访问，仍受作用域约束 |
| L4 | restricted_exec | 最严格执行模式，显式限制命令能力 |

规则：

- 不存在 `SANDBOX_NONE` 这类 default-allow 模式；平台默认 deny。
- 沙箱层级按“可写性 / 外部访问 / 执行能力”治理，不按抽象“隔离强度”自定义命名。

### 数据分类

| 级别 | 说明 |
|------|------|
| public | 公开数据 |
| internal | 内部数据 |
| confidential | 机密数据 |
| restricted | 严格限制 |

### 加密要求

- TLS 1.3 传输加密
- PII 字段 AES-256 加密
- Vault/KMS 密钥存储

## 后果

优点：

- 多层安全防护覆盖主要攻击面
- 密钥短期化降低泄露风险
- 沙箱隔离保护宿主系统

代价：

- 安全检查增加性能开销
- 密钥管理增加运维复杂度

## 交叉引用

- [ADR-005 安全模型](./005-security-model.md)
- [ADR-026 风险控制架构](./026-risk-control-architecture.md)

## 来源章节

- `§11` 安全可靠架构

## v4.3 ADR Remediation

- A-16: 本 ADR 原先把 `pack / tenant` 当作 principal 类型，根因是安全建模把资源归属对象和主动调用主体混成了一套 identity taxonomy。修复：正文现把 canonical principal 收敛到 `user / service / agent / worker / plugin / system`。
- A-17: 本 ADR 原先使用 `SANDBOX_NONE / SANDBOX_READonly / SANDBOX_NETWORK_ISOLATED / SANDBOX_FULL`，根因是早期沙箱模型按抽象强度命名，没有随主架构切换到 default-deny 的能力矩阵。修复：正文现改为 `read_only / workspace_write / scoped_external_access / restricted_exec`，并移除 `SANDBOX_NONE`。
