import { existsSync, readFileSync } from "node:fs";

const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

const compose = read("docker-compose.yml");
check("docker-compose resource limits", /cpus:/.test(compose) && /mem_limit:/.test(compose) && /pids_limit:/.test(compose), "cpus, mem_limit, and pids_limit are declared");
check("docker-compose writable root hardening", /read_only:\s*true/.test(compose) && /no-new-privileges:true/.test(compose), "read_only and no-new-privileges are declared");
check("docker-compose secret guidance", /AA_API_JWT_SECRET/.test(compose) && /not commit concrete AA_API_JWT_SECRET/.test(compose), "JWT secret is documented as external input");

for (const environment of ["dev", "staging", "pre-prod"]) {
  const config = readJson(`config/environments/${environment}.json`);
  check(`environment name ${environment}`, config.environment === environment, `environment=${config.environment}`);
}

for (const environment of ["default", "dev", "test", "staging", "pre-prod", "prod"]) {
  const security = readJson(`config/security/${environment}.json`);
  check(`security ${environment} sandbox`, security.sandboxMode === "read_only", `sandboxMode=${security.sandboxMode}`);
  check(`security ${environment} destructive guard`, security.allowDestructiveActions === false, `allowDestructiveActions=${security.allowDestructiveActions}`);
  check(`security ${environment} remote worker policy`, Boolean(security.remoteWorkerRegistration?.mcpPolicy), "remoteWorkerRegistration.mcpPolicy exists");
}

const prodRuntime = readJson("config/runtime/prod.json");
check("prod runtime concurrency", Number(prodRuntime.maxConcurrentTasks) > 1, `maxConcurrentTasks=${prodRuntime.maxConcurrentTasks}`);

const rootPackage = read("package.json");
check("root package has version", /"version":\s*"0\.1\.0"/.test(rootPackage), "package version is declared");
check("root package does not declare rimraf", !/"rimraf"/.test(rootPackage), "rimraf is not a root dependency");

const responseHardening = read("src/platform/five-plane-interface/api/http-server/response-hardening.ts");
check("api cors write methods", /allowedMethods:\s*\["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"\]/.test(responseHardening), "CORS default allows declared REST methods");

check("kubernetes manifests exist", existsSync("deploy/kubernetes/manifests/automatic-agent-smoke.yaml"), "smoke manifest exists");
check("multi-region primary tfvars", existsSync("deploy/terraform/environments/multi-region/primary.tfvars"), "primary overlay exists");
check("multi-region secondary tfvars", existsSync("deploy/terraform/environments/multi-region/secondary.tfvars"), "secondary overlay exists");

for (const path of ["deploy/helm/automatic-agent/values-staging.yaml", "deploy/helm/automatic-agent/values-pre-prod.yaml"]) {
  const values = read(path);
  check(`${path} ingress hosts`, /hosts:\s*\n\s*-\s*host:\s*\S+/.test(values), "ingress host is non-empty");
  check(`${path} otel endpoint`, /AA_OTEL_ENDPOINT:\s*"http:\/\/otel-collector\.observability\.svc\.cluster\.local:4318\/v1\/traces"/.test(values), "OTEL endpoint is aligned");
}

const uiVitest = read("ui/vitest.config.ts");
check("ui coverage thresholds", /thresholds:\s*{[\s\S]*global:/.test(uiVitest), "vitest coverage thresholds are configured");

const uiI18n = read("ui/packages/shared/i18n/src/index.ts");
check("ui i18n ar-SA loader", /registerLoader\("ar-SA"[\s\S]*direction:\s*"rtl"/.test(uiI18n), "Arabic locale loader is registered as RTL");
check("ui feature copy fallback", /defaultTitle/.test(uiI18n) && /defaultSummary/.test(uiI18n), "translateFeatureCopy has default fallbacks");
check("ui shared i18n package export", /"exports":/.test(read("ui/packages/shared/i18n/package.json")), "@aa/shared-i18n has an entrypoint");
check("ui shared telemetry package export", /"exports":/.test(read("ui/packages/shared/telemetry/package.json")), "@aa/shared-telemetry has an entrypoint");

const uiWorkflow = read(".github/workflows/ui-quality.yml");
check("ui workflow coverage gate", /npm run test:coverage/.test(uiWorkflow), "UI workflow runs coverage gate");

const deployWorkflow = read(".github/workflows/deploy-environment.yml");
check("deploy workflow environment approval", /environment:\s*\$\{\{ inputs\.environment \}\}/.test(deployWorkflow), "GitHub environment approval binding is present");
check("deploy workflow health check", /Endpoint health check passed/.test(deployWorkflow), "post-deploy endpoint health check is present");
check("deploy workflow rollback", /helm rollback/.test(deployWorkflow), "rollback job executes helm rollback");

const rollback = read("deploy/scripts/rollback.sh");
check("rollback supports all environments", /\^\(dev\|test\|staging\|pre-prod\|prod\)\$/.test(rollback), "rollback accepts dev/test/staging/pre-prod/prod");
check("rollback endpoint verification", /has no ready endpoints/.test(rollback), "rollback verifies ready endpoints");

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (failures.length > 0) {
  console.error(`review guardrail audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`review guardrail audit passed: ${checks.length}/${checks.length}`);
