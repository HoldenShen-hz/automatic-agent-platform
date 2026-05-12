import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * @fileoverview Bootstrap Configuration Validation Tests
 *
 * Validates that config/bootstrap/default.json contains all required bootstrap
 * guarantees as specified in the platform architecture spec:
 * - Strict dependency ordering for services
 * - Health check gates before activation
 * - Layer declarations for proper initialization hierarchy
 *
 * Covers audit item R33-17.
 */

interface BootstrapConfig {
  appName: string;
  phase: string;
  stableCoreEnabled: boolean;
  dependencyOrder: string[];
  readinessGates: string[];
  degradationPolicy: {
    onReadinessFailure: string;
    allowSummaryMode: boolean;
  };
  healthCheckTimeoutMs: number;
  readinessProbe: {
    initialDelayMs: number;
    intervalMs: number;
    timeoutMs: number;
    failureThreshold: number;
  };
  hotReload: {
    enabled: boolean;
    watchPaths: string[];
    debounceMs: number;
    excludePatterns: string[];
    reloadStrategies: {
      config: string;
      domain: string;
      plugin: string;
    };
  };
  impactAnalysis: {
    enabled: boolean;
    analysisDepth: string;
    scopeLimits: {
      maxModules: number;
      maxDepth: number;
    };
    changeDetection: {
      fileHashAlgorithm: string;
      watchExtensions: string[];
    };
    reporting: {
      format: string;
      includeCallGraph: boolean;
      includeDependencyChain: boolean;
    };
    thresholds: {
      maxImpactScore: number;
      maxAffectedServices: number;
      maxCriticalPathLength: number;
    };
  };
  canaryDeployment: {
    enabled: boolean;
    strategy: string;
    initialPercentage: number;
    maxPercentage: number;
    stepPercentage: number;
    evaluationPeriodMs: number;
    autoPromote: boolean;
    autoRollback: boolean;
    metrics: {
      errorRateThreshold: number;
      latencyP99ThresholdMs: number;
      successRateThreshold: number;
    };
    targets: {
      rings: string[];
      excludedRegions: string[];
    };
  };
  gateHierarchy: {
    bootstrap: {
      l0: string[];
      l1: string[];
      l2: string[];
      l3: string[];
      l4: string[];
    };
  };
  healthCheckGates: Record<string, string[]>;
}

const CONFIG_PATH = resolve(process.cwd(), "config/bootstrap/default.json");

function loadBootstrapConfig(): BootstrapConfig {
  const content = readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(content);
}

test("bootstrap config exists and is valid JSON", () => {
  const config = loadBootstrapConfig();
  assert.ok(config, "Bootstrap config should be loadable");
  assert.equal(typeof config, "object", "Bootstrap config should be an object");
});

test("bootstrap config has dependencyOrder array with all required layers", () => {
  const config = loadBootstrapConfig();
  assert.ok(
    Array.isArray(config.dependencyOrder),
    "dependencyOrder must be an array"
  );

  // All required layers must be present in dependency order
  const requiredLayers = [
    "bootstrap",
    "platform",
    "domains",
    "interaction",
    "org-governance",
    "scale-ecosystem",
    "ops-maturity",
    "apps",
    "plugins",
    "sdk",
  ];

  for (const layer of requiredLayers) {
    assert.ok(
      config.dependencyOrder.includes(layer),
      `Layer "${layer}" must be present in dependencyOrder`
    );
  }
});

test("dependencyOrder follows strict topological ordering per spec", () => {
  const config = loadBootstrapConfig();
  const order = config.dependencyOrder;

  // Verify bootstrap comes first
  assert.ok(
    order.indexOf("bootstrap") < order.indexOf("platform"),
    "bootstrap must come before platform"
  );

  // Verify platform comes before domain layers
  assert.ok(
    order.indexOf("platform") < order.indexOf("domains"),
    "platform must come before domains"
  );
  assert.ok(
    order.indexOf("platform") < order.indexOf("interaction"),
    "platform must come before interaction"
  );

  // Verify domain layers come before governance/scale/ops layers
  assert.ok(
    order.indexOf("domains") < order.indexOf("org-governance"),
    "domains must come before org-governance"
  );
  assert.ok(
    order.indexOf("domains") < order.indexOf("scale-ecosystem"),
    "domains must come before scale-ecosystem"
  );
  assert.ok(
    order.indexOf("domains") < order.indexOf("ops-maturity"),
    "domains must come before ops-maturity"
  );

  // Verify apps/plugins/sdk come last (after all core layers)
  const lastCoreIndex = Math.max(
    order.indexOf("org-governance"),
    order.indexOf("scale-ecosystem"),
    order.indexOf("ops-maturity")
  );
  assert.ok(
    order.indexOf("apps") > lastCoreIndex,
    "apps must come after all core layers"
  );
  assert.ok(
    order.indexOf("plugins") > lastCoreIndex,
    "plugins must come after all core layers"
  );
  assert.ok(
    order.indexOf("sdk") > lastCoreIndex,
    "sdk must come after all core layers"
  );
});

test("bootstrap config has readinessGates with required gates", () => {
  const config = loadBootstrapConfig();
  assert.ok(
    Array.isArray(config.readinessGates),
    "readinessGates must be an array"
  );

  // Required readiness gates per spec
  const requiredGates = [
    "config_loaded",
    "service_registry_ready",
    "startup_targets_registered",
  ];

  for (const gate of requiredGates) {
    assert.ok(
      config.readinessGates.includes(gate),
      `Required readiness gate "${gate}" must be present`
    );
  }
});

test("bootstrap config has healthCheckTimeoutMs configured", () => {
  const config = loadBootstrapConfig();
  assert.ok(
    typeof config.healthCheckTimeoutMs === "number" && config.healthCheckTimeoutMs > 0,
    "healthCheckTimeoutMs must be a positive number"
  );
});

test("bootstrap config has readinessProbe configured", () => {
  const config = loadBootstrapConfig();
  assert.ok(config.readinessProbe, "readinessProbe must be configured");

  const probe = config.readinessProbe;
  assert.ok(typeof probe.initialDelayMs === "number", "initialDelayMs must be set");
  assert.ok(typeof probe.intervalMs === "number", "intervalMs must be set");
  assert.ok(typeof probe.timeoutMs === "number", "timeoutMs must be set");
  assert.ok(typeof probe.failureThreshold === "number", "failureThreshold must be set");
  assert.ok(probe.failureThreshold > 0, "failureThreshold must be positive");
});

test("bootstrap config has degradationPolicy configured", () => {
  const config = loadBootstrapConfig();
  assert.ok(config.degradationPolicy, "degradationPolicy must be configured");

  const policy = config.degradationPolicy;
  assert.equal(
    policy.onReadinessFailure,
    "fail_closed",
    "onReadinessFailure must be fail_closed per spec"
  );
});

test("bootstrap config has gateHierarchy with layer declarations", () => {
  const config = loadBootstrapConfig();
  assert.ok(config.gateHierarchy, "gateHierarchy must be configured");
  assert.ok(
    config.gateHierarchy.bootstrap,
    "gateHierarchy.bootstrap must be configured"
  );

  const hierarchy = config.gateHierarchy.bootstrap;

  // L0: bootstrap layer
  assert.ok(
    Array.isArray(hierarchy.l0) && hierarchy.l0.includes("bootstrap"),
    "L0 must contain bootstrap"
  );

  // L1: platform layer
  assert.ok(
    Array.isArray(hierarchy.l1) && hierarchy.l1.includes("platform"),
    "L1 must contain platform"
  );

  // L2: domains and interaction
  assert.ok(
    Array.isArray(hierarchy.l2) && hierarchy.l2.includes("domains"),
    "L2 must contain domains"
  );

  // L3: org-governance, scale-ecosystem, ops-maturity
  assert.ok(
    Array.isArray(hierarchy.l3) && hierarchy.l3.includes("org-governance"),
    "L3 must contain org-governance"
  );

  // L4: apps, plugins, sdk
  assert.ok(
    Array.isArray(hierarchy.l4) && hierarchy.l4.includes("apps"),
    "L4 must contain apps"
  );
});

test("bootstrap config has healthCheckGates per layer", () => {
  const config = loadBootstrapConfig();
  assert.ok(config.healthCheckGates, "healthCheckGates must be configured");

  const gates = config.healthCheckGates;

  // Each layer group must have at least one health check gate
  assert.ok(
    Array.isArray(gates.bootstrap_l0) && gates.bootstrap_l0.length > 0,
    "bootstrap_l0 gate must have at least one check"
  );
  assert.ok(
    Array.isArray(gates.platform_l1) && gates.platform_l1.length > 0,
    "platform_l1 gate must have at least one check"
  );
  assert.ok(
    Array.isArray(gates.domains_l2) && gates.domains_l2.length > 0,
    "domains_l2 gate must have at least one check"
  );
  assert.ok(
    Array.isArray(gates.l3_services) && gates.l3_services.length > 0,
    "l3_services gate must have at least one check"
  );
  assert.ok(
    Array.isArray(gates.l4_services) && gates.l4_services.length > 0,
    "l4_services gate must have at least one check"
  );
});

test("bootstrap config has impactAnalysis configured for change detection", () => {
  const config = loadBootstrapConfig();
  assert.ok(config.impactAnalysis, "impactAnalysis must be configured");

  const analysis = config.impactAnalysis;
  assert.equal(analysis.enabled, true, "impactAnalysis must be enabled");
  assert.ok(analysis.analysisDepth, "analysisDepth must be specified");

  // Verify change detection is configured
  assert.ok(
    analysis.changeDetection?.fileHashAlgorithm,
    "fileHashAlgorithm must be specified"
  );
  assert.ok(
    Array.isArray(analysis.changeDetection?.watchExtensions),
    "watchExtensions must be an array"
  );
});

test("bootstrap config has canaryDeployment configured", () => {
  const config = loadBootstrapConfig();
  assert.ok(config.canaryDeployment, "canaryDeployment must be configured");

  const canary = config.canaryDeployment;
  assert.equal(canary.enabled, true, "canaryDeployment must be enabled");
  assert.ok(canary.strategy, "strategy must be specified");
  assert.ok(
    typeof canary.initialPercentage === "number" && canary.initialPercentage > 0,
    "initialPercentage must be a positive number"
  );
  assert.ok(
    canary.evaluationPeriodMs > 0,
    "evaluationPeriodMs must be positive"
  );
  assert.ok(
    typeof canary.autoRollback === "boolean",
    "autoRollback must be specified"
  );
});

test("bootstrap config specifies stableCoreEnabled for core stability", () => {
  const config = loadBootstrapConfig();
  assert.equal(
    config.stableCoreEnabled,
    true,
    "stableCoreEnabled must be true for production bootstrap"
  );
});
