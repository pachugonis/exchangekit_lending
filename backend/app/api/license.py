from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content import DEFAULT_CONTENT
from app.db import get_db
from app.models import ContentPage, User
from app.schemas.license import LicenseStatusOut
from app.security import get_current_user
from app.services.install_script import get_install_script
from app.services.licenses import get_user_license

router = APIRouter(prefix="/api/license", tags=["license"])

INSTALL_GUIDE_SLUG = "install_guide"


async def _install_guide(db: AsyncSession) -> tuple[str, str]:
    """Текст инструкции по установке: из БД, иначе дефолт. Только для покупателей."""
    page = await db.scalar(
        select(ContentPage).where(ContentPage.slug == INSTALL_GUIDE_SLUG)
    )
    if page is not None:
        return page.title, page.body
    default = DEFAULT_CONTENT[INSTALL_GUIDE_SLUG]
    return default["title"], default["body"]


@router.get("/me", response_model=LicenseStatusOut)
async def license_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    license_ = await get_user_license(db, user)
    if license_ is None:
        return LicenseStatusOut(has_license=False)
    script = await get_install_script(db)
    guide_title, guide_body = await _install_guide(db)
    return LicenseStatusOut(
        has_license=True,
        license_id=license_.id,
        filename=license_.filename,
        sold_at=license_.sold_at,
        install_script_available=script is not None,
        install_script_filename=script.filename if script else None,
        install_guide_title=guide_title,
        install_guide=guide_body,
    )


@router.get("/download")
async def license_download(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    license_ = await get_user_license(db, user)
    # Проверка владельца: get_user_license фильтрует по user.id.
    if license_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="У вас нет приобретённой лицензии.",
        )

    filename = license_.filename or "license.txt"
    return Response(
        content=license_.license_key,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/install-script")
async def install_script_download(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Доступ только владельцу купленной лицензии.
    license_ = await get_user_license(db, user)
    if license_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="У вас нет приобретённой лицензии.",
        )

    script = await get_install_script(db)
    if script is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Скрипт установки пока не загружен.",
        )

    return Response(
        content=script.content,
        media_type="application/x-sh; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{script.filename}"',
        },
    )
