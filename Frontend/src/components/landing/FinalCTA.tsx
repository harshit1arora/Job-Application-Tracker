import { Link } from "@tanstack/react-router";
import { Reveal } from "./Reveal";

export function FinalCTA() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24">
      <Reveal>
        <div className="rounded-3xl bg-primary px-6 py-20 text-center text-primary-foreground sm:px-14">
          <p className="text-sm opacity-75">Free to start. No card required.</p>
          <h2 className="mx-auto mt-5 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-6xl">
            Start organizing and accelerating your job applications today.
          </h2>
          <Link
            to="/signup"
            className="mt-10 inline-block rounded-full bg-primary-foreground px-8 py-3.5 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5"
          >
            Get started
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
