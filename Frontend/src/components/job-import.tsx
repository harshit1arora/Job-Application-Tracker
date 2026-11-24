import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";

type Details = {
  company: string;
  role: string;
  deadline: string;
  instructions: string;
  description: string;
};
type Opening = Details & { id: string; url: string };
type Direct = { board: string; id: number; title: string; url: string };
type Methods = {
  url: string;
  email: string | null;
  direct: Direct | null;
  verificationUnavailable?: boolean;
};
const input = "block w-full rounded-md border bg-background p-2";
const button = "rounded-md border px-3 py-2 disabled:opacity-50";

export function JobImport({
  userId,
  renderReview,
}: {
  userId: string;
  renderReview: (job: Direct) => React.ReactNode;
}) {
  const [url, setUrl] = useState("");
  const [paste, setPaste] = useState(false);
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState<Details>();
  const [saved, setSaved] = useState<Opening[]>([]);
  const [selected, setSelected] = useState<Opening>();
  const [methods, setMethods] = useState<Methods>();
  const [reviewId, setReviewId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [methodsError, setMethodsError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Opening[]>("/job-imports", userId, { signal: controller.signal })
      .then((rows) => {
        if (!controller.signal.aborted)
          setSaved((current) => [
            ...current,
            ...rows.filter((r) => !current.some((c) => c.id === r.id)),
          ]);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not load saved openings.");
      });
    return () => controller.abort();
  }, [userId]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setMethods(undefined);
    setMethodsError(false);
    apiRequest<Methods>(`/job-imports/${selected.id}/methods`, userId)
      .then((m) => {
        if (active) setMethods(m);
      })
      .catch(() => {
        if (active) setMethodsError(true);
      });
    return () => {
      active = false;
    };
  }, [selected, userId, refresh]);
  async function preview() {
    setBusy(true);
    setError("");
    try {
      const data = await apiRequest<Details & { needsDescription: boolean }>(
        "/job-imports/preview",
        userId,
        { method: "POST", body: JSON.stringify({ url, description: paste ? description : "" }) },
      );
      if (data.needsDescription) {
        setPaste(true);
        setError("Could not read the listing. Paste its description below.");
      } else setDetails(data);
    } catch (e) {
      setError((e as Error).message);
      setPaste(true);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!details) return;
    setBusy(true);
    setError("");
    try {
      const opening = await apiRequest<Opening>("/job-imports", userId, {
        method: "POST",
        body: JSON.stringify({ ...details, url }),
      });
      setSaved((rows) => [opening, ...rows.filter((r) => r.id !== opening.id)]);
      setMethods(undefined);
      setSelected(opening);
      setDetails(undefined);
      setUrl("");
      setPaste(false);
      setDescription("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Import a job link" className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Import a job link</h2>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void (details ? confirm() : preview());
        }}
      >
        <fieldset disabled={busy} className="space-y-2">
          <label>
            Listing URL
            <input
              className={input}
              required
              type="url"
              value={url}
              readOnly={!!details}
              placeholder="https://…"
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          {details ? (
            <>
              <p>Check the extracted details before saving this opening.</p>
              {(["company", "role", "deadline", "instructions", "description"] as const).map(
                (key) => (
                  <label className="block" key={key}>
                    {
                      {
                        company: "Company",
                        role: "Role",
                        deadline: "Application deadline",
                        instructions: "Application instructions",
                        description: "Job description",
                      }[key]
                    }
                    {key === "instructions" || key === "description" ? (
                      <textarea
                        className={input}
                        value={details[key]}
                        onChange={(e) => setDetails({ ...details, [key]: e.target.value })}
                      />
                    ) : (
                      <input
                        className={input}
                        value={details[key]}
                        required={key !== "deadline"}
                        onChange={(e) => setDetails({ ...details, [key]: e.target.value })}
                      />
                    )}
                  </label>
                ),
              )}
              <button className={button} type="submit">
                Confirm and save opening
              </button>
              <button className={button} type="button" onClick={() => setDetails(undefined)}>
                Back
              </button>
            </>
          ) : (
            <>
              {paste ? (
                <label className="block">
                  Paste job description
                  <textarea
                    className={input}
                    required
                    maxLength={40000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
              ) : (
                <button type="button" className="underline" onClick={() => setPaste(true)}>
                  Paste description instead
                </button>
              )}
              <button className={button} type="submit">
                {busy ? "Reading…" : "Extract listing details"}
              </button>
            </>
          )}
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {!!saved.length && (
        <label className="block">
          Imported openings
          <select
            className={input}
            value={selected?.id ?? ""}
            onChange={(e) => {
              setMethods(undefined);
              setSelected(saved.find((o) => o.id === e.target.value));
            }}
          >
            <option value="">Choose a saved opening</option>
            {saved.map((o) => (
              <option key={o.id} value={o.id}>
                {o.company} · {o.role}
              </option>
            ))}
          </select>
        </label>
      )}
      {selected && (
        <div className="space-y-2">
          <h3 className="font-semibold">
            {selected.role} at {selected.company}
          </h3>
          <p>Deadline: {selected.deadline || "Unspecified"}</p>
          <p className="whitespace-pre-wrap">
            {selected.instructions || "Check the employer listing for application instructions."}
          </p>
          <h4 className="font-medium">Application options</h4>
          <a className="underline" href={selected.url} target="_blank" rel="noreferrer">
            Open employer listing
          </a>
          {methods?.email && (
            <p>
              <a className="underline" href={`mailto:${methods.email}`}>
                Apply by email to {methods.email}
              </a>{" "}
              (opens your email app)
            </p>
          )}
          {methods?.direct && (
            <button className={button} onClick={() => setReviewId(selected.id)}>
              Review with JobPilot
            </button>
          )}
          {methods?.direct && reviewId === selected.id && renderReview(methods.direct)}
          {methods && !methods.direct && !methods.verificationUnavailable && (
            <p>Direct submission through JobPilot is unavailable for this opening.</p>
          )}
          {(methodsError || methods?.verificationUnavailable) && (
            <button className={button} onClick={() => setRefresh((n) => n + 1)}>
              Retry checking submission methods
            </button>
          )}
          {!methods && !methodsError && <p role="status">Checking submission methods…</p>}
        </div>
      )}
    </section>
  );
}
