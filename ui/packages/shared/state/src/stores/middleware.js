import { devtools, persist } from "zustand/middleware";
function cloneDraftValue(value) {
    if (typeof structuredClone === "function") {
        try {
            return structuredClone(value);
        }
        catch {
            // Fall through when structured cloning cannot represent the current value.
        }
    }
    if (Array.isArray(value)) {
        return value.map((entry) => cloneDraftValue(entry));
    }
    if (value instanceof Date) {
        return new Date(value.getTime());
    }
    if (value instanceof Map) {
        return new Map(Array.from(value.entries(), ([key, entry]) => [cloneDraftValue(key), cloneDraftValue(entry)]));
    }
    if (value instanceof Set) {
        return new Set(Array.from(value.values(), (entry) => cloneDraftValue(entry)));
    }
    if (value != null && typeof value === "object") {
        const prototype = Object.getPrototypeOf(value);
        const clone = Object.create(prototype);
        for (const key of Reflect.ownKeys(value)) {
            clone[key] = cloneDraftValue(Reflect.get(value, key));
        }
        return clone;
    }
    return value;
}
function withDraft(initializer) {
    return (set, get, api) => {
        const draftSet = (partial, replace) => {
            const storeSet = set;
            if (typeof partial !== "function") {
                storeSet(partial, replace);
                return;
            }
            storeSet((currentState) => {
                const draft = cloneDraftValue(currentState);
                const result = partial(draft);
                return (result === undefined ? draft : result);
            }, replace);
        };
        return initializer(draftSet, get, api);
    };
}
export function withPersistDevtoolsDraft(name, initializer, persistOptions = {}) {
    const version = persistOptions.version ?? 1;
    const migrate = persistOptions.migrate ?? ((persistedState) => persistedState);
    return devtools(persist(withDraft(initializer), {
        ...persistOptions,
        version,
        migrate,
        name,
    }), { name });
}
