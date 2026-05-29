export type WSStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "sse-fallback";
export interface WSEventEnvelope {
    readonly channel: string;
    readonly type: string;
    readonly payload: unknown;
    readonly eventId?: string;
}
export type EventHandler = (event: WSEventEnvelope) => void;
export interface WSClient {
    connect(url: string, token: string): void;
    disconnect(): void;
    subscribe(channel: string, handler: EventHandler): () => void;
    onStatusChange(handler: (status: WSStatus) => void): () => void;
    publish(event: WSEventEnvelope): void;
    useSseFallback(): void;
}
export interface WebSocketFactory {
    new (url: string, protocols?: string | string[]): WebSocket;
}
export interface SharedWorkerLike {
    readonly port: MessagePort;
}
export type SharedWorkerFactory = () => SharedWorkerLike;
export interface BrowserWSClientOptions {
    readonly heartbeatIntervalMs?: number;
    readonly heartbeatTimeoutMs?: number;
    readonly replayBufferSize?: number;
    readonly random?: () => number;
}
export declare class InMemoryWSClient implements WSClient {
    private readonly handlers;
    private readonly statusHandlers;
    private status;
    connect(_url: string, _token: string): void;
    disconnect(): void;
    subscribe(channel: string, handler: EventHandler): () => void;
    onStatusChange(handler: (status: WSStatus) => void): () => void;
    publish(event: WSEventEnvelope): void;
    useSseFallback(): void;
    private setStatus;
}
export declare class BrowserWSClient implements WSClient {
    private readonly websocketFactory;
    private readonly fallbackClient;
    private readonly options;
    private readonly handlers;
    private readonly statusHandlers;
    private socket;
    private status;
    private subscribedChannels;
    private reconnectAttempts;
    private readonly maxReconnectAttempts;
    private readonly baseReconnectDelayMs;
    private readonly maxReconnectDelayMs;
    private reconnectTimer;
    private heartbeatTimer;
    private heartbeatDeadlineTimer;
    private readonly replayBufferByChannel;
    private readonly lastEventIdByChannel;
    private lastEventId;
    private currentUrl;
    private currentToken;
    private activeSocketNonce;
    private manualDisconnect;
    constructor(websocketFactory?: WebSocketFactory, fallbackClient?: InMemoryWSClient | null, options?: BrowserWSClientOptions);
    connect(url: string, token: string): void;
    disconnect(): void;
    subscribe(channel: string, handler: EventHandler): () => void;
    onStatusChange(handler: (status: WSStatus) => void): () => void;
    publish(event: WSEventEnvelope): void;
    useSseFallback(): void;
    private establishConnection;
    private handleReconnect;
    private startHeartbeat;
    private stopHeartbeat;
    private clearHeartbeatDeadline;
    private calculateReconnectDelay;
    private scheduleReconnect;
    private clearReconnectTimer;
    private getOpenState;
    private getConnectingState;
    private replayBufferedEvents;
    private rememberEvent;
    private resolveEventId;
    private setStatus;
    private isActiveSocket;
}
export declare class SharedWorkerWSClient implements WSClient {
    private readonly handlers;
    private readonly statusHandlers;
    private readonly port;
    private readonly replayBufferByChannel;
    private disconnected;
    private disconnectTimer;
    constructor(worker: SharedWorkerLike);
    connect(url: string, token: string): void;
    disconnect(): void;
    subscribe(channel: string, handler: EventHandler): () => void;
    onStatusChange(handler: (status: WSStatus) => void): () => void;
    publish(event: WSEventEnvelope): void;
    useSseFallback(): void;
    private readonly handleMessage;
}
export declare function createRuntimeWSClient(socketFactory?: WebSocketFactory, sharedWorkerFactory?: SharedWorkerFactory): WSClient;
