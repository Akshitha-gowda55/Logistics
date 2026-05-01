import { type FormEvent, useState } from "react";
import { api } from "../../lib/api";
import { emitWorkflowSync } from "../../hooks/useWorkflowSync";
import { pushOfflineQueue } from "../../lib/offlineQueue";

export function RawMaterialEntryForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    item_name: "",
    material_type: "",
    quantity: "1",
    unit: "",
    supplier_name: "",
    supplier_location: "",
    source_location: "",
    destination_location: "",
    required_date: "",
    priority: "medium" as const,
    remarks: "",
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const qty = Number(form.quantity);
    if (!form.item_name.trim() || Number.isNaN(qty)) {
      setMsg("Enter an item name and a valid quantity.");
      setBusy(false);
      return;
    }
    const body = {
      item_name: form.item_name.trim(),
      material_type: form.material_type.trim(),
      quantity: qty,
      unit: form.unit.trim(),
      supplier_name: form.supplier_name.trim(),
      supplier_location: form.supplier_location.trim(),
      source_location: form.source_location.trim(),
      destination_location: form.destination_location.trim(),
      priority: form.priority as "low" | "medium" | "high",
      remarks: form.remarks.trim(),
      shipment_id: "",
      required_date: form.required_date ? `${form.required_date}T12:00:00` : null,
    };

    try {
      if (!navigator.onLine) {
        pushOfflineQueue("CREATE_WORKFLOW", { payload: body });
        setMsg("Offline mode: changes saved locally. Will sync when you are back online.");
        setBusy(false);
        return;
      }
      await api.createWorkflow(token, body);
      setMsg("Shipment / work item created — supplier can start.");
      setForm({
        item_name: "",
        material_type: "",
        quantity: "1",
        unit: "",
        supplier_name: "",
        supplier_location: "",
        source_location: "",
        destination_location: "",
        required_date: "",
        priority: "medium",
        remarks: "",
      });
      onCreated();
      emitWorkflowSync();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not create item.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <h2 className="text-lg font-semibold text-white">Add raw material / shipment</h2>
      <p className="mt-1 text-xs text-slate-400">
        Starts with Supplier. Other teams watch in real time (page checks for updates automatically).
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Item name*
          <input
            required
            value={form.item_name}
            onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Material type
          <input
            value={form.material_type}
            onChange={(e) => setForm((f) => ({ ...f, material_type: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Quantity*
          <input
            required
            type="number"
            min={0}
            step="any"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Unit (e.g. pieces)
          <input
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Supplier name
          <input
            value={form.supplier_name}
            onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Supplier location
          <input
            value={form.supplier_location}
            onChange={(e) => setForm((f) => ({ ...f, supplier_location: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Ship from*
          <input
            required
            value={form.source_location}
            onChange={(e) => setForm((f) => ({ ...f, source_location: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Deliver to*
          <input
            required
            value={form.destination_location}
            onChange={(e) => setForm((f) => ({ ...f, destination_location: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Need-by date
          <input
            type="date"
            value={form.required_date}
            onChange={(e) => setForm((f) => ({ ...f, required_date: e.target.value }))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Priority
          <select
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as typeof form.priority }))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="sm:col-span-2 flex flex-col gap-1 text-xs text-slate-400">
          Notes
          <textarea
            value={form.remarks}
            onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
            rows={2}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Create shipment / work item"}
          </button>
          {msg ? <span className="text-sm text-emerald-200">{msg}</span> : null}
        </div>
      </form>
    </section>
  );
}
