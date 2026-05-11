import { describe, expect, it } from "vitest";
import type { TaskDTO, WorkflowDTO, UserPreferenceDTO } from "@aa/shared-types";
import {
  endpointCatalog,
  type EndpointPathParams,
  type EndpointQueryParams,
  type EndpointRequestBody,
  type EndpointResponse,
} from "@aa/shared-api-client";

type Assert<T extends true> = T;
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type _TasksResponse = Assert<IsEqual<EndpointResponse<typeof endpointCatalog.tasks>, readonly TaskDTO[]>>;
type _TasksQuery = Assert<IsEqual<EndpointQueryParams<typeof endpointCatalog.tasks>, {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: string;
  readonly filter?: string;
}>>;
type _CreateTaskBody = Assert<IsEqual<EndpointRequestBody<typeof endpointCatalog.tasksCreate>, Partial<TaskDTO>>>;
type _UpdateTaskPath = Assert<IsEqual<EndpointPathParams<typeof endpointCatalog.tasksUpdate>, { taskId: string }>>;
type _CreateWorkflowBody = Assert<IsEqual<EndpointRequestBody<typeof endpointCatalog.workflowsCreate>, Partial<WorkflowDTO>>>;
type _PreferencesResponse = Assert<IsEqual<EndpointResponse<typeof endpointCatalog.preferences>, UserPreferenceDTO>>;
type _PreferencesBody = Assert<IsEqual<EndpointRequestBody<typeof endpointCatalog.preferences>, never>>;

describe("endpoint contract typing", () => {
  it("keeps typed response/body metadata attached to the endpoint catalog", () => {
    expect(endpointCatalog.tasks.method).toBe("GET");
    expect(endpointCatalog.tasksCreate.method).toBe("POST");
    expect(endpointCatalog.preferences.path).toBe("/preferences");
  });
});
