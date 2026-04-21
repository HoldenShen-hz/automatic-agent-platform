/**
 * Cache Invalidation Broadcast
 *
 * Provides cross-instance cache invalidation via Redis pub/sub.
 * When one instance invalidates a cache entry, all other instances
 * receive the invalidation event and clear their local cache.
 */
import { Redis } from "ioredis";
import { buildRedisClientOptions } from "../utils/redis-client-options.js";
export class CacheInvalidationBroadcast {
    config;
    pub;
    sub;
    channel;
    instanceId;
    onInvalidate;
    isStarted = false;
    constructor(config, onInvalidate) {
        this.config = config;
        this.instanceId = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.channel = config.channel ?? "aacache:invalidation";
        this.onInvalidate = onInvalidate;
        const redisConfig = buildRedisClientOptions(config, {
            maxRetriesPerRequest: config.maxRetriesPerRequest ?? 1,
            connectTimeout: config.connectTimeout ?? 500,
        });
        this.pub = new Redis(redisConfig);
        this.sub = new Redis(redisConfig);
        this.pub.on("error", () => { });
        this.sub.on("error", () => { });
    }
    async start() {
        if (this.isStarted)
            return;
        await this.sub.subscribe(this.channel);
        this.sub.on("message", async (_channel, raw) => {
            try {
                const msg = JSON.parse(raw);
                if (msg.origin === this.instanceId)
                    return;
                await this.onInvalidate(msg);
            }
            catch {
                // Ignore parse errors
            }
        });
        this.isStarted = true;
    }
    async broadcastTagInvalidation(tag) {
        await this.pub.publish(this.channel, JSON.stringify({
            type: "tag",
            tag,
            origin: this.instanceId,
        }));
    }
    async broadcastNamespaceInvalidation(namespace) {
        await this.pub.publish(this.channel, JSON.stringify({
            type: "namespace",
            namespace,
            origin: this.instanceId,
        }));
    }
    async close() {
        if (this.isStarted) {
            await this.sub.unsubscribe(this.channel);
        }
        if (this.pub.status === "wait" || this.pub.status === "end") {
            this.pub.disconnect();
        }
        else {
            await this.pub.quit();
        }
        if (this.sub.status === "wait" || this.sub.status === "end") {
            this.sub.disconnect();
        }
        else {
            await this.sub.quit();
        }
        this.isStarted = false;
    }
}
//# sourceMappingURL=cache-invalidation-broadcast.js.map