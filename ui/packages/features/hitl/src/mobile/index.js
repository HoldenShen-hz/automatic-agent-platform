import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createHitlMobileCards(items = [], handlers) {
    const cards = [];
    for (const item of items.slice(0, 5)) {
        if (item.type === "approval") {
            cards.push({
                id: `${item.id}:approve`,
                ...createMobileFeatureCard(item.title, item.description, "approve"),
                async onApprove() {
                    await handlers?.onApprove?.(item.id);
                },
                async onReject() { },
                async onResume() { },
            });
            cards.push({
                id: `${item.id}:reject`,
                ...createMobileFeatureCard(item.title, item.description, "reject"),
                async onApprove() { },
                async onReject() {
                    await handlers?.onReject?.(item.id);
                },
                async onResume() { },
            });
            continue;
        }
        cards.push({
            id: `${item.id}:resume`,
            ...createMobileFeatureCard(item.title, item.description, "resume"),
            async onApprove() { },
            async onReject() { },
            async onResume() {
                await handlers?.onResume?.(item.id);
            },
        });
    }
    return cards;
}
