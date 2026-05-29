/**
 * Bootstrap Configuration Tests
 *
 * Tests for config/bootstrap/default.json configuration options including
 * hot reload, impact analysis, and canary deployment configuration.
 *
 * Issue 1991: Missing hot reload/impact analysis/canary configuration
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadBootstrapConfig() {
  const configPath = join(process.cwd(), "config/bootstrap/default.json");
  return JSON.parse(readFileSync(configPath, "utf8"));
}

test("bootstrap config contains hot reload configuration", () => {
  const config = loadBootstrapConfig();

  assert.ok(config.hotReload, "hotReload configuration should exist");
  assert.equal(config.hotReload.enabled, true, "hotReload.enabled should be true");

  assert.ok(Array.isArray(config.hotReload.watchPaths), "hotReload.watchPaths should be an array");
  assert.ok(config.hotReload.watchPaths.includes("config/"), "should watch config/");
  assert.ok(config.hotReload.watchPaths.includes("src/"), "should watch src/");

  assert.ok(config.hotReload.debounceMs, "hotReload.debounceMs should be defined");
  assert.ok(config.hotReload.debounceMs >= 100, "debounceMs should be at least 100ms");

  assert.ok(Array.isArray(config.hotReload.excludePatterns), "hotReload.excludePatterns should be an array");
  assert.ok(config.hotReload.excludePatterns.includes("node_modules/**"), "should exclude node_modules");

  assert.ok(config.hotReload.reloadStrategies, "hotReload.reloadStrategies should exist");
  assert.equal(config.hotReload.reloadStrategies.config, "incremental");
  assert.equal(config.hotReload.reloadStrategies.domain, "cascade");
  assert.equal(config.hotReload.reloadStrategies.plugin, "isolated");
});

test("bootstrap config contains impact analysis configuration", () => {
  const config = loadBootstrapConfig();

  assert.ok(config.impactAnalysis, "impactAnalysis configuration should exist");
  assert.equal(config.impactAnalysis.enabled, true, "impactAnalysis.enabled should be true");
  assert.equal(config.impactAnalysis.analysisDepth, "comprehensive", "analysisDepth should be comprehensive");

  assert.ok(config.impactAnalysis.scopeLimits, "impactAnalysis.scopeLimits should exist");
  assert.ok(config.impactAnalysis.scopeLimits.maxModules >= 100, "maxModules should be at least 100");
  assert.ok(config.impactAnalysis.scopeLimits.maxDepth >= 5, "maxDepth should be at least 5");

  assert.ok(config.impactAnalysis.changeDetection, "impactAnalysis.changeDetection should exist");
  assert.equal(config.impactAnalysis.changeDetection.fileHashAlgorithm, "sha256");
  assert.ok(Array.isArray(config.impactAnalysis.changeDetection.watchExtensions), "watchExtensions should be an array");

  assert.ok(config.impactAnalysis.reporting, "impactAnalysis.reporting should exist");
  assert.equal(config.impactAnalysis.reporting.format, "detailed");
  assert.equal(config.impactAnalysis.reporting.includeCallGraph, true);
  assert.equal(config.impactAnalysis.reporting.includeDependencyChain, true);

  assert.ok(config.impactAnalysis.thresholds, "impactAnalysis.thresholds should exist");
  assert.ok(config.impactAnalysis.thresholds.maxImpactScore >= 50, "maxImpactScore should be at least 50");
  assert.ok(config.impactAnalysis.thresholds.maxAffectedServices >= 10, "maxAffectedServices should be at least 10");
  assert.ok(config.impactAnalysis.thresholds.maxCriticalPathLength >= 10, "maxCriticalPathLength should be at least 10");
});

test("bootstrap config contains canary deployment configuration", () => {
  const config = loadBootstrapConfig();

  assert.ok(config.canaryDeployment, "canaryDeployment configuration should exist");
  assert.equal(config.canaryDeployment.enabled, true, "canaryDeployment.enabled should be true");
  assert.equal(config.canaryDeployment.strategy, "gradual_rollout", "strategy should be gradual_rollout");

  assert.ok(typeof config.canaryDeployment.initialPercentage === "number", "initialPercentage should be a number");
  assert.ok(config.canaryDeployment.initialPercentage > 0 && config.canaryDeployment.initialPercentage <= 100);

  assert.ok(typeof config.canaryDeployment.maxPercentage === "number", "maxPercentage should be a number");
  assert.ok(config.canaryDeployment.maxPercentage > config.canaryDeployment.initialPercentage);

  assert.ok(typeof config.canaryDeployment.stepPercentage === "number", "stepPercentage should be a number");
  assert.ok(config.canaryDeployment.stepPercentage > 0);

  assert.ok(config.canaryDeployment.evaluationPeriodMs >= 60000, "evaluationPeriodMs should be at least 60s");

  assert.equal(typeof config.canaryDeployment.autoPromote === "boolean", true, "autoPromote should be boolean");
  assert.equal(typeof config.canaryDeployment.autoRollback === "boolean", true, "autoRollback should be boolean");

  assert.ok(config.canaryDeployment.metrics, "canaryDeployment.metrics should exist");
  assert.ok(config.canaryDeployment.metrics.errorRateThreshold > 0, "errorRateThreshold should be positive");
  assert.ok(config.canaryDeployment.metrics.latencyP99ThresholdMs > 0, "latencyP99ThresholdMs should be positive");
  assert.ok(config.canaryDeployment.metrics.successRateThreshold > 0 && config.canaryDeployment.metrics.successRateThreshold <= 1);

  assert.ok(config.canaryDeployment.targets, "canaryDeployment.targets should exist");
  assert.ok(Array.isArray(config.canaryDeployment.targets.rings), "rings should be an array");
  assert.ok(config.canaryDeployment.targets.rings.includes("ring_1"), "should include ring_1");
  assert.ok(Array.isArray(config.canaryDeployment.targets.excludedRegions), "excludedRegions should be an array");
});

test("bootstrap config maintains existing required fields", () => {
  const config = loadBootstrapConfig();

  // Required existing fields
  assert.equal(config.appName, "automatic-agent-platform");
  assert.equal(config.phase, "ring_1");
  assert.equal(config.stableCoreEnabled, true);

  assert.ok(Array.isArray(config.dependencyOrder), "dependencyOrder should exist");
  assert.ok(config.dependencyOrder.includes("bootstrap"));
  assert.ok(config.dependencyOrder.includes("platform"));

  assert.ok(Array.isArray(config.readinessGates), "readinessGates should exist");
  assert.ok(config.readinessGates.includes("config_loaded"));

  assert.ok(config.degradationPolicy, "degradationPolicy should exist");
  assert.equal(config.degradationPolicy.onReadinessFailure, "fail_closed");

  assert.ok(config.healthCheckTimeoutMs > 0, "healthCheckTimeoutMs should be positive");
  assert.ok(config.readinessProbe, "readinessProbe should exist");
  assert.equal(config.readinessProbe.failureThreshold, 3);
});

test("hot reload reload strategies cover all major configuration types", () => {
  const config = loadBootstrapConfig();

  const strategies = config.hotReload.reloadStrategies;
  // Should cover config, domain, and plugin at minimum
  assert.ok(strategies.config, "config reload strategy should be defined");
  assert.ok(strategies.domain, "domain reload strategy should be defined");
  assert.ok(strategies.plugin, "plugin reload strategy should be defined");
});

test("impact analysis change detection covers multiple file types", () => {
  const config = loadBootstrapConfig();

  const extensions = config.impactAnalysis.changeDetection.watchExtensions;
  assert.ok(extensions.includes(".ts"), "should watch .ts files");
  assert.ok(extensions.includes(".js"), "should watch .js files");
  assert.ok(extensions.includes(".json"), "should watch .json files");
});

test("canary deployment gradual rollout has valid percentage progression", () => {
  const config = loadBootstrapConfig();

  const { initialPercentage, maxPercentage, stepPercentage } = config.canaryDeployment;
  // Initial should be less than max
  assert.ok(initialPercentage < maxPercentage, "initialPercentage should be less than maxPercentage");
  // Step should be positive
  assert.ok(stepPercentage > 0, "stepPercentage should be positive");
  // Max should be achievable from initial with step increments
  const increments = Math.floor((maxPercentage - initialPercentage) / stepPercentage);
  assert.ok(increments >= 1, "should be able to reach maxPercentage from initialPercentage");
});

test("canary metrics thresholds are mutually consistent", () => {
  const config = loadBootstrapConfig();

  const { errorRateThreshold, successRateThreshold } = config.canaryDeployment.metrics;
  // errorRateThreshold should be low (e.g., < 10%)
  assert.ok(errorRateThreshold < 0.1, "errorRateThreshold should be less than 10%");
  // successRateThreshold should be high (e.g., >= 95%)
  assert.ok(successRateThreshold >= 0.9, "successRateThreshold should be at least 90%");
  // Combined they make sense for a healthy system
  assert.ok(errorRateThreshold + successRateThreshold <= 1.0, "error + success rate should not exceed 100%");
});

test("bootstrap config contains gateHierarchy for strict dependency ordering", () => {
  const config = loadBootstrapConfig();

  assert.ok(config.gateHierarchy, "gateHierarchy configuration should exist");
  assert.ok(config.gateHierarchy.bootstrap, "gateHierarchy.bootstrap should exist");

  const levels = config.gateHierarchy.bootstrap;
  assert.ok(Array.isArray(levels.l0), "gateHierarchy.bootstrap.l0 should be an array");
  assert.ok(Array.isArray(levels.l1), "gateHierarchy.bootstrap.l1 should be an array");
  assert.ok(Array.isArray(levels.l2), "gateHierarchy.bootstrap.l2 should be an array");
  assert.ok(Array.isArray(levels.l3), "gateHierarchy.bootstrap.l3 should be an array");
  assert.ok(Array.isArray(levels.l4), "gateHierarchy.bootstrap.l4 should be an array");

  // Levels must be ordered: l0 -> l1 -> l2 -> l3 -> l4
  assert.ok(levels.l0.includes("bootstrap"), "l0 should contain bootstrap");
  assert.ok(levels.l1.includes("platform"), "l1 should contain platform");
  assert.ok(levels.l2.includes("domains"), "l2 should contain domains");
  assert.ok(levels.l3.includes("org-governance"), "l3 should contain org-governance");
  assert.ok(levels.l4.includes("apps"), "l4 should contain apps");

  // No duplicates across levels
  const allIds = [...levels.l0, ...levels.l1, ...levels.l2, ...levels.l3, ...levels.l4];
  const uniqueIds = new Set(allIds);
  assert.equal(uniqueIds.size, allIds.length, "gateHierarchy entries must not duplicate across levels");
});

test("bootstrap config contains healthCheckGates for readiness gates", () => {
  const config = loadBootstrapConfig();

  assert.ok(config.healthCheckGates, "healthCheckGates configuration should exist");
  assert.ok(Array.isArray(config.healthCheckGates.bootstrap_l0), "healthCheckGates.bootstrap_l0 should be an array");
  assert.ok(Array.isArray(config.healthCheckGates.platform_l1), "healthCheckGates.platform_l1 should be an array");
  assert.ok(Array.isArray(config.healthCheckGates.domains_l2), "healthCheckGates.domains_l2 should be an array");

  // Bootstrap gate must include config_loaded
  assert.ok(config.healthCheckGates.bootstrap_l0.includes("config_loaded"), "bootstrap_l0 gate must include config_loaded");
  // Platform gate must include service_registry_ready
  assert.ok(config.healthCheckGates.platform_l1.includes("service_registry_ready"), "platform_l1 gate must include service_registry_ready");
  // L3 services should include health and readiness
  assert.ok(config.healthCheckGates.l3_services.includes("health"), "l3_services gate must include health");
  assert.ok(config.healthCheckGates.l3_services.includes("readiness"), "l3_services gate must include readiness");
});
