import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { parse as parseYaml } from "yaml";
const REPO_ROOT = "/Users/holden/Project/automatic_agent/automatic_agent_platform";
test("[SYS-DEP-6.4] production values require explicit ingress domain injection", () => {
    const values = parseYaml(readFileSync(join(REPO_ROOT, "deploy/helm/automatic-agent/values-prod.yaml"), "utf8"));
    assert.equal(values.ingress?.domain, "", "prod values should not embed placeholder domains");
    assert.deepEqual(values.ingress?.hosts, [], "prod values should defer host generation to template/runtime injection");
    assert.deepEqual(values.ingress?.tls?.[0]?.hosts ?? [], [], "prod tls hosts should be injected at deploy time");
});
test("[SYS-OBS-5.2] production values enable OTEL by default", () => {
    const values = parseYaml(readFileSync(join(REPO_ROOT, "deploy/helm/automatic-agent/values-prod.yaml"), "utf8"));
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
        const content = readFileSync(join(REPO_ROOT, file), "utf8");
        assert.doesNotMatch(content, /\{\{.*\}\}/, `${file} should be plain YAML, not embedded template syntax`);
    }
});
test("[SYS-DEP-6.4] ingress template requires domain and renders valid host field", () => {
    const template = readFileSync(join(REPO_ROOT, "deploy/helm/automatic-agent/templates/ingress.yaml"), "utf8");
    assert.match(template, /required "ingress\.domain must be set when ingress is enabled"/);
    assert.match(template, /- host: \{\{ \.host \| quote \}\}/);
    assert.match(template, /rules:\s+[\s\S]*- host:/, "Ingress rules must render singular host field");
});
test("[SYS-DEP-6.2] deploy script enforces prod domain guardrail and supports pre-prod/test", () => {
    const script = readFileSync(join(REPO_ROOT, "deploy/scripts/deploy.sh"), "utf8");
    assert.match(script, /\^\(dev\|test\|staging\|pre-prod\|prod\)\$/);
    assert.match(script, /AA_DEPLOY_DOMAIN must be set for production deployments/);
    assert.match(script, /"--set" "ingress\.domain=\$\{DEPLOY_DOMAIN\}"/);
});
//# sourceMappingURL=helm-ingress-guardrails.test.js.map