from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InstallScript


async def get_install_script(db: AsyncSession) -> InstallScript | None:
    """Текущий (последний загруженный) скрипт установки или None."""
    return await db.scalar(
        select(InstallScript).order_by(InstallScript.updated_at.desc()).limit(1)
    )


async def set_install_script(
    db: AsyncSession, *, filename: str, content: str
) -> InstallScript:
    """Сохраняет/перезаписывает скрипт установки (храним одной строкой)."""
    script = await get_install_script(db)
    if script is None:
        script = InstallScript(filename=filename, content=content)
        db.add(script)
    else:
        script.filename = filename
        script.content = content
    await db.commit()
    await db.refresh(script)
    return script
