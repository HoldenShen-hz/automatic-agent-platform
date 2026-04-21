export interface GroupRoleMappingRule {
  readonly groupName: string;
  readonly roleIds: readonly string[];
}

export class GroupRoleMappingService {
  private readonly rules = new Map<string, readonly string[]>();

  public register(rule: GroupRoleMappingRule): GroupRoleMappingRule {
    this.rules.set(rule.groupName, rule.roleIds);
    return rule;
  }

  public resolve(groups: readonly string[]): string[] {
    return [...new Set(groups.flatMap((group) => this.rules.get(group) ?? []))];
  }
}
