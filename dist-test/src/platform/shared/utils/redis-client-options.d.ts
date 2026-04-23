export type RedisDeploymentMode = "standalone" | "sentinel";
export interface RedisSentinelEndpoint {
    host: string;
    port: number;
}
export interface RedisConnectionConfig {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    tls?: boolean;
    connectTimeout?: number;
    maxRetriesPerRequest?: number | null;
    lazyConnect?: boolean;
    enableOfflineQueue?: boolean;
    retryBaseDelayMs?: number;
    retryMaxDelayMs?: number;
    mode?: RedisDeploymentMode;
    sentinelName?: string;
    sentinels?: readonly RedisSentinelEndpoint[];
    sentinelPassword?: string;
}
export type RedisClientOptions = Record<string, unknown>;
export declare function readRedisConnectionConfigFromEnv(prefix: string, env?: NodeJS.ProcessEnv): RedisConnectionConfig | null;
export declare function buildRedisClientOptions(config: RedisConnectionConfig, overrides?: Record<string, unknown>): RedisClientOptions;
