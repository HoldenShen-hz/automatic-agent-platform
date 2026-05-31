#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["tests"];
const TEST_FILE_PATTERN = /\.test\.(?:ts|tsx)$/;
const SKIP_DIRECTORIES = new Set(["node_modules", "dist", "coverage"]);
const ALLOWED_FILE_PATTERNS = [
  /tests\/helpers\/network-test-constants\.ts$/,
  /\/security\//,
  /\/ssrf-/,
  /\/storage-backend-/,
  /\/runtime-factory/,
  /\/distributed-lock\//,
  /\/graphql-adapter-service/,
  /\/gateway-config\.test\.ts$/,
  /\/http-api-server-types\.test\.ts$/,
  /\/http-server-response-hardening\.test\.ts$/,
  /\/bootstrap-client-sdk-security\.test\.ts$/,
  /\/channel-gateway-service\.test\.ts$/,
  /\/oauth-pkce-login-flow\.test\.ts$/,
  /\/pack-publish\.test\.ts$/,
  /\/unit\/ui\/apps\/web\/runtime\.test\.ts$/,
  /\/interface\/api\/api\.test\.ts$/,
  /\/execution\/locks\//,
  /\/scoped-external-access-sandbox/,
  /\/security-field-encryption\.test\.ts$/,
];
const findings = [];

for (const root of ROOTS) {
  if (existsSync(root)) {
    walk(root);
  }
}

console.log(JSON.stringify({
  roots: ROOTS,
  findingCount: findings.length,
  findings,
}, null, 2));

if (findings.length > 0) {
  console.error("test network fixture audit failed");
  process.exit(1);
}

function walk(directory) {
  for (const entry of readdirSync(directory).sort()) {
    if (SKIP_DIRECTORIES.has(entry)) {
      continue;
    }
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!stats.isFile() || !TEST_FILE_PATTERN.test(fullPath) || isAllowedFile(fullPath)) {
      continue;
    }
    scanFile(fullPath);
  }
}

function scanFile(filePath) {
  const lines = readFileSync(filePath, "utf8").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/postgres(?:ql)?:\/\/[^"'\s:]+:[^"'\s@]+@(?:localhost|127\.0\.0\.1)/.test(line)) {
      findings.push({
        file: filePath,
        line: index + 1,
        rule: "raw-loopback-dsn-with-inline-password",
        snippet: line.trim(),
      });
      continue;
    }
    if (/(?:http:\/\/|https:\/\/)(?:localhost|127\.0\.0\.1):\d+/.test(line)) {
      findings.push({
        file: filePath,
        line: index + 1,
        rule: "raw-loopback-url-with-port",
        snippet: line.trim(),
      });
      continue;
    }
    if (/listen\((?!0\b)\d+,\s*"127\.0\.0\.1"/.test(line) || /listen\((?!0\b)\d+,\s*"localhost"/.test(line)) {
      findings.push({
        file: filePath,
        line: index + 1,
        rule: "fixed-loopback-listen-port",
        snippet: line.trim(),
      });
    }
  }
}

function isAllowedFile(filePath) {
  return ALLOWED_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}
