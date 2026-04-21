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
};
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
};
// ─────────────────────────────────────────────────────────────────────────────
// SCIM Service
// ─────────────────────────────────────────────────────────────────────────────
export class ScimProvisionService {
    users = new Map();
    groups = new Map();
    userByUsername = new Map();
    userByEmail = new Map();
    groupByName = new Map();
    events = [];
    /**
     * Creates a new SCIM user.
     *
     * @param user - User data
     * @param tenantId - Tenant ID
     * @returns Created user
     */
    createUser(user, tenantId) {
        const id = newId("scim_user");
        const now = nowIso();
        const scimUser = {
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
    getUser(userId) {
        return this.users.get(userId) ?? null;
    }
    /**
     * Gets a user by username.
     *
     * @param userName - Username
     * @returns User or null
     */
    getUserByUsername(userName) {
        const userId = this.userByUsername.get(userName.toLowerCase());
        return userId ? this.users.get(userId) ?? null : null;
    }
    /**
     * Gets a user by email.
     *
     * @param email - Email address
     * @returns User or null
     */
    getUserByEmail(email) {
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
    updateUser(userId, updates, tenantId) {
        const existing = this.users.get(userId);
        if (!existing)
            return null;
        const updatedUser = {
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
    disableUser(userId, tenantId) {
        return this.updateUser(userId, { active: false }, tenantId);
    }
    /**
     * Permanently deletes a user.
     *
     * @param userId - User ID
     * @param tenantId - Tenant ID
     * @returns true if deleted
     */
    deleteUser(userId, tenantId) {
        const existing = this.users.get(userId);
        if (!existing)
            return false;
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
    listUsers(options) {
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
    createGroup(group, tenantId) {
        const id = newId("scim_group");
        const now = nowIso();
        const scimGroup = {
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
    getGroup(groupId) {
        return this.groups.get(groupId) ?? null;
    }
    /**
     * Gets a group by name.
     *
     * @param displayName - Group display name
     * @returns Group or null
     */
    getGroupByName(displayName) {
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
    updateGroup(groupId, updates, tenantId) {
        const existing = this.groups.get(groupId);
        if (!existing)
            return null;
        const updatedGroup = {
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
    deleteGroup(groupId, tenantId) {
        const existing = this.groups.get(groupId);
        if (!existing)
            return false;
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
    listGroups(options) {
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
    addMemberToGroup(groupId, userId, tenantId) {
        const group = this.groups.get(groupId);
        const user = this.users.get(userId);
        if (!group || !user)
            return null;
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
    removeMemberFromGroup(groupId, userId) {
        const group = this.groups.get(groupId);
        if (!group)
            return null;
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
    patchGroup(groupId, operations, tenantId) {
        const group = this.groups.get(groupId);
        if (!group)
            return null;
        let updatedMembers = [...group.members];
        for (const op of operations) {
            switch (op.op) {
                case "add":
                case "replace":
                    if (op.path === "members" && Array.isArray(op.value)) {
                        for (const member of op.value) {
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
    getProvisionEvents(since, tenantId) {
        const sinceTime = new Date(since).getTime();
        return this.events.filter((e) => new Date(e.occurredAt).getTime() >= sinceTime && e.tenantId === tenantId);
    }
    /**
     * Gets total user count.
     */
    getUserCount() {
        return this.users.size;
    }
    /**
     * Gets total group count.
     */
    getGroupCount() {
        return this.groups.size;
    }
    /**
     * Processes a SCIM Bulk request.
     *
     * Supports POST/PUT/PATCH/DELETE for `/Users` and `/Groups` resources and resolves
     * `bulkId` references within the same request.
     */
    processBulkRequest(request, tenantId) {
        const bulkIdMap = new Map();
        const responses = [];
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
                if (operation.bulkId && result.response && typeof result.response === "object" && "id" in result.response) {
                    bulkIdMap.set(operation.bulkId, String(result.response.id));
                }
            }
            catch (error) {
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
    executeBulkOperation(operation, tenantId, bulkIdMap) {
        const resolvedPath = this.resolveBulkLocation(operation.path, bulkIdMap);
        const resolvedData = this.resolveBulkReferences(operation.data, bulkIdMap);
        const { resourceType, resourceId } = this.parseBulkPath(resolvedPath);
        if (operation.method === "POST" && resourceId === null) {
            if (resourceType === "Users") {
                const user = this.createUser(resolvedData, tenantId);
                return {
                    method: operation.method,
                    ...(operation.bulkId ? { bulkId: operation.bulkId } : {}),
                    location: `/Users/${user.id}`,
                    status: "201",
                    response: user,
                };
            }
            const group = this.createGroup(resolvedData, tenantId);
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
    executeUserBulkOperation(operation, userId, tenantId) {
        if (operation.method === "PUT") {
            const updated = this.updateUser(userId, operation.data, tenantId);
            if (!updated)
                throw new Error(`bulk.user_not_found:${userId}`);
            return { method: operation.method, ...(operation.bulkId ? { bulkId: operation.bulkId } : {}), location: `/Users/${userId}`, status: "200", response: updated };
        }
        if (operation.method === "PATCH") {
            const updated = this.patchUser(userId, operation.data, tenantId);
            if (!updated)
                throw new Error(`bulk.user_not_found:${userId}`);
            return { method: operation.method, ...(operation.bulkId ? { bulkId: operation.bulkId } : {}), location: `/Users/${userId}`, status: "200", response: updated };
        }
        if (operation.method === "DELETE") {
            const deleted = this.deleteUser(userId, tenantId);
            if (!deleted)
                throw new Error(`bulk.user_not_found:${userId}`);
            return { method: operation.method, ...(operation.bulkId ? { bulkId: operation.bulkId } : {}), location: `/Users/${userId}`, status: "204" };
        }
        throw new Error(`bulk.unsupported_method:${operation.method}`);
    }
    executeGroupBulkOperation(operation, groupId, tenantId) {
        if (operation.method === "PUT") {
            const updated = this.updateGroup(groupId, operation.data, tenantId);
            if (!updated)
                throw new Error(`bulk.group_not_found:${groupId}`);
            return { method: operation.method, ...(operation.bulkId ? { bulkId: operation.bulkId } : {}), location: `/Groups/${groupId}`, status: "200", response: updated };
        }
        if (operation.method === "PATCH") {
            const updated = this.patchGroup(groupId, operation.data, tenantId);
            if (!updated)
                throw new Error(`bulk.group_not_found:${groupId}`);
            return { method: operation.method, ...(operation.bulkId ? { bulkId: operation.bulkId } : {}), location: `/Groups/${groupId}`, status: "200", response: updated };
        }
        if (operation.method === "DELETE") {
            const deleted = this.deleteGroup(groupId, tenantId);
            if (!deleted)
                throw new Error(`bulk.group_not_found:${groupId}`);
            return { method: operation.method, ...(operation.bulkId ? { bulkId: operation.bulkId } : {}), location: `/Groups/${groupId}`, status: "204" };
        }
        throw new Error(`bulk.unsupported_method:${operation.method}`);
    }
    patchUser(userId, operations, tenantId) {
        const user = this.users.get(userId);
        if (!user)
            return null;
        let next = {};
        for (const operation of operations) {
            switch (operation.op) {
                case "replace":
                case "add":
                    if (operation.path === "active" && typeof operation.value === "boolean") {
                        next = { ...next, active: operation.value };
                    }
                    else if (operation.path === "displayName" && typeof operation.value === "string") {
                        next = { ...next, displayName: operation.value };
                    }
                    else if (operation.path === "emails" && Array.isArray(operation.value)) {
                        next = { ...next, emails: operation.value };
                    }
                    else if (operation.path === "groups" && Array.isArray(operation.value)) {
                        next = { ...next, groups: operation.value };
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
    parseBulkPath(path) {
        const sanitized = path.replace(/^\/scim\/v2/, "");
        const match = sanitized.match(/^\/(Users|Groups)(?:\/([^/]+))?$/);
        if (!match) {
            throw new Error(`bulk.invalid_path:${path}`);
        }
        return {
            resourceType: match[1],
            resourceId: match[2] ?? null,
        };
    }
    resolveBulkLocation(path, bulkIdMap) {
        return path.replace(/bulkId:([A-Za-z0-9_.-]+)/g, (_match, bulkId) => bulkIdMap.get(String(bulkId)) ?? `bulkId:${String(bulkId)}`);
    }
    resolveBulkReferences(value, bulkIdMap) {
        if (typeof value === "string") {
            return this.resolveBulkLocation(value, bulkIdMap);
        }
        if (Array.isArray(value)) {
            return value.map((entry) => this.resolveBulkReferences(entry, bulkIdMap));
        }
        if (value && typeof value === "object") {
            return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, this.resolveBulkReferences(entry, bulkIdMap)]));
        }
        return value;
    }
    recordEvent(action, subjectId, tenantId) {
        this.events.push({
            eventId: newId("scim_event"),
            action,
            subjectId,
            occurredAt: nowIso(),
            tenantId,
        });
    }
    applyFilter(items, filter) {
        // Simple filter parsing: "userName eq \"john\""
        const match = filter.match(/(\w+)\s+(eq|ne|co|sw)\s+"([^"]+)"/);
        if (!match)
            return items;
        const [, , op, value] = match;
        const filterValue = value ?? "";
        return items.filter((item) => {
            let itemValue;
            if ("userName" in item) {
                itemValue = item.userName;
            }
            else if ("displayName" in item) {
                itemValue = item.displayName;
            }
            else {
                return true;
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
                    return true;
            }
        });
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────
export function createScimProvisionService() {
    return new ScimProvisionService();
}
//# sourceMappingURL=scim-service.js.map