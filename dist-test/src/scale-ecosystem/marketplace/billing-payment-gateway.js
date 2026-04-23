/**
 * Billing Payment Gateway
 *
 * Provides payment gateway abstractions for billing operations. Supports multiple
 * gateway types (Stripe and Manual) with a common interface for creating checkout
 * sessions and fetching payment status. This enables the billing service to operate
 * independently of specific payment providers while supporting payment reconciliation.
 *
 * Design contract:
 * - Gateway implementations must be stateless and idempotent where possible
 * - Session creation returns a checkout URL for customer payment flow
 * - Status fetching enables server-side reconciliation of payment state
 *
 * @see billing-service.ts for the billing service that uses these gateways
 * @see docs_zh/contracts/billing_contract.md for payment integration requirements
 */
import { ProviderError, ValidationError } from "../../platform/contracts/errors.js";
import { MANUAL_BILLING_CHECKOUT_URL, PADDLE_API_URL, STRIPE_API_URL, } from "../../platform/control-plane/config-center/provider-defaults.js";
/**
 * Manual payment gateway implementation.
 *
 * This gateway doesn't process real payments - instead it generates checkout
 * URLs that direct users to a manual payment flow where they can confirm
 * payment through external means. Status always returns null since there
 * is no actual payment provider to query.
 */
export class ManualBillingPaymentGateway {
    kind = "manual";
    baseUrl;
    constructor(options = {}) {
        this.baseUrl = options.baseUrl?.trim() || MANUAL_BILLING_CHECKOUT_URL;
    }
    /**
     * Creates a manual checkout session.
     *
     * Generates a checkout URL that includes the invoice ID and account ID as
     * query parameters. The session reference is derived from the invoice ID.
     * Manual sessions never expire since the payment timing is external.
     *
     * @param input - Invoice and account for the checkout
     * @returns Checkout session with a manual payment URL
     */
    createCheckoutSession(input) {
        const gatewaySessionRef = `manual_${input.invoice.invoiceId}`;
        return {
            gatewayKind: this.kind,
            gatewaySessionRef,
            checkoutUrl: `${this.baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(input.invoice.invoiceId)}?accountId=${encodeURIComponent(input.account.accountId)}`,
            expiresAt: null, // Manual payments don't expire
        };
    }
    /**
     * Manual gateway does not support status queries.
     * Always returns null since there's no actual payment provider.
     *
     * @returns null indicating status cannot be determined
     */
    fetchPaymentSessionStatus() {
        return null;
    }
}
/**
 * Stripe payment gateway implementation.
 *
 * Integrates with Stripe's Checkout Sessions API to create hosted payment
 * pages and reconcile payment status. Converts between Stripe's response
 * format and the internal billing model.
 */
export class StripeBillingPaymentGateway {
    options;
    kind = "stripe";
    apiBaseUrl;
    fetchFn;
    constructor(options) {
        this.options = options;
        this.apiBaseUrl = options.apiBaseUrl?.trim() || STRIPE_API_URL;
        this.fetchFn = options.fetchFn ?? fetch;
    }
    /**
     * Creates a Stripe Checkout session for the given invoice.
     *
     * Converts the invoice amount to cents (Stripe's currency unit) and creates
     * a Stripe Checkout session with line items, metadata for reconciliation, and
     * redirect URLs. Includes invoice and account IDs in metadata for correlation.
     *
     * @param input - Invoice and account for the checkout
     * @returns Checkout session with Stripe URL and session reference
     * @throws ProviderError if Stripe returns an error response
     * @throws ValidationError if Stripe's response is malformed
     */
    async createCheckoutSession(input) {
        // Convert USD amount to cents (Stripe's currency unit)
        const unitAmountCents = Math.max(0, Math.round(input.invoice.totalUsd * 100));
        // Build the Stripe checkout session form data
        const form = new URLSearchParams({
            mode: "payment",
            success_url: this.options.successUrl,
            cancel_url: this.options.cancelUrl,
            client_reference_id: input.invoice.invoiceId,
            "line_items[0][quantity]": "1",
            "line_items[0][price_data][currency]": input.invoice.currency.toLowerCase(),
            "line_items[0][price_data][unit_amount]": String(unitAmountCents),
            "line_items[0][price_data][product_data][name]": `Automatic Agent Invoice ${input.invoice.invoiceId}`,
            "metadata[invoice_id]": input.invoice.invoiceId,
            "metadata[account_id]": input.account.accountId,
            "metadata[tenant_id]": input.invoice.tenantId ?? "",
            "metadata[created_at]": input.createdAt,
        });
        // Create the Stripe checkout session
        const response = await this.fetchFn(`${this.apiBaseUrl.replace(/\/+$/, "")}/checkout/sessions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.options.secretKey}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
        });
        const payload = await response.json();
        // Handle Stripe API errors
        if (!response.ok) {
            throw new ProviderError(`billing.stripe_checkout_failed:${payload.error?.message ?? (response.statusText || String(response.status))}`, `billing.stripe_checkout_failed:${payload.error?.message ?? (response.statusText || String(response.status))}`, {
                details: { status: response.status },
                retryable: response.status >= 500,
            });
        }
        // Validate response structure
        if (typeof payload.id !== "string" || typeof payload.url !== "string") {
            throw new ValidationError("billing.stripe_checkout_invalid_response", "billing.stripe_checkout_invalid_response", {
                source: "provider",
            });
        }
        return {
            gatewayKind: this.kind,
            gatewaySessionRef: payload.id,
            checkoutUrl: payload.url,
            expiresAt: payload.expires_at == null ? null : new Date(payload.expires_at * 1000).toISOString(),
        };
    }
    /**
     * Fetches the current status of a Stripe Checkout session.
     *
     * Queries Stripe's API for the session status using the gateway session reference.
     * Converts Stripe's payment_status and status fields to internal status values.
     * Server errors (5xx) and rate limiting (429) are retryable.
     *
     * @param input - Session, invoice, and account to look up
     * @returns Status snapshot or null if the session cannot be found
     * @throws ProviderError if Stripe returns an error
     * @throws ValidationError if Stripe's response is malformed
     */
    async fetchPaymentSessionStatus(input) {
        const response = await this.fetchFn(`${this.apiBaseUrl.replace(/\/+$/, "")}/checkout/sessions/${encodeURIComponent(input.session.gatewaySessionRef)}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${this.options.secretKey}`,
            },
        });
        const payload = await response.json();
        // Handle Stripe API errors
        if (!response.ok) {
            throw new ProviderError(`billing.stripe_reconcile_failed:${payload.error?.message ?? (response.statusText || String(response.status))}`, `billing.stripe_reconcile_failed:${payload.error?.message ?? (response.statusText || String(response.status))}`, {
                details: {
                    invoiceId: input.invoice.invoiceId,
                    accountId: input.account.accountId,
                    sessionId: input.session.sessionId,
                    status: response.status,
                },
                retryable: response.status >= 500 || response.status === 429,
            });
        }
        // Validate response references the correct session
        if (typeof payload.id !== "string" || payload.id !== input.session.gatewaySessionRef) {
            throw new ValidationError("billing.stripe_reconcile_invalid_response", "billing.stripe_reconcile_invalid_response", {
                source: "provider",
            });
        }
        const occurredAt = new Date().toISOString();
        // Map Stripe's payment_status to internal status
        if (payload.payment_status === "paid") {
            return {
                gatewayKind: this.kind,
                gatewaySessionRef: payload.id,
                status: "paid",
                occurredAt,
            };
        }
        // Check if the session has expired
        if (payload.status === "expired") {
            return {
                gatewayKind: this.kind,
                gatewaySessionRef: payload.id,
                status: "expired",
                occurredAt,
            };
        }
        // Default to pending for any other state
        return {
            gatewayKind: this.kind,
            gatewaySessionRef: payload.id,
            status: "pending",
            occurredAt,
        };
    }
}
export class PaddleBillingPaymentGateway {
    options;
    kind = "paddle";
    apiBaseUrl;
    fetchFn;
    constructor(options) {
        this.options = options;
        this.apiBaseUrl = options.apiBaseUrl?.trim() || PADDLE_API_URL;
        this.fetchFn = options.fetchFn ?? fetch;
    }
    async createCheckoutSession(input) {
        const response = await this.fetchFn(`${this.apiBaseUrl.replace(/\/+$/, "")}/transactions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.options.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                items: [
                    {
                        quantity: 1,
                        price: {
                            name: `Automatic Agent Invoice ${input.invoice.invoiceId}`,
                            description: `Invoice ${input.invoice.invoiceId}`,
                            unit_price: {
                                amount: String(Math.max(0, Math.round(input.invoice.totalUsd * 100))),
                                currency_code: input.invoice.currency,
                            },
                        },
                    },
                ],
                custom_data: {
                    invoice_id: input.invoice.invoiceId,
                    account_id: input.account.accountId,
                    tenant_id: input.invoice.tenantId ?? "",
                    created_at: input.createdAt,
                },
                checkout: {
                    success_url: this.options.successUrl,
                    cancel_url: this.options.cancelUrl,
                },
            }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new ProviderError(`billing.paddle_checkout_failed:${payload.error?.detail ?? (response.statusText || String(response.status))}`, `billing.paddle_checkout_failed:${payload.error?.detail ?? (response.statusText || String(response.status))}`, {
                details: { status: response.status },
                retryable: response.status >= 500 || response.status === 429,
            });
        }
        if (typeof payload.data?.id !== "string" || typeof payload.data?.checkout?.url !== "string") {
            throw new ValidationError("billing.paddle_checkout_invalid_response", "billing.paddle_checkout_invalid_response", {
                source: "provider",
            });
        }
        return {
            gatewayKind: this.kind,
            gatewaySessionRef: payload.data.id,
            checkoutUrl: payload.data.checkout.url,
            expiresAt: null,
        };
    }
    async fetchPaymentSessionStatus(input) {
        const response = await this.fetchFn(`${this.apiBaseUrl.replace(/\/+$/, "")}/transactions/${encodeURIComponent(input.session.gatewaySessionRef)}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${this.options.apiKey}`,
            },
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new ProviderError(`billing.paddle_reconcile_failed:${payload.error?.detail ?? (response.statusText || String(response.status))}`, `billing.paddle_reconcile_failed:${payload.error?.detail ?? (response.statusText || String(response.status))}`, {
                details: {
                    invoiceId: input.invoice.invoiceId,
                    accountId: input.account.accountId,
                    sessionId: input.session.sessionId,
                    status: response.status,
                },
                retryable: response.status >= 500 || response.status === 429,
            });
        }
        if (typeof payload.data?.id !== "string" || payload.data.id !== input.session.gatewaySessionRef) {
            throw new ValidationError("billing.paddle_reconcile_invalid_response", "billing.paddle_reconcile_invalid_response", {
                source: "provider",
            });
        }
        const occurredAt = payload.data.updated_at ?? new Date().toISOString();
        const normalizedStatus = String(payload.data.status ?? "").toLowerCase();
        if (normalizedStatus === "completed" || normalizedStatus === "paid" || normalizedStatus === "billed") {
            return {
                gatewayKind: this.kind,
                gatewaySessionRef: payload.data.id,
                status: "paid",
                occurredAt,
            };
        }
        if (normalizedStatus === "canceled" || normalizedStatus === "cancelled") {
            return {
                gatewayKind: this.kind,
                gatewaySessionRef: payload.data.id,
                status: "cancelled",
                occurredAt,
            };
        }
        if (normalizedStatus === "past_due" || normalizedStatus === "failed") {
            return {
                gatewayKind: this.kind,
                gatewaySessionRef: payload.data.id,
                status: "failed",
                occurredAt,
            };
        }
        return {
            gatewayKind: this.kind,
            gatewaySessionRef: payload.data.id,
            status: "pending",
            occurredAt,
        };
    }
}
//# sourceMappingURL=billing-payment-gateway.js.map