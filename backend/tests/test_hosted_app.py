"""Production UI routing and shared persistence, using an isolated SQLite DB."""
import os
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

_db_dir = tempfile.TemporaryDirectory()
os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(_db_dir.name) / 'test.db')
from app.main import app
from app.db import database_url, engine


class HostedAppTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def test_built_ui_and_api_share_an_origin(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('text/html', response.headers['content-type'])
        self.assertIn('/assets/', response.text)
        self.assertEqual(self.client.get('/api/health').json(), {'status': 'ok'})
        self.assertEqual(self.client.get('/api/not-a-route').status_code, 404)
        self.assertEqual(self.client.get('/assets/not-a-file.js').status_code, 404)

    def test_two_clients_see_the_same_saved_prospect(self):
        prospect = self.client.get('/api/prospects').json()[0]
        response = self.client.patch(f"/api/prospects/{prospect['id']}", json={'notes': 'Shared save test'})
        self.assertEqual(response.status_code, 200)
        # A new browser client reads from the database, not the first client's memory.
        with TestClient(app) as other:
            saved = other.get(f"/api/prospects/{prospect['id']}").json()
            self.assertEqual(saved['notes'], 'Shared save test')
            self.assertEqual(len(other.get('/api/prospects').json()), 25)

    def test_global_settings_are_shared(self):
        self.assertEqual(self.client.put('/api/settings', json={'weight_fit': 42}).status_code, 200)
        with TestClient(app) as other:
            self.assertEqual(other.get('/api/settings').json()['weight_fit'], 42)


if __name__ == '__main__':
    try:
        unittest.main()
    finally:
        engine.dispose()
        _db_dir.cleanup()
