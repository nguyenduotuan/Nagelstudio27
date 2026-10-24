#!/usr/bin/env python3
"""Serves the site, stores booking requests and protects /admin. Standard library only."""

import argparse
import base64
import gzip
import hmac
import ipaddress
import json
import os
import re
import threading
import uuid
from collections import defaultdict, deque
from datetime import date, datetime, time, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from time import monotonic
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
BOOKINGS_FILE = ROOT / "data-private" / "bookings.jsonl"
BACKUP_DIR = ROOT / "data-private" / "backups"

ADMIN_USER = os.environ.get("NAILSHOP_ADMIN_USER")
ADMIN_PASSWORD = os.environ.get("NAILSHOP_ADMIN_PASSWORD")
ADMIN_PAGE = "/src/pages/admin.html"

# Everything else (server.py, data-private/, .git, docs/) is never served.
PUBLIC_PREFIXES = ("/src/", "/public/")
MAX_BODY_BYTES = 10_000
FIELD_LIMITS = {"name": 100, "phone": 50, "phoneConfirmation": 50, "request": 2000, "appointmentDate": 10}
LANGUAGES = ("de", "en", "vi")
BOOKING_STATUSES = ("pending", "accepted")
DELETE_CONFIRMATION = "loeschen"
MAX_SUBMISSIONS_PER_IP = 10
SUBMISSION_WINDOW_SECONDS = 3600
BACKUP_RETENTION_DAYS = 30
TRUSTED_PROXY_IPS = set()

write_lock = threading.Lock()
rate_limit_lock = threading.Lock()
submission_times = defaultdict(deque)


def normalize_phone(phone):
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = "49" + digits[1:]
    return digits


def is_rate_limited(client_ip):
    now = monotonic()
    with rate_limit_lock:
        requests = submission_times[client_ip]
        while requests and now - requests[0] >= SUBMISSION_WINDOW_SECONDS:
            requests.popleft()
        if len(requests) >= MAX_SUBMISSIONS_PER_IP:
            return True
        requests.append(now)
        if len(submission_times) > 10000:
            for address in list(submission_times):
                if not submission_times[address] or now - submission_times[address][-1] >= SUBMISSION_WINDOW_SECONDS:
                    del submission_times[address]
        return False


def read_bookings():
    if not BOOKINGS_FILE.exists():
        return []
    with BOOKINGS_FILE.open(encoding="utf-8") as file:
        return [json.loads(line) for line in file if line.strip()]


def write_bookings(bookings):
    BOOKINGS_FILE.parent.mkdir(exist_ok=True)
    backup_bookings()
    temp_file = BOOKINGS_FILE.with_name("bookings.jsonl.tmp")
    with temp_file.open("w", encoding="utf-8") as file:
        for booking in bookings:
            file.write(json.dumps(booking, ensure_ascii=False) + "\n")
    temp_file.replace(BOOKINGS_FILE)


def backup_bookings():
    if not BOOKINGS_FILE.exists():
        return
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc).date()
    backup_file = BACKUP_DIR / f"bookings-{today.isoformat()}.jsonl.gz"
    if not backup_file.exists():
        temp_file = backup_file.with_suffix(backup_file.suffix + ".tmp")
        temp_file.write_bytes(gzip.compress(BOOKINGS_FILE.read_bytes(), mtime=0))
        temp_file.replace(backup_file)
    cutoff = today - timedelta(days=BACKUP_RETENTION_DAYS)
    for existing in BACKUP_DIR.glob("bookings-*.jsonl.gz"):
        try:
            backup_date = date.fromisoformat(existing.name.removeprefix("bookings-").removesuffix(".jsonl.gz"))
        except ValueError:
            continue
        if backup_date < cutoff:
            existing.unlink(missing_ok=True)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def is_admin(self):
        scheme, _, token = self.headers.get("Authorization", "").partition(" ")
        if scheme.lower() != "basic":
            return False
        try:
            user, _, password = base64.b64decode(token).partition(b":")
        except ValueError:
            return False
        # Evaluate both so timing does not reveal which one was wrong.
        user_ok = hmac.compare_digest(user, ADMIN_USER.encode())
        password_ok = hmac.compare_digest(password, ADMIN_PASSWORD.encode())
        return user_ok and password_ok

    def get_client_ip(self):
        remote_ip = self.client_address[0]
        if remote_ip not in TRUSTED_PROXY_IPS:
            return remote_ip
        forwarded_ip = self.headers.get("X-Forwarded-For", "").split(",", 1)[0].strip()
        try:
            return str(ipaddress.ip_address(forwarded_ip))
        except ValueError:
            return remote_ip

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        if self.headers.get_content_type() != "application/json":
            self.send_json(415, {"error": "json_required"})
            return None
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_BODY_BYTES:
            self.send_json(400, {"error": "invalid_size"})
            return None
        try:
            data = json.loads(self.rfile.read(length))
        except ValueError:
            self.send_json(400, {"error": "invalid_json"})
            return None
        if not isinstance(data, dict):
            self.send_json(400, {"error": "invalid_json"})
            return None
        return data

    def booking_id_from_path(self):
        prefix = "/api/bookings/"
        path = urlsplit(self.path).path
        booking_id = path[len(prefix):] if path.startswith(prefix) else ""
        if len(booking_id) != 32 or any(character not in "0123456789abcdef" for character in booking_id):
            self.send_error(404)
            return None
        return booking_id

    def route_static(self):
        """Returns True when the request may continue to the file handler."""
        path = urlsplit(self.path).path
        if path in ("/admin", "/admin/", ADMIN_PAGE):
            if not self.is_admin():
                self.send_response(401)
                self.send_header("WWW-Authenticate", 'Basic realm="Admin", charset="UTF-8"')
                self.send_header("Content-Length", "0")
                self.end_headers()
                return False
            self.path = ADMIN_PAGE
            return True
        if path == "/":
            self.path = "/index.html"
            return True
        if path == "/index.html" or path.startswith(PUBLIC_PREFIXES):
            return True
        self.send_error(404)
        return False

    def do_GET(self):
        if urlsplit(self.path).path == "/api/bookings":
            if not self.is_admin():
                self.send_json(401, {"error": "unauthorized"})
                return
            with write_lock:
                bookings = read_bookings()
            self.send_json(200, bookings)
            return
        if self.route_static():
            super().do_GET()

    def do_HEAD(self):
        if self.route_static():
            super().do_HEAD()

    def do_POST(self):
        if urlsplit(self.path).path != "/api/booking":
            self.send_error(404)
            return
        if is_rate_limited(self.get_client_ip()):
            self.send_json(429, {"error": "rate_limited"})
            return
        data = self.read_json_body()
        if data is None:
            return
        if isinstance(data.get("website"), str) and data["website"].strip():
            self.send_json(400, {"error": "spam_detected"})
            return

        entry = {}
        for field, limit in FIELD_LIMITS.items():
            value = data.get(field)
            value = value.strip() if isinstance(value, str) else ""
            if not value or len(value) > limit:
                self.send_json(400, {"error": "invalid_" + field})
                return
            entry[field] = value

        phone_digits = normalize_phone(entry["phone"])
        if not 7 <= len(phone_digits) <= 15:
            self.send_json(400, {"error": "invalid_phone_number"})
            return
        if phone_digits != normalize_phone(entry["phoneConfirmation"]):
            self.send_json(400, {"error": "phone_mismatch"})
            return
        del entry["phoneConfirmation"]

        appointment_time = data.get("appointmentTime", "")
        if not isinstance(appointment_time, str) or len(appointment_time) > 5:
            self.send_json(400, {"error": "invalid_appointment_time"})
            return
        entry["appointmentTime"] = appointment_time.strip()

        try:
            date.fromisoformat(entry["appointmentDate"])
            if entry["appointmentTime"]:
                time.fromisoformat(entry["appointmentTime"])
        except ValueError:
            self.send_json(400, {"error": "invalid_appointment_datetime"})
            return

        language = data.get("lang")
        record = {
            "id": uuid.uuid4().hex,
            "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            **entry,
            "lang": language if language in LANGUAGES else "de",
            "status": "pending",
        }
        with write_lock:
            existing_bookings = read_bookings()
            today = date.today().isoformat()
            duplicate = any(
                normalize_phone(booking.get("phone", "")) == phone_digits
                and booking.get("appointmentDate", "") >= today
                for booking in existing_bookings
            )
            if duplicate:
                self.send_json(409, {"error": "duplicate_phone"})
                return
            BOOKINGS_FILE.parent.mkdir(exist_ok=True)
            backup_bookings()
            with BOOKINGS_FILE.open("a", encoding="utf-8") as file:
                file.write(json.dumps(record, ensure_ascii=False) + "\n")
        self.send_json(201, {"ok": True})

    def do_PATCH(self):
        if not self.is_admin():
            self.send_json(401, {"error": "unauthorized"})
            return
        booking_id = self.booking_id_from_path()
        if booking_id is None:
            return
        data = self.read_json_body()
        if data is None:
            return
        status = data.get("status")
        if status not in BOOKING_STATUSES:
            self.send_json(400, {"error": "invalid_status"})
            return

        with write_lock:
            bookings = read_bookings()
            booking = next((item for item in bookings if item.get("id") == booking_id), None)
            if booking is None:
                self.send_json(404, {"error": "booking_not_found"})
                return
            booking["status"] = status
            write_bookings(bookings)
        self.send_json(200, {"ok": True})

    def do_DELETE(self):
        if not self.is_admin():
            self.send_json(401, {"error": "unauthorized"})
            return
        booking_id = self.booking_id_from_path()
        if booking_id is None:
            return
        data = self.read_json_body()
        if data is None:
            return
        if data.get("confirmation") != DELETE_CONFIRMATION:
            self.send_json(400, {"error": "confirmation_required"})
            return

        with write_lock:
            bookings = read_bookings()
            remaining = [item for item in bookings if item.get("id") != booking_id]
            if len(remaining) == len(bookings):
                self.send_json(404, {"error": "booking_not_found"})
                return
            write_bookings(remaining)
        self.send_json(200, {"ok": True})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--bind", default="127.0.0.1", help="use 0.0.0.0 to allow other devices")
    parser.add_argument("--trusted-proxy", action="append", default=[], help="trusted proxy IP; repeat if needed")
    args = parser.parse_args()
    if not ADMIN_USER or not ADMIN_PASSWORD:
        parser.error("Set NAILSHOP_ADMIN_USER and NAILSHOP_ADMIN_PASSWORD environment variables.")
    try:
        TRUSTED_PROXY_IPS.update(str(ipaddress.ip_address(address)) for address in args.trusted_proxy)
    except ValueError as error:
        parser.error(str(error))
    print(f"Serving {ROOT} at http://{args.bind}:{args.port}")
    ThreadingHTTPServer((args.bind, args.port), Handler).serve_forever()
