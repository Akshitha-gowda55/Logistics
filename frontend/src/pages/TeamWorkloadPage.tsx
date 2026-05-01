import { useCallback, useEffect, useState } from "react";
import { api, DashboardSummaryResponse, Workflow } from "../lib/api";
import { SmartAlertsBanner } from "../components/dashboard/SmartAlertsBanner";
import { ShipmentProgressTasksPanel } from "../components/dashboard/ShipmentProgressTasksPanel";
import { useWorkflowSyncRefresh } from "../hooks/useWorkflowSync";

export function TeamWorkloadPage({ token, role }: { token: string; role: "inventory" | "supplier_risk" }) {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sum, wf] = await Promise.all([api.dashboardSummaryByRole(token, role), api.workflows(token)]);
      setSummary(sum);
      setWorkflows(wf);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token, role]);

  useEffect(() => void load(), [load]);
  useWorkflowSyncRefresh(load, [token, role], 2800);

  if (loading && !summary) {
    return <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-slate-300">Loading…</div>;
  }
  if (error) {
    return <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-sm text-rose-100">{error}</div>;
  }

  const label = role === "supplier_risk" ? "Supplier" : "Warehouse";

  return (
    <div className="space-y-5">
      {summary ? (
        <SmartAlertsBanner delayedCount={summary.summary.delayed_workflows} lowStockHint={false} />
      ) : null}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold text-white">{label} dashboard</h2>
        <p className="mt-1 text-xs text-slate-400">
          Open each shipment to tick only your team&apos;s boxes. Updates sync to Executive and other teams automatically.
        </p>
      </section>
      <ShipmentProgressTasksPanel
        workflows={workflows}
        currentRole={role}
        title="Your shipments"
        intro="Tap a row to open the checklist. You can edit only boxes for your dashboard."
      />
    </div>
  );
}
