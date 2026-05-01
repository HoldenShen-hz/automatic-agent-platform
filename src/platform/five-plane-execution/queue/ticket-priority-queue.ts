import { newId, nowIso } from "../../contracts/types/ids.js";

export interface Ticket {
  id: string;
  priority: number;
  payload: unknown;
  dispatchAfter: string | null;
  createdAt: string;
}

export interface EnqueueTicketInput {
  payload: unknown;
  priority?: number;
  dispatchAfter?: string | null;
}

export class TicketPriorityQueue {
  private tickets: Ticket[] = [];

  get size(): number {
    return this.tickets.length;
  }

  enqueue(input: EnqueueTicketInput): Ticket {
    const now = nowIso();
    const ticket: Ticket = {
      id: newId("ticket"),
      priority: input.priority ?? 0,
      payload: input.payload,
      dispatchAfter: input.dispatchAfter ?? null,
      createdAt: now,
    };

    // Insert in priority order (higher priority first), then by createdAt for FIFO
    const insertIndex = this.tickets.findIndex(
      (t) => ticket.priority > t.priority || (ticket.priority === t.priority && ticket.createdAt < t.createdAt)
    );

    if (insertIndex === -1) {
      this.tickets.push(ticket);
    } else {
      this.tickets.splice(insertIndex, 0, ticket);
    }

    return ticket;
  }

  dequeue(): Ticket | null {
    const now = nowIso();

    // Find the first ticket that is ready to dispatch (dispatchAfter <= now)
    const readyIndex = this.tickets.findIndex(
      (t) => t.dispatchAfter === null || t.dispatchAfter <= now
    );

    if (readyIndex === -1) {
      return null;
    }

    const ticket = this.tickets.splice(readyIndex, 1)[0];
    return ticket ?? null;
  }

  peek(): Ticket | null {
    if (this.tickets.length === 0) {
      return null;
    }
    return this.tickets[0] ?? null;
  }

  clear(): void {
    this.tickets = [];
  }
}