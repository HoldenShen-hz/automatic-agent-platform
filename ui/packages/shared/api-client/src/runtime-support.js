export function generateStableId(prefix = "") {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi?.randomUUID === "function") {
        return `${prefix}${cryptoApi.randomUUID()}`;
    }
    const bytes = new Uint8Array(16);
    if (typeof cryptoApi?.getRandomValues === "function") {
        cryptoApi.getRandomValues(bytes);
    }
    else {
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Math.floor(Math.random() * 256);
        }
    }
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    return `${prefix}${hex}`;
}
export function stableSerialize(value) {
    return JSON.stringify(normalizeStableValue(value));
}
function normalizeStableValue(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => normalizeStableValue(entry));
    }
    if (value != null && typeof value === "object") {
        return Object.fromEntries(Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entry]) => [key, normalizeStableValue(entry)]));
    }
    return value;
}
