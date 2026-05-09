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
  const mappings: Record<string, RoutedRealtimeEvent> = {
    status_changed: { scope: "query", queryKey: ["tasks"] },
    progress: { scope: "query", queryKey: ["tasks"] },
    message_delta: { scope: "query", queryKey: ["tasks"] },
    artifact_ready: { scope: "query", queryKey: ["tasks"] },
    completed: { scope: "query", queryKey: ["tasks"] },
    failed: { scope: "query", queryKey: ["tasks"] },
    "task.created": { scope: "query", queryKey: ["tasks"] },
    "task.deleted": { scope: "query", queryKey: ["tasks"] },
    approval_requested: { scope: "query", queryKey: ["approvals"] },
    "approval.created": { scope: "query", queryKey: ["approvals"] },
    "approval.escalated": { scope: "query", queryKey: ["approvals"] },
    "approval.resolved": { scope: "query", queryKey: ["approvals"] },
    "workflow.created": { scope: "query", queryKey: ["workflows"] },
    "workflow.updated": { scope: "query", queryKey: ["workflows"] },
    "workflow.paused": { scope: "query", queryKey: ["workflows"] },
    "workflow.resumed": { scope: "query", queryKey: ["workflows"] },
    "workflow.completed": { scope: "query", queryKey: ["workflows"] },
    "workflow.released": { scope: "query", queryKey: ["workflows"] },
    "worker.created": { scope: "query", queryKey: ["workers"] },
    "worker.health_changed": { scope: "query", queryKey: ["workers"] },
    "worker.heartbeat_missed": { scope: "query", queryKey: ["workers"] },
    "queue.depth_changed": { scope: "query", queryKey: ["queues"] },
    "queue.retry_spike": { scope: "query", queryKey: ["queues"] },
    "queue.dlq_changed": { scope: "query", queryKey: ["queues"] },
    "incident.created": { scope: "query", queryKey: ["incidents"] },
    "incident.updated": { scope: "query", queryKey: ["incidents"] },
    "dashboard.metric_updated": { scope: "query", queryKey: ["analytics"] },
    "analytics.metric_updated": { scope: "query", queryKey: ["analytics"] },
    "agent.health_changed": { scope: "query", queryKey: ["agents"] },
    "agent.load_changed": { scope: "query", queryKey: ["agents"] },
    "nl.session.updated": { scope: "query", queryKey: ["tasks"] },
    "nl.plan.created": { scope: "query", queryKey: ["workflows"] },
    "nl.clarification_needed": { scope: "query", queryKey: ["tasks"] },
    "config.domain.updated": { scope: "query", queryKey: ["domain-configs"] },
    "config.feature-flags.updated": { scope: "query", queryKey: ["feature-flags"] },
    "cost.alert.triggered": { scope: "query", queryKey: ["costs"] },
    "marketplace.pack.updated": { scope: "query", queryKey: ["marketplace"] },
    "explainability.updated": { scope: "query", queryKey: ["explanations"] },
    "tenant.updated": { scope: "query", queryKey: ["tenants"] },
    "webhook.delivery.updated": { scope: "query", queryKey: ["webhooks"] },
    "panic.activated": { scope: "panic" },
  };

  return mappings[event.type] ?? { scope: "status" };
}
