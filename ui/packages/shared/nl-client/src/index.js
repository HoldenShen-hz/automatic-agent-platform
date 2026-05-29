export class ConversationClient {
    options;
    messages = [];
    status = "idle";
    planReady = false;
    isStreaming = false;
    unsubscribers = [];
    constructor(options = {}) {
        this.options = options;
        if (Array.isArray(options.initialMessages) && options.initialMessages.length > 0) {
            this.messages.push(...options.initialMessages.map((message) => ({
                id: message.id,
                role: message.role,
                content: message.content,
            })));
        }
        if (options.transport != null && options.userId != null) {
            this.isStreaming = true;
            this.unsubscribers.push(options.transport.subscribe(`nl.session.${options.userId}`, (event) => {
                if (event.type !== "nl.session.updated") {
                    return;
                }
                const payload = event.payload;
                this.status = payload.status ?? this.status;
                if (Array.isArray(payload.messages)) {
                    this.messages.length = 0;
                    for (const message of payload.messages) {
                        this.messages.push({
                            id: `msg-${this.messages.length + 1}`,
                            role: message.role,
                            content: message.content,
                        });
                    }
                }
                this.emitStateChange();
            }));
            this.unsubscribers.push(options.transport.subscribe("nl.plan.created", (event) => {
                if (event.type !== "nl.plan.created") {
                    return;
                }
                const payload = event.payload;
                this.planReady = payload.planReady ?? true;
                this.emitStateChange();
            }));
        }
    }
    listMessages() {
        return this.messages;
    }
    getStatus() {
        return this.status;
    }
    send(content) {
        this.status = "parsing";
        const message = {
            id: `msg-${this.messages.length + 1}`,
            role: "user",
            content,
        };
        this.messages.push(message);
        this.emitStateChange();
        return message;
    }
    pushAssistant(content) {
        this.status = "reporting";
        const message = {
            id: `msg-${this.messages.length + 1}`,
            role: "assistant",
            content,
        };
        this.messages.push(message);
        this.emitStateChange();
        return message;
    }
    requestClarification(content) {
        this.status = "clarifying";
        const message = {
            id: `msg-${this.messages.length + 1}`,
            role: "assistant",
            content,
        };
        this.messages.push(message);
        this.emitStateChange();
        return message;
    }
    buildPlan(content) {
        this.status = "building";
        this.planReady = true;
        const message = {
            id: `msg-${this.messages.length + 1}`,
            role: "system",
            content,
        };
        this.messages.push(message);
        this.emitStateChange();
        return message;
    }
    confirm(content) {
        this.status = "confirming";
        const message = {
            id: `msg-${this.messages.length + 1}`,
            role: "assistant",
            content,
        };
        this.messages.push(message);
        this.emitStateChange();
        return message;
    }
    execute(content) {
        this.status = "executing";
        const message = {
            id: `msg-${this.messages.length + 1}`,
            role: "system",
            content,
        };
        this.messages.push(message);
        this.emitStateChange();
        return message;
    }
    getSnapshot() {
        return {
            messages: [...this.messages],
            status: this.status,
            planReady: this.planReady,
            isStreaming: this.isStreaming,
        };
    }
    dispose() {
        for (const unsubscribe of this.unsubscribers) {
            unsubscribe();
        }
        this.unsubscribers.length = 0;
        this.isStreaming = false;
        this.emitStateChange();
    }
    emitStateChange() {
        this.options.onStateChange?.(this.getSnapshot());
    }
}
