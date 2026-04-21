import type { DatabaseSync } from "node:sqlite";
import type { DistributedLockAdapter } from "./distributed-lock-types.js";
export declare function createLockAdapter(kind: "sqlite" | "pg_advisory" | "redis", db?: DatabaseSync): DistributedLockAdapter;
