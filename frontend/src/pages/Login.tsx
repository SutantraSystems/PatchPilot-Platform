import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { formatApiError } from "@/lib/api";

export default function Login() {
  const { login, user } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@patchpilot.io");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  if (user) {
    // handled via effect below
  }

  useEffect(() => {
    if (user) nav("/", { replace: true });
  }, [user, nav]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success("Welcome back to Patch Pilot!");
      nav("/", { replace: true });
    } catch (e: any) {
      const msg = formatApiError(e?.response?.data?.detail) || e?.message || "Login failed";
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
              Enterprise Command
            </span>
          </div>
        </div>
        <button
          data-testid="login-theme-toggle"
          onClick={toggle}
          className="w-9 h-9 rounded-lg flex items-center justify-center border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              Sign in
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6">
              Patch Pilot Patching Console
            </p>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  data-testid="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Password
                </label>
                <input
                  data-testid="login-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>

              {err && (
                <div
                  data-testid="login-error"
                  className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
                >
                  {err}
                </div>
              )}

              <button
                data-testid="login-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2 transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Sign In</span>
              </button>
            </form>

          </div>

          <p className="mt-6 text-center text-[11px] text-slate-500">
            Default admin: <span className="font-mono">admin@patchpilot.io / admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
