import { useEffect, useState } from "react";
import { apiDownloadRequest, apiRequest } from "@/lib/api-client";
import { getProfile } from "@/lib/profile";
import type { DocumentMetadata } from "@/lib/types";

type GoogleOAuth = {
  initCodeClient(options: {
    client_id: string;
    scope: string;
    ux_mode: "popup";
    select_account: boolean;
    callback: (response: { code?: string }) => void;
    error_callback: () => void;
  }): { requestCode(): void };
};
function oauth() {
  return (window as Window & { google?: { accounts?: { oauth2?: GoogleOAuth } } }).google?.accounts
    ?.oauth2;
}
let sdk: Promise<void> | undefined;
function loadGoogle() {
  if (oauth()) return Promise.resolve();
  if (!sdk)
    sdk = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        sdk = undefined;
        script.remove();
        reject(new Error("Unable to load Google authorization."));
      };
      document.head.appendChild(script);
    });
  return sdk;
}

type Connection = { clientId: string | null; email: string | null };
type Delivery = { status: "draft" | "sent" | "pending" | "archived"; applicationId?: string };
type Opening = { id: string; company: string; role: string };
const control = "block w-full rounded-md border bg-background p-2";
const button = "rounded-md border px-3 py-2 disabled:opacity-50";

export function GmailApplication({
  userId,
  opening,
  recipient,
}: {
  userId: string;
  opening: Opening;
  recipient: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className={button}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Apply by Gmail
      </button>
      {open && <EmailReview userId={userId} opening={opening} recipient={recipient} />}
    </div>
  );
}

function EmailReview({
  userId,
  opening,
  recipient,
}: {
  userId: string;
  opening: Opening;
  recipient: string;
}) {
  const path = `/job-imports/${opening.id}/gmail`;
  const [connection, setConnection] = useState<Connection>();
  const [delivery, setDelivery] = useState<Delivery>();
  const [docs, setDocs] = useState<DocumentMetadata[]>([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const key = `jobpilot:gmail-draft:${userId}:${opening.id}:${recipient}`;
  const [draft, setDraft] = useState(() => {
    const profile = getProfile(userId);
    const initial = {
      subject: `Application for ${opening.role}`,
      body: `Dear ${opening.company} hiring team,\n\nI am applying for the ${opening.role} position. Please find my résumé attached.\n\nThank you for your consideration,\n${profile.fullName || ""}`,
      resumeId: "",
    };
    try {
      return { ...initial, ...JSON.parse(sessionStorage.getItem(key) || "{}") } as typeof initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {
      /* Storage may be disabled. */
    }
  }, [draft, key]);
  useEffect(() => {
    let active = true;
    async function load() {
      const status = await apiRequest<Delivery>(path, userId);
      if (!active) return;
      setDelivery(status);
      if (status.status !== "draft") return;
      const [account, files] = await Promise.all([
        apiRequest<Connection>("/gmail/account", userId),
        apiRequest<DocumentMetadata[]>("/documents", userId),
      ]);
      if (!active) return;
      setConnection(account);
      setDocs(files);
      if (account.clientId) {
        await loadGoogle();
        if (active) setSdkReady(true);
      }
    }
    load().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [path, userId, reload]);
  function connect() {
    const google = oauth();
    if (!google || !connection?.clientId) return;
    setBusy(true);
    setError("");
    const fail = () => {
      setBusy(false);
      setError("Gmail connection was not completed.");
    };
    google
      .initCodeClient({
        client_id: connection.clientId,
        scope: "email https://www.googleapis.com/auth/gmail.send",
        ux_mode: "popup",
        select_account: true,
        error_callback: fail,
        callback: async (result) => {
          if (!result.code) {
            fail();
            return;
          }
          try {
            setConnection(
              await apiRequest<Connection>("/gmail/account", userId, {
                method: "POST",
                headers: { "X-Requested-With": "XmlHttpRequest" },
                body: JSON.stringify({ code: result.code }),
              }),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        },
      })
      .requestCode();
  }
  const attachment = docs.find((d) => d.id === draft.resumeId);
  async function previewFile() {
    if (!attachment) return;
    try {
      const url = URL.createObjectURL(
        await apiDownloadRequest(`/documents/${attachment.id}/download`, userId),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section aria-label="Review Gmail application" className="mt-3 space-y-3 rounded-lg border p-4">
      <h4 className="font-semibold">Review Gmail application</h4>
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              setError("");
              setReload((n) => n + 1);
            }}
          >
            Refresh status
          </button>
        </p>
      )}
      {delivery?.status === "sent" ? (
        <p>
          Sent by email.{" "}
          <a className="underline" href={`/applications/${delivery.applicationId}`}>
            View email receipt
          </a>
        </p>
      ) : delivery?.status === "archived" ? (
        <p>This opening was already emailed. Its tracker entry was deleted.</p>
      ) : delivery?.status === "pending" ? (
        <p>
          Delivery is unconfirmed. Check your Gmail Sent folder before applying again.{" "}
          <button className="underline" onClick={() => setReload((n) => n + 1)}>
            Refresh status
          </button>
        </p>
      ) : (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || !connection?.email || !attachment || delivery?.status !== "draft") return;
            setBusy(true);
            setError("");
            try {
              const result = await apiRequest<Delivery>(path, userId, {
                method: "POST",
                body: JSON.stringify({
                  approved: true,
                  sender: connection.email,
                  recipient,
                  ...draft,
                }),
              });
              setDelivery(result);
              if (result.status === "sent") {
                window.dispatchEvent(new Event("jobpilot:data-changed"));
                try {
                  sessionStorage.removeItem(key);
                } catch {
                  /* storage unavailable */
                }
              }
            } catch (e) {
              setError((e as Error).message);
              setReload((n) => n + 1);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="space-y-3">
            {connection?.email ? (
              <p>
                From: {connection.email}{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await apiRequest("/gmail/account", userId, { method: "DELETE" });
                      setConnection({ ...connection, email: null });
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Disconnect Gmail
                </button>
              </p>
            ) : connection?.clientId ? (
              <button type="button" className={button} disabled={!sdkReady} onClick={connect}>
                Connect Gmail
              </button>
            ) : (
              <p>
                {connection
                  ? "Gmail sending is not configured on this server."
                  : "Loading account…"}
              </p>
            )}
            <p>To: {recipient}</p>
            <label className="block">
              Email subject
              <input
                required
                maxLength={250}
                className={control}
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              />
            </label>
            <label className="block">
              Email message
              <textarea
                required
                maxLength={30000}
                rows={7}
                className={control}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            </label>
            <label className="block">
              Résumé attachment
              <select
                required
                className={control}
                value={attachment?.id || ""}
                onChange={(e) => setDraft({ ...draft, resumeId: e.target.value })}
              >
                <option value="">Choose a résumé version</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.displayName || d.fileName} · {d.fileName}
                  </option>
                ))}
              </select>
            </label>
            {attachment ? (
              <button type="button" className="underline" onClick={previewFile}>
                Download attachment for review
              </button>
            ) : (
              <a className="underline" href="/profile">
                Manage résumé versions
              </a>
            )}
            <button
              className={button}
              type="submit"
              disabled={
                !connection?.email || !attachment || !draft.body.trim() || !draft.subject.trim()
              }
            >
              Send application
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
