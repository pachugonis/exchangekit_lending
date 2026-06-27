import Link from "next/link";
import MarkdownLite from "@/components/MarkdownLite";
import { getContentPage } from "@/lib/content-server";

export const metadata = { title: "Политика конфиденциальности — ExchangeKit" };
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const page = await getContentPage("privacy");
  return (
    <main className="mx-auto max-w-3xl px-5 py-20">
      <Link href="/" className="text-sm text-text-muted hover:text-text">
        ← На главную
      </Link>
      <h1 className="mt-6 font-display text-3xl font-bold">{page.title}</h1>
      <MarkdownLite body={page.body} />
    </main>
  );
}
