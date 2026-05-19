import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { WebSocket } from "ws";
import { WebSocketBridge, type TaskWebSocketEvent, type WebSocketMessageType } from "../../../../../src/platform/five-plane-interface/channel-gateway/websocket-bridge.js";

class MockApiAuthService {
  authenticate() {
    return { actorId: "actor-1", tenantId: "tenant-1", roles: ["user"] };
  }
}

async function canBindLocalSockets(): Promise<boolean> {
  return await new Promise((resolve) => {
    const probe = createNetServer();
    probe.once("error", () => resolve(false));
    probe.listen(0, "127.0.0.1", () => {
      probe.close(() => resolve(true));
    });
  });
}

const canBindSockets = await canBindLocalSockets();

function networkPathTest(name: string, body: Parameters<typeof test>[1]): void {
  test(name, async (t) => {
    if (!canBindSockets) {
      t.diagnostic("Skipping local socket bind websocket path: local sockets are unavailable in this environment.");
      return;
    }
    await body(t);
  });
}

function createMockServer() {
  return createServer();
}

networkPathTest("WebSocketBridge registers client on connection", (t) => {
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

networkPathTest("WebSocketBridge rejects connection without token", (t) => {
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

networkPathTest("WebSocketBridge ignores JWT passed via query string and still rejects the connection", (t) => {
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

networkPathTest("WebSocketBridge handles ping/pong", (t) => {
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

networkPathTest("WebSocketBridge handles subscribe/unsubscribe", (t) => {
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

networkPathTest("WebSocketBridge broadcasts to task subscribers", (t) => {
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

networkPathTest("WebSocketBridge tracks slow consumers", (t) => {
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

networkPathTest("WebSocketBridge getTaskSubscriberCount returns correct count", (t) => {
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

networkPathTest("WebSocketBridge replays missed task updates from last_event_id on reconnect", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const firstClient = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");
      let phase: "seed" | "replay" = "seed";

      firstClient.on("open", () => {
        firstClient.send(JSON.stringify({ type: "subscribe", taskId: "task-replay" }));
      });

      firstClient.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (phase === "seed" && msg.type === "subscribed") {
          bridge.broadcastToTask("task-replay", {
            eventType: "status_changed",
            taskId: "task-replay",
            status: "running",
            timestamp: new Date().toISOString(),
          }, "evt-1");
          bridge.broadcastToTask("task-replay", {
            eventType: "progress",
            taskId: "task-replay",
            progress: 50,
            timestamp: new Date().toISOString(),
          }, "evt-2");
          phase = "replay";
          firstClient.close();
          const replayClient = new WebSocket(
            `http://127.0.0.1:${address.port}/ws/v1/stream?taskId=task-replay&last_event_id=evt-1`,
            "test-token",
          );
          replayClient.on("message", (replayData: Buffer) => {
            const replayMsg = JSON.parse(replayData.toString());
            if (replayMsg.type === "task_update") {
              assert.equal(replayMsg.eventId, "evt-2");
              replayClient.close();
              bridge.close().then(() => {
                server.close();
                resolve();
              });
            }
          });
          replayClient.on("error", reject);
        }
      });

      firstClient.on("error", reject);
    });
  });
});

networkPathTest("WebSocketBridge emits stream_gap when last_event_id is no longer replayable", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

    bridge.broadcastToTask("task-gap", {
      eventType: "status_changed",
      taskId: "task-gap",
      status: "queued",
      timestamp: new Date().toISOString(),
    }, "evt-latest");

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(
        `http://127.0.0.1:${address.port}/ws/v1/stream?taskId=task-gap&last_event_id=evt-missing`,
        "test-token",
      );

      ws.on("message", (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "stream_gap") {
          assert.equal(msg.fromEventId, "evt-missing");
          assert.equal(msg.toEventId, "evt-latest");
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

networkPathTest("WebSocketBridge rejects subscriptions above per-client cap", (t) => {
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

networkPathTest("WebSocketBridge rejects connections above configured cap", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any, null, { maxConnections: 1 });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const first = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");
      const second = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");

      first.on("open", () => {
        assert.equal(bridge.getClientCount(), 1);
      });
      second.on("close", (code: number) => {
        assert.equal(code, 1013);
        first.close();
        bridge.close().then(() => {
          server.close();
          resolve();
        });
      });

      first.on("error", reject);
      second.on("error", () => {
        // Expected close after the upgrade is rejected by the bridge.
      });
    });
  });
});

networkPathTest("WebSocketBridge enforces global subscription cap and exposes metrics", (t) => {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    const bridge = new WebSocketBridge(server, new MockApiAuthService() as any, null, { maxTotalSubscriptions: 1 });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const ws = new WebSocket(`http://127.0.0.1:${address.port}/ws/v1/stream`, "test-token");

      ws.on("open", () => {
        const serverSideSocket = Array.from((bridge as any).clients.keys())[0];
        assert.equal((bridge as any).subscribeToTask(serverSideSocket, "task-one"), "subscribed");
        assert.equal((bridge as any).subscribeToTask(serverSideSocket, "task-two"), "subscription_limit_exceeded");
        assert.deepEqual(bridge.getMetrics(), {
          clientCount: 1,
          totalSubscriptionCount: 1,
          slowConsumerCount: 0,
          pendingAckCount: 0,
          taskHistoryCount: 0,
        });
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

networkPathTest("WebSocketBridge clears pending acknowledgements on disconnect", async () => {
  const server = createMockServer();
  const bridge = new WebSocketBridge(server, new MockApiAuthService() as any);

  const fakeWs = {
    removeAllListeners: (() => {}) as WebSocket["removeAllListeners"],
  } as unknown as WebSocket;
  const pendingAcks = new Map([[1, { eventId: "evt-1", taskId: "task-a", sentAt: new Date().toISOString() }]]);

  (bridge as any).clients.set(fakeWs, {
    webSocket: fakeWs,
    principal: { actorId: "actor-1", tenantId: "tenant-1", scopes: ["user"] },
    subscribedTasks: new Set(["task-a"]),
    lastEventId: "evt-1",
    nextExpectedSequenceNum: 2,
    lastAcknowledgedSequenceNum: 0,
    pendingAcks,
    bufferedEventCount: 1,
    isAlive: true,
    connectedAt: Date.now(),
    lastActivityAt: Date.now(),
  });
  (bridge as any).taskSubscribers.set("task-a", new Set([fakeWs]));

  (bridge as any).handleDisconnection(fakeWs);

  assert.equal(pendingAcks.size, 0);
  assert.equal(bridge.getMetrics().pendingAckCount, 0);
  await bridge.close();
  server.close();
});

networkPathTest("WebSocketBridge evicts task event history by task count and per-task count", async () => {
  const server = createMockServer();
  const bridge = new WebSocketBridge(server, new MockApiAuthService() as any, null, {
    maxTaskEventHistoryTasks: 2,
    maxTaskEventHistoryPerTask: 2,
  });

  const event: TaskWebSocketEvent = {
    eventType: "status_changed",
    taskId: "task-a",
    status: "queued",
    timestamp: new Date().toISOString(),
  };

  bridge.broadcastToTask("task-a", event, "evt-a-1");
  bridge.broadcastToTask("task-a", event, "evt-a-2");
  bridge.broadcastToTask("task-a", event, "evt-a-3");
  bridge.broadcastToTask("task-b", { ...event, taskId: "task-b" }, "evt-b-1");
  bridge.broadcastToTask("task-c", { ...event, taskId: "task-c" }, "evt-c-1");

  const history = (bridge as any).taskEventHistory as Map<string, Array<{ eventId: string }>>;
  assert.equal(history.has("task-a"), false);
  assert.equal(history.size, 2);
  assert.deepEqual(history.get("task-b")?.map((item) => item.eventId), ["evt-b-1"]);
  assert.deepEqual(history.get("task-c")?.map((item) => item.eventId), ["evt-c-1"]);
  await bridge.close();
  server.close();
});

networkPathTest("WebSocketBridge closes idle clients during heartbeat sweep", async () => {
  const server = createMockServer();
  const bridge = new WebSocketBridge(server, new MockApiAuthService() as any, null, { idleTimeoutMs: 1 });
  let closeCode: number | undefined;

  const fakeWs = {
    OPEN: 1,
    readyState: 1,
    close(code: number) {
      closeCode = code;
    },
    removeAllListeners: (() => {}) as WebSocket["removeAllListeners"],
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
    isAlive: true,
    connectedAt: Date.now() - 10_000,
    lastActivityAt: Date.now() - 10_000,
  });

  (bridge as any).runHeartbeatSweep();

  assert.equal(closeCode, 4000);
  assert.equal(bridge.getClientCount(), 0);
  await bridge.close();
  server.close();
});

networkPathTest("WebSocketBridge removes listeners and subscriptions on disconnect", async () => {
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
    isAlive: true,
    connectedAt: Date.now(),
    lastActivityAt: Date.now(),
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

networkPathTest("WebSocketBridge close resolves even when a client does not finish shutdown", async () => {
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

networkPathTest("WebSocketBridge broadcasts to all connected clients", (t) => {
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

networkPathTest("WebSocketBridge handles ack messages for delivery guarantee", (t) => {
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

networkPathTest("WebSocketMessageType - stream_gap message type", () => {
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

networkPathTest("WebSocketMessageType - backpressure_warning message type", () => {
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

networkPathTest("WebSocketMessageType - ack message type", () => {
  const msg: WebSocketMessageType = {
    type: "ack",
    sequenceNum: 42,
    delivered: true,
  };
  assert.equal(msg.type, "ack");
  assert.equal(msg.sequenceNum, 42);
  assert.equal(msg.delivered, true);
});

networkPathTest("WebSocketBridge handles invalid JSON gracefully", (t) => {
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
