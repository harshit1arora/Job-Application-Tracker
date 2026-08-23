import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { type UserProfile, getProfile } from "@/lib/profile";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Search,
  FileText,
  Inbox,
  Calendar,
  User,
  Settings,
  ArrowLeft,
  LogOut,
  Sparkles,
  Globe,
} from "lucide-react";

interface DashboardSidebarProps {
  applicationsCount?: number;
  inboxCount?: number;
}

export function DashboardSidebar({
  applicationsCount = 47,
  inboxCount = 3,
}: DashboardSidebarProps) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Get current pathname to highlight active link
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  useEffect(() => {
    if (user?.id) {
      setProfile(getProfile(user.id));
    }
  }, [user?.id]);

  const userName = profile?.fullName || user?.name || user?.email || "User";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  return (
    <aside className="w-full md:w-64 bg-white dark:bg-[#111622] border-r border-border/80 p-5 flex flex-col justify-between shrink-0 shadow-xs z-30 min-h-screen">
      <div>
        {/* Back to Website Button */}
        <div className="mb-5 pb-4 border-b border-border/60">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/60 px-3 py-2 rounded-xl transition-all w-full group"
          >
            <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform text-primary" />
            <span>Back to Website</span>
          </Link>
        </div>

        {/* Category Header */}
        <div className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase px-3 mb-3">
          DASHBOARD
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1 text-sm font-medium">
          <Link
            to="/dashboard"
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
              currentPath === "/dashboard"
                ? "bg-[#f1f3f7] dark:bg-secondary font-bold text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard size={18} className={currentPath === "/dashboard" ? "text-foreground" : "text-muted-foreground"} />
              <span>Dashboard</span>
            </div>
          </Link>

          <Link
            to="/browse"
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
              currentPath.startsWith("/browse")
                ? "bg-[#f1f3f7] dark:bg-secondary font-bold text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <Search size={18} className={currentPath.startsWith("/browse") ? "text-foreground" : "text-muted-foreground"} />
              <span>Browse jobs</span>
            </div>
          </Link>

          <Link
            to="/applications"
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
              currentPath.startsWith("/applications") && currentPath !== "/applications/$applicationId"
                ? "bg-[#f1f3f7] dark:bg-secondary font-bold text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <FileText size={18} className={currentPath.startsWith("/applications") ? "text-foreground" : "text-muted-foreground"} />
              <span>Applications</span>
            </div>
            <span className="text-xs text-muted-foreground font-semibold">
              {applicationsCount}
            </span>
          </Link>

          <Link
            to="/inbox"
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
              currentPath === "/inbox"
                ? "bg-[#f1f3f7] dark:bg-secondary font-bold text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <Inbox size={18} className={currentPath === "/inbox" ? "text-foreground" : "text-muted-foreground"} />
              <span>Inbox</span>
            </div>
            <span className="text-xs text-muted-foreground font-semibold">
              {inboxCount}
            </span>
          </Link>

          <Link
            to="/tracker"
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
              currentPath === "/tracker"
                ? "bg-[#f1f3f7] dark:bg-secondary font-bold text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <Calendar size={18} className={currentPath === "/tracker" ? "text-foreground" : "text-muted-foreground"} />
              <span>Tracker</span>
            </div>
          </Link>

          <div className="pt-4 mt-4 border-t border-border/60 space-y-1">
            <Link
              to="/profile"
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                currentPath === "/profile"
                  ? "bg-[#f1f3f7] dark:bg-secondary font-bold text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <User size={18} className={currentPath === "/profile" ? "text-foreground" : "text-muted-foreground"} />
              <span>Profile & Résumé</span>
            </Link>

            <Link
              to="/settings"
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                currentPath === "/settings"
                  ? "bg-[#f1f3f7] dark:bg-secondary font-bold text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <Settings size={18} className={currentPath === "/settings" ? "text-foreground" : "text-muted-foreground"} />
              <span>Settings</span>
            </Link>
          </div>
        </nav>
      </div>

      {/* Bottom User Pill */}
      <div className="pt-6 mt-auto">
        <div className="p-3 bg-[#0d131f] dark:bg-[#080d14] text-white rounded-2xl flex items-center justify-between shadow-lg shadow-black/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-full bg-[#1e293b] text-white font-bold text-xs flex items-center justify-center shrink-0 border border-white/10">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate leading-tight">
                {userName}
              </p>
              <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">
                500 credits
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Log out"
            className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
