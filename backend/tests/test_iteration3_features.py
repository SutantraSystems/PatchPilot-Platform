"""Iteration 3 tests: branding, tenant users, invitations, WebSocket live jobs."""
import os
import uuid
import asyncio
import json
import time
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pilot-patch-control.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws/jobs"

ADMIN_EMAIL = "admin@patchpilot.io"
ADMIN_PASSWORD = "admin123"


# ---------- shared fixtures ----------
@pytest.fixture(scope="module")
def admin_login():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def admin_token(admin_login):
    return admin_login["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def fresh_tenant():
    unique = uuid.uuid4().hex[:8]
    payload = {
        "tenant_name": f"TEST Iter3 {unique}",
        "email": f"TEST_iter3_{unique}@example.com",
        "password": "testpass123",
        "admin_name": "Iter3 Admin",
    }
    r = requests.post(f"{API}/auth/register-tenant", json=payload)
    assert r.status_code in (200, 201), r.text
    return r.json()


@pytest.fixture(scope="module")
def fresh_headers(fresh_tenant):
    return {"Authorization": f"Bearer {fresh_tenant['access_token']}"}


# ---------- Tenant branding ----------
class TestTenantBranding:
    def test_get_tenant(self, admin_headers):
        r = requests.get(f"{API}/tenant", headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "Patch Pilot HQ"
        assert d["slug"] == "patch-pilot-hq"

    def test_patch_branding_admin_success(self, admin_headers):
        payload = {
            "logo_data_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
            "brand_color": "#0ea5e9",
        }
        r = requests.patch(f"{API}/tenant/branding", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["brand_color"] == "#0ea5e9"
        assert d["logo_data_url"] is not None
        # persistence verify
        g = requests.get(f"{API}/tenant", headers=admin_headers).json()
        assert g["brand_color"] == "#0ea5e9"

    def test_patch_branding_invalid_color(self, admin_headers):
        r = requests.patch(f"{API}/tenant/branding", json={"brand_color": "notacolor"}, headers=admin_headers)
        assert r.status_code in (400, 422)

    def test_patch_branding_non_admin_forbidden(self, admin_headers, fresh_headers):
        # invite a non-admin to admin tenant
        unique = uuid.uuid4().hex[:6]
        invite = requests.post(f"{API}/tenant/invite", json={
            "email": f"TEST_op_{unique}@example.com",
            "name": "Op User",
            "role": "IT Operator",
        }, headers=admin_headers)
        assert invite.status_code == 200, invite.text
        temp = invite.json()["temp_password"]
        email = invite.json()["user"]["email"]
        # login as invited op
        login = requests.post(f"{API}/auth/login", json={"email": email, "password": temp})
        assert login.status_code == 200, login.text
        op_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        r = requests.patch(f"{API}/tenant/branding", json={"brand_color": "#ff0000"}, headers=op_headers)
        assert r.status_code == 403


# ---------- Tenant users ----------
class TestTenantUsers:
    def test_list_users_no_password_hash(self, admin_headers):
        r = requests.get(f"{API}/tenant/users", headers=admin_headers)
        assert r.status_code == 200, r.text
        users = r.json()
        assert isinstance(users, list)
        assert len(users) >= 1
        for u in users:
            assert "password_hash" not in u
            assert "email" in u and "role" in u

    def test_invite_user_success(self, admin_headers):
        unique = uuid.uuid4().hex[:6]
        email = f"TEST_inv_{unique}@example.com"
        r = requests.post(f"{API}/tenant/invite", json={
            "email": email, "name": "Invitee", "role": "Security Analyst"
        }, headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["email"].lower() == email.lower()
        assert d["user"]["role"] == "Security Analyst"
        assert isinstance(d["temp_password"], str) and len(d["temp_password"]) >= 8
        # can login with temp password
        login = requests.post(f"{API}/auth/login", json={"email": email, "password": d["temp_password"]})
        assert login.status_code == 200
        # appears in tenant users
        users = requests.get(f"{API}/tenant/users", headers=admin_headers).json()
        assert any(u["email"].lower() == email.lower() for u in users)

    def test_invite_duplicate_email(self, admin_headers):
        r = requests.post(f"{API}/tenant/invite", json={
            "email": ADMIN_EMAIL, "name": "Dup", "role": "IT Operator"
        }, headers=admin_headers)
        assert r.status_code == 409

    def test_invite_non_admin_forbidden(self, admin_headers, fresh_headers):
        # fresh tenant admin invites a normal user, then that user tries to invite
        unique = uuid.uuid4().hex[:6]
        inv = requests.post(f"{API}/tenant/invite", json={
            "email": f"TEST_nonadmin_{unique}@example.com",
            "name": "Non Admin", "role": "IT Operator",
        }, headers=fresh_headers)
        assert inv.status_code == 200
        temp = inv.json()["temp_password"]
        email = inv.json()["user"]["email"]
        login = requests.post(f"{API}/auth/login", json={"email": email, "password": temp})
        na_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        r = requests.post(f"{API}/tenant/invite", json={
            "email": f"TEST_x_{unique}@example.com", "name": "Xx User", "role": "IT Operator"
        }, headers=na_headers)
        assert r.status_code == 403, f"got {r.status_code}: {r.text}"

    def test_delete_user_admin_success(self, admin_headers):
        unique = uuid.uuid4().hex[:6]
        inv = requests.post(f"{API}/tenant/invite", json={
            "email": f"TEST_del_{unique}@example.com", "name": "Todelete", "role": "IT Operator"
        }, headers=admin_headers)
        uid_ = inv.json()["user"]["id"]
        r = requests.delete(f"{API}/tenant/users/{uid_}", headers=admin_headers)
        assert r.status_code == 200
        # verify gone
        users = requests.get(f"{API}/tenant/users", headers=admin_headers).json()
        assert not any(u["id"] == uid_ for u in users)

    def test_delete_self_forbidden(self, admin_headers, admin_login):
        me_id = admin_login["user"]["id"]
        r = requests.delete(f"{API}/tenant/users/{me_id}", headers=admin_headers)
        assert r.status_code == 400

    def test_delete_cross_tenant_404(self, admin_headers, fresh_tenant):
        other_id = fresh_tenant["user"]["id"]
        r = requests.delete(f"{API}/tenant/users/{other_id}", headers=admin_headers)
        assert r.status_code == 404


# ---------- WebSocket ----------
class TestWebSocket:
    def test_ws_invalid_token_closes(self):
        async def run():
            try:
                async with websockets.connect(f"{WS_URL}?token=invalid") as ws:
                    await asyncio.wait_for(ws.recv(), timeout=5)
                    return "opened"
            except websockets.exceptions.ConnectionClosed as e:
                return ("closed", e.code)
            except websockets.exceptions.InvalidStatus as e:
                return ("rejected", e.response.status_code)
        result = asyncio.run(run())
        # server should reject/close either via WS close 4401 OR HTTP 401/403 handshake rejection
        assert result[0] in ("closed", "rejected"), f"unexpected: {result}"
        assert result[1] in (4401, 401, 403), f"unexpected code: {result}"

    def test_ws_missing_token_closes(self):
        async def run():
            try:
                async with websockets.connect(WS_URL) as ws:
                    await asyncio.wait_for(ws.recv(), timeout=5)
                    return "opened"
            except websockets.exceptions.ConnectionClosed as e:
                return ("closed", e.code)
            except websockets.exceptions.InvalidStatus as e:
                return ("rejected", e.response.status_code)
        result = asyncio.run(run())
        assert result[0] in ("closed", "rejected"), f"unexpected: {result}"
        assert result[1] in (4401, 401, 403), f"unexpected code: {result}"

    def test_ws_snapshot_and_updates(self, admin_headers, admin_token):
        # create a running job to trigger ticks
        job_payload = {
            "name": f"TEST WS job {uuid.uuid4().hex[:5]}",
            "targetGroup": "All Windows Servers",
            "type": "Automated",
            "scheduledTime": "Now",
        }
        job = requests.post(f"{API}/jobs", json=job_payload, headers=admin_headers).json()
        # flip status to Running via direct... we don't have endpoint. Try to find an existing running job
        jobs = requests.get(f"{API}/jobs", headers=admin_headers).json()
        running = [j for j in jobs if j.get("status") == "Running"]

        async def run():
            url = f"{WS_URL}?token={admin_token}"
            async with websockets.connect(url) as ws:
                snap = await asyncio.wait_for(ws.recv(), timeout=10)
                snap_data = json.loads(snap)
                assert snap_data["type"] == "snapshot"
                assert isinstance(snap_data["jobs"], list)
                # if a running job exists, wait for job_update
                if running:
                    got_update = False
                    end = time.time() + 12
                    while time.time() < end:
                        try:
                            msg = await asyncio.wait_for(ws.recv(), timeout=5)
                            data = json.loads(msg)
                            if data.get("type") == "job_update":
                                got_update = True
                                assert "progress" in data
                                break
                        except asyncio.TimeoutError:
                            break
                    return {"snapshot_ok": True, "got_update": got_update, "had_running": True}
                return {"snapshot_ok": True, "got_update": False, "had_running": False}

        result = asyncio.run(run())
        assert result["snapshot_ok"]
        if result["had_running"]:
            assert result["got_update"], "Expected at least one job_update tick for running job"
