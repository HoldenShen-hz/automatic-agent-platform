import type { ConnectorExecutionRequest, ConnectorExecutionResult } from "../connector-runtime/index.js";

export class SlackConnector {
  public execute(request: ConnectorExecutionRequest): ConnectorExecutionResult {
    return {
      connectorId: request.connectorId,
      success: request.capability === "send_message" || request.capability === "open_modal",
      status: request.capability === "send_message" || request.capability === "open_modal" ? "succeeded" : "failed",
    };
  }
}
