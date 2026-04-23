export const CHANNEL_DELIVERY_DDL = `
CREATE TABLE IF NOT EXISTS delivery_messages (
  message_id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  target_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS delivery_attempts (
  attempt_id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  response_status INTEGER,
  error_message TEXT,
  provider_message_id TEXT,
  next_retry_at TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (message_id) REFERENCES delivery_messages(message_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_messages_status ON delivery_messages(status);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_message ON delivery_attempts(message_id);

CREATE TABLE IF NOT EXISTS replay_nonces (
  nonce TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gateway_dead_letters (
  message_id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  target_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  failure_reason TEXT NOT NULL,
  last_error_message TEXT,
  last_response_status INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_failed_at TEXT NOT NULL,
  moved_to_dead_letter_at TEXT NOT NULL,
  original_request_url TEXT,
  provider_message_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_gateway_dead_letters_channel ON gateway_dead_letters(channel);
CREATE INDEX IF NOT EXISTS idx_gateway_dead_letters_first_failed ON gateway_dead_letters(first_failed_at);

CREATE TABLE IF NOT EXISTS gateway_rate_limits (
  channel TEXT NOT NULL,
  window_start TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (channel, window_start)
);

CREATE INDEX IF NOT EXISTS idx_gateway_rate_limits_channel_window ON gateway_rate_limits(channel, window_start);
`;
export const DEFAULT_DELIVERY_CONFIG = {
    maxRetries: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 60000,
    backoffMultiplier: 2,
    timeoutMs: 30000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
};
export const DEFAULT_RATE_LIMIT_CONFIG = {
    telegram: { limit: 30, windowMs: 1000 },
    slack: { limit: 30, windowMs: 1000 },
    webhook: { limit: 100, windowMs: 1000 },
    default: { limit: 50, windowMs: 1000 },
};
export function calculateBackoffForAttempt(config, attemptNumber) {
    const backoff = config.initialBackoffMs * Math.pow(config.backoffMultiplier, attemptNumber - 1);
    return Math.min(backoff, config.maxBackoffMs);
}
export function toDeliveryMessageRecord(row) {
    if (row == null) {
        return null;
    }
    return {
        attempts: Number(row.attempts),
        maxRetries: Number(row.max_retries),
    };
}
export function buildDeadLetterQuery(channel, limit = 100, cursor) {
    let query = `SELECT * FROM gateway_dead_letters`;
    const params = [];
    const conditions = [];
    if (channel) {
        conditions.push(`channel = ?`);
        params.push(channel);
    }
    if (cursor !== undefined && cursor !== null) {
        conditions.push(`moved_to_dead_letter_at < ?`);
        params.push(cursor);
    }
    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ` ORDER BY moved_to_dead_letter_at DESC LIMIT ?`;
    params.push(limit);
    return { query, params };
}
export function buildDeadLetterCountQuery(channel) {
    let query = `SELECT channel, COUNT(*) as count FROM gateway_dead_letters`;
    const params = [];
    if (channel) {
        query += ` WHERE channel = ?`;
        params.push(channel);
    }
    query += ` GROUP BY channel`;
    return { query, params };
}
//# sourceMappingURL=channel-gateway-delivery-support.js.map