/**
 * @fileoverview Gateway Routes - Gateway target and message endpoints.
 *
 * Routes:
 * - GET /v1/gateway/targets
 * - GET /v1/gateway/targets/resolve
 * - POST /v1/gateway/messages/send
 * - POST /v1/gateway/webhooks/receive
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */
import type { RouteDefinition } from "./types.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { GatewayTargetDirectoryService } from "../../channel-gateway/gateway-target-directory-service.js";
import type { ChannelGatewayService } from "../../channel-gateway/channel-gateway-service.js";
import type { ChannelGatewayDeliveryService } from "../../channel-gateway/channel-gateway-delivery-service.js";
export interface GatewayRouteDeps {
    authService: ApiAuthService | null;
    gatewayTargetDirectoryService: GatewayTargetDirectoryService | null;
    channelGatewayService: ChannelGatewayService | null;
    channelGatewayDeliveryService: ChannelGatewayDeliveryService | null;
    webhookSecret: string | null;
}
export declare function createGatewayRoutes(deps: GatewayRouteDeps): RouteDefinition[];
