import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";

/**
 * Supported actions for the billing CLI.
 * Covers account management, usage evaluation, invoice handling, and payment operations.
 */
export type BillingCliAction =
  | "create_account"
  | "evaluate"
  | "usage"
  | "summary"
  | "export"
  | "create_invoice"
  | "create_checkout"
  | "settle_payment"
  | "reconcile_payment"
  | "reconcile_pending"
  | "list_invoices"
  | "list_payment_sessions";

/**
 * Complete environment configuration for the billing CLI.
 * Contains all parameters needed to execute billing operations including
 * account identification, payment gateway settings, and provider integrations.
 */
export interface BillingCliEnvConfig {
  /** Path to the SQLite database file */
  dbPath: string;
  /** The billing action to perform */
  action: BillingCliAction;
  /** Root directory for artifact storage (optional) */
  artifactRoot: string | null;
  /** Payment gateway implementation */
  paymentGatewayKind: "manual" | "stripe" | "paddle";
  /** Whether the payment gateway kind was explicitly configured */
  paymentGatewayKindConfigured: boolean;
  /** Billing account identifier */
  accountId: string | null;
  /** Owner user identifier */
  ownerId: string | null;
  /** Workspace identifier */
  workspaceId: string | null;
  /** Tenant identifier */
  tenantId: string | null;
  /** Selected billing plan identifier */
  planId: string | null;
  /** Current account status */
  accountStatus: "active" | "suspended" | "cancelled";
  /** Account creation timestamp */
  createdAt: string | null;
  /** Feature flag key for feature usage tracking */
  featureKey: string | null;
  /** Metric type for usage tracking */
  metricType: string | null;
  /** Requested quantity for quota evaluation */
  requestedQuantity: number | null;
  /** Actual quantity for usage recording */
  quantity: number;
  /** Source system that captured the billing event */
  source: "runtime" | "api" | "gateway" | "admin";
  /** Subject identifier for the billing event */
  subjectId: string | null;
  /** Associated task identifier */
  taskId: string | null;
  /** Associated execution identifier */
  executionId: string | null;
  /** Timestamp when usage was captured */
  capturedAt: string | null;
  /** Timestamp when usage was evaluated */
  evaluatedAt: string | null;
  /** Invoice identifier */
  invoiceId: string | null;
  /** Payment session identifier */
  sessionId: string | null;
  /** Reference from the payment gateway */
  gatewaySessionRef: string | null;
  /** Current payment status */
  paymentStatus: "pending" | "paid" | "expired" | "cancelled" | "failed" | null;
  /** Error code if payment failed */
  failureCode: string | null;
  /** Result limit for list operations */
  limit: number | null;
  /** Payment due date */
  dueAt: string | null;
  /** Tax amount in USD */
  taxUsd: number | null;
  /** Base URL for payment gateway API */
  paymentGatewayBaseUrl: string | null;
  /** Stripe secret key for API authentication */
  stripeSecretKey: string | null;
  /** URL to redirect on successful Stripe checkout */
  stripeSuccessUrl: string | null;
  /** URL to redirect on cancelled Stripe checkout */
  stripeCancelUrl: string | null;
  /** Base URL for Stripe API (for testing/sandbox) */
  stripeApiBaseUrl: string | null;
  /** Paddle API key for API authentication */
  paddleApiKey: string | null;
  /** URL to redirect on successful Paddle checkout */
  paddleSuccessUrl: string | null;
  /** URL to redirect on cancelled Paddle checkout */
  paddleCancelUrl: string | null;
  /** Base URL for Paddle API (for testing/sandbox) */
  paddleApiBaseUrl: string | null;
}

/**
 * Reads a required environment variable, throwing if not present or empty.
 * Used for mandatory billing configuration like database path.
 */
function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = readTrimmedEnv(env, name);
  if (value == null) {
    throw new ValidationError(`billing.missing_env:${name}`, `Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Reads a numeric environment variable, returning null if absent.
 * Throws if the value exists but cannot be parsed as a finite number.
 */
function readNumber(env: NodeJS.ProcessEnv, name: string): number | null {
  const raw = readTrimmedEnv(env, name);
  if (raw == null) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`billing.invalid_number:${name}`, `Environment variable ${name} must be numeric.`, {
      details: { raw },
    });
  }
  return parsed;
}

/**
 * Reads the billing action from environment, defaulting to "summary".
 * Validates that the action is one of the supportedBillingCliAction values.
 */
function readAction(env: NodeJS.ProcessEnv): BillingCliAction {
  const action = readTrimmedEnv(env, "AA_BILLING_ACTION") ?? "summary";
  const allowed: readonly BillingCliAction[] = [
    "create_account",
    "evaluate",
    "usage",
    "summary",
    "export",
    "create_invoice",
    "create_checkout",
    "settle_payment",
    "reconcile_payment",
    "reconcile_pending",
    "list_invoices",
    "list_payment_sessions",
  ];
  if (!allowed.includes(action as BillingCliAction)) {
    throw new ValidationError("billing.invalid_action", `Unknown billing action: ${action}`);
  }
  return action as BillingCliAction;
}

/**
 * Reads the payment gateway kind, defaulting to "manual".
 * Supports manual, Stripe, and Paddle gateway types.
 */
function readPaymentGatewayKind(env: NodeJS.ProcessEnv): BillingCliEnvConfig["paymentGatewayKind"] {
  const kind = readTrimmedEnv(env, "AA_PAYMENT_GATEWAY_KIND") ?? "manual";
  if (kind !== "manual" && kind !== "stripe" && kind !== "paddle") {
    throw new ValidationError("billing.invalid_payment_gateway_kind", `Unknown payment gateway kind: ${kind}`);
  }
  return kind;
}

/**
 * Reads the payment status from environment, returning null if not set.
 * Validates against known payment status values.
 */
function readPaymentStatus(env: NodeJS.ProcessEnv): BillingCliEnvConfig["paymentStatus"] {
  const status = readTrimmedEnv(env, "AA_PAYMENT_STATUS");
  if (status == null) {
    return null;
  }
  if (!["pending", "paid", "expired", "cancelled", "failed"].includes(status)) {
    throw new ValidationError("billing.invalid_payment_status", `billing.invalid_payment_status: Unknown payment status: ${status}`);
  }
  return status as BillingCliEnvConfig["paymentStatus"];
}

/**
 * Loads the complete billing CLI environment configuration.
 * Reads all AA_BILLING_* and AA_* payment-related environment variables
 * and returns a fully populated configuration object.
 */
export function loadBillingCliEnv(env: NodeJS.ProcessEnv = process.env): BillingCliEnvConfig {
  return {
    dbPath: requiredEnv(env, "AA_DB_PATH"),
    action: readAction(env),
    artifactRoot: readTrimmedEnv(env, "AA_ARTIFACT_ROOT") ?? null,
    paymentGatewayKind: readPaymentGatewayKind(env),
    paymentGatewayKindConfigured: readTrimmedEnv(env, "AA_PAYMENT_GATEWAY_KIND") != null,
    accountId: readTrimmedEnv(env, "AA_ACCOUNT_ID") ?? null,
    ownerId: readTrimmedEnv(env, "AA_OWNER_ID") ?? null,
    workspaceId: readTrimmedEnv(env, "AA_WORKSPACE_ID") ?? null,
    tenantId: readTrimmedEnv(env, "AA_TENANT_ID") ?? null,
    planId: readTrimmedEnv(env, "AA_PLAN_ID") ?? null,
    accountStatus: (readTrimmedEnv(env, "AA_ACCOUNT_STATUS") as BillingCliEnvConfig["accountStatus"] | null) ?? "active",
    createdAt: readTrimmedEnv(env, "AA_CREATED_AT") ?? null,
    featureKey: readTrimmedEnv(env, "AA_FEATURE_KEY") ?? null,
    metricType: readTrimmedEnv(env, "AA_METRIC_TYPE") ?? null,
    requestedQuantity: readNumber(env, "AA_REQUESTED_QUANTITY"),
    quantity: readNumber(env, "AA_QUANTITY") ?? 1,
    source: (readTrimmedEnv(env, "AA_SOURCE") as BillingCliEnvConfig["source"] | null) ?? "runtime",
    subjectId: readTrimmedEnv(env, "AA_SUBJECT_ID") ?? null,
    taskId: readTrimmedEnv(env, "AA_TASK_ID") ?? null,
    executionId: readTrimmedEnv(env, "AA_EXECUTION_ID") ?? null,
    capturedAt: readTrimmedEnv(env, "AA_CAPTURED_AT") ?? null,
    evaluatedAt: readTrimmedEnv(env, "AA_EVALUATED_AT") ?? null,
    invoiceId: readTrimmedEnv(env, "AA_INVOICE_ID") ?? null,
    sessionId: readTrimmedEnv(env, "AA_PAYMENT_SESSION_ID") ?? null,
    gatewaySessionRef: readTrimmedEnv(env, "AA_GATEWAY_SESSION_REF") ?? null,
    paymentStatus: readPaymentStatus(env),
    failureCode: readTrimmedEnv(env, "AA_FAILURE_CODE") ?? null,
    limit: readNumber(env, "AA_LIMIT"),
    dueAt: readTrimmedEnv(env, "AA_DUE_AT") ?? null,
    taxUsd: readNumber(env, "AA_TAX_USD"),
    paymentGatewayBaseUrl: readTrimmedEnv(env, "AA_PAYMENT_GATEWAY_BASE_URL") ?? null,
    stripeSecretKey: readTrimmedEnv(env, "AA_STRIPE_SECRET_KEY") ?? null,
    stripeSuccessUrl: readTrimmedEnv(env, "AA_BILLING_SUCCESS_URL") ?? null,
    stripeCancelUrl: readTrimmedEnv(env, "AA_BILLING_CANCEL_URL") ?? null,
    stripeApiBaseUrl: readTrimmedEnv(env, "AA_STRIPE_API_BASE_URL") ?? null,
    paddleApiKey: readTrimmedEnv(env, "AA_PADDLE_API_KEY") ?? null,
    paddleSuccessUrl: readTrimmedEnv(env, "AA_BILLING_SUCCESS_URL") ?? null,
    paddleCancelUrl: readTrimmedEnv(env, "AA_BILLING_CANCEL_URL") ?? null,
    paddleApiBaseUrl: readTrimmedEnv(env, "AA_PADDLE_API_BASE_URL") ?? null,
  };
}
