import type { ConnectorExecutionRequest, ConnectorExecutionResult } from "../connector-runtime/index.js";

export class GitHubConnector {
  public execute(request: ConnectorExecutionRequest): ConnectorExecutionResult {
    return {
      connectorId: request.connectorId,
      success: request.capability === "create_pr" || request.capability === "create_issue" || request.capability === "dispatch_workflow",
      status: request.capability === "create_pr" || request.capability === "create_issue" || request.capability === "dispatch_workflow"
        ? "succeeded"
        : "failed",
    };
  }
}
