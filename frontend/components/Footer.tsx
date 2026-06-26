import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg-elev">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-gradient text-white">
              E
            </span>
            ExchangeKit
          </div>
          <p className="mt-3 max-w-xs text-sm text-text-muted">
            Готовый софт для криптообменника. Пожизненная лицензия и бесплатные
            обновления.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-text">Продукт</h4>
          <ul className="space-y-2 text-sm text-text-muted">
            <li><a className="hover:text-text" href="#features">Возможности</a></li>
            <li><a className="hover:text-text" href="#pricing">Цена</a></li>
            <li>
              <a className="hover:text-text" href="https://demo.exchangekit.cc" target="_blank" rel="noreferrer">
                Демо
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-text">Документы</h4>
          <ul className="space-y-2 text-sm text-text-muted">
            <li><Link className="hover:text-text" href="/offer">Публичная оферта</Link></li>
            <li><Link className="hover:text-text" href="/privacy">Политика конфиденциальности</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-text">Контакты</h4>
          <ul className="space-y-2 text-sm text-text-muted">
            <li><a className="hover:text-text" href="mailto:support@exchangekit.cc">support@exchangekit.cc</a></li>
            <li><a className="hover:text-text" href="https://t.me/exchangekit" target="_blank" rel="noreferrer">Telegram</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 text-xs text-text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} ExchangeKit. Все права защищены.</span>
          <span>Оплата картами РФ через ЮКасса</span>
        </div>
      </div>
    </footer>
  );
}
