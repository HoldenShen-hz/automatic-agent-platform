import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const alertsFeatureSource = readFileSync(
  new URL("../../../../../ui/packages/features/alerts/src/index.tsx", import.meta.url),
  "utf8",
);

const alertsHookSource = readFileSync(
  new URL("../../../../../ui/packages/features/alerts/src/hooks/index.ts", import.meta.url),
  "utf8",
);

const webRegistrySource = readFileSync(
  new URL("../../../../../ui/apps/web/src/feature-registry.ts", import.meta.url),
  "utf8",
);

test("alerts feature requires platform_sre permission instead of generic authenticated access", () => {
  assert.match(alertsFeatureSource, /permission: "platform_sre"/);
  assert.match(alertsFeatureSource, /path: "\/mission-control\/alerts"/);
});

test("useAlertsVm filters incidents by auth permissions before exposing alert items", () => {
  assert.match(alertsHookSource, /useAuthState, useIncidentsQuery/);
  assert.match(alertsHookSource, /const ALERTS_REQUIRED_PERMISSION = "platform_sre";/);
  assert.match(
    alertsHookSource,
    /const scopedIncidents = auth\.permissions\.includes\(ALERTS_REQUIRED_PERMISSION\) \? incidents : \[\];/,
  );
});

test("web feature registry keeps alerts behind platform_sre and mission-control navigation", () => {
  assert.match(webRegistrySource, /id: "alerts".+path: "\/mission-control\/alerts".+permission: "platform_sre"/s);
});
