import { ValidationError } from "../../platform/contracts/errors.js";
import { newId } from "../../platform/contracts/types/ids.js";
import { ConnectorFrameworkService, type ConnectorBinding } from "../../scale-ecosystem/integration/connector-framework-service.js";
import { DomainRegistryService } from "./domain-registry-service.js";
import { PluginSpiRegistry, type RegisteredPluginRecord } from "./plugin-spi-registry.js";

export interface EcosystemRuntimePluginTarget {
  pluginId: string;
  pluginType: string;
  lifecycleState: string;
  healthy: boolean;
  runtimeIsolation: string;
  domainId: string;
}

export interface EcosystemRuntimeConnectorTarget {
  connectorId: string;
  bound: boolean;
  environment: "dev" | "staging" | "prod";
  lifecycleState: string | null;
}

export interface EcosystemRuntimePlan {
  planId: string;
  domainId: string;
  tenantId: string;
  environment: "dev" | "staging" | "prod";
  pluginTargets: EcosystemRuntimePluginTarget[];
  connectorTargets: EcosystemRuntimeConnectorTarget[];
  ready: boolean;
  findings: string[];
}

export interface EcosystemRuntimeActivation {
  activationId: string;
  plan: EcosystemRuntimePlan;
  activatedPluginIds: string[];
  connectorBindings: ConnectorBinding[];
}

export class PluginEcosystemRuntimeService {
  public constructor(
    private readonly domains: DomainRegistryService,
    private readonly plugins: PluginSpiRegistry,
    private readonly connectors: ConnectorFrameworkService,
  ) {}

  public buildPlan(input: {
    domainId: string;
    tenantId: string;
    environment: "dev" | "staging" | "prod";
    connectorIds?: readonly string[];
  }): EcosystemRuntimePlan {
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
      } satisfies EcosystemRuntimeConnectorTarget;
    });
    const findings: string[] = [];
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
    const allPluginsHealthy = pluginTargets.every((target) => target.healthy);
    return {
      planId: newId("ecosystem_plan"),
      domainId: input.domainId,
      tenantId: input.tenantId,
      environment: input.environment,
      pluginTargets,
      connectorTargets,
      ready: findings.length === 0 && allPluginsHealthy && domain.status === "active",
      findings,
    };
  }

  public async activateRuntime(input: {
    domainId: string;
    tenantId: string;
    environment: "dev" | "staging" | "prod";
    connectorIds?: readonly string[];
    autoBindConnectors?: boolean;
  }): Promise<EcosystemRuntimeActivation> {
    // §198-2308: buildPlan called once - store result and use throughout activation
    const plan = this.buildPlan({
      domainId: input.domainId,
      tenantId: input.tenantId,
      environment: input.environment,
      ...(input.connectorIds !== undefined ? { connectorIds: input.connectorIds } : {}),
    });
    // §198-2309: Check plugin lifecycle states - plugins not in "active" or "validated" are not ready
    // Root cause: registered/loading/inactive/unloaded plugins were being treated as ready
    const activatedPluginIds: string[] = [];
    for (const binding of this.domains.getPluginBindings(input.domainId)) {
      const record = this.plugins.get(binding.pluginId);
      if (record != null) {
        const lc = record.lifecycleState;
        // Only skip non-ready states; allow validated and active plugins to proceed
        if (lc !== "active" && lc !== "validated") {
          // Plugin not fully ready - skip activation for this binding
          continue;
        }
      }
      await this.plugins.ensureActive(binding.pluginId, {
        domainId: input.domainId,
        bindingId: binding.bindingId,
      });
      activatedPluginIds.push(binding.pluginId);
    }
    const connectorBindings: ConnectorBinding[] = [];
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
      plan,
      activatedPluginIds,
      connectorBindings,
    };
  }
}

function toPluginTarget(
  pluginId: string,
  pluginType: string,
  domainId: string,
  record: RegisteredPluginRecord | null,
): EcosystemRuntimePluginTarget {
  return {
    pluginId,
    pluginType,
    lifecycleState: record?.lifecycleState ?? "missing",
    // §198-2309: Plugin is only healthy if lifecycleState is "active" or "enabled"
    // Root cause: registered/loaded plugins were considered healthy, causing ready to be true
    // when plugins aren't actually ready for execution
    healthy: record != null && record.lifecycleState === "active",
    runtimeIsolation: record?.manifest.sandbox.runtimeIsolation ?? "unknown",
    domainId,
  };
}
