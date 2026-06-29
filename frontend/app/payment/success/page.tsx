"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { api } from "@/lib/api";

// Сколько раз опрашиваем статус, прежде чем считать платёж незавершённым.
// ЮКасса редиректит на return_url и при отмене/выходе из оплаты, но статус
// при этом ещё какое-то время остаётся pending. Чтобы не показывать вечно
// «ожидаем подтверждение», после таймаута показываем нейтральный экран.
const MAX_TRIES = 8; // ~20 c при интервале 2.5 c

// ВАЖНО: success-страница НЕ выдаёт лицензию. Выдача — только по webhook.
// Здесь мы лишь опрашиваем статус лицензии, пока webhook её не закрепит.
export default function PaymentSuccessPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [tries, setTries] = useState(0);
  const attempts = useRef(0);

  useEffect(() => {
    let active = true;
    let id: ReturnType<typeof setInterval>;
    const stop = () => {
      active = false;
      clearInterval(id);
    };
    const poll = async () => {
      try {
        // Активная проверка: бэкенд перепроверяет статус через API ЮКасса
        // и при succeeded выдаёт лицензию (фолбэк, если webhook задержан).
        const res = await api.verifyPayment();
        if (!active) return;
        if (res.has_license) {
          setReady(true);
          stop();
          setTimeout(() => router.push("/dashboard"), 1500);
          return;
        }
        // ЮКасса редиректит на return_url и при отмене платежа — ловим это
        // здесь и показываем сценарий отмены вместо бесконечного ожидания.
        if (res.status === "canceled") {
          setCanceled(true);
          stop();
          return;
        }
        // Нет ожидающего платежа (или он не найден) — здесь делать нечего.
        if (res.status === "none") {
          setTimedOut(true);
          stop();
          return;
        }
      } catch {
        // ignore — возможно, сессия истекла
      }
      if (!active) return;
      attempts.current += 1;
      setTries(attempts.current);
      // Платёж так и не подтвердился за разумное время — вероятно, пользователь
      // вышел из оплаты. Прекращаем ожидание и показываем нейтральный экран.
      if (attempts.current >= MAX_TRIES) {
        setTimedOut(true);
        stop();
      }
    };
    id = setInterval(poll, 2500);
    poll();
    return stop;
  }, [router]);

  if (canceled) {
    return (
      <AuthCard
        title="Оплата не завершена"
        subtitle="Платёж был отменён или прерван. Деньги не списаны."
        footer={<Link href="/dashboard" className="text-accent-2 hover:underline">Вернуться в кабинет</Link>}
      >
        <div className="glass px-4 py-3 text-center text-sm text-text-muted">
          Вы можете повторить покупку лицензии в любой момент из личного кабинета.
        </div>
      </AuthCard>
    );
  }

  // Таймаут: подтверждение не пришло. Не утверждаем, что платёж прошёл, —
  // мягко поясняем оба исхода (оплатил → лицензия появится; вышел → не списано).
  if (timedOut) {
    return (
      <AuthCard
        title="Подтверждение не получено"
        subtitle="Мы не дождались ответа от платёжной системы."
        footer={<Link href="/dashboard" className="text-accent-2 hover:underline">Перейти в кабинет</Link>}
      >
        <div className="glass px-4 py-3 text-center text-sm text-text-muted">
          Если вы завершили оплату — лицензия появится в кабинете автоматически
          в течение нескольких минут. Если вы отменили платёж — деньги не списаны,
          и покупку можно повторить из личного кабинета.
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={ready ? "Лицензия выдана ✓" : "Обрабатываем оплату…"}
      subtitle={
        ready
          ? "Спасибо за покупку! Перенаправляем в личный кабинет."
          : "Проверяем статус платежа в платёжной системе — это обычно занимает несколько секунд."
      }
      footer={<Link href="/dashboard" className="text-accent-2 hover:underline">Перейти в кабинет</Link>}
    >
      <div className="flex flex-col items-center gap-4 py-2">
        {ready ? (
          <span className="text-4xl text-success">✓</span>
        ) : (
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent-2" />
        )}
        {!ready && tries > 4 && (
          <p className="text-center text-xs text-text-muted">
            Подтверждение занимает больше обычного. Если вы отменили оплату —
            деньги не списаны.
          </p>
        )}
      </div>
    </AuthCard>
  );
}
