import { Reveal } from "./Reveal";

export function FinalCTA() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24">
      <Reveal>
        <div className="rounded-3xl bg-primary px-6 py-20 text-center text-primary-foreground sm:px-14">
          <p className="text-sm opacity-60">25 free applications. Then upgrade if it sticks.</p>
          <h2 className="mx-auto mt-5 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-6xl">
            Get the next 25 applications off your plate by tonight.
          </h2>
          <a
            href="#how-it-works"
            className="mt-10 inline-block rounded-full bg-primary-foreground px-8 py-3.5 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5"
          >
            Get started
          </a>
        </div>
      </Reveal>
    </section>
  );
}
