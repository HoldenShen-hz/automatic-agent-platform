import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createConversationMobileCards(messages) {
    return messages.slice(-3).map((message) => createMobileFeatureCard(message.role, message.content));
}
