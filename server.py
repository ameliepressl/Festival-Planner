"""Serve the Festival Architect planner and its local username directory."""

import argparse
from contextlib import closing
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sqlite3
from urllib.parse import parse_qs


PROJECT_ROOT = Path(__file__).resolve().parent
DATABASE_PATH = PROJECT_ROOT / "data" / "users.sqlite3"
DEMO_USERNAMES = ("Kira", "Amelie", "Frederik", "Vicky")
STATIC_FILES = {
    "/": "text/html; charset=utf-8",
    "/index.html": "text/html; charset=utf-8",
    "/styles.css": "text/css; charset=utf-8",
    "/app.js": "text/javascript; charset=utf-8",
    "/gantt-defaults.js": "text/javascript; charset=utf-8",
    "/gantt-editor.js": "text/javascript; charset=utf-8",
    "/gantt-placeholder.js": "text/javascript; charset=utf-8",
    "/gantt-schedule.js": "text/javascript; charset=utf-8",
    "/festival-countdown.js": "text/javascript; charset=utf-8",
    "/finance/finance-page.js": "text/javascript; charset=utf-8",
    "/finance/finance.css": "text/css; charset=utf-8",
    "/rules/capacity-rules.js": "text/javascript; charset=utf-8",
    "/rules/countdown-rules.js": "text/javascript; charset=utf-8",
    "/rules/finance-rules.js": "text/javascript; charset=utf-8",
    "/rules/site-map-rules.js": "text/javascript; charset=utf-8",
    "/rules/vendor-rules.js": "text/javascript; charset=utf-8",
    "/site-map/map-drawing.js": "text/javascript; charset=utf-8",
    "/site-map/site-map-page.js": "text/javascript; charset=utf-8",
    "/site-map/site-map.css": "text/css; charset=utf-8",
    "/vendors/vendors-page.js": "text/javascript; charset=utf-8",
    "/vendors/vendors.css": "text/css; charset=utf-8",
    "/work-board.js": "text/javascript; charset=utf-8",
    "/overview.js": "text/javascript; charset=utf-8",
    "/rules/access-rules.js": "text/javascript; charset=utf-8",
    "/rules/festival-rules.js": "text/javascript; charset=utf-8",
    "/rules/checklist-rules.js": "text/javascript; charset=utf-8",
    "/checkliste-festivalplanung/checklist.css": "text/css; charset=utf-8",
    "/checkliste-festivalplanung/checklist-page.js": "text/javascript; charset=utf-8",
}


def initialize_database(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(path)) as database, database:
        database.execute("BEGIN IMMEDIATE")
        version, = database.execute("PRAGMA user_version").fetchone()
        if version == 0:
            database.execute("""
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    username_key TEXT NOT NULL UNIQUE
                )
            """)
            database.executemany(
                "INSERT INTO users (username, username_key) VALUES (?, ?)",
                [(name, name.casefold()) for name in DEMO_USERNAMES],
            )
            database.execute("PRAGMA user_version = 1")


def lookup_user(path, query):
    try:
        params = parse_qs(query, keep_blank_values=True, errors="strict", max_num_fields=1)
        username = params.get("username", [""])[0].strip()
    except ValueError:
        username = ""
    if not 1 <= len(username) <= 64:
        return HTTPStatus.BAD_REQUEST, {"error": "Enter a username of 1–64 characters."}

    try:
        with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)) as database:
            user = database.execute(
                "SELECT id, username FROM users WHERE username_key = ?",
                (username.casefold(),),
            ).fetchone()
    except sqlite3.Error:
        return HTTPStatus.SERVICE_UNAVAILABLE, {"error": "The user directory is unavailable."}
    if user is None:
        return HTTPStatus.NOT_FOUND, {"error": "No account uses that username."}
    user_id, canonical_username = user
    return HTTPStatus.OK, {"id": user_id, "username": canonical_username}


class PlannerHandler(BaseHTTPRequestHandler):
    database_path = DATABASE_PATH

    def do_GET(self):
        # Serve this local directory only through the loopback address.
        host = self.headers.get("Host", "").split(":", 1)[0].lower()
        if host not in {"127.0.0.1", "localhost"}:
            self.send_error(HTTPStatus.FORBIDDEN)
            return

        path, _, query = self.path.partition("?")
        if path == "/api/users":
            status, result = lookup_user(self.database_path, query)
            body = json.dumps(result).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        content_type = STATIC_FILES.get(path)
        if content_type is None:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            file_path = PROJECT_ROOT / ("index.html" if path == "/" else path.lstrip("/"))
            body = file_path.read_bytes()
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    try:
        with ThreadingHTTPServer(("127.0.0.1", args.port), PlannerHandler) as server:
            initialize_database(DATABASE_PATH)
            print(f"Open http://127.0.0.1:{server.server_port}/ in your browser.", flush=True)
            server.serve_forever()
    except KeyboardInterrupt:
        pass
    except (OSError, OverflowError, sqlite3.Error) as error:
        parser.exit(1, f"Could not start the planner: {error}\n")


if __name__ == "__main__":
    main()
