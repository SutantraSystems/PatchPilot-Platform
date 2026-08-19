import { useState, useRef, useEffect } from "react";
import type React from "react";
import { Bell, ShieldCheck, PlayCircle, Lock, Server, CheckCheck, CalendarClock } from "lucide-react";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/queries";
import { initialNotifications } from "../mock";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  related_id?: string | null;
  read: boolean;
  timestamp: string;
};

type UpcomingJob = {
  id: string;
  name: string;
  scheduledTime: string;
  status: string;
};

const TYPE_ICON: Record<string, React.ReactElement> = {
  patch: <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />,
  job: <PlayCircle className="w-3.5 h-3.5 text-amber-400" />,
  policy: <Lock className="w-3.5 h-3.5 text-purple-400" />,
  system_group: <Server className="w-3.5 h-3.5 text-emerald-400" />,
};

function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Centralized notification bell — reuses the existing header icon / dropdown
 * pattern (see UserMenu) and the single notifications data source from the
 * backend (falls back to initialNotifications while loading).
 */
export function NotificationBell({ upcoming = [] as UpcomingJob[] }: { upcoming?: UpcomingJob[] }) {
  const { data: notifications = initialNotifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unreadCount = notifications.filter((n: NotificationItem) => !n.read).length;

  return (
    <div ref={ref} className="relative">
      <button
        data-testid="notification-bell-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        title="Notifications"
        className="relative w-9 h-9 rounded-lg flex items-center justify-center border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notification-panel"
          className="absolute right-0 top-full mt-2 w-96 max-h-[28rem] flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-hidden"
        >
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</h3>
            {unreadCount > 0 && (
              <button
                data-testid="notification-mark-all-read"
                onClick={() => markAllRead.mutate()}
                className="text-[11px] text-blue-500 hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          {upcoming.length > 0 && (
            <div className="border-b border-slate-200 dark:border-slate-800 p-3 space-y-2 bg-blue-500/5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <CalendarClock className="w-3 h-3" /> Upcoming Scheduled Activity
              </p>
              {upcoming.slice(0, 4).map((j) => (
                <div key={j.id} className="text-xs flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300 truncate pr-2">{j.name}</span>
                  <span className="text-slate-500 dark:text-slate-400 shrink-0">{j.scheduledTime}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-200/80 dark:divide-slate-800/80">
            {notifications.length === 0 ? (
              <div data-testid="notification-empty-state" className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                You&apos;re all caught up — no notifications yet.
              </div>
            ) : (
              notifications.map((n: NotificationItem) => (
                <button
                  key={n.id}
                  data-testid={`notification-item-${n.id}`}
                  onClick={() => !n.read && markRead.mutate(n.id)}
                  className={`w-full text-left p-3 flex items-start gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors ${
                    !n.read ? "bg-blue-500/5" : ""
                  }`}
                >
                  <div className="mt-0.5">{TYPE_ICON[n.type] || <Bell className="w-3.5 h-3.5 text-slate-400" />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{n.title}</p>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{timeAgo(n.timestamp)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
