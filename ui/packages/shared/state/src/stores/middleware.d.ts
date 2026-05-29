import { type PersistOptions } from "zustand/middleware";
import type { StateCreator, StoreApi } from "zustand/vanilla";
type MutableDraft<T> = T extends (...args: never[]) => unknown ? T : T extends readonly (infer U)[] ? MutableDraft<U>[] : T extends object ? {
    -readonly [K in keyof T]: MutableDraft<T[K]>;
} : T;
type DraftUpdater<T> = (draft: MutableDraft<T>) => void;
type StateUpdater<T> = (state: MutableDraft<T>) => T | Partial<T> | void;
type DraftSetState<T> = {
    (partial: T | Partial<T>, replace?: boolean): void;
    (partial: DraftUpdater<T> | StateUpdater<T>, replace?: boolean): void;
};
type DraftStateCreator<T> = (set: DraftSetState<T>, get: () => T, api: StoreApi<T>) => T;
export declare function withPersistDevtoolsDraft<T>(name: string, initializer: DraftStateCreator<T>, persistOptions?: Omit<PersistOptions<T>, "name">): StateCreator<T, [], []>;
export {};
