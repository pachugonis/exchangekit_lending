"use client";

import { useState } from "react";
import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import { api, ApiError } from "@/lib/api";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Пароль должен быть не короче 8 символов.");
      return;
    }
    setLoading(true);
    try {
      await api.register(email, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Что-то пошло не так.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthCard
        title="Проверьте почту"
        subtitle={`Мы отправили письмо для подтверждения на ${email}. Перейдите по ссылке из письма, чтобы активировать аккаунт.`}
        footer={<Link href="/login" className="text-accent-2 hover:underline">Перейти ко входу</Link>}
      >
        <div className="glass px-4 py-3 text-sm text-text-muted">
          Не пришло письмо? Проверьте папку «Спам» или попробуйте войти —
          возможно, аккаунт с таким email уже существует.
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Создать аккаунт"
      subtitle="Регистрация для покупки лицензии ExchangeKit"
      footer={
        <>
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-accent-2 hover:underline">Войти</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm text-text-muted">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-text-muted">Пароль</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            placeholder="Минимум 8 символов"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button type="submit" disabled={loading} className="btn-cta w-full disabled:opacity-60">
          {loading ? "Регистрация…" : "Зарегистрироваться"}
        </button>

        <p className="text-center text-xs text-text-muted">
          Регистрируясь, вы принимаете{" "}
          <Link href="/offer" className="hover:underline">оферту</Link> и{" "}
          <Link href="/privacy" className="hover:underline">политику конфиденциальности</Link>.
        </p>
      </form>
    </AuthCard>
  );
}
