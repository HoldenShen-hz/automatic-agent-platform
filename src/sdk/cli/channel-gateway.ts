/**
 * Channel Gateway CLI Entry Point
 *
 * This module provides a command-line interface for managing message delivery through
 * the channel gateway. It supports sending messages, querying delivery status, managing
 * gateway targets, and handling message retries and failures.
 *
 * Environment Variables (via loadChannelGatewayEnv):
 *   - AA_DB_PATH: Optional database path for persistent storage
 *   - AA_CHANNEL_GATEWAY_ACTION: Operation to perform - send, pending, status, targets, retry, fail
 *   - AA_CHANNEL_GATEWAY_CHANNEL: Target channel (telegram, slack, webhook)
 *   - AA_CHANNEL_GATEWAY_TARGET_ID: Specific target identifier
 *   - AA_CHANNEL_GATEWAY_QUERY: Query to resolve target
 *   - AA_MESSAGE: Message text to send
 *   - AA_DELIVERY_MESSAGE_ID: Message ID for status/retry/fail operations
 *
 * Actions:
 *   - send: Send a message through the gateway
 *   - pending: List pending delivery messages
 *   - status: Get delivery receipt for a message
 *   - targets: List available gateway targets
 *   - retry: Retry a failed delivery
 *   - fail: Mark a delivery as permanently failed
 *
 * @see {@link docs_zh/contracts/channel_gateway_contract.md} for gateway contract
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for gateway terminology
 */

import { requireSqliteAuthoritativeStorageBackend, withCliStorage } from "./authoritative-storage.js";
import { ChannelGatewayService } from "../../platform/five-plane-interface/channel-gateway/channel-gateway-service.js";
import { GatewayTargetDirectoryService } from "../../platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import { ChannelGatewayDeliveryService } from "../../platform/five-plane-interface/channel-gateway/channel-gateway-delivery-service.js";
import { CHANNEL_DELIVERY_DDL } from "../../platform/five-plane-interface/channel-gateway/channel-gateway-delivery-support.js";
import { GatewayStorageAdapter } from "../../platform/five-plane-interface/channel-gateway/storage-adapter.js";
import { loadChannelGatewayEnv } from "../../platform/five-plane-control-plane/config-center/channel-gateway-env.js";

// Load configuration from environment
const envConfig = loadChannelGatewayEnv();
const result = await withCliStorage(async (storage) => {
  const sqliteDb = requireSqliteAuthoritativeStorageBackend(storage);
  sqliteDb.connection.exec(CHANNEL_DELIVERY_DDL);
  const store = storage.store;
  const gatewayStorage = new GatewayStorageAdapter(store);
  const targets = new GatewayTargetDirectoryService(gatewayStorage);
  const deliveryService = new ChannelGatewayDeliveryService(sqliteDb);
  const service = new ChannelGatewayService(gatewayStorage, targets, {
    fetchImpl: globalThis.fetch,
    ...envConfig.gateway,
    deliveryService,
  });

  if (envConfig.action === "send") {
    return service.sendMessage({
      text: envConfig.message!,
      ...(envConfig.channel ? { channel: envConfig.channel } : {}),
      ...(envConfig.targetId ? { targetId: envConfig.targetId } : {}),
      ...(envConfig.query ? { query: envConfig.query } : {}),
    });
  }
  if (envConfig.action === "pending") {
    return { pending: deliveryService.getPendingDeliveries(100) };
  }
  if (envConfig.action === "status") {
    const messageId = envConfig.deliveryMessageId!;
    const receipt = deliveryService.getDeliveryReceipt(messageId);
    return receipt == null ? { error: "message_not_found", messageId } : receipt;
  }
  if (envConfig.action === "targets") {
    return { targets: targets.listTargets({ limit: 50 }) };
  }
  if (envConfig.action === "retry") {
    const messageId = envConfig.deliveryMessageId!;
    const receipt = deliveryService.getDeliveryReceipt(messageId);
    if (!receipt) {
      return { error: "message_not_found", messageId };
    }
    deliveryService.recordAttempt(messageId, (receipt.attempts + 1), "retrying");
    return { messageId, action: "retry_queued", attempts: receipt.attempts + 1 };
  }
  if (envConfig.action === "fail") {
    const messageId = envConfig.deliveryMessageId!;
    deliveryService.markPermanentFailure(messageId, envConfig.failureReason);
    return { messageId, action: "marked_failed", reason: envConfig.failureReason };
  }
  return { error: "unknown_action", action: envConfig.action, available: ["send", "pending", "status", "targets", "retry", "fail"] };
}, { dbPath: envConfig.dbPath });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
