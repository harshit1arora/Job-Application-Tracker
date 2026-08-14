import { MessageSquare, Puzzle, Sparkles, Terminal, Phone } from "lucide-react";
import { Reveal } from "./Reveal";
import { DashboardMock } from "./DashboardMock";

const CHANNELS = [
  { label: "iMessage", icon: MessageSquare },
  { label: "WhatsApp", icon: Phone },
  { label: "Claude", icon: Sparkles },
  { label: "Codex", icon: Terminal },
  { label: "Extension", icon: Puzzle },
];

export function Hero() {
  return (
    <section id="top" className="mx-auto max-w-7xl px-5 pt-16 pb-10 sm:pt-24">
      <Reveal>
        <span className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-muted-foreground shadow-soft">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Autonomous AI Job Application Tracker
        </span>
      </Reveal>

      <Reveal delay={60}>
        <h1 className="mt-8 max-w-4xl text-[2.6rem] leading-[1.03] font-semibold tracking-[-0.03em] sm:text-6xl">
          Be the first to apply to every job that fits you. Hands off.
        </h1>
      </Reveal>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <Reveal delay={120}>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            JobPilot watches 50,000+ career pages across Workday, Greenhouse, Lever, Ashby and 15+
            more ATSes, and submits a tailored résumé the moment a fitting role goes up. Hundreds of
            applications a week.
          </p>
        </Reveal>

        <Reveal delay={180} className="lg:text-right">
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <a
              href="#how-it-works"
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Get started
            </a>
            <a
              href="#how-it-works"
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              See how it works
            </a>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Free to start. No card required.</p>
        </Reveal>
      </div>

      <Reveal delay={220}>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <span>Also available on</span>
          {CHANNELS.map(({ label, icon: Icon }) => (
            <a
              key={label}
              href="#platforms"
              className="inline-flex items-center gap-2 text-foreground/75 transition-colors hover:text-foreground"
            >
              <Icon size={15} className="shrink-0" />
              {label}
            </a>
          ))}
        </div>
      </Reveal>

      <Reveal delay={260}>
        <div className="mt-14">
          <DashboardMock />
        </div>
      </Reveal>
    </section>
  );
}
