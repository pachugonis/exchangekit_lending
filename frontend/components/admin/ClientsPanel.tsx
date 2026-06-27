"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type AdminClient } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { Pagination } from "./LicensesPanel";

const PAGE_SIZE = 50;

export default function ClientsPanel() {
  const [items, setItems] = useState<AdminClient[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.clients({
        search: query || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError("Не удалось загрузить клиентов.");
    } finally {
      setLoading(false);
    }
  }, [query, offset]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function onDelete(c: AdminClient) {
    if (
      !confirm(
        `Удалить клиента ${c.email}? Его платежи будут удалены, ` +
          `а выданные лицензии вернутся в пул свободными.`
      )
    )
      return;
    setError(null);
    try {
      await api.admin.deleteClient(c.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось удалить.");
    }
  }

  const pages = Math.ceil(total / PAGE_SIZE);
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          setQuery(search.trim());
        }}
        className="flex gap-3"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по email…"
          className="input-field"
        />
        <button type="submit" className="btn-ghost shrink-0 !px-5 !py-3">
          Найти
        </button>
      </form>

      {error && <div className="glass px-5 py-4 text-sm text-danger">{error}</div>}

      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Email подтв.</th>
              <th className="px-4 py-3 font-medium">Лицензия</th>
              <th className="px-4 py-3 font-medium">Платежей</th>
              <th className="px-4 py-3 font-medium">Оплачено</th>
              <th className="px-4 py-3 font-medium">Регистрация</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-text-muted">
                  Загрузка…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-text-muted">
                  Клиентов нет.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3">
                    {c.email}
                    {c.is_admin && (
                      <span className="badge ml-2 !text-accent-2">admin</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.is_email_verified ? (
                      <span className="text-success">да</span>
                    ) : (
                      <span className="text-text-muted">нет</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.has_license ? (
                      <span className="font-mono text-xs text-success">
                        {c.license_filename}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{c.payments_count}</td>
                  <td className="px-4 py-3">{formatMoney(c.total_paid)}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {formatDate(c.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!c.is_admin && (
                      <button
                        onClick={() => onDelete(c)}
                        className="text-xs text-danger hover:underline"
                      >
                        Удалить
                      </button>
                    )}
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
