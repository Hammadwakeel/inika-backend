from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from backend.app.core.config import DB_FILENAME, TENANTS_ROOT


class TenantConnectionPool:
    _instances: dict[str, TenantConnectionPool] = {}
    _lock = threading.Lock()

    def __init__(self, tenant_id: str, db_path: Path):
        self.tenant_id = tenant_id
        self.db_path = db_path
        self._local = threading.local()

    @classmethod
    def get_pool(cls, tenant_id: str) -> TenantConnectionPool:
        with cls._lock:
            if tenant_id not in cls._instances:
                db_path = TENANTS_ROOT / tenant_id / DB_FILENAME
                cls._instances[tenant_id] = cls(tenant_id, db_path)
            return cls._instances[tenant_id]

    @classmethod
    def clear_pools(cls) -> None:
        with cls._lock:
            for pool in cls._instances.values():
                pool._close_all()
            cls._instances.clear()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=30000")
        return conn

    @property
    def _connection(self) -> sqlite3.Connection:
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = self._get_connection()
        return self._local.conn

    @contextmanager
    def connection(self) -> Generator[sqlite3.Connection, None, None]:
        conn = self._get_connection()
        try:
            yield conn
        finally:
            conn.close()

    @contextmanager
    def managed(self) -> Generator[sqlite3.Connection, None, None]:
        yield self._connection

    def _close_all(self) -> None:
        if hasattr(self._local, "conn") and self._local.conn:
            try:
                self._local.conn.close()
            except Exception:
                pass
            self._local.conn = None

    def close(self) -> None:
        self._close_all()


@contextmanager
def get_tenant_connection(tenant_id: str) -> Generator[sqlite3.Connection, None, None]:
    pool = TenantConnectionPool.get_pool(tenant_id)
    with pool.connection() as conn:
        yield conn


def close_tenant_pool(tenant_id: str) -> None:
    if tenant_id in TenantConnectionPool._instances:
        TenantConnectionPool._instances[tenant_id].close()
        del TenantConnectionPool._instances[tenant_id]
