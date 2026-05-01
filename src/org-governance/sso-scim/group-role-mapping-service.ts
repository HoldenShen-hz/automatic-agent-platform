export interface GroupRoleMappingRule {
  readonly groupName: string;
  readonly roleIds: readonly string[];
}

export class GroupRoleMappingService {
  private readonly rules = new Map<string, readonly string[]>();
  private validRoleIds: Set<string> | null = null;

  /**
   * Sets the allowed role IDs for validation.
   * When set, register() will reject any roleId not in this set.
   * SECURITY: Call this to enable role ID validation and prevent arbitrary role assignment.
   */
  public setValidRoleIds(roleIds: readonly string[]): void {
    this.validRoleIds = new Set(roleIds);
  }

  /**
   * Registers a group-to-role mapping.
   * SECURITY: Validates role IDs if validation is enabled, and requires authorization context.
   *
   * @param rule - The mapping rule to register
   * @param context - Optional authorization context (caller must have admin privilege)
   * @throws Error if role IDs are invalid or caller lacks authorization
   */
  public register(
    rule: GroupRoleMappingRule,
    context?: { callerIsPlatformAdmin?: boolean; callerRoleIds?: readonly string[] },
  ): GroupRoleMappingRule {
    // SECURITY FIX: Require authorization context for registering mappings.
    // The caller must either be a platform admin or have admin role IDs themselves.
    const callerIsAuthorized = context?.callerIsPlatformAdmin === true ||
      (context?.callerRoleIds?.some(rid => rid.includes("admin") || rid.includes("platform_admin")) ?? false);

    if (!callerIsAuthorized) {
      throw new Error("group_role_mapping.unauthorized:Only platform admins can register group-role mappings");
    }

    // SECURITY FIX: Validate role IDs if validation is enabled.
    if (this.validRoleIds !== null) {
      for (const roleId of rule.roleIds) {
        if (!this.validRoleIds.has(roleId)) {
          throw new Error(`group_role_mapping.invalid_role_id:${roleId}`);
        }
      }
    }

    // Validate rule structure
    if (!rule.groupName || rule.groupName.trim().length === 0) {
      throw new Error("group_role_mapping.invalid_group_name:Group name is required");
    }
    if (!Array.isArray(rule.roleIds) || rule.roleIds.length === 0) {
      throw new Error("group_role_mapping.invalid_role_ids:At least one role ID is required");
    }

    this.rules.set(rule.groupName, rule.roleIds);
    return rule;
  }

  public resolve(groups: readonly string[]): string[] {
    return [...new Set(groups.flatMap((group) => this.rules.get(group) ?? []))];
  }

  public unregister(groupName: string): boolean {
    return this.rules.delete(groupName);
  }

  public listRules(): GroupRoleMappingRule[] {
    return [...this.rules.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([groupName, roleIds]) => ({ groupName, roleIds }));
  }
}
