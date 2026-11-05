
"""Khởi tạo lần chạy đầu. KHÔNG có dữ liệu giả lập: chỉ tạo tài khoản quản trị hệ thống của Phòng KHTC (mật khẩu trong
.env), ngưỡng mặc định theo mục 5.3 đề tài và danh mục mẫu (nội dung báo hỏng, tình huống) nạp một lần để trang Báo hỏng
có sẵn mục chọn; Phòng QTNL sửa, xóa ở trang Danh mục. Tài sản, dữ liệu cán bộ và tài khoản cá nhân của cán bộ do Phòng
KHTC nhập, cấp."""
import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from core.security import hash_password
from models import Account, AppSetting, AssetGroup, FaultItem, Situation, Threshold
from services.default_catalog import FAULTS, SITUATIONS

logger = logging.getLogger("uvicorn.error")


def _account_specs():
    # Bản cũ có thêm ba tài khoản dùng chung (canbo, qtnl, daumoi); nay mỗi cán bộ một tài khoản cá nhân nên không tạo.
    return [("admin", settings.ADMIN_USERNAME, settings.ADMIN_PASSWORD, settings.ADMIN_DISPLAY_NAME)]


async def ensure_accounts(db: AsyncSession) -> None:
    """Tạo tài khoản quản trị hệ thống nếu chưa có. Đã có thì giữ nguyên mật khẩu đang dùng."""
    existing = {a.kind for a in (await db.execute(select(Account))).scalars()}
    for kind, username, password, display in _account_specs():
        if kind in existing:
            continue
        if not password:
            logger.warning("Chưa đặt mật khẩu cho tài khoản %s (%s) trong .env nên chưa tạo.", kind, username)
            continue
        db.add(Account(kind=kind, username=username, password_hash=hash_password(password), display_name=display))
        logger.info("Đã tạo tài khoản %s (%s).", kind, username)


async def ensure_thresholds(db: AsyncSession) -> None:
    if await db.get(Threshold, 1) is None:
        db.add(
            Threshold(id=1, red_pct=20, orange_pct=30, orange_count=3, repeat_count=2, warehouse_months=12, cumulative_pct=40)
        )


CATALOG_FLAG = "default_catalog_seeded"


async def ensure_catalog(db: AsyncSession) -> None:
    """Nạp danh mục mẫu đúng một lần (đánh dấu trong app_settings); mục đã có thì giữ nguyên, không nạp trùng.
    Phòng QTNL xóa bớt sau đó thì lần khởi động sau không nạp lại."""
    if await db.get(AppSetting, CATALOG_FLAG) is not None:
        return
    groups = [(g.code, (g.name or "").lower()) for g in (await db.execute(select(AssetGroup))).scalars()]
    have = {(f.group_code, f.text.lower()) for f in (await db.execute(select(FaultItem))).scalars()}
    added = 0
    for column, codes, keywords, items in FAULTS:
        targets = list(codes) + [c for c, n in groups if keywords and any(k in n for k in keywords) and c not in codes]
        if not targets:
            logger.warning("Danh mục mẫu: chưa tìm thấy nhóm tài sản cho cột %s, bỏ qua (nhập ở trang Danh mục).", column)
        for code in targets:
            sort = (await db.execute(select(func.max(FaultItem.sort)).where(FaultItem.group_code == code))).scalar() or 0
            for text in items:
                if (code, text.lower()) in have:
                    continue
                sort += 1
                db.add(FaultItem(group_code=code, text=text, sort=sort))
                have.add((code, text.lower()))
                added += 1
    known = {s.text.lower() for s in (await db.execute(select(Situation))).scalars()}
    sort = (await db.execute(select(func.max(Situation.sort)))).scalar() or 0
    for text, urgent in SITUATIONS:
        if text.lower() not in known:
            sort += 1
            db.add(Situation(text=text, urgent=urgent, sort=sort))
    db.add(AppSetting(key=CATALOG_FLAG, value="05/11/2026"))
    logger.info("Đã nạp danh mục mẫu: %d nội dung báo hỏng, %d tình huống.", added, len(SITUATIONS))


async def run_seed(db: AsyncSession) -> None:
    await ensure_accounts(db)
    await ensure_thresholds(db)
    await ensure_catalog(db)
    await db.commit()
