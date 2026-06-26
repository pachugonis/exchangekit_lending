"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Reveal } from "@/components/motion";

const faq = [
  {
    q: "Что входит в лицензию?",
    a: "Пожизненное право использования софта ExchangeKit со всеми функциями, бесплатными обновлениями и технической поддержкой. Это разовый платёж — без подписок.",
  },
  {
    q: "Как происходит выдача лицензии?",
    a: "Сразу после успешной оплаты система автоматически закрепляет за вашим аккаунтом уникальный лицензионный файл. Вы получите его на email и сможете скачать в личном кабинете.",
  },
  {
    q: "Действительно ли обновления бесплатны?",
    a: "Да. Все будущие обновления — новые функции, направления обмена и улучшения безопасности — доступны без доплат в рамках вашей лицензии.",
  },
  {
    q: "Можно ли вернуть деньги?",
    a: "Поскольку лицензия — это цифровой товар с мгновенной выдачей, возврат возможен в соответствии с условиями оферты. Свяжитесь с поддержкой до использования лицензии.",
  },
  {
    q: "Какие способы оплаты доступны?",
    a: "Оплата проходит через ЮКассу: банковские карты РФ и другие доступные методы. Все платежи защищены, выдаётся чек по 54-ФЗ.",
  },
  {
    q: "Есть ли техническая поддержка?",
    a: "Да, мы помогаем с установкой, настройкой и интеграциями. Связаться можно по email или в Telegram.",
  },
];

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={open}
      >
        <span className="font-medium">{q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-2xl leading-none text-accent-2"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <p className="px-6 pb-5 text-sm leading-relaxed text-text-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  return (
    <section id="faq" className="relative py-24">
      <div className="mx-auto max-w-3xl px-5">
        <Reveal className="text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Частые вопросы
          </h2>
        </Reveal>
        <div className="mt-12 space-y-3">
          {faq.map((f) => (
            <Reveal key={f.q}>
              <Item q={f.q} a={f.a} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
