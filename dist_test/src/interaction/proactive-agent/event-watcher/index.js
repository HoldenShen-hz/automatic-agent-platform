export function shouldConsumeProactiveEvent(event, expectedSource, expectedPattern) {
    return event.source === expectedSource && event.name.includes(expectedPattern);
}
//# sourceMappingURL=index.js.map