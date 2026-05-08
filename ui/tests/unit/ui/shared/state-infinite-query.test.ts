import { describe, expect, it } from "vitest";
import { flattenCursorPages, createCursorInfiniteQuery } from "../../../../packages/shared/state/src/queries/helpers.ts";

describe("shared state cursor infinite query helpers", () => {
  it("builds a stable infinite-query contract that advances by nextCursor", async () => {
    const query = createCursorInfiniteQuery(
      ["tasks"],
      async (pagination) => ({
        items: [{ id: pagination?.cursor ?? "page-1" }],
        nextCursor: pagination?.cursor == null ? "cursor-2" : null,
        prevCursor: null,
      }),
      { pageSize: 50, sort: "updatedAt:desc" },
    );

    expect(query.queryKey).toEqual(["tasks", { pageSize: 50, sort: "updatedAt:desc", filter: null }]);
    expect(query.initialPageParam).toBeNull();

    const firstPage = await query.queryFn({ pageParam: null });
    const secondPage = await query.queryFn({ pageParam: "cursor-2" });

    expect(firstPage.nextCursor).toBe("cursor-2");
    expect(query.getNextPageParam(firstPage)).toBe("cursor-2");
    expect(secondPage.items[0]?.id).toBe("cursor-2");
  });

  it("flattens infinite-query pages for legacy list consumers", () => {
    expect(
      flattenCursorPages([
        { items: [{ id: "task-1" }], nextCursor: "cursor-2", prevCursor: null },
        { items: [{ id: "task-2" }], nextCursor: null, prevCursor: "cursor-1" },
      ]),
    ).toEqual([{ id: "task-1" }, { id: "task-2" }]);
  });
});
