import { describe, expect, it } from "vitest";
import { ConflictResolver } from "@aa/shared-sync";
describe("ConflictResolver", () => {
    it("prefers the most recent object value when merge metadata is present", () => {
        const resolver = new ConflictResolver();
        const merged = resolver.resolve({
            id: "doc-1",
            title: "server",
            updatedAt: "2026-05-01T10:00:00.000Z",
        }, {
            id: "doc-1",
            title: "local",
            updatedAt: "2026-05-01T11:00:00.000Z",
        }, "merge");
        expect(merged).toEqual({
            id: "doc-1",
            title: "local",
            updatedAt: "2026-05-01T11:00:00.000Z",
        });
    });
    it("merges object arrays by identity instead of duplicating stale entries", () => {
        const resolver = new ConflictResolver();
        const merged = resolver.resolve([
            { id: "approval-1", status: "pending", version: 1 },
            { id: "approval-2", status: "approved", version: 1 },
        ], [
            { id: "approval-1", status: "approved", version: 2 },
            { id: "approval-3", status: "pending", version: 1 },
        ], "merge");
        expect(merged).toEqual([
            { id: "approval-1", status: "approved", version: 2 },
            { id: "approval-2", status: "approved", version: 1 },
            { id: "approval-3", status: "pending", version: 1 },
        ]);
    });
});
