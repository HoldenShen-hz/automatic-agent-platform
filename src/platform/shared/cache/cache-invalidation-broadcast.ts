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
import { runtimeMetricsRegistry } from "../observability/runtime-metrics-registry.js";

const logger = new StructuredLogger({ retentionLimit: 200 });
const BROADCAST_MAX_ATTEMPTS = 3;

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
  private isSubscribed = false;

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
    this.isSubscribed = true;
    this.sub.on("message", (_channel: string, raw: string) => {
      void this.handleIncomingMessage(raw);
    });

    this.isStarted = true;
  }

  async broadcastTagInvalidation(tag: string): Promise<void> {
    await this.publishWithRetry({
      type: "tag",
      tag,
      origin: this.instanceId,
    } satisfies CacheInvalidationMessage);
  }

  async broadcastNamespaceInvalidation(namespace: string): Promise<void> {
    await this.publishWithRetry({
      type: "namespace",
      namespace,
      origin: this.instanceId,
    } satisfies CacheInvalidationMessage);
  }

  async close(): Promise<void> {
    if (this.isSubscribed) {
      try {
        await this.sub.unsubscribe(this.channel);
      } catch (error) {
        logger.warn("cache_invalidation.unsubscribe_failed", {
          channel: this.channel,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await this.closeClient("pub", this.pub);
    await this.closeClient("sub", this.sub);
    this.isSubscribed = false;
    this.isStarted = false;
  }

  private async handleIncomingMessage(raw: string): Promise<void> {
    let msg: CacheInvalidationMessage;
    try {
      msg = JSON.parse(raw) as CacheInvalidationMessage;
    } catch (error) {
      runtimeMetricsRegistry.incrementCounter("cache_invalidation_broadcast_failures_total", { phase: "parse" }, 1);
      logger.warn("cache_invalidation.message_parse_failed", {
        channel: this.channel,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    if (msg.origin === this.instanceId) {
      return;
    }
    try {
      await this.onInvalidate(msg);
    } catch (error) {
      runtimeMetricsRegistry.incrementCounter("cache_invalidation_broadcast_failures_total", { phase: "consume" }, 1);
      logger.error("cache_invalidation.message_consume_failed", {
        channel: this.channel,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async publishWithRetry(message: CacheInvalidationMessage): Promise<void> {
    const payload = JSON.stringify(message);
    let attempt = 0;
    let lastError: unknown;
    while (attempt < BROADCAST_MAX_ATTEMPTS) {
      attempt += 1;
      try {
        await this.pub.publish(this.channel, payload);
        return;
      } catch (error) {
        lastError = error;
        runtimeMetricsRegistry.incrementCounter("cache_invalidation_broadcast_failures_total", { phase: "publish" }, 1);
        if (attempt < BROADCAST_MAX_ATTEMPTS) {
          runtimeMetricsRegistry.incrementCounter("cache_invalidation_broadcast_retries_total", { phase: "publish" }, 1);
          continue;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async closeClient(component: "pub" | "sub", client: Redis): Promise<void> {
    try {
      if (client.status === "wait" || client.status === "end") {
        client.disconnect();
        return;
      }
      await client.quit();
    } catch (error) {
      runtimeMetricsRegistry.incrementCounter("cache_invalidation_broadcast_failures_total", { phase: "close", component }, 1);
      logger.warn("cache_invalidation.client_close_failed", {
        component,
        error: error instanceof Error ? error.message : String(error),
      });
      client.disconnect();
    }
  }
}
