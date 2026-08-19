/**
 * Centralized UI styling tokens.
 *
 * This is the single shared location for PatchPilot's reusable colors, button
 * variants, and other repeated visual classes so that future global styling
 * changes (e.g. swapping the accent color) can be made in one place instead
 * of hunting through every component. It layers on top of the existing
 * Tailwind / CSS-variable design system (see index.css + tailwind.config.cjs)
 * rather than introducing a new styling mechanism.
 */

/* ---------------------------------------------------------------------- */
/*  Buttons                                                                */
/* ---------------------------------------------------------------------- */

export const buttonVariants = {
  primary:
    "bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold",
  primaryWithIcon:
    "bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2",
  secondary:
    "px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold",
  danger:
    "bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-semibold",
  success:
    "bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-semibold",
};

/* ---------------------------------------------------------------------- */
/*  Status / severity badges                                              */
/* ---------------------------------------------------------------------- */

export const badgeVariants = {
  success: "bg-emerald-500/20 text-emerald-400",
  warning: "bg-amber-500/20 text-amber-400",
  danger: "bg-red-500/20 text-red-400",
  dangerOutline: "bg-red-500/20 text-red-400 border border-red-500/30",
  neutral: "bg-slate-200 dark:bg-slate-800 text-slate-500",
  info: "bg-blue-500/20 text-blue-400",
};

export const badgeBaseClass = "px-2 py-0.5 rounded text-[10px] font-bold";

/* ---------------------------------------------------------------------- */
/*  Sidebar navigation                                                     */
/* ---------------------------------------------------------------------- */

const NAV_TOP_ACTIVE = "bg-blue-600/15 text-blue-400 border border-blue-500/30";
const NAV_TOP_INACTIVE =
  "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:bg-slate-200 dark:bg-slate-800/60 hover:text-slate-800 dark:text-slate-200";

/** Top-level sidebar item (Dashboard, Policies, Vulnerabilities, Reports, Alerts, Audit Logs...). */
export function topNavClass(isActive: boolean) {
  return `w-full flex items-center px-3 py-2.5 rounded-lg font-medium transition-all ${
    isActive ? NAV_TOP_ACTIVE : NAV_TOP_INACTIVE
  }`;
}

const NAV_SUB_ACTIVE = "text-blue-400 font-semibold bg-blue-500/10";
const NAV_SUB_INACTIVE =
  "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200";

/** Indented sub-menu item inside a sidebar dropdown section. */
export function subNavClass(isActive: boolean) {
  return `w-full text-left py-1.5 px-2 rounded ${isActive ? NAV_SUB_ACTIVE : NAV_SUB_INACTIVE}`;
}

/** Sidebar dropdown group toggle (Systems, Patches, Patch Jobs, ...). */
export const navDropdownToggleClass =
  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:bg-slate-200 dark:bg-slate-800/60 hover:text-slate-800 dark:text-slate-200 transition-all";

/* ---------------------------------------------------------------------- */
/*  Form inputs                                                            */
/* ---------------------------------------------------------------------- */

export const inputClass =
  "w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500";
