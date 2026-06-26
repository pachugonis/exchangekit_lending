import Link from "next/link";

export const metadata = { title: "Публичная оферта — ExchangeKit" };

export default function OfferPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20">
      <Link href="/" className="text-sm text-text-muted hover:text-text">
        ← На главную
      </Link>
      <h1 className="mt-6 font-display text-3xl font-bold">Публичная оферта</h1>
      <div className="prose-invert mt-8 space-y-4 text-sm leading-relaxed text-text-muted">
        <p>
          Настоящий документ является официальным предложением (публичной
          офертой) о заключении договора на предоставление неисключительной
          пожизненной лицензии на программное обеспечение ExchangeKit.
        </p>
        <h2 className="text-lg font-semibold text-text">1. Предмет договора</h2>
        <p>
          Продавец предоставляет Покупателю неисключительную лицензию на
          использование ПО ExchangeKit без ограничения срока. Стоимость лицензии
          составляет 29 900 ₽ (включая НДС).
        </p>
        <h2 className="text-lg font-semibold text-text">2. Порядок оплаты и выдачи</h2>
        <p>
          Оплата производится через платёжный сервис ЮКасса. После подтверждения
          оплаты лицензионный файл автоматически закрепляется за аккаунтом
          Покупателя и направляется на указанный email.
        </p>
        <h2 className="text-lg font-semibold text-text">3. Возврат</h2>
        <p>
          Поскольку лицензия является цифровым товаром с моментальной выдачей,
          условия возврата регулируются законодательством РФ. Для запроса
          возврата свяжитесь с поддержкой до начала использования лицензии.
        </p>
        <p className="pt-4 text-xs">
          Это шаблон оферты. Перед запуском замените на юридически проверенный
          документ с реквизитами вашей организации.
        </p>
      </div>
    </main>
  );
}
