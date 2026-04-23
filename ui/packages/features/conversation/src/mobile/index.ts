import { createMobileFeatureCard } from "@aa/ui-mobile";

export function createConversationMobileCards(messages: readonly { role: string; content: string }[]) {
  return messages.slice(-3).map((message) => createMobileFeatureCard(
    message.role,
    message.content,
  ));
}
