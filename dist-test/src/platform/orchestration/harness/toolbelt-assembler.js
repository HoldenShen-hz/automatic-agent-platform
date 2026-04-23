export class ToolbeltAssembler {
    assemble(request) {
        const allowed = new Set(request.allowedTools);
        const grantedTools = [];
        const blockedTools = [];
        for (const tool of request.requestedTools) {
            if (allowed.has(tool)) {
                grantedTools.push(tool);
            }
            else {
                blockedTools.push(tool);
            }
        }
        return {
            allowedTools: [...request.allowedTools],
            grantedTools,
            blockedTools,
            requiredEvidence: [...request.requiredEvidence],
        };
    }
}
//# sourceMappingURL=toolbelt-assembler.js.map