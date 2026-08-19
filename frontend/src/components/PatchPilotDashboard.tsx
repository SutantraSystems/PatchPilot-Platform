import React, { useState } from "react";
import { 
  Server, Shield, PlayCircle, Wrench, CheckSquare, Activity, 
  Database, Cpu, FileText, Bell, ClipboardList, Settings, 
  Search, Plus, CheckCircle2, AlertTriangle, XCircle, Clock, 
  RefreshCw, Play, Trash2, Filter, Download, ExternalLink, 
  ChevronRight, Lock, UserCheck, Users, ShieldAlert, Check,
  HardDrive, Calendar, Zap, AlertOctagon, Terminal, ArrowUpRight
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { BrandingSettings } from "./BrandingSettings";
import { TenantUsersPanel } from "./TenantUsersPanel";
import { useAuth } from "@/context/AuthContext";
import {
  useSystems, useSystemGroups, usePatches, useJobs, useMaintenanceWindows,
  useVulnerabilities, useRepositories, useScripts, useAlerts, useAuditLogs,
  useTenant, useCreateSystem, useCreateJob, useApprovePatch,
  usePolicies, useCreateSystemGroup, useCreatePolicy,
} from "@/hooks/queries";
import { useJobStream } from "@/hooks/useJobStream";
import { topNavClass, subNavClass, navDropdownToggleClass, buttonVariants, badgeVariants, badgeBaseClass, inputClass } from "@/constants/theme";
import {
  initialSystems, initialSystemGroups, initialPatches, initialJobs,
  initialMaintenanceWindows, initialVulnerabilities, initialRepositories,
  initialScripts, initialAlerts, initialAuditLogs, initialUsers, initialTenants,
  initialPolicies
} from "../mock";

export default function PatchPilotDashboard() {
  const { user: currentUser } = useAuth();
  // "Global Admin" is this application's existing Super User role.
  const isSuperUser = currentUser?.role === "Global Admin";
  // Maintenance is restricted to Super Users and Product Owners (existing role/authorization pattern).
  const canSeeMaintenance = isSuperUser || currentUser?.role === "Product Owner";
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Sidebar expand / submenus state
  const [openSubMenus, setOpenSubMenus] = useState({
    systems: true,
    patches: true,
    jobs: true,
    maintenance: true,
    compliance: true,
    repositories: true,
    automation: true,
    administration: true
  });

  // Live backend data (falls back to mock while first fetch resolves)
  const { data: systems = initialSystems } = useSystems();
  const { data: systemGroups = initialSystemGroups } = useSystemGroups();
  const { data: patches = initialPatches } = usePatches();
  const { data: jobs = initialJobs } = useJobs();
  const { data: maintenanceWindows = initialMaintenanceWindows } = useMaintenanceWindows();
  const { data: vulnerabilities = initialVulnerabilities } = useVulnerabilities();
  const { data: repositories = initialRepositories } = useRepositories();
  const { data: scripts = initialScripts } = useScripts();
  const { data: alerts = initialAlerts } = useAlerts();
  const { data: auditLogs = initialAuditLogs } = useAuditLogs();
  const { data: tenant } = useTenant();
  const { data: policies = initialPolicies } = usePolicies();

  const users = initialUsers; // unused in Users tab (replaced by TenantUsersPanel)

  const createSystem = useCreateSystem();
  const createJob = useCreateJob();
  const approvePatchMut = useApprovePatch();
  const createSystemGroup = useCreateSystemGroup();
  const createPolicy = useCreatePolicy();
  useJobStream(true); // live progress via WebSocket

  // Guard direct access: if the tab lands on a Maintenance page without permission, bounce home.
  React.useEffect(() => {
    if (activeTab.startsWith("maint") && !canSeeMaintenance) {
      setActiveTab("dashboard");
    }
  }, [activeTab, canSeeMaintenance]);

  const brandColor = tenant?.brand_color || "#2563eb";
  const brandLogo = tenant?.logo_data_url;

  // New Job Creation Modal State
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const PATCH_JOB_NAME_OPTIONS = [
    "Windows Security Patches",
    "Windows OS Patches",
    "Ubuntu Security Patches",
    "Ubuntu OS Patches",
    "RHEL OS Patches",
    "RHEL Security Patches",
    "SUSE OS Patch",
    "SUSE Security Patch",
    "Application Patch",
    "DB Patch",
  ];
  const [newJobName, setNewJobName] = useState(PATCH_JOB_NAME_OPTIONS[0]);
  const [newJobGroup, setNewJobGroup] = useState("Production Clusters");
  const [newJobType, setNewJobType] = useState("Automated");
  const [newJobTenant, setNewJobTenant] = useState(initialTenants[0]?.name || "");
  // "Deploy Patch" = immediate execution, "Schedule" = requires Date + Time.
  const [newJobMode, setNewJobMode] = useState<"Deploy Patch" | "Schedule">("Deploy Patch");
  const [newJobDate, setNewJobDate] = useState("");
  const [newJobTime, setNewJobTime] = useState("");
  const [newJobPolicyId, setNewJobPolicyId] = useState(""); // optional

  // New System Modal State
  const [showAddSystemModal, setShowAddSystemModal] = useState(false);
  const [newSysName, setNewSysName] = useState("");
  const [newSysOs, setNewSysOs] = useState("Ubuntu 22.04 LTS");
  const [newSysIp, setNewSysIp] = useState("10.0.5.10");

  // Create New Group modal state (System Group)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupOwner, setNewGroupOwner] = useState("");
  const [newGroupPolicy, setNewGroupPolicy] = useState("");
  const [newGroupSystemIds, setNewGroupSystemIds] = useState<string[]>([]);

  // New Policy modal state
  const [showCreatePolicyModal, setShowCreatePolicyModal] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState("");
  const [newPolicyDescription, setNewPolicyDescription] = useState("");
  const [newPolicyStatus, setNewPolicyStatus] = useState("Active");
  const [newPolicyEnabled, setNewPolicyEnabled] = useState(true);
  const [newPolicyExpiry, setNewPolicyExpiry] = useState("");
  const [newPolicyLifecycleMonths, setNewPolicyLifecycleMonths] = useState(""); // Policy Lifecycle duration (months, as string for the select)
  const [newPolicyEmailNotif, setNewPolicyEmailNotif] = useState(false);
  const [newPolicyWebhookNotif, setNewPolicyWebhookNotif] = useState(false);

  // Running Jobs: working filters + sorting
  const [runningStatusFilter, setRunningStatusFilter] = useState("All");
  const [runningSortBy, setRunningSortBy] = useState<"scheduledTime" | "progress" | "status">("scheduledTime");
  const [runningSortDir, setRunningSortDir] = useState<"asc" | "desc">("desc");

  // Affected Systems: per-row Action dropdown (Scan Now / Patch Now / Reboot)
  const [openSystemActionId, setOpenSystemActionId] = useState<string | null>(null);

  // All Patches: Affected Systems node dialog
  const [affectedSystemsPatch, setAffectedSystemsPatch] = useState<any | null>(null);

  // Automation & Templates: Create Template
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateType, setNewTemplateType] = useState<"Bash" | "PowerShell" | "Python" | "Ansible">("Bash");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [customTemplates, setCustomTemplates] = useState<
    { id: string; name: string; type: string; author: string; description: string }[]
  >([]);

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName) return;
    setCustomTemplates((prev) => [
      ...prev,
      {
        id: `tpl-${Date.now()}`,
        name: newTemplateName,
        type: newTemplateType,
        author: "You",
        description: newTemplateDescription || `${newTemplateType} automation template.`,
      },
    ]);
    setShowCreateTemplateModal(false);
    setNewTemplateName("");
    setNewTemplateDescription("");
    setNewTemplateType("Bash");
    toast.success("Template created successfully!");
  };

  const toggleSubMenu = (menuKey: string) => {
    setOpenSubMenus((prev) => ({ ...prev, [menuKey]: !prev[menuKey as keyof typeof prev] }));
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobName) return;
    if (newJobMode === "Schedule" && (!newJobDate || !newJobTime)) {
      toast.error("Date and Time are required to schedule a job");
      return;
    }
    const selectedPolicy = policies.find((p: any) => p.id === newJobPolicyId);
    try {
      await createJob.mutateAsync({
        name: newJobName,
        targetGroup: newJobGroup,
        type: newJobType,
        mode: newJobMode,
        date: newJobMode === "Schedule" ? newJobDate : undefined,
        time: newJobMode === "Schedule" ? newJobTime : undefined,
        policyId: selectedPolicy?.id,
        policyName: selectedPolicy?.name,
      });
      setShowCreateJobModal(false);
      setNewJobName("");
      setNewJobMode("Deploy Patch");
      setNewJobDate("");
      setNewJobTime("");
      setNewJobPolicyId("");
      toast.success(
        newJobMode === "Schedule"
          ? "Patch Job scheduled successfully!"
          : "Patch Job created and deployed immediately!"
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create job");
    }
  };

  // Systems already assigned to an existing group are excluded from the "available" list.
  const assignedSystemIds = new Set(systemGroups.flatMap((g: any) => g.systemIds || []));
  const availableSystemsForGroup = systems.filter((s: any) => !assignedSystemIds.has(s.id));
  const groupOwnerOptions = Array.from(new Set(initialUsers.map((u) => u.name)));

  const toggleGroupSystemId = (id: string) => {
    setNewGroupSystemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      await createSystemGroup.mutateAsync({
        name: newGroupName.trim(),
        owner: newGroupOwner || groupOwnerOptions[0] || "",
        policy: newGroupPolicy,
        systemIds: newGroupSystemIds,
      });
      setShowCreateGroupModal(false);
      setNewGroupName("");
      setNewGroupOwner("");
      setNewGroupPolicy("");
      setNewGroupSystemIds([]);
      toast.success(`System group "${newGroupName.trim()}" created successfully!`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create system group");
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPolicyName.trim()) return;
    try {
      await createPolicy.mutateAsync({
        name: newPolicyName.trim(),
        description: newPolicyDescription,
        status: newPolicyStatus,
        enabled: newPolicyEnabled,
        expiry: newPolicyExpiry || null,
        lifecycleMonths: newPolicyLifecycleMonths ? Number(newPolicyLifecycleMonths) : null,
        emailNotification: newPolicyEmailNotif,
        webhookNotification: newPolicyWebhookNotif,
      });
      setShowCreatePolicyModal(false);
      setNewPolicyName("");
      setNewPolicyDescription("");
      setNewPolicyStatus("Active");
      setNewPolicyEnabled(true);
      setNewPolicyExpiry("");
      setNewPolicyLifecycleMonths("");
      setNewPolicyEmailNotif(false);
      setNewPolicyWebhookNotif(false);
      toast.success("Policy created successfully!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create policy");
    }
  };

  // Running Jobs: working filter + sort (Task 1, item 2)
  const runningJobsView = jobs
    .filter((j: any) => runningStatusFilter === "All" || j.status === runningStatusFilter)
    .slice()
    .sort((a: any, b: any) => {
      let cmp = 0;
      if (runningSortBy === "progress") cmp = (a.progress || 0) - (b.progress || 0);
      else if (runningSortBy === "status") cmp = String(a.status).localeCompare(String(b.status));
      else cmp = String(a.scheduledTime).localeCompare(String(b.scheduledTime));
      return runningSortDir === "asc" ? cmp : -cmp;
    });

  const upcomingScheduledJobs = jobs.filter((j: any) => j.status === "Scheduled");

  // Reports: reused existing systems data — no invented fields.
  // "Last Patch Date" reuses each system's existing lastScan value (the only
  // existing per-system, patch-related timestamp in the data model).
  const reportRows = systems.map((s: any) => ({
    reportName: "Executive Patch Summary Report",
    hostName: s.name,
    ip: s.ip,
    lastPatchDate: s.lastScan,
    status: s.status,
  }));

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Executive Patch Summary Report", 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [["Repository / Report Name", "Customer Host Name", "IP Address", "Last Patch Date", "Status"]],
      body: reportRows.map((r) => [r.reportName, r.hostName, r.ip, r.lastPatchDate, r.status]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save("patchpilot-patch-summary-report.pdf");
    toast.success("PDF report exported");
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      reportRows.map((r) => ({
        "Repository / Report Name": r.reportName,
        "Customer Host Name": r.hostName,
        "IP Address": r.ip,
        "Last Patch Date": r.lastPatchDate,
        "Status": r.status,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Patch Report");
    XLSX.writeFile(wb, "patchpilot-patch-summary-report.xlsx");
    toast.success("Excel report exported");
  };

  const handleAddSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSysName) return;
    try {
      await createSystem.mutateAsync({
        name: newSysName,
        os: newSysOs,
        ip: newSysIp,
        group: "Production Clusters",
        status: "Healthy",
      });
      setShowAddSystemModal(false);
      setNewSysName("");
      toast.success(`Agent registered successfully for ${newSysName}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to register agent");
    }
  };

  const approvePatch = async (id: string) => {
    try {
      await approvePatchMut.mutateAsync(id);
      toast.success("Patch successfully approved for deployment pipelines!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to approve patch");
    }
  };

  const acknowledgeAlert = (id: string) => {
    toast.success("Alert acknowledged.");
    void id;
  };

  const handleSystemAction = (sysName: string, action: "Scan Now" | "Patch Now" | "Reboot") => {
    setOpenSystemActionId(null);
    if (action === "Scan Now") {
      toast.success(`Initiated vulnerability scan on ${sysName}`);
    } else if (action === "Patch Now") {
      toast.success(`Patch deployment triggered on ${sysName}`);
    } else {
      toast.success(`Reboot command sent to ${sysName}`);
    }
  };

  // Deterministically synthesize affected-node details (serial number + IP) for a patch,
  // reusing the existing mock/model pattern rather than adding a new backend structure.
  const getAffectedNodes = (patch: any) => {
    const count = patch?.affectedCount || 0;
    return Array.from({ length: count }, (_, i) => {
      const n = i + 1;
      const octet3 = 10 + (n % 240);
      const octet4 = 1 + (n % 253);
      return {
        serial: `SN-${patch.id.toUpperCase()}-${String(n).padStart(4, "0")}`,
        ip: `10.${(n * 7) % 200}.${octet3}.${octet4}`,
      };
    });
  };

  return (
    <div
      className="flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden"
      style={{ "--brand": brandColor } as React.CSSProperties}
    >
      <Toaster position="top-right" richColors />

      {/* SIDEBAR */}
      <aside className="w-72 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-xl">
        {/* Brand Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
          <div className="flex items-center space-x-3">
            <div
              data-testid="sidebar-brand-tile"
              className="w-9 h-9 rounded-lg flex items-center justify-center shadow-lg overflow-hidden"
              style={{
                background: brandLogo ? "transparent" : `linear-gradient(135deg, ${brandColor}, #4f46e5)`,
                boxShadow: `0 8px 20px -8px ${brandColor}66`,
              }}
            >
              {brandLogo ? (
                <img
                  data-testid="sidebar-brand-logo"
                  src={brandLogo}
                  alt="Tenant logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Shield className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <span
                data-testid="sidebar-tenant-name"
                className="font-bold text-lg tracking-tight text-slate-900 dark:text-slate-100"
              >
                {(tenant?.name || "Patch Pilot").replace(/\s+HQ$/i, "")}
              </span>
              <span
                className="block text-[10px] font-medium tracking-widest uppercase"
                style={{ color: brandColor }}
              >
                Patching Console
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar Navigation items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar text-sm">
          
          {/* Dashboard */}
          <button
            data-testid="sidebar-dashboard"
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center px-3 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === "dashboard" 
                ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-inner" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:bg-slate-200 dark:bg-slate-800/60 hover:text-slate-800 dark:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4 mr-3 text-blue-400" />
            Dashboard
          </button>

          {/* Systems Dropdown */}
          <div>
            <button
              onClick={() => toggleSubMenu("systems")}
              className={navDropdownToggleClass}
            >
              <div className="flex items-center">
                <Server className="w-4 h-4 mr-3 text-emerald-400" />
                Systems
              </div>
              <span className={`text-xs transition-transform ${openSubMenus.systems ? 'rotate-90' : ''}`}>▶</span>
            </button>
            {openSubMenus.systems && (
              <div className="pl-9 pr-2 space-y-1 mt-1 text-xs">
                <button data-testid="nav-all-systems" onClick={() => setActiveTab("systems-all")} className={subNavClass(activeTab === 'systems-all')}>All Systems</button>
                <button data-testid="nav-system-groups" onClick={() => setActiveTab("systems-groups")} className={subNavClass(activeTab === 'systems-groups')}>System Groups</button>
                <button data-testid="nav-decommissioned-systems" onClick={() => setActiveTab("systems-decom")} className={subNavClass(activeTab === 'systems-decom')}>Decommissioned Systems</button>
              </div>
            )}
          </div>

          {/* Patches Dropdown */}
          <div>
            <button
              onClick={() => toggleSubMenu("patches")}
              className={navDropdownToggleClass}
            >
              <div className="flex items-center">
                <Shield className="w-4 h-4 mr-3 text-cyan-400" />
                Patches
              </div>
              <span className={`text-xs transition-transform ${openSubMenus.patches ? 'rotate-90' : ''}`}>▶</span>
            </button>
            {openSubMenus.patches && (
              <div className="pl-9 pr-2 space-y-1 mt-1 text-xs">
                <button data-testid="nav-all-patches" onClick={() => setActiveTab("patches-all")} className={subNavClass(activeTab === 'patches-all')}>All Patches</button>
                <button data-testid="nav-security-patches" onClick={() => setActiveTab("patches-security")} className={subNavClass(activeTab === 'patches-security')}>Security Patches</button>
                <button data-testid="nav-approved-patches" onClick={() => setActiveTab("patches-approved")} className={subNavClass(activeTab === 'patches-approved')}>Approved Patches</button>
                <button data-testid="nav-patch-exceptions" onClick={() => setActiveTab("patches-exceptions")} className={subNavClass(activeTab === 'patches-exceptions')}>Exceptions</button>
              </div>
            )}
          </div>

          {/* Patch Jobs Dropdown */}
          <div>
            <button
              onClick={() => toggleSubMenu("jobs")}
              className={navDropdownToggleClass}
            >
              <div className="flex items-center">
                <PlayCircle className="w-4 h-4 mr-3 text-amber-400" />
                Patch Jobs
              </div>
              <span className={`text-xs transition-transform ${openSubMenus.jobs ? 'rotate-90' : ''}`}>▶</span>
            </button>
            {openSubMenus.jobs && (
              <div className="pl-9 pr-2 space-y-1 mt-1 text-xs">
                <button data-testid="nav-create-job" onClick={() => setActiveTab("jobs-create")} className={subNavClass(activeTab === 'jobs-create')}>Create Job</button>
                <button data-testid="nav-jobs-running" onClick={() => setActiveTab("jobs-running")} className={subNavClass(activeTab === 'jobs-running')}>Running</button>
                <button data-testid="nav-jobs-scheduled" onClick={() => setActiveTab("jobs-scheduled")} className={subNavClass(activeTab === 'jobs-scheduled')}>Scheduled</button>
                <button data-testid="nav-jobs-completed" onClick={() => setActiveTab("jobs-completed")} className={subNavClass(activeTab === 'jobs-completed')}>Completed</button>
                <button data-testid="nav-jobs-failed" onClick={() => setActiveTab("jobs-failed")} className={subNavClass(activeTab === 'jobs-failed')}>Failed</button>
              </div>
            )}
          </div>

          {/* Policies */}
          <button
            data-testid="sidebar-policies"
            onClick={() => setActiveTab("policies")}
            className={topNavClass(activeTab === "policies")}
          >
            <Lock className="w-4 h-4 mr-3 text-purple-400" />
            Policies
          </button>

          {/* Maintenance Dropdown — visible only to Super Users and Product Owners */}
          {canSeeMaintenance && (
            <div>
              <button
                data-testid="nav-maintenance-group"
                onClick={() => toggleSubMenu("maintenance")}
                className={navDropdownToggleClass}
              >
                <div className="flex items-center">
                  <Wrench className="w-4 h-4 mr-3 text-rose-400" />
                  Maintenance
                </div>
                <span className={`text-xs transition-transform ${openSubMenus.maintenance ? 'rotate-90' : ''}`}>▶</span>
              </button>
              {openSubMenus.maintenance && (
                <div className="pl-9 pr-2 space-y-1 mt-1 text-xs">
                  <button data-testid="nav-maint-calendar" onClick={() => setActiveTab("maint-calendar")} className={subNavClass(activeTab === 'maint-calendar')}>Calendar</button>
                  <button data-testid="nav-maint-windows" onClick={() => setActiveTab("maint-windows")} className={subNavClass(activeTab === 'maint-windows')}>Maintenance Windows</button>
                  <button data-testid="nav-maint-blackout" onClick={() => setActiveTab("maint-blackout")} className={subNavClass(activeTab === 'maint-blackout')}>Blackout Periods</button>
                </div>
              )}
            </div>
          )}

          {/* Approvals */}
          <button
            data-testid="sidebar-approvals"
            onClick={() => setActiveTab("approvals")}
            className={topNavClass(activeTab === "approvals")}
          >
            <CheckSquare className="w-4 h-4 mr-3 text-emerald-400" />
            Approvals
          </button>

          {/* Vulnerabilities */}
          <button
            data-testid="sidebar-vulnerabilities"
            onClick={() => setActiveTab("vulnerabilities")}
            className={topNavClass(activeTab === "vulnerabilities")}
          >
            <ShieldAlert className="w-4 h-4 mr-3 text-red-400" />
            Vulnerabilities
          </button>

          {/* Repositories Dropdown */}
          <div>
            <button
              onClick={() => toggleSubMenu("repositories")}
              className={navDropdownToggleClass}
            >
              <div className="flex items-center">
                <Database className="w-4 h-4 mr-3 text-teal-400" />
                Repositories
              </div>
              <span className={`text-xs transition-transform ${openSubMenus.repositories ? 'rotate-90' : ''}`}>▶</span>
            </button>
            {openSubMenus.repositories && (
              <div className="pl-9 pr-2 space-y-1 mt-1 text-xs">
                <button data-testid="nav-repo-list" onClick={() => setActiveTab("repo-list")} className={subNavClass(activeTab === 'repo-list')}>Repository List</button>
                <button data-testid="nav-repo-sync" onClick={() => setActiveTab("repo-sync")} className={subNavClass(activeTab === 'repo-sync')}>Sync Jobs</button>
              </div>
            )}
          </div>

          {/* Reports */}
          <button
            data-testid="sidebar-reports"
            onClick={() => setActiveTab("reports")}
            className={topNavClass(activeTab === "reports")}
          >
            <FileText className="w-4 h-4 mr-3 text-sky-400" />
            Reports
          </button>

          {/* Audit Logs */}
          <button
            data-testid="sidebar-audit-logs"
            onClick={() => setActiveTab("audit-logs")}
            className={topNavClass(activeTab === "audit-logs")}
          >
            <Clock className="w-4 h-4 mr-3 text-violet-400" />
            Audit Logs
          </button>

          {/* Administration Dropdown */}
          <div>
            <button
              onClick={() => toggleSubMenu("administration")}
              className={navDropdownToggleClass}
            >
              <div className="flex items-center">
                <Settings className="w-4 h-4 mr-3 text-slate-600 dark:text-slate-400" />
                Administration
              </div>
              <span className={`text-xs transition-transform ${openSubMenus.administration ? 'rotate-90' : ''}`}>▶</span>
            </button>
            {openSubMenus.administration && (
              <div className="pl-9 pr-2 space-y-1 mt-1 text-xs">
                <button data-testid="nav-admin-users" onClick={() => setActiveTab("admin-users")} className={subNavClass(activeTab === 'admin-users')}>Users</button>
                <button data-testid="nav-admin-agent" onClick={() => setActiveTab("admin-agent")} className={subNavClass(activeTab === 'admin-agent')}>Agent Management</button>
                {isSuperUser && (
                  <button data-testid="nav-admin-settings" onClick={() => setActiveTab("admin-settings")} className={subNavClass(activeTab === 'admin-settings')}>Settings</button>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Sidebar Footer info */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-white dark:bg-slate-950/40 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>Pilot Agent v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white dark:bg-slate-950">
        
        {/* TOP HEADER */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-50 dark:bg-slate-900/50 backdrop-blur px-8 flex items-center justify-between z-10">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 capitalize">
              {activeTab.replace("-", " > ")}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <NotificationBell upcoming={upcomingScheduledJobs} />
            <UserMenu />
          </div>
        </header>

        {/* DYNAMIC SCREEN VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          
          {/* 1. DASHBOARD VIEW */}
          {activeTab === "dashboard" && (
            <div data-testid="dashboard-view" className="space-y-6">
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="bg-white/80 dark:bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Total Systems</span>
                    <Server className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{systems.length}</div>
                  <div className="text-xs text-emerald-400 mt-2 flex items-center font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 94% Compliant Fleet
                  </div>
                </div>

                <div className="bg-white/80 dark:bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Pending Patches</span>
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {patches.reduce((acc, p) => acc + p.affectedCount, 0)}
                  </div>
                  <div className="text-xs text-amber-400 mt-2 flex items-center font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" /> 18 Critical CVEs
                  </div>
                </div>

                <div className="bg-white/80 dark:bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Active Patch Jobs</span>
                    <PlayCircle className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {jobs.filter(j => j.status === "Running").length}
                  </div>
                  <div className="text-xs text-blue-400 mt-2 flex items-center font-medium">
                    <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Real-time deployment executing
                  </div>
                </div>

                <div className="bg-white/80 dark:bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Fleet SLA Score</span>
                    <Activity className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">96.8%</div>
                  <div className="text-xs text-purple-400 mt-2 flex items-center font-medium">
                    <Check className="w-3.5 h-3.5 mr-1" /> Exceeds 95% target
                  </div>
                </div>
              </div>

              {/* Quick Actions & Recent Jobs */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Active Jobs Pipeline */}
                <div className="lg:col-span-2 bg-white/80 dark:bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Active & Recent Patch Jobs</h2>
                    <button onClick={() => setActiveTab("jobs-running")} className="text-xs text-blue-400 hover:underline">View All Jobs</button>
                  </div>
                  <div className="space-y-3">
                    {jobs.slice(0, 3).map(job => (
                      <div key={job.id} className="bg-slate-100/60 dark:bg-white dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-200 dark:border-slate-800/80 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-sm text-slate-800 dark:text-slate-200">{job.name}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              job.status === 'Running' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                              job.status === 'Completed' ? badgeVariants.success :
                              job.status === 'Failed' ? badgeVariants.danger : badgeVariants.warning
                            }`}>{job.status}</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Target Group: <span className="text-slate-700 dark:text-slate-300">{job.targetGroup}</span> • Scheduled: {job.scheduledTime}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">{job.progress}%</span>
                          <div className="w-24 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${job.progress}%` }}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Critical Vulnerabilities Feed */}
                <div className="bg-white/80 dark:bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Critical CVE Feed</h2>
                    <button onClick={() => setActiveTab("vulnerabilities")} className="text-xs text-blue-400 hover:underline">View All</button>
                  </div>
                  <div className="space-y-3">
                    {vulnerabilities.map(v => (
                      <div key={v.id} className="bg-slate-100/60 dark:bg-white dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-200 dark:border-slate-800/80 rounded-lg p-3 flex items-start justify-between">
                        <div>
                          <span className="text-xs font-mono font-semibold text-red-400">{v.cve}</span>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-0.5">{v.name}</p>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 block">CVSS {v.cvss} • {v.affectedSystems} Systems</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          v.status === 'Open' ? badgeVariants.dangerOutline : badgeVariants.success
                        }`}>{v.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Compliance tiles (moved from the former Compliance sidebar page) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div data-testid="compliance-tile-overall" className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg">
                  <span className="text-xs text-slate-600 dark:text-slate-400 uppercase font-semibold">Overall Compliance</span>
                  <div className="text-3xl font-bold text-emerald-400 mt-2">96.8%</div>
                  <p className="text-xs text-slate-500 mt-1">Target: &gt; 95.0%</p>
                </div>
                <div data-testid="compliance-tile-sla" className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg">
                  <span className="text-xs text-slate-600 dark:text-slate-400 uppercase font-semibold">SLA Adherence</span>
                  <div className="text-3xl font-bold text-blue-400 mt-2">99.1%</div>
                  <p className="text-xs text-slate-500 mt-1">Critical patches resolved &lt; 24h</p>
                </div>
                <div data-testid="compliance-tile-noncompliant" className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg">
                  <span className="text-xs text-slate-600 dark:text-slate-400 uppercase font-semibold">Non-Compliant Nodes</span>
                  <div className="text-3xl font-bold text-red-400 mt-2">2 Systems</div>
                  <p className="text-xs text-slate-500 mt-1">Action required</p>
                </div>
              </div>

              {/* Systems Overview Table */}
              <div className="bg-white/80 dark:bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Managed Systems Fleet Overview</h2>
                  <button onClick={() => setActiveTab("systems-all")} className="text-xs text-blue-400 hover:underline">Manage All Systems</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-100/80 dark:bg-white dark:bg-slate-950/80 uppercase text-[10px] font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Hostname</th>
                        <th className="py-3 px-4">OS Version</th>
                        <th className="py-3 px-4">Group</th>
                        <th className="py-3 px-4">IP Address</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Compliance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-200 dark:divide-slate-800/60">
                      {systems.map(sys => (
                        <tr key={sys.id} className="hover:bg-slate-200/30 dark:bg-slate-200 dark:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">{sys.name}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{sys.os}</td>
                          <td className="py-3 px-4"><span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[11px]">{sys.group}</span></td>
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">{sys.ip}</td>
                          <td className="py-3 px-4">
                            <span className={`${badgeBaseClass} ${
                              sys.status === 'Healthy' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              sys.status === 'Needs Attention' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                              sys.status === 'Critical' ? badgeVariants.dangerOutline : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>{sys.status}</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-blue-400">{sys.compliance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* 2. SYSTEMS VIEWS */}
          {activeTab.startsWith("systems") && (
            <div data-testid="systems-view" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {activeTab === 'systems-all' && 'All Managed Systems'}
                    {activeTab === 'systems-groups' && 'System Groups & Collections'}
                    {activeTab === 'systems-unmanaged' && 'Unmanaged Systems Discovery'}
                    {activeTab === 'systems-decom' && 'Decommissioned Systems Archive'}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Fleet asset inventory </p>
                </div>
                {activeTab === 'systems-groups' && (
                  <button
                    data-testid="open-create-group-modal"
                    onClick={() => setShowCreateGroupModal(true)}
                    className={buttonVariants.primaryWithIcon}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New Group</span>
                  </button>
                )}
              </div>

              {activeTab === 'systems-groups' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {systemGroups.map(grp => (
                    <div key={grp.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{grp.name}</h3>
                        <span className="bg-blue-500/20 text-blue-400 text-xs px-2.5 py-1 rounded-full font-mono">{grp.count} Systems</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">Assigned Owner: <span className="text-slate-800 dark:text-slate-200 font-medium">{grp.owner}</span></p>
                      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
                        <span className="text-slate-600 dark:text-slate-400">Policy: <span className="text-slate-800 dark:text-slate-200 font-medium">{grp.policy}</span></span>
                        <button className="text-blue-400 hover:underline">Configure Group</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-white dark:bg-slate-950 uppercase text-[10px] font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Hostname</th>
                        <th className="py-3 px-4">OS Distribution</th>
                        <th className="py-3 px-4">Group</th>
                        <th className="py-3 px-4">IP Address</th>
                        {activeTab !== 'systems-decom' && (
                          <>
                            <th className="py-3 px-4">Pending Patches</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Action Required</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 dark:divide-slate-200 dark:divide-slate-800/80">
                      {systems.map(sys => (
                        <tr key={sys.id} className="hover:bg-slate-200/40 dark:bg-slate-200 dark:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">{sys.name}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{sys.os}</td>
                          <td className="py-3 px-4"><span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">{sys.group}</span></td>
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">{sys.ip}</td>
                          {activeTab !== 'systems-decom' && (
                            <>
                              <td className="py-3 px-4 font-mono text-amber-400 font-bold">{sys.pendingPatches} Patches</td>
                              <td className="py-3 px-4">
                                <span className={`${badgeBaseClass} ${
                                  sys.status === 'Healthy' ? badgeVariants.success : badgeVariants.danger
                                }`}>{sys.status}</span>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  data-testid={`action-required-${sys.id}`}
                                  className={`${badgeBaseClass} ${
                                    sys.rebootRequired ? badgeVariants.warning : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                  }`}
                                >
                                  {sys.rebootRequired ? 'Reboot Required' : 'Not Required'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right relative">
                                <button
                                  data-testid={`action-btn-${sys.id}`}
                                  onClick={() => setOpenSystemActionId(openSystemActionId === sys.id ? null : sys.id)}
                                  className="text-blue-400 hover:underline inline-flex items-center gap-1"
                                >
                                  Action
                                  <ChevronRight className={`w-3 h-3 transition-transform ${openSystemActionId === sys.id ? 'rotate-90' : ''}`} />
                                </button>
                                {openSystemActionId === sys.id && (
                                  <div
                                    data-testid={`action-menu-${sys.id}`}
                                    className="absolute right-4 top-full mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl z-30 overflow-hidden text-left"
                                  >
                                    <button
                                      data-testid={`action-scan-${sys.id}`}
                                      onClick={() => handleSystemAction(sys.name, "Scan Now")}
                                      className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                                    >
                                      Scan Now
                                    </button>
                                    <button
                                      data-testid={`action-patch-${sys.id}`}
                                      onClick={() => handleSystemAction(sys.name, "Patch Now")}
                                      className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                                    >
                                      Patch Now
                                    </button>
                                    <button
                                      data-testid={`action-reboot-${sys.id}`}
                                      onClick={() => handleSystemAction(sys.name, "Reboot")}
                                      className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                                    >
                                      Reboot
                                    </button>
                                  </div>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. PATCHES VIEWS */}
          {activeTab.startsWith("patches") && (
            <div data-testid="patches-view" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {activeTab === 'patches-all' && 'All Patches Catalog'}
                    {activeTab === 'patches-security' && 'Security Patches & CVE Feed'}
                    {activeTab === 'patches-bundles' && 'Vendor Patch Bundles (MS/RedHat/Ubuntu)'}
                    {activeTab === 'patches-approved' && 'Approved Patches Ready for Deployment'}
                    {activeTab === 'patches-exceptions' && 'Patch Exceptions & Policy Overrides'}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Synchronized from vendor catalogs with zero-day vulnerability prioritization.</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-white dark:bg-slate-950 uppercase text-[10px] font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">CVE / KB ID</th>
                      <th className="py-3 px-4">Title & Description</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Affected Systems</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 dark:divide-slate-200 dark:divide-slate-800/80">
                    {patches.map(p => (
                      <tr key={p.id} className="hover:bg-slate-200/40 dark:bg-slate-200 dark:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-blue-400">{p.cve}</td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{p.title}</p>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400">Release: {p.releaseDate} • KB: {p.kb}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`${badgeBaseClass} ${
                            p.severity === 'Critical' ? badgeVariants.dangerOutline : badgeVariants.warning
                          }`}>{p.severity}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{p.category}</td>
                        <td className="py-3 px-4 font-mono">
                          <button
                            data-testid={`affected-systems-${p.id}`}
                            onClick={() => setAffectedSystemsPatch(p)}
                            className="text-blue-400 hover:underline"
                          >
                            {p.affectedCount} Nodes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. PATCH JOBS VIEWS */}
          {activeTab.startsWith("jobs") && (
            <div data-testid="jobs-view" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {activeTab === 'jobs-create' && 'Create Patch Deployment Job'}
                    {activeTab === 'jobs-running' && 'Running Patch Jobs'}
                    {activeTab === 'jobs-scheduled' && 'Scheduled Patch Jobs'}
                    {activeTab === 'jobs-completed' && 'Completed Patch Jobs History'}
                    {activeTab === 'jobs-failed' && 'Failed Patch Jobs & Error Diagnostics'}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Orchestrate zero-downtime rolling patch updates across enterprise fleets.</p>
                </div>
                {/* Duplicate "Create New Job" removed — this page's form below is the entry point. */}
              </div>

              {activeTab === 'jobs-running' && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-lg flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Status</label>
                    <select
                      data-testid="running-filter-status"
                      value={runningStatusFilter}
                      onChange={(e) => setRunningStatusFilter(e.target.value)}
                      className={`${inputClass} w-40`}
                    >
                      <option value="All">All</option>
                      <option value="Running">Running</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Completed">Completed</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Sort by</label>
                    <select
                      data-testid="running-sort-by"
                      value={runningSortBy}
                      onChange={(e) => setRunningSortBy(e.target.value as typeof runningSortBy)}
                      className={`${inputClass} w-40`}
                    >
                      <option value="scheduledTime">Date / Time</option>
                      <option value="progress">Progress</option>
                      <option value="status">Status</option>
                    </select>
                  </div>
                  <button
                    data-testid="running-sort-direction"
                    type="button"
                    onClick={() => setRunningSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className={buttonVariants.secondary}
                  >
                    {runningSortDir === "asc" ? "Ascending ↑" : "Descending ↓"}
                  </button>
                </div>
              )}

              {activeTab === 'jobs-create' ? (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg max-w-2xl">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">Job Orchestration Wizard</h3>
                  <form onSubmit={handleCreateJob} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Patch Job Name</label>
                      <select
                        data-testid="input-job-name"
                        value={newJobName}
                        onChange={(e) => setNewJobName(e.target.value)}
                        className={inputClass}
                        required
                      >
                        {PATCH_JOB_NAME_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Select Tenant</label>
                      <select
                        data-testid="input-job-tenant"
                        value={newJobTenant}
                        onChange={(e) => setNewJobTenant(e.target.value)}
                        className={inputClass}
                      >
                        {initialTenants.map(t => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Target System Group</label>
                      <select
                        value={newJobGroup}
                        onChange={(e) => setNewJobGroup(e.target.value)}
                        className={inputClass}
                      >
                        {systemGroups.map(g => (
                          <option key={g.id} value={g.name}>{g.name} ({g.count} nodes)</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Execution Mode</label>
                      <select
                        value={newJobType}
                        onChange={(e) => setNewJobType(e.target.value)}
                        className={inputClass}
                      >
                        <option value="Automated">Automated Rolling Deployment</option>
                        <option value="Manual">Manual Approval & Execution</option>
                        <option value="Emergency">Emergency Immediate Push</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Action</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          data-testid="job-mode-deploy"
                          onClick={() => setNewJobMode("Deploy Patch")}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border ${
                            newJobMode === "Deploy Patch"
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          Deploy Patch (Immediate)
                        </button>
                        <button
                          type="button"
                          data-testid="job-mode-schedule"
                          onClick={() => setNewJobMode("Schedule")}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border ${
                            newJobMode === "Schedule"
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          Schedule
                        </button>
                      </div>
                    </div>
                    {newJobMode === "Schedule" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
                          <input
                            data-testid="input-job-date"
                            type="date"
                            value={newJobDate}
                            onChange={(e) => setNewJobDate(e.target.value)}
                            className={inputClass}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Time</label>
                          <input
                            data-testid="input-job-time"
                            type="time"
                            value={newJobTime}
                            onChange={(e) => setNewJobTime(e.target.value)}
                            className={inputClass}
                            required
                          />
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Select Policy (optional)</label>
                      <select
                        data-testid="input-job-policy"
                        value={newJobPolicyId}
                        onChange={(e) => setNewJobPolicyId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">No policy</option>
                        {policies.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      data-testid="submit-create-job"
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-xs mt-4 shadow-lg shadow-blue-600/20"
                    >
                      {newJobMode === "Schedule" ? "Schedule Patch Job" : "Deploy Patch Job Now"}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  {(activeTab === 'jobs-running' ? runningJobsView : jobs).map(job => (
                    <div key={job.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-3">
                          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{job.name}</span>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded font-bold uppercase ${
                            job.status === 'Running' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            job.status === 'Completed' ? badgeVariants.success :
                            job.status === 'Failed' ? badgeVariants.danger : badgeVariants.warning
                          }`}>{job.status}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Target: <span className="text-slate-700 dark:text-slate-300">{job.targetGroup}</span> • Scheduled Time: {job.scheduledTime} • Type: {job.type}{job.policyName ? ` • Policy: ${job.policyName}` : ""}</p>
                      </div>
                      <div className="text-right w-48">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600 dark:text-slate-400">Progress</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{job.progress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${job.progress}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. POLICIES VIEW */}
          {activeTab === "policies" && (
            <div data-testid="policies-view" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Patch Deployment Policies</h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Configure automated patching SLAs, lifecycle, and approval requirements.</p>
                </div>
                <button
                  data-testid="open-create-policy-modal"
                  onClick={() => setShowCreatePolicyModal(true)}
                  className={buttonVariants.primary}
                >
                  New Policy
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {policies.map((pol: any) => {
                  // Lifecycle expiry check: a policy whose expiry date has passed is considered expired
                  // (existing "expiry" field/pattern; no new data structure introduced).
                  const isExpired = !!pol.expiry && new Date(pol.expiry) < new Date();
                  return (
                  <div key={pol.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{pol.name}</h3>
                      <div className="flex items-center gap-2">
                        {isExpired && (
                          <span data-testid={`policy-expired-${pol.id}`} className={`${badgeBaseClass} ${badgeVariants.danger}`}>
                            Expired
                          </span>
                        )}
                        <span className={`${badgeBaseClass} ${pol.enabled ? badgeVariants.success : badgeVariants.neutral}`}>
                          {pol.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">{pol.description || "No description provided."}</p>
                    <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      <div className="flex justify-between"><span>Status:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{isExpired ? "Expired" : pol.status}</span></div>
                      <div className="flex justify-between"><span>Policy Lifecycle:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{pol.lifecycleMonths ? `${pol.lifecycleMonths} month${pol.lifecycleMonths > 1 ? "s" : ""}` : "No lifecycle"}</span></div>
                      <div className="flex justify-between"><span>Lifecycle / Expiry:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{pol.expiry ? new Date(pol.expiry).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "No expiry"}</span></div>
                      <div className="flex justify-between"><span>Notifications:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {[pol.emailNotification && "Email", pol.webhookNotification && "Webhook"].filter(Boolean).join(" & ") || "None"}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                        <span>Created By:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{pol.createdBy}</span>
                      </div>
                      <div className="flex justify-between"><span>Created On:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{(pol.createdOn || "").slice(0, 10)}</span></div>
                    </div>
                  </div>
                  );
                })}
                {policies.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No policies yet. Create one to get started.</p>
                )}
              </div>
            </div>
          )}

          {/* 6. MAINTENANCE VIEWS — restricted to Super Users and Product Owners */}
          {activeTab.startsWith("maint") && !canSeeMaintenance && (
            <div data-testid="maintenance-access-denied" className="max-w-md mx-auto text-center py-20">
              <Lock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Access Restricted</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                Maintenance is only available to Super Users and Product Owners.
              </p>
            </div>
          )}
          {activeTab.startsWith("maint") && canSeeMaintenance && (
            <div data-testid="maintenance-view" className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {activeTab === 'maint-calendar' && 'Maintenance Window Calendar'}
                  {activeTab === 'maint-windows' && 'Maintenance Windows Configuration'}
                  {activeTab === 'maint-blackout' && 'Active Blackout Periods & Freezes'}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Prevent disruptive reboots during peak business transaction hours.</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-white dark:bg-slate-950 uppercase text-[10px] font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Maintenance Window</th>
                      <th className="py-3 px-4">Schedule Pattern</th>
                      <th className="py-3 px-4">Target Scope</th>
                      <th className="py-3 px-4">Blackout Status</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 dark:divide-slate-200 dark:divide-slate-800/80">
                    {maintenanceWindows.map(mw => (
                      <tr key={mw.id} className="hover:bg-slate-200/40 dark:bg-slate-200 dark:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">{mw.name}</td>
                        <td className="py-3 px-4 font-mono text-blue-400">{mw.schedule}</td>
                        <td className="py-3 px-4">{mw.scope}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{mw.blackout}</td>
                        <td className="py-3 px-4">
                          <span className={`${badgeBaseClass} ${
                            mw.status === 'Active' ? badgeVariants.success : badgeVariants.warning
                          }`}>{mw.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. APPROVALS VIEW */}
          {activeTab === "approvals" && (
            <div data-testid="approvals-view" className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Pending Patch Approvals</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Review and authorize incoming vendor patches prior to automated deployment pipelines.</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-white dark:bg-slate-950 uppercase text-[10px] font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">CVE ID</th>
                      <th className="py-3 px-4">Vulnerability Title</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">Affected Nodes</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 dark:divide-slate-200 dark:divide-slate-800/80">
                    {patches.filter(p => p.status !== 'Approved').map(p => (
                      <tr key={p.id} className="hover:bg-slate-200/40 dark:bg-slate-200 dark:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">{p.cve}</td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">{p.title}</td>
                        <td className="py-3 px-4"><span className="text-red-400 font-bold">{p.severity}</span></td>
                        <td className="py-3 px-4 font-mono">{p.affectedCount} systems</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => approvePatch(p.id)}
                            className={buttonVariants.success}
                          >
                            Approve Patch
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. COMPLIANCE VIEWS */}
          {activeTab.startsWith("comp") && (
            <div data-testid="compliance-view" className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {activeTab === 'comp-overview' && 'Compliance Overview & Analytics'}
                  {activeTab === 'comp-sla' && 'SLA Compliance Dashboard'}
                  {activeTab === 'comp-noncompliant' && 'Non-Compliant Systems Audit'}
                  {activeTab === 'comp-exceptions' && 'Compliance Exceptions'}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">ISO 27001, SOC2, and CIS Benchmark patch compliance metrics.</p>
              </div>
            </div>
          )}

          {/* 9. VULNERABILITIES VIEW */}
          {activeTab === "vulnerabilities" && (
            <div data-testid="vulnerabilities-view" className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Vulnerability Scanner & CVE Intelligence</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Integrated National Vulnerability Database (NVD) & vendor advisory scanner.</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-white dark:bg-slate-950 uppercase text-[10px] font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">CVE ID</th>
                      <th className="py-3 px-4">Vulnerability Name</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">CVSS Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 dark:divide-slate-200 dark:divide-slate-800/80">
                    {vulnerabilities.map(v => (
                      <tr key={v.id} className="hover:bg-slate-200/40 dark:bg-slate-200 dark:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-red-400">{v.cve}</td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">{v.name}</td>
                        <td className="py-3 px-4"><span className="text-red-400 font-bold">{v.severity}</span></td>
                        <td className="py-3 px-4 font-mono font-bold">{v.cvss}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 10. REPOSITORIES VIEWS */}
          {activeTab.startsWith("repo") && (
            <div data-testid="repositories-view" className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {activeTab === 'repo-list' && 'Local Repository Mirror List'}
                  {activeTab === 'repo-sync' && 'Repository Sync Jobs'}
                  {activeTab === 'repo-snapshots' && 'Content Snapshots'}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Enterprise air-gapped and local caching mirrors for Ubuntu, RHEL, Windows WSUS, and Alpine.</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-white dark:bg-slate-950 uppercase text-[10px] font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Repository Name</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Package Count</th>
                      <th className="py-3 px-4">Storage Size</th>
                      <th className="py-3 px-4">Last Sync</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 dark:divide-slate-200 dark:divide-slate-800/80">
                    {repositories.map(r => (
                      <tr key={r.id} className="hover:bg-slate-200/40 dark:bg-slate-200 dark:bg-slate-800/40">
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">{r.name}</td>
                        <td className="py-3 px-4 font-mono text-blue-400">{r.type}</td>
                        <td className="py-3 px-4 font-mono">{r.packages.toLocaleString()} pkgs</td>
                        <td className="py-3 px-4 font-mono">{r.size}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{r.lastSync}</td>
                        <td className="py-3 px-4">
                          <span className={`${badgeBaseClass} ${
                            r.status === 'Synced' ? badgeVariants.success :
                            r.status === 'Syncing' ? `${badgeVariants.info} animate-pulse` : badgeVariants.danger
                          }`}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 11. AUTOMATION VIEWS */}
          {activeTab.startsWith("auto") && (
            <div data-testid="automation-view" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {activeTab === 'auto-templates' && 'Automation Templates'}
                    {activeTab === 'auto-scripts' && 'Pre & Post Patch Script Library'}
                    {activeTab === 'auto-health' && 'Fleet Health Checks'}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Bash, PowerShell, Python, and Ansible scripts executed during maintenance windows.</p>
                </div>
                {activeTab === 'auto-templates' && (
                  <button
                    data-testid="create-template-btn"
                    onClick={() => setShowCreateTemplateModal(true)}
                    className={buttonVariants.primaryWithIcon}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Template</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {scripts.map(scr => (
                  <div key={scr.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-semibold text-xs text-blue-400">{scr.name}</span>
                      <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[10px]">{scr.type}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">{scr.description}</p>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                      <span>Author: {scr.author}</span>
                      <button onClick={() => toast.success(`Executed script test for ${scr.name}`)} className="text-blue-400 hover:underline">Run Test</button>
                    </div>
                  </div>
                ))}
                {activeTab === 'auto-templates' && customTemplates.map(tpl => (
                  <div key={tpl.id} data-testid={`template-card-${tpl.id}`} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-semibold text-xs text-blue-400">{tpl.name}</span>
                      <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[10px]">{tpl.type}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">{tpl.description}</p>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                      <span>Author: {tpl.author}</span>
                      <button onClick={() => toast.success(`Executed script test for ${tpl.name}`)} className="text-blue-400 hover:underline">Run Test</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 12. REPORTS VIEW */}
          {activeTab === "reports" && (
            <div data-testid="reports-view" className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Audit & Compliance Reports</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Generate executive PDF/CSV compliance and patch history summaries.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">Executive Patch Summary Report</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">Complete breakdown of patched vs pending CVEs across all tenants and regions.</p>
                  <div className="flex flex-wrap gap-3">
                    <button data-testid="export-pdf-btn" onClick={handleExportPDF} className={buttonVariants.primaryWithIcon}>
                      <Download className="w-4 h-4" />
                      <span>Export PDF</span>
                    </button>
                    <button data-testid="export-excel-btn" onClick={handleExportExcel} className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2">
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>Export Excel</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">ISO 27001 Compliance Audit Export</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">Detailed audit trail of all patch approvals, exceptions, and SLA metrics.</p>
                  <button onClick={() => toast.success("Exporting Compliance CSV...")} className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2">
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Export CSV Audit Logs</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 13. ALERTS VIEW */}
          {activeTab === "alerts" && (
            <div data-testid="alerts-view" className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">System Alerts & Notifications</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Real-time alerts for failed patch runs, low disk space, and repository sync errors.</p>
              </div>

              <div className="space-y-3">
                {alerts.map(alt => (
                  <div key={alt.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg mt-0.5 ${
                        alt.severity === 'Critical' ? badgeVariants.danger : badgeVariants.warning
                      }`}>
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{alt.message}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            alt.severity === 'Critical' ? badgeVariants.danger : badgeVariants.warning
                          }`}>{alt.severity}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{alt.time} • Status: <span className="text-slate-800 dark:text-slate-200 font-medium">{alt.status}</span></p>
                      </div>
                    </div>
                    {alt.status !== 'Acknowledged' && (
                      <button
                        onClick={() => acknowledgeAlert(alt.id)}
                        className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 14. AUDIT LOGS VIEW */}
          {activeTab === "audit-logs" && (
            <div data-testid="audit-logs-view" className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Immutable Audit Logs</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Cryptographic tamper-evident record of all administrator and automation actions.</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-white dark:bg-slate-950 uppercase text-[10px] font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Action Performed</th>
                      <th className="py-3 px-4">Source IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 dark:divide-slate-200 dark:divide-slate-800/80">
                    {auditLogs.map(aud => (
                      <tr key={aud.id} className="hover:bg-slate-200/40 dark:bg-slate-200 dark:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">{aud.timestamp}</td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">{aud.user}</td>
                        <td className="py-3 px-4 text-blue-400">{aud.action}</td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">{aud.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 15. ADMINISTRATION VIEWS */}
          {activeTab.startsWith("admin") && (
            <div data-testid="administration-view" className="space-y-6">
              {activeTab === 'admin-users' && (
                <TenantUsersPanel />
              )}
              {activeTab === 'admin-settings' && isSuperUser && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Tenant Branding & Preferences
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Personalize your workspace with a logo and brand color — applied instantly across the app.
                    </p>
                  </div>
                  <BrandingSettings />
                </div>
              )}
              {activeTab !== 'admin-users' && activeTab !== 'admin-settings' && (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {activeTab === 'admin-roles' && 'Role-Based Access Control (RBAC)'}
                      {activeTab === 'admin-integrations' && 'Enterprise Integrations (Slack/PagerDuty/Jira)'}
                      {activeTab === 'admin-agent' && 'Agent Deployment & Auto-Upgrade'}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Multi-tenant isolation and security configurations.
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg max-w-xl space-y-4">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Pilot Agent Auto-Update Configuration</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Configure how Patch Pilot agents receive updates across Linux and Windows fleets.</p>
                    <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                      <span>Auto-upgrade agent version</span>
                      <span className="text-emerald-400 font-bold">Enabled (v1.0.0)</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                      <span>Heartbeat Interval</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">60 seconds</span>
                    </div>
                    <button onClick={() => toast.success("Settings saved successfully!")} className={buttonVariants.primary}>
                      Save Changes
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </main>

      {/* CREATE JOB MODAL */}
      {showCreateJobModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">Create New Patch Job</h3>
            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Patch Job Name</label>
                <select
                  data-testid="modal-job-name"
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  className={inputClass}
                  required
                >
                  {PATCH_JOB_NAME_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Select Tenant</label>
                <select
                  data-testid="modal-job-tenant"
                  value={newJobTenant}
                  onChange={(e) => setNewJobTenant(e.target.value)}
                  className={inputClass}
                >
                  {initialTenants.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Target Group</label>
                <select
                  value={newJobGroup}
                  onChange={(e) => setNewJobGroup(e.target.value)}
                  className={inputClass}
                >
                  {systemGroups.map(g => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Action</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-testid="modal-job-mode-deploy"
                    onClick={() => setNewJobMode("Deploy Patch")}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border ${
                      newJobMode === "Deploy Patch"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    Deploy Patch (Immediate)
                  </button>
                  <button
                    type="button"
                    data-testid="modal-job-mode-schedule"
                    onClick={() => setNewJobMode("Schedule")}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border ${
                      newJobMode === "Schedule"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    Schedule
                  </button>
                </div>
              </div>
              {newJobMode === "Schedule" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
                    <input
                      data-testid="modal-job-date"
                      type="date"
                      value={newJobDate}
                      onChange={(e) => setNewJobDate(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Time</label>
                    <input
                      data-testid="modal-job-time"
                      type="time"
                      value={newJobTime}
                      onChange={(e) => setNewJobTime(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Select Policy (optional)</label>
                <select
                  data-testid="modal-job-policy"
                  value={newJobPolicyId}
                  onChange={(e) => setNewJobPolicyId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">No policy</option>
                  {policies.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateJobModal(false)}
                  className={buttonVariants.secondary}
                >
                  Cancel
                </button>
                <button
                  data-testid="modal-job-submit"
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
                >
                  {newJobMode === "Schedule" ? "Schedule Job" : "Deploy Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SYSTEM MODAL */}
      {showAddSystemModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">Register New System Agent</h3>
            <form onSubmit={handleAddSystem} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Hostname / FQDN</label>
                <input
                  data-testid="modal-system-name"
                  type="text"
                  value={newSysName}
                  onChange={(e) => setNewSysName(e.target.value)}
                  placeholder="e.g., prod-us-east-app-04"
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Operating System</label>
                <select
                  value={newSysOs}
                  onChange={(e) => setNewSysOs(e.target.value)}
                  className={inputClass}
                >
                  <option value="Ubuntu 22.04 LTS">Ubuntu 22.04 LTS</option>
                  <option value="RHEL 9.2">RHEL 9.2</option>
                  <option value="Windows Server 2022">Windows Server 2022</option>
                  <option value="Debian 12">Debian 12</option>
                  <option value="Alpine Linux 3.18">Alpine Linux 3.18</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">IP Address</label>
                <input
                  type="text"
                  value={newSysIp}
                  onChange={(e) => setNewSysIp(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSystemModal(false)}
                  className={buttonVariants.secondary}
                >
                  Cancel
                </button>
                <button
                  data-testid="modal-system-submit"
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
                >
                  Register Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW GROUP MODAL */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">Create New Group</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Name of Group</label>
                <input
                  data-testid="modal-group-name"
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Edge Fleet"
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Assign Owner</label>
                <select
                  data-testid="modal-group-owner"
                  value={newGroupOwner}
                  onChange={(e) => setNewGroupOwner(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select an owner</option>
                  {groupOwnerOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Select Policy</label>
                <select
                  data-testid="modal-group-policy"
                  value={newGroupPolicy}
                  onChange={(e) => setNewGroupPolicy(e.target.value)}
                  className={inputClass}
                >
                  <option value="">No policy</option>
                  {policies.map((p: any) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Select Systems / IPs <span className="text-slate-400 font-normal">(already-assigned systems are excluded)</span>
                </label>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg max-h-48 overflow-y-auto custom-scrollbar divide-y divide-slate-200/80 dark:divide-slate-800/80">
                  {availableSystemsForGroup.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 p-3">No available (unassigned) systems.</p>
                  ) : (
                    availableSystemsForGroup.map((sys: any) => (
                      <label
                        key={sys.id}
                        data-testid={`modal-group-system-${sys.id}`}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={newGroupSystemIds.includes(sys.id)}
                          onChange={() => toggleGroupSystemId(sys.id)}
                        />
                        <span className="font-mono">{sys.name}</span>
                        <span className="text-slate-500 dark:text-slate-400 font-mono ml-auto">{sys.ip}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className={buttonVariants.secondary}
                >
                  Cancel
                </button>
                <button
                  data-testid="modal-group-submit"
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW POLICY MODAL */}
      {showCreatePolicyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">Create New Policy</h3>
            <form onSubmit={handleCreatePolicy} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Name</label>
                <input
                  data-testid="modal-policy-name"
                  type="text"
                  value={newPolicyName}
                  onChange={(e) => setNewPolicyName(e.target.value)}
                  placeholder="e.g., Edge Nodes Weekly Patch"
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
                <textarea
                  data-testid="modal-policy-description"
                  value={newPolicyDescription}
                  onChange={(e) => setNewPolicyDescription(e.target.value)}
                  placeholder="What does this policy do?"
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Status</label>
                  <select
                    data-testid="modal-policy-status"
                    value={newPolicyStatus}
                    onChange={(e) => setNewPolicyStatus(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Enabled / Disabled</label>
                  <select
                    data-testid="modal-policy-enabled"
                    value={newPolicyEnabled ? "enabled" : "disabled"}
                    onChange={(e) => setNewPolicyEnabled(e.target.value === "enabled")}
                    className={inputClass}
                  >
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Policy Lifecycle (optional)</label>
                <select
                  data-testid="modal-policy-lifecycle"
                  value={newPolicyLifecycleMonths}
                  onChange={(e) => setNewPolicyLifecycleMonths(e.target.value)}
                  className={inputClass}
                >
                  <option value="">No expiry</option>
                  <option value="1">1 month</option>
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                </select>
                {newPolicyLifecycleMonths && (
                  <p data-testid="modal-policy-expiry-preview" className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Expires {new Date(new Date().setMonth(new Date().getMonth() + Number(newPolicyLifecycleMonths))).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                    {" "}(Created On + {newPolicyLifecycleMonths} month{Number(newPolicyLifecycleMonths) > 1 ? "s" : ""}, calculated automatically)
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Created By</label>
                <input type="text" disabled value={currentUser?.name || currentUser?.email || ""} className={`${inputClass} opacity-60`} />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    data-testid="modal-policy-email-notif"
                    type="checkbox"
                    checked={newPolicyEmailNotif}
                    onChange={(e) => setNewPolicyEmailNotif(e.target.checked)}
                  />
                  Email notification
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    data-testid="modal-policy-webhook-notif"
                    type="checkbox"
                    checked={newPolicyWebhookNotif}
                    onChange={(e) => setNewPolicyWebhookNotif(e.target.checked)}
                  />
                  Webhook notification
                </label>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreatePolicyModal(false)}
                  className={buttonVariants.secondary}
                >
                  Cancel
                </button>
                <button
                  data-testid="modal-policy-submit"
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
                >
                  Create Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AFFECTED SYSTEMS NODE DIALOG */}
      {affectedSystemsPatch && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Affected Systems</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{affectedSystemsPatch.title} • {affectedSystemsPatch.affectedCount} nodes</p>
              </div>
              <button
                data-testid="affected-systems-close"
                onClick={() => setAffectedSystemsPatch(null)}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-white dark:bg-slate-950 uppercase text-[10px] font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Serial Number</th>
                    <th className="py-2.5 px-4">IP Address</th>
                  </tr>
                </thead>
              </table>
              <div className="max-h-[360px] overflow-y-auto custom-scrollbar" data-testid="affected-systems-scroll-area">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <tbody className="divide-y divide-slate-200/80 dark:divide-slate-200 dark:divide-slate-800/80">
                    {getAffectedNodes(affectedSystemsPatch).map(node => (
                      <tr key={node.serial} className="hover:bg-slate-200/40 dark:bg-slate-200 dark:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono">{node.serial}</td>
                        <td className="py-2.5 px-4 font-mono">{node.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE TEMPLATE MODAL */}
      {showCreateTemplateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">Create Automation Template</h3>
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Template Name</label>
                <input
                  data-testid="modal-template-name"
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g., pre-patch-db-backup"
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Template Type</label>
                <select
                  data-testid="modal-template-type"
                  value={newTemplateType}
                  onChange={(e) => setNewTemplateType(e.target.value as typeof newTemplateType)}
                  className={inputClass}
                >
                  <option value="Bash">Bash</option>
                  <option value="PowerShell">PowerShell</option>
                  <option value="Python">Python</option>
                  <option value="Ansible">Ansible</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
                <textarea
                  data-testid="modal-template-description"
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  placeholder="What does this template do?"
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateTemplateModal(false)}
                  className={buttonVariants.secondary}
                >
                  Cancel
                </button>
                <button
                  data-testid="modal-template-submit"
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
                >
                  Create Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
