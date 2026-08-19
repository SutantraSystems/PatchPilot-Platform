"""Patch Pilot backend API tests (multi-tenant JWT)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pilot-patch-control.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@patchpilot.io"
ADMIN_PASSWORD = "admin123"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def second_tenant():
    """Register a fresh tenant."""
    unique = uuid.uuid4().hex[:8]
    payload = {
        "tenant_name": f"TEST Tenant {unique}",
        "email": f"TEST_{unique}@example.com",
        "password": "testpass123",
        "admin_name": "Test Admin",
    }
    r = requests.post(f"{API}/auth/register-tenant", json=payload)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    return {"token": data["access_token"], "payload": payload, "data": data}


@pytest.fixture(scope="session")
def second_headers(second_tenant):
    return {"Authorization": f"Bearer {second_tenant['token']}"}


# ---------- auth ----------
class TestAuth:
    def test_login_admin(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401
        assert "Invalid email or password" in r.text

    def test_auth_me(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert "user" in body and "tenant" in body
        assert body["user"]["email"] == ADMIN_EMAIL
        assert body["tenant"]["name"]  # non empty

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)

    def test_register_tenant_success(self, second_tenant):
        assert second_tenant["data"]["access_token"]
        assert second_tenant["data"]["tenant"]["name"] == second_tenant["payload"]["tenant_name"]

    def test_register_duplicate_email(self):
        payload = {
            "tenant_name": "Dup Tenant",
            "email": ADMIN_EMAIL,
            "password": "somepass123",
            "admin_name": "Dup",
        }
        r = requests.post(f"{API}/auth/register-tenant", json=payload)
        assert r.status_code == 409


# ---------- tenant-scoped GET endpoints ----------
TENANT_GET_ENDPOINTS = [
    "/systems", "/patches", "/jobs", "/vulnerabilities",
    "/system-groups", "/maintenance-windows", "/repositories",
    "/scripts", "/alerts", "/audit-logs",
]


class TestTenantScopedGETs:
    @pytest.mark.parametrize("path", TENANT_GET_ENDPOINTS)
    def test_requires_auth(self, path):
        r = requests.get(f"{API}{path}")
        assert r.status_code in (401, 403), f"{path} got {r.status_code}"

    @pytest.mark.parametrize("path", TENANT_GET_ENDPOINTS)
    def test_authed_returns_list(self, path, admin_headers):
        r = requests.get(f"{API}{path}", headers=admin_headers)
        assert r.status_code == 200, f"{path}: {r.text}"
        data = r.json()
        assert isinstance(data, list), f"{path} should return list"

    def test_dashboard_stats(self, admin_headers):
        r = requests.get(f"{API}/dashboard/stats", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_systems", "active_jobs", "pending_patches", "compliance_score"):
            assert k in d, f"missing {k}"


# ---------- multi-tenancy isolation ----------
class TestTenantIsolation:
    def test_second_tenant_has_seeded_systems(self, second_headers):
        r = requests.get(f"{API}/systems", headers=second_headers)
        assert r.status_code == 200
        assert len(r.json()) > 0, "New tenant should be seeded with starter systems"

    def test_systems_isolated_between_tenants(self, admin_headers, second_headers):
        """POST a system to admin tenant, verify it does NOT appear in second tenant's list."""
        marker = f"TEST-isolate-{uuid.uuid4().hex[:6]}"
        payload = {"name": marker, "os": "Ubuntu 22.04", "ip": "10.9.9.9", "status": "Healthy", "group": "TEST"}
        r = requests.post(f"{API}/systems", json=payload, headers=admin_headers)
        assert r.status_code in (200, 201), r.text
        a_names = {s.get("name") for s in requests.get(f"{API}/systems", headers=admin_headers).json()}
        b_names = {s.get("name") for s in requests.get(f"{API}/systems", headers=second_headers).json()}
        assert marker in a_names
        assert marker not in b_names, "System created in tenant A leaked to tenant B"


# ---------- write endpoints ----------
class TestWrites:
    def test_create_system_increments_count(self, admin_headers):
        before = len(requests.get(f"{API}/systems", headers=admin_headers).json())
        payload = {
            "name": f"TEST-host-{uuid.uuid4().hex[:6]}",
            "os": "Ubuntu 22.04",
            "ip": "10.0.0.99",
            "status": "Healthy",
            "group": "TEST",
        }
        r = requests.post(f"{API}/systems", json=payload, headers=admin_headers)
        assert r.status_code in (200, 201), r.text
        after = len(requests.get(f"{API}/systems", headers=admin_headers).json())
        assert after == before + 1

    def test_create_job(self, admin_headers):
        payload = {
            "name": f"TEST job {uuid.uuid4().hex[:6]}",
            "targetGroup": "All Windows Servers",
            "type": "Automated",
            "scheduledTime": "Tonight, 01:00 AM",
        }
        r = requests.post(f"{API}/jobs", json=payload, headers=admin_headers)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body.get("name") == payload["name"]

    def test_approve_patch(self, admin_headers):
        patches = requests.get(f"{API}/patches", headers=admin_headers).json()
        pending = [p for p in patches if str(p.get("status", "")).lower() == "pending"]
        if not pending:
            pytest.skip("No pending patch to approve")
        pid = pending[0]["id"]
        r = requests.post(f"{API}/patches/{pid}/approve", headers=admin_headers)
        assert r.status_code == 200, r.text
        # verify
        after = requests.get(f"{API}/patches", headers=admin_headers).json()
        target = next((p for p in after if p["id"] == pid), None)
        assert target and str(target["status"]).lower() == "approved"
