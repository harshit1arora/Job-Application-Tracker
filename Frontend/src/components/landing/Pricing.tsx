import { useState } from "react";
import { Check } from "lucide-react";
import { Reveal } from "./Reveal";

const CYCLES = [
  { id: "monthly", label: "Monthly", mult: 1, note: "" },
  { id: "quarterly", label: "Quarterly", mult: 0.9, note: "-10%" },
  { id: "annual", label: "Annual", mult: 0.75, note: "-25%" },
] as const;

const PLANS = [
  {
    name: "Starter",
    price: 29,
    tagline: "Test the agent on a real search.",
    apps: "100 applications per 30-day cycle",
    features: ["Résumé tailoring", "Web + extension", "Email support"],
    popular: false,
  },
  {
    name: "Pro",
    price: 69,
    tagline: "For an active, full-time search.",
    apps: "400 applications per 30-day cycle",
    features: ["Everything in Starter", "iMessage + WhatsApp agent", "Cover letters", "Priority queue"],
    popular: true,
  },
  {
    name: "Power",
    price: 149,
    tagline: "Maximum coverage, every ATS.",
    apps: "1,200 applications per 30-day cycle",
    features: ["Everything in Pro", "MCP + CLI access", "Recruiter inbox routing", "Founder support"],
    popular: false,
  },
];

export function Pricing() {
  const [cycle, setCycle] = useState<(typeof CYCLES)[number]["id"]>("monthly");
  const mult = CYCLES.find((c) => c.id === cycle)!.mult;

  return (
    <section id="pricing" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24">
      <Reveal>
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-muted-foreground">Pricing</p>
            <h2 className="mt-2 max-w-xl text-4xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-5xl">
              Pay for applications, not promises.
            </h2>
          </div>
          <div className="flex rounded-full border border-border p-1">
            {CYCLES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCycle(c.id)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  cycle === c.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
                {c.note && <span className="ml-1.5 text-[11px] opacity-70">{c.note}</span>}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="mt-12 grid items-start gap-5 lg:grid-cols-3">
        {PLANS.map((p, i) => (
          <Reveal key={p.name} delay={i * 80}>
            <div
              className={`flex h-full flex-col rounded-2xl border bg-card p-6 ${
                p.popular
                  ? "border-foreground shadow-card lg:-mt-4 lg:p-8"
                  : "border-border shadow-soft"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                {p.popular && (
                  <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                    Most popular
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{p.tagline}</p>
              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight">
                  ${Math.round(p.price * mult)}
                </span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </p>
              <p className="mt-2 text-sm font-medium">{p.apps}</p>
              <ul className="mt-6 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check size={15} className="mt-0.5 shrink-0 text-foreground" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#top"
                className={`mt-8 rounded-full py-3 text-center text-sm font-semibold transition-opacity hover:opacity-90 ${
                  p.popular
                    ? "bg-primary text-primary-foreground"
                    : "border border-border hover:bg-secondary"
                }`}
              >
                Get started
              </a>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            "Cancel any time",
            "25 free applications",
            "Real applications — pay only for jobs submitted",
          ].map((t) => (
            <div
              key={t}
              className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground"
            >
              <Check size={15} className="shrink-0 text-foreground" />
              <span className="min-w-0">{t}</span>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
