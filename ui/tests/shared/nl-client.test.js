import { describe, expect, it } from "vitest";
import { InMemoryWSClient } from "../../packages/shared/api-client/src/ws-client";
import { ConversationClient } from "../../packages/shared/nl-client/src/index";
describe("shared nl-client", () => {
    it("keeps an in-memory fallback when no realtime transport is configured", () => {
        const client = new ConversationClient();
        client.send("帮我起草一封邮件");
        client.buildPlan("先起草，再审阅，再发送。");
        const snapshot = client.getSnapshot();
        expect(snapshot.messages).toHaveLength(2);
        expect(snapshot.status).toBe("building");
        expect(snapshot.planReady).toBe(true);
        expect(snapshot.isStreaming).toBe(false);
    });
    it("subscribes to realtime transport and reconciles backend session updates", () => {
        const transport = new InMemoryWSClient();
        const snapshots = [];
        const client = new ConversationClient({
            transport,
            userId: "user-1",
            onStateChange(snapshot) {
                snapshots.push(snapshot.status);
            },
        });
        client.send("帮我发起营销活动");
        transport.publish({
            channel: "nl.session.user-1",
            type: "nl.session.updated",
            payload: {
                status: "reporting",
                messages: [
                    { role: "user", content: "帮我发起营销活动" },
                    { role: "assistant", content: "已生成任务草案。" },
                ],
            },
        });
        transport.publish({
            channel: "nl.plan.created",
            type: "nl.plan.created",
            payload: {
                planBundle: { id: "plan-1" },
                planReady: true,
            },
        });
        const snapshot = client.getSnapshot();
        expect(snapshot.isStreaming).toBe(true);
        expect(snapshot.status).toBe("reporting");
        expect(snapshot.messages).toHaveLength(2);
        expect(snapshot.planReady).toBe(true);
        expect(snapshots).toContain("parsing");
        expect(snapshots).toContain("reporting");
        client.dispose();
        expect(client.getSnapshot().isStreaming).toBe(false);
    });
});
