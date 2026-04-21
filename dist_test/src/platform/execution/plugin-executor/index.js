/**
 * Plugin Executor - Entry Point
 *
 * Re-exports PluginExecutionService (legacy) for backward compatibility,
 * and the new PluginExecutorService with full lifecycle management.
 */
import { ValidationError } from "../../contracts/errors.js";
// ─── Legacy PluginExecutionService ──────────────────────────────────────────
export class PluginExecutionService {
    plugins = new Map();
    register(plugin) {
        this.plugins.set(plugin.pluginId, plugin);
    }
    async execute(request) {
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
    listPlugins() {
        return [...this.plugins.values()];
    }
}
// ─── New PluginExecutorService ───────────────────────────────────────────────
export { PluginExecutorService, } from "./plugin-executor.service.js";
// ─── Scoped External Access Sandbox ─────────────────────────────────────────
export { ScopedExternalAccessSandbox, createScopedExternalAccessSandbox, } from "./scoped-external-access-sandbox.js";
//# sourceMappingURL=index.js.map