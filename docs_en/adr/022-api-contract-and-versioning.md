# ADR-022 API Contract and Versioning

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The platform exposes REST/WebSocket APIs externally and requires unified versioning strategy, error format, pagination conventions, and idempotency guarantees to avoid API fragmentation.

## Decision

### API Endpoint Specification

| Method | Path | Description |
|--------|------|-------------|
| POST/GET | /api/v1/tasks | Task CRUD |
| GET/DELETE | /api/v1/tasks/{id} | Single task operations |
| GET | /api/v1/workflow-runs | Workflow run list |
| GET/POST | /api/v1/approvals | Approval management |
| GET | /api/v1/incidents | Incident viewing |
| GET/POST | /api/v1/knowledge | Knowledge management |
| GET/POST | /api/v1/packs | Pack management |
| GET/POST | /api/v1/plugins | Plugin management |
| GET | /api/v1/prompts | Prompt version management |
| GET | /api/v1/cost-reports | Cost reports |
| GET/POST/DELETE | /api/v1/webhooks | Webhook configuration |
| GET | /api/v1/admin/workers | Worker management |
| GET/PUT | /api/v1/admin/config | Configuration management |
| GET/POST/PUT | /api/v1/admin/tenants | Tenant management |
| GET/PUT | /api/v1/admin/budgets | Budget management |
| GET/POST | /api/v1/admin/rollouts | Rollout management |
| WebSocket | /ws/v1/stream | Real-time streaming |

### ApiError Format

```typescript
interface ApiError {
  code: string;           // Error code
  message: string;        // Error message
  trace_id: string;       // Trace ID
  retry_after_ms?: number; // Retry suggestion
}
```

### Idempotency Guarantee

- Support Idempotency-Key header
- Duplicate requests with same key return original response

### Pagination Specification

- Cursor-based pagination, max 100 items per page

### Webhook Delivery Guarantee

- Retry mechanism: max 50 attempts
- Auto-disable webhook after 50 consecutive failures
- Failure count can be reset

## Consequences

Positive:
- Unified API contracts improve developer experience
- Idempotency guarantee makes retries safe
- Webhook auto-disable prevents无效 delivery

Negative:
- Route layer needs unified error handling and pagination logic
- Idempotency-Key storage requires additional resources

Trade-offs:
- Standardization vs. API flexibility
- Safety vs. complexity

## Cross-References

- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)

## Source Sections

- `§6` API Contract and Versioning