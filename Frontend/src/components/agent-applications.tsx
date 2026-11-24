import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { extractFirstAndLastName, type UserProfile } from "@/lib/profile";
import type { DocumentMetadata } from "@/lib/types";

type Job = { id: number; title: string; url: string };
type Field = {
  name: string;
  label: string;
  kind: string;
  required: boolean;
  options: { value: string; label: string }[];
};
type Review = {
  status: string;
  fields?: Field[];
  version?: string;
  title?: string;
  applicationId?: string;
};
type Attempt = { id: string; board: string; title: string; status: string };
type Listing = { board: string | null; jobs: Job[] };
const control = "w-full rounded-md border bg-background p-2 text-sm";
const action = "rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50";

export function AgentApplications({ userId, profile }: { userId: string; profile: UserProfile }) {
  const [listing, setListing] = useState<Listing>();
  const [job, setJob] = useState<Job>();
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      apiRequest<Attempt[]>("/agent/attempts", userId, { signal: controller.signal })
        .then(setAttempts)
        .catch(() => {});
    };
    load();
    window.addEventListener("jobpilot:data-changed", load);
    return () => {
      controller.abort();
      window.removeEventListener("jobpilot:data-changed", load);
    };
  }, [userId]);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Listing>("/agent/jobs", userId, { signal: controller.signal })
      .then(setListing)
      .catch(() => {
        if (!controller.signal.aborted) setError("Employer listings are unavailable.");
      });
    return () => controller.abort();
  }, [userId]);
  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <h2 className="font-semibold">Apply with JobPilot</h2>
      {error ||
        (!listing ? (
          "Loading connected employers…"
        ) : !listing.jobs.length ? (
          "No connected employer has published jobs available for direct submission."
        ) : (
          <label className="block">
            Employer listings
            <select
              className={control}
              value={job?.id ?? ""}
              onChange={(e) => setJob(listing.jobs.find((j) => String(j.id) === e.target.value))}
            >
              <option value="">Choose a job</option>
              {listing.jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {listing.board} · {j.title}
                </option>
              ))}
            </select>
          </label>
        ))}
      {listing?.board && job && (
        <ReviewJob
          key={userId + listing.board + job.id}
          {...{ userId, profile, job }}
          board={listing.board}
        />
      )}
      {attempts.length > 0 && (
        <details>
          <summary>Submission history</summary>
          <ul>
            {attempts.map((a) => (
              <li key={a.id}>
                {a.board} · {a.title} — {a.status === "pending" ? "Confirmation pending" : a.status}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function ReviewJob({
  userId,
  profile,
  job,
  board,
}: {
  userId: string;
  profile: UserProfile;
  job: Job;
  board: string;
}) {
  const path = `/agent/${encodeURIComponent(board)}/jobs/${job.id}`;
  const [review, setReview] = useState<Review>();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resume, setResume] = useState("");
  const [docs, setDocs] = useState<DocumentMetadata[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const draftKey = `jobpilot:agent:${userId}:${board}:${job.id}`;
  useEffect(() => {
    let active = true;
    async function load() {
      const form = await apiRequest<Review>(path, userId);
      const attachments = form.fields?.some((f) => f.name === "resume")
        ? await apiRequest<DocumentMetadata[]>("/documents", userId)
        : [];
      if (!active) return;
      const names = extractFirstAndLastName(profile.fullName);
      const known: Record<string, string> = {
        first_name: profile.firstName || names.firstName,
        last_name: profile.lastName || names.lastName,
        email: profile.email,
        phone: profile.phone,
        resume_text: profile.resumeText,
      };
      const values = Object.fromEntries(
        (form.fields ?? [])
          .filter((f) => f.name !== "resume")
          .map((f) => [f.name, known[f.name] || profile.customAnswers?.[f.label] || ""]),
      );
      let stored;
      try {
        stored = JSON.parse(localStorage.getItem(draftKey) || "null");
      } catch {
        /* draft unavailable */
      }
      setAnswers(stored?.version === form.version && stored?.answers ? stored.answers : values);
      setResume(
        stored && stored.version === form.version && attachments.some((d) => d.id === stored.resume)
          ? stored.resume
          : "",
      );
      setDocs(attachments);
      setReview(form);
      setError("");
    }
    load().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [path, userId, profile, draftKey, refresh]);
  useEffect(() => {
    if (review?.status === "review") {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ version: review.version, answers, resume }),
        );
      } catch {
        /* storage unavailable */
      }
    }
  }, [review, draftKey, answers, resume]);

  async function draft(field: Field) {
    setBusy(true);
    setError("");
    try {
      const context = JSON.stringify({
        question: field.label,
        role: job.title,
        employer: board,
        resume: profile.resumeText.slice(0, 8000),
        skills: profile.skills,
      });
      const result = await apiRequest<{ content: string }>("/ai/chat", userId, {
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "Draft a short first-person job application answer using only explicit facts in the supplied resume and skills. Leave the answer blank if the evidence is insufficient. Never infer eligibility or consent.",
            },
            { role: "user", content: context },
          ],
        }),
      });
      setAnswers((a) => ({ ...a, [field.name]: result.content }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <a className="underline" href={job.url} target="_blank" rel="noreferrer">
        View employer listing
      </a>
      {error && <p role="alert">{error}</p>}
      {review?.status === "review" ? (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              const result = await apiRequest<Review>(path + "/submit", userId, {
                method: "POST",
                body: JSON.stringify({
                  approved: true,
                  board,
                  version: review.version,
                  answers,
                  resumeId: resume || null,
                }),
              });
              if (result.status === "rejected")
                setError(
                  "The employer declined the submission. Check your answers or use the employer listing.",
                );
              else {
                setReview(result);
                window.dispatchEvent(new Event("jobpilot:data-changed"));
              }
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3 className="font-semibold">
            Review application for {review.title} at {board}
          </h3>
          <fieldset disabled={busy} className="space-y-3">
            {review.fields?.map((f) => (
              <div key={f.name}>
                <label className="block">
                  {f.label}
                  {f.required && " *"}
                  {f.name === "resume" ? (
                    <select
                      className={control}
                      required={f.required}
                      value={resume}
                      onChange={(e) => setResume(e.target.value)}
                    >
                      <option value="">Choose an uploaded résumé</option>
                      {docs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.fileName}
                        </option>
                      ))}
                    </select>
                  ) : f.kind === "multi_value_single_select" ? (
                    <select
                      className={control}
                      required={f.required}
                      value={answers[f.name] || ""}
                      onChange={(e) => setAnswers({ ...answers, [f.name]: e.target.value })}
                    >
                      <option value="">Choose an answer</option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.kind === "textarea" ? (
                    <textarea
                      className={control}
                      required={f.required}
                      value={answers[f.name] || ""}
                      onChange={(e) => setAnswers({ ...answers, [f.name]: e.target.value })}
                    />
                  ) : (
                    <input
                      className={control}
                      type={f.name === "email" ? "email" : "text"}
                      required={f.required}
                      value={answers[f.name] || ""}
                      onChange={(e) => setAnswers({ ...answers, [f.name]: e.target.value })}
                    />
                  )}
                </label>
                {f.kind === "textarea" && f.name !== "resume_text" && (
                  <button type="button" className={action} onClick={() => draft(f)}>
                    Draft from my profile
                  </button>
                )}
                {f.name === "resume" && !docs.length && (
                  <p>Upload a résumé in dashboard Documents, then reopen this listing.</p>
                )}
              </div>
            ))}
            <button className={action} type="submit">
              {busy ? "Working…" : "Submit reviewed application"}
            </button>
          </fieldset>
        </form>
      ) : (
        <p role="status">
          {{
            pending:
              "Confirmation pending. Verify receipt with the employer before applying again.",
            confirmed: "Employer confirmed receipt. Your application is in the tracker.",
            unsupported:
              "Complete this application on the employer’s website. Its form requires features JobPilot cannot submit.",
          }[review?.status || ""] || "Loading application…"}
        </p>
      )}
      {review?.applicationId && (
        <a className="underline" href={`/applications/${review.applicationId}`}>
          View tracked application
        </a>
      )}
      {(error || review?.status === "pending") && (
        <button className={action} onClick={() => setRefresh((v) => v + 1)}>
          Refresh status
        </button>
      )}
    </div>
  );
}
