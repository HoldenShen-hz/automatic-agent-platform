import { describe, expect, it } from "vitest";
import { endpointCatalog, } from "@aa/shared-api-client";
describe("endpoint contract typing", () => {
    it("keeps typed response/body metadata attached to the endpoint catalog", () => {
        expect(endpointCatalog.tasks.method).toBe("GET");
        expect(endpointCatalog.tasksCreate.method).toBe("POST");
        expect(endpointCatalog.preferences.path).toBe("/v1/preferences");
        expectTypeOf().toMatchTypeOf();
        expectTypeOf().toMatchTypeOf();
        expectTypeOf().toMatchTypeOf();
        expectTypeOf().toMatchTypeOf();
    });
});
