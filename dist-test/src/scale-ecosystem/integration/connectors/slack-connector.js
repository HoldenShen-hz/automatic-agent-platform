export class SlackConnector {
    execute(request) {
        return {
            connectorId: request.connectorId,
            success: request.capability === "send_message" || request.capability === "open_modal",
            status: request.capability === "send_message" || request.capability === "open_modal" ? "succeeded" : "failed",
        };
    }
}
//# sourceMappingURL=slack-connector.js.map