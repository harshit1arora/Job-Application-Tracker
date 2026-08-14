import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { LogoCloud } from "@/components/landing/LogoCloud";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Platforms } from "@/components/landing/Platforms";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

const TITLE = "JobPilot — The AI agent that applies to every job that fits you";
const DESCRIPTION =
  "JobPilot watches 50,000+ career pages across Workday, Greenhouse, Lever and Ashby, tailors your résumé and submits applications automatically. Free to start.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Nav />
      <main>
        <Hero />
        <LogoCloud />
        <HowItWorks />
        <Platforms />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
