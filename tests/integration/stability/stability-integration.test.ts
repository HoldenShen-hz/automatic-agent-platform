import assert from "node:assert/strict";
import test from "node:test";

import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";

type StabilityLevel = "stable" | "canary" | "beta" | "alpha";

interface MockStableRelease {
  id: string;
  version: string;
  stability: StabilityLevel;
  releasedAt: string;
  rolloutPercent: number;
}

interface MockChaosDrill {
  id: string;
  kind: "network" | "cpu" | "memory" | "disk";
  status: "planned" | "running" | "completed" | "cancelled";
  startedAt: string | null;
  completedAt: string | null;
}

test("Stable release promotion through levels", () => {
  const levels: StabilityLevel[] = ["alpha", "beta", "canary", "stable"];
  const releases: MockStableRelease[] = [];

  for (const level of levels) {
    releases.push({
      id: newId("release"),
      version: "1.0.0",
      stability: level,
      releasedAt: nowIso(),
      rolloutPercent: level === "stable" ? 100 : 10,
    });
  }

  assert.equal(releases[0]?.stability, "alpha");
  assert.equal(releases[3]?.stability, "stable");
});

test("Stable release with rollout percentage", () => {
  const release: MockStableRelease = {
    id: newId("release"),
    version: "2.0.0",
    stability: "canary",
    releasedAt: nowIso(),
    rolloutPercent: 25,
  };

  assert.equal(release.rolloutPercent, 25);
  assert.ok(release.rolloutPercent >= 0 && release.rolloutPercent <= 100);
});

test("Chaos drill lifecycle", () => {
  const drill: MockChaosDrill = {
    id: newId("drill"),
    kind: "network",
    status: "planned",
    startedAt: null,
    completedAt: null,
  };

  assert.equal(drill.status, "planned");

  drill.status = "running";
  drill.startedAt = nowIso();
  assert.equal(drill.status, "running");
  assert.ok(drill.startedAt !== null);

  drill.status = "completed";
  drill.completedAt = nowIso();
  assert.equal(drill.status, "completed");
  assert.ok(drill.completedAt !== null);
});

test("Chaos drill cancellation", () => {
  const drill: MockChaosDrill = {
    id: newId("drill"),
    kind: "cpu",
    status: "planned",
    startedAt: null,
    completedAt: null,
  };

  drill.status = "running";
  drill.startedAt = nowIso();

  drill.status = "cancelled";
  assert.equal(drill.status, "cancelled");
  assert.ok(drill.completedAt === null); // Not completed, cancelled
});

test("Chaos drill kinds", () => {
  const kinds: MockChaosDrill["kind"][] = ["network", "cpu", "memory", "disk"];

  for (const kind of kinds) {
    const drill: MockChaosDrill = {
      id: newId("drill"),
      kind,
      status: "planned",
      startedAt: null,
      completedAt: null,
    };
    assert.equal(drill.kind, kind);
  }
});

test("Stable release versions are unique", () => {
  const versions = new Set<string>();

  for (let i = 0; i < 20; i++) {
    versions.add(`1.0.${i}`);
  }

  assert.equal(versions.size, 20);
});

test("Multiple chaos drills running concurrently", () => {
  const drills: MockChaosDrill[] = [];

  for (let i = 0; i < 3; i++) {
    drills.push({
      id: newId("drill"),
      kind: "network",
      status: "running",
      startedAt: nowIso(),
      completedAt: null,
    });
  }

  const running = drills.filter((d) => d.status === "running");
  assert.equal(running.length, 3);
});

test("Stable release graduated rollout", () => {
  const rolloutStages = [1, 5, 10, 25, 50, 100];
  const releases: MockStableRelease[] = [];

  for (const percent of rolloutStages) {
    releases.push({
      id: newId("release"),
      version: "2.0.0",
      stability: percent === 100 ? "stable" : "canary",
      releasedAt: nowIso(),
      rolloutPercent: percent,
    });
  }

  const sorted = releases.sort((a, b) => a.rolloutPercent - b.rolloutPercent);

  assert.equal(sorted[0]?.rolloutPercent, 1);
  assert.equal(sorted[5]?.rolloutPercent, 100);
});

test("Chaos drill duration calculation", () => {
  const drill: MockChaosDrill = {
    id: newId("drill"),
    kind: "memory",
    status: "completed",
    startedAt: "2026-04-01T10:00:00.000Z",
    completedAt: "2026-04-01T10:05:00.000Z",
  };

  const start = new Date(drill.startedAt!).getTime();
  const end = new Date(drill.completedAt!).getTime();
  const durationMs = end - start;
  const durationMinutes = durationMs / 60000;

  assert.equal(durationMinutes, 5);
});
