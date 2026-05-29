# ADR-022 API 契约vs版本化Architecture

- Status：Accepted
- Decision日期：2026-04-03

## Background

平台对外暴露 REST/WebSocket API，需统一版本化策略、错误格式、分页规范和幂等性保证，避免 API 碎片化。

## Decision

### API 端点规范

| 方法 | 路径 | Description |
|------|------|------|
| POST/GET | /api/v1/tasks | 任务 CRUD |
| GET/DELETE | /api/v1/tasks/{id} | 单任务操作 |
| GET | /api/v1/harness-runs | Harness 运lines列table（canonical） |
| GET | /api/v1/node-runs | Node 运lines列table（canonical） |
| GET | /api/v1/workflow-runs | **已废弃**，onlyused for迁移兼容；canonical 模型为 harness-runs + node-runs |
| GET/POST | /api/v1/approvals | 审批manage |
| GET | /api/v1/incidents | 事件查看 |
| GET/POST | /api/v1/knowledge | 知识manage |
| GET/POST | /api/v1/packs | Pack manage |
| GET/POST | /api/v1/plugins | Plugin manage |
| GET | /api/v1/prompts | Prompt 版本manage |
| GET | /api/v1/cost-reports | 成本报table |
| GET/POST/DELETE | /api/v1/webhooks | Webhook configure |
| GET | /api/v1/admin/workers | Worker manage |
| GET/PUT | /api/v1/admin/config | configuremanage |
| GET/POST/PUT | /api/v1/admin/tenants | 租户manage |
| GET/PUT | /api/v1/admin/budgets | budgetmanage |
| GET/POST | /api/v1/admin/rollouts | 发布manage |
| WebSocket | /ws/v1/stream | 实时流 |

### ApiError 格式

```typescript
interface ApiError {
  code: string;           // 错误码
  message: string;        // 错误信息
  trace_id: string;       // 追踪 ID
  retry_after_ms?: number; // 重试Recommendation
}
```

### 幂等性保证

- supported Idempotency-Key header
- 相同 key 的repeatsrequest返回原始response

### 分页规范

- 游标分页（cursor），max 100 条/页

### Webhook 投递保证

- 重试机制：最多 50 iterations
- 连续 50 iterationsfailed自动disabled Webhook
- failed计数可重置

## Consequences

优点：

- 统一的 API 契约提升开发者体验
- 幂等性保证使重试security
- Webhook 自动disabled防止no效投递

代价：

- 路由层需实现统一错误handle和分页逻辑
- Idempotency-Key storage需要额外资源

## 交叉references用

- [ADR-006 LLM Provider 策略](./006-llm-provider-strategy.md)
- [ADR-009 部署vs运维](./009-deployment-ops.md)

## 来源章节

- `§6` API 契约vs版本化Architecture
