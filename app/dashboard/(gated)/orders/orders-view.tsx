"use client";

import { useState } from "react";
import { ShoppingBag, Check, Bike, Store } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";
import { formatCurrency } from "@/lib/currency";
import { useDashboardLang } from "@/lib/dashboard-lang-context";

interface Settings {
  orderingEnabled: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number | null;
  minDeliveryAmount: number | null;
}
interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}
interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillment: "PICKUP" | "DELIVERY";
  deliveryAddress: string | null;
  notes: string | null;
  status: "PENDING" | "CONFIRMED" | "READY" | "COMPLETED" | "CANCELLED";
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

export default function OrdersView({
  initialSettings,
  currency,
  initialOrders,
}: {
  initialSettings: Settings;
  currency: string;
  initialOrders: Order[];
}) {
  const { t } = useDashboardLang();
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [orders, setOrders] = useState(initialOrders);
  const [tab, setTab] = useState<"active" | "history">("active");
  const [busyId, setBusyId] = useState<string | null>(null);

  const STATUS_META: Record<Order["status"], { label: string; className: string }> = {
    PENDING: { label: t.orders.statusPending, className: "bg-amber-50 text-amber-700" },
    CONFIRMED: { label: t.orders.statusConfirmed, className: "bg-blue-50 text-blue-700" },
    READY: { label: t.orders.statusReady, className: "bg-green-50 text-green-700" },
    COMPLETED: { label: t.orders.statusCompleted, className: "bg-[#F7F8F4] text-[#343233]" },
    CANCELLED: { label: t.orders.statusCancelled, className: "bg-red-50 text-red-700" },
  };

  const NEXT_ACTION: Partial<Record<Order["status"], { label: string; next: Order["status"] }>> = {
    PENDING: { label: t.orders.confirm, next: "CONFIRMED" },
    CONFIRMED: { label: t.orders.markReady, next: "READY" },
    READY: { label: t.orders.complete, next: "COMPLETED" },
  };

  const activeOrders = orders.filter((o) => o.status === "PENDING" || o.status === "CONFIRMED" || o.status === "READY");
  const historyOrders = orders.filter((o) => o.status === "COMPLETED" || o.status === "CANCELLED");
  const shown = tab === "active" ? activeOrders : historyOrders;

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/tenant/ordering", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  async function updateStatus(order: Order, status: Order["status"]) {
    setBusyId(order.id);
    const res = await fetch(`/api/menu-orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const { order: updated } = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: updated.status } : o)));
    }
    setBusyId(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
        <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <ShoppingBag size={20} aria-hidden />
          {t.orders.title}
        </h1>
        <p className="text-sm text-[#343233]/70 mb-6">{t.orders.subtitle}</p>

        <label className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            checked={settings.orderingEnabled}
            onChange={(e) => setSettings({ ...settings, orderingEnabled: e.target.checked })}
            className="w-4 h-4 accent-[#E7FF00]"
          />
          <span className="text-sm font-medium">{t.orders.activate}</span>
        </label>

        {settings.orderingEnabled && (
          <>
            <div className="flex flex-col gap-3 mb-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.pickupEnabled}
                  onChange={(e) => setSettings({ ...settings, pickupEnabled: e.target.checked })}
                  className="w-4 h-4 accent-[#E7FF00]"
                />
                <Store size={15} aria-hidden />
                <span className="text-sm">{t.orders.pickup}</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.deliveryEnabled}
                  onChange={(e) => setSettings({ ...settings, deliveryEnabled: e.target.checked })}
                  className="w-4 h-4 accent-[#E7FF00]"
                />
                <Bike size={15} aria-hidden />
                <span className="text-sm">{t.orders.delivery}</span>
              </label>
            </div>

            {settings.deliveryEnabled && (
              <div className="flex flex-wrap gap-4 mb-4">
                <label className="flex items-center gap-2">
                  <span className="text-sm text-[#343233]/70">{t.orders.deliveryFee}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.deliveryFee ?? ""}
                    onChange={(e) => setSettings({ ...settings, deliveryFee: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0"
                    className="w-24 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-2.5 py-1.5 text-sm outline-none"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-sm text-[#343233]/70">{t.orders.minOrder}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.minDeliveryAmount ?? ""}
                    onChange={(e) => setSettings({ ...settings, minDeliveryAmount: e.target.value ? Number(e.target.value) : null })}
                    placeholder={t.orders.noMinimum}
                    className="w-28 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-2.5 py-1.5 text-sm outline-none"
                  />
                </label>
              </div>
            )}
          </>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-semibold px-4 h-9 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105 disabled:opacity-50"
          >
            {saving ? t.orders.saving : t.orders.save}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-700">
              <Check size={14} aria-hidden /> {t.orders.saved}
            </span>
          )}
        </div>
      </DashboardCard>

      {settings.orderingEnabled && (
        <DashboardCard>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTab("active")}
              className={`text-sm font-medium px-3.5 h-9 rounded-lg ${tab === "active" ? "bg-[#002D09] text-white" : "border border-[#002D09]/15"}`}
            >
              {t.orders.active} ({activeOrders.length})
            </button>
            <button
              onClick={() => setTab("history")}
              className={`text-sm font-medium px-3.5 h-9 rounded-lg ${tab === "history" ? "bg-[#002D09] text-white" : "border border-[#002D09]/15"}`}
            >
              {t.orders.history}
            </button>
          </div>

          {shown.length === 0 && (
            <p className="text-sm text-[#343233]/60">
              {tab === "active" ? t.orders.noActiveOrders : t.orders.noHistoryYet}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {shown.map((order) => {
              const meta = STATUS_META[order.status];
              const action = NEXT_ACTION[order.status];
              return (
                <div key={order.id} className="border border-[#002D09]/10 rounded-lg p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold">{order.customerName}</p>
                      <p className="text-xs text-[#343233]/60">
                        {order.customerEmail} · {order.customerPhone}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${meta.className}`}>{meta.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#343233]/70 mb-2">
                    {order.fulfillment === "PICKUP" ? <Store size={13} aria-hidden /> : <Bike size={13} aria-hidden />}
                    {order.fulfillment === "PICKUP" ? t.orders.pickupShort : `${t.orders.delivery} — ${order.deliveryAddress}`}
                  </div>

                  <div className="text-sm mb-2">
                    {order.items.map((i) => (
                      <p key={i.id} className="text-[#343233]/80">
                        {i.quantity}x {i.name}
                      </p>
                    ))}
                  </div>

                  {order.notes && (
                    <p className="text-xs text-[#343233]/60 mb-2">
                      {t.orders.note}: {order.notes}
                    </p>
                  )}

                  <p className="text-sm font-bold mb-3">{formatCurrency(order.total, currency)}</p>

                  {action && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(order, action.next)}
                        disabled={busyId === order.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-[#E7FF00] text-[#002D09] hover:brightness-105 disabled:opacity-50"
                      >
                        {action.label}
                      </button>
                      <button
                        onClick={() => updateStatus(order, "CANCELLED")}
                        disabled={busyId === order.id}
                        className="text-xs px-3 py-1.5 rounded-md border border-[#002D09]/15 hover:bg-[#F7F8F4] disabled:opacity-50"
                      >
                        {t.orders.cancel}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DashboardCard>
      )}
    </div>
  );
}
