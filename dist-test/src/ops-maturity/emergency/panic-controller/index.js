export function shouldEnterPanicMode(input) {
    return input.activeIncidents > 0 || input.reasonCode.startsWith("security.");
}
//# sourceMappingURL=index.js.map