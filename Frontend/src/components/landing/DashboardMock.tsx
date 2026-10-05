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

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutGrid, active: true },
  { label: "Browse jobs", icon: Search },
  { label: "Applications", icon: FileText },
  { label: "Inbox", icon: Inbox },
  { label: "Tracker", icon: Briefcase },
];

const ROLE_EXAMPLES = [
  { id: "role-1", company: "Sample company A", role: "Example role", tone: "bg-tint-amber" },
  { id: "role-2", company: "Sample company B", role: "Example role", tone: "bg-tint-green" },
  { id: "role-3", company: "Sample company C", role: "Example role", tone: "bg-tint-violet" },
  { id: "role-4", company: "Sample company D", role: "Example role", tone: "bg-tint-rose" },
];

const APPLICATION_EXAMPLES = [
  { id: "app-1", company: "Sample company A", role: "Example role", status: "To review" },
  { id: "app-2", company: "Sample company B", role: "Example role", status: "In progress" },
];

export function DashboardMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="grid lg:grid-cols-[228px_minmax(0,1fr)]">
        <aside className="hidden flex-col border-r border-border bg-secondary/50 p-4 lg:flex">
          <div className="flex items-center gap-2 px-1 pb-5">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
              J
            </span>
            <span className="text-sm font-semibold">JobPilot</span>
          </div>
          <p className="px-1 pb-2 text-[10px] font-medium tracking-widest text-muted-foreground">
            ILLUSTRATIVE PREVIEW · SAMPLE CONTENT
          </p>
          <div className="flex flex-col gap-0.5">
            {NAV_ITEMS.map(({ label, icon: Icon, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
                  active ? "bg-card font-medium shadow-soft" : "text-muted-foreground"
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-0.5">
            {[{ label: "Profile", icon: User }, { label: "Settings", icon: Settings }].map(
              ({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground"
                >
                  <Icon size={15} className="shrink-0" />
                  {label}
                </div>
              ),
            )}
          </div>
          <div className="mt-auto flex items-center gap-2.5 rounded-xl bg-primary px-3 py-2.5 text-primary-foreground">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-foreground/15 text-[10px] font-semibold">
              CP
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Candidate profile</p>
              <p className="truncate text-[10px] opacity-70">Profile settings</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 p-4 sm:p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-4">
              <h3 className="shrink-0 text-base font-semibold">Dashboard</h3>
              <div className="hidden min-w-0 flex-1 items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs text-muted-foreground sm:flex">
                <Search size={13} className="shrink-0" />
                <span className="truncate">Search applications…</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
              <Bell size={16} />
              <HelpCircle size={16} />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm font-semibold">Role fit examples</p>
            <span className="text-xs text-muted-foreground">Browse curated roles</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ROLE_EXAMPLES.map((role) => (
              <div key={role.id} className="rounded-xl border border-border p-1">
                <div className={`rounded-lg p-3.5 ${role.tone}`}>
                  <p className="truncate text-[11px] text-foreground/55">{role.company}</p>
                  <p className="mt-1 truncate text-sm font-semibold">{role.role}</p>
                  <p className="mt-3 text-xs text-muted-foreground">Profile fit analysis</p>
                </div>
                <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <span className="truncate text-xs text-muted-foreground">Review role</span>
                  <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                    Details
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm font-semibold">Application tracking examples</p>
            <span className="rounded-full border border-border px-3 py-1 text-[11px]">Open tracker</span>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_1.2fr_1fr] gap-3 bg-secondary/60 px-4 py-2.5 text-[10px] font-medium tracking-wider text-muted-foreground sm:grid">
              <span>POSITION</span>
              <span>PROFILE</span>
              <span>MATERIALS</span>
              <span>STATUS</span>
              <span className="text-right">DATE</span>
            </div>
            {APPLICATION_EXAMPLES.map((application) => (
              <div
                key={application.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-4 py-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_1.2fr_1fr]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{application.company}</p>
                  <p className="truncate text-xs text-muted-foreground">{application.role}</p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">Saved profile</span>
                <span className="hidden text-xs text-muted-foreground sm:block">Draft materials</span>
                <span className="text-xs text-muted-foreground">{application.status}</span>
                <span className="hidden text-right text-xs text-muted-foreground sm:block">Example</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
