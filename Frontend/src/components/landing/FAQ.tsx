import { Reveal } from "./Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ITEMS = [
  {
    q: "How does JobPilot match jobs with my profile?",
    a: "When you upload your résumé, JobPilot's AI extracts your technical skills, experience level, education, and target roles. It computes compatibility match scores against curated job descriptions so you focus on high-probability opportunities.",
  },
  {
    q: "How does 1-click application autofill work?",
    a: "JobPilot pre-fills all your contact information, résumé attachments, and answers to common screening questions (such as country of residence, hybrid schedule preferences, and visa status). When you answer a new question once, it's remembered permanently across future applications.",
  },
  {
    q: "How does AI cover letter generation work?",
    a: "JobPilot analyzes the specific job description and company culture, combining them with your verified résumé skills to craft an authentic, first-person 8-10 line cover note in seconds.",
  },
  {
    q: "Can I track my application pipeline and interviews?",
    a: "Yes. Every application you submit is recorded on your dashboard with an interactive Kanban board (Saved, Applied, Under Review, Interview, Offer, Rejected), timeline calendar, and follow-up reminders.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes! JobPilot is free to get started without a credit card. You can parse your résumé, view compatibility scores, and manage your full application pipeline immediately.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Reveal>
          <div>
            <p className="text-sm text-muted-foreground">Frequently asked.</p>
            <h2 className="mt-3 text-4xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-5xl">
              What people ask before signing up.
            </h2>
            <p className="mt-8 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Have something else on your mind? Write to{" "}
              <a href="mailto:founders@jobpilot.com" className="border-b border-foreground text-foreground">
                founders@jobpilot.com
              </a>{" "}
              — a real founder will reply.
            </p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <Accordion type="single" collapsible className="w-full">
            {ITEMS.map((it, i) => (
              <AccordionItem key={it.q} value={`i${i}`} className="border-border">
                <AccordionTrigger className="py-5 text-left text-base font-medium hover:no-underline sm:text-lg">
                  {it.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                  {it.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
