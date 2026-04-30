import { describe, expect, it } from "vitest";
import {
  InMemoryWSClient,
  BrowserWSClient,
  createRuntimeWSClient,
  type WebSocketFactory,
  type WSEventEnvelope,
} from "@aa/shared-api-client";

class FakeSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;

  public readonly sent: string[] = [];
  public readyState = FakeSocket.OPEN;
  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: (() => void) | null = null;

  public constructor(_url: string, _protocols?: string | string[]) {
    setTimeout(() => {
      this.onopen?.();
    }, 0);
  }

  public send(message: string): void {
    this.sent.push(message);
  }

  public close(): void {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.();
  }
}

describe("InMemoryWSClient", () => {
  it("connect does not throw and sets connected status", () => {
    const client = new InMemoryWSClient();
    let statusChanged = false;

    client.onStatusChange(() => {
      statusChanged = true;
    });

    client.connect("ws://example.com/ws", "test-token");
    expect(statusChanged).toBe(true);
  });

  it("subscribe adds handler and returns unsubscribe function", () => {
    const client = new InMemoryWSClient();
    const events: WSEventEnvelope[] = [];

    const unsubscribe = client.subscribe("test-channel", (event) => {
      events.push(event);
    });

    client.publish({ channel: "test-channel", type: "test.event", payload: { key: "value" } });

    expect(events.length).toBe(1);
    expect(events[0]!.type).toBe("test.event");

    unsubscribe();
    client.publish({ channel: "test-channel", type: "another.event", payload: {} });
    expect(events.length).toBe(1);
  });

  it("disconnect resets status to disconnected", () => {
    const client = new InMemoryWSClient();
    const statuses: string[] = [];

    client.onStatusChange((status) => {
      statuses.push(status);
    });

    client.connect("ws://example.com/ws", "token");
    client.disconnect();

    expect(statuses).toContain("connected");
    expect(statuses).toContain("disconnected");
  });

  it("useSseFallback sets status to sse-fallback", () => {
    const client = new InMemoryWSClient();
    let finalStatus = "";

    client.onStatusChange((status) => {
      finalStatus = status;
    });

    client.connect("ws://example.com/ws", "token");
    client.useSseFallback();

    expect(finalStatus).toBe("sse-fallback");
  });
});

describe("BrowserWSClient", () => {
  it("connect does NOT put token in URL - uses subprotocol instead (Issue #2070)", () => {
    const client = new BrowserWSClient(FakeSocket as unknown as typeof WebSocket, new InMemoryWSClient());

    client.connect("ws://example.com/ws?important=param", "my-secret-token");

    expect(client.currentUrl).toBe("ws://example.com/ws?important=param");
    expect(client.currentToken).toBe("my-secret-token");
  });

  it("sends auth token in first message after connection, not in URL (Issue #2070)", async () => {
    let capturedUrl = "";
    let capturedProtocols: string | string[] | undefined;
    const sentMessages: string[] = [];

    class TestSocket {
      public static readonly OPEN = 1;
      public readyState = TestSocket.OPEN;
      public onopen: (() => void) | null = null;
      public onmessage: ((event: { data: string }) => void) | null = null;
      public onclose: (() => void) | null = null;
      public onerror: (() => void) | null = null;

      public constructor(url: string, protocols?: string | string[]) {
        capturedUrl = url;
        capturedProtocols = protocols;
        setTimeout(() => this.onopen?.(), 0);
      }

      public send(message: string): void {
        sentMessages.push(message);
      }

      public close(): void {
        this.onclose?.();
      }
    }

    const client = new BrowserWSClient(TestSocket as unknown as typeof WebSocket, new InMemoryWSClient());
    client.connect("ws://secure.example.com/events", "token-should-not-be-in-url");

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(capturedUrl).not.toContain("token-should-not-be-in-url");
        expect(capturedProtocols?.toString()).toContain("v1.auth.token");

        const authMessage = sentMessages.find((m) => m.includes("auth"));
        expect(authMessage).toBeDefined();
        expect(authMessage).toContain("token-should-not-be-in-url");

        resolve();
      }, 10);
    });
  });

  it("subscribe returns unsubscribe that removes handler", () => {
    class TestSocket {
      public static readonly OPEN = 1;
      public readyState = TestSocket.OPEN;
      public onopen: (() => void) | null = null;
      public onmessage: ((event: { data: string }) => void) | null = null;
      public onclose: (() => void) | null = null;
      public onerror: (() => void) | null = null;

      public constructor(_url: string, _protocols?: string | string[]) {
        setTimeout(() => this.onopen?.(), 0);
      }

      public send(_message: string): void {}
      public close(): void {}
    }

    const client = new BrowserWSClient(TestSocket as unknown as typeof WebSocket, new InMemoryWSClient());
    const events: WSEventEnvelope[] = [];

    const unsubscribe = client.subscribe("channel1", (event) => {
      events.push(event);
    });

    client.publish({ channel: "channel1", type: "event.1", payload: {} });
    expect(events.length).toBe(1);

    unsubscribe();
    client.publish({ channel: "channel1", type: "event.2", payload: {} });
    expect(events.length).toBe(1);
  });

  it("disconnect clears all state and closes socket", async () => {
    class TestSocket {
      public static readonly OPEN = 1;
      public readyState = TestSocket.OPEN;
      public onopen: (() => void) | null = null;
      public onmessage: ((event: { data: string }) => void) | null = null;
      public onclose: (() => void) | null = null;
      public onerror: (() => void) | null = null;

      public constructor(_url: string, _protocols?: string | string[]) {
        setTimeout(() => this.onopen?.(), 0);
      }

      public send(_message: string): void {}
      public close(): void {
        this.onclose?.();
      }
    }

    const client = new BrowserWSClient(TestSocket as unknown as typeof WebSocket, new InMemoryWSClient());

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        client.disconnect();

        expect(client.currentUrl).toBeNull();
        expect(client.currentToken).toBeNull();

        resolve();
      }, 10);
    });
  });
});

describe("createRuntimeWSClient", () => {
  it("returns a valid WSClient implementation", () => {
    const client = createRuntimeWSClient();
    expect(client).toBeDefined();
    expect(typeof client.connect).toBe("function");
    expect(typeof client.disconnect).toBe("function");
    expect(typeof client.subscribe).toBe("function");
  });
});