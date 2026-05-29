import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { HitlItem } from "../hooks";
type HitlMobileCard = ReturnType<typeof createMobileFeatureCard> & {
    readonly id: string;
    onApprove(): Promise<void>;
    onReject(): Promise<void>;
    onResume(): Promise<void>;
};
export declare function createHitlMobileCards(items?: readonly HitlItem[], handlers?: {
    onApprove?(id: string): Promise<void> | void;
    onReject?(id: string): Promise<void> | void;
    onResume?(id: string): Promise<void> | void;
}): readonly HitlMobileCard[];
export {};
