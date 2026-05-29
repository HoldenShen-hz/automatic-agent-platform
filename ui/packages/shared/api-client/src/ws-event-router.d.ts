import type { QueryClient } from "@tanstack/react-query";
import type { WSEventEnvelope, WSClient } from "./ws-client.js";
export interface RoutedRealtimeEvent {
    readonly scope: "status" | "query" | "panic";
    readonly queryKey?: readonly string[];
}
export declare class WSEventRouter {
    private readonly client;
    private readonly queryClient;
    private readonly onPanic?;
    private readonly cleanupByChannel;
    constructor(client: WSClient, queryClient: QueryClient, onPanic?: (() => void) | undefined);
    connect(url: string, token: string): void;
    disconnect(): void;
    subscribe(channel: string): void;
    route(event: WSEventEnvelope): RoutedRealtimeEvent;
}
export declare function mapEventToQuery(event: WSEventEnvelope): RoutedRealtimeEvent;
