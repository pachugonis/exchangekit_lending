"use client";

import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion";

const capabilities = [
  "Обмен крипты и электронных денег",
  "Множество платёжных направлений",
  "Гибкое управление курсами и резервами",
  "Автоматические и ручные выплаты",
  "Реферальная программа",
  "Промокоды и скидки",
  "Антифрод и блок-листы",
  "Уведомления (email / Telegram)",
  "Мультиязычность",
  "API для интеграций",
  "Логи и аудит действий",
  "Резервное копирование",
];

export default function Capabilities() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              Возможности <span className="gradient-text">из коробки</span>
            </h2>
            <p className="mt-4 max-w-md text-text-muted">
              ExchangeKit поставляется с полным набором функций для работающего
              обменного сервиса. Установка, настройка и запуск — без команды
              разработчиков.
            </p>
            <a href="https://demo.exchangekit.cc" target="_blank" rel="noreferrer" className="btn-ghost mt-8">
              Открыть демо →
            </a>
          </Reveal>

          <StaggerGroup className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((c) => (
              <StaggerItem key={c}>
                <div className="glass flex items-center gap-3 px-4 py-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-gradient text-xs text-white">
                    ✓
                  </span>
                  <span className="text-sm">{c}</span>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}
