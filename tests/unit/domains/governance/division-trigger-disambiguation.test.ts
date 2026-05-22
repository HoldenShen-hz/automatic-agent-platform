import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveRepoPath } from "../../../helpers/repo-root.js";

const repoRoot = resolveRepoPath();

function readDivision(relativePath: string): string {
  return readFileSync(`${repoRoot}/${relativePath}`, "utf8");
}

function extractSection(document: string, sectionName: string): string {
  const pattern = new RegExp(`${sectionName}:\\n((?:^\\s+.*\\n?)*)`, "m");
  const match = document.match(pattern);
  return match?.[1] ?? "";
}

// Dynamic imports for ESM modules
const [intakeRouterModule, divisionLoaderModule] = await Promise.all([
  import("../../../../src/platform/five-plane-orchestration/routing/intake-router.js"),
  import("../../../../src/domains/governance/division-loader.js"),
]);
const IntakeRouter = intakeRouterModule.IntakeRouter;
const loadConfiguredDivisionRegistry = divisionLoaderModule.loadConfiguredDivisionRegistry;

test("analytics/devops/operations monitoring triggers are intentionally partitioned by domain wording and priority", () => {
  const analytics = readDivision("divisions/analytics/division.yaml");
  const devops = readDivision("divisions/devops/division.yaml");
  const operations = readDivision("divisions/operations/division.yaml");
  const analyticsTriggers = extractSection(analytics, "triggers");
  const devopsTriggers = extractSection(devops, "triggers");
  const operationsTriggers = extractSection(operations, "triggers");

  assert.equal(/^\s*-\s*monitoring\s*$/m.test(analyticsTriggers), false);
  assert.equal(/^\s*-\s*monitoring\s*$/m.test(devopsTriggers), true);
  assert.equal(/^\s*-\s*monitoring\s*$/m.test(operationsTriggers), true);
  assert.ok(devops.includes("priority: 45"));
  assert.ok(operations.includes("priority: 20"));
});

test("devops and operations deployment trigger overlap remains visible and priority-driven", () => {
  const devops = readDivision("divisions/devops/division.yaml");
  const operations = readDivision("divisions/operations/division.yaml");

  assert.ok(/^\s*-\s*deployment\s*$/m.test(devops));
  assert.ok(/^\s*-\s*deployment\s*$/m.test(operations));
  assert.ok(devops.includes("description: CI/CD pipelines, infrastructure automation, deployment, monitoring."));
  assert.ok(operations.includes("description: Runbook execution, incident response, and monitoring review for SRE and DevOps tasks."));
  assert.ok(devops.includes("priority: 45"));
  assert.ok(operations.includes("priority: 20"));
});

test("finance-accounting and analytics no longer share a generic reporting trigger", () => {
  const finance = readDivision("divisions/finance-accounting/division.yaml");
  const analytics = readDivision("divisions/analytics/division.yaml");

  assert.equal(/^\s*-\s*reporting\s*$/m.test(finance), false);
  assert.equal(/^\s*-\s*financial reporting\s*$/m.test(finance), true);
  assert.equal(/^\s*-\s*report\s*$/m.test(analytics), true);
});

test("engineering and QA bug routing is explicitly partitioned between bugfix and bug reporting", () => {
  const engineering = readDivision("divisions/engineering_ops/division.yaml");
  const qa = readDivision("divisions/qa/division.yaml");

  assert.equal(/^\s*-\s*bug\s*$/m.test(engineering), false);
  assert.equal(/^\s*-\s*bugfix\s*$/m.test(engineering), true);
  assert.equal(/^\s*-\s*bug\s*$/m.test(qa), true);
});

test("general_ops no longer shadows research-specific trigger vocabulary", () => {
  const generalOps = readDivision("divisions/general_ops/division.yaml");
  const research = readDivision("divisions/research/division.yaml");

  assert.equal(/^\s*-\s*research\s*$/m.test(generalOps), false);
  assert.equal(/^\s*-\s*analyze\s*$/m.test(generalOps), false);
  assert.equal(/^\s*-\s*review\s*$/m.test(generalOps), false);
  assert.equal(/^\s*-\s*research\s*$/m.test(research), true);
  assert.equal(/^\s*-\s*analyze\s*$/m.test(research), true);
  assert.equal(/^\s*-\s*review\s*$/m.test(research), true);
});

test("devops+operations disambiguation: deployment with infrastructure context prefers devops", () => {
  const router = new IntakeRouter({
    divisionRegistry: loadConfiguredDivisionRegistry(),
  });

  // Docker/Kubernetes context should route to devops even with deployment trigger
  const decision = router.route({
    request: "Set up the docker deployment for the new microservice.",
  });

  assert.equal(decision.divisionId, "devops");
});

test("devops+operations disambiguation: deployment with incident/runbook context prefers operations", () => {
  const router = new IntakeRouter({
    divisionRegistry: loadConfiguredDivisionRegistry(),
  });

  // Incident/runbook context should route to operations even with deployment trigger
  // Note: operations is aliased to it-operations via LEGACY_DOMAIN_BINDING_ALIASES
  const decision = router.route({
    request: "Create a runbook for the deployment incident.",
  });

  assert.equal(decision.divisionId, "it-operations");
  assert.notEqual(decision.divisionId, "devops");
});

test("devops+operations disambiguation: monitoring with infrastructure context prefers devops", () => {
  const router = new IntakeRouter({
    divisionRegistry: loadConfiguredDivisionRegistry(),
  });

  // Kubernetes/infra context should route to devops for monitoring
  const decision = router.route({
    request: "Check the kubernetes cluster monitoring dashboards.",
  });

  assert.equal(decision.divisionId, "devops");
});

test("devops+operations disambiguation: monitoring with incident context prefers operations", () => {
  const router = new IntakeRouter({
    divisionRegistry: loadConfiguredDivisionRegistry(),
  });

  // Incident context should route to operations for monitoring
  // Note: operations is aliased to it-operations via LEGACY_DOMAIN_BINDING_ALIASES
  const decision = router.route({
    request: "Set up monitoring alerts for the incident response process.",
  });

  assert.equal(decision.divisionId, "it-operations");
  assert.notEqual(decision.divisionId, "devops");
});

test("devops+operations disambiguation: default priority still applies when no disambiguating context", () => {
  const router = new IntakeRouter({
    divisionRegistry: loadConfiguredDivisionRegistry(),
  });

  // Without specific context, devops (priority 45) should win over operations (priority 20)
  const decision = router.route({
    request: "Prepare the deployment checklist for tonight's release.",
  });

  assert.equal(decision.divisionId, "devops");
});

test("devops and operations division configs include disambiguate rules for deployment and monitoring triggers", () => {
  const devops = readDivision("divisions/devops/division.yaml");
  const operations = readDivision("divisions/operations/division.yaml");

  // Verify disambiguate section exists in both
  assert.ok(devops.includes("disambiguate:"), "devops should have disambiguate rules");
  assert.ok(operations.includes("disambiguate:"), "operations should have disambiguate rules");
  // Verify deployment and monitoring triggers are covered
  assert.ok(devops.includes("deployment") && operations.includes("deployment"));
  assert.ok(devops.includes("monitoring") && operations.includes("monitoring"));
});
