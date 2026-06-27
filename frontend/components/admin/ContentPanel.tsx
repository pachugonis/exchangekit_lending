"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type ContentPage } from "@/lib/api";

const PAGES: { slug: string; label: string; href: string }[] = [
  { slug: "offer", label: "Оферта", href: "/offer" },
  { slug: "privacy", label: "Политика конфиденциальности", href: "/privacy" },
];

export default function ContentPanel() {
  const [slug, setSlug] = useState("offer");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const page: ContentPage = await api.admin.getContent(slug);
      setTitle(page.title);
      setBody(page.body);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить текст.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    if (!title.trim() || !body.trim()) {
      setError("Заголовок и текст не могут быть пустыми.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.admin.updateContent(slug, { title: title.trim(), body });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить.");
    } finally {
      setSaving(false);
    }
  }

  const current = PAGES.find((p) => p.slug === slug)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {PAGES.map((p) => (
          <button
            key={p.slug}
            onClick={() => setSlug(p.slug)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              slug === p.slug
                ? "border-accent bg-surface text-text"
                : "border-border text-text-muted hover:text-text"
            }`}
          >
            {p.label}
          </button>
        ))}
        <a
          href={current.href}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-sm text-accent-2 hover:underline"
        >
          Открыть страницу ↗
        </a>
      </div>

      {error && <div className="glass px-5 py-4 text-sm text-danger">{error}</div>}
      {saved && (
        <div className="glass px-5 py-4 text-sm text-success">
          Сохранено. Изменения уже видны на странице «{current.label}».
        </div>
      )}

      {loading ? (
        <div className="glass grid place-items-center py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent-2" />
        </div>
      ) : (
        <div className="glass space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-muted">
              Заголовок
            </label>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setSaved(false);
              }}
              className="w-full rounded-lg border border-border bg-bg-elev px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-muted">
              Текст
            </label>
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setSaved(false);
              }}
              rows={22}
              spellCheck={false}
              className="w-full resize-y rounded-lg border border-border bg-bg-elev px-4 py-3 font-mono text-xs leading-relaxed outline-none focus:border-accent"
            />
            <p className="mt-2 text-xs text-text-muted">
              Разметка: <code>## Заголовок</code> — подзаголовок, пустая строка —
              новый абзац, <code>**текст**</code> — жирный.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onSave}
              disabled={saving}
              className="btn-cta disabled:opacity-60"
            >
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
            <button
              onClick={() => void load()}
              disabled={saving}
              className="btn-ghost"
            >
              Сбросить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
