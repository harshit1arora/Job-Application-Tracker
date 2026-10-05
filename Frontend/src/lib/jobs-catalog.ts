import type { SuggestedJob } from "./types";

const OFFICIAL_HOSTS = new Set([
  "careers.airbnb.com",
  "stripe.com",
  "jobs.stripe.com",
  "careers.google.com",
  "www.metacareers.com",
  "www.atlassian.com",
  "vercel.com",
  "www.notion.so",
  "www.coinbase.com",
  "www.microsoft.com",
  "www.uber.com",
]);

const officialCareerBase = [
  "https://careers.airbnb.com/positions/8225785/",
  "https://stripe.com/jobs/search?role=software-engineer",
  "https://careers.google.com/jobs/results/",
  "https://www.metacareers.com/jobs/",
  "https://www.atlassian.com/company/careers/all-jobs",
  "https://vercel.com/careers",
  "https://www.notion.so/careers",
  "https://www.coinbase.com/careers/positions",
  "https://jobs.microsoft.com/v2/search?jobFamily=Product%20and%20Program%20Management",
  "https://www.uber.com/us/en/careers/list/",
];

export const CURATED_JOBS_CATALOG: SuggestedJob[] = [
  {
    id: "airbnb-8225785",
    company: "Airbnb",
    role: "Senior Analyst, Advanced Analytics",
    location: "Bangalore, India",
    salaryRange: "₹1,960,000–₹2,800,000 INR",
    source: "LinkedIn",
    applicationSource: "LinkedIn",
    sourceLabel: "Careers",
    sourceType: "official",
    jobUrl: officialCareerBase[0],
    externalApplyUrl: officialCareerBase[0],
    isActive: true,
    description:
      "Airbnb's India Analytics Centre of Excellence is seeking a senior advanced analyst to partner with the Fraud & Safety Delivery team. The role delivers metrics, data models, dashboards, root-cause analysis, and recommendations for product and business decisions.",
    requiredSkills: [
      "SQL/NoSQL",
      "Python",
      "R or SAS",
      "Statistics",
      "Machine Learning",
      "Tableau or BI",
      "Data Modeling",
      "A/B Testing",
    ],
    experienceLevel: "6+ years",
  },
  {
    id: "stripe-senior-frontend-engineer",
    company: "Stripe",
    role: "Senior Frontend Engineer",
    location: "Remote / US",
    salaryRange: "$180,000–$280,000 USD",
    source: "Greenhouse",
    applicationSource: "Greenhouse",
    sourceLabel: "Stripe Jobs",
    sourceType: "official",
    jobUrl: officialCareerBase[1],
    externalApplyUrl: officialCareerBase[1],
    isActive: true,
    description:
      "Work closely with product and design to build global payment experiences, internal tooling, and developer-facing workflows that scale across markets and teams.",
    requiredSkills: ["TypeScript", "React", "CSS", "Web Performance", "Design Systems", "UX"],
    experienceLevel: "5+ years",
  },
  {
    id: "google-full-stack-engineer",
    company: "Google",
    role: "Software Engineer, Full Stack",
    location: "Mountain View, CA",
    salaryRange: "$180,000–$315,000 USD",
    source: "Workday",
    applicationSource: "Workday",
    sourceLabel: "Google Careers",
    sourceType: "official",
    jobUrl: officialCareerBase[2],
    externalApplyUrl: officialCareerBase[2],
    isActive: true,
    description:
      "Build high-impact, large-scale user experiences and backend services for Google products used by billions of people every day.",
    requiredSkills: ["Java", "Python", "Distributed Systems", "APIs", "Backend", "Frontend"],
    experienceLevel: "3+ years",
  },
  {
    id: "meta-product-engineer",
    company: "Meta",
    role: "Product Engineer",
    location: "Menlo Park, CA",
    salaryRange: "$185,000–$270,000 USD",
    source: "Greenhouse",
    applicationSource: "Greenhouse",
    sourceLabel: "Meta Careers",
    sourceType: "official",
    jobUrl: officialCareerBase[3],
    externalApplyUrl: officialCareerBase[3],
    isActive: true,
    description:
      "Ship new products and insights across Meta's feed, ads, and community experiences with a focus on product quality, performance, and scale.",
    requiredSkills: ["React", "GraphQL", "System Design", "Product Thinking", "Analytics"],
    experienceLevel: "4+ years",
  },
  {
    id: "atlassian-senior-frontend-engineer",
    company: "Atlassian",
    role: "Senior Frontend Engineer",
    location: "Remote / India",
    salaryRange: "₹2,500,000–₹4,100,000 INR",
    source: "Workday",
    applicationSource: "Workday",
    sourceLabel: "Atlassian Careers",
    sourceType: "official",
    jobUrl: officialCareerBase[4],
    externalApplyUrl: officialCareerBase[4],
    isActive: true,
    description:
      "Create polished, high-performance product experiences for teams that plan, build, and ship software at scale.",
    requiredSkills: ["TypeScript", "React", "Accessibility", "Design Systems", "Testing"],
    experienceLevel: "5+ years",
  },
  {
    id: "vercel-senior-frontend-engineer",
    company: "Vercel",
    role: "Senior Frontend Engineer",
    location: "Remote / US",
    salaryRange: "$170,000–$250,000 USD",
    source: "Other",
    applicationSource: "Other",
    sourceLabel: "Vercel Careers",
    sourceType: "official",
    jobUrl: officialCareerBase[5],
    externalApplyUrl: officialCareerBase[5],
    isActive: true,
    description:
      "Build delightful developer experiences and frontend infrastructure for the modern web, helping teams ship faster and with greater confidence.",
    requiredSkills: ["React", "Next.js", "TypeScript", "Frontend Architecture", "Performance"],
    experienceLevel: "4+ years",
  },
  {
    id: "notion-product-engineer",
    company: "Notion",
    role: "Product Engineer",
    location: "New York, NY",
    salaryRange: "$170,000–$245,000 USD",
    source: "Ashby",
    applicationSource: "Ashby",
    sourceLabel: "Notion Careers",
    sourceType: "official",
    jobUrl: officialCareerBase[6],
    externalApplyUrl: officialCareerBase[6],
    isActive: true,
    description:
      "Design and ship polished product experiences that make knowledge work more flexible, collaborative, and productive for teams around the world.",
    requiredSkills: ["TypeScript", "React", "Product Design", "Systems Thinking", "Collaboration"],
    experienceLevel: "3+ years",
  },
  {
    id: "coinbase-software-engineer-ii",
    company: "Coinbase",
    role: "Software Engineer II",
    location: "Remote / US",
    salaryRange: "$180,000–$250,000 USD",
    source: "Lever",
    applicationSource: "Lever",
    sourceLabel: "Coinbase Careers",
    sourceType: "official",
    jobUrl: officialCareerBase[7],
    externalApplyUrl: officialCareerBase[7],
    isActive: true,
    description:
      "Own critical product areas across crypto infrastructure, user trust, and financial tooling that power safe and reliable customer experiences.",
    requiredSkills: ["Go", "Distributed Systems", "APIs", "Security", "Cloud"],
    experienceLevel: "3+ years",
  },
];

export function validateDemoJob(job: Partial<SuggestedJob>): boolean {
  if (!job.company?.trim() || !job.role?.trim() || !job.id?.trim()) return false;
  if (job.sourceType !== "official" || job.isActive !== true) return false;
  if (!job.source) return false;
  if (!job.jobUrl || !job.externalApplyUrl) return false;

  try {
    const jobUrl = new URL(job.jobUrl);
    const applyUrl = new URL(job.externalApplyUrl);
    const isHttps = jobUrl.protocol === "https:" && applyUrl.protocol === "https:";
    const allowedHost = OFFICIAL_HOSTS.has(jobUrl.hostname) && OFFICIAL_HOSTS.has(applyUrl.hostname);
    const candidatePaths = [
      jobUrl.pathname.toLowerCase(),
      applyUrl.pathname.toLowerCase(),
      `${jobUrl.pathname}${jobUrl.search}`.toLowerCase(),
      `${applyUrl.pathname}${applyUrl.search}`.toLowerCase(),
    ];

    const hasOfficialCareerPath = candidatePaths.some((path) =>
      path.includes("/positions/") ||
        path.includes("/jobs") ||
        path.includes("/careers") ||
        path.includes("/results") ||
        path.includes("/search") ||
        path.includes("/list/"),
    );

    return isHttps && allowedHost && hasOfficialCareerPath;
  } catch {
    return false;
  }
}

export const VALIDATED_DEMO_JOBS = CURATED_JOBS_CATALOG.filter(validateDemoJob);