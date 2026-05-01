/**
 * SCIM User and Group Sync Service
 *
 * Implements SCIM 2.0 protocol for user and group provisioning.
 * Supports /scim/v2/Users and /scim/v2/Groups endpoints with
 * CRUD operations and incremental sync.
 *
 * Architecture: §48 SSO/SCIM - P1 SCIM Endpoints
 * @see docs_zh/architecture/00-platform-architecture.md §48
 */

import { newId, nowIso } from "../../../platform/contracts/types/ids.js";

// ─────────────────────────────────────────────────────────────────────────────
// SCIM Schema Types
// ─────────────────────────────────────────────────────────────────────────────

export const ScimUserSchema = {
  schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
  id: "",
  userName: "",
  name: {
    formatted: "",
    familyName: "",
    givenName: "",
  },
  displayName: "",
  emails: [{ value: "", primary: true }],
  active: true,
  groups: [],
  meta: {
    resourceType: "User",
    created: "",
    lastModified: "",
  },
} as const;

export const ScimGroupSchema = {
  schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
  id: "",
  displayName: "",
  members: [],
  meta: {
    resourceType: "Group",
    created: "",
    lastModified: "",
  },
} as const;

export interface ScimUser {
  readonly id: string;
  readonly userName: string;
  readonly name: {
    readonly formatted: string;
    readonly familyName: string;
    readonly givenName: string;
  };
  readonly displayName: string;
  readonly emails: readonly {
    readonly value: string;
    readonly primary: boolean;
  }[];
  readonly active: boolean;
  readonly groups: readonly { value: string; display: string }[];
  readonly meta: {
    readonly resourceType: "User";
    readonly created: string;
    readonly lastModified: string;
  };
}

export interface ScimGroup {
  readonly id: string;
  readonly displayName: string;
  readonly members: readonly { value: string; display: string }[];
  readonly meta: {
    readonly resourceType: "Group";
    readonly created: string;
    readonly lastModified: string;
  };
}

export interface ScimListResponse<T> {
  readonly schemas: readonly string[];
  readonly totalResults: number;
  readonly startIndex: number;
  readonly itemsPerPage: number;
  readonly Resources: readonly T[];
}

export interface ScimPatchOperation {
  readonly op: "add" | "replace" | "remove";
  readonly path?: string;
  readonly value?: unknown;
}

export interface ScimBulkOperation {
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly bulkId?: string;
  readonly data?: unknown;
}

export interface ScimBulkRequest {
  readonly schemas: readonly ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"];
  readonly failOnErrors?: number;
  readonly Operations: readonly ScimBulkOperation[];
}

export interface ScimBulkOperationResponse {
  readonly method: ScimBulkOperation["method"];
  readonly bulkId?: string;
  readonly location: string;
  readonly status: string;
  readonly response?: unknown;
}

export interface ScimBulkResponse {
  readonly schemas: readonly ["urn:ietf:params:scim:api:messages:2.0:BulkResponse"];
  readonly Operations: readonly ScimBulkOperationResponse[];
}

export interface ScimProvisionEvent {
  readonly eventId: string;
  readonly action: "user_created" | "user_updated" | "user_disabled" | "user_deleted" | "group_updated";
  readonly subjectId: string;
  readonly occurredAt: string;
  readonly tenantId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCIM Service
// ─────────────────────────────────────────────────────────────────────────────

export class ScimProvisionService {
  // §48 P1: Tenant isolation - all Maps must be scoped by tenantId (issue #1972)
  // Global Maps without tenant scoping allow cross-tenant data access
  private readonly usersByTenant = new Map<string, Map<string, ScimUser>>();
  private readonly groupsByTenant = new Map<string, Map<string, ScimGroup>>();
  private readonly userByUsernameByTenant = new Map<string, Map<string, string>>();
  private readonly userByEmailByTenant = new Map<string, Map<string, string>>();
  private readonly groupByNameByTenant = new Map<string, Map<string, string>>();
  private readonly events: ScimProvisionEvent[] = [];

  // Helper to get or create tenant-scoped map
  private getTenantUsers(tenantId: string): Map<string, ScimUser> {
    if (!this.usersByTenant.has(tenantId)) {
      this.usersByTenant.set(tenantId, new Map());
    }
    return this.usersByTenant.get(tenantId)!;
  }

  private getTenantGroups(tenantId: string): Map<string, ScimGroup> {
    if (!this.groupsByTenant.has(tenantId)) {
      this.groupsByTenant.set(tenantId, new Map());
    }
    return this.groupsByTenant.get(tenantId)!;
  }

  private getTenantUserByUsername(tenantId: string): Map<string, string> {
    if (!this.userByUsernameByTenant.has(tenantId)) {
      this.userByUsernameByTenant.set(tenantId, new Map());
    }
    return this.userByUsernameByTenant.get(tenantId)!;
  }

  private getTenantUserByEmail(tenantId: string): Map<string, string> {
    if (!this.userByEmailByTenant.has(tenantId)) {
      this.userByEmailByTenant.set(tenantId, new Map());
    }
    return this.userByEmailByTenant.get(tenantId)!;
  }

  private getTenantGroupByName(tenantId: string): Map<string, string> {
    if (!this.groupByNameByTenant.has(tenantId)) {
      this.groupByNameByTenant.set(tenantId, new Map());
    }
    return this.groupByNameByTenant.get(tenantId)!;
  }

  /**
   * Creates a new SCIM user.
   *
   * @param user - User data
   * @param tenantId - Tenant ID
   * @returns Created user
   */
  public createUser(user: Omit<ScimUser, "id" | "meta">, tenantId: string): ScimUser {
    // §48 P1: Tenant isolation - scope all lookups by tenantId (issue #1972)
    const tenantUsers = this.getTenantUsers(tenantId);
    const tenantUserByUsername = this.getTenantUserByUsername(tenantId);
    const tenantUserByEmail = this.getTenantUserByEmail(tenantId);

    // SECURITY FIX: Validate userName uniqueness before creation to prevent duplicate index entries
    const existingUserId = tenantUserByUsername.get(user.userName.toLowerCase());
    if (existingUserId != null) {
      throw new Error(`scim.userName_already_exists:${user.userName}`);
    }

    const id = newId("scim_user");
    const now = nowIso();

    const scimUser: ScimUser = {
      ...user,
      id,
      meta: {
        resourceType: "User",
        created: now,
        lastModified: now,
      },
    };

    tenantUsers.set(id, scimUser);
    tenantUserByUsername.set(user.userName.toLowerCase(), id);

    const primaryEmail = user.emails.find((e) => e.primary)?.value;
    if (primaryEmail) {
      tenantUserByEmail.set(primaryEmail.toLowerCase(), id);
    }

    this.recordEvent("user_created", id, tenantId);

    return scimUser;
  }

  /**
   * Gets a user by ID.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID (required for tenant isolation)
   * @returns User or null
   */
  public getUser(userId: string, tenantId: string): ScimUser | null {
    const tenantUsers = this.getTenantUsers(tenantId);
    return tenantUsers.get(userId) ?? null;
  }

  /**
   * Gets a user by username.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param userName - Username
   * @param tenantId - Tenant ID (required for tenant isolation)
   * @returns User or null
   */
  public getUserByUsername(userName: string, tenantId: string): ScimUser | null {
    const tenantUsers = this.getTenantUsers(tenantId);
    const tenantUserByUsername = this.getTenantUserByUsername(tenantId);
    const userId = tenantUserByUsername.get(userName.toLowerCase());
    return userId ? tenantUsers.get(userId) ?? null : null;
  }

  /**
   * Gets a user by email.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param email - Email address
   * @param tenantId - Tenant ID (required for tenant isolation)
   * @returns User or null
   */
  public getUserByEmail(email: string, tenantId: string): ScimUser | null {
    const tenantUsers = this.getTenantUsers(tenantId);
    const tenantUserByEmail = this.getTenantUserByEmail(tenantId);
    const userId = tenantUserByEmail.get(email.toLowerCase());
    return userId ? tenantUsers.get(userId) ?? null : null;
  }

  /**
   * Updates an existing user.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param userId - User ID
   * @param updates - Partial user data
   * @param tenantId - Tenant ID
   * @returns Updated user or null
   */
  public updateUser(userId: string, updates: Partial<Omit<ScimUser, "id" | "meta">>, tenantId: string): ScimUser | null {
    // §48 P1: Tenant isolation - scope all lookups by tenantId (issue #1972)
    const tenantUsers = this.getTenantUsers(tenantId);
    const tenantUserByUsername = this.getTenantUserByUsername(tenantId);
    const tenantUserByEmail = this.getTenantUserByEmail(tenantId);

    const existing = tenantUsers.get(userId);
    if (!existing) return null;

    const updatedUser: ScimUser = {
      ...existing,
      ...updates,
      id: existing.id,
      meta: {
        ...existing.meta,
        lastModified: nowIso(),
      },
    };

    tenantUsers.set(userId, updatedUser);

    if (updates.userName) {
      tenantUserByUsername.delete(existing.userName.toLowerCase());
      tenantUserByUsername.set(updates.userName.toLowerCase(), userId);
    }

    if (updates.emails) {
      for (const email of existing.emails) {
        tenantUserByEmail.delete(email.value.toLowerCase());
      }
      const primaryEmail = updates.emails.find((e) => e.primary)?.value;
      if (primaryEmail) {
        tenantUserByEmail.set(primaryEmail.toLowerCase(), userId);
      }
    }

    this.recordEvent("user_updated", userId, tenantId);

    return updatedUser;
  }

  /**
   * Disables a user (soft delete).
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns Updated user or null
   */
  public disableUser(userId: string, tenantId: string): ScimUser | null {
    return this.updateUser(userId, { active: false }, tenantId);
  }

  /**
   * Permanently deletes a user.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns true if deleted
   */
  public deleteUser(userId: string, tenantId: string): boolean {
    // §48 P1: Tenant isolation - scope all lookups by tenantId (issue #1972)
    const tenantUsers = this.getTenantUsers(tenantId);
    const tenantUserByUsername = this.getTenantUserByUsername(tenantId);
    const tenantUserByEmail = this.getTenantUserByEmail(tenantId);
    const tenantGroups = this.getTenantGroups(tenantId);

    const existing = tenantUsers.get(userId);
    if (!existing) return false;

    tenantUsers.delete(userId);
    tenantUserByUsername.delete(existing.userName.toLowerCase());

    for (const email of existing.emails) {
      tenantUserByEmail.delete(email.value.toLowerCase());
    }

    // Remove from all tenant groups
    for (const group of tenantGroups.values()) {
      if (group.members.some((m) => m.value === userId)) {
        this.removeMemberFromGroup(group.id, userId, tenantId);
      }
    }

    this.recordEvent("user_deleted", userId, tenantId);

    return true;
  }

  /**
   * Lists users with optional filtering.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param options - Query options including tenantId
   * @returns Paginated user list
   */
  public listUsers(options: {
    filter?: string;
    startIndex?: number;
    count?: number;
    tenantId: string;
  }): ScimListResponse<ScimUser> {
    const { startIndex = 1, count = 100, tenantId } = options;

    const tenantUsers = this.getTenantUsers(tenantId);
    let users = Array.from(tenantUsers.values());

    // Apply filter if provided (simple filter parsing)
    if (options.filter) {
      users = this.applyFilter(users, options.filter);
    }

    const totalResults = users.length;
    const start = Math.max(0, startIndex - 1);
    const end = Math.min(start + count, users.length);

    return {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults,
      startIndex,
      itemsPerPage: count,
      Resources: users.slice(start, end),
    };
  }

  /**
   * Creates a new SCIM group.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param group - Group data
   * @param tenantId - Tenant ID
   * @returns Created group
   */
  public createGroup(group: { displayName: string; members?: readonly { value: string; display: string }[] }, tenantId: string): ScimGroup {
    const tenantGroups = this.getTenantGroups(tenantId);
    const tenantGroupByName = this.getTenantGroupByName(tenantId);

    const id = newId("scim_group");
    const now = nowIso();

    const scimGroup: ScimGroup = {
      id,
      displayName: group.displayName,
      members: group.members ?? [],
      meta: {
        resourceType: "Group",
        created: now,
        lastModified: now,
      },
    };

    tenantGroups.set(id, scimGroup);
    tenantGroupByName.set(group.displayName.toLowerCase(), id);

    this.recordEvent("group_updated", id, tenantId);

    return scimGroup;
  }

  /**
   * Gets a group by ID.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param groupId - Group ID
   * @param tenantId - Tenant ID
   * @returns Group or null
   */
  public getGroup(groupId: string, tenantId: string): ScimGroup | null {
    const tenantGroups = this.getTenantGroups(tenantId);
    return tenantGroups.get(groupId) ?? null;
  }

  /**
   * Gets a group by name.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param displayName - Group display name
   * @param tenantId - Tenant ID
   * @returns Group or null
   */
  public getGroupByName(displayName: string, tenantId: string): ScimGroup | null {
    const tenantGroups = this.getTenantGroups(tenantId);
    const tenantGroupByName = this.getTenantGroupByName(tenantId);
    const groupId = tenantGroupByName.get(displayName.toLowerCase());
    return groupId ? tenantGroups.get(groupId) ?? null : null;
  }

  /**
   * Updates an existing group.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param groupId - Group ID
   * @param updates - Partial group data
   * @param tenantId - Tenant ID
   * @returns Updated group or null
   */
  public updateGroup(groupId: string, updates: Partial<Pick<ScimGroup, "displayName" | "members">>, tenantId: string): ScimGroup | null {
    const tenantGroups = this.getTenantGroups(tenantId);
    const tenantGroupByName = this.getTenantGroupByName(tenantId);

    const existing = tenantGroups.get(groupId);
    if (!existing) return null;

    const updatedGroup: ScimGroup = {
      ...existing,
      ...updates,
      id: existing.id,
      meta: {
        ...existing.meta,
        lastModified: nowIso(),
      },
    };

    tenantGroups.set(groupId, updatedGroup);

    if (updates.displayName) {
      tenantGroupByName.delete(existing.displayName.toLowerCase());
      tenantGroupByName.set(updates.displayName.toLowerCase(), groupId);
    }

    this.recordEvent("group_updated", groupId, tenantId);

    return updatedGroup;
  }

  /**
   * Deletes a group.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param groupId - Group ID
   * @param tenantId - Tenant ID
   * @returns true if deleted
   */
  public deleteGroup(groupId: string, tenantId: string): boolean {
    const tenantGroups = this.getTenantGroups(tenantId);
    const tenantGroupByName = this.getTenantGroupByName(tenantId);
    const tenantUsers = this.getTenantUsers(tenantId);

    const existing = tenantGroups.get(groupId);
    if (!existing) return false;

    tenantGroups.delete(groupId);
    tenantGroupByName.delete(existing.displayName.toLowerCase());

    // Remove group reference from all tenant users
    for (const user of tenantUsers.values()) {
      if (user.groups.some((g) => g.value === groupId)) {
        const updatedGroups = user.groups.filter((g) => g.value !== groupId);
        this.updateUser(user.id, { groups: updatedGroups }, tenantId);
      }
    }

    return true;
  }

  /**
   * Lists groups with optional filtering.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param options - Query options including tenantId
   * @returns Paginated group list
   */
  public listGroups(options: {
    filter?: string;
    startIndex?: number;
    count?: number;
    tenantId: string;
  }): ScimListResponse<ScimGroup> {
    const { startIndex = 1, count = 100, tenantId } = options;

    const tenantGroups = this.getTenantGroups(tenantId);
    let groups = Array.from(tenantGroups.values());

    if (options.filter) {
      groups = this.applyFilter(groups, options.filter);
    }

    const totalResults = groups.length;
    const start = Math.max(0, startIndex - 1);
    const end = Math.min(start + count, groups.length);

    return {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults,
      startIndex,
      itemsPerPage: count,
      Resources: groups.slice(start, end),
    };
  }

  /**
   * Adds a member to a group.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param groupId - Group ID
   * @param userId - User ID to add
   * @param tenantId - Tenant ID
   * @returns Updated group or null
   */
  public addMemberToGroup(groupId: string, userId: string, tenantId: string): ScimGroup | null {
    const tenantGroups = this.getTenantGroups(tenantId);
    const tenantUsers = this.getTenantUsers(tenantId);

    const group = tenantGroups.get(groupId);
    const user = tenantUsers.get(userId);

    if (!group || !user) return null;

    if (group.members.some((m) => m.value === userId)) {
      return group; // Already a member
    }

    const newMembers = [...group.members, { value: userId, display: user.displayName }];
    return this.updateGroup(groupId, { members: newMembers }, tenantId);
  }

  /**
   * Removes a member from a group.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param groupId - Group ID
   * @param userId - User ID to remove
   * @param tenantId - Tenant ID
   * @returns Updated group or null
   */
  public removeMemberFromGroup(groupId: string, userId: string, tenantId: string): ScimGroup | null {
    const tenantGroups = this.getTenantGroups(tenantId);
    const group = tenantGroups.get(groupId);
    if (!group) return null;

    const newMembers = group.members.filter((m) => m.value !== userId);
    return this.updateGroup(groupId, { members: newMembers }, tenantId);
  }

  /**
   * Applies a SCIM patch operation.
   * §48 P1: Tenant isolation - requires tenantId to prevent cross-tenant data access (issue #1972)
   *
   * @param groupId - Target group ID
   * @param operations - Patch operations
   * @param tenantId - Tenant ID
   * @returns Updated group or null
   */
  public patchGroup(groupId: string, operations: readonly ScimPatchOperation[], tenantId: string): ScimGroup | null {
    const tenantGroups = this.getTenantGroups(tenantId);
    const tenantUsers = this.getTenantUsers(tenantId);

    const group = tenantGroups.get(groupId);
    if (!group) return null;

    let updatedMembers = [...group.members];

    for (const op of operations) {
      switch (op.op) {
        case "add":
        case "replace":
          if (op.path === "members" && Array.isArray(op.value)) {
            for (const member of op.value as { value: string }[]) {
              if (!updatedMembers.some((m) => m.value === member.value)) {
                const user = tenantUsers.get(member.value);
                updatedMembers.push({ value: member.value, display: user?.displayName ?? member.value });
              }
            }
          }
          break;
        case "remove":
          if (op.path?.includes("members")) {
            // SECURITY FIX: Parse path to extract member value filter.
            // Previously cleared ALL members instead of removing specific members
            // when path was "members[value eq \"xxx\"]".
            const memberFilterMatch = op.path.match(/members\[value\s+eq\s+"([^"]+)"\]/);
            if (memberFilterMatch) {
              const targetValue = memberFilterMatch[1];
              updatedMembers = updatedMembers.filter((m) => m.value !== targetValue);
            } else {
              updatedMembers = [];
            }
          }
          break;
      }
    }

    return this.updateGroup(groupId, { members: updatedMembers }, tenantId);
  }

  /**
   * Gets all provision events for incremental sync.
   *
   * @param since - Timestamp to get events since
   * @param tenantId - Tenant ID
   * @returns Array of provision events
   */
  public getProvisionEvents(since: string, tenantId: string): ScimProvisionEvent[] {
    const sinceTime = new Date(since).getTime();
    return this.events.filter((e) => new Date(e.occurredAt).getTime() >= sinceTime && e.tenantId === tenantId);
  }

  /**
   * Gets total user count across all tenants.
   */
  public getUserCount(): number {
    let total = 0;
    for (const tenantUsers of this.usersByTenant.values()) {
      total += tenantUsers.size;
    }
    return total;
  }

  /**
   * Gets total group count across all tenants.
   */
  public getGroupCount(): number {
    let total = 0;
    for (const tenantGroups of this.groupsByTenant.values()) {
      total += tenantGroups.size;
    }
    return total;
  }

  /**
   * Processes a SCIM Bulk request.
   *
   * Supports POST/PUT/PATCH/DELETE for `/Users` and `/Groups` resources and resolves
   * `bulkId` references within the same request.
   */
  public processBulkRequest(request: ScimBulkRequest, tenantId: string): ScimBulkResponse {
    const bulkIdMap = new Map<string, string>();
    const responses: ScimBulkOperationResponse[] = [];
    const failOnErrors = request.failOnErrors ?? Number.POSITIVE_INFINITY;
    let errorCount = 0;

    for (const operation of request.Operations) {
      if (errorCount >= failOnErrors) {
        responses.push({
          method: operation.method,
          ...(operation.bulkId ? { bulkId: operation.bulkId } : {}),
          location: this.resolveBulkLocation(operation.path, bulkIdMap),
          status: "424",
          response: { detail: "Skipped due to failOnErrors threshold" },
        });
        continue;
      }

      try {
        const result = this.executeBulkOperation(operation, tenantId, bulkIdMap);
        responses.push(result);
        if (operation.bulkId && result.response && typeof result.response === "object" && "id" in (result.response as Record<string, unknown>)) {
          bulkIdMap.set(operation.bulkId, String((result.response as Record<string, unknown>).id));
        }
      } catch (error) {
        errorCount += 1;
        responses.push({
          method: operation.method,
          ...(operation.bulkId ? { bulkId: operation.bulkId } : {}),
          location: this.resolveBulkLocation(operation.path, bulkIdMap),
          status: "400",
          response: {
            detail: error instanceof Error ? error.message : "Bulk operation failed",
          },
        });
      }
    }

    return {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkResponse"],
      Operations: responses,
    };
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  private executeBulkOperation(
    operation: ScimBulkOperation,
    tenantId: string,
    bulkIdMap: Map<string, string>,
  ): ScimBulkOperationResponse {
    const resolvedPath = this.resolveBulkLocation(operation.path, bulkIdMap);
    const resolvedData = this.resolveBulkReferences(operation.data, bulkIdMap);
    const { resourceType, resourceId } = this.parseBulkPath(resolvedPath);

    if (operation.method === "POST" && resourceId === null) {
      if (resourceType === "Users") {
        const user = this.createUser(resolvedData as Omit<ScimUser, "id" | "meta">, tenantId);
        return {
          method: operation.method,
          ...(operation.bulkId ? { bulkId: operation.bulkId } : {}),
          location: `/Users/${user.id}`,
          status: "201",
          response: user,
        };
      }
      const group = this.createGroup(resolvedData as { displayName: string; members?: readonly { value: string; display: string }[] }, tenantId);
      return {
        method: operation.method,
        ...(operation.bulkId ? { bulkId: operation.bulkId } : {}),
        location: `/Groups/${group.id}`,
        status: "201",
        response: group,
      };
    }

    if (resourceId == null) {
      throw new Error(`bulk.invalid_path:${resolvedPath}`);
    }

    if (resourceType === "Users") {
      return this.executeUserBulkOperation({ ...operation, data: resolvedData }, resourceId, tenantId);
    }
    return this.executeGroupBulkOperation({ ...operation, data: resolvedData }, resourceId, tenantId);
  }

  private executeUserBulkOperation(
    operation: ScimBulkOperation,
    userId: string,
    tenantId: string,
  ): ScimBulkOperationResponse {
    if (operation.method === "PUT") {
      const updated = this.updateUser(userId, operation.data as Partial<Omit<ScimUser, "id" | "meta">>, tenantId);
      if (!updated) throw new Error(`bulk.user_not_found:${userId}`);
      return { method: operation.method, ...(operation.bulkId ? { bulkId: operation.bulkId } : {}), location: `/Users/${userId}`, status: "200", response: updated };
    }

    if (operation.method === "PATCH") {
      const updated = this.patchUser(userId, operation.data as readonly ScimPatchOperation[], tenantId);
      if (!updated) throw new Error(`bulk.user_not_found:${userId}`);
      return { method: operation.method, ...(operation.bulkId ? { bulkId: operation.bulkId } : {}), location: `/Users/${userId}`, status: "200", response: updated };
    }

    if (operation.method === "DELETE") {
      const deleted = this.deleteUser(userId, tenantId);
      if (!deleted) throw new Error(`bulk.user_not_found:${userId}`);
      return { method: operation.method, ...(operation.bulkId ? { bulkId: operation.bulkId } : {}), location: `/Users/${userId}`, status: "204" };
    }

    throw new Error(`bulk.unsupported_method:${operation.method}`);
  }

  private executeGroupBulkOperation(
    operation: ScimBulkOperation,
    groupId: string,
    tenantId: string,
  ): ScimBulkOperationResponse {
    if (operation.method === "PUT") {
      const updated = this.updateGroup(groupId, operation.data as Partial<Pick<ScimGroup, "displayName" | "members">>, tenantId);
      if (!updated) throw new Error(`bulk.group_not_found:${groupId}`);
      return { method: operation.method, ...(operation.bulkId ? { bulkId: operation.bulkId } : {}), location: `/Groups/${groupId}`, status: "200", response: updated };
    }

    if (operation.method === "PATCH") {
      const updated = this.patchGroup(groupId, operation.data as readonly ScimPatchOperation[], tenantId);
      if (!updated) throw new Error(`bulk.group_not_found:${groupId}`);
      return { method: operation.method, ...(operation.bulkId ? { bulkId: operation.bulkId } : {}), location: `/Groups/${groupId}`, status: "200", response: updated };
    }

    if (operation.method === "DELETE") {
      const deleted = this.deleteGroup(groupId, tenantId);
      if (!deleted) throw new Error(`bulk.group_not_found:${groupId}`);
      return { method: operation.method, ...(operation.bulkId ? { bulkId: operation.bulkId } : {}), location: `/Groups/${groupId}`, status: "204" };
    }

    throw new Error(`bulk.unsupported_method:${operation.method}`);
  }

  private patchUser(userId: string, operations: readonly ScimPatchOperation[], tenantId: string): ScimUser | null {
    const tenantUsers = this.getTenantUsers(tenantId);
    const user = tenantUsers.get(userId);
    if (!user) return null;

    let next: Partial<Omit<ScimUser, "id" | "meta">> = {};
    for (const operation of operations) {
      switch (operation.op) {
        case "replace":
        case "add":
          if (operation.path === "active" && typeof operation.value === "boolean") {
            next = { ...next, active: operation.value };
          } else if (operation.path === "displayName" && typeof operation.value === "string") {
            next = { ...next, displayName: operation.value };
          } else if (operation.path === "emails" && Array.isArray(operation.value)) {
            next = { ...next, emails: operation.value as ScimUser["emails"] };
          } else if (operation.path === "groups" && Array.isArray(operation.value)) {
            next = { ...next, groups: operation.value as ScimUser["groups"] };
          }
          break;
        case "remove":
          if (operation.path === "groups") {
            next = { ...next, groups: [] };
          }
          break;
      }
    }

    return this.updateUser(userId, next, tenantId);
  }

  private parseBulkPath(path: string): { resourceType: "Users" | "Groups"; resourceId: string | null } {
    const sanitized = path.replace(/^\/scim\/v2/, "");
    const match = sanitized.match(/^\/(Users|Groups)(?:\/([^/]+))?$/);
    if (!match) {
      throw new Error(`bulk.invalid_path:${path}`);
    }
    return {
      resourceType: match[1] as "Users" | "Groups",
      resourceId: match[2] ?? null,
    };
  }

  private resolveBulkLocation(path: string, bulkIdMap: Map<string, string>): string {
    return path.replace(/bulkId:([A-Za-z0-9_.-]+)/g, (_match, bulkId) => bulkIdMap.get(String(bulkId)) ?? `bulkId:${String(bulkId)}`);
  }

  private resolveBulkReferences(value: unknown, bulkIdMap: Map<string, string>): unknown {
    if (typeof value === "string") {
      return this.resolveBulkLocation(value, bulkIdMap);
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.resolveBulkReferences(entry, bulkIdMap));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, this.resolveBulkReferences(entry, bulkIdMap)]),
      );
    }

    return value;
  }

  private recordEvent(action: ScimProvisionEvent["action"], subjectId: string, tenantId: string): void {
    this.events.push({
      eventId: newId("scim_event"),
      action,
      subjectId,
      occurredAt: nowIso(),
      tenantId,
    });
  }

  private applyFilter<T extends ScimUser | ScimGroup>(items: T[], filter: string): T[] {
    // Simple filter parsing: "userName eq \"john\""
    const match = filter.match(/(\w+)\s+(eq|ne|co|sw)\s+"([^"]+)"/);
    if (!match) return items;

    // SECURITY FIX: Properly extract and use the field name from the filter.
    // Previously, match[1] (fieldName) was discarded and only userName/displayName
    // were checked, causing all filters to be applied to userName regardless of
    // the actual field specified in the filter.
    const [, fieldName, op, value] = match;
    const filterValue = value ?? "";

    return items.filter((item) => {
      // SECURITY FIX: Use the actual field name from the filter to get the value.
      // Previously defaulted to userName/displayName only, ignoring the field name.
      const itemRecord = item as unknown as Record<string, unknown>;
      const itemValue = itemRecord[fieldName as string];
      if (typeof itemValue !== "string") {
        return false;
      }

      switch (op) {
        case "eq":
          return itemValue.toLowerCase() === filterValue.toLowerCase();
        case "ne":
          return itemValue.toLowerCase() !== filterValue.toLowerCase();
        case "co":
          return itemValue.toLowerCase().includes(filterValue.toLowerCase());
        case "sw":
          return itemValue.toLowerCase().startsWith(filterValue.toLowerCase());
        default:
          return false;
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createScimProvisionService(): ScimProvisionService {
  return new ScimProvisionService();
}
