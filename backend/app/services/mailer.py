import logging
from email.message import EmailMessage

import aiosmtplib

from app.config import settings

logger = logging.getLogger("mailer")


async def _send(to: str, subject: str, html: str, plain: str) -> None:
    if not settings.smtp_host:
        # В dev без SMTP — просто логируем, чтобы не падать.
        logger.warning("SMTP не настроен. Письмо для %s:\n%s", to, plain)
        return

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(plain)
    message.add_alternative(html, subtype="html")

    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user or None,
        password=settings.smtp_password or None,
        start_tls=settings.smtp_port == 587,
        use_tls=settings.smtp_port == 465,
    )
    logger.info("Письмо отправлено: %s — %s", to, subject)


async def send_verification_email(to: str, token: str) -> None:
    verify_url = f"{settings.app_base_url}/verify?token={token}"
    subject = "Подтверждение email — ExchangeKit"
    plain = (
        "Спасибо за регистрацию в ExchangeKit!\n\n"
        f"Подтвердите ваш email, перейдя по ссылке:\n{verify_url}\n\n"
        "Ссылка действительна 24 часа."
    )
    html = f"""\
    <div style="font-family:Inter,Arial,sans-serif;background:#0A0A0F;color:#EDEDF2;padding:32px">
      <h2 style="color:#6C5CE7">ExchangeKit</h2>
      <p>Спасибо за регистрацию! Подтвердите ваш email:</p>
      <p>
        <a href="{verify_url}"
           style="display:inline-block;padding:12px 24px;border-radius:10px;
                  background:linear-gradient(135deg,#6C5CE7,#00D2FF);
                  color:#fff;text-decoration:none;font-weight:600">
          Подтвердить email
        </a>
      </p>
      <p style="color:#9A9AB0;font-size:13px">Ссылка действительна 24 часа.</p>
    </div>"""
    await _send(to, subject, html, plain)


async def send_license_email(
    to: str,
    license_key: str,
    filename: str,
    has_install_script: bool = False,
) -> None:
    dashboard_url = f"{settings.app_base_url}/dashboard"
    subject = "Ваша лицензия ExchangeKit"
    script_note_plain = (
        "\n\nКак установить:\n"
        "1. Скачайте в кабинете лицензию (license.txt) и скрипт установки (install.sh).\n"
        "2. Положите оба файла в одну папку на сервере.\n"
        "3. Выполните: chmod +x install.sh && sudo ./install.sh\n"
        "Полная инструкция — в личном кабинете."
        if has_install_script
        else ""
    )
    script_note_html = (
        '<p style="color:#9A9AB0;font-size:14px">В личном кабинете также '
        "доступны <b>скрипт установки</b> и пошаговая инструкция. Кратко: "
        "скачайте лицензию и install.sh в одну папку и выполните "
        "<code>chmod +x install.sh &amp;&amp; sudo ./install.sh</code>.</p>"
        if has_install_script
        else ""
    )
    plain = (
        "Оплата прошла успешно. Ваша пожизненная лицензия ExchangeKit:\n\n"
        f"--- {filename} ---\n{license_key}\n\n"
        f"Скачать также можно в личном кабинете: {dashboard_url}"
        f"{script_note_plain}"
    )
    html = f"""\
    <div style="font-family:Inter,Arial,sans-serif;background:#0A0A0F;color:#EDEDF2;padding:32px">
      <h2 style="color:#6C5CE7">Спасибо за покупку!</h2>
      <p>Ваша пожизненная лицензия ExchangeKit ({filename}):</p>
      <pre style="background:#12121A;border:1px solid rgba(255,255,255,0.08);
                  padding:16px;border-radius:10px;white-space:pre-wrap">{license_key}</pre>
      {script_note_html}
      <p>
        <a href="{dashboard_url}"
           style="display:inline-block;padding:12px 24px;border-radius:10px;
                  background:linear-gradient(135deg,#6C5CE7,#00D2FF);
                  color:#fff;text-decoration:none;font-weight:600">
          Открыть личный кабинет
        </a>
      </p>
    </div>"""
    await _send(to, subject, html, plain)
