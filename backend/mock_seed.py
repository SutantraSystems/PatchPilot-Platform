"""Seed data used to bootstrap each new tenant."""

systems = [
    {"id": "sys-01", "name": "prod-us-east-k8s-01", "os": "Ubuntu 22.04 LTS",
     "group": "Production Clusters", "ip": "10.0.1.45", "status": "Healthy",
     "pendingPatches": 2, "compliance": "98%", "lastScan": "10 mins ago"},
    {"id": "sys-02", "name": "prod-us-west-db-02", "os": "RHEL 9.2",
     "group": "Database Cluster", "ip": "10.0.2.12", "status": "Needs Attention",
     "pendingPatches": 5, "compliance": "84%", "lastScan": "2 hours ago"},
    {"id": "sys-03", "name": "dev-staging-app-03", "os": "Debian 12",
     "group": "Staging Fleet", "ip": "10.0.4.88", "status": "Healthy",
     "pendingPatches": 0, "compliance": "100%", "lastScan": "1 hour ago"},
    {"id": "sys-04", "name": "corp-win-dc-01", "os": "Windows Server 2022",
     "group": "Active Directory", "ip": "10.0.10.5", "status": "Critical",
     "pendingPatches": 12, "compliance": "62%", "lastScan": "1 day ago"},
    {"id": "sys-05", "name": "edge-gateway-09", "os": "Alpine Linux 3.18",
     "group": "Edge Nodes", "ip": "192.168.1.10", "status": "Healthy",
     "pendingPatches": 1, "compliance": "95%", "lastScan": "30 mins ago"},
    {"id": "sys-06", "name": "legacy-billing-app", "os": "CentOS 7",
     "group": "Decommissioned", "ip": "10.0.99.12", "status": "Offline",
     "pendingPatches": 45, "compliance": "22%", "lastScan": "30 days ago"},
]

system_groups = [
    {"id": "grp-1", "name": "Production Clusters", "count": 24, "owner": "DevOps Team",
     "policy": "Aggressive Sec", "systemIds": ["sys-01"]},
    {"id": "grp-2", "name": "Database Cluster", "count": 8, "owner": "DBA Team",
     "policy": "Maintenance Window Only", "systemIds": ["sys-02"]},
    {"id": "grp-3", "name": "Active Directory", "count": 4, "owner": "Security Team",
     "policy": "Immediate Critical", "systemIds": ["sys-04"]},
    {"id": "grp-4", "name": "Staging Fleet", "count": 16, "owner": "QA Team",
     "policy": "Auto-Pilot Dev", "systemIds": ["sys-03"]},
]

# Existing policy data reused by the new Policies feature (Task 1, item 3).
policies = [
    {"id": "pol-1", "name": "Aggressive Production Sec Policy",
     "description": "Applies critical CVE patches within 24 hours of vendor release across Kubernetes clusters.",
     "status": "Active", "enabled": True, "lifecycleMonths": None, "expiry": None,
     "createdBy": "Alex Mercer", "createdOn": "2026-06-01T00:00:00+00:00",
     "emailNotification": False, "webhookNotification": True},
    {"id": "pol-2", "name": "Database Cluster Strict Window",
     "description": "Patches restricted to Sunday 02:00 AM UTC with mandatory pre-snapshot verification.",
     "status": "Active", "enabled": True, "lifecycleMonths": None, "expiry": None,
     "createdBy": "Alex Mercer", "createdOn": "2026-06-01T00:00:00+00:00",
     "emailNotification": True, "webhookNotification": True},
]

# Centralized notifications store (Task 1, item 5). Starts empty; populated as
# tenant users take actions (create job/policy/group, approve patch, etc.).
notifications = []

patches = [
    {"id": "pat-101", "cve": "CVE-2026-1042", "title": "Linux Kernel Privilege Escalation Vulnerability",
     "severity": "Critical", "category": "Security", "kb": "KB5034441", "os": "Linux",
     "releaseDate": "2026-06-10", "status": "Approved", "affectedCount": 34},
    {"id": "pat-102", "cve": "CVE-2026-0911", "title": "OpenSSL Memory Corruption Buffer Overflow",
     "severity": "Critical", "category": "Security", "kb": "KB5038212", "os": "Linux/Unix",
     "releaseDate": "2026-06-08", "status": "Approved", "affectedCount": 58},
    {"id": "pat-103", "cve": "CVE-2026-2201", "title": "Windows Hyper-V Remote Code Execution",
     "severity": "High", "category": "Security", "kb": "KB5039120", "os": "Windows",
     "releaseDate": "2026-06-02", "status": "Pending Approval", "affectedCount": 14},
    {"id": "pat-104", "cve": "CVE-2026-0455", "title": "PostgreSQL Connection Pooling DoS Patch",
     "severity": "Medium", "category": "Bugfix", "kb": "KB5037119", "os": "Multi-OS",
     "releaseDate": "2026-05-28", "status": "Approved", "affectedCount": 8},
    {"id": "pat-105", "cve": "CVE-2026-3109", "title": "Apache HTTP Server Multiplexing Flaw",
     "severity": "High", "category": "Security", "kb": "KB5041098", "os": "Linux",
     "releaseDate": "2026-05-20", "status": "Exception", "affectedCount": 3},
]

jobs = [
    {"id": "job-501", "name": "Weekly Linux Security Rollout - Prod", "status": "Running",
     "progress": 68, "targetGroup": "Production Clusters", "scheduledTime": "Today, 02:00 AM",
     "type": "Automated", "successCount": 18, "failCount": 0},
    {"id": "job-502", "name": "Emergency Windows KB5039120 Push", "status": "Scheduled",
     "progress": 0, "targetGroup": "Active Directory", "scheduledTime": "Tonight, 11:30 PM",
     "type": "Manual", "successCount": 0, "failCount": 0},
    {"id": "job-503", "name": "Staging Fleet Weekend Sync & Reboot", "status": "Completed",
     "progress": 100, "targetGroup": "Staging Fleet", "scheduledTime": "Yesterday, 01:00 AM",
     "type": "Automated", "successCount": 16, "failCount": 0},
    {"id": "job-504", "name": "Database Cluster Offline Patch Run", "status": "Failed",
     "progress": 45, "targetGroup": "Database Cluster", "scheduledTime": "June 12, 03:00 AM",
     "type": "Manual", "successCount": 3, "failCount": 2},
]

maintenance_windows = [
    {"id": "mw-1", "name": "Sunday Early AM Maintenance",
     "schedule": "Every Sunday 01:00 - 04:00 UTC", "scope": "Production Clusters",
     "status": "Active", "blackout": "None"},
    {"id": "mw-2", "name": "Mid-week Patch Window",
     "schedule": "Wednesdays 02:00 - 03:30 UTC", "scope": "Staging & Dev",
     "status": "Active", "blackout": "Quarter-End Freeze"},
    {"id": "mw-3", "name": "Global Blackout Period (Fiscal Year Close)",
     "schedule": "June 28 - July 02", "scope": "All Systems",
     "status": "Scheduled Blackout", "blackout": "Full Freeze"},
]

vulnerabilities = [
    {"id": "vuln-1", "cve": "CVE-2026-1042", "name": "Kernel Privilege Escalation",
     "severity": "Critical", "cvss": "9.8", "affectedSystems": 34, "status": "Open"},
    {"id": "vuln-2", "cve": "CVE-2026-0911", "name": "OpenSSL Buffer Overflow",
     "severity": "Critical", "cvss": "9.1", "affectedSystems": 58, "status": "Mitigated"},
    {"id": "vuln-3", "cve": "CVE-2026-2201", "name": "Hyper-V RCE",
     "severity": "High", "cvss": "8.5", "affectedSystems": 14, "status": "Under Review"},
]

repositories = [
    {"id": "repo-1", "name": "Ubuntu 22.04 LTS Official Security Mirror",
     "type": "APT", "status": "Synced", "lastSync": "1 hour ago",
     "packages": 42100, "size": "142 GB"},
    {"id": "repo-2", "name": "RHEL 9 Enterprise Base Repository",
     "type": "YUM/DNF", "status": "Synced", "lastSync": "3 hours ago",
     "packages": 31200, "size": "215 GB"},
    {"id": "repo-3", "name": "Microsoft Windows Update Catalog Local Mirror",
     "type": "WSUS/WUA", "status": "Syncing", "lastSync": "In Progress (78%)",
     "packages": 89000, "size": "1.2 TB"},
    {"id": "repo-4", "name": "Alpine Linux Secure Security Index",
     "type": "APK", "status": "Failed", "lastSync": "2 days ago (Error 502)",
     "packages": 4100, "size": "4.5 GB"},
]

scripts = [
    {"id": "scr-1", "name": "pre-patch-snapshot-aws.sh", "type": "Bash",
     "author": "DevOps Lead",
     "description": "Takes EBS volume snapshots prior to applying kernel patches."},
    {"id": "scr-2", "name": "service-health-validator.py", "type": "Python",
     "author": "QA Automation",
     "description": "Verifies HTTP 200 on /healthz endpoints after reboot."},
    {"id": "scr-3", "name": "windows-iis-graceful-drain.ps1", "type": "PowerShell",
     "author": "SysAdmin Team",
     "description": "Drains IIS application pools before patching Windows Server."},
]

alerts = [
    {"id": "alt-1", "severity": "Critical",
     "message": "Failed patch deployment on 2 Database nodes (CVE-2026-1042)",
     "time": "12 mins ago", "status": "Unacknowledged"},
    {"id": "alt-2", "severity": "Warning",
     "message": "Windows Update sync reached 78% threshold warning on local mirror",
     "time": "45 mins ago", "status": "Acknowledged"},
    {"id": "alt-3", "severity": "Info",
     "message": "Scheduled maintenance window 'Sunday Early AM' will begin in 4 hours",
     "time": "2 hours ago", "status": "Resolved"},
]

audit_logs = [
    {"id": "aud-1", "user": "admin@patchpilot.io",
     "action": "Approved Patch CVE-2026-1042", "ip": "192.168.10.4",
     "timestamp": "2026-06-12 14:22:10"},
    {"id": "aud-2", "user": "devops-lead@patchpilot.io",
     "action": "Created Patch Job 'Weekly Linux Security Rollout'",
     "ip": "192.168.12.88", "timestamp": "2026-06-12 11:05:40"},
    {"id": "aud-3", "user": "security-officer@patchpilot.io",
     "action": "Added Exception for CVE-2026-3109 on Edge Nodes",
     "ip": "10.0.1.15", "timestamp": "2026-06-11 09:18:22"},
]
