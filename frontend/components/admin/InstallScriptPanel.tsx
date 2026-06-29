"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type InstallScriptInfo } from "@/lib/api";
import { formatDate } from "@/lib/format";

const GUIDE_SLUG = "install_guide";

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  return `${(bytes / 1024).toFixed(1)} КБ`;
}

export default function InstallScriptPanel() {
  const [info, setInfo] = useState<InstallScriptInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Инструкция для покупателя (редактируемый текст).
  const [guideTitle, setGuideTitle] = useState("");
  const [guideBody, setGuideBody] = useState("");
  const [guideSaving, setGuideSaving] = useState(false);
  const [guideSaved, setGuideSaved] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [scriptInfo, guide] = await Promise.all([
        api.admin.getInstallScript(),
        api.admin.getContent(GUIDE_SLUG),
      ]);
      setInfo(scriptInfo);
      setGuideTitle(guide.title);
      setGuideBody(guide.body);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить данные.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSaveGuide() {
    if (!guideTitle.trim() || !guideBody.trim()) {
      setGuideError("Заголовок и текст не могут быть пустыми.");
      return;
    }
    setGuideSaving(true);
    setGuideError(null);
    setGuideSaved(false);
    try {
      await api.admin.updateContent(GUIDE_SLUG, {
        title: guideTitle.trim(),
        body: guideBody,
      });
      setGuideSaved(true);
    } catch (err) {
      setGuideError(err instanceof ApiError ? err.message : "Не удалось сохранить.");
    } finally {
      setGuideSaving(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api.admin.uploadInstallScript(file);
      setInfo(res);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка загрузки.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onDelete() {
    if (!confirm("Удалить скрипт установки? Клиенты больше не смогут его скачать.")) {
      return;
    }
    setError(null);
    setSaved(false);
    try {
      await api.admin.deleteInstallScript();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось удалить.");
    }
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`glass glass-glow cursor-pointer border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-accent" : ""
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".sh,text/plain,application/x-sh"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <p className="font-display text-lg font-bold">
          {uploading
            ? "Загружаем…"
            : info?.exists
              ? "Заменить скрипт установки"
              : "Загрузить скрипт установки"}
        </p>
        <p className="mt-1 text-sm text-text-muted">
          Перетащите файл сюда или кликните. Один файл (например install.sh) до 1 МБ.
          Новая загрузка перезаписывает предыдущую.
        </p>
      </div>

      {saved && (
        <div className="glass px-5 py-4 text-sm text-success">
          Скрипт сохранён. Клиенты с лицензией уже могут его скачать.
        </div>
      )}
      {error && <div className="glass px-5 py-4 text-sm text-danger">{error}</div>}

      {loading ? (
        <div className="glass grid place-items-center py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent-2" />
        </div>
      ) : info?.exists ? (
        <div className="glass space-y-3 p-6">
          <div className="flex items-center gap-2">
            <span className="badge !text-success">Скрипт загружен</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-text-muted">Файл</dt>
            <dd className="font-mono text-xs">{info.filename}</dd>
            <dt className="text-text-muted">Размер</dt>
            <dd>{formatSize(info.size)}</dd>
            <dt className="text-text-muted">Обновлён</dt>
            <dd>{formatDate(info.updated_at)}</dd>
          </dl>
          <div className="pt-2">
            <button
              onClick={onDelete}
              className="text-sm text-danger hover:underline"
            >
              Удалить скрипт
            </button>
          </div>
        </div>
      ) : (
        <div className="glass px-5 py-4 text-sm text-text-muted">
          Скрипт установки ещё не загружен. Клиенты увидят кнопку скачивания в
          личном кабинете после загрузки.
        </div>
      )}

      {/* Инструкция для покупателя */}
      <div className="glass space-y-5 p-6">
        <div>
          <h3 className="font-display text-lg font-bold">Инструкция по установке</h3>
          <p className="mt-1 text-sm text-text-muted">
            Показывается покупателю в личном кабинете под кнопкой скачивания
            скрипта. Публично не доступна.
          </p>
        </div>

        {guideError && (
          <div className="px-1 text-sm text-danger">{guideError}</div>
        )}
        {guideSaved && (
          <div className="px-1 text-sm text-success">
            Сохранено. Покупатели уже видят обновлённую инструкцию.
          </div>
        )}

        {!loading && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-muted">
                Заголовок
              </label>
              <input
                value={guideTitle}
                onChange={(e) => {
                  setGuideTitle(e.target.value);
                  setGuideSaved(false);
                }}
                className="w-full rounded-lg border border-border bg-bg-elev px-4 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-muted">
                Текст
              </label>
              <textarea
                value={guideBody}
                onChange={(e) => {
                  setGuideBody(e.target.value);
                  setGuideSaved(false);
                }}
                rows={16}
                spellCheck={false}
                className="w-full resize-y rounded-lg border border-border bg-bg-elev px-4 py-3 font-mono text-xs leading-relaxed outline-none focus:border-accent"
              />
              <p className="mt-2 text-xs text-text-muted">
                Разметка: <code>## Заголовок</code> — подзаголовок, пустая строка —
                новый абзац, <code>**текст**</code> — жирный.
              </p>
            </div>

            <button
              onClick={onSaveGuide}
              disabled={guideSaving}
              className="btn-cta disabled:opacity-60"
            >
              {guideSaving ? "Сохраняем…" : "Сохранить инструкцию"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
