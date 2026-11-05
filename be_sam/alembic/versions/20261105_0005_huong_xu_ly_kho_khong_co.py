"""Kho không có thiết bị thay thế (05/11/2026): thêm hướng xử lý đã báo lại người báo hỏng, ví dụ đề nghị chuyển phòng
học, mượn thiết bị của đơn vị khác. Phiếu vẫn lưu để lưu vết dù không cấp được thiết bị.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0005'
down_revision: Union[str, None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('no_spares', sa.Column('handling', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('no_spares', 'handling')
