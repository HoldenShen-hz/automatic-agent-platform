/**
 * Supported actions for the billing CLI.
 * Covers account management, usage evaluation, invoice handling, and payment operations.
 */
export type BillingCliAction = "create_account" | "evaluate" | "usage" | "summary" | "export" | "create_invoice" | "create_checkout" | "settle_payment" | "reconcile_payment" | "reconcile_pending" | "list_invoices" | "list_payment_sessions";
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
 * Loads the complete billing CLI environment configuration.
 * Reads all AA_BILLING_* and AA_* payment-related environment variables
 * and returns a fully populated configuration object.
 */
export declare function loadBillingCliEnv(env?: NodeJS.ProcessEnv): BillingCliEnvConfig;
