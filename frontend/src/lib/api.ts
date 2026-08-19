import axios, { AxiosError } from "axios";

const BASE_URL =
  import.meta.env.REACT_APP_BACKEND_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

// On 401, drop token so ProtectedRoute redirects
api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname;
      if (!path.startsWith("/login") && !path.startsWith("/register")) {
        localStorage.removeItem("pp-token");
        setAuthToken(null);
      }
    }
    return Promise.reject(err);
  }
);

export function formatApiError(detail: unknown): string {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e: any) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  }
  if (typeof (detail as any).msg === "string") return (detail as any).msg;
  return String(detail);
}
