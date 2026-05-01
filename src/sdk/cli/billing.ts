/**
 * Billing CLI Tool
 *
 * This module provides a command-line interface for billing operations including
 * account management, usage recording, entitlement evaluation, invoice handling,
 * and payment session reconciliation. It supports both Stripe and manual payment
 * gateways.
 *
 * Usage:
 *   npm run billing create_account          # Create billing account
 *   npm run billing evaluate                # Evaluate feature entitlement
 *   npm run billing usage                   # Record usage metric
 *   npm run billing summary                 # Build account summary
 *   npm run billing create_invoice          # Create invoice
 *   npm run billing create_checkout         # Create checkout session
 *   npm run billing settle_payment          # Settle payment session
 *   npm run billing reconcile_payment       # Reconcile payment
 *
 * Environment Variables:
 *   - AA_BILLING_ACTION: The billing operation to perform
 *   - AA_DB_PATH: Optional database path for persistent storage
 *   - AA_BILLING_ACCOUNT_ID: Target account identifier
 *   - AA_BILLING_OWNER_ID: Account owner identifier
 *   - AA_BILLING_WORKSPACE_ID: Workspace identifier
 *   - AA_BILLING_PLAN_ID: Billing plan identifier
 *   - Additional action-specific variables documented in loadBillingCliEnv
 *
 * @see {@link docs_zh/contracts/} - Billing contracts
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Billing terminology
 * @see {@link docs_zh/architecture/00-platform-architecture.md} - Architecture
 */

import { dirname } from "node:path";

import { withCliStorageAsync } from "./authoritative-storage.js";
import { loadBillingCliEnv } from "../../platform/control-plane/config-center/billing-env.js";
import { BillingService } from "../../scale-ecosystem/billing/billing-service.js";
import {
  ManualBillingPaymentGateway,
  PaddleBillingPaymentGateway,
  StripeBillingPaymentGateway,
  type BillingPaymentGateway,
} from "../../scale-ecosystem/billing/billing-payment-gateway.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { createWorkspaceWritePolicy } from "../../platform/control-plane/iam/sandbox-policy.js";

/**
 * Creates a payment gateway instance based on CLI environment configuration.
 *
 * @param envConfig - The billing CLI environment configuration
 * @returns A payment gateway instance (Stripe or Manual)
 * @throws ValidationError if required Stripe configuration is missing
 */
function createPaymentGateway(envConfig: ReturnType<typeof loadBillingCliEnv>): BillingPaymentGateway {
  if (envConfig.paymentGatewayKind === "stripe") {
    if (envConfig.stripeSecretKey == null || envConfig.stripeSuccessUrl == null || envConfig.stripeCancelUrl == null) {
      throw new ValidationError("billing.missing_stripe_gateway_env", "billing.missing_stripe_gateway_env");
    }
    return new StripeBillingPaymentGateway({
      secretKey: envConfig.stripeSecretKey,
      successUrl: envConfig.stripeSuccessUrl,
      cancelUrl: envConfig.stripeCancelUrl,
      ...(envConfig.stripeApiBaseUrl != null ? { apiBaseUrl: envConfig.stripeApiBaseUrl } : {}),
    });
  }
  if (envConfig.paymentGatewayKind === "paddle") {
    if (envConfig.paddleApiKey == null || envConfig.paddleSuccessUrl == null || envConfig.paddleCancelUrl == null) {
      throw new ValidationError("billing.missing_paddle_gateway_env", "billing.missing_paddle_gateway_env");
    }
    return new PaddleBillingPaymentGateway({
      apiKey: envConfig.paddleApiKey,
      successUrl: envConfig.paddleSuccessUrl,
      cancelUrl: envConfig.paddleCancelUrl,
      ...(envConfig.paddleApiBaseUrl != null ? { apiBaseUrl: envConfig.paddleApiBaseUrl } : {}),
    });
  }
  const paymentGatewayOptions = envConfig.paymentGatewayBaseUrl != null
    ? { baseUrl: envConfig.paymentGatewayBaseUrl }
    : {};
  return new ManualBillingPaymentGateway(paymentGatewayOptions);
}

/**
 * Main entry point for the billing CLI.
 *
 * Initializes the database, payment gateway, and billing service based on
 * environment configuration. Dispatches to the appropriate billing operation
 * based on the AA_BILLING_ACTION environment variable. Outputs results as
 * formatted JSON and ensures the database connection is properly closed.
 */
async function main(): Promise<void> {
  const envConfig = loadBillingCliEnv();
  const dbPath = envConfig.dbPath;
  const action = envConfig.action;
  const result = await withCliStorageAsync(async (storage) => {
    const artifactRoot = envConfig.artifactRoot;
    const paymentGateway = createPaymentGateway(envConfig);
    const billing = artifactRoot == null || artifactRoot.length === 0
      ? new BillingService(storage.sql, storage.store, {
        paymentGateway,
      })
      : new BillingService(storage.sql, storage.store, {
        artifactStoreOptions: {
          rootDir: artifactRoot,
          sandboxPolicy: createWorkspaceWritePolicy(dirname(artifactRoot)),
        },
        paymentGateway,
      });

    switch (action) {
      case "create_account":
        return billing.createAccount({
          ...(envConfig.accountId ? { accountId: envConfig.accountId } : {}),
          ownerId: envConfig.ownerId ?? "",
          workspaceId: envConfig.workspaceId,
          planId: envConfig.planId ?? "",
          status: envConfig.accountStatus,
          ...(envConfig.createdAt ? { createdAt: envConfig.createdAt } : {}),
        });
      case "evaluate":
        return billing.evaluateEntitlement({
          accountId: envConfig.accountId ?? "",
          featureKey: envConfig.featureKey ?? "",
          metricType: envConfig.metricType as
            | "task_execution"
            | "token_usage"
            | "artifact_storage_bytes"
            | "premium_feature_activation"
            | null,
          ...(envConfig.requestedQuantity != null ? { requestedQuantity: envConfig.requestedQuantity } : {}),
          ...(envConfig.evaluatedAt ? { evaluatedAt: envConfig.evaluatedAt } : {}),
        });
      case "usage":
        return billing.recordUsage({
          accountId: envConfig.accountId ?? "",
          ...(envConfig.subjectId ? { subjectId: envConfig.subjectId } : {}),
          workspaceId: envConfig.workspaceId,
          tenantId: envConfig.tenantId,
          taskId: envConfig.taskId,
          executionId: envConfig.executionId,
          metricType: (envConfig.metricType ?? "") as
            | "task_execution"
            | "token_usage"
            | "artifact_storage_bytes"
            | "premium_feature_activation",
          quantity: envConfig.quantity,
          source: envConfig.source,
          ...(envConfig.capturedAt ? { capturedAt: envConfig.capturedAt } : {}),
        });
      case "report":
        if (envConfig.accountId == null) {
          return {
            generatedAt: new Date().toISOString(),
            accounts: storage.store.billing.listBillingAccounts(envConfig.limit ?? 50),
          };
        }
        return billing.buildAccountSummary(envConfig.accountId);
      case "summary":
        return billing.buildAccountSummary(envConfig.accountId ?? "");
      case "export":
        return billing.exportAccountSummary(envConfig.accountId ?? "");
      case "create_invoice":
        return billing.createInvoice({
          accountId: envConfig.accountId ?? "",
          tenantId: envConfig.tenantId,
          dueAt: envConfig.dueAt,
          ...(envConfig.taxUsd != null ? { taxUsd: envConfig.taxUsd } : {}),
          ...(envConfig.createdAt ? { createdAt: envConfig.createdAt } : {}),
        });
      case "create_checkout":
        return await billing.createCheckoutSession({
          invoiceId: envConfig.invoiceId ?? "",
          tenantId: envConfig.tenantId,
          ...(envConfig.createdAt ? { createdAt: envConfig.createdAt } : {}),
        });
      case "settle_payment":
        return billing.settlePaymentSession({
          sessionId: envConfig.sessionId ?? "",
          tenantId: envConfig.tenantId,
          ...(envConfig.createdAt ? { settledAt: envConfig.createdAt } : {}),
        });
      case "reconcile_payment":
        return billing.reconcilePaymentSession({
          gatewayKind: envConfig.paymentGatewayKind,
          gatewaySessionRef: envConfig.gatewaySessionRef ?? "",
          status: envConfig.paymentStatus ?? "pending",
          tenantId: envConfig.tenantId,
          ...(envConfig.createdAt ? { occurredAt: envConfig.createdAt } : {}),
          ...(envConfig.failureCode ? { failureCode: envConfig.failureCode } : {}),
        });
      case "reconcile_pending":
        return await billing.reconcilePendingPaymentSessions({
          ...(envConfig.tenantId !== null ? { tenantId: envConfig.tenantId } : {}),
          ...(envConfig.limit != null ? { limit: envConfig.limit } : {}),
          ...(envConfig.paymentGatewayKindConfigured ? { gatewayKind: envConfig.paymentGatewayKind } : {}),
          ...(envConfig.createdAt ? { occurredAt: envConfig.createdAt } : {}),
        });
      case "list_invoices":
        return billing.listInvoices(envConfig.accountId ?? "", envConfig.limit ?? 50, envConfig.tenantId);
      case "list_payment_sessions":
        return billing.listPaymentSessions(envConfig.invoiceId ?? "", envConfig.limit ?? 50, envConfig.tenantId);
      default:
        throw new ValidationError(`unknown_billing_action:${action}`, `unknown_billing_action:${action}`);
    }
  }, { dbPath });

  // Redact sensitive values from output to prevent credential leakage
  process.stdout.write(`${JSON.stringify(redactSensitiveValues(result), null, 2)}\n`);
}

await main();

/**
 * Redact sensitive values from billing result to prevent credential leakage.
 * Redacts Stripe secret keys, Paddle API keys, and similar credentials.
 */
function redactSensitiveValues(obj: unknown): unknown {
  if (obj == null || typeof obj !== "object") {
    return obj;
  }

  const REDACTED = "[REDACTED]";
  const sensitiveKeys = ["secretKey", "apiKey", "secret", "password", "token", "credential"];

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveValues);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk)) && typeof value === "string" && value.length > 0) {
      result[key] = REDACTED;
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSensitiveValues(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
