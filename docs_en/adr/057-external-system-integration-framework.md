# ADR-057 外部系统集成框架

- Status：Accepted
- Decision日期：2026-04-20

## Background

平台需要vs外部系统（CRM、ERP、项目manage工具等）集成，需要统一的集成框架。

## Decision

### 集成模式

| 模式 | Description | 适用场景 |
|------|------|----------|
| webhook | 事件推送 | 实时性要求高 |
| polling | 轮询拉取 | 外部系统no webhook |
| api_proxy | API 代理 | 需要authentication和转换 |
| file_transfer | 文件传输 | 批量data交换 |

### Adapter 框架

```typescript
interface ExternalAdapter {
  adapter_id: string;
  system_type: string;
  auth_config: AuthConfig;
  endpoints: Endpoint[];
  transform_rules: TransformRule[];
  error_handling: ErrorStrategy;
}
```

### authenticationclass型

| class型 | Description |
|------|------|
| api_key | API Key |
| oauth2 | OAuth 2.0 |
| basic_auth | user名密码 |
| jwt | JWT Token |

### 错误handle

| 策略 | Description |
|------|------|
| retry | 重试 |
| circuit_break | 熔断 |
| fallback | 降级 |
| dead_letter | 死信队列 |

### 集成治理

- connect器注册vs发现
- authentication凭证manage
- 流量控制
- 审计日志
- 所有外部副作用必须声明 `side_effect_policy`
- 高风险writes必须生成 `SideEffectRecord`
- 会改变运lines时真相的补偿/重试，必须via `RuntimeStateMachine` vs X1 Reliability 边界协调

## Consequences

优点：

- 统一框架降低集成成本
- 标准化handle错误
- 治理能力保障security

代价：

- 适配器开发需要time
- 维护多个集成增加复杂度

## 交叉references用

- [ADR-027 security可靠Architecture](./027-security-architecture.md)
- [ADR-021 平面间communication契约](./021-inter-plane-communication-contract.md)

## 来源章节

- `§57` 外部系统集成框架
