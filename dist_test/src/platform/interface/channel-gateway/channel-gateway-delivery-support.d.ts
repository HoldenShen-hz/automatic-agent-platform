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
    telegram?: {
        limit: number;
        windowMs: number;
    };
    slack?: {
        limit: number;
        windowMs: number;
    };
    webhook?: {
        limit: number;
        windowMs: number;
    };
    default?: {
        limit: number;
        windowMs: number;
    };
}
export interface RateLimitResult {
    allowed: boolean;
    currentCount: number;
    limit: number;
    windowMs: number;
    retryAfterMs?: number;
}
export declare const CHANNEL_DELIVERY_DDL = "\nCREATE TABLE IF NOT EXISTS delivery_messages (\n  message_id TEXT PRIMARY KEY,\n  channel TEXT NOT NULL,\n  target_id TEXT NOT NULL,\n  payload_json TEXT NOT NULL,\n  status TEXT NOT NULL DEFAULT 'pending',\n  attempts INTEGER NOT NULL DEFAULT 0,\n  max_retries INTEGER NOT NULL DEFAULT 3,\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL,\n  completed_at TEXT\n);\n\nCREATE TABLE IF NOT EXISTS delivery_attempts (\n  attempt_id TEXT PRIMARY KEY,\n  message_id TEXT NOT NULL,\n  attempt_number INTEGER NOT NULL,\n  status TEXT NOT NULL,\n  response_status INTEGER,\n  error_message TEXT,\n  provider_message_id TEXT,\n  next_retry_at TEXT,\n  created_at TEXT NOT NULL,\n  completed_at TEXT,\n  FOREIGN KEY (message_id) REFERENCES delivery_messages(message_id)\n);\n\nCREATE INDEX IF NOT EXISTS idx_delivery_messages_status ON delivery_messages(status);\nCREATE INDEX IF NOT EXISTS idx_delivery_attempts_message ON delivery_attempts(message_id);\n\nCREATE TABLE IF NOT EXISTS replay_nonces (\n  nonce TEXT PRIMARY KEY,\n  created_at TEXT NOT NULL,\n  expires_at TEXT NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS gateway_dead_letters (\n  message_id TEXT PRIMARY KEY,\n  channel TEXT NOT NULL,\n  target_id TEXT NOT NULL,\n  payload_json TEXT NOT NULL,\n  failure_reason TEXT NOT NULL,\n  last_error_message TEXT,\n  last_response_status INTEGER,\n  attempts INTEGER NOT NULL DEFAULT 0,\n  first_failed_at TEXT NOT NULL,\n  moved_to_dead_letter_at TEXT NOT NULL,\n  original_request_url TEXT,\n  provider_message_id TEXT\n);\n\nCREATE INDEX IF NOT EXISTS idx_gateway_dead_letters_channel ON gateway_dead_letters(channel);\nCREATE INDEX IF NOT EXISTS idx_gateway_dead_letters_first_failed ON gateway_dead_letters(first_failed_at);\n\nCREATE TABLE IF NOT EXISTS gateway_rate_limits (\n  channel TEXT NOT NULL,\n  window_start TEXT NOT NULL,\n  message_count INTEGER NOT NULL DEFAULT 0,\n  PRIMARY KEY (channel, window_start)\n);\n\nCREATE INDEX IF NOT EXISTS idx_gateway_rate_limits_channel_window ON gateway_rate_limits(channel, window_start);\n";
export declare const DEFAULT_DELIVERY_CONFIG: DeliveryGuaranteeConfig;
export declare const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig;
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
export declare function calculateBackoffForAttempt(config: DeliveryGuaranteeConfig, attemptNumber: number): number;
export declare function toDeliveryMessageRecord(row: {
    attempts: number;
    max_retries: number;
} | undefined): DeliveryMessageRecord | null;
export declare function buildDeadLetterQuery(channel?: string, limit?: number): {
    query: string;
    params: SQLInputValue[];
};
export declare function buildDeadLetterCountQuery(channel?: string): {
    query: string;
    params: SQLInputValue[];
};
