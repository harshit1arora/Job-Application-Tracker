import { Reveal } from "./Reveal";

const PLATFORMS = [
  "Workday",
  "Greenhouse",
  "Lever",
  "Ashby",
  "BambooHR",
  "SmartRecruiters",
  "Workable",
  "Taleo",
  "iCIMS",
  "Jobvite",
];

export function LogoCloud() {
  return (
    <section className="border-y border-border bg-secondary/40 py-12">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal>
          <p className="text-sm font-medium text-muted-foreground">Automated Applications Across Major ATS Platforms & Job Portals</p>
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {PLATFORMS.map((p) => (
              <div
                key={p}
                className="grid h-14 place-items-center rounded-xl border border-border bg-card px-3 text-sm font-medium text-muted-foreground shadow-soft transition-colors hover:text-foreground hover:border-border/80"
              >
                <span className="truncate">{p}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
