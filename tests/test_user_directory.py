from contextlib import closing
from http import HTTPStatus
from io import BytesIO
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from server import PlannerHandler, initialize_database, lookup_user


class UserDirectoryTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.database_path = Path(directory.name) / "data" / "users.sqlite3"
        initialize_database(self.database_path)

    def test_matches_registered_user_and_returns_canonical_username(self):
        status, user = lookup_user(self.database_path, "username=%20kIRa%20")
        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(user["username"], "Kira")
        initialize_database(self.database_path)
        self.assertEqual(lookup_user(self.database_path, "username=Kira"), (status, user))

    def test_checks_database_for_users_added_after_setup(self):
        with closing(sqlite3.connect(self.database_path)) as database, database:
            database.execute(
                "INSERT INTO users (username, username_key) VALUES (?, ?)",
                ("Dani", "dani"),
            )
        self.assertEqual(lookup_user(self.database_path, "username=dani")[1]["username"], "Dani")

    def test_unknown_and_invalid_usernames(self):
        self.assertEqual(lookup_user(self.database_path, "username=Typo")[0], HTTPStatus.NOT_FOUND)
        for query in ("", "username=%20", "username=Kira&username=Vicky"):
            with self.subTest(query=query):
                self.assertEqual(lookup_user(self.database_path, query)[0], HTTPStatus.BAD_REQUEST)

    def test_unavailable_database_returns_error_without_creating_a_new_file(self):
        self.database_path.unlink()
        status, _ = lookup_user(self.database_path, "username=Kira")
        self.assertEqual(status, HTTPStatus.SERVICE_UNAVAILABLE)
        self.assertFalse(self.database_path.exists())



class RequestStream:
    """Let the request handler read and write HTTP messages without a listening socket."""

    def __init__(self, request):
        self.input = BytesIO(request)
        self.output = BytesIO()

    def makefile(self, _mode, _buffer_size):
        return self.input

    def sendall(self, data):
        self.output.write(data)


class PlannerRoutingTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.database_path = Path(directory.name) / "users.sqlite3"
        initialize_database(self.database_path)

    def request(self, path, host="127.0.0.1:8000"):
        class QuietHandler(PlannerHandler):
            def log_message(self, _format, *args):
                pass

        QuietHandler.database_path = self.database_path
        stream = RequestStream(f"GET {path} HTTP/1.1\r\nHost: {host}\r\n\r\n".encode())
        QuietHandler(stream, ("127.0.0.1", 50000), None)
        headers, _, body = stream.output.getvalue().partition(b"\r\n\r\n")
        status = int(headers.split()[1])
        return status, body

    def test_planner_and_username_lookup_share_the_same_origin(self):
        status, body = self.request("/")
        self.assertEqual(status, HTTPStatus.OK)
        self.assertIn(b"Festival Architect", body)
        status, body = self.request("/api/users?username=vicky")
        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(json.loads(body)["username"], "Vicky")

    def test_serves_only_planner_assets_on_loopback(self):
        self.assertEqual(self.request("/data/users.sqlite3")[0], HTTPStatus.NOT_FOUND)
        self.assertEqual(self.request("/api/users?username=Vicky", "example.test")[0], HTTPStatus.FORBIDDEN)
