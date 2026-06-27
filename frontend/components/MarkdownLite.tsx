import { Fragment } from "react";

/**
 * Минималистичный рендер markdown-lite, которым редактируются страницы оферты
 * и политики из админки. Поддерживает:
 *   ## Заголовок   → h2
 *   # Заголовок    → h1 (как подзаголовок)
 *   пустая строка  → разделитель абзацев
 *   **жирный**     → <strong> внутри абзаца
 * Никакого raw-HTML: контент рендерится как React-узлы (без dangerouslySetInnerHTML).
 */
export default function MarkdownLite({ body }: { body: string }) {
  const blocks = body.replace(/\r\n/g, "\n").split(/\n{2,}/);

  return (
    <div className="prose-invert mt-8 space-y-4 text-sm leading-relaxed text-text-muted">
      {blocks.map((raw, i) => {
        const block = raw.trim();
        if (!block) return null;

        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="text-lg font-semibold text-text">
              {block.slice(3).trim()}
            </h2>
          );
        }
        if (block.startsWith("# ")) {
          return (
            <h2 key={i} className="text-xl font-semibold text-text">
              {block.slice(2).trim()}
            </h2>
          );
        }

        return (
          <p key={i} className="whitespace-pre-line">
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  // Разбиваем по **жирный**, нечётные сегменты — bold.
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="text-text">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}
