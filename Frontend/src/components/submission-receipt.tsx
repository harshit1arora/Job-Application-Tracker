import { useEffect, useState } from "react";
import { apiRequest, apiDownloadRequest } from "@/lib/api-client";

type Receipt = {
  channel?: string;
  company: string;
  title?: string;
  destination: string;
  submittedAt?: string;
  confirmedAt?: string;
  reference?: string;
  legacy?: boolean;
  answers: { question: string; answer: string; value: string }[];
  resume?: { name: string; fileName: string; size: number };
};

export function SubmissionReceipt({
  applicationId,
  userId,
}: {
  applicationId: string;
  userId: string;
}) {
  const path = `/applications/${encodeURIComponent(applicationId)}/receipt`;
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    apiRequest<Receipt | null>(path, userId)
      .then((value) => {
        if (active) setReceipt(value);
      })
      .catch(() => {
        if (active) setError("Could not load the submission receipt.");
      });
    return () => {
      active = false;
    };
  }, [path, userId, retry]);
  async function download() {
    if (!receipt?.resume) return;
    try {
      const url = URL.createObjectURL(await apiDownloadRequest(path + "/resume", userId));
      const link = document.createElement("a");
      link.href = url;
      link.download = receipt.resume.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Could not download the submitted résumé.");
    }
  }
  if (!receipt && !error) return null;
  return (
    <section
      aria-label="Submission receipt"
      className="mb-6 rounded-xl border bg-card p-5 space-y-3"
    >
      <h2 className="font-bold">Submission receipt</h2>
      {error && (
        <p role="alert">
          {error} <button onClick={() => setRetry((v) => v + 1)}>Retry</button>
        </p>
      )}
      {receipt && (
        <>
          <p>
            {receipt.title} · {receipt.company} ·{" "}
            {receipt.channel === "Gmail" ? "Sent by email via Gmail" : "Greenhouse"}
          </p>
          <a href={receipt.destination} className="underline" target="_blank" rel="noreferrer">
            {receipt.destination}
          </a>
          {receipt.submittedAt && (
            <p>
              Submitted{" "}
              <time dateTime={receipt.submittedAt}>
                {new Date(receipt.submittedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "long",
                })}
              </time>
            </p>
          )}
          {receipt.reference && (
            <p>
              {receipt.channel === "Gmail" ? "Gmail message ID" : "Employer reference"}:{" "}
              {receipt.reference}
            </p>
          )}
          {receipt.legacy && (
            <p>Earlier submission. The original file and submission time were not archived.</p>
          )}
          {receipt.resume ? (
            <p>
              {receipt.resume.name} ·{" "}
              <button className="underline" onClick={download}>
                Download {receipt.resume.fileName}
              </button>
            </p>
          ) : (
            !receipt.legacy && <p>No résumé attached.</p>
          )}
          <details>
            <summary>Submitted answers ({receipt.answers.length})</summary>
            <dl>
              {receipt.answers.map((a, i) => (
                <div key={i} className="mt-2">
                  <dt className="font-medium">{a.question}</dt>
                  <dd className="whitespace-pre-wrap">
                    {a.answer}
                    {a.answer !== a.value && <small> (submitted value: {a.value})</small>}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </section>
  );
}
