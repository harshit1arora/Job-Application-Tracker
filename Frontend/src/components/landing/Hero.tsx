import { Link } from "@tanstack/react-router";
import { Reveal } from "./Reveal";
import { DashboardMock } from "./DashboardMock";

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
          Apply to tech jobs faster with AI résumé autofill & tracking.
        </h1>
      </Reveal>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <Reveal delay={120}>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            JobPilot parses your résumé, matches top opportunities with AI compatibility scores, auto-fills application details with persistent memory across applications, and tracks your entire interview pipeline in one unified dashboard.
          </p>
        </Reveal>

        <Reveal delay={180} className="lg:text-right">
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <Link
              to="/signup"
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Get started
            </Link>
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


      <Reveal delay={260}>
        <div className="mt-14">
          <DashboardMock />
        </div>
      </Reveal>
    </section>
  );
}
