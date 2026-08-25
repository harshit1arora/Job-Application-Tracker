import { Linkedin, Mail, Twitter } from "lucide-react";
import { Logo } from "./Logo";

const COLS = [
  {
    title: "Product",
    links: ["How it works", "FAQ", "Get started"],
  },
  {
    title: "Features",
    links: ["AI Résumé Parser", "Compatibility Matcher", "1-Click Autofill", "Pipeline Tracker"],
  },
  {
    title: "Company",
    links: ["About", "Changelog", "AI Disclosure"],
  },
  {
    title: "Legal",
    links: ["Privacy Policy", "Terms of Service"],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2">
            <Logo className="h-5 w-5" />
            <span className="font-semibold tracking-tight">JobPilot</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            A transparent autonomous AI agent for job applications and tracking.
          </p>
          <div className="mt-5 flex gap-2">
            {[Linkedin, Twitter, Mail].map((Icon, i) => (
              <a
                key={i}
                href="#top"
                className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon size={14} />
              </a>
            ))}
          </div>
        </div>

        {COLS.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold">{c.title}</p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l}>
                  <a
                    href="#top"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-5 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} JobPilot Labs, Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
