from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content import DEFAULT_CONTENT, PUBLIC_SLUGS
from app.db import get_db
from app.models import ContentPage
from app.schemas.admin import ContentPageOut

router = APIRouter(prefix="/api/content", tags=["content"])


@router.get("/{slug}", response_model=ContentPageOut)
async def get_public_content(slug: str, db: AsyncSession = Depends(get_db)):
    if slug not in PUBLIC_SLUGS:
        raise HTTPException(status_code=404, detail="Страница не найдена")

    page = await db.scalar(select(ContentPage).where(ContentPage.slug == slug))
    if page is not None:
        return page

    # Fallback на дефолт, если строки ещё нет (миграция не прогонялась).
    default = DEFAULT_CONTENT[slug]
    return ContentPageOut(
        slug=slug, title=default["title"], body=default["body"], updated_at=None
    )
