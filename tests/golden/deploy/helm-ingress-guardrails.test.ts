import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse as parseYaml } from "yaml";
import { resolveRepoPath } from "../../helpers/repo-root.js";

test("[SYS-DEP-6.4] production values pin explicit ingress hosts for prod", () => {
  const values = parseYaml(
    readFileSync(resolveRepoPath("deploy", "helm", "automatic-agent", "values-prod.yaml"), "utf8"),
  ) as { ingress?: { domain?: string; hosts?: unknown[]; tls?: Array<{ hosts?: unknown[] }> } };

  assert.equal(values.ingress?.domain, "automatic-agent.example.com");
  assert.deepEqual(values.ingress?.hosts, [{ host: "automatic-agent.example.com", paths: [{ path: "/", pathType: "Prefix" }] }]);
  assert.deepEqual(values.ingress?.tls?.[0]?.hosts ?? [], ["automatic-agent.example.com"]);
});

test("[SYS-OBS-5.2] production values enable OTEL by default", () => {
  const values = parseYaml(
    readFileSync(resolveRepoPath("deploy", "helm", "automatic-agent", "values-prod.yaml"), "utf8"),
  ) as { env?: Record<string, string> };

  assert.equal(values.env?.AA_OTEL_ENABLED, "true");
  assert.equal(values.env?.AA_OTEL_SERVICE_NAME, "automatic-agent");
  assert.match(values.env?.AA_OTEL_ENDPOINT ?? "", /^http:\/\/otel-collector\./);
});

test("[SYS-DEP-6.4] environment values are plain YAML without Helm template expressions", () => {
  const files = [
    "deploy/helm/automatic-agent/values.yaml",
    "deploy/helm/automatic-agent/values-staging.yaml",
    "deploy/helm/automatic-agent/values-pre-prod.yaml",
    "deploy/helm/automatic-agent/values-prod.yaml",
  ];

  for (const file of files) {
    const content = readFileSync(resolveRepoPath(file), "utf8");
    assert.doesNotMatch(content, /\{\{.*\}\}/, `${file} should be plain YAML, not embedded template syntax`);
  }
});

test("[SYS-DEP-6.4] ingress template requires domain and renders valid host field", () => {
  const template = readFileSync(
    resolveRepoPath("deploy", "helm", "automatic-agent", "templates", "ingress.yaml"),
    "utf8",
  );

  assert.match(template, /required "ingress\.domain must be set when ingress is enabled"/);
  assert.match(template, /- host: \{\{ \.host \| quote \}\}/);
  assert.match(template, /rules:\s+[\s\S]*- host:/, "Ingress rules must render singular host field");
});

test("[SYS-DEP-6.2] deploy script enforces prod domain guardrail and supports pre-prod/test", () => {
  const script = readFileSync(resolveRepoPath("deploy", "scripts", "deploy.sh"), "utf8");

  assert.match(script, /\^\(dev\|test\|staging\|pre-prod\|prod\)\$/);
  assert.match(script, /AA_DEPLOY_DOMAIN must be set for production deployments/);
  assert.match(script, /"--set" "ingress\.domain=\$\{DEPLOY_DOMAIN\}"/);
});
