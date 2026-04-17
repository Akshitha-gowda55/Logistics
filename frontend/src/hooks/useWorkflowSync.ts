import { useEffect } from "react";

/** Fired when any workflow task/checklist changes so dashboards can refetch together. */
export const WORKFLOW_SYNC_EVENT = "smartflow-workflow-sync";

export function emitWorkflowSync(): void {
  window.dispatchEvent(new Event(WORKFLOW_SYNC_EVENT));
}

/**
 * Cross-dashboard sync: refetch when another tab/dashboard updates a workflow,
 * and on a timer so counts/cards stay aligned without WebSockets.
 */
export function useWorkflowSyncRefresh(callback: () => void | Promise<void>, deps: unknown[], intervalMs = 20000): void {
  useEffect(() => {
    const run = () => {
      void callback();
    };
    const onSync = () => run();
    window.addEventListener(WORKFLOW_SYNC_EVENT, onSync);
    const intervalId = window.setInterval(run, intervalMs);
    return () => {
      window.removeEventListener(WORKFLOW_SYNC_EVENT, onSync);
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
