#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const checks = [];

function read(path) {
  return readFileSync(path, "utf8");
}

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function contains(path, patterns) {
  if (!existsSync(path)) {
    return false;
  }
  const content = read(path);
  return patterns.every((pattern) => pattern.test(content));
}

check(
  "plugin child sandbox root is validated before chdir",
  contains("src/domains/registry/plugin-runtime-child.ts", [/AA_PLUGIN_SANDBOX_ROOT/, /resolveValidatedSandboxRoot/, /process\.chdir\(resolveValidatedSandboxRoot\(sandboxRoot\)\)/]),
  "plugin child validates AA_PLUGIN_SANDBOX_ROOT before process.chdir",
);
check(
  "plugin host removes child listeners",
  contains("src/domains/registry/plugin-runtime-host.ts", [/removeAllListeners\("message"\)/, /removeAllListeners\("error"\)/, /removeAllListeners\("close"\)/]),
  "plugin runtime host cleans child event listeners",
);
check(
  "plugin host exports sandbox root to child",
  contains("src/domains/registry/plugin-runtime-host.ts", [/AA_PLUGIN_SANDBOX_ROOT\s*=/]),
  "plugin runtime host sets AA_PLUGIN_SANDBOX_ROOT",
);
check(
  "MCP tool guard validates namespace and metadata",
  contains("src/platform/five-plane-execution/tool-executor/mcp-tool-guard.ts", [/validateMcpToolDefinition/, /validateMcpToolRuntime/, /builtin_collision/, /provider_dependency_invalid/]),
  "MCP guard rejects malformed or unregistered external tools",
);
check(
  "MCP output sanitizer blocks nested tool schemas",
  contains("src/platform/five-plane-execution/tool-executor/mcp-tool-guard.ts", [/FORBIDDEN_MCP_OUTPUT_PATTERN/, /function_call\|tool_use\|tool_calls/, /sanitizeMcpToolCallResult/]),
  "MCP guard sanitizes forbidden output shapes",
);
check(
  "adapter executor preserves validation failures",
  contains("src/platform/five-plane-execution/plugin-executor/adapter-executor.ts", [/ValidationError/, /adapter_executor\.mq_dispatcher_missing/, /throw error/]),
  "adapter executor does not swallow validation errors",
);
check(
  "remote SBOM heuristic inference is disabled",
  contains("src/sdk/plugin-sdk/plugin-definition.ts", [/Remote SBOM scanning requires a supplied SBOM fetcher/, /heuristic package inference is disabled/]),
  "remote SBOM refs fail closed without a fetcher",
);
check(
  "pack signing uses RSA 4096",
  contains("src/sdk/pack-sdk/pack-manifest.ts", [/generateKeyPairSync\("rsa"/, /modulusLength:\s*4096/]),
  "pack signing key generation uses RSA 4096",
);
check(
  "DomainLifecycleState uses canonical domain specs",
  contains("src/domains/architecture-remediation.ts", [/from "\.\/domain-specs\.js"/, /DomainLifecycleStateSchema/, /export type \{ DomainLifecycleState \}/]),
  "architecture remediation imports canonical lifecycle state",
);
check(
  "DomainLifecycleState schema accepts legacy aliases",
  contains("src/domains/domain-specs.ts", [/DomainLifecycleStateSchema/, /z\.preprocess/, /validating/]),
  "domain specs own lifecycle state normalization",
);
check(
  "global UI error boundary is mounted",
  contains("ui/apps/web/src/main.tsx", [/GlobalErrorBoundary/, /<GlobalErrorBoundary>/]),
  "web app wraps root component in GlobalErrorBoundary",
);
check(
  "global UI error boundary exposes alert fallback",
  contains("ui/apps/web/src/global-error-boundary.tsx", [/role="alert"/, /aria-live="assertive"/, /componentDidCatch/]),
  "error boundary renders accessible fallback",
);
check(
  "shared worker WS client removes message listener",
  contains("ui/packages/shared/api-client/src/ws-client.ts", [/removeEventListener\("message"/, /this\.port\.close\(\)/]),
  "SharedWorkerWSClient detaches message listener and closes port",
);
check(
  "browser WS client clears reconnect and heartbeat on disconnect",
  contains("ui/packages/shared/api-client/src/ws-client.ts", [/clearReconnectTimer\(\)/, /stopHeartbeat\(\)/, /this\.socket\?\.close\(\)/]),
  "BrowserWSClient clears timers before disconnect",
);
check(
  "chaos scheduler uses StructuredLogger",
  contains("src/ops-maturity/chaos/chaos-experiment-scheduler.ts", [/StructuredLogger/, /chaosLogger\.log/]),
  "chaos scheduler uses structured logging",
);
check(
  "chaos scheduler catches async interval errors",
  contains("src/ops-maturity/chaos/chaos-experiment-scheduler.ts", [/setInterval\(\(\) =>/, /try\s*\{[\s\S]*await evaluator\(\)/, /catch \(error\)/]),
  "continuous monitoring interval wraps async evaluator in try/catch",
);
check(
  "quality report marks stale full-suite counts as non-authoritative",
  contains(".audit/quality.md", [/no longer an authoritative full-suite failure ledger/, /stale/, /Do not use this file to claim that all tests pass/]),
  ".audit/quality.md no longer presents stale full-suite failures as current",
);
check(
  "domain config audit exists",
  contains("scripts/ci/audit-domain-configs.mjs", [/fullContractDomains/, /marketing/, /quant-trading/, /user-operations/]),
  "domain config audit covers the three reviewed full-contract domains",
);

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (failures.length > 0) {
  console.error(`implementation remediation audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`implementation remediation audit passed: ${checks.length}/${checks.length}`);
