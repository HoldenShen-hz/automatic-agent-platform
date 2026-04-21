# ADR-022 API 契约与版本化架构

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

平台对外暴露 REST/WebSocket API，需统一版本化策略、错误格式、分页规范和幂等性保证，避免 API 碎片化。

## 决策

### API 端点规范

| 方法 | 路径 | 说明 |
|------|------|------|
| POST/GET | /api/v1/tasks | 任务 CRUD |
| GET/DELETE | /api/v1/tasks/{id} | 单任务操作 |
| GET | /api/v1/workflow-runs | 工作流运行列表 |
| GET/POST | /api/v1/approvals | 审批管理 |
| GET | /api/v1/incidents | 事件查看 |
| GET/POST | /api/v1/knowledge | 知识管理 |
| GET/POST | /api/v1/packs | Pack 管理 |
| GET/POST | /api/v1/plugins | Plugin 管理 |
| GET | /api/v1/prompts | Prompt 版本管理 |
| GET | /api/v1/cost-reports | 成本报表 |
| GET/POST/DELETE | /api/v1/webhooks | Webhook 配置 |
| GET | /api/v1/admin/workers | Worker 管理 |
| GET/PUT | /api/v1/admin/config | 配置管理 |
| GET/POST/PUT | /api/v1/admin/tenants | 租户管理 |
| GET/PUT | /api/v1/admin/budgets | 预算管理 |
| GET/POST | /api/v1/admin/rollouts | 发布管理 |
| WebSocket | /ws/v1/stream | 实时流 |

### ApiError 格式

```typescript
interface ApiError {
  code: string;           // 错误码
  message: string;        // 错误信息
  trace_id: string;       // 追踪 ID
  retry_after_ms?: number; // 重试建议
}
```

### 幂等性保证

- 支持 Idempotency-Key header
- 相同 key 的重复请求返回原始响应

### 分页规范

- 游标分页（cursor），max 100 条/页

### Webhook 投递保证

- 重试机制：最多 50 次
- 连续 50 次失败自动禁用 Webhook
- 失败计数可重置

## 后果

优点：

- 统一的 API 契约提升开发者体验
- 幂等性保证使重试安全
- Webhook 自动禁用防止无效投递

代价：

- 路由层需实现统一错误处理和分页逻辑
- Idempotency-Key 存储需要额外资源

## 交叉引用

- [ADR-006 LLM Provider 策略](./006-llm-provider-strategy.md)
- [ADR-009 部署与运维](./009-deployment-ops.md)

## 来源章节

- `§6` API 契约与版本化架构
