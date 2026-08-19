import { useState, useEffect, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Loader2, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { formatApiError } from "@/lib/api";

export default function Register() {
  const { registerTenant, user } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [form, setForm] = useState({
    tenant_name: "",
    admin_name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (user) nav("/", { replace: true });
  }, [user, nav]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await registerTenant({
        tenant_name: form.tenant_name.trim(),
        admin_name: form.admin_name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      toast.success("Workspace created! Welcome to Patch Pilot.");
      nav("/", { replace: true });
    } catch (e: any) {
      const msg =
        formatApiError(e?.response?.data?.detail) || e?.message || "Registration failed";
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col">
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight">Patch Pilot</span>
            <span className="block text-[10px] text-blue-500 dark:text-blue-400 font-medium tracking-widest uppercase">
              Patching Console
            </span>
          </div>
        </div>
        <button
          data-testid="register-theme-toggle"
          onClick={toggle}
          className="w-9 h-9 rounded-lg flex items-center justify-center border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              Create your workspace
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6">
              Spin up a new tenant + first admin in seconds
            </p>

            <form onSubmit={onSubmit} className="space-y-4">
              <Field
                testid="reg-tenant-name"
                label="Company / Tenant name"
                value={form.tenant_name}
                onChange={(v) => set("tenant_name", v)}
                placeholder="Acme MSP Inc"
                required
              />
              <Field
                testid="reg-admin-name"
                label="Your full name"
                value={form.admin_name}
                onChange={(v) => set("admin_name", v)}
                placeholder="Alex Mercer"
                required
              />
              <Field
                testid="reg-email"
                label="Work email"
                type="email"
                value={form.email}
                onChange={(v) => set("email", v)}
                placeholder="you@company.com"
                required
              />
              <Field
                testid="reg-password"
                label="Password (min 8 chars)"
                type="password"
                value={form.password}
                onChange={(v) => set("password", v)}
                placeholder="••••••••"
                required
                minLength={8}
              />

              {err && (
                <div
                  data-testid="register-error"
                  className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
                >
                  {err}
                </div>
              )}

              <button
                data-testid="register-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2 transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Create workspace</span>
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 text-xs text-center text-slate-600 dark:text-slate-400">
              Already have an account?{" "}
              <Link
                data-testid="go-to-login"
                to="/login"
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  minLength,
  testid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  testid?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
      </label>
      <input
        data-testid={testid}
        type={type}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
