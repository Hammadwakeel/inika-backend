from __future__ import annotations

import os
import sqlite3
import time
from typing import Any

from app.services.auth_service import get_tenant_conn


INIKA_API_BASE = "https://grssl.payfiller.com/inika/webhook"


class InikaClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.environ.get("INIKA_API_KEY", "")
        self.base_url = INIKA_API_BASE

    def get_headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}" if self.api_key else "",
        }


def fetch_guest_inventory(tenant_id: str) -> dict[str, Any]:
    import urllib.request

    inika_client = InikaClient()
    api_key = os.environ.get("INIKA_BOOKING_KEY", "")

    url = f"{inika_client.base_url}/getInventoryAPI/{api_key}"

    try:
        data = b'{"status":1}'
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            result = response.read().decode("utf-8")
            return {"status": "ok", "data": result}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def sync_guests_to_db(tenant_id: str, guest_data: list[dict[str, Any]]) -> int:
    synced = 0
    with get_tenant_conn(tenant_id) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS guest_inventory (
                id TEXT PRIMARY KEY,
                tid TEXT,
                rid TEXT,
                room TEXT,
                gname TEXT,
                mobile TEXT,
                gstatus TEXT,
                gcount TEXT,
                btype TEXT,
                sub_booking_id TEXT,
                driver_tag TEXT,
                cindate TEXT,
                coutdate TEXT,
                synced_at INTEGER
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_guest_mobile ON guest_inventory(mobile)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_guest_status ON guest_inventory(gstatus)"
        )

        now = int(time.time())
        for guest in guest_data:
            conn.execute(
                """
                INSERT OR REPLACE INTO guest_inventory
                (id, tid, rid, room, gname, mobile, gstatus, gcount, btype,
                 sub_booking_id, driver_tag, cindate, coutdate, synced_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    guest.get("id", ""),
                    guest.get("tid", ""),
                    guest.get("rid", ""),
                    guest.get("room", ""),
                    guest.get("gname", ""),
                    guest.get("mobile", ""),
                    guest.get("gstatus", ""),
                    guest.get("gcount", ""),
                    guest.get("btype", ""),
                    guest.get("SubBookingId", guest.get("sub_booking_id", "")),
                    guest.get("driverTag", ""),
                    guest.get("cindate", ""),
                    guest.get("coutdate", ""),
                    now,
                ),
            )
            synced += 1
        conn.commit()

    return synced


def get_active_guests(tenant_id: str) -> list[dict[str, Any]]:
    with get_tenant_conn(tenant_id) as conn:
        # Ensure table exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS guest_inventory (
                id TEXT PRIMARY KEY,
                tid TEXT,
                rid TEXT,
                room TEXT,
                gname TEXT,
                mobile TEXT,
                gstatus TEXT,
                gcount TEXT,
                btype TEXT,
                sub_booking_id TEXT,
                driver_tag TEXT,
                cindate TEXT,
                coutdate TEXT,
                synced_at INTEGER
            )
        """)
        rows = conn.execute(
            """
            SELECT * FROM guest_inventory
            WHERE gstatus IN ('Arrived', 'Confirmed', 'StayOver', 'Due In')
            ORDER BY cindate DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]


def get_guest_by_mobile(tenant_id: str, mobile: str) -> dict[str, Any] | None:
    with get_tenant_conn(tenant_id) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS guest_inventory (
                id TEXT PRIMARY KEY, tid TEXT, rid TEXT, room TEXT, gname TEXT,
                mobile TEXT, gstatus TEXT, gcount TEXT, btype TEXT,
                sub_booking_id TEXT, driver_tag TEXT, cindate TEXT, coutdate TEXT, synced_at INTEGER
            )
        """)
        row = conn.execute(
            "SELECT * FROM guest_inventory WHERE mobile = ? ORDER BY synced_at DESC LIMIT 1",
            (mobile,),
        ).fetchone()
        return dict(row) if row else None


def get_guest_by_room(tenant_id: str, room: str) -> dict[str, Any] | None:
    with get_tenant_conn(tenant_id) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS guest_inventory (
                id TEXT PRIMARY KEY, tid TEXT, rid TEXT, room TEXT, gname TEXT,
                mobile TEXT, gstatus TEXT, gcount TEXT, btype TEXT,
                sub_booking_id TEXT, driver_tag TEXT, cindate TEXT, coutdate TEXT, synced_at INTEGER
            )
        """)
        row = conn.execute(
            "SELECT * FROM guest_inventory WHERE room = ? AND gstatus IN ('Arrived', 'StayOver') ORDER BY synced_at DESC LIMIT 1",
            (room,),
        ).fetchone()
        return dict(row) if row else None


def get_guest_journey_status(tenant_id: str, guest_id: str) -> dict[str, Any]:
    with get_tenant_conn(tenant_id) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS guest_inventory (
                id TEXT PRIMARY KEY, tid TEXT, rid TEXT, room TEXT, gname TEXT,
                mobile TEXT, gstatus TEXT, gcount TEXT, btype TEXT,
                sub_booking_id TEXT, driver_tag TEXT, cindate TEXT, coutdate TEXT, synced_at INTEGER
            )
        """)
        guest_row = conn.execute(
            "SELECT * FROM guest_inventory WHERE id = ? OR tid = ? LIMIT 1",
            (guest_id, guest_id),
        ).fetchone()

        if not guest_row:
            return {"error": "Guest not found"}

        guest = dict(guest_row)
        checkin = guest.get("cindate", "")
        checkout = guest.get("coutdate", "")
        status = guest.get("gstatus", "")

        journey = {
            "guest_name": guest.get("gname", ""),
            "room": guest.get("room", ""),
            "check_in": checkin,
            "check_out": checkout,
            "status": status,
            "guests_count": guest.get("gcount", "1"),
            "booking_type": guest.get("btype", ""),
            "milestones": [],
        }

        if status == "Arrived" or status == "StayOver":
            journey["milestones"].append({
                "name": "Checked In",
                "completed": True,
                "time": checkin,
            })
            journey["milestones"].append({
                "name": "Welcome Message",
                "completed": True,
            })
        else:
            journey["milestones"].append({
                "name": "Check In",
                "completed": False,
                "scheduled": checkin,
            })

        journey["milestones"].append({
            "name": "Check Out",
            "completed": False,
            "scheduled": checkout,
        })

        return journey


def fetch_todays_bookings(tenant_id: str) -> list[dict[str, Any]]:
    """Fetch today's bookings from the guest inventory."""
    guests = get_active_guests(tenant_id)
    from datetime import date
    today = date.today().isoformat()
    return [g for g in guests if g.get("cindate", "").startswith(today) or g.get("coutdate", "").startswith(today)]
