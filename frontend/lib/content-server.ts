export interface ContentPageData {
  slug: string;
  title: string;
  body: string;
}

const FALLBACK: Record<string, ContentPageData> = {
  offer: {
    slug: "offer",
    title: "Публичная оферта",
    body: "Документ временно недоступен. Попробуйте обновить страницу позже.",
  },
  privacy: {
    slug: "privacy",
    title: "Политика конфиденциальности",
    body: "Документ временно недоступен. Попробуйте обновить страницу позже.",
  },
};

/**
 * Серверная загрузка редактируемого текста напрямую из backend.
 * no-store — правки из админки видны сразу. При ошибке отдаём fallback,
 * чтобы публичная страница никогда не падала.
 */
export async function getContentPage(slug: string): Promise<ContentPageData> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://backend:8000";
  try {
    const res = await fetch(`${base}/api/content/${slug}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as ContentPageData;
    return { slug: data.slug, title: data.title, body: data.body };
  } catch {
    return FALLBACK[slug] ?? { slug, title: slug, body: "" };
  }
}
