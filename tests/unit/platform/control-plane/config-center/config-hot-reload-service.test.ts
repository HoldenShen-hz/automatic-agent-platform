import assert from "node:assert/strict";
import test from "node:test";
import { ConfigHotReloadService } from "../../../../../src/platform/five-plane-control-plane/config-center/config-hot-reload-service.js";

function getHotReloadInitialized(service: ConfigHotReloadService): boolean {
  return Reflect.get(service as object, "_initialized") as boolean;
}

function getHotReloadSubscriptions(service: ConfigHotReloadService): Map<string, { active?: boolean }> {
  return Reflect.get(service as object, "subscriptions") as Map<string, { active?: boolean }>;
}

function getWatchedFiles(service: ConfigHotReloadService): Set<string> {
  return Reflect.get(service as object, "watchedFiles") as Set<string>;
}

test("ConfigHotReloadService can be instantiated", () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  assert.ok(service != null);
});

test("ConfigHotReloadService initialize can be called multiple times safely", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();
  assert.equal(getHotReloadInitialized(service), true);
  await service.initialize();
  assert.equal(getHotReloadInitialized(service), true);
  service.shutdown();
});

test("ConfigHotReloadService subscribe returns a subscription ID", () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  const subscriptionId = service.subscribe(
    "test-component",
    ["test.config"],
    ["platform"],
    async () => {},
  );
  assert.ok(typeof subscriptionId === "string");
  assert.ok(subscriptionId.length > 0);
});

test("ConfigHotReloadService unsubscribe removes subscription", () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  const subscriptionId = service.subscribe(
    "test-component",
    ["test.config"],
    ["platform"],
    async () => {},
  );
  service.unsubscribe(subscriptionId);
  assert.equal(getHotReloadSubscriptions(service).has(subscriptionId), false);
  service.pauseSubscription(subscriptionId);
  service.resumeSubscription(subscriptionId);
  assert.equal(getHotReloadSubscriptions(service).has(subscriptionId), false);
});

test("ConfigHotReloadService pauseSubscription deactivates subscription", () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  const subscriptionId = service.subscribe(
    "test-component",
    ["test.config"],
    ["platform"],
    async () => {},
  );
  service.pauseSubscription(subscriptionId);
  assert.equal(getHotReloadSubscriptions(service).get(subscriptionId)?.active, false);
  service.shutdown();
});

test("ConfigHotReloadService resumeSubscription reactivates subscription", () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  const subscriptionId = service.subscribe(
    "test-component",
    ["test.config"],
    ["platform"],
    async () => {},
  );
  service.pauseSubscription(subscriptionId);
  service.resumeSubscription(subscriptionId);
  assert.equal(getHotReloadSubscriptions(service).get(subscriptionId)?.active, true);
  service.shutdown();
});

test("ConfigHotReloadService triggerReload notifies subscribers", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  let notified = false;

  service.subscribe(
    "test-component",
    ["test.config"],
    ["platform"],
    async () => {
      notified = true;
    },
  );

  await service.triggerReload("test.config", "platform", null, { value: "test" });
  assert.equal(notified, true);
  service.shutdown();
});

test("ConfigHotReloadService triggerReload accepts different severity levels", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  let notified = false;

  service.subscribe(
    "test-component",
    ["test.config"],
    ["platform"],
    async () => {
      notified = true;
    },
  );

  await service.triggerReload("test.config", "platform", null, { value: "test" }, "api", "critical");
  assert.equal(notified, true);
  service.shutdown();
});

test("ConfigHotReloadService triggerReload accepts different sources", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  let notified = false;

  service.subscribe(
    "test-component",
    ["test.config"],
    ["platform"],
    async () => {
      notified = true;
    },
  );

  await service.triggerReload("test.config", "platform", null, { value: "test" }, "event");
  assert.equal(notified, true);
  service.shutdown();
});

test("ConfigHotReloadService triggerReload notifies matching wildcard subscriptions", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  let notified = false;

  service.subscribe(
    "test-component",
    ["test.*"],
    ["platform"],
    async () => {
      notified = true;
    },
  );

  await service.triggerReload("test.config", "platform", null, { value: "test" });
  assert.equal(notified, true);
  service.shutdown();
});

test("ConfigHotReloadService triggerReload does not notify non-matching wildcard subscriptions", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  let notified = false;

  service.subscribe(
    "test-component",
    ["other.*"],
    ["platform"],
    async () => {
      notified = true;
    },
  );

  await service.triggerReload("test.config", "platform", null, { value: "test" });
  assert.equal(notified, false);
  service.shutdown();
});

test("ConfigHotReloadService triggerReload notifies all layers subscription", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  let notified = false;

  service.subscribe(
    "test-component",
    ["test.config"],
    ["*"],
    async () => {
      notified = true;
    },
  );

  await service.triggerReload("test.config", "tenant", null, { value: "test" });
  assert.equal(notified, true);
  service.shutdown();
});

test("ConfigHotReloadService shutdown clears subscriptions and stops watchers", () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  service.subscribe(
    "test-component",
    ["test.config"],
    ["platform"],
    async () => {},
  );
  assert.equal(getHotReloadSubscriptions(service).size, 1);
  service.shutdown();
  assert.equal(getHotReloadSubscriptions(service).size, 0);
  assert.equal(getHotReloadInitialized(service), false);
});

test("ConfigHotReloadService watchFile adds file to watched set", () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  const filePath = "/tmp/nonexistent-config-file.json";
  service.watchFile(filePath);
  assert.equal(getWatchedFiles(service).has(filePath), true);
  service.unwatchFile(filePath);
  service.shutdown();
});

test("ConfigHotReloadService unwatchFile removes file from watched set", () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  const filePath = "/tmp/nonexistent-config-file.json";
  service.watchFile(filePath);
  service.unwatchFile(filePath);
  assert.equal(getWatchedFiles(service).has(filePath), false);
  service.shutdown();
});
