"""Seed the database with the admin user only (no mock machines).

Fake demo machines (M-001..M-200) have been removed on user request — the
dashboard now only shows real machines that register themselves via
POST /api/device/update.
"""
from sqlalchemy.orm import Session

from app.models.models import User
from app.services.auth import hash_password


def seed_if_empty(db: Session):
    if db.query(User).count() == 0:
        db.add(User(username="admin", password_hash=hash_password("admin"), role="admin"))
        db.commit()
