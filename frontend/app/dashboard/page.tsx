"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api, ApiError, type User, type LicenseStatus } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        setUser(me);
        const lic = await api.licenseStatus();
        setLicense(lic);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError("Не удалось загрузить данные.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function onBuy() {
    setError(null);
    setBuying(true);
    try {
      const { confirmation_url } = await api.createPayment();
      window.location.href = confirmation_url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать платёж.");
      setBuying(false);
    }
  }

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

  return (
    <main className="relative min-h-screen px-5 py-12">
      <div className="hero-aurora opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-3xl">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-gradient text-white">
              E
            </span>
            ExchangeKit
          </div>
          <div className="flex items-center gap-4 text-sm text-text-muted">
            {user?.is_admin && (
              <a href="/admin" className="text-accent-2 hover:underline">
                Админка
              </a>
            )}
            <button onClick={onLogout} className="hover:text-text">
              Выйти
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="font-display text-3xl font-bold">Личный кабинет</h1>
          <p className="mt-2 flex items-center gap-2 text-text-muted">
            {user?.email}
            {user?.is_email_verified ? (
              <span className="badge !text-success">email подтверждён</span>
            ) : (
              <span className="badge !text-danger">email не подтверждён</span>
            )}
          </p>
        </motion.div>

        {error && (
          <div className="glass mt-6 px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {!user?.is_email_verified && (
          <div className="glass mt-6 px-5 py-4 text-sm text-text-muted">
            Подтвердите email, чтобы приобрести лицензию. Мы отправили ссылку на{" "}
            {user?.email}.
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="glass glass-glow mt-8 p-8"
        >
          {license?.has_license ? (
            <>
              <div className="mb-2 flex items-center gap-2">
                <span className="badge !text-success">Лицензия активна</span>
              </div>
              <h2 className="font-display text-2xl font-bold">
                Ваша лицензия ExchangeKit
              </h2>
              <p className="mt-2 text-sm text-text-muted">
                Файл: {license.filename}
                {license.sold_at && (
                  <> · приобретена{" "}
                  {new Date(license.sold_at).toLocaleDateString("ru-RU")}</>
                )}
              </p>
              <a
                href="/api/license/download"
                className="btn-cta mt-6"
              >
                ↓ Скачать лицензию (.txt)
              </a>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold">
                Пожизненная лицензия
              </h2>
              <p className="mt-2 text-text-muted">
                Получите полный доступ к ExchangeKit. Один платёж — навсегда.
              </p>
              <div className="mt-6 font-display text-4xl font-bold">
                <span className="gradient-text">29 900 ₽</span>
              </div>
              <button
                onClick={onBuy}
                disabled={buying || !user?.is_email_verified}
                className="btn-cta mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {buying ? "Создаём платёж…" : "Купить лицензию"}
              </button>
              {!user?.is_email_verified && (
                <p className="mt-3 text-xs text-text-muted">
                  Покупка доступна после подтверждения email.
                </p>
              )}
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
}
