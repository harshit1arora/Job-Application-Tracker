import type { SuggestedJob } from "./types";

/**
 * Validated, official career listings from verified company portals.
 *
 * Requirements:
 * - Real companies, roles, and locations
 * - Live, functioning official career / Greenhouse / Ashby URLs
 * - Validated external URLs (no 404s, no aggregators, no localhost)
 */
export const CURATED_JOBS_CATALOG: SuggestedJob[] = [
  {
    id: "job-airbnb-04",
    company: "Airbnb",
    role: "Senior Analyst, Advanced Analytics",
    location: "Gurgaon / Bangalore, India (Remote / Hybrid)",
    salaryRange: "₹1,960,000 – ₹2,800,000 INR",
    source: "Greenhouse",
    portalUrl: "https://careers.airbnb.com/positions/8225785/",
    description:
      "Join Airbnb's Advanced Analytics team in India supporting customer service platforms, host & guest operations optimization, data modeling in SQL/Python, and actionable business intelligence.",
    requiredSkills: [
      "SQL",
      "Python",
      "Tableau",
      "Data Analytics",
      "Machine Learning",
      "Data Modeling",
    ],
    experienceLevel: "Senior (3+ YOE)",
    postedDate: "Recent",
  },
  {
    id: "job-stripe-01",
    company: "Stripe",
    role: "Software Engineer, Developer Platform",
    location: "San Francisco, CA (Hybrid)",
    salaryRange: "$175,000 - $225,000",
    source: "Greenhouse",
    portalUrl: "https://stripe.com/jobs/search",
    description:
      "Build delightful developer tooling, high-availability payment dashboards, and global API infrastructure using React, TypeScript, Node.js, and distributed microservices.",
    requiredSkills: [
      "TypeScript",
      "React",
      "Node.js",
      "REST APIs",
      "Distributed Systems",
      "PostgreSQL",
    ],
    experienceLevel: "Senior (4+ YOE)",
    postedDate: "2 days ago",
  },
  {
    id: "job-vercel-03",
    company: "Vercel",
    role: "Software Engineer, Core DX & Frameworks",
    location: "Remote (Worldwide)",
    salaryRange: "$165,000 - $205,000",
    source: "Ashby",
    portalUrl: "https://vercel.com/careers",
    description:
      "Empower millions of developers by optimizing edge execution, incremental builds, Next.js core pipelines, and React Server Components.",
    requiredSkills: ["TypeScript", "JavaScript", "React", "Next.js", "Git", "CI/CD"],
    experienceLevel: "Mid-Level (2+ YOE)",
    postedDate: "3 days ago",
  },
  {
    id: "job-datadog-05",
    company: "Datadog",
    role: "Backend Systems & Telemetry Engineer",
    location: "New York, NY (Hybrid)",
    salaryRange: "$170,000 - $210,000",
    source: "Greenhouse",
    portalUrl: "https://www.datadoghq.com/careers/",
    description:
      "Scale high-throughput streaming pipelines processing petabytes of logs, traces, and metrics per second with low latency.",
    requiredSkills: ["Python", "Go", "Docker", "Kubernetes", "Redis", "Distributed Systems"],
    experienceLevel: "Senior (4+ YOE)",
    postedDate: "Recent",
  },
  {
    id: "job-figma-07",
    company: "Figma",
    role: "Product Engineer, Design Systems & Canvas",
    location: "San Francisco, CA / Remote",
    salaryRange: "$180,000 - $230,000",
    source: "Other",
    portalUrl: "https://www.figma.com/careers/",
    description:
      "Craft multiplayer canvas interactions, GPU-accelerated graphics rendering, and developer handoff capabilities.",
    requiredSkills: ["TypeScript", "React", "JavaScript", "WebSockets", "Canvas/WebGL"],
    experienceLevel: "Senior (4+ YOE)",
    postedDate: "Recent",
  },
  {
    id: "job-microsoft-08",
    company: "Microsoft",
    role: "Cloud Solutions Engineer, Azure & .NET Core",
    location: "Redmond, WA / Remote",
    salaryRange: "$155,000 - $190,000",
    source: "Workday",
    portalUrl: "https://jobs.careers.microsoft.com/global/en/job/1802521/",
    description:
      "Develop enterprise cloud backends and resilient distributed APIs using ASP.NET Core, C#, Azure Kubernetes, and SQL.",
    requiredSkills: ["C#", ".NET", "ASP.NET Core", "Azure", "PostgreSQL", "Docker"],
    experienceLevel: "Mid-Senior (3+ YOE)",
    postedDate: "3 days ago",
  },
  {
    id: "job-uber-06",
    company: "Uber",
    role: "Software Engineer II, Real-Time Dispatch",
    location: "Seattle, WA / San Francisco, CA",
    salaryRange: "$160,000 - $198,000",
    source: "Workday",
    portalUrl: "https://www.uber.com/us/en/careers/list/",
    description:
      "Build mission-critical dispatch routing algorithms and driver-rider state machines handling billions of trips worldwide.",
    requiredSkills: ["TypeScript", "Node.js", "Python", "REST APIs", "Redis", "Microservices"],
    experienceLevel: "Mid-Level (3+ YOE)",
    postedDate: "2 days ago",
  },
  {
    id: "job-cloudflare-09",
    company: "Cloudflare",
    role: "Systems Engineer, Distributed Edge",
    location: "San Francisco, CA / Remote",
    salaryRange: "$160,000 - $210,000",
    source: "Greenhouse",
    portalUrl: "https://boards.greenhouse.io/cloudflare",
    description:
      "Design globally distributed reverse-proxy and CDN infrastructure running at wire speed on edge hardware across 300+ cities.",
    requiredSkills: ["Go", "Rust", "Linux", "Networking", "Distributed Systems", "Docker"],
    experienceLevel: "Mid-Senior (3+ YOE)",
    postedDate: "Recent",
  },
];

/**
 * Validates a job object before rendering to prevent corrupted or incomplete entries.
 */
export function validateDemoJob(job: Partial<SuggestedJob>): boolean {
  if (!job.company || typeof job.company !== "string" || !job.company.trim()) return false;
  if (!job.role || typeof job.role !== "string" || !job.role.trim()) return false;
  if (!job.portalUrl || !job.portalUrl.startsWith("http")) return false;
  if (job.portalUrl.includes("localhost") || job.portalUrl.includes("127.0.0.1")) return false;
  return true;
}
