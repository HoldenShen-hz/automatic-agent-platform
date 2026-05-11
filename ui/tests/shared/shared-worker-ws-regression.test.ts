import { describe, expect, it } from "vitest";
import { SharedWorkerWSClient, type WSEventEnvelope, type WSStatus } from "@aa/shared-api-client";

class FakeMessagePort {
  public readonly postedMessages: unknown[] = [];
  private readonly listeners = new Set<(event: MessageEvent<{ type: "status"; status: WSStatus } | { type: "event"; event: WSEventEnvelope }>) => void>();

  public addEventListener(
    type: string,
    listener: (event: MessageEvent<{ type: "status"; status: WSStatus } | { type: "event"; event: WSEventEnvelope }>) => void,
  ): void {
    if (type === "message") {
      this.listeners.add(listener);
    }
  }

  public postMessage(message: unknown): void {
    this.postedMessages.push(message);
  }

  public start(): void {}

  public dispatch(message: { type: "status"; status: WSStatus } | { type: "event"; event: WSEventEnvelope }): void {
    const event = { data: message } as MessageEvent<typeof message>;
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

class FakeSharedWorkerHub {
  public readonly ports: FakeMessagePort[] = [];

  public createWorker(): { port: MessagePort } {
    const port = new FakeMessagePort();
    this.ports.push(port);
    return { port: port as unknown as MessagePort };
  }

  public broadcast(message: { type: "status"; status: WSStatus } | { type: "event"; event: WSEventEnvelope }): void {
    for (const port of this.ports) {
      port.dispatch(message);
    }
  }
}

describe("shared worker websocket fanout", () => {
  it("fans status and channel events out to multiple tabs through the shared worker bridge", () => {
    const hub = new FakeSharedWorkerHub();
    const tabOne = new SharedWorkerWSClient(hub.createWorker() as never);
    const tabTwo = new SharedWorkerWSClient(hub.createWorker() as never);
    const statuses: WSStatus[] = [];
    const tabOneEvents: string[] = [];
    const tabTwoEvents: string[] = [];

    tabOne.onStatusChange((status) => statuses.push(status));
    tabOne.subscribe("tasks", (event) => tabOneEvents.push(String(event.payload)));
    const unsubscribeTabTwo = tabTwo.subscribe("tasks", (event) => tabTwoEvents.push(String(event.payload)));

    tabOne.connect("wss://platform.example.test/realtime", "token-a");
    tabTwo.connect("wss://platform.example.test/realtime", "token-a");

    hub.broadcast({ type: "status", status: "connected" });
    hub.broadcast({
      type: "event",
      event: { channel: "tasks", type: "task.updated", payload: "task-1" },
    });

    expect(statuses).toContain("connected");
    expect(tabOneEvents).toEqual(["task-1"]);
    expect(tabTwoEvents).toEqual(["task-1"]);

    unsubscribeTabTwo();
    hub.broadcast({
      type: "event",
      event: { channel: "tasks", type: "task.updated", payload: "task-2" },
    });

    expect(tabOneEvents).toEqual(["task-1", "task-2"]);
    expect(tabTwoEvents).toEqual(["task-1"]);
  });
});
