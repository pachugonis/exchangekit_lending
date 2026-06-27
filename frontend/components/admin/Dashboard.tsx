"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, type AdminStats } from "@/lib/api";
import { formatMoney, formatNumber } from "@/lib/format";

function StatCard({
  label,
  value,
  hint,
  accent,
  delay,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass glass-glow p-6"
    >
      <p className="text-sm text-text-muted">{label}</p>
      <p
        className={`mt-2 font-display text-3xl font-bold ${
          accent ? "gradient-text" : ""
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </motion.div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.admin
      .stats()
      .then(setStats)
      .catch(() => setError("Не удалось загрузить статистику."));
  }, []);

  if (error) return <div className="glass px-5 py-4 text-sm text-danger">{error}</div>;

  if (!stats) {
    return (
      <div className="grid place-items-center py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent-2" />
      </div>
    );
  }

  const lowPool = stats.licenses_free <= 5;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Выручка"
          value={formatMoney(stats.revenue_total)}
          hint={`${stats.payments_succeeded} успешных платежей`}
          accent
          delay={0}
        />
        <StatCard
          label="Продано лицензий"
          value={formatNumber(stats.licenses_sold)}
          hint={`из ${stats.licenses_total} в пуле`}
          delay={0.05}
        />
        <StatCard
          label="Свободно лицензий"
          value={formatNumber(stats.licenses_free)}
          hint={lowPool ? "⚠️ пул заканчивается" : "доступно к продаже"}
          delay={0.1}
        />
        <StatCard
          label="Пользователей"
          value={formatNumber(stats.users_total)}
          hint={`${stats.users_verified} с подтверждённым email`}
          delay={0.15}
        />
      </div>

      {lowPool && (
        <div className="glass border-danger/40 px-5 py-4 text-sm text-danger">
          Свободных лицензий осталось мало ({stats.licenses_free}). Загрузите новые
          файлы во вкладке «Лицензии», иначе продажи пойдут «в минус».
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass p-5">
          <p className="text-sm text-text-muted">Платежи в ожидании</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {formatNumber(stats.payments_pending)}
          </p>
        </div>
        <div className="glass p-5">
          <p className="text-sm text-text-muted">Лицензии в резерве</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {formatNumber(stats.licenses_reserved)}
          </p>
        </div>
        <div className="glass p-5">
          <p className="text-sm text-text-muted">Конверсия в продажу</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {stats.users_total
              ? Math.round((stats.licenses_sold / stats.users_total) * 100)
              : 0}
            %
          </p>
        </div>
      </div>
    </div>
  );
}
