import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">JobPilot</p>
          <h2 className="mt-2 text-4xl leading-[1.05] font-semibold sm:text-5xl">
            Prepare and track your job search in one place.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Explore profile-to-role analysis, career-readiness insights, interview practice, and
            application tracking. Applications are reviewed and submitted by you on employer sites.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Create an account <ArrowRight size={15} />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
