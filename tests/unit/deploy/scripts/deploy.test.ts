import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DEPLOY_SCRIPT_PATH = "deploy/scripts/deploy.sh";

test("deploy script exists and is executable", () => {
  assert.ok(existsSync(DEPLOY_SCRIPT_PATH), `Deploy script should exist at ${DEPLOY_SCRIPT_PATH}`);

  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");
  assert.ok(content.includes("#!/usr/bin/env bash"), "Script should have bash shebang");
  assert.ok(
    content.includes("set -euo pipefail"),
    "Script should use strict error handling"
  );
});

test("deploy script supports --dry-run option", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("--dry-run") || content.includes('"${DRY_RUN:-false}"'),
    "Script should support --dry-run option");
  assert.ok(
    content.includes("[DRY RUN]"),
    "Script should output DRY RUN message when in dry-run mode"
  );
});

test("deploy script has usage documentation", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("Usage:"), "Script should have usage documentation");
  assert.ok(content.includes("environment"), "Usage should document environment argument");
  assert.ok(content.includes("image_tag"), "Usage should document image_tag argument");
  assert.ok(content.includes("rollout_strategy"), "Usage should document rollout_strategy argument");
});

test("deploy script validates environment argument", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("dev"), "Should support dev environment");
  assert.ok(content.includes("staging"), "Should support staging environment");
  assert.ok(content.includes("prod"), "Should support prod environment");
  assert.ok(content.includes("test"), "Should support test environment");
  assert.ok(content.includes("pre-prod"), "Should support pre-prod environment");
});

test("deploy script validates rollout strategy", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("rolling"), "Should support rolling rollout strategy");
  assert.ok(content.includes("canary"), "Should support canary rollout strategy");
  assert.ok(content.includes("blue_green"), "Should support blue_green rollout strategy");
});

test("deploy script has logging functions", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("info()"), "Should have info logging function");
  assert.ok(content.includes("warn()"), "Should have warn logging function");
  assert.ok(content.includes("error()"), "Should have error logging function");
  assert.ok(content.includes("[INFO]"), "Should have INFO prefix");
  assert.ok(content.includes("[WARN]"), "Should have WARN prefix");
  assert.ok(content.includes("[ERROR]"), "Should have ERROR prefix");
});

test("deploy script checks for helm dependency", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("command -v helm"), "Should check for helm installation");
  assert.ok(content.includes("Helm is not installed"), "Should error if helm not found");
});

test("deploy script checks for kubectl dependency", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("kubectl cluster-info"), "Should check kubectl connectivity");
  assert.ok(content.includes("kubectl is not configured"), "Should error if kubectl not configured");
});

test("deploy script handles namespace creation", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("kubectl create namespace"), "Should create namespace if needed");
  assert.ok(content.includes("automatic-agent-"), "Should use correct namespace prefix");
});

test("deploy script uses helm upgrade for deployment", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("helm upgrade"), "Should use helm upgrade command");
  assert.ok(content.includes("--install"), "Should use --install flag");
  assert.ok(content.includes("--namespace"), "Should specify namespace");
  assert.ok(content.includes("--wait"), "Should wait for deployment");
  assert.ok(content.includes("--timeout"), "Should have timeout");
});

test("deploy script supports canary rollout strategy", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes('ROLLOUT_STRATEGY}" == "canary"'), "Should check for canary strategy");
  assert.ok(content.includes("automatic-agent-canary"), "Should use canary release name");
});

test("deploy script supports blue_green rollout strategy", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes('ROLLOUT_STRATEGY}" == "blue_green"'), "Should check for blue_green strategy");
  assert.ok(content.includes("automatic-agent-green"), "Should use green/blue naming");
  assert.ok(content.includes("automatic-agent-blue"), "Should support blue variant");
});

test("deploy script waits for rollout completion", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("kubectl rollout status"), "Should wait for rollout status");
  assert.ok(content.includes("deployment/"), "Should check deployment status");
  assert.ok(content.includes("timeout=") || content.includes("timeout"), "Should have timeout");
});

test("deploy script verifies service endpoints", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("kubectl get svc"), "Should check service status");
  assert.ok(content.includes("endpoints"), "Should verify endpoints");
  assert.ok(content.includes("loadBalancer"), "Should check load balancer ingress");
});

test("deploy script requires AA_DEPLOY_DOMAIN for production", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes('ENVIRONMENT}" == "prod"'), "Should check for production");
  assert.ok(content.includes("AA_DEPLOY_DOMAIN"), "Should require domain for prod");
  assert.ok(content.includes("PRODUCTION"), "Should warn about production deployment");
});

test("deploy script handles helm values files", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("values-"), "Should reference environment values files");
  assert.ok(content.includes("VALUES_FILE"), "Should pass resolved values file to helm");
  assert.ok(content.includes("image.tag"), "Should set image tag");
});

test("deploy script sets build metadata", () => {
  const content = readFileSync(DEPLOY_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("GITHUB_SHA") || content.includes("BUILD_COMMIT"), "Should set build commit");
  assert.ok(content.includes("BUILD_TIMESTAMP") || content.includes("timestamp"), "Should set build timestamp");
});

test("deploy workflow exists for CI", () => {
  const workflowPath = ".github/workflows/deploy-environment.yml";
  assert.ok(existsSync(workflowPath), "Deploy workflow should exist");

  const content = readFileSync(workflowPath, "utf-8");

  assert.ok(content.includes("name:") && content.includes("Deploy"), "Should have workflow name");
  assert.ok(content.includes("workflow_dispatch:") || content.includes("on:"), "Should support manual or event trigger");
});
