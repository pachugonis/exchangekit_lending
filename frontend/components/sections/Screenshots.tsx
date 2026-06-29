"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/motion";

type Screen = {
  src: string;
  title: string;
  desc: string;
};

// Реальные скриншоты интерфейса (лежат в public/screens).
const screens: Screen[] = [
  { src: "/screens/01-landing-hero.png", title: "Главная страница", desc: "Продающий лендинг с курсами и быстрым стартом обмена" },
  { src: "/screens/02-rates.png", title: "Курсы криптовалют", desc: "Актуальные курсы, обновляются автоматически" },
  { src: "/screens/03-directions.png", title: "Направления обмена", desc: "Популярные пары с актуальными курсами" },
  { src: "/screens/04-how-it-works.png", title: "Как работает обмен", desc: "Понятный процесс обмена в 4 шага" },
  { src: "/screens/05-cabinet.png", title: "Личный кабинет", desc: "История заявок, статусы и избранные направления" },
  { src: "/screens/06-admin-dashboard.png", title: "Админ: панель управления", desc: "Статистика заявок, объёмов и пользователей" },
  { src: "/screens/07-admin-orders.png", title: "Админ: управление заявками", desc: "Просмотр и обработка всех обменов" },
  { src: "/screens/08-admin-currencies.png", title: "Админ: валюты и резервы", desc: "Настройка валют, курсов и лимитов" },
  { src: "/screens/09-admin-promo.png", title: "Админ: промокоды", desc: "Скидки, бонусы и акции для клиентов" },
  { src: "/screens/10-admin-content.png", title: "Админ: управление контентом", desc: "Редактирование страниц «О нас» и FAQ" },
  { src: "/screens/11-admin-newsletter.png", title: "Админ: email-рассылки", desc: "Подписчики, кампании и логи отправки" },
  { src: "/screens/12-admin-settings.png", title: "Админ: настройки сайта", desc: "Темы оформления и идентичность бренда" },
];

export default function Screenshots() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);

  const go = useCallback(
    (next: number) => {
      setDir(next > index || (index === screens.length - 1 && next === 0) ? 1 : -1);
      setIndex((next + screens.length) % screens.length);
    },
    [index],
  );

  const prev = useCallback(() => {
    setDir(-1);
    setIndex((i) => (i - 1 + screens.length) % screens.length);
  }, []);

  const nextSlide = useCallback(() => {
    setDir(1);
    setIndex((i) => (i + 1) % screens.length);
  }, []);

  // Автопрокрутка (уважает prefers-reduced-motion).
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(nextSlide, 5000);
    return () => clearInterval(id);
  }, [reduce, nextSlide, index]);

  const active = screens[index];

  return (
    <section id="screens" className="relative py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Современный интерфейс
          </h2>
          <p className="mt-4 text-text-muted">
            Удобно клиентам, понятно администраторам. Адаптивно на любых устройствах.
          </p>
        </Reveal>

        <Reveal className="mt-14">
          <div className="glass overflow-hidden">
            {/* Шапка-«браузер» */}
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-danger/70" />
              <span className="h-3 w-3 rounded-full bg-[#f5c518]/70" />
              <span className="h-3 w-3 rounded-full bg-success/70" />
              <span className="ml-3 truncate text-xs text-text-muted">{active.title}</span>
            </div>

            {/* Слайд */}
            <div className="relative aspect-video overflow-hidden bg-bg-elev">
              <AnimatePresence initial={false} mode="popLayout" custom={dir}>
                <motion.div
                  key={index}
                  custom={dir}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -60 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="absolute inset-0"
                >
                  <Image
                    src={active.src}
                    alt={active.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 1024px"
                    className="object-cover object-top"
                    priority={index === 0}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Стрелки */}
              <button
                type="button"
                onClick={prev}
                aria-label="Предыдущий скриншот"
                className="group absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-bg/70 text-text backdrop-blur transition hover:bg-bg/90"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={nextSlide}
                aria-label="Следующий скриншот"
                className="group absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-bg/70 text-text backdrop-blur transition hover:bg-bg/90"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>

            {/* Подпись */}
            <div className="px-5 py-4">
              <div className="text-sm font-medium text-text">{active.title}</div>
              <div className="mt-1 text-sm text-text-muted">{active.desc}</div>
            </div>
          </div>

          {/* Точки-индикаторы */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {screens.map((s, i) => (
              <button
                key={s.src}
                type="button"
                onClick={() => go(i)}
                aria-label={`Перейти к: ${s.title}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-accent-gradient" : "w-2 bg-white/15 hover:bg-white/30"
                }`}
              />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
