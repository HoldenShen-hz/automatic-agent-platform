import { describe, expect, it } from "vitest";
import { SharedWorkerWSClient } from "@aa/shared-api-client";
class FakeMessagePort {
    postedMessages = [];
    listeners = new Set();
    addEventListener(type, listener) {
        if (type === "message") {
            this.listeners.add(listener);
        }
    }
    postMessage(message) {
        this.postedMessages.push(message);
    }
    start() { }
    dispatch(message) {
        const event = { data: message };
        for (const listener of this.listeners) {
            listener(event);
        }
    }
}
class FakeSharedWorkerHub {
    ports = [];
    createWorker() {
        const port = new FakeMessagePort();
        this.ports.push(port);
        return { port: port };
    }
    broadcast(message) {
        for (const port of this.ports) {
            port.dispatch(message);
        }
    }
}
describe("shared worker websocket fanout", () => {
    it("fans status and channel events out to multiple tabs through the shared worker bridge", () => {
        const hub = new FakeSharedWorkerHub();
        const tabOne = new SharedWorkerWSClient(hub.createWorker());
        const tabTwo = new SharedWorkerWSClient(hub.createWorker());
        const statuses = [];
        const tabOneEvents = [];
        const tabTwoEvents = [];
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
