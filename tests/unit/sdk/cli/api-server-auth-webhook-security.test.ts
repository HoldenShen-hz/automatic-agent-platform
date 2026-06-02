import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "sdk", "cli", "api-server.ts"),
  "utf-8",
);
const envSource = readFileSync(
  join(process.cwd(), "src", "platform", "five-plane-control-plane", "config-center", "api-server-env.ts"),
  "utf-8",
);
const routeUtilsSource = readFileSync(
  join(process.cwd(), "src", "platform", "five-plane-interface", "api", "http-server", "utils.ts"),
  "utf-8",
);
const billingRoutesSource = readFileSync(
  join(process.cwd(), "src", "platform", "five-plane-interface", "api", "http-server", "billing-routes.ts"),
  "utf-8",
);

test("2280: api-server startup remains fail-closed when auth is absent", () => {
  assert.match(source, /requireValidStartupEnv\(env\)/);
  assert.match(source, /AA_API_KEYS/);
  assert.match(envSource, /AA_API_KEYS_JSON/);
  assert.match(envSource, /AA_API_KEYS/);
  assert.match(envSource, /AA_API_JWT_SECRET/);
  assert.match(envSource, /api\.jwt_secret_required/);
  assert.match(routeUtilsSource, /api\.auth_not_configured/);
});

test("2281: api-server retains webhook secret entropy guards", () => {
  assert.match(source, /AA_WEBHOOK_SECRET/);
  assert.match(billingRoutesSource, /webhookSecret/);
  assert.match(billingRoutesSource, /timingSafeEqual/);
  assert.match(billingRoutesSource, /api\.webhook_signature_invalid/);
});
