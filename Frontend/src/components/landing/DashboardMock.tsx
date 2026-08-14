import {
  Bell,
  Briefcase,
  FileText,
  HelpCircle,
  Inbox,
  LayoutGrid,
  Search,
  Settings,
  User,
} from "lucide-react";
import { MatchBadge } from "./MatchBadge";

const SIDEBAR = [
  { label: "Dashboard", icon: LayoutGrid, active: true },
  { label: "Browse jobs", icon: Search },
  { label: "Applications", icon: FileText, count: "47" },
  { label: "Inbox", icon: Inbox, count: "3" },
  { label: "Tracker", icon: Briefcase },
];

const SIDEBAR_2 = [
  { label: "Profile", icon: User },
  { label: "Settings", icon: Settings },
];

const MATCHES = [
  { company: "Rocket Companies", role: "Software Developer II", score: 71, tone: "amber" },
  { company: "Stripe", role: "Software Engineer", score: 60, tone: "green" },
  { company: "Vercel", role: "Backend Developer I", score: 64, tone: "violet" },
  { company: "Notion", role: "Software Engineer", score: 58, tone: "rose" },
] as const;

const TONES: Record<string, string> = {
  amber: "bg-tint-amber",
  green: "bg-tint-green",
  violet: "bg-tint-violet",
  rose: "bg-tint-rose",
};

const ROWS = [
  { company: "Blue Origin", role: "Software Development Engineer II", resume: "Ready", cover: "Ready", status: "Submitted", tone: "green", when: "2 days ago" },
  { company: "Linktree", role: "Software Engineer, Backend", resume: "Default", cover: "Off", status: "Submitted", tone: "green", when: "2 days ago" },
  { company: "Atlassian", role: "Senior Frontend Engineer", resume: "Ready", cover: "Ready", status: "Tailoring résumé", tone: "blue", when: "just now" },
  { company: "Dremio", role: "Software Engineer, Platform", resume: "Default", cover: "Off", status: "Needs you", tone: "rose", when: "1 day ago" },
  { company: "Astronomer", role: "Member of Technical Staff", resume: "Default", cover: "Off", status: "Queued", tone: "amber", when: "3 hours ago" },
];

const DOT: Record<string, string> = {
  green: "bg-emerald-500",
  blue: "bg-sky-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
};

export function DashboardMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="grid lg:grid-cols-[228px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="hidden flex-col border-r border-border bg-secondary/50 p-4 lg:flex">
          <div className="flex items-center gap-2 px-1 pb-5">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
              J
            </span>
            <span className="text-sm font-semibold">jobpilot</span>
          </div>
          <p className="px-1 pb-2 text-[10px] font-medium tracking-widest text-muted-foreground">
            DASHBOARD
          </p>
          <div className="flex flex-col gap-0.5">
            {SIDEBAR.map(({ label, icon: Icon, count, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
                  active ? "bg-card font-medium shadow-soft" : "text-muted-foreground"
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {count && (
                  <span className="rounded-full bg-secondary px-1.5 text-[10px] text-muted-foreground">
                    {count}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-0.5">
            {SIDEBAR_2.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground"
              >
                <Icon size={15} className="shrink-0" />
                {label}
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center gap-2.5 rounded-xl bg-primary px-3 py-2.5 text-primary-foreground">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-foreground/15 text-[10px] font-semibold">
              AM
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Alex Morgan</p>
              <p className="truncate text-[10px] opacity-70">500 credits</p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 p-4 sm:p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-4">
              <h3 className="shrink-0 text-base font-semibold">Dashboard</h3>
              <div className="hidden min-w-0 flex-1 items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs text-muted-foreground sm:flex">
                <Search size={13} className="shrink-0" />
                <span className="truncate">Search by title, company…</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
              <Bell size={16} />
              <HelpCircle size={16} />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm font-semibold">Top job matches</p>
            <span className="text-xs text-muted-foreground">Browse jobs ›</span>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {MATCHES.map((m) => (
              <div key={m.company} className="rounded-xl border border-border p-1">
                <div className={`rounded-lg p-3.5 ${TONES[m.tone]}`}>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] text-foreground/55">{m.company}</p>
                      <p className="mt-1 truncate text-sm font-semibold">{m.role}</p>
                    </div>
                    <MatchBadge score={m.score} />
                  </div>
                  <div className="h-8" />
                </div>
                <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <span className="truncate text-xs text-muted-foreground">{m.company}</span>
                  <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                    Apply
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm font-semibold">All applications</p>
            <div className="flex gap-2">
              <span className="rounded-full border border-border px-3 py-1 text-[11px]">
                Open tracker
              </span>
              <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                Submit all
              </span>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_1.2fr_1fr] gap-3 bg-secondary/60 px-4 py-2.5 text-[10px] font-medium tracking-wider text-muted-foreground sm:grid">
              <span>POSITION</span>
              <span>RÉSUMÉ</span>
              <span>COVER LETTER</span>
              <span>STATUS</span>
              <span className="text-right">APPLIED</span>
            </div>
            {ROWS.map((r) => (
              <div
                key={r.company}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-4 py-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_1.2fr_1fr]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.company}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.role}</p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">{r.resume}</span>
                <span className="hidden text-xs text-muted-foreground sm:block">{r.cover}</span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[r.tone]}`} />
                  <span className="truncate">{r.status}</span>
                </span>
                <span className="hidden text-right text-xs text-muted-foreground sm:block">
                  {r.when}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
