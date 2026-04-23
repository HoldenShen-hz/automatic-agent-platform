export class GroupRoleMappingService {
    rules = new Map();
    register(rule) {
        this.rules.set(rule.groupName, rule.roleIds);
        return rule;
    }
    resolve(groups) {
        return [...new Set(groups.flatMap((group) => this.rules.get(group) ?? []))];
    }
}
//# sourceMappingURL=group-role-mapping-service.js.map