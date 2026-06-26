"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { api } from "@/lib/api";

// ВАЖНО: success-страница НЕ выдаёт лицензию. Выдача — только по webhook.
// Здесь мы лишь опрашиваем статус лицензии, пока webhook её не закрепит.
export default function PaymentSuccessPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const lic = await api.licenseStatus();
        if (active && lic.has_license) {
          setReady(true);
          setTimeout(() => router.push("/dashboard"), 1500);
          return;
        }
      } catch {
        // ignore — возможно, сессия истекла
      }
      if (active) setTries((t) => t + 1);
    };
    const id = setInterval(poll, 2500);
    poll();
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [router]);

  return (
    <AuthCard
      title={ready ? "Лицензия выдана ✓" : "Обрабатываем оплату…"}
      subtitle={
        ready
          ? "Спасибо за покупку! Перенаправляем в личный кабинет."
          : "Платёж принят. Ожидаем подтверждение от платёжной системы — это обычно занимает несколько секунд."
      }
      footer={<Link href="/dashboard" className="text-accent-2 hover:underline">Перейти в кабинет</Link>}
    >
      <div className="flex flex-col items-center gap-4 py-2">
        {ready ? (
          <span className="text-4xl text-success">✓</span>
        ) : (
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent-2" />
        )}
        {!ready && tries > 6 && (
          <p className="text-center text-xs text-text-muted">
            Подтверждение занимает больше обычного. Лицензия появится в кабинете
            автоматически — можно обновить страницу позже.
          </p>
        )}
      </div>
    </AuthCard>
  );
}
