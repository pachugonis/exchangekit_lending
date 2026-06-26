"use client";

import Link from "next/link";
import AuthCard from "@/components/AuthCard";

export default function PaymentCancelPage() {
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
