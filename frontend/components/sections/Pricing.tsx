"use client";

import Link from "next/link";
import { Reveal } from "@/components/motion";
import CountUp from "@/components/CountUp";

const included = [
  "Пожизненная лицензия на ExchangeKit",
  "Все функции без ограничений",
  "Бесплатные обновления навсегда",
  "Техническая поддержка",
  "Помощь с установкой",
  "Без подписок и скрытых платежей",
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative py-24">
      <div className="mx-auto max-w-3xl px-5">
        <Reveal className="text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Один платёж — <span className="gradient-text">навсегда</span>
          </h2>
          <p className="mt-4 text-text-muted">
            Никаких ежемесячных платежей. Купите лицензию один раз.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          <div className="glass glass-glow relative mx-auto max-w-md p-8 text-center shadow-glow">
            <div className="mb-6 flex justify-center gap-2">
              <span className="badge">Пожизненно</span>
              <span className="badge">Обновления включены</span>
            </div>

            <div className="flex items-baseline justify-center gap-3 font-display font-bold tracking-tight">
              <span className="text-2xl text-text-muted line-through decoration-danger/70 decoration-2 sm:text-3xl">
                69 900 ₽
              </span>
              <span className="gradient-text text-5xl sm:text-6xl">
                <CountUp to={29900} /> ₽
              </span>
            </div>
            <p className="mt-2 text-sm text-text-muted">единоразово, НДС включён</p>

            <ul className="mt-8 space-y-3 text-left">
              {included.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-gradient text-[10px] text-white">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <Link href="/register" className="btn-cta mt-8 w-full">
              Купить лицензию
            </Link>
            <p className="mt-4 text-xs text-text-muted">
              Оплата картами РФ через ЮКасса. Лицензия выдаётся автоматически
              после оплаты.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
