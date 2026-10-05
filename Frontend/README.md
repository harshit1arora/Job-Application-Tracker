# JobPilot Frontend

JobPilot is an AI-assisted career intelligence and job application tracking web app. It helps candidates analyze curated opportunities against their profile, assess readiness and skill evidence, prepare application materials, practice interviews, and track applications. Candidates review generated materials and submit applications directly on employer sites; JobPilot does not autonomously submit applications.

## Current Features

- React, TypeScript, Vite, and TanStack Router frontend.
- Profile and résumé parsing with client-side PDF/DOCX text extraction.
- Curated job catalog with profile-to-role analysis.
- Deterministic career-readiness, skill-evidence, and next-action calculations.
- AI-assisted cover letters, interview practice, and career copilot responses through the authenticated backend proxy when configured.
- Profile-assisted field copy and application preparation for supported workflows.
- Application pipeline, interview calendar, reminders, and document management backed by the FastAPI service.

The job catalog is curated application data, not a live crawler. The application prepares and tracks candidate work; candidates review details and complete submission on employer sites.

## Development

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
npm test -- --run
npm run build
```

For real authentication, configure the Firebase Web App environment values in `.env` for local development or in the hosting environment before building:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Do not place private AI provider keys in frontend `VITE_*` variables. Configure `GEMINI_API_KEY` only in the backend environment.

For local development, the Vite server proxies `/api` to `http://localhost:5117`. Production builds use the configured API base URL (Render in the deployed environment).
