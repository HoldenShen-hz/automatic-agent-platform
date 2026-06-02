import { ValidationError } from "../../contracts/errors.js";
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
  expiresAtMs: number;
}

export class TicketPriorityQueue {
  private static readonly DEFAULT_MAX_TICKETS = 10_000;
  private static readonly DEFAULT_TICKET_TTL_MS = 24 * 60 * 60 * 1000;
  private readyTickets: QueueEntry[] = [];
  private deferredTickets: QueueEntry[] = [];
  private sequence = 0;

  constructor(
    private readonly options: {
      maxTickets?: number;
      ticketTtlMs?: number;
    } = {},
  ) {
    if (process.env.NODE_ENV === "production") {
      throw new ValidationError("ticket_queue.memory_only_forbidden_in_production", "ticket_queue.memory_only_forbidden_in_production", {
        retryable: false,
      });
    }
  }

  get size(): number {
    this.pruneExpiredTickets(Date.now());
    return this.readyTickets.length + this.deferredTickets.length;
  }

  enqueue(input: EnqueueTicketInput): Ticket {
    this.pruneExpiredTickets(Date.now());
    if (this.size >= this.maxTickets) {
      throw new ValidationError("ticket_queue.capacity_exceeded", "ticket_queue.capacity_exceeded", {
        retryable: false,
      });
    }
    const now = nowIso();
    const nowMs = Date.now();
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
      expiresAtMs: nowMs + this.ticketTtlMs,
    };
    if (entry.dispatchAfterMs !== null && entry.dispatchAfterMs > nowMs) {
      this.pushDeferred(entry);
    } else {
      this.pushReady(entry);
    }
    return ticket;
  }

  dequeue(): Ticket | null {
    this.pruneExpiredTickets(Date.now());
    this.promoteDeferredTickets(Date.now());
    const entry = this.popReady();
    if (entry == null) {
      return null;
    }
    return entry.ticket;
  }

  peek(): Ticket | null {
    this.pruneExpiredTickets(Date.now());
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

  private pruneExpiredTickets(nowMs: number): void {
    this.readyTickets = rebuildHeap(
      this.readyTickets.filter((entry) => entry.expiresAtMs > nowMs),
      compareReadyEntries,
    );
    this.deferredTickets = rebuildHeap(
      this.deferredTickets.filter((entry) => entry.expiresAtMs > nowMs),
      compareDeferredEntries,
    );
  }

  private get maxTickets(): number {
    return this.options.maxTickets ?? TicketPriorityQueue.DEFAULT_MAX_TICKETS;
  }

  private get ticketTtlMs(): number {
    return this.options.ticketTtlMs ?? TicketPriorityQueue.DEFAULT_TICKET_TTL_MS;
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
  if (!Number.isFinite(parsed)) {
    throw new ValidationError("ticket_queue.dispatch_after_invalid", "ticket_queue.dispatch_after_invalid", {
      retryable: false,
    });
  }
  return parsed;
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

function rebuildHeap<T>(entries: T[], compare: (left: T, right: T) => number): T[] {
  const heap = [...entries];
  for (let index = Math.floor(heap.length / 2) - 1; index >= 0; index -= 1) {
    siftDown(heap, index, compare);
  }
  return heap;
}
