import { useState } from "react";
import { Check } from "lucide-react";
import { Reveal } from "./Reveal";

const STEPS = [
  {
    id: "01",
    name: "Discover",
    copy: "Compare your profile with curated opportunities using explainable role and skill signals.",
  },
  {
    id: "02",
    name: "Tailor",
    copy: "Draft a job-specific cover letter from the profile and role details you provide, then review and edit it before using it.",
  },
  {
    id: "03",
    name: "Autofill",
    copy: "Use your saved profile to copy or populate supported application fields. Review the information and submit directly on the employer's site.",
  },
  {
    id: "04",
    name: "Track",
    copy: "Track application stages, schedule follow-ups, and practice role-specific interview questions.",
  },
];

function FindMock() {
  const lines = [
    { t: "Example", url: "curated role", n: "Role signals", hot: true },
    { t: "Example", url: "curated role", n: "Skill overlap", hot: true },
    { t: "Example", url: "curated role", n: "Profile fit", hot: true },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-[10px] font-semibold tracking-widest opacity-60">
          01 · AI DISCOVERY & MATCHING
        </p>
        <p className="mt-3 text-lg font-semibold">
          Compare profile skills with role requirements.
        </p>
        <div className="mt-5 space-y-1.5 rounded-xl bg-primary-foreground/5 p-3 font-mono text-[11px]">
          {lines.map((l) => (
            <div key={l.url} className="flex items-center justify-between gap-3">
              <span className="truncate opacity-55">
                [{l.t}] {l.url}
              </span>
              <span className={l.hot ? "shrink-0 text-accent" : "shrink-0 opacity-40"}>{l.n}</span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-accent/15 px-2 py-1.5">
            <span className="truncate">Profile signals · example role</span>
            <span className="shrink-0 font-bold text-accent">ANALYZED</span>
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
            { role: "Senior Frontend Engineer", co: "Example role", s: "Example", on: true },
            { role: "Product Engineer", co: "Example role", s: "Review fit" },
            { role: "Backend Engineer", co: "Example role", s: "Skill overlap" },
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
                {j.s}
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
        ILLUSTRATIVE DRAFT · REVIEW AND REPLACE WITH YOUR EVIDENCE
      </p>
      <div className="mt-4 space-y-1 rounded-xl border border-border bg-secondary/40 p-4 font-mono text-xs">
        {[
          { s: "-", t: "Worked on various web projects using JavaScript." },
          { s: "+", t: "Describe a project and the specific contribution you made." },
          { s: "-", t: "Helped improve performance." },
          { s: "+", t: "Add a measurable result only when you can substantiate it." },
          { s: "+", t: "Connect your evidence to a requirement in the role description." },
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
          Open employer portal
        </span>
        <span className="rounded-full border border-border px-4 py-2 text-xs font-medium">
          Edit draft
        </span>
        <span className="text-xs text-muted-foreground">Review before using</span>
      </div>
    </div>
  );
}

function ApplyMock() {
  const fields = [
    "Full name",
    "Email",
    "Phone",
    "Résumé file",
    "Cover letter",
    "Work authorization",
    "Years of experience",
    "LinkedIn",
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground">
          APPLICATION PREPARATION · EXAMPLE
        </p>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          Ready to review
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
        Review your details, then continue to the employer's application page.
      </p>
    </div>
  );
}

function TrackMock() {
  const cols = [
    { name: "Applied", items: ["Sample company A", "Sample company B"] },
    { name: "Under review", items: ["Sample company C"] },
    { name: "Interview", items: ["Sample company D"] },
    { name: "Offer", items: ["Example stage"] },
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
          Four steps to a clearer job search.
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
