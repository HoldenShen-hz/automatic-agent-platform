import type { ConnectorExecutionRequest, ConnectorExecutionResult } from "../connector-runtime/index.js";

export class JiraConnector {
  public execute(request: ConnectorExecutionRequest): ConnectorExecutionResult {
    return {
      connectorId: request.connectorId,
      success: request.capability === "create_issue" || request.capability === "search_issue",
      status: request.capability === "create_issue" || request.capability === "search_issue" ? "succeeded" : "failed",
    };
  }
}
