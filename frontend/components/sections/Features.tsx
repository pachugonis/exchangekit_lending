"use client";

import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion";

const features = [
  {
    icon: "⚡",
    title: "Высокая скорость",
    text: "Асинхронная обработка обменов, мгновенные расчёты курсов и автоматические выплаты.",
  },
  {
    icon: "🔒",
    title: "Безопасность",
    text: "Двухфакторная аутентификация, защита от фрода, шифрование данных и холодные кошельки.",
  },
  {
    icon: "🛠",
    title: "Гибкая настройка",
    text: "Десятки платёжных направлений, собственные курсы, резервы и правила обмена.",
  },
  {
    icon: "📈",
    title: "Аналитика",
    text: "Подробная статистика по заявкам, прибыли и резервам в реальном времени.",
  },
  {
    icon: "♾",
    title: "Бесплатные обновления",
    text: "Новые функции, направления и улучшения безопасности — навсегда и без доплат.",
  },
  {
    icon: "💬",
    title: "Поддержка",
    text: "Помощь с установкой, настройкой и интеграциями от команды ExchangeKit.",
  },
];

export default function Features() {
  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Всё для запуска <span className="gradient-text">обменника</span>
          </h2>
          <p className="mt-4 text-text-muted">
            Готовое решение, которое закрывает технические задачи — вы
            сосредотачиваетесь на бизнесе.
          </p>
        </Reveal>

        <StaggerGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <StaggerItem key={f.title}>
              <div className="glass glass-glow group h-full p-6 transition-transform duration-300 hover:-translate-y-1">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-bg-elev text-2xl">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  {f.text}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
