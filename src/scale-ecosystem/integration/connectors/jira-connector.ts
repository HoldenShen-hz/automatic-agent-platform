import type { ConnectorExecutionRequest, ConnectorExecutionResult } from "../connector-runtime/index.js";

const JIRA_CAPABILITIES = ["create_issue", "search_issue"] as const;

export class JiraConnector {
  public listCapabilities(): readonly string[] {
    return JIRA_CAPABILITIES;
  }

  public supportsCapability(capability: string): boolean {
    return JIRA_CAPABILITIES.includes(capability as (typeof JIRA_CAPABILITIES)[number]);
  }

  private buildResult(request: ConnectorExecutionRequest, supported: boolean): ConnectorExecutionResult {
    return {
      connectorId: request.connectorId,
      success: supported,
      status: supported ? "succeeded" : "failed",
    };
  }

  public execute(request: ConnectorExecutionRequest): ConnectorExecutionResult {
    const supported = this.supportsCapability(request.capability);
    return this.buildResult(request, supported);
  }
}
