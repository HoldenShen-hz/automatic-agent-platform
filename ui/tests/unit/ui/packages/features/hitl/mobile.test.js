import { describe, expect, it, vi } from "vitest";
import { createHitlMobileCards } from "../../../../../../packages/features/hitl/src/mobile/index";
describe("createHitlMobileCards", () => {
    it("wires approval and resume quick-action handlers for mobile cards", async () => {
        const approve = vi.fn(async () => undefined);
        const reject = vi.fn(async () => undefined);
        const resume = vi.fn(async () => undefined);
        const items = [
            {
                id: "approval-1",
                type: "approval",
                title: "Review deployment",
                description: "Approve production rollout",
            },
            {
                id: "resume-1",
                type: "resume",
                title: "Resume workflow",
                description: "Continue from checkpoint",
            },
        ];
        const cards = createHitlMobileCards(items, {
            onApprove: approve,
            onReject: reject,
            onResume: resume,
        });
        expect(cards).toHaveLength(3);
        await cards[0]?.onApprove?.();
        await cards[1]?.onReject?.();
        await cards[2]?.onResume?.();
        expect(approve).toHaveBeenCalledWith("approval-1");
        expect(reject).toHaveBeenCalledWith("approval-1");
        expect(resume).toHaveBeenCalledWith("resume-1");
    });
    it("limits the mobile queue to five source items", () => {
        const items = [
            { id: "a1", type: "approval", title: "A1", description: "A1" },
            { id: "a2", type: "approval", title: "A2", description: "A2" },
            { id: "a3", type: "approval", title: "A3", description: "A3" },
            { id: "a4", type: "approval", title: "A4", description: "A4" },
            { id: "a5", type: "approval", title: "A5", description: "A5" },
            { id: "a6", type: "approval", title: "A6", description: "A6" },
        ];
        const cards = createHitlMobileCards(items);
        expect(cards).toHaveLength(10);
        expect(cards.some((card) => card.id.startsWith("a6:"))).toBe(false);
    });
});
