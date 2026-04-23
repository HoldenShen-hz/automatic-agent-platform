import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { HttpApiServer } from "./http-api-server.js";
export interface TaskWebSocketStatusRelayOptions {
    pollIntervalMs?: number;
    backlogLimit?: number;
}
export declare class TaskWebSocketStatusRelay {
    private readonly server;
    private readonly store;
    private readonly pollIntervalMs;
    private readonly backlogLimit;
    private readonly seenEventIds;
    private timer;
    constructor(server: HttpApiServer, store: AuthoritativeTaskStore, options?: TaskWebSocketStatusRelayOptions);
    start(): void;
    stop(): void;
    pollOnce(): void;
    private broadcastStatusChanged;
    private markSeen;
}
