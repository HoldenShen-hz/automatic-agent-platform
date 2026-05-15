import { PerceptionService } from "../../src/scale-ecosystem/marketplace/perception-service.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";

export function seedPerceptionDataset(db: SqliteDatabase, store: AuthoritativeTaskStore): {
  service: PerceptionService;
  sourceId: string;
  briefId: string;
} {
  const service = new PerceptionService(db, store);
  const source = service.registerSource({
    sourceId: "source-rss-1",
    type: "rss",
    name: "Engineering Signals",
    priority: 8,
    schedule: { cadence: "hourly" },
    filters: { tags: ["engineering", "incident"] },
  });

  service.ingestIntel({
    sourceId: source.sourceId,
    items: [
      {
        title: "Database latency increased",
        summary: "Write latency increased after an upstream schema rollout.",
        rawRef: "https://example.test/db-latency",
        relevanceScore: 0.92,
        importance: 0.97,
        tags: ["incident", "database"],
        capturedAt: "2026-04-08T09:00:00.000Z",
        ttlHours: 48,
      },
      {
        title: "Support queue growth",
        summary: "Inbound support queue grew by 25% after pricing announcement.",
        rawRef: "https://example.test/support-queue",
        relevanceScore: 0.84,
        importance: 0.77,
        tags: ["support", "pricing"],
        capturedAt: "2026-04-08T09:05:00.000Z",
        ttlHours: 48,
      },
      {
        title: "Expired low-signal mention",
        summary: "An older mention that should not survive the current brief window.",
        rawRef: "https://example.test/expired",
        relevanceScore: 0.5,
        importance: 0.2,
        tags: ["noise"],
        capturedAt: "2026-04-01T09:05:00.000Z",
        ttlHours: 1,
      },
    ],
  });

  const brief = service.buildBrief({
    sourceIds: [source.sourceId],
    generatedAt: "2026-04-08T10:00:00.000Z",
  });

  return {
    service,
    sourceId: source.sourceId,
    briefId: brief.brief.briefId,
  };
}
