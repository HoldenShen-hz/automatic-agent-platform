import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";
/**
 * Reads a required environment variable, throwing if not present or empty.
 * Used for mandatory billing configuration like database path.
 */
function requiredEnv(env, name) {
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
function readNumber(env, name) {
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
function readAction(env) {
    const action = readTrimmedEnv(env, "AA_BILLING_ACTION") ?? "summary";
    const allowed = [
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
    if (!allowed.includes(action)) {
        throw new ValidationError("billing.invalid_action", `Unknown billing action: ${action}`);
    }
    return action;
}
/**
 * Reads the payment gateway kind, defaulting to "manual".
 * Supports manual, Stripe, and Paddle gateway types.
 */
function readPaymentGatewayKind(env) {
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
function readPaymentStatus(env) {
    const status = readTrimmedEnv(env, "AA_PAYMENT_STATUS");
    if (status == null) {
        return null;
    }
    if (!["pending", "paid", "expired", "cancelled", "failed"].includes(status)) {
        throw new ValidationError("billing.invalid_payment_status", `billing.invalid_payment_status: Unknown payment status: ${status}`);
    }
    return status;
}
/**
 * Loads the complete billing CLI environment configuration.
 * Reads all AA_BILLING_* and AA_* payment-related environment variables
 * and returns a fully populated configuration object.
 */
export function loadBillingCliEnv(env = process.env) {
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
        accountStatus: readTrimmedEnv(env, "AA_ACCOUNT_STATUS") ?? "active",
        createdAt: readTrimmedEnv(env, "AA_CREATED_AT") ?? null,
        featureKey: readTrimmedEnv(env, "AA_FEATURE_KEY") ?? null,
        metricType: readTrimmedEnv(env, "AA_METRIC_TYPE") ?? null,
        requestedQuantity: readNumber(env, "AA_REQUESTED_QUANTITY"),
        quantity: readNumber(env, "AA_QUANTITY") ?? 1,
        source: readTrimmedEnv(env, "AA_SOURCE") ?? "runtime",
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
//# sourceMappingURL=billing-env.js.map