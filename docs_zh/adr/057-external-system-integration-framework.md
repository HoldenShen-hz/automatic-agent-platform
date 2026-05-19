# ADR-057 外部系统集成框架

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

平台需要与外部系统（CRM、ERP、项目管理工具等）集成，需要统一的集成框架。

## 决策

### 集成模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| webhook | 事件推送 | 实时性要求高 |
| polling | 轮询拉取 | 外部系统无 webhook |
| api_proxy | API 代理 | 需要认证和转换 |
| file_transfer | 文件传输 | 批量数据交换 |

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

### 认证类型

| 类型 | 说明 |
|------|------|
| api_key | API Key |
| oauth2 | OAuth 2.0 |
| basic_auth | 用户名密码 |
| jwt | JWT Token |

### 错误处理

| 策略 | 说明 |
|------|------|
| retry | 重试 |
| circuit_break | 熔断 |
| fallback | 降级 |
| dead_letter | 死信队列 |

### 集成治理

- 连接器注册与发现
- 认证凭证管理
- 流量控制
- 审计日志
- 所有外部副作用必须声明 `side_effect_policy`
- 高风险写入必须生成 `SideEffectRecord`
- 会改变运行时真相的补偿/重试，必须通过 `RuntimeStateMachine` 与 X1 Reliability 边界协调

## 后果

优点：

- 统一框架降低集成成本
- 标准化处理错误
- 治理能力保障安全

代价：

- 适配器开发需要时间
- 维护多个集成增加复杂度

## 交叉引用

- [ADR-027 安全可靠架构](./027-security-architecture.md)
- [ADR-021 平面间通信契约](./021-inter-plane-communication-contract.md)

## 来源章节

- `§57` 外部系统集成框架
