import type { ConnectorExecutionRequest, ConnectorExecutionResult } from "../connector-runtime/index.js";

const SERVICENOW_CAPABILITIES = ["create_incident", "update_ticket"] as const;

export class ServiceNowConnector {
  public listCapabilities(): readonly string[] {
    return SERVICENOW_CAPABILITIES;
  }

  public supportsCapability(capability: string): boolean {
    return SERVICENOW_CAPABILITIES.includes(capability as (typeof SERVICENOW_CAPABILITIES)[number]);
  }

  private buildResult(request: ConnectorExecutionRequest, supported: boolean): ConnectorExecutionResult {
    const hasSecrets = Array.isArray(request.secretBindings) && request.secretBindings.length > 0;
    const hasPolicy = typeof request.policyRef === "string" && request.policyRef.trim().length > 0;
    return {
      connectorId: request.connectorId,
      success: supported && hasSecrets && hasPolicy,
      status: supported && hasSecrets && hasPolicy ? "succeeded" : "failed",
    };
  }

  public execute(request: ConnectorExecutionRequest): ConnectorExecutionResult {
    const supported = this.supportsCapability(request.capability);
    return this.buildResult(request, supported);
  }
}
