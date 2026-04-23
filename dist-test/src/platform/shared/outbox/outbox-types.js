/**
 * Outbox Pattern Types
 *
 * Provides type definitions for the transactional outbox pattern implementation.
 * The outbox pattern ensures reliable event delivery by writing events to an
 * outbox table within the same transaction as business data, then asynchronously
 * publishing to the event bus.
 */
export var OutboxStatus;
(function (OutboxStatus) {
    OutboxStatus["PENDING"] = "pending";
    OutboxStatus["PUBLISHED"] = "published";
    OutboxStatus["FAILED"] = "failed";
})(OutboxStatus || (OutboxStatus = {}));
//# sourceMappingURL=outbox-types.js.map