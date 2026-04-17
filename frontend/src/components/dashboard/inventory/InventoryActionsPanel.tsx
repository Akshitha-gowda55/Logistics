export type InventoryActionKind = "received" | "packed" | "transferred" | "delayed" | "unavailable";

export function InventoryActionsPanel({
  actionKind,
  setActionKind,
  remark,
  setRemark,
}: {
  actionKind: InventoryActionKind;
  setActionKind: (k: InventoryActionKind) => void;
  remark: string;
  setRemark: (v: string) => void;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Warehouse Action</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <ActionButton
          active={actionKind === "received"}
          onClick={() => setActionKind("received")}
          title="Mark Stock Received"
          desc="Stock came to warehouse"
          tone="sky"
        />
        <ActionButton
          active={actionKind === "packed"}
          onClick={() => setActionKind("packed")}
          title="Mark Stock Packed"
          desc="Stock packed for send"
          tone="violet"
        />
        <ActionButton
          active={actionKind === "transferred"}
          onClick={() => setActionKind("transferred")}
          title="Mark Stock Moved"
          desc="Stock moved between warehouses"
          tone="emerald"
        />
        <ActionButton
          active={actionKind === "delayed"}
          onClick={() => setActionKind("delayed")}
          title="Mark Stock Delayed"
          desc="Stock is delayed"
          tone="amber"
        />
        <ActionButton
          active={actionKind === "unavailable"}
          onClick={() => setActionKind("unavailable")}
          title="Mark Stock Unavailable"
          desc="Stock is not available"
          tone="rose"
        />
        <div className="hidden" />
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add Note</p>
        <textarea
          className="mt-1 min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Add a short note."
        />
      </div>
    </div>
  );
}

function ActionButton({
  active,
  onClick,
  title,
  desc,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  tone: "sky" | "violet" | "emerald" | "amber" | "rose";
}) {
  const style = {
    sky: { ring: "ring-sky-500/50", bg: "bg-sky-900/40", pill: "text-sky-100" },
    violet: { ring: "ring-violet-500/50", bg: "bg-violet-900/40", pill: "text-violet-100" },
    emerald: { ring: "ring-emerald-500/50", bg: "bg-emerald-900/40", pill: "text-emerald-100" },
    amber: { ring: "ring-amber-500/50", bg: "bg-amber-900/35", pill: "text-amber-100" },
    rose: { ring: "ring-rose-500/50", bg: "bg-rose-900/35", pill: "text-rose-100" },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border p-3 text-left transition",
        active
          ? `border-slate-700 ${style.ring} ${style.bg}`
          : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/40",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={["text-xs font-semibold", style.pill].join(" ")}>{title}</p>
          <p className="mt-1 text-[0.65rem] text-slate-400">{desc}</p>
        </div>
        {active ? <span className="text-[0.65rem] font-semibold text-white">Selected</span> : null}
      </div>
    </button>
  );
}

