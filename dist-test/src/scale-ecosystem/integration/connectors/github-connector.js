export class GitHubConnector {
    execute(request) {
        return {
            connectorId: request.connectorId,
            success: request.capability === "create_pr" || request.capability === "create_issue" || request.capability === "dispatch_workflow",
            status: request.capability === "create_pr" || request.capability === "create_issue" || request.capability === "dispatch_workflow"
                ? "succeeded"
                : "failed",
        };
    }
}
//# sourceMappingURL=github-connector.js.map