import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const billingCliSource = readFileSync(
  join(process.cwd(), "src", "sdk", "cli", "billing.ts"),
  "utf8",
);
const stripeGatewaySource = readFileSync(
  join(process.cwd(), "src", "scale-ecosystem", "billing", "billing-payment-gateway.ts"),
  "utf8",
);
const shadowSnapshotSource = readFileSync(
  join(process.cwd(), "src", "sdk", "cli", "shadow-snapshot.ts"),
  "utf8",
);
const dataPlaneSource = readFileSync(
  join(process.cwd(), "src", "sdk", "cli", "data-plane.ts"),
  "utf8",
);
const artifactStoreSource = readFileSync(
  join(process.cwd(), "src", "platform", "five-plane-state-evidence", "artifacts", "artifact-store.ts"),
  "utf8",
);

test("2287: billing path retains secret redaction at gateway and CLI output boundaries", () => {
  assert.match(stripeGatewaySource, /class StripeSecretRedactor/);
  assert.match(stripeGatewaySource, /new StripeSecretRedactor\(options\.secretKey\)/);
  assert.match(billingCliSource, /redactSensitiveValues/);
  assert.match(billingCliSource, /process\.stdout\.write\(`\$\{JSON\.stringify\(redactSensitiveValues\(result\), null, 2\)\}\\n`\)/);
});

test("2289: shadow snapshot CLI delegates sandboxing to workspace policy and service-level shadow-root validation", () => {
  assert.match(shadowSnapshotSource, /sandboxPolicy: createWorkspaceWritePolicy\(envConfig\.workspaceRoot\)/);
});

test("2290: data-plane CLI wires artifact sandbox policy and ArtifactStore narrows to rootDir", () => {
  assert.match(dataPlaneSource, /sandboxPolicy: createWorkspaceWritePolicy\(dirname\(envConfig\.artifactRoot\)\)/);
  assert.match(artifactStoreSource, /allowedRoots: \[rootPath\]/);
});
