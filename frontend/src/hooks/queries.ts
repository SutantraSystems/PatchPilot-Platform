import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ---------- Fetch hooks (all tenant-scoped via JWT) ---------- */
const list = (path: string) => async () => (await api.get(path)).data;

export const useSystems = () =>
  useQuery({ queryKey: ["systems"], queryFn: list("/api/systems") });
export const useSystemGroups = () =>
  useQuery({ queryKey: ["system-groups"], queryFn: list("/api/system-groups") });
export const usePatches = () =>
  useQuery({ queryKey: ["patches"], queryFn: list("/api/patches") });
export const useJobs = () =>
  useQuery({ queryKey: ["jobs"], queryFn: list("/api/jobs") });
export const useVulnerabilities = () =>
  useQuery({ queryKey: ["vulnerabilities"], queryFn: list("/api/vulnerabilities") });
export const useMaintenanceWindows = () =>
  useQuery({ queryKey: ["maintenance-windows"], queryFn: list("/api/maintenance-windows") });
export const useRepositories = () =>
  useQuery({ queryKey: ["repositories"], queryFn: list("/api/repositories") });
export const useScripts = () =>
  useQuery({ queryKey: ["scripts"], queryFn: list("/api/scripts") });
export const useAlerts = () =>
  useQuery({ queryKey: ["alerts"], queryFn: list("/api/alerts") });
export const useAuditLogs = () =>
  useQuery({ queryKey: ["audit-logs"], queryFn: list("/api/audit-logs") });
export const usePolicies = () =>
  useQuery({ queryKey: ["policies"], queryFn: list("/api/policies") });
export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: list("/api/notifications"),
    refetchInterval: 15_000,
  });
export const useDashboardStats = () =>
  useQuery({ queryKey: ["dashboard-stats"], queryFn: list("/api/dashboard/stats") });
export const useTenantUsers = () =>
  useQuery({ queryKey: ["tenant-users"], queryFn: list("/api/tenant/users") });
export const useTenant = () =>
  useQuery({ queryKey: ["tenant"], queryFn: list("/api/tenant") });

/* ---------- Mutations ---------- */
export function useCreateSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; os: string; group?: string; ip: string; status?: string }) =>
      (await api.post("/api/systems", body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string; targetGroup: string; type: string; scheduledTime?: string;
      mode?: "Deploy Patch" | "Schedule"; date?: string; time?: string;
      policyId?: string; policyName?: string;
    }) => (await api.post("/api/jobs", body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useCreateSystemGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; owner: string; policy?: string; systemIds: string[] }) =>
      (await api.post("/api/system-groups", body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-groups"] });
      qc.invalidateQueries({ queryKey: ["systems"] });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string; description?: string; status?: string; enabled?: boolean;
      expiry?: string | null; lifecycleMonths?: number | null;
      emailNotification?: boolean; webhookNotification?: boolean;
    }) => (await api.post("/api/policies", body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policies"] });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/api/notifications/${id}/read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post(`/api/notifications/read-all`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useApprovePatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/api/patches/${id}/approve`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patches"] });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; name: string; role: string }) =>
      (await api.post("/api/tenant/invite", body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-users"] });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function useRemoveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/tenant/users/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-users"] });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function useUpdateBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { logo_data_url?: string | null; brand_color?: string | null }) =>
      (await api.patch("/api/tenant/branding", body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant"] });
    },
  });
}
