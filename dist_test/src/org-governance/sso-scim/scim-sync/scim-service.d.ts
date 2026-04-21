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
export declare const ScimUserSchema: {
    readonly schemas: readonly ["urn:ietf:params:scim:schemas:core:2.0:User"];
    readonly id: "";
    readonly userName: "";
    readonly name: {
        readonly formatted: "";
        readonly familyName: "";
        readonly givenName: "";
    };
    readonly displayName: "";
    readonly emails: readonly [{
        readonly value: "";
        readonly primary: true;
    }];
    readonly active: true;
    readonly groups: readonly [];
    readonly meta: {
        readonly resourceType: "User";
        readonly created: "";
        readonly lastModified: "";
    };
};
export declare const ScimGroupSchema: {
    readonly schemas: readonly ["urn:ietf:params:scim:schemas:core:2.0:Group"];
    readonly id: "";
    readonly displayName: "";
    readonly members: readonly [];
    readonly meta: {
        readonly resourceType: "Group";
        readonly created: "";
        readonly lastModified: "";
    };
};
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
    readonly groups: readonly {
        value: string;
        display: string;
    }[];
    readonly meta: {
        readonly resourceType: "User";
        readonly created: string;
        readonly lastModified: string;
    };
}
export interface ScimGroup {
    readonly id: string;
    readonly displayName: string;
    readonly members: readonly {
        value: string;
        display: string;
    }[];
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
export declare class ScimProvisionService {
    private readonly users;
    private readonly groups;
    private readonly userByUsername;
    private readonly userByEmail;
    private readonly groupByName;
    private readonly events;
    /**
     * Creates a new SCIM user.
     *
     * @param user - User data
     * @param tenantId - Tenant ID
     * @returns Created user
     */
    createUser(user: Omit<ScimUser, "id" | "meta">, tenantId: string): ScimUser;
    /**
     * Gets a user by ID.
     *
     * @param userId - User ID
     * @returns User or null
     */
    getUser(userId: string): ScimUser | null;
    /**
     * Gets a user by username.
     *
     * @param userName - Username
     * @returns User or null
     */
    getUserByUsername(userName: string): ScimUser | null;
    /**
     * Gets a user by email.
     *
     * @param email - Email address
     * @returns User or null
     */
    getUserByEmail(email: string): ScimUser | null;
    /**
     * Updates an existing user.
     *
     * @param userId - User ID
     * @param updates - Partial user data
     * @param tenantId - Tenant ID
     * @returns Updated user or null
     */
    updateUser(userId: string, updates: Partial<Omit<ScimUser, "id" | "meta">>, tenantId: string): ScimUser | null;
    /**
     * Disables a user (soft delete).
     *
     * @param userId - User ID
     * @param tenantId - Tenant ID
     * @returns Updated user or null
     */
    disableUser(userId: string, tenantId: string): ScimUser | null;
    /**
     * Permanently deletes a user.
     *
     * @param userId - User ID
     * @param tenantId - Tenant ID
     * @returns true if deleted
     */
    deleteUser(userId: string, tenantId: string): boolean;
    /**
     * Lists users with optional filtering.
     *
     * @param options - Query options
     * @returns Paginated user list
     */
    listUsers(options: {
        filter?: string;
        startIndex?: number;
        count?: number;
    }): ScimListResponse<ScimUser>;
    /**
     * Creates a new SCIM group.
     *
     * @param group - Group data
     * @param tenantId - Tenant ID
     * @returns Created group
     */
    createGroup(group: {
        displayName: string;
        members?: readonly {
            value: string;
            display: string;
        }[];
    }, tenantId: string): ScimGroup;
    /**
     * Gets a group by ID.
     *
     * @param groupId - Group ID
     * @returns Group or null
     */
    getGroup(groupId: string): ScimGroup | null;
    /**
     * Gets a group by name.
     *
     * @param displayName - Group display name
     * @returns Group or null
     */
    getGroupByName(displayName: string): ScimGroup | null;
    /**
     * Updates an existing group.
     *
     * @param groupId - Group ID
     * @param updates - Partial group data
     * @param tenantId - Tenant ID
     * @returns Updated group or null
     */
    updateGroup(groupId: string, updates: Partial<Pick<ScimGroup, "displayName" | "members">>, tenantId: string): ScimGroup | null;
    /**
     * Deletes a group.
     *
     * @param groupId - Group ID
     * @param tenantId - Tenant ID
     * @returns true if deleted
     */
    deleteGroup(groupId: string, tenantId: string): boolean;
    /**
     * Lists groups with optional filtering.
     *
     * @param options - Query options
     * @returns Paginated group list
     */
    listGroups(options: {
        filter?: string;
        startIndex?: number;
        count?: number;
    }): ScimListResponse<ScimGroup>;
    /**
     * Adds a member to a group.
     *
     * @param groupId - Group ID
     * @param userId - User ID to add
     * @returns Updated group or null
     */
    addMemberToGroup(groupId: string, userId: string, tenantId: string): ScimGroup | null;
    /**
     * Removes a member from a group.
     *
     * @param groupId - Group ID
     * @param userId - User ID to remove
     * @returns Updated group or null
     */
    removeMemberFromGroup(groupId: string, userId: string): ScimGroup | null;
    /**
     * Applies a SCIM patch operation.
     *
     * @param groupId - Target group ID
     * @param operations - Patch operations
     * @param tenantId - Tenant ID
     * @returns Updated group or null
     */
    patchGroup(groupId: string, operations: readonly ScimPatchOperation[], tenantId: string): ScimGroup | null;
    /**
     * Gets all provision events for incremental sync.
     *
     * @param since - Timestamp to get events since
     * @param tenantId - Tenant ID
     * @returns Array of provision events
     */
    getProvisionEvents(since: string, tenantId: string): ScimProvisionEvent[];
    /**
     * Gets total user count.
     */
    getUserCount(): number;
    /**
     * Gets total group count.
     */
    getGroupCount(): number;
    /**
     * Processes a SCIM Bulk request.
     *
     * Supports POST/PUT/PATCH/DELETE for `/Users` and `/Groups` resources and resolves
     * `bulkId` references within the same request.
     */
    processBulkRequest(request: ScimBulkRequest, tenantId: string): ScimBulkResponse;
    private executeBulkOperation;
    private executeUserBulkOperation;
    private executeGroupBulkOperation;
    private patchUser;
    private parseBulkPath;
    private resolveBulkLocation;
    private resolveBulkReferences;
    private recordEvent;
    private applyFilter;
}
export declare function createScimProvisionService(): ScimProvisionService;
