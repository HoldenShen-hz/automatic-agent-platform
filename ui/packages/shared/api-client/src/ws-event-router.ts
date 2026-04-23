import type { QueryClient } from "@tanstack/react-query";
import type { WSEventEnvelope, WSClient } from "./ws-client";

export interface RoutedRealtimeEvent {
  readonly scope: "status" | "query" | "panic";
  readonly queryKey?: readonly string[];
}

export class WSEventRouter {
  private readonly cleanup: Array<() => void> = [];

  public constructor(
    private readonly client: WSClient,
    private readonly queryClient: QueryClient,
    private readonly onPanic?: () => void,
  ) {}

  public connect(url: string, token: string): void {
    this.client.connect(url, token);
  }

  public disconnect(): void {
    for (const dispose of this.cleanup.splice(0, this.cleanup.length)) {
      dispose();
    }
    this.client.disconnect();
  }

  public subscribe(channel: string): void {
    this.cleanup.push(
      this.client.subscribe(channel, (event) => {
        this.route(event);
      }),
    );
  }

  public route(event: WSEventEnvelope): RoutedRealtimeEvent {
    const mapped = mapEventToQuery(event);
    if (mapped.scope === "panic") {
      this.onPanic?.();
      return mapped;
    }
    if (mapped.queryKey != null) {
      void this.queryClient.invalidateQueries({ queryKey: [...mapped.queryKey] });
    }
    return mapped;
  }
}

export function mapEventToQuery(event: WSEventEnvelope): RoutedRealtimeEvent {
  switch (event.type) {
    case "status_changed":
    case "completed":
    case "failed":
      return { scope: "query", queryKey: ["tasks"] };
    case "approval_requested":
    case "approval.resolved":
      return { scope: "query", queryKey: ["approvals"] };
    case "incident.created":
      return { scope: "query", queryKey: ["incidents"] };
    case "dashboard.metric_updated":
      return { scope: "query", queryKey: ["analytics"] };
    case "agent.health_changed":
      return { scope: "query", queryKey: ["agents"] };
    case "panic.activated":
      return { scope: "panic" };
    default:
      return { scope: "status" };
  }
}
