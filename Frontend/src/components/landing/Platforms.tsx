import { Globe, MessageSquare, Puzzle, Terminal } from "lucide-react";
import { Reveal } from "./Reveal";

function WebMock() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="h-3.5 w-3.5 rounded-[4px] bg-primary" /> jobpilot dashboard
        </span>
        <span className="text-xs text-muted-foreground">47 active</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { c: "Stripe", m: "94%", t: "bg-tint-amber" },
          { c: "Anthropic", m: "91%", t: "bg-tint-green" },
          { c: "Linear", m: "88%", t: "bg-tint-violet" },
        ].map((x) => (
          <div key={x.c} className={`rounded-lg p-3 ${x.t}`}>
            <p className="truncate text-[11px] text-foreground/55">{x.c}</p>
            <p className="mt-1 text-sm font-semibold">{x.m} match</p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {["Vercel", "Notion", "Figma"].map((c) => (
          <div key={c} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded bg-secondary" />
              {c}
            </span>
            <span className="text-xs text-emerald-600">submitted</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageMock() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <p className="border-b border-border pb-3 text-center text-xs text-muted-foreground">
        JobPilot · iMessage
      </p>
      <div className="mt-4 space-y-3">
        <p className="max-w-[85%] rounded-2xl bg-secondary px-3.5 py-2.5 text-sm">
          New match: Senior Frontend at Stripe — 94%. Apply?
        </p>
        <p className="ml-auto w-fit rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-white">
          yes
        </p>
        <p className="max-w-[85%] rounded-2xl bg-secondary px-3.5 py-2.5 text-sm">
          ✓ Submitted. You're applicant #4 of 312.
        </p>
      </div>
    </div>
  );
}

function ChromeMock() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 truncate">boards.greenhouse.io/stripe/jobs/5521</span>
      </div>
      <div className="mt-4 rounded-xl border border-border p-3.5">
        <p className="text-sm font-semibold">Autofill this application?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          18 fields detected · tailored résumé ready
        </p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-primary-foreground">
            Fill &amp; submit
          </span>
          <span className="rounded-full border border-border px-3.5 py-1.5 text-[11px]">
            Review
          </span>
        </div>
      </div>
    </div>
  );
}

function CliMock() {
  return (
    <div className="rounded-xl bg-primary p-4 font-mono text-xs text-primary-foreground shadow-soft">
      <p className="opacity-50">{'$ jobpilot apply --match ">90"'}</p>
      <p className="mt-2 opacity-80">→ 6 roles above threshold</p>
      <p className="opacity-80">→ tailoring résumés… done</p>
      <p className="mt-2 text-accent">✓ 6 submitted · 0 failed</p>
      <p className="mt-3 opacity-50">$ jobpilot mcp serve</p>
      <p className="opacity-80">listening on stdio · 12 tools exposed</p>
    </div>
  );
}

const CARDS = [
  {
    n: "01",
    tag: "web",
    icon: Globe,
    title: "Apply on the web.",
    copy: "Discovery feed, application queue, recruiter inbox — every surface of JobPilot in one place, on any browser.",
    link: "Open dashboard",
    mock: <WebMock />,
  },
  {
    n: "02",
    tag: "imessage",
    icon: MessageSquare,
    title: "Apply over iMessage.",
    copy: "JobPilot texts you when a match drops. Reply yes; the application happens in the background and you get the receipt.",
    link: "See messaging",
    mock: <MessageMock />,
  },
  {
    n: "03",
    tag: "chrome",
    icon: Puzzle,
    title: "Autofill anywhere.",
    copy: "Found a role yourself? The extension fills the form on any ATS with your tailored résumé in one click.",
    link: "Get the extension",
    mock: <ChromeMock />,
  },
  {
    n: "04",
    tag: "mcp / cli",
    icon: Terminal,
    title: "Drive it from code.",
    copy: "A typed CLI and an MCP server, so Claude, Codex or your own scripts can run the whole pipeline.",
    link: "Read the docs",
    mock: <CliMock />,
  },
];

export function Platforms() {
  return (
    <section
      id="platforms"
      className="scroll-mt-20 border-y border-border bg-secondary/40 py-24"
    >
      <div className="mx-auto max-w-7xl px-5">
        <Reveal>
          <p className="text-sm text-muted-foreground">Wherever you work.</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            One agent. Any screen.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-x-12 gap-y-14 md:grid-cols-2">
          {CARDS.map((c, i) => (
            <Reveal key={c.tag} delay={i * 70}>
              <div className="flex h-full flex-col border-t border-border pt-6">
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <c.icon size={14} className="shrink-0" />
                  {c.n} — {c.tag}
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">{c.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {c.copy}
                </p>
                <div className="mt-6">{c.mock}</div>
                <a
                  href="#how-it-works"
                  className="mt-5 inline-block w-fit border-b border-foreground pb-0.5 text-sm font-medium"
                >
                  {c.link} →
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
