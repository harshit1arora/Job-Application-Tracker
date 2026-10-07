import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BellRing, ChevronRight } from "lucide-react";
import { getFollowUpSnapshot, FOLLOWUPS_CHANGED_EVENT } from "@/lib/followups-service";
import type { FollowUpItem } from "@/lib/types";

interface FollowUpsDueCardProps {
  userId: string;
}

/** Compact dashboard widget: the applications that most need a nudge right now. */
export function FollowUpsDueCard({ userId }: FollowUpsDueCardProps) {
  const [due, setDue] = useState<FollowUpItem[] | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const { evaluation, settings } = await getFollowUpSnapshot(userId);
        if (!active) return;
        setDue(evaluation.due);
        setEnabled(settings.enabled);
      } catch {
        if (active) setDue([]);
      }
    };
    void refresh();
    window.addEventListener(FOLLOWUPS_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(FOLLOWUPS_CHANGED_EVENT, refresh);
    };
  }, [userId]);

  if (due === null || !enabled) return null;

  return (
    <section className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <BellRing size={17} className="text-rose-500" /> Follow-ups due
          {due.length > 0 ? (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500">{due.length}</span>
          ) : null}
        </h2>
        <Link
          to="/followups"
          className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          Open follow-up center <ChevronRight size={14} />
        </Link>
      </div>
      {due.length === 0 ? (
        <p className="text-xs text-muted-foreground">All caught up — no application has gone quiet.</p>
      ) : (
        <ul className="space-y-2">
          {due.slice(0, 3).map((item) => (
            <li key={item.application.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold truncate">
                {item.application.company} <span className="text-muted-foreground font-normal">· {item.application.jobTitle}</span>
              </span>
              <span className="text-muted-foreground whitespace-nowrap">quiet {item.daysQuiet}d</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
