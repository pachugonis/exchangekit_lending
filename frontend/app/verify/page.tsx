"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { api, ApiError } from "@/lib/api";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "ok" | "error">(
    token ? "loading" : "error"
  );
  const [message, setMessage] = useState(
    token ? "" : "Токен подтверждения отсутствует."
  );

  useEffect(() => {
    if (!token) return;
    api
      .verify(token)
      .then((r) => {
        setState("ok");
        setMessage(r.message);
      })
      .catch((err) => {
        setState("error");
        setMessage(err instanceof ApiError ? err.message : "Ошибка подтверждения.");
      });
  }, [token]);

  if (state === "loading") {
    return (
      <AuthCard title="Подтверждаем email…" subtitle="Пожалуйста, подождите.">
        <div className="flex justify-center py-4">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent-2" />
        </div>
      </AuthCard>
    );
  }

  if (state === "ok") {
    return (
      <AuthCard
        title="Email подтверждён ✓"
        subtitle={message}
        footer={<Link href="/login" className="text-accent-2 hover:underline">Войти в кабинет</Link>}
      >
        <div className="glass px-4 py-3 text-center text-sm text-success">
          Теперь вы можете войти и приобрести лицензию.
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Не удалось подтвердить"
      subtitle={message}
      footer={<Link href="/register" className="text-accent-2 hover:underline">Зарегистрироваться заново</Link>}
    >
      <div className="glass px-4 py-3 text-center text-sm text-danger">
        Ссылка недействительна или истекла.
      </div>
    </AuthCard>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<AuthCard title="Загрузка…">{null}</AuthCard>}>
      <VerifyInner />
    </Suspense>
  );
}
