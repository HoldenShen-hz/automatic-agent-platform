/**
 * E2E Webhook Outbox Dispatch Tests
 *
 * End-to-end tests covering webhook outbox dispatch:
 * - Webhook ingress receives events and stages to outbox
 * - De-duplication works correctly for repeated events
 * - Outbox entries can be listed and dispatched
 * - Failed dispatches can be retried
 */
export {};
