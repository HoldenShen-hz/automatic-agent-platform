import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const loginSource = readFileSync(join(root, "src", "sdk", "cli", "login.ts"), "utf8");
const secretCommandsSource = readFileSync(join(root, "src", "sdk", "cli", "secret-commands.ts"), "utf8");
const apiServerSource = readFileSync(join(root, "src", "sdk", "cli", "api-server.ts"), "utf8");
const aaSource = readFileSync(join(root, "src", "sdk", "cli", "aa.ts"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const tsconfig = JSON.parse(readFileSync(join(root, "tsconfig.json"), "utf8")) as {
  compilerOptions?: { tsBuildInfoFile?: string };
};
const scriptsTsconfig = JSON.parse(readFileSync(join(root, "tsconfig.scripts.json"), "utf8")) as {
  compilerOptions?: { allowImportingTsExtensions?: boolean };
  include?: string[];
};
const rootEslintSource = readFileSync(join(root, "eslint.config.js"), "utf8");
const uiEslintSource = readFileSync(join(root, "ui", "eslint.config.js"), "utf8");
const prettierIgnore = readFileSync(join(root, ".prettierignore"), "utf8");
const gitIgnore = readFileSync(join(root, ".gitignore"), "utf8");
const mutationCriticalSource = readFileSync(join(root, "scripts", "ci", "mutation-critical-tests.sh"), "utf8");
const exceptionRecoveryConfig = readFileSync(join(root, "config", "exception-recovery", "default.json"), "utf8");
const costAlertConfig = readFileSync(join(root, "config", "cost-alert", "default.json"), "utf8");
const todoWriteToolSource = readFileSync(join(root, "src", "platform", "five-plane-execution", "tool-executor", "todo-write-tool.ts"), "utf8");
const gcpSecretProviderSource = readFileSync(join(root, "src", "platform", "five-plane-control-plane", "iam", "gcp-secret-manager-http-secret-provider.ts"), "utf8");
const packTestLocalSource = readFileSync(join(root, "src", "sdk", "pack-sdk", "pack-test-local-service.ts"), "utf8");
const packPluginCompatibilitySource = readFileSync(join(root, "src", "sdk", "pack-sdk", "pack-plugin-compatibility-service.ts"), "utf8");
const directExecGuardSources = [
  "src/sdk/cli/dispatch-execution.ts",
  "src/sdk/cli/doctor.ts",
  "src/sdk/cli/pack-create.ts",
  "src/sdk/cli/pack-publish.ts",
  "src/sdk/cli/pack-test.ts",
  "src/sdk/cli/pack-validate.ts",
  "src/sdk/cli/inspect.ts",
  "src/sdk/cli/evolution.ts",
  "src/sdk/cli/gateway-targets.ts",
  "src/sdk/cli/ops-governance.ts",
  "src/sdk/cli/orphan-cleanup.ts",
  "src/sdk/cli/phase1b-demo.ts",
].map((file) => ({
  file,
  source: readFileSync(join(root, file), "utf8"),
}));

test("login and secret command CLIs fail closed on home, encryption, and secret output handling", () => {
  assert.match(loginSource, /function resolveSecureCliHome/);
  assert.match(loginSource, /oauth\.home_directory_required/);
  assert.match(loginSource, /AA_CREDENTIALS_ENCRYPTION_KEY/);
  assert.match(loginSource, /oauth\.credentials_encryption_key_required/);
  assert.match(loginSource, /oauth\.invalid_login_state/);
  assert.match(loginSource, /delete env\.AA_LOGIN_TOKEN/);
  assert.doesNotMatch(loginSource, /HOME\s*\?\?\s*"\/tmp"/);

  assert.match(secretCommandsSource, /function resolveSecureCliHome/);
  assert.match(secretCommandsSource, /timingSafeEqual/);
  assert.match(secretCommandsSource, /if \(!verifyAuthToken\(config, config\.providedToken\)\)/);
  assert.match(secretCommandsSource, /SECRET_OUTPUT_PATH_ENV/);
  assert.match(secretCommandsSource, /valueSha256/);
  assert.doesNotMatch(secretCommandsSource, /value:\s*secretValue\.value/);
  assert.doesNotMatch(secretCommandsSource, /HOME\s*\?\?\s*"\/tmp"/);
  assert.doesNotMatch(todoWriteToolSource, /Todo not found: \$\{normalizedRequest\.todoId\}/);
  assert.doesNotMatch(gcpSecretProviderSource, /gcp\.invalid_secret_ref:\$\{secretRef\}/);
  assert.doesNotMatch(gcpSecretProviderSource, /gcp\.invalid_\$\{field\}:\$\{secretRef\}/);
  assert.doesNotMatch(gcpSecretProviderSource, /gcp\.config_missing:AA_GCP_PROJECT_ID:\$\{secretRef\}/);
  assert.match(packTestLocalSource, /DEFAULT_TIMEOUT_PROFILE_MS/);
  assert.match(packPluginCompatibilitySource, /pluginLicenseTiers/);
  assert.match(packPluginCompatibilitySource, /"plugin\.shared\.github_adapter": "professional"/);
});

test("api server startup uses managed cleanup and workspace-aware data roots", () => {
  assert.match(apiServerSource, /const startupCleanup: Array<\(\) => Promise<void>> = \[\];/);
  assert.match(apiServerSource, /registerManagedHandler\("typed_event_bus"/);
  assert.match(apiServerSource, /registerManagedHandler\("metrics_server"/);
  assert.match(apiServerSource, /registerManagedHandler\("channel_gateway_retry_executor"/);
  assert.match(apiServerSource, /registerManagedHandler\("http_api_server"/);
  assert.match(apiServerSource, /const dataRoot = join\(resolveConfigWorkspaceRoot\(\), "data"\);/);
  assert.match(apiServerSource, /knowledge-plane\.snapshot\.json/);
  assert.match(apiServerSource, /join\(dataRoot, "artifacts", "publish-ledger\.jsonl"\)/);
  assert.match(apiServerSource, /shutdown\.registerSignalHandlers\(\)/);
  assert.match(apiServerSource, /startupCleanup\.slice\(\)\.reverse\(\)/);
});

test("CLI and repo scripts expose fast paths and avoid stale layered-test coupling", () => {
  assert.equal(packageJson.scripts["test"], "npm run ci:baseline");
  assert.equal(packageJson.scripts["test:raw"]!.includes("build:test"), false);
  assert.equal(packageJson.scripts["test:unit"]!.includes("build:test"), false);
  assert.equal(packageJson.scripts["test:integration"]!.includes("build:test"), false);
  assert.equal(packageJson.scripts["test:golden"]!.includes("build:test"), false);
  assert.equal(packageJson.scripts["test:e2e"]!.includes("build:test"), false);
  assert.equal(packageJson.scripts["test:performance"]!.includes("build:test"), false);
  assert.equal("migrate:down" in packageJson.scripts, false);
  assert.equal(packageJson.scripts["secret-commands"]!.includes("secret-commands.js"), true);
  assert.equal(packageJson.scripts["pack-create"]!.includes("pack-create.js"), true);
  assert.equal(packageJson.scripts["pack-publish"]!.includes("pack-publish.js"), true);
  assert.equal(packageJson.scripts["pack-test"]!.includes("pack-test.js"), true);
  assert.equal(packageJson.scripts["pack-validate"]!.includes("pack-validate.js"), true);
  assert.equal(packageJson.scripts["aa:dev"], "node --import tsx src/sdk/cli/aa.ts");
  assert.match(readFileSync(join(root, "src", "sdk", "cli", "pack-create.ts"), "utf8"), /npm run pack-create --/);
  assert.match(readFileSync(join(root, "src", "sdk", "cli", "pack-publish.ts"), "utf8"), /npm run pack-publish --/);
  assert.match(readFileSync(join(root, "src", "sdk", "cli", "pack-test.ts"), "utf8"), /npm run pack-test --/);
  assert.match(readFileSync(join(root, "src", "sdk", "cli", "pack-validate.ts"), "utf8"), /npm run pack-validate --/);
  assert.match(aaSource, /const useSourceEntrypoint = existsSync\(sourceChildEntrypoint\);/);
  assert.match(aaSource, /"--import", "tsx"/);
  for (const entry of directExecGuardSources) {
    assert.match(entry.source, /pathToFileURL/);
    assert.match(entry.source, /import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/);
  }
});

test("lint and config metadata cover repo scripts, generated outputs, and schema consistency", () => {
  assert.equal(tsconfig.compilerOptions?.tsBuildInfoFile, ".cache/tsconfig.tsbuildinfo");
  assert.deepEqual(scriptsTsconfig.include, [
    "scripts/**/*.mjs",
    "scripts/**/*.ts",
    "*.config.js",
    "*.config.cjs",
    "*.config.mjs",
  ]);
  assert.equal(scriptsTsconfig.compilerOptions?.allowImportingTsExtensions, false);
  assert.equal(packageJson.scripts["typecheck"]!.includes("tsconfig.scripts.json"), true);
  assert.equal(packageJson.scripts["build"], "node scripts/build-if-needed.mjs");
  assert.equal(packageJson.scripts["lint"], "eslint .");
  assert.match(rootEslintSource, /"src\/\*\*\/\*\.ts"/);
  assert.match(rootEslintSource, /"scripts\/\*\*\/\*\.mjs"/);
  assert.match(rootEslintSource, /"helpers\/\*\*\/\*\.ts"/);
  assert.match(uiEslintSource, /"scripts\/\*\*\/\*\.mjs"/);
  assert.match(uiEslintSource, /"\*\.config\.\{ts,mjs,js\}"/);
  assert.match(prettierIgnore, /^dist\/$/m);
  assert.match(prettierIgnore, /^coverage\/$/m);
  assert.match(prettierIgnore, /^logs\/$/m);
  assert.match(prettierIgnore, /^\.audit\/$/m);
  assert.match(prettierIgnore, /^tests\/golden\/snapshots\/$/m);
  assert.match(prettierIgnore, /^tests\/fixtures\/migration\/snapshots\/$/m);
  assert.match(prettierIgnore, /^ui\/test-results\/$/m);
  assert.match(exceptionRecoveryConfig, /https:\/\/json-schema\.org\/draft\/2020-12\/schema/);
  assert.match(costAlertConfig, /https:\/\/json-schema\.org\/draft\/2020-12\/schema/);
});

test("repo hygiene keeps curated coverage, domain audits, snapshots, and helper paths aligned", () => {
  assert.equal(existsSync(join(root, "helpers", "fs.ts")), true);
  assert.equal(existsSync(join(root, "tests", "performance.bak", "api-load.test.ts.bak")), false);
  assert.equal(existsSync(join(root, "tests", "performance.bak", "oapeflir-perf.test.ts.bak")), false);
  assert.equal(existsSync(join(root, "tests", "fixtures", "prompt-engine", "valid-templates.json")), false);
  assert.equal(existsSync(join(root, "tests", "fixtures", "prompt-engine", "valid-quality-config.json")), false);
  assert.equal(existsSync(join(root, "tests", "fixtures", "prompt-engine", "invalid-json.json")), false);
  assert.doesNotMatch(gitIgnore, /^tests\/golden\/snapshots\/$/m);
  assert.doesNotMatch(gitIgnore, /^tests\/fixtures\/migration\/snapshots\/$/m);
  assert.equal(existsSync(join(root, "tests", "golden", "snapshots", "cli-doctor-output.golden")), true);
  assert.equal(existsSync(join(root, "tests", "fixtures", "migration", "snapshots", "manifest.json")), true);
  assert.equal(existsSync(join(root, "tests", "unit", "platform", "interface", "api", "http-server", "auth-routes.test.ts")), true);
  assert.equal(existsSync(join(root, "tests", "unit", "platform", "interface", "api", "http-server", "billing-routes.test.ts")), true);
  assert.equal(existsSync(join(root, "tests", "unit", "platform", "interface", "api", "http-server", "approval-routes.test.ts")), true);
  assert.equal(existsSync(join(root, "tests", "unit", "platform", "interface", "api", "http-server", "gateway-routes.test.ts")), true);
  assert.equal(existsSync(join(root, "tests", "unit", "platform", "orchestration", "oapeflir", "oapeflir-loop-service.test.ts")), true);
  assert.match(mutationCriticalSource, /tests\/unit\/platform\/interface\/api\/http-server\/auth-routes\.test\.ts/);
});
