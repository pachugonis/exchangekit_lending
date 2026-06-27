"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type AdminPayment } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import StatusBadge from "./StatusBadge";
import { Pagination } from "./LicensesPanel";

const PAGE_SIZE = 50;
const FILTERS = [
  { key: "", label: "Все" },
  { key: "succeeded", label: "Оплачены" },
  { key: "pending", label: "В ожидании" },
  { key: "canceled", label: "Отменены" },
];

export default function PaymentsPanel() {
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.payments({
        status: status || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError("Не удалось загрузить платежи.");
    } finally {
      setLoading(false);
    }
  }, [status, offset]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const pages = Math.ceil(total / PAGE_SIZE);
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setStatus(f.key);
              setOffset(0);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              status === f.key
                ? "border-accent bg-surface text-text"
                : "border-border text-text-muted hover:text-text"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto self-center text-sm text-text-muted">
          Всего: {total}
        </span>
      </div>

      {error && <div className="glass px-5 py-4 text-sm text-danger">{error}</div>}

      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-4 py-3 font-medium">Дата</th>
              <th className="px-4 py-3 font-medium">Клиент</th>
              <th className="px-4 py-3 font-medium">Сумма</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Лицензия</th>
              <th className="px-4 py-3 font-medium">ЮКасса ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text-muted">
                  Загрузка…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text-muted">
                  Платежей нет.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 text-text-muted">
                    {formatDate(p.created_at)}
                  </td>
                  <td className="px-4 py-3">{p.user_email ?? "—"}</td>
                  <td className="px-4 py-3">{formatMoney(p.amount)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {p.license_filename ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {p.yookassa_payment_id}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <Pagination
          page={page}
          pages={pages}
          onPrev={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          onNext={() => setOffset(offset + PAGE_SIZE)}
        />
      )}
    </div>
  );
}
