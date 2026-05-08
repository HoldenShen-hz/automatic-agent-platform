import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import { WebSocketBridge, type TaskWebSocketEvent, type WebSocketMessageType } from "../../../../../src/platform/interface/channel-gateway/websocket-bridge.js";

class MockApiAuthService {
  authenticate() {
    return { actorId: "actor-1", tenantId: "tenant-1", roles: ["user"] };
  }
}

function createMockServer() {
  return createServer();
}

test("WebSocketBridge registers client on connection", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");

      ws.on("open", () => {
        assert.equal(bridge.getClientCount(), 1);
        ws.close();
        bridge.close().then(() => {
          server.close();
          resolve();
        });
      });

      ws.on("error", reject);
    });
  });
});

test("WebSocketBridge rejects connection without token", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`);

      ws.on("close", (code: number) => {
        assert.equal(code, 4001);
        bridge.close().then(() => {
          server.close();
          resolve();
        });
      });

      ws.on("error", () => {
        // Expected error due to connection close
      });
    });
  });
});

test("WebSocketBridge ignores JWT passed via query string and still rejects the connection", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream?token=query-token`);

      ws.on("close", (code: number) => {
        assert.equal(code, 4001);
        bridge.close().then(() => {
          server.close();
          resolve();
        });
      });

      ws.on("error", () => {
        // Expected close due to missing Sec-WebSocket-Protocol token.
      });
    });
  });
});

test("WebSocketBridge handles ping/pong", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");

      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "ping" }));
      });

      ws.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        assert.equal(msg.type, "pong");
        ws.close();
        bridge.close().then(() => {
          server.close();
          resolve();
        });
      });

      ws.on("error", reject);
    });
  });
});

test("WebSocketBridge handles subscribe/unsubscribe", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");

      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe", taskId: "task-123" }));
      });

      let foundSubscribed = false;
      let foundUnsubscribed = false;

      ws.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribed") {
          foundSubscribed = true;
          assert.equal(msg.taskId, "task-123");
          ws.send(JSON.stringify({ type: "unsubscribe", taskId: "task-123" }));
        } else if (msg.type === "unsubscribed") {
          foundUnsubscribed = true;
          assert.equal(msg.taskId, "task-123");
          assert.ok(foundSubscribed);
          ws.close();
          bridge.close().then(() => {
            server.close();
            resolve();
          });
        }
      });

      ws.on("error", reject);
    });
  });
});

test("WebSocketBridge broadcasts to task subscribers", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");

      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe", taskId: "task-broadcast" }));
      });

      ws.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribed") {
          const event: TaskWebSocketEvent = {
            eventType: "status_changed",
            taskId: "task-broadcast",
            status: "in_progress",
            timestamp: new Date().toISOString(),
          };
          bridge.broadcastToTask("task-broadcast", event, "evt-1");
        } else if (msg.type === "task_update") {
          assert.equal(msg.taskId, "task-broadcast");
          assert.equal(msg.event.eventType, "status_changed");
          ws.close();
          bridge.close().then(() => {
            server.close();
            resolve();
          });
        }
      });

      ws.on("error", reject);
    });
  });
});

test("WebSocketBridge tracks slow consumers", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");

      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe", taskId: "task-slow" }));
      });

      ws.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribed") {
          // Simulate slow consumer on the server-side socket tracked by the bridge
          const serverSideSocket = Array.from((bridge as any).clients.keys())[0];
          Object.defineProperty(serverSideSocket, "bufferedAmount", { value: 2_000_000, writable: true });
          const event: TaskWebSocketEvent = {
            eventType: "progress",
            taskId: "task-slow",
            progress: 50,
            timestamp: new Date().toISOString(),
          };
          bridge.broadcastToTask("task-slow", event);
          // bufferedAmount > 1MB means slow consumer
        }
      });

      setTimeout(() => {
        assert.equal(bridge.getSlowConsumerCount(), 1);
        ws.close();
        bridge.close().then(() => {
          server.close();
          resolve();
        });
      }, 100);
    });
  });
});

test("WebSocketBridge getTaskSubscriberCount returns correct count", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");

      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe", taskId: "task-count" }));
      });

      ws.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribed") {
          assert.equal(bridge.getTaskSubscriberCount("task-count"), 1);
          ws.close();
          bridge.close().then(() => {
            server.close();
            resolve();
          });
        }
      });

      ws.on("error", reject);
    });
  });
});

test("WebSocketBridge rejects subscriptions above per-client cap", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");

      ws.on("open", () => {
        const serverSideSocket = Array.from((bridge as any).clients.keys())[0];
        for (let index = 0; index < 100; index += 1) {
          const result = (bridge as any).subscribeToTask(serverSideSocket, `task-${index}`);
          assert.equal(result, "subscribed");
        }
        const overflowResult = (bridge as any).subscribeToTask(serverSideSocket, "task-overflow");
        assert.equal(overflowResult, "subscription_limit_exceeded");
        ws.close();
        bridge.close().then(() => {
          server.close();
          resolve();
        });
      });

      ws.on("error", reject);
    });
  });
});

test("WebSocketBridge removes listeners and subscriptions on disconnect", async () => {
  const server = createMockServer();
  const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);
  const removedEvents: string[] = [];
  let removedAllListeners = false;

  const fakeWs = {
    removeAllListeners: ((event?: string) => {
      removedAllListeners = true;
      if (event) {
        removedEvents.push(event);
      }
    }) as WebSocket["removeAllListeners"],
  } as unknown as WebSocket;

  (bridge as any).clients.set(fakeWs, {
    webSocket: fakeWs,
    principal: { actorId: "actor-1", tenantId: "tenant-1", scopes: ["user"] },
    subscribedTasks: new Set(["task-a", "task-b"]),
    lastEventId: null,
    nextExpectedSequenceNum: 0,
    lastAcknowledgedSequenceNum: -1,
    pendingAcks: new Map(),
    bufferedEventCount: 0,
  });
  (bridge as any).taskSubscribers.set("task-a", new Set([fakeWs]));
  (bridge as any).taskSubscribers.set("task-b", new Set([fakeWs]));
  (bridge as any).slowConsumers.add(fakeWs);

  (bridge as any).handleDisconnection(fakeWs);

  assert.equal(removedAllListeners, true);
  assert.equal(bridge.getClientCount(), 0);
  assert.equal(bridge.getTaskSubscriberCount("task-a"), 0);
  assert.equal(bridge.getTaskSubscriberCount("task-b"), 0);
  assert.equal(bridge.getSlowConsumerCount(), 0);
  await bridge.close();
  server.close();
});

test("WebSocketBridge close resolves even when a client does not finish shutdown", async () => {
  const server = createMockServer();
  const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);
  const originalSetTimeout = globalThis.setTimeout;

  try {
    globalThis.setTimeout = ((handler: (...args: any[]) => void, _ms?: number, ...args: any[]) => {
      handler(...args);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;

    const fakeWs = {
      closeCalled: false,
      close() {
        this.closeCalled = true;
      },
    } as unknown as WebSocket;
    (bridge as any).clients.set(fakeWs, {
      webSocket: fakeWs,
      principal: { actorId: "actor-1", tenantId: "tenant-1", scopes: ["user"] },
      subscribedTasks: new Set(),
      lastEventId: null,
      nextExpectedSequenceNum: 0,
      lastAcknowledgedSequenceNum: -1,
      pendingAcks: new Map(),
      bufferedEventCount: 0,
    });
    (bridge as any).wss.close = () => {
      // Intentionally never invoking callback to simulate a hanging shutdown path.
    };

    await bridge.close();
    assert.equal((fakeWs as any).closeCalled, true);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    server.close();
  }
});

test("WebSocketBridge broadcasts to all connected clients", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");

      let messageCount = 0;
      ws.on("open", () => {
        bridge.broadcastToAll({ type: "pong" });
      });

      ws.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "pong") {
          messageCount++;
          assert.ok(messageCount >= 1);
          ws.close();
          bridge.close().then(() => {
            server.close();
            resolve();
          });
        }
      });

      ws.on("error", reject);
    });
  });
});

test("WebSocketBridge handles ack messages for delivery guarantee", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");

      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe", taskId: "task-ack" }));
      });

      ws.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribed") {
          bridge.broadcastToTask("task-ack", {
            eventType: "status_changed",
            taskId: "task-ack",
            status: "in_progress",
            timestamp: new Date().toISOString(),
          }, "evt-ack-1");
        } else if (msg.type === "task_update") {
          ws.send(JSON.stringify({ type: "ack", sequenceNum: msg.sequenceNum, delivered: true }));
          setTimeout(() => {
            const serverSideSocket = Array.from((bridge as any).clients.keys())[0];
            const client = (bridge as any).clients.get(serverSideSocket);
            assert.equal(client?.lastAcknowledgedSequenceNum, msg.sequenceNum);
            assert.equal(client?.pendingAcks.has(msg.sequenceNum), false);
            ws.close();
            bridge.close().then(() => {
              server.close();
              resolve();
            });
          }, 20);
        }
      });

      ws.on("error", reject);
    });
  });
});

test("WebSocketMessageType - stream_gap message type", () => {
  const msg: WebSocketMessageType = {
    type: "stream_gap",
    taskId: "task-123",
    fromEventId: "evt-1",
    toEventId: "evt-5",
    reason: "missed_events",
  };
  assert.equal(msg.type, "stream_gap");
  assert.equal(msg.taskId, "task-123");
  assert.equal(msg.fromEventId, "evt-1");
  assert.equal(msg.toEventId, "evt-5");
  assert.equal(msg.reason, "missed_events");
});

test("WebSocketMessageType - backpressure_warning message type", () => {
  const msg: WebSocketMessageType = {
    type: "backpressure_warning",
    taskId: "task-123",
    bufferedCount: 100,
    reason: "slow_consumer",
  };
  assert.equal(msg.type, "backpressure_warning");
  assert.equal(msg.taskId, "task-123");
  assert.equal(msg.bufferedCount, 100);
  assert.equal(msg.reason, "slow_consumer");
});

test("WebSocketMessageType - ack message type", () => {
  const msg: WebSocketMessageType = {
    type: "ack",
    sequenceNum: 42,
    delivered: true,
  };
  assert.equal(msg.type, "ack");
  assert.equal(msg.sequenceNum, 42);
  assert.equal(msg.delivered, true);
});

test("WebSocketBridge handles invalid JSON gracefully", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");

      ws.on("open", () => {
        ws.send("not valid json {{{");
      });

      ws.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "error") {
          assert.equal(msg.code, "invalid_message");
          ws.close();
          bridge.close().then(() => {
            server.close();
            resolve();
          });
        }
      });

      ws.on("error", () => {
        // Expected
      });
    });
  });
});
