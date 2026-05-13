# ADR-022 API Contract and Versioning Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The platform exposes REST/WebSocket APIs externally and needs unified versioning strategy, error format, pagination specifications, and idempotency guarantees to avoid API fragmentation.

## Decision

### API Endpoint Specifications

| Method | Path | Description |
|--------|------|-------------|
| POST/GET | /api/v1/tasks | Task CRUD |
| GET/DELETE | /api/v1/tasks/{id} | Single task operations |
| GET | /api/v1/harness-runs | Harness run list (canonical) |
| GET | /api/v1/node-runs | Node run list (canonical) |
| GET | /api/v1/workflow-runs | **Deprecated**, only for migration compatibility; canonical model is harness-runs + node-runs |
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
| GET/POST | /api/v1/admin/rollouts | Release management |
| WebSocket | /ws/v1/stream | Real-time streaming |

### ApiError Format

```typescript
interface ApiError {
  code: string;           // Error code
  message: string;        // Error message
  trace_id: string;       // Tracing ID
  retry_after_ms?: number; // Retry suggestion
}
```

### Idempotency Guarantee

- Supports Idempotency-Key header
- Duplicate requests with the same key return the original response

### Pagination Specification

- Cursor pagination, max 100 items/page

### Webhook Delivery Guarantee

- Retry mechanism: up to 50 times
- Automatically disable webhook after 50 consecutive failures
- Failure count can be reset

## Consequences

Benefits:

- Unified API contract improves developer experience
- Idempotency guarantee makes retries safe
- Automatic webhook disable prevents invalid deliveries

Trade-offs:

- Routing layer needs unified error handling and pagination logic
- Idempotency-Key storage requires additional resources

## Cross-references

- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)

## Source Section

- `§6` API Contract and Versioning Architecture
