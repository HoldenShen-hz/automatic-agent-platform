import { readFileSync } from "node:fs";

const checks = [
  {
    name: "time constants expose 1h and 24h helpers",
    file: "src/platform/contracts/constants/time.ts",
    patterns: [/export const SECONDS_PER_HOUR = 3_600;/, /export const MS_PER_HOUR = 3_600_000;/, /export const MS_PER_DAY = 86_400_000;/],
  },
  {
    name: "network constants expose review-cited close codes and gateway timeout",
    file: "src/platform/contracts/constants/network.ts",
    patterns: [/WEBSOCKET_CLOSE_CODE_MISSING_TOKEN = 4_001;/, /WEBSOCKET_CLOSE_CODE_INVALID_TOKEN = 4_003;/, /HTTP_STATUS_GATEWAY_TIMEOUT = 504;/],
  },
  {
    name: "plugin runtime host uses stderr buffer constant",
    file: "src/domains/registry/plugin-runtime-host.ts",
    patterns: [/STDERR_TAIL_BUFFER_BYTES/, /slice\(-STDERR_TAIL_BUFFER_BYTES\)/],
    forbidden: [/slice\(-4096\)/],
  },
  {
    name: "websocket bridge uses named close codes",
    file: "src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts",
    patterns: [/WEBSOCKET_CLOSE_CODE_MISSING_TOKEN/, /WEBSOCKET_CLOSE_CODE_INVALID_TOKEN/],
    forbidden: [/ws\.close\(4001,/, /ws\.close\(4003,/],
  },
  {
    name: "gateway timeout paths use named HTTP status constant",
    file: "src/platform/five-plane-interface/api/http-api-server.ts",
    patterns: [/HTTP_STATUS_GATEWAY_TIMEOUT/],
    forbidden: [/ApiError\(504,/],
  },
  {
    name: "channel gateway runtime paths use named one-hour/day constants",
    file: "src/platform/five-plane-interface/channel-gateway/channel-gateway-delivery-service.ts",
    patterns: [/MS_PER_HOUR/],
    forbidden: [/3600000/],
  },
  {
    name: "OIDC defaults use named one-hour/day constants",
    file: "src/org-governance/sso-scim/oidc/oidc-service.ts",
    patterns: [/MS_PER_HOUR/, /MS_PER_DAY/, /SECONDS_PER_HOUR/],
    forbidden: [/sessionTtlMs: 3600000/, /maxSessionAgeMs: 86400000/, /expiresIn = 3600/],
  },
];

let failures = 0;

for (const check of checks) {
  const source = readFileSync(check.file, "utf8");
  const missing = check.patterns.filter((pattern) => !pattern.test(source));
  const forbidden = (check.forbidden ?? []).filter((pattern) => pattern.test(source));
  const ok = missing.length === 0 && forbidden.length === 0;
  console.log(`${ok ? "ok" : "fail"} ${check.name} - file=${check.file}`);
  if (!ok) {
    failures += 1;
    if (missing.length > 0) {
      console.error(`  missing patterns: ${missing.map((pattern) => pattern.toString()).join(", ")}`);
    }
    if (forbidden.length > 0) {
      console.error(`  forbidden patterns: ${forbidden.map((pattern) => pattern.toString()).join(", ")}`);
    }
  }
}

if (failures > 0) {
  console.error(`review magic number audit failed: ${failures}/${checks.length}`);
  process.exit(1);
}

console.log(`review magic number audit passed: ${checks.length}/${checks.length}`);
