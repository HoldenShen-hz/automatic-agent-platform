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
  private readonly users = new Map<string, ScimUser>();
  private readonly groups = new Map<string, ScimGroup>();
  private readonly userByUsername = new Map<string, string>();
  private readonly userByEmail = new Map<string, string>();
  private readonly groupByName = new Map<string, string>();
  private readonly events: ScimProvisionEvent[] = [];

  /**
   * Creates a new SCIM user.
   *
   * @param user - User data
   * @param tenantId - Tenant ID
   * @returns Created user
   */
  public createUser(user: Omit<ScimUser, "id" | "meta">, tenantId: string): ScimUser {
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

    this.users.set(id, scimUser);
    this.userByUsername.set(user.userName.toLowerCase(), id);

    const primaryEmail = user.emails.find((e) => e.primary)?.value;
    if (primaryEmail) {
      this.userByEmail.set(primaryEmail.toLowerCase(), id);
    }

    this.recordEvent("user_created", id, tenantId);

    return scimUser;
  }

  /**
   * Gets a user by ID.
   *
   * @param userId - User ID
   * @returns User or null
   */
  public getUser(userId: string): ScimUser | null {
    return this.users.get(userId) ?? null;
  }

  /**
   * Gets a user by username.
   *
   * @param userName - Username
   * @returns User or null
   */
  public getUserByUsername(userName: string): ScimUser | null {
    const userId = this.userByUsername.get(userName.toLowerCase());
    return userId ? this.users.get(userId) ?? null : null;
  }

  /**
   * Gets a user by email.
   *
   * @param email - Email address
   * @returns User or null
   */
  public getUserByEmail(email: string): ScimUser | null {
    const userId = this.userByEmail.get(email.toLowerCase());
    return userId ? this.users.get(userId) ?? null : null;
  }

  /**
   * Updates an existing user.
   *
   * @param userId - User ID
   * @param updates - Partial user data
   * @param tenantId - Tenant ID
   * @returns Updated user or null
   */
  public updateUser(userId: string, updates: Partial<Omit<ScimUser, "id" | "meta">>, tenantId: string): ScimUser | null {
    const existing = this.users.get(userId);
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

    this.users.set(userId, updatedUser);

    if (updates.userName) {
      this.userByUsername.delete(existing.userName.toLowerCase());
      this.userByUsername.set(updates.userName.toLowerCase(), userId);
    }

    if (updates.emails) {
      for (const email of existing.emails) {
        this.userByEmail.delete(email.value.toLowerCase());
      }
      const primaryEmail = updates.emails.find((e) => e.primary)?.value;
      if (primaryEmail) {
        this.userByEmail.set(primaryEmail.toLowerCase(), userId);
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
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns true if deleted
   */
  public deleteUser(userId: string, tenantId: string): boolean {
    const existing = this.users.get(userId);
    if (!existing) return false;

    this.users.delete(userId);
    this.userByUsername.delete(existing.userName.toLowerCase());

    for (const email of existing.emails) {
      this.userByEmail.delete(email.value.toLowerCase());
    }

    // Remove from all groups
    for (const group of this.groups.values()) {
      if (group.members.some((m) => m.value === userId)) {
        this.removeMemberFromGroup(group.id, userId);
      }
    }

    this.recordEvent("user_deleted", userId, tenantId);

    return true;
  }

  /**
   * Lists users with optional filtering.
   *
   * @param options - Query options
   * @returns Paginated user list
   */
  public listUsers(options: {
    filter?: string;
    startIndex?: number;
    count?: number;
  }): ScimListResponse<ScimUser> {
    const { startIndex = 1, count = 100 } = options;

    let users = Array.from(this.users.values());

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
   *
   * @param group - Group data
   * @param tenantId - Tenant ID
   * @returns Created group
   */
  public createGroup(group: { displayName: string; members?: readonly { value: string; display: string }[] }, tenantId: string): ScimGroup {
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

    this.groups.set(id, scimGroup);
    this.groupByName.set(group.displayName.toLowerCase(), id);

    this.recordEvent("group_updated", id, tenantId);

    return scimGroup;
  }

  /**
   * Gets a group by ID.
   *
   * @param groupId - Group ID
   * @returns Group or null
   */
  public getGroup(groupId: string): ScimGroup | null {
    return this.groups.get(groupId) ?? null;
  }

  /**
   * Gets a group by name.
   *
   * @param displayName - Group display name
   * @returns Group or null
   */
  public getGroupByName(displayName: string): ScimGroup | null {
    const groupId = this.groupByName.get(displayName.toLowerCase());
    return groupId ? this.groups.get(groupId) ?? null : null;
  }

  /**
   * Updates an existing group.
   *
   * @param groupId - Group ID
   * @param updates - Partial group data
   * @param tenantId - Tenant ID
   * @returns Updated group or null
   */
  public updateGroup(groupId: string, updates: Partial<Pick<ScimGroup, "displayName" | "members">>, tenantId: string): ScimGroup | null {
    const existing = this.groups.get(groupId);
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

    this.groups.set(groupId, updatedGroup);

    if (updates.displayName) {
      this.groupByName.delete(existing.displayName.toLowerCase());
      this.groupByName.set(updates.displayName.toLowerCase(), groupId);
    }

    this.recordEvent("group_updated", groupId, tenantId);

    return updatedGroup;
  }

  /**
   * Deletes a group.
   *
   * @param groupId - Group ID
   * @param tenantId - Tenant ID
   * @returns true if deleted
   */
  public deleteGroup(groupId: string, tenantId: string): boolean {
    const existing = this.groups.get(groupId);
    if (!existing) return false;

    this.groups.delete(groupId);
    this.groupByName.delete(existing.displayName.toLowerCase());

    // Remove group reference from all users
    for (const user of this.users.values()) {
      if (user.groups.some((g) => g.value === groupId)) {
        const updatedGroups = user.groups.filter((g) => g.value !== groupId);
        this.updateUser(user.id, { groups: updatedGroups }, tenantId);
      }
    }

    return true;
  }

  /**
   * Lists groups with optional filtering.
   *
   * @param options - Query options
   * @returns Paginated group list
   */
  public listGroups(options: {
    filter?: string;
    startIndex?: number;
    count?: number;
  }): ScimListResponse<ScimGroup> {
    const { startIndex = 1, count = 100 } = options;

    let groups = Array.from(this.groups.values());

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
   *
   * @param groupId - Group ID
   * @param userId - User ID to add
   * @returns Updated group or null
   */
  public addMemberToGroup(groupId: string, userId: string, tenantId: string): ScimGroup | null {
    const group = this.groups.get(groupId);
    const user = this.users.get(userId);

    if (!group || !user) return null;

    if (group.members.some((m) => m.value === userId)) {
      return group; // Already a member
    }

    const newMembers = [...group.members, { value: userId, display: user.displayName }];
    return this.updateGroup(groupId, { members: newMembers }, tenantId);
  }

  /**
   * Removes a member from a group.
   *
   * @param groupId - Group ID
   * @param userId - User ID to remove
   * @returns Updated group or null
   */
  public removeMemberFromGroup(groupId: string, userId: string): ScimGroup | null {
    const group = this.groups.get(groupId);
    if (!group) return null;

    const newMembers = group.members.filter((m) => m.value !== userId);
    return this.updateGroup(groupId, { members: newMembers }, "");
  }

  /**
   * Applies a SCIM patch operation.
   *
   * @param groupId - Target group ID
   * @param operations - Patch operations
   * @param tenantId - Tenant ID
   * @returns Updated group or null
   */
  public patchGroup(groupId: string, operations: readonly ScimPatchOperation[], tenantId: string): ScimGroup | null {
    const group = this.groups.get(groupId);
    if (!group) return null;

    let updatedMembers = [...group.members];

    for (const op of operations) {
      switch (op.op) {
        case "add":
        case "replace":
          if (op.path === "members" && Array.isArray(op.value)) {
            for (const member of op.value as { value: string }[]) {
              if (!updatedMembers.some((m) => m.value === member.value)) {
                const user = this.users.get(member.value);
                updatedMembers.push({ value: member.value, display: user?.displayName ?? member.value });
              }
            }
          }
          break;
        case "remove":
          if (op.path?.includes("members")) {
            updatedMembers = [];
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
   * Gets total user count.
   */
  public getUserCount(): number {
    return this.users.size;
  }

  /**
   * Gets total group count.
   */
  public getGroupCount(): number {
    return this.groups.size;
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

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

    const [, attr, op, value] = match;

    return items.filter((item) => {
      let itemValue: string;

      if ("userName" in item) {
        itemValue = item.userName;
      } else if ("displayName" in item) {
        itemValue = item.displayName;
      } else {
        return true;
      }

      switch (op) {
        case "eq":
          return itemValue.toLowerCase() === value.toLowerCase();
        case "ne":
          return itemValue.toLowerCase() !== value.toLowerCase();
        case "co":
          return itemValue.toLowerCase().includes(value.toLowerCase());
        case "sw":
          return itemValue.toLowerCase().startsWith(value.toLowerCase());
        default:
          return true;
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
