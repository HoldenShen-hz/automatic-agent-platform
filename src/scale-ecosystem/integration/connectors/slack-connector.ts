import type { ConnectorExecutionRequest, ConnectorExecutionResult } from "../connector-runtime/index.js";

const SLACK_CAPABILITIES = ["send_message", "open_modal"] as const;

export class SlackConnector {
  public listCapabilities(): readonly string[] {
    return SLACK_CAPABILITIES;
  }

  public supportsCapability(capability: string): boolean {
    return SLACK_CAPABILITIES.includes(capability as (typeof SLACK_CAPABILITIES)[number]);
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
