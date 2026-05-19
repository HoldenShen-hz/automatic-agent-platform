/**
 * Cache Invalidation Broadcast
 *
 * Provides cross-instance cache invalidation via Redis pub/sub.
 * When one instance invalidates a cache entry, all other instances
 * receive the invalidation event and clear their local cache.
 */

import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import type { RedisConnectionConfig } from "../utils/redis-client-options.js";
import { buildRedisClientOptions } from "../utils/redis-client-options.js";
import { StructuredLogger } from "../observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 200 });

export interface CacheInvalidationMessage {
  type: "tag" | "namespace";
  tag?: string;
  namespace?: string;
  origin: string;
}

export interface CacheInvalidationBroadcastConfig extends RedisConnectionConfig {
  channel?: string;
}

export class CacheInvalidationBroadcast {
  private readonly pub: Redis;
  private readonly sub: Redis;
  private readonly channel: string;
  private readonly instanceId: string;
  private readonly onInvalidate: (msg: CacheInvalidationMessage) => Promise<void>;
  private isStarted = false;

  constructor(
    private readonly config: CacheInvalidationBroadcastConfig,
    onInvalidate: (msg: CacheInvalidationMessage) => Promise<void>,
  ) {
    this.instanceId = `inst_${randomUUID()}`;
    this.channel = config.channel ?? "aacache:invalidation";
    this.onInvalidate = onInvalidate;

    const redisConfig = buildRedisClientOptions(config, {
      maxRetriesPerRequest: config.maxRetriesPerRequest ?? 1,
      connectTimeout: config.connectTimeout ?? 500,
    });

    this.pub = new Redis(redisConfig);
    this.sub = new Redis(redisConfig);
    this.pub.on("error", (err: Error) => {
      logger.error("redis.connection_error", { component: "CacheInvalidationBroadcast:pub", err: err.message });
    });
    this.sub.on("error", (err: Error) => {
      logger.error("redis.connection_error", { component: "CacheInvalidationBroadcast:sub", err: err.message });
    });
  }

  async start(): Promise<void> {
    if (this.isStarted) return;

    await this.sub.subscribe(this.channel);
    this.sub.on("message", async (_channel: string, raw: string) => {
      try {
        const msg = JSON.parse(raw) as CacheInvalidationMessage;
        if (msg.origin === this.instanceId) return;
        await this.onInvalidate(msg);
      } catch {
        // Ignore parse errors
      }
    });

    this.isStarted = true;
  }

  async broadcastTagInvalidation(tag: string): Promise<void> {
    await this.pub.publish(
      this.channel,
      JSON.stringify({
        type: "tag",
        tag,
        origin: this.instanceId,
      } satisfies CacheInvalidationMessage),
    );
  }

  async broadcastNamespaceInvalidation(namespace: string): Promise<void> {
    await this.pub.publish(
      this.channel,
      JSON.stringify({
        type: "namespace",
        namespace,
        origin: this.instanceId,
      } satisfies CacheInvalidationMessage),
    );
  }

  async close(): Promise<void> {
    if (this.isStarted) {
      await this.sub.unsubscribe(this.channel);
    }
    if (this.pub.status === "wait" || this.pub.status === "end") {
      this.pub.disconnect();
    } else {
      await this.pub.quit();
    }
    if (this.sub.status === "wait" || this.sub.status === "end") {
      this.sub.disconnect();
    } else {
      await this.sub.quit();
    }
    this.isStarted = false;
  }
}
