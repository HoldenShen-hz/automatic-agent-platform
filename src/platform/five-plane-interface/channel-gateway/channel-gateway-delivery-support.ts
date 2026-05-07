import type { SQLInputValue } from "node:sqlite";

export interface WebhookSignatureConfig {
  secret: string;
  headerName?: string;
  timestampHeaderName?: string;
  toleranceSeconds?: number;
}

export interface DeliveryAttempt {
  attemptId: string;
  messageId: string;
  channel: string;
  targetId: string;
  attemptNumber: number;
  status: "pending" | "success" | "failed" | "retrying";
  responseStatus: number | null;
  errorMessage: string | null;
  nextRetryAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DeliveryReceipt {
  messageId: string;
  channel: string;
  targetId: string;
  status: "delivered" | "failed" | "pending_retry";
  attempts: number;
  finalStatus: "success" | "permanent_failure" | "exhausted_retries";
  firstAttemptAt: string;
  lastAttemptAt: string;
  providerMessageId: string | null;
}

export interface DeliveryFailureResolution {
  attempt: DeliveryAttempt;
  outcome: "retry_scheduled" | "dead_lettered";
}

export interface SignatureVerificationResult {
  valid: boolean;
  error: string | null;
  timestamp: string | null;
  signature: string | null;
}

export interface ReplayProtectionResult {
  valid: boolean;
  error: string | null;
  nonce: string | null;
  ageSeconds: number | null;
}

export interface DeliveryGuaranteeConfig {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
  timeoutMs: number;
  retryableStatuses: number[];
}

export interface RateLimitConfig {
  telegram?: { limit: number; windowMs: number };
  slack?: { limit: number; windowMs: number };
  webhook?: { limit: number; windowMs: number };
  default?: { limit: number; windowMs: number };
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  windowMs: number;
  retryAfterMs?: number;
}

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
  tenant_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  window_start TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, channel, window_start)
);

CREATE INDEX IF NOT EXISTS idx_gateway_rate_limits_tenant_channel_window ON gateway_rate_limits(tenant_id, channel, window_start);
`;

export const DEFAULT_DELIVERY_CONFIG: DeliveryGuaranteeConfig = {
  maxRetries: 5,
  initialBackoffMs: 1000,
  maxBackoffMs: 60000,
  backoffMultiplier: 2,
  timeoutMs: 30000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  telegram: { limit: 30, windowMs: 1000 },
  slack: { limit: 30, windowMs: 1000 },
  webhook: { limit: 100, windowMs: 1000 },
  default: { limit: 50, windowMs: 1000 },
};

export interface DeadLetterEntry {
  messageId: string;
  channel: string;
  targetId: string;
  payload: Record<string, unknown>;
  failureReason: string;
  lastErrorMessage: string | null;
  lastResponseStatus: number | null;
  attempts: number;
  firstFailedAt: string;
  movedToDeadLetterAt: string;
}

export interface PendingDelivery {
  messageId: string;
  channel: string;
  targetId: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxRetries: number;
  createdAt: string;
}

export interface RetryableDelivery {
  messageId: string;
  channel: string;
  targetId: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxRetries: number;
  nextRetryAt: string | null;
}

export interface DeliveryMessageRecord {
  attempts: number;
  maxRetries: number;
}

export function calculateBackoffForAttempt(
  config: DeliveryGuaranteeConfig,
  attemptNumber: number,
): number {
  const backoff = config.initialBackoffMs * Math.pow(config.backoffMultiplier, attemptNumber - 1);
  return Math.min(backoff, config.maxBackoffMs);
}

export function toDeliveryMessageRecord(
  row: { attempts: number; max_retries: number } | undefined,
): DeliveryMessageRecord | null {
  if (row == null) {
    return null;
  }
  return {
    attempts: Number(row.attempts),
    maxRetries: Number(row.max_retries),
  };
}

export function buildDeadLetterQuery(channel?: string, limit = 100, cursor?: string | null): { query: string; params: SQLInputValue[] } {
  let query = `SELECT * FROM gateway_dead_letters`;
  const params: SQLInputValue[] = [];
  const conditions: string[] = [];
  const normalizedLimit = limit <= 0 ? (limit < 0 ? 1 : 100) : Math.min(limit, 200);
  if (channel !== undefined) {
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
  params.push(normalizedLimit);
  return { query, params };
}

export function buildDeadLetterCountQuery(channel?: string): { query: string; params: SQLInputValue[] } {
  let query = `SELECT channel, COUNT(*) as count FROM gateway_dead_letters`;
  const params: SQLInputValue[] = [];
  if (channel !== undefined) {
    query += ` WHERE channel = ?`;
    params.push(channel);
  }
  query += ` GROUP BY channel`;
  return { query, params };
}
