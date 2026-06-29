"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type User } from "@/lib/api";
import Dashboard from "@/components/admin/Dashboard";
import LicensesPanel from "@/components/admin/LicensesPanel";
import ClientsPanel from "@/components/admin/ClientsPanel";
import PaymentsPanel from "@/components/admin/PaymentsPanel";
import ContentPanel from "@/components/admin/ContentPanel";
import InstallScriptPanel from "@/components/admin/InstallScriptPanel";

type Tab =
  | "dashboard"
  | "licenses"
  | "clients"
  | "payments"
  | "content"
  | "install-script";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Дашборд" },
  { key: "licenses", label: "Лицензии" },
  { key: "clients", label: "Клиенты" },
  { key: "payments", label: "Платежи" },
  { key: "content", label: "Тексты" },
  { key: "install-script", label: "Скрипт установки" },
];

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        if (!me.is_admin) {
          setDenied(true);
          return;
        }
        setUser(me);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setDenied(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function onLogout() {
    await api.logout().catch(() => {});
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <span className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent-2" />
      </div>
    );
  }

  if (denied || !user) {
    return (
      <div className="grid min-h-screen place-items-center px-5">
        <div className="glass max-w-md p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Доступ запрещён</h1>
          <p className="mt-2 text-text-muted">
            Эта страница доступна только администраторам.
          </p>
          <button onClick={() => router.push("/dashboard")} className="btn-ghost mt-6">
            В личный кабинет
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen px-5 py-10">
      <div className="hero-aurora opacity-30" aria-hidden />
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-gradient text-white">
              E
            </span>
            ExchangeKit
            <span className="badge ml-1 !text-accent-2">админка</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-text-muted">
            <span className="hidden sm:inline">{user.email}</span>
            <button onClick={onLogout} className="hover:text-text">
              Выйти
            </button>
          </div>
        </div>

        <h1 className="font-display text-3xl font-bold">Панель управления</h1>

        <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-accent text-text"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tab === "dashboard" && <Dashboard />}
          {tab === "licenses" && <LicensesPanel />}
          {tab === "clients" && <ClientsPanel />}
          {tab === "payments" && <PaymentsPanel />}
          {tab === "content" && <ContentPanel />}
          {tab === "install-script" && <InstallScriptPanel />}
        </div>
      </div>
    </main>
  );
}
