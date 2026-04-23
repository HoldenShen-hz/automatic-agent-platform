/**
 * Outbox Pattern Module
 *
 * Implements the transactional outbox pattern for reliable event delivery.
 * This module provides:
 * - OutboxRepository: Data access for outbox table
 * - OutboxService: Coordination service for writing and publishing
 * - OutboxPollerService: Asynchronous polling and publishing service
 *
 * @see {@link https://docs.microsoft.com/en-us/previous-versions/dn589781(v=msdn.10)|Transactional Outbox Pattern}
 */
export { OUTBOX_TABLE_DDL, OUTBOX_TABLE_CLEANUP_DDL } from "./outbox-table.js";
export { OutboxStatus, } from "./outbox-types.js";
export { OutboxRepository } from "./outbox-repository.js";
export { OutboxService, } from "./outbox-service.js";
export { OutboxPollerService, } from "./outbox-poller-service.js";
//# sourceMappingURL=index.js.map