import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("grafana dashboard declares compatibility metadata and avoids shared uid collisions", () => {
  const dashboard = JSON.parse(
    readFileSync("deploy/grafana/dashboards/automatic-agent.json", "utf8"),
  ) as {
    __requires?: Array<{ id?: string; version?: string }>;
    schemaVersion?: number;
    uid?: string;
    panels?: Array<{ datasource?: { uid?: string } }>;
  };

  assert.equal(dashboard.uid, undefined);
  assert.equal(dashboard.schemaVersion, 39);
  assert.ok(
    dashboard.__requires?.some((entry) => entry.id === "grafana" && entry.version === "10.4.0"),
  );
  for (const panel of dashboard.panels ?? []) {
    if (panel.datasource) {
      assert.equal(panel.datasource.uid, "${datasource}");
    }
  }
});

test("grafana provisioning is gitops-owned", () => {
  const provisioning = readFileSync(
    "deploy/grafana/provisioning/dashboards.yaml",
    "utf8",
  );
  assert.match(provisioning, /allowUiUpdates:\s+false/);
});

test("chaos catalog fallback profiles are in-repo and selectors stay bounded", () => {
  const catalog = JSON.parse(
    readFileSync("deploy/chaos/catalog.json", "utf8"),
  ) as {
    fallbackProfiles?: Array<{ profileId: string }>;
    scenarios?: Array<{ fallbackProfileId: string; manifestPath: string }>;
  };
  const profileIds = new Set(
    (catalog.fallbackProfiles ?? []).map((profile) => profile.profileId),
  );

  for (const scenario of catalog.scenarios ?? []) {
    assert.ok(profileIds.has(scenario.fallbackProfileId));
    assert.match(scenario.manifestPath, /^deploy\/chaos\/.+\.yaml$/);
  }

  const podKill = readFileSync("deploy/chaos/pod-kill.yaml", "utf8");
  assert.match(podKill, /app\.kubernetes\.io\/component:\s+api/);

  const postgresDisconnect = readFileSync(
    "deploy/chaos/postgres-disconnect.yaml",
    "utf8",
  );
  assert.match(postgresDisconnect, /app\.kubernetes\.io\/name:\s+postgres/);

  const redisDisconnect = readFileSync(
    "deploy/chaos/redis-disconnect.yaml",
    "utf8",
  );
  assert.match(redisDisconnect, /duration:\s+"60s"/);
  assert.match(redisDisconnect, /app\.kubernetes\.io\/name:\s+redis/);
});

test("smoke manifest carries minimal runtime hardening", () => {
  const manifest = readFileSync(
    "deploy/kubernetes/manifests/automatic-agent-smoke.yaml",
    "utf8",
  );
  assert.match(manifest, /serviceAccountName:\s+default/);
  assert.match(manifest, /runAsNonRoot:\s+true/);
  assert.match(manifest, /readinessProbe:/);
  assert.match(manifest, /livenessProbe:/);
  assert.match(manifest, /resources:/);
});

test("terraform deploy inputs pin providers and expose node taints", () => {
  const rootModule = readFileSync("deploy/terraform/main.tf", "utf8");
  const eksModule = readFileSync("deploy/terraform/modules/eks/main.tf", "utf8");

  assert.match(rootModule, /version = "= 5\.0\.0"/);
  assert.match(rootModule, /variable "eks_node_taints"/);
  assert.match(rootModule, /node_taints\s+=\s+var\.eks_node_taints/);
  assert.match(eksModule, /variable "node_taints"/);
  assert.match(eksModule, /dynamic "taint"/);
});

test("helm PrometheusRule template still parses as a PrometheusRule skeleton", () => {
  const content = readFileSync(
    "deploy/helm/automatic-agent/templates/prometheusrule.yaml",
    "utf8",
  );
  assert.match(content, /kind:\s+PrometheusRule/);
  assert.ok(
    Array.from(content.matchAll(/^\s*- alert:\s+/gm)).length >= 21,
    "Helm PrometheusRule should carry the full alert surface",
  );
});
