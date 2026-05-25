export interface ApiClientConfig {
  baseUrl: string;
  apiVersion: string;
  tenantId?: string;
  bearerToken?: string;
  timeoutMs?: number;
  maxRetries?: number;
  platformVersion?: string;
  sdkVersion?: string;
  contractVersion?: string;
  principal?: {
    subject?: string;
    principalId?: string;
    userId?: string;
    tenantId?: string;
    roles?: readonly string[];
    permissions?: readonly string[];
    displayName?: string;
  };
  idempotencyKey?: string;
  performVersionHandshakeOnInit?: boolean;
}

export interface ApiRequestSpec {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  idempotencyKey?: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface PaginationSpec {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  status: number;
  headers: Record<string, string>;
  nextCursor: string | null;
  totalCount?: number;
}

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

export interface VersionHandshakeResult {
  readonly accepted: boolean;
  readonly statusCode: number;
  readonly reasonCode: string;
  readonly headers: Record<string, string>;
  readonly warnings: readonly string[];
  readonly platformVersion?: string;
  readonly contractVersion?: string;
  readonly minClientVersion?: string;
}

export interface ApiRequestOptions {
  readonly idempotencyKey?: string;
}
