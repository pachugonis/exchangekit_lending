"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  type AdminLicense,
  type LicenseUploadResult,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import StatusBadge from "./StatusBadge";

const PAGE_SIZE = 50;
const FILTERS = [
  { key: "", label: "Все" },
  { key: "free", label: "Свободные" },
  { key: "sold", label: "Проданные" },
  { key: "reserved", label: "Резерв" },
];

export default function LicensesPanel() {
  const [items, setItems] = useState<AdminLicense[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<LicenseUploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.licenses({
        status: status || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError("Не удалось загрузить лицензии.");
    } finally {
      setLoading(false);
    }
  }, [status, offset]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function handleFiles(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.admin.uploadLicenses(files);
      setResult(res);
      setOffset(0);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка загрузки.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Удалить свободную лицензию из пула?")) return;
    try {
      await api.admin.deleteLicense(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось удалить.");
    }
  }

  const pages = Math.ceil(total / PAGE_SIZE);
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-6">
      {/* Загрузка */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`glass glass-glow cursor-pointer border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-accent" : ""
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <p className="font-display text-lg font-bold">
          {uploading ? "Загружаем…" : "Загрузить лицензии (.txt)"}
        </p>
        <p className="mt-1 text-sm text-text-muted">
          Перетащите файлы сюда или кликните. Каждый .txt = одна лицензия. Дубли по
          имени пропускаются.
        </p>
      </div>

      {result && (
        <div className="glass px-5 py-4 text-sm">
          <p className="text-success">
            Загружено: {result.created}, пропущено (дубли): {result.skipped}.
            Свободных в пуле: {result.free_total}.
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-danger">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <div className="glass px-5 py-4 text-sm text-danger">{error}</div>}

      {/* Фильтры */}
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

      {/* Таблица */}
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-4 py-3 font-medium">Файл</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Владелец</th>
              <th className="px-4 py-3 font-medium">Продана</th>
              <th className="px-4 py-3 font-medium">Загружена</th>
              <th className="px-4 py-3" />
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
                  Лицензий нет.
                </td>
              </tr>
            ) : (
              items.map((lic) => (
                <tr
                  key={lic.id}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-4 py-3 font-mono text-xs">{lic.filename}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lic.status} />
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {lic.user_email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {formatDate(lic.sold_at)}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {formatDate(lic.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {lic.status === "free" && (
                      <button
                        onClick={() => onDelete(lic.id)}
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

export function Pagination({
  page,
  pages,
  onPrev,
  onNext,
}: {
  page: number;
  pages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 text-sm">
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
      >
        ← Назад
      </button>
      <span className="text-text-muted">
        {page} / {pages}
      </span>
      <button
        onClick={onNext}
        disabled={page >= pages}
        className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
      >
        Вперёд →
      </button>
    </div>
  );
}
