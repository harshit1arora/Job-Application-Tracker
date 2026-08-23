import { useState } from "react";
import { Check } from "lucide-react";
import { Reveal } from "./Reveal";
import { MatchBadge } from "./MatchBadge";

const STEPS = [
  {
    id: "01",
    name: "Find",
    copy: "JobPilot watches 50,000+ company career pages. The moment a role drops that fits your résumé, you know — and you're already in the top 100 applicants.",
  },
  {
    id: "02",
    name: "Prep",
    copy: "Every application gets a résumé rewritten against the actual job description. You see the diff before anything leaves your account.",
  },
  {
    id: "03",
    name: "Apply",
    copy: "Workday, Greenhouse, Lever, Ashby — the agent fills every field, uploads the file, answers the screeners and submits. You get the receipt.",
  },
  {
    id: "04",
    name: "Track",
    copy: "Replies get routed and statuses update themselves. One board for every application, no spreadsheet to maintain.",
  },
];

function FindMock() {
  const lines = [
    { t: "22:29:45", url: "datadoghq.com/careers", n: "+1 new", hot: true },
    { t: "22:29:46", url: "ramp.com/careers", n: "0 new" },
    { t: "22:29:48", url: "figma.com/careers", n: "0 new" },
    { t: "22:29:49", url: "openai.com/careers", n: "+3 new", hot: true },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-[10px] font-semibold tracking-widest opacity-60">
          01 · FIND → HEAD START
        </p>
        <p className="mt-3 text-lg font-semibold">
          50,000 pages watched. The role finds you. You apply first.
        </p>
        <div className="mt-5 space-y-1.5 rounded-xl bg-primary-foreground/5 p-3 font-mono text-[11px]">
          {lines.map((l) => (
            <div key={l.url} className="flex items-center justify-between gap-3">
              <span className="truncate opacity-55">
                [{l.t}] scanning {l.url}…
              </span>
              <span className={l.hot ? "shrink-0 text-accent" : "shrink-0 opacity-40"}>{l.n}</span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-accent/15 px-2 py-1.5">
            <span className="truncate">● stripe.com/jobs · Senior Frontend Engineer</span>
            <span className="shrink-0 font-bold text-accent">MATCH 92%</span>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground">
          02 · QUALITY
        </p>
        <p className="mt-3 text-lg font-semibold">Matched to your résumé</p>
        <div className="mt-5 space-y-2">
          {[
            { role: "Senior Frontend Engineer", co: "Stripe", s: 92, on: true },
            { role: "React Developer (intern)", co: "Acme HR", s: 31 },
            { role: "Lead .NET Engineer", co: "Nimbus", s: 18 },
            { role: "Java Backend, on-site", co: "Zypher", s: 24 },
          ].map((j) => (
            <div
              key={j.role}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${
                j.on ? "bg-tint-amber" : "bg-secondary/60"
              }`}
            >
              <div className="min-w-0">
                <p
                  className={`truncate text-sm font-medium ${j.on ? "" : "text-muted-foreground line-through"}`}
                >
                  {j.role}
                </p>
                <p className="truncate text-xs text-muted-foreground">{j.co}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  j.on ? "bg-card text-emerald-600" : "text-muted-foreground"
                }`}
              >
                {j.s}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PrepMock() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <p className="text-[10px] font-semibold tracking-widest text-muted-foreground">
        RÉSUMÉ DIFF · SENIOR FRONTEND ENGINEER
      </p>
      <div className="mt-4 space-y-1 rounded-xl border border-border bg-secondary/40 p-4 font-mono text-xs">
        {[
          { s: "-", t: "Worked on various web projects using JavaScript." },
          { s: "+", t: "Shipped a React + TypeScript design system used by 40 engineers." },
          { s: "-", t: "Helped improve performance." },
          { s: "+", t: "Cut LCP from 4.1s → 1.2s across 12 revenue pages." },
          { s: "+", t: "Owned payment checkout UI — matches Stripe JD line 3." },
        ].map((l) => (
          <p
            key={l.t}
            className={`truncate rounded px-2 py-1 ${
              l.s === "+" ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"
            }`}
          >
            {l.s} {l.t}
          </p>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          Approve &amp; send
        </span>
        <span className="rounded-full border border-border px-4 py-2 text-xs font-medium">
          Edit draft
        </span>
        <span className="text-xs text-muted-foreground">Auto-approves in 30 min</span>
      </div>
    </div>
  );
}

function ApplyMock() {
  const fields = [
    "Full name",
    "Email",
    "Phone",
    "Résumé (tailored)",
    "Cover letter",
    "Work authorization",
    "Years of experience",
    "LinkedIn",
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground">
          GREENHOUSE · SUBMISSION RECEIPT
        </p>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          Submitted
        </span>
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f} className="flex items-center gap-2 text-sm">
            <Check size={14} className="shrink-0 text-emerald-600" />
            <span className="truncate text-muted-foreground">{f}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-border pt-3 font-mono text-xs text-muted-foreground">
        8 of 8 fields · 0 skipped · applicant #4 of 312
      </p>
    </div>
  );
}

function TrackMock() {
  const cols = [
    { name: "Applied", items: ["Vercel", "Notion", "Figma"] },
    { name: "Viewed", items: ["Stripe", "Linear"] },
    { name: "Replied", items: ["Atlassian"] },
    { name: "Interview", items: ["Blue Origin"] },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cols.map((c) => (
        <div key={c.name} className="rounded-2xl border border-border bg-secondary/40 p-3">
          <p className="px-1 pb-2 text-xs font-semibold text-muted-foreground">
            {c.name} · {c.items.length}
          </p>
          <div className="space-y-2">
            {c.items.map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3 shadow-soft">
                <p className="truncate text-sm font-medium">{i}</p>
                <p className="truncate text-xs text-muted-foreground">Software Engineer</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const step = STEPS[active]!;

  return (
    <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24">
      <Reveal>
        <h2 className="max-w-2xl text-4xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-5xl">
          Four stages. One agent. Zero spreadsheets.
        </h2>
      </Reveal>

      <Reveal delay={80}>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActive(i)}
              className={`inline-flex items-center gap-2.5 rounded-full border px-5 py-2.5 text-sm transition-colors ${
                i === active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              <span className="text-xs opacity-60">{s.id}</span>
              <span className="font-medium">{s.name}</span>
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal delay={120}>
        <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {step.copy}
        </p>
      </Reveal>

      <div key={active} className="mt-8 animate-fade-in">
        {active === 0 && <FindMock />}
        {active === 1 && <PrepMock />}
        {active === 2 && <ApplyMock />}
        {active === 3 && <TrackMock />}
      </div>
    </section>
  );
}
