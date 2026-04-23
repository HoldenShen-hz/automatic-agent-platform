import { ValidationError } from "../../platform/contracts/errors.js";
import { newId } from "../../platform/contracts/types/ids.js";
export class PluginEcosystemRuntimeService {
    domains;
    plugins;
    connectors;
    constructor(domains, plugins, connectors) {
        this.domains = domains;
        this.plugins = plugins;
        this.connectors = connectors;
    }
    buildPlan(input) {
        const domain = this.domains.get(input.domainId);
        if (domain == null) {
            throw new ValidationError("plugin_ecosystem.domain_not_found", "Domain is not registered.", {
                details: { domainId: input.domainId },
            });
        }
        const pluginTargets = this.domains.getPluginBindings(input.domainId).map((binding) => {
            const record = this.plugins.get(binding.pluginId);
            return toPluginTarget(binding.pluginId, binding.pluginType, input.domainId, record);
        });
        const connectorTargets = (input.connectorIds ?? []).map((connectorId) => {
            const manifest = this.connectors.getManifest(connectorId);
            const binding = this.connectors
                .listBindings({ connectorId, tenantId: input.tenantId, environment: input.environment })[0] ?? null;
            return {
                connectorId,
                bound: binding != null,
                environment: input.environment,
                lifecycleState: manifest?.lifecycleState ?? null,
            };
        });
        const findings = [];
        for (const target of pluginTargets) {
            if (!target.healthy) {
                findings.push(`plugin not ready: ${target.pluginId}`);
            }
        }
        for (const target of connectorTargets) {
            if (!target.bound) {
                findings.push(`connector not bound: ${target.connectorId}`);
            }
            if (input.environment === "prod" && target.lifecycleState !== "verified" && target.lifecycleState !== "enabled") {
                findings.push(`connector not prod-ready: ${target.connectorId}`);
            }
        }
        return {
            planId: newId("ecosystem_plan"),
            domainId: input.domainId,
            tenantId: input.tenantId,
            environment: input.environment,
            pluginTargets,
            connectorTargets,
            ready: findings.length === 0 && domain.status === "active",
            findings,
        };
    }
    async activateRuntime(input) {
        const plan = this.buildPlan(input);
        const activatedPluginIds = [];
        for (const binding of this.domains.getPluginBindings(input.domainId)) {
            await this.plugins.ensureActive(binding.pluginId, {
                domainId: input.domainId,
                bindingId: binding.bindingId,
            });
            activatedPluginIds.push(binding.pluginId);
        }
        const connectorBindings = [];
        if (input.autoBindConnectors === true) {
            for (const connectorId of input.connectorIds ?? []) {
                const existing = this.connectors.listBindings({
                    connectorId,
                    tenantId: input.tenantId,
                    environment: input.environment,
                })[0];
                if (existing) {
                    connectorBindings.push(existing);
                    continue;
                }
                connectorBindings.push(this.connectors.bind(connectorId, input.tenantId, input.environment));
            }
        }
        return {
            activationId: newId("ecosystem_activation"),
            plan: this.buildPlan(input),
            activatedPluginIds,
            connectorBindings,
        };
    }
}
function toPluginTarget(pluginId, pluginType, domainId, record) {
    return {
        pluginId,
        pluginType,
        lifecycleState: record?.lifecycleState ?? "missing",
        healthy: record != null && record.lifecycleState !== "disabled" && record.lifecycleState !== "degraded",
        runtimeIsolation: record?.manifest.sandbox.runtimeIsolation ?? "unknown",
        domainId,
    };
}
//# sourceMappingURL=plugin-ecosystem-runtime-service.js.map