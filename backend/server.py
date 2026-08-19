"""
Patch Pilot — Multi-Tenant Enterprise Patch Management API
FastAPI + Motor (async MongoDB) + JWT Auth
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict
import asyncio
import secrets
import json

# --------------------------------------------------------------------------- #
#  Config
# --------------------------------------------------------------------------- #
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
JWT_TTL_MIN = 60 * 24  # 24 hours
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@patchpilot.io")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
ADMIN_TENANT_NAME = "Patch Pilot"
ADMIN_TENANT_SLUG = "patch-pilot-hq"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("patch-pilot")

# --------------------------------------------------------------------------- #
#  DB
# --------------------------------------------------------------------------- #
mongo_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = mongo_client[os.environ["DB_NAME"]]

# --------------------------------------------------------------------------- #
#  Password + JWT helpers
# --------------------------------------------------------------------------- #
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, tenant_id: str, email: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "tid": tenant_id,
        "email": email,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_TTL_MIN)).timestamp()),
        "type": "access",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def decode_token(token: str) -> Dict[str, Any]:
    return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])

# --------------------------------------------------------------------------- #
#  Models
# --------------------------------------------------------------------------- #
def uid() -> str: return str(uuid.uuid4())
def now_iso() -> str: return datetime.now(timezone.utc).isoformat()

def add_months(dt: datetime, months: int) -> datetime:
    """Add a whole number of calendar months to a datetime (stdlib only, no new deps)."""
    total_month_index = dt.month - 1 + months
    year = dt.year + total_month_index // 12
    month = total_month_index % 12 + 1
    # Clamp day to the last valid day of the target month (e.g. Jan 31 + 1mo -> Feb 28/29).
    day = dt.day
    while True:
        try:
            return dt.replace(year=year, month=month, day=day)
        except ValueError:
            day -= 1

def compute_policy_expiry(created_on_iso: Optional[str], lifecycle_months: Optional[int]) -> Optional[str]:
    """Derive expiry (ISO string) from Created On + Lifecycle. Single source of truth,
    reused by both policy creation and read paths so expiry/expired state is never
    computed only on the frontend."""
    if not created_on_iso or not lifecycle_months:
        return None
    try:
        created_dt = datetime.fromisoformat(created_on_iso)
    except ValueError:
        return None
    return add_months(created_dt, lifecycle_months).isoformat()

# def is_policy_expired(expiry_iso: Optional[str]) -> bool:
#     if not expiry_iso:
#         return False
#     try:
#         expiry_dt = datetime.fromisoformat(expiry_iso)
#     except ValueError:
#         return False
#     return expiry_dt < datetime.now(timezone.utc)

def is_policy_expired(expiry_iso: Optional[str]) -> bool:
    if not expiry_iso:
        return False
    try:
        expiry_dt = datetime.fromisoformat(expiry_iso)
    except ValueError:
        return False
    if expiry_dt.tzinfo is None:
        # Legacy/manually-entered expiry values may lack timezone info.
        # Treat naive datetimes as UTC instead of crashing the comparison below.
        expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
    return expiry_dt < datetime.now(timezone.utc)

class TenantOut(BaseModel):
    id: str
    slug: str
    name: str
    plan: str
    logo_data_url: Optional[str] = None
    brand_color: Optional[str] = None

class BrandingIn(BaseModel):
    logo_data_url: Optional[str] = Field(default=None, max_length=500_000)  # base64 data URL, ~350KB image
    brand_color: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")

class InviteUserIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=80)
    role: str = Field(default="IT Operator", max_length=40)

class UserOut(BaseModel):
    id: str
    tenant_id: str
    email: str
    name: str
    role: str
    avatar_url: Optional[str] = None
    mfa_enabled: bool = False

class RegisterTenantIn(BaseModel):
    tenant_name: str = Field(min_length=2, max_length=80)
    admin_name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    tenant: TenantOut

class SystemIn(BaseModel):
    name: str
    os: str
    group: str = "Unassigned"
    ip: str
    status: str = "Healthy"

class PatchApprovalIn(BaseModel):
    pass  # empty body for approval

class JobIn(BaseModel):
    name: str
    targetGroup: str
    type: str = "Automated"
    scheduledTime: str = "Tonight, 01:00 AM"
    # "Deploy Patch" = run immediately; "Schedule" = requires date + time.
    mode: str = "Deploy Patch"
    date: Optional[str] = None
    time: Optional[str] = None
    # Policy selection is optional — jobs must be creatable without one.
    policyId: Optional[str] = None
    policyName: Optional[str] = None

class PolicyIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    status: str = "Active"
    enabled: bool = True
    expiry: Optional[str] = None  # legacy manual expiry date, kept for backward-compat only
    lifecycleMonths: Optional[int] = Field(default=None, ge=1, le=120)  # Policy Lifecycle duration in months
    emailNotification: bool = False
    webhookNotification: bool = False

class SystemGroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    owner: str
    policy: str = ""
    systemIds: List[str] = []

def tenant_public(t: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": t.get("id"),
        "slug": t.get("slug"),
        "name": t.get("name"),
        "plan": t.get("plan"),
        "logo_data_url": t.get("logo_data_url"),
        "brand_color": t.get("brand_color"),
    }

def user_public(u: Dict[str, Any]) -> Dict[str, Any]:
    return {k: u.get(k) for k in
        ["id", "tenant_id", "email", "name", "role", "avatar_url", "mfa_enabled"]}

# --------------------------------------------------------------------------- #
#  Auth dependency
# --------------------------------------------------------------------------- #
async def get_current(request: Request) -> Dict[str, Any]:
    auth = request.headers.get("Authorization", "")
    token: Optional[str] = None
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = decode_token(token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(401, "Invalid token type")

    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    tenant = await db.tenants.find_one({"id": payload["tid"]}, {"_id": 0})
    if not tenant:
        raise HTTPException(401, "Tenant not found")
    return {"user": user, "tenant": tenant, "payload": payload}

# --------------------------------------------------------------------------- #
#  Seed helpers
# --------------------------------------------------------------------------- #
async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("tenant_id")
    await db.tenants.create_index("slug", unique=True)
    for coll in ("systems", "patches", "jobs", "vulnerabilities", "system_groups",
                 "maintenance_windows", "repositories", "scripts", "alerts", "audit_logs",
                 "policies", "notifications"):
        await db[coll].create_index("tenant_id")

async def seed_tenant_data(tenant_id: str):
    """Populate a new tenant with realistic starter data (Patch Pilot demo)."""
    from mock_seed import (
        systems, system_groups, patches, jobs, maintenance_windows,
        vulnerabilities, repositories, scripts, alerts, audit_logs,
        policies, notifications
    )
    def stamp(items):
        return [{**d, "id": d.get("id") or uid(), "tenant_id": tenant_id,
                 "created_at": now_iso()} for d in items]

    if await db.systems.count_documents({"tenant_id": tenant_id}) == 0:
        await db.systems.insert_many(stamp(systems))
    if await db.system_groups.count_documents({"tenant_id": tenant_id}) == 0:
        await db.system_groups.insert_many(stamp(system_groups))
    if await db.patches.count_documents({"tenant_id": tenant_id}) == 0:
        await db.patches.insert_many(stamp(patches))
    if await db.jobs.count_documents({"tenant_id": tenant_id}) == 0:
        await db.jobs.insert_many(stamp(jobs))
    if await db.maintenance_windows.count_documents({"tenant_id": tenant_id}) == 0:
        await db.maintenance_windows.insert_many(stamp(maintenance_windows))
    if await db.vulnerabilities.count_documents({"tenant_id": tenant_id}) == 0:
        await db.vulnerabilities.insert_many(stamp(vulnerabilities))
    if await db.repositories.count_documents({"tenant_id": tenant_id}) == 0:
        await db.repositories.insert_many(stamp(repositories))
    if await db.scripts.count_documents({"tenant_id": tenant_id}) == 0:
        await db.scripts.insert_many(stamp(scripts))
    if await db.alerts.count_documents({"tenant_id": tenant_id}) == 0:
        await db.alerts.insert_many(stamp(alerts))
    if await db.audit_logs.count_documents({"tenant_id": tenant_id}) == 0:
        await db.audit_logs.insert_many(stamp(audit_logs))
    if await db.policies.count_documents({"tenant_id": tenant_id}) == 0:
        await db.policies.insert_many(stamp(policies))
    if notifications and await db.notifications.count_documents({"tenant_id": tenant_id}) == 0:
        await db.notifications.insert_many(stamp(notifications))

async def seed_admin():
    tenant = await db.tenants.find_one({"slug": ADMIN_TENANT_SLUG})
    if not tenant:
        tenant_doc = {
            "id": uid(), "slug": ADMIN_TENANT_SLUG, "name": ADMIN_TENANT_NAME,
            "plan": "enterprise", "created_at": now_iso(),
        }
        await db.tenants.insert_one(tenant_doc)
        tenant = tenant_doc
        logger.info(f"Seeded root tenant: {tenant['name']}")

    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if not existing:
        user = {
            "id": uid(), "tenant_id": tenant["id"], "email": ADMIN_EMAIL.lower(),
            "name": "Alex Mercer", "role": "Global Admin",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "avatar_url": None, "mfa_enabled": True, "created_at": now_iso(),
        }
        await db.users.insert_one(user)
        logger.info(f"Seeded admin user: {ADMIN_EMAIL}")
    else:
        # keep in sync with env password
        if not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
            await db.users.update_one(
                {"id": existing["id"]},
                {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}},
            )
            logger.info("Updated admin password from env")

    await seed_tenant_data(tenant["id"])

    # Write test credentials for QA
    creds_path = Path("/app/memory/test_credentials.md")
    creds_path.parent.mkdir(parents=True, exist_ok=True)
    creds_path.write_text(
        f"""# Patch Pilot — Test Credentials

## Admin (Seeded)
- Email: `{ADMIN_EMAIL}`
- Password: `{ADMIN_PASSWORD}`
- Role: Global Admin
- Tenant: {ADMIN_TENANT_NAME} (slug: `{ADMIN_TENANT_SLUG}`)

## Endpoints
- POST /api/auth/register-tenant  (new tenant + admin)
- POST /api/auth/login             (email + password → JWT)
- GET  /api/auth/me                (Bearer)
- POST /api/auth/logout            (Bearer)
- GET  /api/systems                (Bearer, tenant-scoped)
- POST /api/systems                (Bearer, tenant-scoped)
- GET  /api/patches                (Bearer, tenant-scoped)
- POST /api/patches/{{id}}/approve (Bearer)
- GET  /api/jobs                   (Bearer, tenant-scoped)
- POST /api/jobs                   (Bearer, tenant-scoped)
- GET  /api/vulnerabilities        (Bearer)
- GET  /api/system-groups          (Bearer)
- GET  /api/maintenance-windows    (Bearer)
- GET  /api/repositories           (Bearer)
- GET  /api/scripts                (Bearer)
- GET  /api/alerts                 (Bearer)
- GET  /api/audit-logs             (Bearer)
- GET  /api/dashboard/stats        (Bearer)
""",
        encoding="utf-8",
    )

# --------------------------------------------------------------------------- #
#  App + Routers
# --------------------------------------------------------------------------- #
app = FastAPI(title="Patch Pilot API", version="1.0.0")
api = APIRouter(prefix="/api")

@api.get("/")
async def root():
    return {"service": "Patch Pilot", "status": "ok", "time": now_iso()}

# ----- Auth ------
@api.post("/auth/register-tenant", response_model=AuthOut)
async def register_tenant(body: RegisterTenantIn):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email already registered")

    slug_base = "".join(c for c in body.tenant_name.lower().replace(" ", "-")
                        if c.isalnum() or c == "-")[:40] or f"t-{uid()[:8]}"
    slug = slug_base
    i = 1
    while await db.tenants.find_one({"slug": slug}):
        i += 1
        slug = f"{slug_base}-{i}"

    tenant = {
        "id": uid(), "slug": slug, "name": body.tenant_name, "plan": "trial",
        "created_at": now_iso(),
    }
    await db.tenants.insert_one(tenant)

    user = {
        "id": uid(), "tenant_id": tenant["id"], "email": email,
        "name": body.admin_name, "role": "Global Admin",
        "password_hash": hash_password(body.password),
        "avatar_url": None, "mfa_enabled": False, "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    await seed_tenant_data(tenant["id"])

    token = create_access_token(user["id"], tenant["id"], email, user["role"])
    return AuthOut(
        access_token=token,
        user=UserOut(**user_public(user)),
        tenant=TenantOut(**tenant_public(tenant)),
    )

@api.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    tenant = await db.tenants.find_one({"id": user["tenant_id"]}, {"_id": 0})
    if not tenant:
        raise HTTPException(500, "Tenant missing")
    token = create_access_token(user["id"], tenant["id"], email, user["role"])

    # audit
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tenant["id"], "user": email,
        "action": "User signed in", "ip": "system", "timestamp": now_iso(),
    })
    return AuthOut(
        access_token=token,
        user=UserOut(**user_public(user)),
        tenant=TenantOut(**tenant_public(tenant)),
    )

@api.get("/auth/me")
async def me(ctx=Depends(get_current)):
    return {"user": user_public(ctx["user"]), "tenant": tenant_public(ctx["tenant"])}

@api.post("/auth/logout")
async def logout(ctx=Depends(get_current)):
    # stateless JWT — client just drops token
    return {"ok": True}

# ----- Generic tenant-scoped list helper -----
async def list_scoped(collection: str, tenant_id: str) -> List[Dict[str, Any]]:
    cursor = db[collection].find({"tenant_id": tenant_id}, {"_id": 0, "tenant_id": 0})
    return await cursor.to_list(1000)

# ----- Centralized notifications (Task 1, item 5) -----
async def notify(tenant_id: str, ntype: str, title: str, message: str,
                  related_id: Optional[str] = None) -> None:
    """Single, centralized notification model reused for every notification type
    (patch / job / policy / user activity) — follows the same tenant-scoped
    collection + insert pattern already used for audit_logs."""
    await db.notifications.insert_one({
        "id": uid(), "tenant_id": tenant_id, "type": ntype, "title": title,
        "message": message, "related_id": related_id, "read": False,
        "timestamp": now_iso(),
    })

# ----- Systems -----
@api.get("/systems")
async def systems_list(ctx=Depends(get_current)):
    return await list_scoped("systems", ctx["tenant"]["id"])

@api.post("/systems")
async def systems_create(body: SystemIn, ctx=Depends(get_current)):
    doc = {
        "id": uid(), "tenant_id": ctx["tenant"]["id"],
        "name": body.name, "os": body.os, "group": body.group, "ip": body.ip,
        "status": body.status, "pendingPatches": 0, "compliance": "100%",
        "lastScan": "Just now", "created_at": now_iso(),
    }
    response = dict(doc)  # snapshot before insert_one mutates doc with _id
    response.pop("tenant_id", None)
    await db.systems.insert_one(doc)
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": ctx["tenant"]["id"], "user": ctx["user"]["email"],
        "action": f"Registered agent {body.name}", "ip": "system", "timestamp": now_iso(),
    })
    return response

@api.delete("/systems/{sid}")
async def systems_delete(sid: str, ctx=Depends(get_current)):
    r = await db.systems.delete_one({"id": sid, "tenant_id": ctx["tenant"]["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "System not found")
    return {"ok": True}

# ----- System groups -----
@api.get("/system-groups")
async def groups_list(ctx=Depends(get_current)):
    return await list_scoped("system_groups", ctx["tenant"]["id"])

@api.post("/system-groups")
async def groups_create(body: SystemGroupIn, ctx=Depends(get_current)):
    tid = ctx["tenant"]["id"]
    if not body.name.strip():
        raise HTTPException(400, "Group name is required")
    # Exclude systems already assigned to another existing group.
    assigned: set[str] = set()
    async for g in db.system_groups.find({"tenant_id": tid}, {"systemIds": 1}):
        assigned.update(g.get("systemIds") or [])
    requested = set(body.systemIds)
    unavailable = requested & assigned
    if unavailable:
        raise HTTPException(400, f"System(s) already assigned to another group: {', '.join(sorted(unavailable))}")

    doc = {
        "id": uid(), "tenant_id": tid, "name": body.name.strip(),
        "owner": body.owner, "policy": body.policy,
        "systemIds": body.systemIds, "count": len(body.systemIds),
        "created_at": now_iso(),
    }
    response = dict(doc)
    response.pop("tenant_id", None)
    await db.system_groups.insert_one(doc)
    if body.systemIds:
        await db.systems.update_many(
            {"id": {"$in": body.systemIds}, "tenant_id": tid},
            {"$set": {"group": body.name.strip()}},
        )
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": ctx["user"]["email"],
        "action": f"Created system group {body.name}", "ip": "system", "timestamp": now_iso(),
    })
    await notify(tid, "system_group", f"System group created: {body.name}",
                 f"{body.name} was created by {ctx['user']['email']} with {len(body.systemIds)} system(s).",
                 doc["id"])
    return response

# ----- Patches -----
@api.get("/patches")
async def patches_list(ctx=Depends(get_current)):
    return await list_scoped("patches", ctx["tenant"]["id"])

@api.post("/patches/{pid}/approve")
async def patches_approve(pid: str, ctx=Depends(get_current)):
    r = await db.patches.update_one(
        {"id": pid, "tenant_id": ctx["tenant"]["id"]},
        {"$set": {"status": "Approved"}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Patch not found")
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": ctx["tenant"]["id"], "user": ctx["user"]["email"],
        "action": f"Approved patch {pid}", "ip": "system", "timestamp": now_iso(),
    })
    await notify(ctx["tenant"]["id"], "patch", f"Patch approved: {pid}",
                 f"Patch {pid} was approved by {ctx['user']['email']}.", pid)
    return {"ok": True}

# ----- Jobs -----
@api.get("/jobs")
async def jobs_list(ctx=Depends(get_current)):
    return await list_scoped("jobs", ctx["tenant"]["id"])

@api.post("/jobs")
async def jobs_create(body: JobIn, ctx=Depends(get_current)):
    tid = ctx["tenant"]["id"]
    mode = body.mode if body.mode in ("Deploy Patch", "Schedule") else "Deploy Patch"

    if mode == "Schedule":
        if not body.date or not body.time:
            raise HTTPException(400, "Date and Time are required to schedule a job")
        scheduled_time = f"{body.date} {body.time}"
        status = "Scheduled"
    else:
        scheduled_time = "Immediate"
        status = "Running"

    doc = {
        "id": uid(), "tenant_id": tid,
        "name": body.name, "status": status, "progress": 0,
        "targetGroup": body.targetGroup, "scheduledTime": scheduled_time,
        "type": body.type, "mode": mode,
        "policyId": body.policyId, "policyName": body.policyName,
        "successCount": 0, "failCount": 0,
        "created_at": now_iso(),
    }
    response = dict(doc)  # snapshot before insert_one mutates doc with _id
    response.pop("tenant_id", None)
    await db.jobs.insert_one(doc)
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": ctx["user"]["email"],
        "action": f"Created patch job {body.name}", "ip": "system", "timestamp": now_iso(),
    })
    policy_note = f" • Policy: {body.policyName}" if body.policyName else ""
    if mode == "Schedule":
        title = f"Job scheduled: {body.name}"
        message = f"Target: {body.targetGroup} • Runs {scheduled_time}{policy_note}"
    else:
        title = f"Job started: {body.name}"
        message = f"Target: {body.targetGroup} • Immediate execution{policy_note}"
    await notify(tid, "job", title, message, doc["id"])
    return response

# ----- Read-only endpoints -----
@api.get("/vulnerabilities")
async def vulns_list(ctx=Depends(get_current)):
    return await list_scoped("vulnerabilities", ctx["tenant"]["id"])

@api.get("/maintenance-windows")
async def mw_list(ctx=Depends(get_current)):
    return await list_scoped("maintenance_windows", ctx["tenant"]["id"])

@api.get("/repositories")
async def repos_list(ctx=Depends(get_current)):
    return await list_scoped("repositories", ctx["tenant"]["id"])

@api.get("/scripts")
async def scripts_list(ctx=Depends(get_current)):
    return await list_scoped("scripts", ctx["tenant"]["id"])

@api.get("/alerts")
async def alerts_list(ctx=Depends(get_current)):
    return await list_scoped("alerts", ctx["tenant"]["id"])

@api.get("/audit-logs")
async def audit_list(ctx=Depends(get_current)):
    return await list_scoped("audit_logs", ctx["tenant"]["id"])

# ----- Policies -----
@api.get("/policies")
async def policies_list(ctx=Depends(get_current)):
    items = await list_scoped("policies", ctx["tenant"]["id"])
    # Expired state is derived here (backend), not left to the frontend alone, so any
    # API consumer sees an up-to-date status without a separate expiry cron/job.
    for p in items:
        if is_policy_expired(p.get("expiry")):
            p["status"] = "Expired"
    return items

@api.post("/policies")
async def policies_create(body: PolicyIn, ctx=Depends(get_current)):
    tid = ctx["tenant"]["id"]
    created_on = now_iso()
    # Expiry is derived from Created On + Lifecycle when a lifecycle duration is given;
    # falls back to the legacy manual expiry date field for backward-compat.
    derived_expiry = compute_policy_expiry(created_on, body.lifecycleMonths) or body.expiry
    doc = {
        "id": uid(), "tenant_id": tid,
        "name": body.name.strip(), "description": body.description,
        "status": body.status, "enabled": body.enabled,
        "lifecycleMonths": body.lifecycleMonths, "expiry": derived_expiry,
        "createdBy": ctx["user"].get("name") or ctx["user"]["email"],
        "createdOn": created_on,
        "emailNotification": body.emailNotification,
        "webhookNotification": body.webhookNotification,
    }
    response = dict(doc)
    response.pop("tenant_id", None)
    await db.policies.insert_one(doc)
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": tid, "user": ctx["user"]["email"],
        "action": f"Created policy {body.name}", "ip": "system", "timestamp": now_iso(),
    })
    await notify(tid, "policy", f"Policy created: {body.name}",
                 f"{body.name} was created by {ctx['user']['email']} "
                 f"({'Enabled' if body.enabled else 'Disabled'}).", doc["id"])
    return response

# ----- Notifications (single centralized notification model, Task 1 item 5) -----
@api.get("/notifications")
async def notifications_list(ctx=Depends(get_current)):
    items = await list_scoped("notifications", ctx["tenant"]["id"])
    items.sort(key=lambda n: n.get("timestamp", ""), reverse=True)
    return items

@api.post("/notifications/{nid}/read")
async def notification_mark_read(nid: str, ctx=Depends(get_current)):
    r = await db.notifications.update_one(
        {"id": nid, "tenant_id": ctx["tenant"]["id"]}, {"$set": {"read": True}}
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Notification not found")
    return {"ok": True}

@api.post("/notifications/read-all")
async def notifications_mark_all_read(ctx=Depends(get_current)):
    await db.notifications.update_many(
        {"tenant_id": ctx["tenant"]["id"], "read": False}, {"$set": {"read": True}}
    )
    return {"ok": True}

# ----- Dashboard rollup -----
@api.get("/dashboard/stats")
async def dashboard_stats(ctx=Depends(get_current)):
    tid = ctx["tenant"]["id"]
    total_systems = await db.systems.count_documents({"tenant_id": tid})
    active_jobs = await db.jobs.count_documents({"tenant_id": tid, "status": "Running"})
    pending_patches = 0
    async for p in db.patches.find({"tenant_id": tid}, {"affectedCount": 1}):
        pending_patches += int(p.get("affectedCount", 0) or 0)
    return {
        "total_systems": total_systems,
        "active_jobs": active_jobs,
        "pending_patches": pending_patches,
        "compliance_score": 96.8,
    }

# ----- Tenant branding + users + invitations -----
@api.get("/tenant")
async def tenant_get(ctx=Depends(get_current)):
    return tenant_public(ctx["tenant"])

@api.patch("/tenant/branding")
async def tenant_branding(body: BrandingIn, ctx=Depends(get_current)):
    if ctx["user"]["role"] != "Global Admin":
        raise HTTPException(403, "Only Global Admin can update branding")
    update: Dict[str, Any] = {}
    if body.logo_data_url is not None:
        update["logo_data_url"] = body.logo_data_url or None
    if body.brand_color is not None:
        update["brand_color"] = body.brand_color or None
    if not update:
        raise HTTPException(400, "No fields to update")
    await db.tenants.update_one({"id": ctx["tenant"]["id"]}, {"$set": update})
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": ctx["tenant"]["id"], "user": ctx["user"]["email"],
        "action": f"Updated tenant branding ({', '.join(update.keys())})",
        "ip": "system", "timestamp": now_iso(),
    })
    t = await db.tenants.find_one({"id": ctx["tenant"]["id"]}, {"_id": 0})
    return tenant_public(t)

@api.get("/tenant/users")
async def tenant_users_list(ctx=Depends(get_current)):
    cursor = db.users.find(
        {"tenant_id": ctx["tenant"]["id"]},
        {"_id": 0, "password_hash": 0},
    ).sort("created_at", 1)
    return await cursor.to_list(500)

@api.post("/tenant/invite")
async def tenant_invite(body: InviteUserIn, ctx=Depends(get_current)):
    if ctx["user"]["role"] != "Global Admin":
        raise HTTPException(403, "Only Global Admin can invite users")
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email already in use")
    temp_password = secrets.token_urlsafe(9)  # 12-char temp password
    user = {
        "id": uid(), "tenant_id": ctx["tenant"]["id"], "email": email,
        "name": body.name, "role": body.role,
        "password_hash": hash_password(temp_password),
        "avatar_url": None, "mfa_enabled": False, "created_at": now_iso(),
        "invited_by": ctx["user"]["email"],
    }
    await db.users.insert_one(user)
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": ctx["tenant"]["id"], "user": ctx["user"]["email"],
        "action": f"Invited {email} as {body.role}", "ip": "system", "timestamp": now_iso(),
    })
    return {
        "user": user_public(user),
        "temp_password": temp_password,  # UI shows once so admin can share
    }

@api.delete("/tenant/users/{uid_}")
async def tenant_user_delete(uid_: str, ctx=Depends(get_current)):
    if ctx["user"]["role"] != "Global Admin":
        raise HTTPException(403, "Only Global Admin can remove users")
    if uid_ == ctx["user"]["id"]:
        raise HTTPException(400, "You cannot remove yourself")
    r = await db.users.delete_one({"id": uid_, "tenant_id": ctx["tenant"]["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "User not found")
    await db.audit_logs.insert_one({
        "id": uid(), "tenant_id": ctx["tenant"]["id"], "user": ctx["user"]["email"],
        "action": f"Removed user {uid_}", "ip": "system", "timestamp": now_iso(),
    })
    return {"ok": True}

# ----- Live job progress via WebSocket -----
class JobHub:
    """Broadcasts job progress updates per tenant."""
    def __init__(self) -> None:
        self._peers: Dict[str, set[WebSocket]] = {}

    async def connect(self, tenant_id: str, ws: WebSocket):
        await ws.accept()
        self._peers.setdefault(tenant_id, set()).add(ws)

    def disconnect(self, tenant_id: str, ws: WebSocket):
        self._peers.get(tenant_id, set()).discard(ws)

    async def broadcast(self, tenant_id: str, payload: Dict[str, Any]):
        dead: list[WebSocket] = []
        for ws in list(self._peers.get(tenant_id, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(tenant_id, ws)

hub = JobHub()

@app.websocket("/api/ws/jobs")
async def ws_jobs(ws: WebSocket, token: Optional[str] = None):
    """Client connects with ?token=<JWT>. Streams job progress ticks."""
    if not token:
        await ws.close(code=4401)
        return
    try:
        payload = decode_token(token)
    except Exception:
        await ws.close(code=4401)
        return
    tenant_id = payload.get("tid")
    if not tenant_id:
        await ws.close(code=4401)
        return
    await hub.connect(tenant_id, ws)
    try:
        # Send initial snapshot
        jobs = await list_scoped("jobs", tenant_id)
        await ws.send_json({"type": "snapshot", "jobs": jobs})
        while True:
            # Keepalive — waits for client heartbeat / any message
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        hub.disconnect(tenant_id, ws)

async def tick_running_jobs():
    """Background task: advance running-job progress every ~3s and broadcast."""
    logger.info("tick_running_jobs task starting loop")
    tick_count = 0
    while True:
        try:
            updated = 0
            async for job in db.jobs.find({"status": "Running"}):
                new_progress = min(100, int(job.get("progress", 0)) + 3)
                update: Dict[str, Any] = {"progress": new_progress}
                if new_progress >= 100:
                    update["status"] = "Completed"
                    update["successCount"] = int(job.get("successCount", 0)) + 1
                await db.jobs.update_one(
                    {"id": job["id"], "tenant_id": job["tenant_id"]},
                    {"$set": update},
                )
                await hub.broadcast(job["tenant_id"], {
                    "type": "job_update",
                    "job_id": job["id"],
                    "progress": update["progress"],
                    "status": update.get("status", job.get("status")),
                    "successCount": update.get("successCount", job.get("successCount", 0)),
                })
                updated += 1
            tick_count += 1
            if tick_count % 5 == 1:
                logger.info(f"tick #{tick_count}: updated {updated} running job(s)")
        except Exception as e:
            logger.exception(f"tick_running_jobs error: {e}")
        await asyncio.sleep(3)

# --------------------------------------------------------------------------- #
#  App wiring
# --------------------------------------------------------------------------- #
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_background_tasks: set = set()

@app.on_event("startup")
async def startup():
    await create_indexes()
    await seed_admin()
    task = asyncio.create_task(tick_running_jobs())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    logger.info("Patch Pilot API ready. Background tick task started.")

@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()
