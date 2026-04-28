# ADR-028 异常事件处理架构

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

平台运行时会产生大量事件和告警，需要统一的事件分类、严重级别、检测规则和告警路由机制。

## 决策

### E1-E6 事件分类

| 类型 | 说明 |
|------|------|
| E1 | 系统级故障 |
| E2 | 应用级异常 |
| E3 | 业务级事件 |
| E4 | 安全事件 |
| E5 | 性能事件 |
| E6 | 变更事件 |

### SEV1-SEV4 严重级别

| 级别 | 说明 | SLA 响应时间 |
|------|------|-------------|
| SEV1 | 平台不可用 | 15 分钟 |
| SEV2 | 核心功能受损 | 30 分钟 |
| SEV3 | 非核心功能异常 | 2 小时 |
| SEV4 | 轻微问题 | 24 小时 |

### DetectionRule 接口

```typescript
interface DetectionRule {
  rule_id: string;
  name: string;
  condition: string;
  severity: SEVLevel;
  action: AlertAction;
}
```

### 5 条内建检测规则

1. 心跳缺失检测
2. 超时飙升检测
3. 投影延迟检测
4. 安全违规检测
5. 全平台故障检测

### 10 个核心指标

- 通过 OTel 集成采集
- 支持 Prometheus 导出

### StructuredLog 接口

```typescript
interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  trace_id: string;
  metadata: Record<string, unknown>;
}
```

### Trace span 层级

- span 语义应按 `service -> operation -> node_run -> node_attempt` 组织，旧 `step` 术语仅允许出现在兼容投影视图中。

- OTel SDK 实现分布式追踪
- span 层级：service → operation → step

## 后果

优点：

- 统一事件分类便于分析和响应
- 分级告警确保关键问题优先处理
- StructuredLog 便于日志检索和分析

代价：

- 事件采集增加系统开销
- 需要配套的告警路由系统

## 交叉引用

- [ADR-009 部署与运维](./009-deployment-ops.md)
- [ADR-025 稳定性架构](./025-stability-architecture-seven-layers.md)

## 来源章节

- `§12` 异常事件处理架构
