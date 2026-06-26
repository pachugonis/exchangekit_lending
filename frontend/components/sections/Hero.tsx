"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

const words = ["Запустите", "свой", "криптообменник", "за", "один", "день"];

export default function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden pt-20 pb-28">
      {!reduce && <div className="hero-aurora" aria-hidden />}
      <div className="grid-overlay" aria-hidden />

      <div className="relative mx-auto max-w-5xl px-5 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 flex flex-wrap items-center justify-center gap-2"
        >
          <span className="badge">⚡ Пожизненная лицензия</span>
          <span className="badge">♾ Обновления включены</span>
        </motion.div>

        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl md:text-7xl">
          <span className="mr-3 inline-flex flex-wrap justify-center gap-x-3">
            {words.map((w, i) => (
              <motion.span
                key={i}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.08, ease: "easeOut" }}
                className={w === "криптообменник" ? "gradient-text" : ""}
              >
                {w}
              </motion.span>
            ))}
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-text-muted sm:text-xl"
        >
          ExchangeKit — готовый софт для обмена криптовалют и электронных денег.
          Купите один раз — пользуйтесь всю жизнь. Без подписок и скрытых платежей.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.85 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link href="/register" className="btn-cta w-full sm:w-auto">
            Купить лицензию — 29 900 ₽
          </Link>
          <a
            href="https://demo.exchangekit.cc"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost w-full sm:w-auto"
          >
            Посмотреть демо →
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-text-muted"
        >
          <span>✓ Оплата через ЮКасса</span>
          <span>✓ Мгновенная выдача лицензии</span>
          <span>✓ Техподдержка</span>
        </motion.div>
      </div>
    </section>
  );
}
