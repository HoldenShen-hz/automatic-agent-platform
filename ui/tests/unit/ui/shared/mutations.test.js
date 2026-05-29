import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { useMutation } from "@aa/shared-state";
describe("shared state mutations", () => {
    it("passes the real QueryClient into onMutate and strips path ids from the request body", async () => {
        const post = vi.fn(async () => ({ ok: true }));
        const client = {
            post,
            put: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
            get: vi.fn(),
        };
        const queryClient = new QueryClient();
        const seenQueryClient = [];
        function Harness() {
            const mutation = useMutation({
                client,
                method: "POST",
                path: ({ id }) => `/alerts/${id}/acknowledge`,
                onMutate: async (variables, receivedQueryClient) => {
                    seenQueryClient.push(receivedQueryClient);
                    receivedQueryClient.setQueryData(["alerts"], [variables.reason]);
                    return undefined;
                },
            });
            return createElement("button", {
                type: "button",
                onClick: () => mutation.mutate({ id: "alert-1", reason: "approved" }),
            }, "mutate");
        }
        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Harness)));
        fireEvent.click(screen.getByRole("button", { name: "mutate" }));
        await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
        expect(post).toHaveBeenCalledWith("/alerts/alert-1/acknowledge", { reason: "approved" });
        expect(seenQueryClient[0]).toBe(queryClient);
        expect(queryClient.getQueryData(["alerts"])).toEqual(["approved"]);
    });
    it("always forwards errors to the caller even when onMutate returns no snapshot", async () => {
        const patch = vi.fn(async () => {
            throw new Error("mutation failed");
        });
        const onError = vi.fn();
        const client = {
            post: vi.fn(),
            put: vi.fn(),
            patch,
            delete: vi.fn(),
            get: vi.fn(),
        };
        function Harness() {
            const mutation = useMutation({
                client,
                method: "PATCH",
                path: ({ taskId }) => `/tasks/${taskId}`,
                onMutate: async () => undefined,
                onError,
            });
            return createElement("button", {
                type: "button",
                onClick: () => mutation.mutate({ taskId: "task-1", status: "done" }),
            }, "patch");
        }
        render(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(Harness)));
        fireEvent.click(screen.getByRole("button", { name: "patch" }));
        await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
        expect(onError.mock.calls[0]?.[2]).toEqual({ previousData: [] });
    });
});
