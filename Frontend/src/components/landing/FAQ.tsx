import { Reveal } from "./Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ITEMS = [
  {
    q: "How does JobPilot find jobs?",
    a: "We poll 50,000+ company career pages directly — Workday, Greenhouse, Lever, Ashby and 15+ other ATSes — every few minutes. No job-board scraping, no stale listings. New roles reach your feed within minutes of going live.",
  },
  {
    q: "How do I know it applied correctly?",
    a: "Every submission produces a receipt: the exact fields sent, the résumé file used, screener answers, and the confirmation page. If a form can't be completed cleanly, it's flagged as 'Needs you' instead of guessing.",
  },
  {
    q: "Will recruiters know I used JobPilot?",
    a: "No. Applications are submitted through the normal ATS form with your details and your documents. There's no JobPilot branding anywhere in what a recruiter sees.",
  },
  {
    q: "How does résumé tailoring work?",
    a: "We parse the job description, map it against your master résumé, and rewrite bullet points to lead with the relevant evidence. Nothing is invented — you see a line-by-line diff and can require approval before send.",
  },
  {
    q: "I'm on OPT or need sponsorship — does JobPilot help?",
    a: "Yes. Set your work authorization once and we answer sponsorship screeners consistently, and filter out roles that explicitly exclude your status so you don't burn applications.",
  },
  {
    q: "Is there a free plan?",
    a: "You get 25 free applications, no card required. After that, pick a cycle — you only pay for applications actually submitted.",
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
