import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mobileNavigationSource = readFileSync(
  new URL("../../../../../ui/apps/mobile/src/navigation.ts", import.meta.url),
  "utf8",
);

const conversationFeatureSource = readFileSync(
  new URL("../../../../../ui/packages/features/conversation/src/index.tsx", import.meta.url),
  "utf8",
);

const webRegistrySource = readFileSync(
  new URL("../../../../../ui/apps/web/src/feature-registry.ts", import.meta.url),
  "utf8",
);

test("conversation feature is grouped under mission control as a primary entrypoint", () => {
  assert.match(conversationFeatureSource, /group: "Mission Control"/);
  assert.match(conversationFeatureSource, /path: "\/mission-control\/conversation"/);
});

test("mobile navigation routes conversation through the mission-control entrypoint", () => {
  assert.match(
    mobileNavigationSource,
    /\{ id: "conversation", title: "Conversation", path: "\/mission-control\/conversation", requiresAuth: true \}/,
  );
});

test("web feature registry exposes conversation under mission control instead of extended tools", () => {
  assert.match(
    webRegistrySource,
    /id: "conversation".+group: "Mission Control".+path: "\/mission-control\/conversation"/s,
  );
});
