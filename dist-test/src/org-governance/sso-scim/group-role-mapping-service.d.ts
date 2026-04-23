export interface GroupRoleMappingRule {
    readonly groupName: string;
    readonly roleIds: readonly string[];
}
export declare class GroupRoleMappingService {
    private readonly rules;
    register(rule: GroupRoleMappingRule): GroupRoleMappingRule;
    resolve(groups: readonly string[]): string[];
}
