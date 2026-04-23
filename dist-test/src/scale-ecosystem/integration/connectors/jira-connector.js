export class JiraConnector {
    execute(request) {
        return {
            connectorId: request.connectorId,
            success: request.capability === "create_issue" || request.capability === "search_issue",
            status: request.capability === "create_issue" || request.capability === "search_issue" ? "succeeded" : "failed",
        };
    }
}
//# sourceMappingURL=jira-connector.js.map