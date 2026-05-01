import { useEffect, useState } from "react";
import { api, NotificationItem } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

/** Top-of-page banner for overdue supplier delays, stock issues, or route delays from notifications + KPI gap. */
export function SmartAlertsBanner(props: {
  delayedCount?: number;
  lowStockHint?: boolean;
}) {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!token) return;
    void api.notifications(token).then(setItems).catch(() => setItems([]));
  }, [token]);

  const unread = items.filter((n) => !n.is_read);
  const warning = unread.find((n) => n.type === "warning" || n.type === "critical");
  const parts: string[] = [];
  if (props.delayedCount && props.delayedCount > 0) {
    parts.push(`${props.delayedCount} shipment(s) are marked late or escalated.`);
  }
  if (props.lowStockHint) {
    parts.push("Stock is low in one or more warehouses — check alerts.");
  }
  if (warning) {
    parts.push(warning.message);
  }

  const message = parts[0];
  if (!message) return null;

  const tone =
    warning?.type === "critical"
      ? "border-rose-500/45 bg-rose-950/30 text-rose-50"
      : "border-amber-500/35 bg-amber-950/25 text-amber-50";

  return (
    <div role="alert" className={`mb-5 rounded-xl border px-4 py-3 text-sm leading-relaxed ${tone}`}>
      <span className="font-semibold">Alert:</span> {message}
    </div>
  );
}
