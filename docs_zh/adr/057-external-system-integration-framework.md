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
  side_effect_policy: SideEffectPolicy; // 必须关联 SideEffectRecord，见 §14.5
}
```

所有外部系统调用必须通过 SideEffectRecord（§14.5 / §25）记录外部副作用生命周期。Adapter 的 `side_effect_policy` 声明 `proposed→confirmed` 状态机转换条件，由 RuntimeStateMachine 统一推进，不得由 Adapter 自行提交。

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
| retry | 重试（应由 X1 Reliability Fabric library/middleware 统一提供，Adapter 不应本地重实现） |
| circuit_break | 熔断（应由 X1 Reliability Fabric library/middleware 统一提供，见 §4.7 X1 Reliability & Security Fabric） |
| fallback | 降级 |
| dead_letter | 死信队列 |

注：retry 与 circuit_break 为平台级横切关注点，§4.7 X1 Reliability Fabric 要求作为 library interceptor 落地，不得在各 Adapter 内本地重实现。Adapter 只需声明 `retryable: boolean` 和 `circuit_breaker_config`，实际策略由 X1 中间件执行。

### 集成治理

- 连接器注册与发现
- 认证凭证管理
- 流量控制
- 审计日志

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
- [§4.7 X1 Reliability & Security Fabric](../architecture/00-platform-architecture.md#47-x1-reliability--security-fabric)（retry/circuit_break 中间件/库级要求）
- [§14.5 NodeRun SideEffectRecord](../architecture/00-platform-architecture.md#1410-noderun-state-machine)（外部副作用生命周期管理）
- [ADR-101 域风险画像](./101-domain-risk-override-platform-default.md)（SideEffect compensation policy 绑定）

## 来源章节

- `§57` 外部系统集成框架
