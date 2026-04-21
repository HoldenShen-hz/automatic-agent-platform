import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { ConnectorManifestSchema, listEnabledConnectors, } from "./connector-registry/index.js";
import { buildConnectorExecutionKey, } from "./connector-runtime/index.js";
import { summarizeConnectorHealth, } from "./health-monitor/index.js";
export class ConnectorFrameworkService {
    manifests = new Map();
    bindings = new Map();
    health = new Map();
    register(manifest) {
        const parsed = ConnectorManifestSchema.parse(manifest);
        this.manifests.set(parsed.connectorId, parsed);
        return parsed;
    }
    bind(connectorId, tenantId, environment, boundAt = nowIso()) {
        const manifest = this.requireManifest(connectorId);
        if (environment === "prod" && manifest.lifecycleState !== "verified" && manifest.lifecycleState !== "enabled") {
            throw new Error(`connector_framework.prod_requires_verified:${connectorId}`);
        }
        const binding = {
            bindingId: newId("connector_binding"),
            connectorId,
            tenantId,
            environment,
            boundAt,
        };
        this.bindings.set(connectorId, [...(this.bindings.get(connectorId) ?? []), binding]);
        return binding;
    }
    recordHealth(report) {
        this.requireManifest(report.connectorId);
        this.health.set(report.connectorId, [...(this.health.get(report.connectorId) ?? []), report]);
        return report;
    }
    execute(request, options) {
        const manifest = this.requireManifest(request.connectorId);
        const executionKey = buildConnectorExecutionKey(request);
        if (options.environment === "prod" && manifest.lifecycleState !== "verified" && manifest.lifecycleState !== "enabled") {
            throw new Error(`connector_framework.prod_requires_verified:${request.connectorId}`);
        }
        if (options.eventType != null && !manifest.supportedEvents.includes(options.eventType)) {
            return {
                connectorId: request.connectorId,
                success: false,
                status: "failed",
                executionKey,
                executedAt: options.executedAt ?? nowIso(),
            };
        }
        const reports = this.health.get(request.connectorId) ?? [];
        const health = summarizeConnectorHealth(reports);
        if (health === "failed") {
            return {
                connectorId: request.connectorId,
                success: false,
                status: "failed",
                executionKey,
                executedAt: options.executedAt ?? nowIso(),
            };
        }
        return {
            connectorId: request.connectorId,
            success: true,
            status: health === "degraded" ? "deferred" : "succeeded",
            executionKey,
            executedAt: options.executedAt ?? nowIso(),
        };
    }
    listEnabled() {
        const enabledIds = new Set(listEnabledConnectors([...this.manifests.values()]).map((item) => item.connectorId));
        return [...this.manifests.values()].filter((item) => enabledIds.has(item.connectorId));
    }
    getManifest(connectorId) {
        return this.manifests.get(connectorId) ?? null;
    }
    listBindings(options = {}) {
        const allBindings = [...this.bindings.values()].flatMap((items) => items);
        return allBindings.filter((binding) => {
            if (options.connectorId != null && binding.connectorId !== options.connectorId) {
                return false;
            }
            if (options.tenantId != null && binding.tenantId !== options.tenantId) {
                return false;
            }
            if (options.environment != null && binding.environment !== options.environment) {
                return false;
            }
            return true;
        });
    }
    requireManifest(connectorId) {
        const manifest = this.manifests.get(connectorId);
        if (manifest == null) {
            throw new Error(`connector_framework.connector_not_found:${connectorId}`);
        }
        return manifest;
    }
}
//# sourceMappingURL=connector-framework-service.js.map