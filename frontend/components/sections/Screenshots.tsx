"use client";

import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion";

const screens = [
  { title: "Витрина обмена", desc: "Курсы, направления, калькулятор" },
  { title: "Админ-панель", desc: "Заявки, резервы, статистика" },
  { title: "Кабинет клиента", desc: "История обменов и статусы" },
];

// Заглушки-превью интерфейса (CSS-мокапы). Заменяются реальными скриншотами.
function ScreenMock({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="glass overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-danger/70" />
        <span className="h-3 w-3 rounded-full bg-[#f5c518]/70" />
        <span className="h-3 w-3 rounded-full bg-success/70" />
        <span className="ml-3 text-xs text-text-muted">{title}</span>
      </div>
      <div className="relative aspect-video bg-gradient-to-br from-bg-elev to-bg p-5">
        <div className="grid-overlay opacity-60" />
        <div className="relative space-y-3">
          <div className="h-7 w-2/3 rounded-md bg-accent-gradient opacity-80" />
          <div className="h-4 w-1/2 rounded bg-white/10" />
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="h-16 rounded-lg bg-white/5" />
            <div className="h-16 rounded-lg bg-white/5" />
            <div className="h-16 rounded-lg bg-white/5" />
          </div>
          <div className="h-9 w-32 rounded-lg bg-accent-gradient" />
        </div>
      </div>
      <div className="px-4 py-3 text-sm text-text-muted">{desc}</div>
    </div>
  );
}

export default function Screenshots() {
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

        <StaggerGroup className="mt-14 grid gap-5 md:grid-cols-3">
          {screens.map((s) => (
            <StaggerItem key={s.title}>
              <ScreenMock title={s.title} desc={s.desc} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
