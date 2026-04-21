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
import type { BillingAccountRecord, BillingInvoiceRecord, BillingPaymentGatewayKind, BillingPaymentSessionRecord } from "../../platform/contracts/types/domain.js";
/**
 * Input for creating a billing checkout session.
 * Contains the invoice to collect payment for and the account to charge.
 */
export interface CreateBillingCheckoutSessionInput {
    /** The invoice to create a checkout session for */
    invoice: BillingInvoiceRecord;
    /** The billing account to charge */
    account: BillingAccountRecord;
    /** ISO timestamp of session creation */
    createdAt: string;
}
/**
 * Result of creating a checkout session.
 * Contains all information needed to redirect the customer to payment.
 */
export interface BillingCheckoutSessionDefinition {
    /** Type of payment gateway (stripe or manual) */
    gatewayKind: BillingPaymentGatewayKind;
    /** Gateway's unique reference for this checkout session */
    gatewaySessionRef: string;
    /** URL to redirect the customer to for payment */
    checkoutUrl: string;
    /** When the checkout session expires, or null if no expiry */
    expiresAt: string | null;
}
/**
 * Snapshot of a payment session's current status from the gateway.
 * Used for server-side reconciliation of payment state.
 */
export interface BillingPaymentSessionStatusSnapshot {
    /** Type of payment gateway */
    gatewayKind: BillingPaymentGatewayKind;
    /** Gateway's unique reference for this session */
    gatewaySessionRef: string;
    /** Current payment status */
    status: "pending" | "paid" | "expired" | "cancelled" | "failed";
    /** ISO timestamp when this status was observed */
    occurredAt: string;
    /** Failure code if status is failed, null otherwise */
    failureCode?: string | null;
}
/**
 * Interface for payment gateway implementations.
 * Each gateway handles checkout session creation and status reconciliation
 * for a specific payment provider.
 */
export interface BillingPaymentGateway {
    /** The type of gateway this implementation handles */
    readonly kind: BillingPaymentGatewayKind;
    /**
     * Creates a checkout session for collecting payment on an invoice.
     *
     * @param input - Invoice and account information for the checkout
     * @returns Checkout session definition with URL and gateway references
     */
    createCheckoutSession(input: CreateBillingCheckoutSessionInput): BillingCheckoutSessionDefinition | Promise<BillingCheckoutSessionDefinition>;
    /**
     * Fetches the current status of a payment session from the gateway.
     * Optional - gateways that don't support status queries return null.
     *
     * @param input - Session, invoice, and account to look up
     * @returns Status snapshot or null if status cannot be determined
     */
    fetchPaymentSessionStatus?(input: {
        session: BillingPaymentSessionRecord;
        invoice: BillingInvoiceRecord;
        account: BillingAccountRecord;
    }): BillingPaymentSessionStatusSnapshot | Promise<BillingPaymentSessionStatusSnapshot | null> | null;
}
/**
 * Options for configuring the Manual payment gateway.
 * The Manual gateway is used for invoices that are paid through external
 * means (e.g., wire transfer, check) rather than online payment.
 */
export interface ManualBillingPaymentGatewayOptions {
    /** Base URL for manual checkout pages. Defaults to a local development URL. */
    baseUrl?: string;
}
/**
 * Manual payment gateway implementation.
 *
 * This gateway doesn't process real payments - instead it generates checkout
 * URLs that direct users to a manual payment flow where they can confirm
 * payment through external means. Status always returns null since there
 * is no actual payment provider to query.
 */
export declare class ManualBillingPaymentGateway implements BillingPaymentGateway {
    readonly kind = "manual";
    private readonly baseUrl;
    constructor(options?: ManualBillingPaymentGatewayOptions);
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
    createCheckoutSession(input: CreateBillingCheckoutSessionInput): BillingCheckoutSessionDefinition;
    /**
     * Manual gateway does not support status queries.
     * Always returns null since there's no actual payment provider.
     *
     * @returns null indicating status cannot be determined
     */
    fetchPaymentSessionStatus(): BillingPaymentSessionStatusSnapshot | null;
}
/**
 * Configuration options for the Stripe payment gateway.
 * Requires a Stripe secret key and redirect URLs for payment completion.
 */
export interface StripeBillingPaymentGatewayOptions {
    /** Stripe secret key for API authentication */
    secretKey: string;
    /** URL to redirect to after successful payment */
    successUrl: string;
    /** URL to redirect to after cancelled payment */
    cancelUrl: string;
    /** Base URL for Stripe API. Defaults to Stripe's production API. */
    apiBaseUrl?: string;
    /** Fetch function to use for HTTP requests. Defaults to global fetch. */
    fetchFn?: typeof fetch;
}
export interface PaddleBillingPaymentGatewayOptions {
    /** Paddle API key for API authentication */
    apiKey: string;
    /** URL to redirect to after successful payment */
    successUrl: string;
    /** URL to redirect to after cancelled payment */
    cancelUrl: string;
    /** Base URL for Paddle API. Defaults to Paddle's production API. */
    apiBaseUrl?: string;
    /** Fetch function to use for HTTP requests. Defaults to global fetch. */
    fetchFn?: typeof fetch;
}
/**
 * Stripe payment gateway implementation.
 *
 * Integrates with Stripe's Checkout Sessions API to create hosted payment
 * pages and reconcile payment status. Converts between Stripe's response
 * format and the internal billing model.
 */
export declare class StripeBillingPaymentGateway implements BillingPaymentGateway {
    private readonly options;
    readonly kind = "stripe";
    private readonly apiBaseUrl;
    private readonly fetchFn;
    constructor(options: StripeBillingPaymentGatewayOptions);
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
    createCheckoutSession(input: CreateBillingCheckoutSessionInput): Promise<BillingCheckoutSessionDefinition>;
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
    fetchPaymentSessionStatus(input: {
        session: BillingPaymentSessionRecord;
        invoice: BillingInvoiceRecord;
        account: BillingAccountRecord;
    }): Promise<BillingPaymentSessionStatusSnapshot | null>;
}
export declare class PaddleBillingPaymentGateway implements BillingPaymentGateway {
    private readonly options;
    readonly kind = "paddle";
    private readonly apiBaseUrl;
    private readonly fetchFn;
    constructor(options: PaddleBillingPaymentGatewayOptions);
    createCheckoutSession(input: CreateBillingCheckoutSessionInput): Promise<BillingCheckoutSessionDefinition>;
    fetchPaymentSessionStatus(input: {
        session: BillingPaymentSessionRecord;
        invoice: BillingInvoiceRecord;
        account: BillingAccountRecord;
    }): Promise<BillingPaymentSessionStatusSnapshot | null>;
}
