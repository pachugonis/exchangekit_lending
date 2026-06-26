import Link from "next/link";

export const metadata = { title: "Политика конфиденциальности — ExchangeKit" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20">
      <Link href="/" className="text-sm text-text-muted hover:text-text">
        ← На главную
      </Link>
      <h1 className="mt-6 font-display text-3xl font-bold">
        Политика конфиденциальности
      </h1>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-text-muted">
        <p>
          Мы уважаем вашу конфиденциальность и обрабатываем персональные данные в
          соответствии с Федеральным законом № 152-ФЗ «О персональных данных».
        </p>
        <h2 className="text-lg font-semibold text-text">Какие данные мы собираем</h2>
        <p>
          Email, используемый для регистрации, и данные о платеже, необходимые
          для выдачи лицензии и формирования чека по 54-ФЗ. Пароли хранятся в
          виде безопасного хеша.
        </p>
        <h2 className="text-lg font-semibold text-text">Цели обработки</h2>
        <p>
          Регистрация и авторизация, обработка платежа, выдача лицензии,
          направление сервисных уведомлений и оказание поддержки.
        </p>
        <h2 className="text-lg font-semibold text-text">Передача третьим лицам</h2>
        <p>
          Данные платежа передаются платёжному сервису ЮКасса. Иным третьим лицам
          данные не передаются, за исключением случаев, предусмотренных
          законодательством.
        </p>
        <p className="pt-4 text-xs">
          Это шаблон. Перед запуском замените на документ с реквизитами вашей
          организации и актуальными контактами.
        </p>
      </div>
    </main>
  );
}
