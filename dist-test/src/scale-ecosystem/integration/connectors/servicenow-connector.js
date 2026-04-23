export class ServiceNowConnector {
    execute(request) {
        return {
            connectorId: request.connectorId,
            success: request.capability === "create_incident" || request.capability === "update_ticket",
            status: request.capability === "create_incident" || request.capability === "update_ticket" ? "succeeded" : "failed",
        };
    }
}
//# sourceMappingURL=servicenow-connector.js.map