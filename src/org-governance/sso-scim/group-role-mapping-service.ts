export interface GroupRoleMappingRule {
  readonly groupName: string;
  readonly roleIds: readonly string[];
  readonly tenantId: string;
}

export interface GroupRoleMappingAuditEntry {
  readonly action: "register" | "unregister";
  readonly tenantId: string;
  readonly groupName: string;
  readonly roleIds: readonly string[];
}

export class GroupRoleMappingService {
  private readonly rules = new Map<string, readonly string[]>();
  private readonly originalCases = new Map<string, { tenantId: string; groupName: string }>();
  private readonly auditLog: GroupRoleMappingAuditEntry[] = [];

  public register(rule: GroupRoleMappingRule): GroupRoleMappingRule {
    const key = this.buildRuleKey(rule.tenantId, rule.groupName);
    if (this.rules.has(key)) {
      throw new Error(`group_role_mapping.duplicate_rule:${rule.tenantId}:${rule.groupName}`);
    }
    this.rules.set(key, [...new Set(rule.roleIds)]);
    this.originalCases.set(key, { tenantId: rule.tenantId, groupName: rule.groupName });
    this.auditLog.push({
      action: "register",
      tenantId: rule.tenantId,
      groupName: rule.groupName,
      roleIds: [...new Set(rule.roleIds)],
    });
    return rule;
  }

  public resolve(groups: readonly string[], tenantId: string): string[] {
    if (tenantId.trim().length === 0) {
      throw new Error("group_role_mapping.tenant_required");
    }
    return [...new Set(groups.flatMap((group) => this.rules.get(this.buildRuleKey(tenantId, group)) ?? []))];
  }

  public unregister(groupName: string, tenantId: string): boolean {
    const key = this.buildRuleKey(tenantId, groupName);
    const existing = this.rules.get(key);
    if (existing == null) {
      return false;
    }
    this.rules.delete(key);
    this.originalCases.delete(key);
    this.auditLog.push({
      action: "unregister",
      tenantId,
      groupName,
      roleIds: existing,
    });
    return true;
  }

  public listRules(): GroupRoleMappingRule[] {
    return [...this.rules.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([ruleKey, roleIds]) => {
        const original = this.originalCases.get(ruleKey);
        const separatorIndex = ruleKey.indexOf(":");
        return {
          tenantId: original?.tenantId ?? ruleKey.slice(0, separatorIndex),
          groupName: original?.groupName ?? ruleKey.slice(separatorIndex + 1),
          roleIds,
        };
      });
  }

  public listAuditLog(): readonly GroupRoleMappingAuditEntry[] {
    return Object.freeze([...this.auditLog]);
  }

  private buildRuleKey(tenantId: string, groupName: string): string {
    return `${tenantId.toLowerCase()}:${groupName.toLowerCase()}`;
  }
}
