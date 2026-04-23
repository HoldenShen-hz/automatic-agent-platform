import { type GatewayEnvConfig } from "./gateway-env.js";
/**
 * Supported actions for the channel gateway.
 * Controls message routing, delivery status, and retry handling.
 */
export type ChannelGatewayAction = "send" | "pending" | "status" | "targets" | "retry" | "fail";
/**
 * Environment configuration for the channel gateway.
 * Configures database access, gateway integration, and message routing parameters.
 */
export interface ChannelGatewayEnvConfig {
    /** Path to the SQLite database file */
    dbPath: string;
    /** The gateway action to perform */
    action: ChannelGatewayAction;
    /** Gateway integration configuration (Telegram, Slack, webhooks) */
    gateway: GatewayEnvConfig;
    /** Message content for send actions */
    message: string | null;
    /** Target channel identifier for routing */
    channel: string | null;
    /** Target recipient identifier */
    targetId: string | null;
    /** Query string for target discovery */
    query: string | null;
    /** Message identifier for status, retry, or fail actions */
    deliveryMessageId: string | null;
    /** Reason for marking a delivery as failed */
    failureReason: string;
}
/**
 * Loads and validates the channel gateway environment configuration.
 * Enforces required fields based on the selected action.
 * For send action, message is required. For status/retry/fail, deliveryMessageId is required.
 */
export declare function loadChannelGatewayEnv(env?: NodeJS.ProcessEnv): ChannelGatewayEnvConfig;
