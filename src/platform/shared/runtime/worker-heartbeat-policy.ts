/**
 * Local worker liveness threshold for dispatch and handshake paths.
 *
 * This is intentionally a fast in-process health signal and is not the same
 * thing as a cross-region failover RTO target.
 */
export const DEFAULT_WORKER_HEARTBEAT_STALENESS_MS = 30_000;
