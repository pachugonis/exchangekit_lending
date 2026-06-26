from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import User
from app.schemas.license import LicenseStatusOut
from app.security import get_current_user
from app.services.licenses import get_user_license

router = APIRouter(prefix="/api/license", tags=["license"])


@router.get("/me", response_model=LicenseStatusOut)
async def license_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    license_ = await get_user_license(db, user)
    if license_ is None:
        return LicenseStatusOut(has_license=False)
    return LicenseStatusOut(
        has_license=True,
        license_id=license_.id,
        filename=license_.filename,
        sold_at=license_.sold_at,
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
