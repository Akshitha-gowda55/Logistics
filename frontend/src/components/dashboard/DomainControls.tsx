import { FormEvent, useEffect, useState } from "react";
import { api, type Workflow } from "../../lib/api";
import { emitWorkflowSync } from "../../hooks/useWorkflowSync";

const routeOptions = ["not_dispatched", "dispatched", "in_transit", "delayed", "delivered"] as const;
const inventoryOptions = ["ok", "low_stock", "reorder_sent", "critical"] as const;
const supplierOptions = ["scheduled", "shipped", "delayed", "unavailable"] as const;

/** Operations: update canonical `route_status` on the workflow (logged to unified timeline). */
export function RouteDomainControlBar({
  token,
  itemName,
  workflowLabel,
  currentRouteStatus,
  onSaved,
}: {
  token: string | null;
  itemName: string | null;
  workflowLabel?: string;
  currentRouteStatus?: string;
  onSaved?: () => void;
}) {
  const [status, setStatus] = useState(currentRouteStatus || "not_dispatched");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    setStatus(currentRouteStatus || "not_dispatched");
  }, [currentRouteStatus, itemName]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token || !itemName) return;
    setSaving(true);
    setHint("");
    try {
      await api.patchRouteDomain(token, itemName, { route_status: status, remark: remark.trim() || undefined });
      emitWorkflowSync();
      onSaved?.();
      setHint("Route status saved.");
      setRemark("");
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!itemName) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-3 text-xs text-slate-500">
        Pick a shipment in your lane first. Then you can set route status here.
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-xl border border-sky-900/40 bg-sky-950/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-400/90">Route status</p>
          <p className="mt-1 text-xs text-slate-400">{workflowLabel ?? itemName}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Route status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            {routeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-slate-400">
          Note (optional)
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="e.g. corridor delay, ETA slip"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save route status"}
        </button>
      </div>
      {hint ? <p className="mt-2 text-xs text-slate-400">{hint}</p> : null}
    </form>
  );
}

/** Inventory: update stock signal for this workflow. */
export function InventoryDomainControlCard({
  token,
  workflow,
  onSaved,
}: {
  token: string | null;
  workflow: Workflow | null;
  onSaved?: (wf: Workflow) => void;
}) {
  const [inventoryStatus, setInventoryStatus] = useState(workflow?.inventory_status || "ok");
  const [reorderRequested, setReorderRequested] = useState(false);
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    setInventoryStatus(workflow?.inventory_status || "ok");
  }, [workflow?.item_name, workflow?.inventory_status]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token || !workflow) return;
    setSaving(true);
    setHint("");
    try {
      const wf = await api.patchInventoryDomain(token, workflow.item_name, {
        inventory_status: inventoryStatus,
        reorder_requested: reorderRequested,
        remark: remark.trim(),
      });
      emitWorkflowSync();
      onSaved?.(wf);
      setHint("Inventory signal saved.");
      setRemark("");
      setReorderRequested(false);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!workflow) return null;

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-xl border border-violet-900/40 bg-violet-950/20 p-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-violet-300/90">Warehouse stock signal</p>
      <p className="mt-1 text-xs text-slate-400">
        Control Tower saves to: <span className="font-mono text-slate-200">{workflow.item_name}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Inventory status
          <select
            value={inventoryStatus}
            onChange={(e) => setInventoryStatus(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            {inventoryOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pt-6 text-xs text-slate-300">
          <input type="checkbox" checked={reorderRequested} onChange={(e) => setReorderRequested(e.target.checked)} className="rounded border-slate-600" />
          Flag reorder
        </label>
        <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs text-slate-400">
          Note
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-violet-600 px-5 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {hint ? <p className="mt-2 text-xs text-slate-400">{hint}</p> : null}
    </form>
  );
}

/** Supplier: update fulfillment signal for this workflow. */
export function SupplierDomainControlCard({
  token,
  workflow,
  onSaved,
}: {
  token: string | null;
  workflow: Workflow | null;
  onSaved?: (wf: Workflow) => void;
}) {
  const [supplierStatus, setSupplierStatus] = useState(workflow?.supplier_status || "scheduled");
  const [delayReason, setDelayReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    setSupplierStatus(workflow?.supplier_status || "scheduled");
  }, [workflow?.item_name, workflow?.supplier_status]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token || !workflow) return;
    setSaving(true);
    setHint("");
    try {
      const wf = await api.patchSupplierDomain(token, workflow.item_name, {
        supplier_status: supplierStatus,
        delay_reason: delayReason.trim(),
      });
      emitWorkflowSync();
      onSaved?.(wf);
      setHint("Supplier status saved.");
      setDelayReason("");
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!workflow) return null;

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-rose-300/90">Supplier status</p>
      <p className="mt-1 text-xs text-slate-400 font-mono text-slate-200">Shipment: {workflow.item_name}</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Supply status
          <select
            value={supplierStatus}
            onChange={(e) => setSupplierStatus(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            {supplierOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-slate-400">
          Delay / reason (required if delayed or unavailable)
          <input
            type="text"
            value={delayReason}
            onChange={(e) => setDelayReason(e.target.value)}
            placeholder="e.g. line down at plant"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-rose-700 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save supplier status"}
        </button>
      </div>
      {hint ? <p className="mt-2 text-xs text-slate-400">{hint}</p> : null}
    </form>
  );
}
