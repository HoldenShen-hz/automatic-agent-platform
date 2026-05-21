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

interface QueueEntry {
  ticket: Ticket;
  sequence: number;
  dispatchAfterMs: number | null;
}

export class TicketPriorityQueue {
  private readyTickets: QueueEntry[] = [];
  private deferredTickets: QueueEntry[] = [];
  private sequence = 0;

  get size(): number {
    return this.readyTickets.length + this.deferredTickets.length;
  }

  enqueue(input: EnqueueTicketInput): Ticket {
    const now = nowIso();
    const ticket: Ticket = {
      id: newId("ticket").replace(/^ticket_/, "ticket-"),
      priority: input.priority ?? 0,
      payload: input.payload,
      dispatchAfter: input.dispatchAfter ?? null,
      createdAt: now,
    };
    const entry: QueueEntry = {
      ticket,
      sequence: this.sequence++,
      dispatchAfterMs: parseDispatchAfterMs(ticket.dispatchAfter),
    };
    if (entry.dispatchAfterMs !== null && entry.dispatchAfterMs > Date.now()) {
      this.pushDeferred(entry);
    } else {
      this.pushReady(entry);
    }
    return ticket;
  }

  dequeue(): Ticket | null {
    this.promoteDeferredTickets(Date.now());
    const entry = this.popReady();
    if (entry == null) {
      return null;
    }
    return entry.ticket;
  }

  peek(): Ticket | null {
    this.promoteDeferredTickets(Date.now());
    return this.readyTickets[0]?.ticket ?? null;
  }

  clear(): void {
    this.readyTickets = [];
    this.deferredTickets = [];
    this.sequence = 0;
  }

  private promoteDeferredTickets(nowMs: number): void {
    while ((this.deferredTickets[0]?.dispatchAfterMs ?? Number.POSITIVE_INFINITY) <= nowMs) {
      const entry = this.popDeferred();
      if (entry == null) {
        break;
      }
      this.pushReady(entry);
    }
  }

  private pushReady(entry: QueueEntry): void {
    this.readyTickets.push(entry);
    siftUp(this.readyTickets, this.readyTickets.length - 1, compareReadyEntries);
  }

  private popReady(): QueueEntry | null {
    return popHeap(this.readyTickets, compareReadyEntries);
  }

  private pushDeferred(entry: QueueEntry): void {
    this.deferredTickets.push(entry);
    siftUp(this.deferredTickets, this.deferredTickets.length - 1, compareDeferredEntries);
  }

  private popDeferred(): QueueEntry | null {
    return popHeap(this.deferredTickets, compareDeferredEntries);
  }
}

function parseDispatchAfterMs(dispatchAfter: string | null): number | null {
  if (dispatchAfter == null) {
    return null;
  }
  const parsed = Date.parse(dispatchAfter);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareReadyEntries(left: QueueEntry, right: QueueEntry): number {
  if (left.ticket.priority !== right.ticket.priority) {
    return right.ticket.priority - left.ticket.priority;
  }
  return left.sequence - right.sequence;
}

function compareDeferredEntries(left: QueueEntry, right: QueueEntry): number {
  const leftReadyAt = left.dispatchAfterMs ?? Number.NEGATIVE_INFINITY;
  const rightReadyAt = right.dispatchAfterMs ?? Number.NEGATIVE_INFINITY;
  if (leftReadyAt !== rightReadyAt) {
    return leftReadyAt - rightReadyAt;
  }
  return compareReadyEntries(left, right);
}

function siftUp<T>(heap: T[], index: number, compare: (left: T, right: T) => number): void {
  let cursor = index;
  while (cursor > 0) {
    const parent = Math.floor((cursor - 1) / 2);
    if (compare(heap[cursor]!, heap[parent]!) >= 0) {
      break;
    }
    [heap[parent], heap[cursor]] = [heap[cursor]!, heap[parent]!];
    cursor = parent;
  }
}

function siftDown<T>(heap: T[], index: number, compare: (left: T, right: T) => number): void {
  let cursor = index;
  while (true) {
    const left = cursor * 2 + 1;
    const right = left + 1;
    let next = cursor;
    if (left < heap.length && compare(heap[left]!, heap[next]!) < 0) {
      next = left;
    }
    if (right < heap.length && compare(heap[right]!, heap[next]!) < 0) {
      next = right;
    }
    if (next === cursor) {
      break;
    }
    [heap[cursor], heap[next]] = [heap[next]!, heap[cursor]!];
    cursor = next;
  }
}

function popHeap<T>(heap: T[], compare: (left: T, right: T) => number): T | null {
  if (heap.length === 0) {
    return null;
  }
  const first = heap[0]!;
  const last = heap.pop();
  if (last != null && heap.length > 0) {
    heap[0] = last;
    siftDown(heap, 0, compare);
  }
  return first;
}
