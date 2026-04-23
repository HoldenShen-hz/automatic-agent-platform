import { ValidationError } from "../../contracts/errors.js";
import { loadGatewayEnv, readRequiredTrimmedEnv, readTrimmedEnv } from "./gateway-env.js";
/** All supported channel gateway actions */
const ALLOWED_ACTIONS = ["send", "pending", "status", "targets", "retry", "fail"];
/**
 * Parses a channel gateway action from string, defaulting to "send".
 * Throws if the value is not a recognized action.
 */
function parseAction(raw) {
    if (raw == null) {
        return "send";
    }
    if (ALLOWED_ACTIONS.includes(raw)) {
        return raw;
    }
    throw new ValidationError("gateway.invalid_action", "gateway.invalid_action");
}
/**
 * Loads and validates the channel gateway environment configuration.
 * Enforces required fields based on the selected action.
 * For send action, message is required. For status/retry/fail, deliveryMessageId is required.
 */
export function loadChannelGatewayEnv(env = process.env) {
    const action = parseAction(readTrimmedEnv(env, "AA_CHANNEL_GATEWAY_ACTION"));
    const message = readTrimmedEnv(env, "AA_GATEWAY_MESSAGE");
    const deliveryMessageId = readTrimmedEnv(env, "AA_DELIVERY_MESSAGE_ID");
    if (action === "send" && message == null) {
        throw new ValidationError("missing_env:AA_GATEWAY_MESSAGE", "missing_env:AA_GATEWAY_MESSAGE");
    }
    if ((action === "status" || action === "retry" || action === "fail") && deliveryMessageId == null) {
        throw new ValidationError("missing_env:AA_DELIVERY_MESSAGE_ID", "missing_env:AA_DELIVERY_MESSAGE_ID");
    }
    return {
        dbPath: readRequiredTrimmedEnv(env, "AA_DB_PATH"),
        action,
        gateway: loadGatewayEnv(env, {
            invalidWebhookHeadersCode: "gateway.invalid_webhook_headers_json",
        }),
        message,
        channel: readTrimmedEnv(env, "AA_GATEWAY_CHANNEL"),
        targetId: readTrimmedEnv(env, "AA_GATEWAY_TARGET_ID"),
        query: readTrimmedEnv(env, "AA_GATEWAY_QUERY"),
        deliveryMessageId,
        failureReason: readTrimmedEnv(env, "AA_DELIVERY_FAILURE_REASON") ?? "manually_marked_failed",
    };
}
//# sourceMappingURL=channel-gateway-env.js.map