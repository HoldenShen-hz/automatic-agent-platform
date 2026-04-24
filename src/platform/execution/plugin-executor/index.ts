/**
 * Plugin Executor - Entry Point
 *
 * Re-exports PluginExecutionService (legacy) for backward compatibility,
 * and the new PluginExecutorService with full lifecycle management.
 */

import { ValidationError } from "../../contracts/errors.js";

// ─── Legacy types (backward compatibility) ─────────────────────────────────

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
  execute: (
    request: PluginExecutionRequest,
  ) => PluginExecutionResult | Promise<PluginExecutionResult>;
}

// ─── Legacy PluginExecutionService ──────────────────────────────────────────

export class PluginExecutionService {
  private readonly plugins = new Map<string, PluginRegistration>();

  public register(plugin: PluginRegistration): void {
    this.plugins.set(plugin.pluginId, plugin);
  }

  public async execute(
    request: PluginExecutionRequest,
  ): Promise<PluginExecutionResult> {
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

// ─── New PluginExecutorService ───────────────────────────────────────────────

export {
  PluginExecutorService,
  type ExecutionContext,
  type ExecutionResult,
  type PluginExecutorOptions,
  type SandboxTier,
} from "./plugin-executor.service.js";

// ─── Scoped External Access Sandbox ─────────────────────────────────────────

export {
  ScopedExternalAccessSandbox,
  createScopedExternalAccessSandbox,
  type ScopedExternalAccessConfig,
  type ExternalAccessRequest,
  type ExternalAccessResponse,
  type DomainRateLimit,
} from "./scoped-external-access-sandbox.js";

// ─── Browser Executor ──────────────────────────────────────────────────────

export {
  AdapterExecutor,
  type AdapterDescriptor,
  type AdapterExecutionContext,
  type AdapterExecutionRequest,
  type AdapterExecutionResult,
  type AdapterExecutorOptions,
  type AdapterProtocol,
  type AdapterRetryPolicy,
} from "./adapter-executor.js";

export {
  BrowserExecutor,
  createBrowserExecutor,
  type BrowserAction,
  type BrowserExecutionContext,
  type BrowserExecutionResult,
  type BrowserNavigationOptions,
  type BrowserClickOptions,
  type BrowserInputOptions,
  type BrowserEvaluateOptions,
  type BrowserScreenshotOptions,
  type BrowserWaitForSelectorOptions,
  type BrowserGetAttributeOptions,
  type BrowserScrollOptions,
  type BrowserExecutorOptions,
} from "./browser-executor.js";
