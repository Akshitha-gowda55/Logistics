/** Queue workflow creates / checklist PATCH when offline (localStorage). */

import { api, type CreateRawMaterialBody } from "./api";

const STORAGE_KEY = "logistics-platform-pending-sync";

export const OFFLINE_QUEUE_CHANGED_EVENT = "logistics-offline-queue-changed";

export type QueueEntry = {
  id: string;
  kind: "CREATE_WORKFLOW" | "PATCH_CHECKLIST";
  body: Record<string, unknown>;
  createdAt: string;
};

export type PatchChecklistQueueBody = {
  workflowRef: string;
  role: string;
  field: string;
  completed: boolean;
  remarks?: string;
  expected_sync_version: number;
};

export function notifyOfflineQueueChanged(): void {
  window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT));
}

export function pushOfflineQueue(kind: QueueEntry["kind"], body: Record<string, unknown>): QueueEntry {
  const q = readQueue();
  const entry: QueueEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    kind,
    body,
    createdAt: new Date().toISOString(),
  };
  q.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
  notifyOfflineQueueChanged();
  return entry;
}

export function readQueue(): QueueEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueueEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearQueue(entriesToRemove: Set<string>): void {
  const next = readQueue().filter((e) => !entriesToRemove.has(e.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notifyOfflineQueueChanged();
}

/** True when server rejected due to stale sync_version or concurrent edit. */
function isConflictError(message: string): boolean {
  return message.includes("409") || message.toLowerCase().includes("updated elsewhere");
}

/** True when create failed because row already exists. */
function isDuplicateCreate(message: string): boolean {
  return message.includes("409") || message.toLowerCase().includes("already exists");
}

export type FlushOfflineQueueResult = {
  synced: number;
  failedReason: string | null;
};

/**
 * Send queued mutations in order. Stops at first non-recoverable error (except single-entry conflict).
 */
export async function flushOfflineQueue(token: string): Promise<FlushOfflineQueueResult> {
  const queue = readQueue();
  if (queue.length === 0) {
    return { synced: 0, failedReason: null };
  }
  const succeeded = new Set<string>();
  /** Tracks server sync_version across multiple queued PATCHes for one item. */
  const livePatchVersionByRef: Record<string, number> = {};
  let lastFailure: string | null = null;
  for (const entry of queue) {
    try {
      if (entry.kind === "CREATE_WORKFLOW") {
        const payload = entry.body.payload as CreateRawMaterialBody;
        await api.createWorkflow(token, payload);
      } else {
        const b = entry.body as PatchChecklistQueueBody;
        const expected =
          livePatchVersionByRef[b.workflowRef] !== undefined ? livePatchVersionByRef[b.workflowRef] : b.expected_sync_version;
        const res = await api.patchWorkflowChecklist(token, b.workflowRef, {
          role: b.role,
          field: b.field,
          completed: b.completed,
          remarks: b.remarks ?? "",
          expected_sync_version: expected,
        });
        livePatchVersionByRef[b.workflowRef] = res.sync_version;
      }
      succeeded.add(entry.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastFailure = msg;
      if (entry.kind === "CREATE_WORKFLOW" && isDuplicateCreate(msg)) {
        succeeded.add(entry.id);
        lastFailure = null;
      } else if (entry.kind === "PATCH_CHECKLIST" && isConflictError(msg)) {
        lastFailure =
          msg.includes("409") || msg.toLowerCase().includes("elsewhere")
            ? "This item was updated elsewhere. Please review the latest status."
            : msg;
        break;
      } else {
        break;
      }
    }
  }
  if (succeeded.size > 0) {
    clearQueue(succeeded);
  }
  const synced = succeeded.size;
  return { synced, failedReason: lastFailure };
}

export type DrainOfflineQueueResult = {
  syncedTotal: number;
  failedReason: string | null;
  remaining: number;
};

const MAX_DRAIN_ROUNDS = 25;

/** Run ``flushOfflineQueue`` in a loop until the queue is empty or progress stops (e.g. network error). */
export async function drainOfflineQueue(token: string): Promise<DrainOfflineQueueResult> {
  let syncedTotal = 0;
  let lastFail: string | null = null;
  let rounds = 0;
  while (readQueue().length > 0 && rounds++ < MAX_DRAIN_ROUNDS) {
    const beforeLen = readQueue().length;
    const { synced, failedReason } = await flushOfflineQueue(token);
    syncedTotal += synced;
    lastFail = failedReason;
    const nextLen = readQueue().length;
    if (failedReason && nextLen >= beforeLen) {
      break;
    }
    if (synced === 0 && nextLen === beforeLen) {
      break;
    }
  }
  return { syncedTotal, failedReason: lastFail, remaining: readQueue().length };
}
