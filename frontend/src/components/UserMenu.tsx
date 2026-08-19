import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon, Building2, ShieldCheck, ChevronDown, Sun, Moon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

export function UserMenu() {
  const { user, tenant, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;

  const initials = (user.name || user.email)
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    logout();
    setOpen(false);
    nav("/login", { replace: true });
  };

  return (
    <div ref={ref} className="relative">
      <button
        data-testid="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center space-x-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-xs text-white">
          {initials}
        </div>
        <div className="text-xs text-left hidden md:block">
          <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">
            {user.name}
          </p>
          <p className="text-slate-600 dark:text-slate-400 leading-tight">{user.role}</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
      </button>

      {open && (
        <div
          data-testid="user-menu-dropdown"
          className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-sm text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  data-testid="user-menu-name"
                  className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate"
                >
                  {user.name}
                </p>
                <p
                  data-testid="user-menu-email"
                  className="text-xs text-slate-600 dark:text-slate-400 truncate"
                >
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60">
              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                <Building2 className="w-3.5 h-3.5" />
                <span>Tenant</span>
              </div>
              <span
                data-testid="user-menu-tenant"
                className="font-medium text-slate-800 dark:text-slate-200"
              >
                {tenant?.name || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60">
              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Role</span>
              </div>
              <span
                data-testid="user-menu-role"
                className="font-medium text-slate-800 dark:text-slate-200"
              >
                {user.role}
              </span>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60">
              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                <UserIcon className="w-3.5 h-3.5" />
                <span>Plan</span>
              </div>
              <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">
                {tenant?.plan || "trial"}
              </span>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800/60">
              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>Theme</span>
              </div>
              <button
                data-testid="theme-toggle-btn"
                onClick={toggle}
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                className="font-medium text-slate-800 dark:text-slate-200 hover:underline"
              >
                {isDark ? "Dark" : "Light"}
              </button>
            </div>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-200 dark:border-slate-800 p-2">
            <button
              data-testid="user-menu-logout"
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
