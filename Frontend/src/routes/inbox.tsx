import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { toast } from "sonner";
import {
  Inbox as InboxIcon,
  Search,
  Building2,
  Calendar,
  Sparkles,
  CheckCircle2,
  Mail,
  Send,
  ExternalLink,
  Clock,
  Video,
  User,
} from "lucide-react";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [{ title: "Inbox & Recruiter Messages — JobPilot" }],
  }),
  component: InboxPage,
});

interface MessageThread {
  id: string;
  company: string;
  sender: string;
  senderRole: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  unread: boolean;
  type: "interview" | "update" | "action";
  zoomLink?: string;
  applicationId?: string;
}

const SAMPLE_THREADS: MessageThread[] = [
  {
    id: "msg-1",
    company: "Stripe",
    sender: "Sarah Jenkins",
    senderRole: "Senior Technical Recruiter",
    subject: "Interview Invitation: Senior Full Stack Engineer Screening",
    preview: "Hi Alex, our engineering team was impressed by your distributed systems background...",
    body: `Hi Alex,\n\nThanks for applying for the Senior Full Stack Engineer role at Stripe! Our team was really impressed by your background in distributed systems, TypeScript, and developer tooling.\n\nWe'd love to invite you to a 45-minute technical screening with one of our Staff Engineers next Tuesday at 2:00 PM PST.\n\nPlease confirm if this time works for you or suggest an alternative window.\n\nBest regards,\nSarah Jenkins\nTalent Acquisition @ Stripe`,
    date: "10:30 AM",
    unread: true,
    type: "interview",
    zoomLink: "https://zoom.us/j/stripe-interview-alex",
  },
  {
    id: "msg-2",
    company: "OpenAI",
    sender: "David Chen",
    senderRole: "Recruiting Coordinator",
    subject: "Update on your Frontend Platform Engineer application",
    preview: "Hello Alex, your portfolio and application have been forwarded to the Canvas interaction team...",
    body: `Hello Alex,\n\nWe wanted to share an update on your Frontend Platform Engineer application. Your application has successfully passed initial review and has been routed to our hiring manager for the Canvas interaction team.\n\nYou should hear back regarding next round interview scheduling within 2-3 business days.\n\nThanks for your interest in OpenAI!\nDavid Chen`,
    date: "Yesterday",
    unread: true,
    type: "update",
  },
  {
    id: "msg-3",
    company: "Vercel",
    sender: "Elena Rostova",
    senderRole: "Engineering Talent Partner",
    subject: "Next Steps: Software Engineer, Core DX",
    preview: "Hi Alex, we're reviewing candidate profiles for our edge runtime and bundling teams...",
    body: `Hi Alex,\n\nThanks for connecting regarding the Software Engineer position on the Core DX team. We'd like to ask you a quick question about your experience with React 19 and custom build plugins.\n\nCould you reply with a brief summary of a challenging performance bottleneck you resolved in a production web application?\n\nLooking forward to hearing from you!\nElena`,
    date: "2 days ago",
    unread: false,
    type: "action",
  },
];

function InboxPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>(SAMPLE_THREADS);
  const [selectedId, setSelectedId] = useState<string>("msg-1");
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const selectedThread = threads.find((t) => t.id === selectedId) || threads[0];

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setThreads((prev) =>
      prev.map((t) => (t.id === id ? { ...t, unread: false } : t))
    );
  };

  const handleAiDraftReply = () => {
    if (!selectedThread) return;
    setIsAiGenerating(true);
    setTimeout(() => {
      if (selectedThread.type === "interview") {
        setReplyText(
          `Hi ${selectedThread.sender.split(" ")[0]},\n\nThank you so much for the invitation! That time window works perfectly for me. I'm looking forward to speaking with the team and discussing how my experience can contribute to ${selectedThread.company}.\n\nBest regards,\n${user?.name || "Alex"}`
        );
      } else {
        setReplyText(
          `Hi ${selectedThread.sender.split(" ")[0]},\n\nThank you for the update! Please let me know if you need any additional code samples or technical details from my end.\n\nBest regards,\n${user?.name || "Alex"}`
        );
      }
      setIsAiGenerating(false);
      toast.success("AI tailored reply drafted!");
    }, 600);
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    toast.success("Reply sent to recruiter!");
    setReplyText("");
  };

  const filteredThreads = threads.filter(
    (t) =>
      t.company.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.sender.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#fbfcfd] dark:bg-[#0b0f17] text-foreground flex flex-col md:flex-row antialiased selection:bg-primary/20">
      <DashboardSidebar inboxCount={threads.filter((t) => t.unread).length} />

      <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-7xl mx-auto overflow-y-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
              <InboxIcon size={14} /> Recruiter Communications
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Candidate Inbox
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Messages, interview invitations, and status updates directly from hiring teams.
            </p>
          </div>
        </div>

        {/* Master-Detail Split Pane */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[600px] rounded-2xl border border-border/80 bg-white dark:bg-[#111622] overflow-hidden shadow-xs">
          {/* Thread List (5 cols) */}
          <div className="lg:col-span-5 border-r border-border/80 flex flex-col">
            <div className="p-3.5 border-b border-border/70">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background/50 pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="divide-y divide-border/60 overflow-y-auto flex-1 max-h-[600px]">
              {filteredThreads.map((thread) => {
                const isSelected = thread.id === selectedId;
                return (
                  <div
                    key={thread.id}
                    onClick={() => handleSelect(thread.id)}
                    className={`p-4 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#f1f3f7] dark:bg-secondary/60"
                        : "hover:bg-secondary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                        <Building2 size={13} className="text-muted-foreground" />
                        {thread.company}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{thread.date}</span>
                    </div>

                    <h4
                      className={`text-xs truncate ${
                        thread.unread ? "font-bold text-foreground" : "font-medium text-foreground/80"
                      }`}
                    >
                      {thread.subject}
                    </h4>

                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1">
                      {thread.preview}
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                      {thread.type === "interview" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          <Video size={10} /> Interview Invite
                        </span>
                      )}
                      {thread.unread && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Message Reading & Reply Pane (7 cols) */}
          <div className="lg:col-span-7 p-6 flex flex-col justify-between">
            {selectedThread ? (
              <div className="space-y-5">
                {/* Header */}
                <div className="pb-4 border-b border-border/70 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-primary mb-1">
                      <Building2 size={14} /> {selectedThread.company}
                    </div>
                    <h2 className="text-base font-bold text-foreground">
                      {selectedThread.subject}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="font-semibold text-foreground">{selectedThread.sender}</span>
                      <span>•</span>
                      <span>{selectedThread.senderRole}</span>
                    </div>
                  </div>

                  <span className="text-xs text-muted-foreground shrink-0">{selectedThread.date}</span>
                </div>

                {/* Body */}
                <div className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line py-2 bg-secondary/20 p-4 rounded-xl border border-border/50">
                  {selectedThread.body}
                </div>

                {selectedThread.zoomLink && (
                  <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Video size={15} /> Video Interview Link Confirmed
                    </div>
                    <a
                      href={selectedThread.zoomLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 underline hover:opacity-80 inline-flex items-center gap-1"
                    >
                      Open Link <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* Reply Composer */}
                <div className="pt-3 border-t border-border/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Reply to {selectedThread.sender}
                    </span>
                    <button
                      type="button"
                      onClick={handleAiDraftReply}
                      disabled={isAiGenerating}
                      className="text-xs font-bold text-primary hover:opacity-80 inline-flex items-center gap-1"
                    >
                      <Sparkles size={13} />
                      {isAiGenerating ? "Drafting..." : "Draft Reply with AI"}
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your response here or click 'Draft Reply with AI'..."
                    className="w-full rounded-xl border border-input bg-background p-3 text-xs text-foreground focus:outline-none focus:border-primary"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSendReply}
                      disabled={!replyText.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow hover:opacity-95 disabled:opacity-50"
                    >
                      <Send size={13} /> Send Reply
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Select a message to view the thread.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
