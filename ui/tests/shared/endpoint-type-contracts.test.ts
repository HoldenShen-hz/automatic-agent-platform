import { describe, expect, it } from "vitest";
import type { TaskDTO, WorkflowDTO, UserPreferenceDTO } from "@aa/shared-types";
import {
  endpointCatalog,
} from "@aa/shared-api-client";

describe("endpoint contract typing", () => {
  it("keeps typed response/body metadata attached to the endpoint catalog", () => {
    expect(endpointCatalog.tasks.method).toBe("GET");
    expect(endpointCatalog.tasksCreate.method).toBe("POST");
    expect(endpointCatalog.preferences.path).toBe("/preferences");
    expectTypeOf<TaskDTO[]>().toMatchTypeOf<readonly TaskDTO[]>();
    expectTypeOf<Partial<TaskDTO>>().toMatchTypeOf<Partial<TaskDTO>>();
    expectTypeOf<Partial<WorkflowDTO>>().toMatchTypeOf<Partial<WorkflowDTO>>();
    expectTypeOf<UserPreferenceDTO>().toMatchTypeOf<UserPreferenceDTO>();
  });
});
