# 🚀 JobPilot — Autonomous AI Job Application Tracker & Agent

> **Be the first to apply to every job that fits you. Hands off.**

JobPilot is an intelligent, autonomous AI agent designed to revolutionize the modern job search. Instead of spending endless hours scrolling job boards, tailoring résumés by hand, and filling out repetitive forms, JobPilot works continuously in the background to discover matching roles, tailor your application materials, auto-submit applications, and track recruiter responses in one unified dashboard.

---

## 🌟 Why JobPilot?

Finding a job in today's market is often a numbers game where timing is everything. Early applicants (within the first few hours of a job posting) get up to **5x higher interview callback rates**. 

JobPilot bridges the gap by acting as your personal 24/7 career assistant. It constantly monitors tens of thousands of company career sites and top Applicant Tracking Systems (ATS), crafts tailored résumés for roles that match your profile, and handles the application process seamlessly.

---

## 🔥 Key Features Explained in Detail

### 🔍 1. Autonomous Job Monitoring & Match Scoring
- **50,000+ Career Pages Monitored**: JobPilot continuously scans career portals powered by major ATS platforms including **Workday, Greenhouse, Lever, Ashby, BambooHR, SmartRecruiters, Workable, Taleo, iCIMS, and Jobvite**.
- **Instant Match Scores**: Every discovered role is analyzed against your experience and assigned an intelligent match percentage (e.g. `94% match`, `91% match`).
- **Head-Start Advantage**: Detects new listings the moment they drop so your application lands in the top 100 queue before the posting goes viral.

---

### 📄 2. AI-Powered Résumé & Cover Letter Tailoring
- **Role-Specific Optimization**: Automatically extracts key keywords and requirements from the job description and customizes your résumé bullet points accordingly.
- **Visual Diff Preview**: Review every single change before it's sent. JobPilot highlights added skills (`+`) and removed redundancies (`-`) so you maintain complete control over your professional narrative.
- **Tailored Cover Letters**: Generates personalized, concise cover letters matched to the company culture and position tone.

---

### ⚡ 3. Automated Application Submission Engine
- **Full Form Field Coverage**: Auto-fills candidate demographics, employment history, portfolio links, and customized answers to screener questions.
- **Instant Digital Receipts**: For every application completed, JobPilot logs a detailed receipt listing total fields filled vs. skipped so you know your submission was clean and complete.

---

### 📊 4. Unified Application Tracking & Inbox
- **Zero-Spreadsheet Tracking**: Replaces manual Excel spreadsheets with an automatic Kanban-style status board.
- **Automated Recruiter Reply Routing**: Automatically categorizes incoming email responses (Submitted, Viewed, Interview Invited, Offer) and updates your application status in real time.

---

### 🌙 5. Seamless Dark / Light Mode System
- **Navbar Theme Toggle**: Includes an interactive Sun/Moon toggle switch in the header bar.
- **Smart Persistence**: Automatically respects system color schemes (`prefers-color-scheme`) and persists user preferences in `localStorage`.
- **Custom Color System**: Uses OKLCH color tokens (`--tint-amber`, `--tint-green`, `--tint-violet`, `--tint-rose`) to deliver vibrant visual cards and high-contrast readability in both light and dark themes.

---

## 📱 Multi-Platform Experience

JobPilot is designed to fit wherever you work:

| Platform | How It Works |
| :--- | :--- |
| 💻 **Web Dashboard** | Complete central workspace with application queue, match feeds, and recruiter inbox. |
| 💬 **iMessage & WhatsApp** | Receive text alerts when a high-match role drops. Simply reply **"yes"** to trigger submission and receive a receipt. |
| 🧩 **Chrome Extension** | Found a job listing yourself? Click the extension to autofill forms on any ATS with your tailored résumé in seconds. |
| 🤖 **MCP Server & CLI** | A typed developer CLI (`jobpilot apply`) and Model Context Protocol (MCP) server with 12 tools for Claude, Codex, or custom scripts. |

---

## 🛠️ Tech Stack & Architecture

- **Frontend Framework**: [React 19](https://react.dev/) + [TanStack Start](https://tanstack.com/router)
- **Routing & State**: [TanStack Router](https://tanstack.com/router) & [TanStack Query](https://tanstack.com/query)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with native `@custom-variant dark` support
- **Icons & Components**: [Lucide React](https://lucide.react.dev/) & [Radix UI](https://www.radix-ui.com/)
- **Build Tooling & Runtime**: [Vite 8](https://vitejs.dev/) & [Bun](https://bun.sh/)

---

## 📂 Project Structure

```
jobpilot-agent/
├── src/
│   ├── components/
│   │   └── landing/          # Modular landing page components
│   │       ├── DashboardMock.tsx  # Interactive dashboard UI mockup
│   │       ├── FAQ.tsx            # Frequently asked questions accordion
│   │       ├── FinalCTA.tsx       # Call-to-action banner
│   │       ├── Footer.tsx         # Responsive site footer
│   │       ├── Hero.tsx           # Main hero section & headline
│   │       ├── HowItWorks.tsx     # 4-stage pipeline visualization
│   │       ├── Logo.tsx           # Brand SVG logo icon
│   │       ├── LogoCloud.tsx      # ATS platform coverage chips
│   │       ├── MatchBadge.tsx     # Score badge component
│   │       ├── Nav.tsx            # Navigation header with Dark Mode toggle
│   │       ├── Platforms.tsx      # Multi-interface showcase cards
│   │       └── Reveal.tsx         # Scroll animation wrapper
│   ├── routes/                # TanStack Start file-based routes
│   │   ├── __root.tsx         # Root layout template & meta head configuration
│   │   └── index.tsx          # Main landing page route
│   ├── router.tsx             # TanStack Router instance creation
│   ├── server.ts              # SSR entrypoint & error capture wrapper
│   └── styles.css             # Design tokens & dark mode OKLCH theme variables
├── package.json               # Dependencies and scripts
├── vite.config.ts             # Vite server & TanStack Start configuration
└── README.md                  # Project documentation
```

---

## 💻 Getting Started Locally

### Prerequisites

Ensure you have **Bun** (recommended) or **Node.js** installed on your system:
- [Install Bun](https://bun.sh/)
- Node.js version `20.19+` or `22.12+`

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/jobpilot-agent.git
   cd jobpilot-agent
   ```

2. **Install dependencies**:
   ```bash
   bun install
   # or
   npm install
   ```

3. **Start the development server**:
   ```bash
   bun run dev
   # or
   npm run dev
   ```

4. **Open in browser**:
   Navigate to [http://localhost:5173](http://localhost:5173) to view the running app.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
