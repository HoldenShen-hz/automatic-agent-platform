import type { ConnectorExecutionRequest, ConnectorExecutionResult } from "../connector-runtime/index.js";

export class ServiceNowConnector {
  public execute(request: ConnectorExecutionRequest): ConnectorExecutionResult {
    return {
      connectorId: request.connectorId,
      success: request.capability === "create_incident" || request.capability === "update_ticket",
      status: request.capability === "create_incident" || request.capability === "update_ticket" ? "succeeded" : "failed",
    };
  }
}
