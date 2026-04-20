import { ValidationError } from "../../contracts/errors.js";

export interface PluginExecutionRequest {
  pluginId: string;
  action: string;
  tenantId: string | null;
  payload: Record<string, unknown>;
}

export interface PluginExecutionResult {
  pluginId: string;
  action: string;
  status: "ok" | "rejected";
  output: Record<string, unknown>;
}

export interface PluginRegistration {
  pluginId: string;
  actions: string[];
  execute: (request: PluginExecutionRequest) => PluginExecutionResult | Promise<PluginExecutionResult>;
}

export class PluginExecutionService {
  private readonly plugins = new Map<string, PluginRegistration>();

  public register(plugin: PluginRegistration): void {
    this.plugins.set(plugin.pluginId, plugin);
  }

  public async execute(request: PluginExecutionRequest): Promise<PluginExecutionResult> {
    const plugin = this.plugins.get(request.pluginId);
    if (plugin == null) {
      throw new ValidationError("plugin_executor.plugin_not_found", "Plugin is not registered.", {
        details: { pluginId: request.pluginId },
      });
    }
    if (!plugin.actions.includes(request.action)) {
      throw new ValidationError("plugin_executor.action_not_allowed", "Plugin action is not registered.", {
        details: { pluginId: request.pluginId, action: request.action },
      });
    }
    return plugin.execute(request);
  }

  public listPlugins(): PluginRegistration[] {
    return [...this.plugins.values()];
  }
}

// Re-export the new PluginExecutorService as well
export { PluginExecutorService } from "./plugin-executor.service.js";
export type { ExecutionContext, ExecutionResult, PluginExecutorOptions } from "./plugin-executor.service.js";