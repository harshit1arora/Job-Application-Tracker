import { useState } from "react";
import { type UserProfile, getAutofillFieldMap, autofillText } from "@/lib/profile";
import { toast } from "sonner";
import { Copy, Check, X, Sparkles } from "lucide-react";

interface QuickFillWidgetProps {
  profile: UserProfile;
}

export function QuickFillWidget({ profile }: QuickFillWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fieldMap = getAutofillFieldMap(profile);

  const handleCopy = async (key: string, val: string) => {
    if (!val) {
      toast.error(`Your ${key} is empty in profile.`);
      return;
    }
    await navigator.clipboard.writeText(val);
    setCopiedKey(key);
    toast.success(`Copied ${key}`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleCopyMasterBundle = async () => {
    const payload = autofillText(profile);
    await navigator.clipboard.writeText(payload);
    toast.success("Complete application data bundle copied to clipboard!");
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-5 z-40 flex items-center gap-2 rounded-full bg-[#0d131f] border border-white/20 text-white px-4 py-2.5 text-xs font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all"
        title="Open Quick-Fill Application Helper"
      >
        <Sparkles size={14} className="text-primary animate-pulse" />
        <span>Autofill Helper</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-5 z-40 w-80 rounded-3xl border border-border/80 bg-card shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="p-3.5 bg-secondary/60 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          <Sparkles size={14} className="text-primary" />
          <span>Quick-Fill Helper</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="p-3 max-h-80 overflow-y-auto space-y-1.5 text-xs">
        <div className="flex items-center justify-between pb-1 mb-1 border-b border-border/60">
          <span className="text-[10px] text-muted-foreground">Click any field to copy:</span>
          <button
            type="button"
            onClick={handleCopyMasterBundle}
            className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
          >
            <Copy size={11} /> Copy All
          </button>
        </div>

        {Object.entries(fieldMap).map(([key, val]) => (
          <div
            key={key}
            onClick={() => handleCopy(key, val)}
            className="flex items-center justify-between p-2 rounded-xl border border-border/70 bg-background hover:border-primary/50 hover:bg-secondary/40 cursor-pointer transition-all"
          >
            <div className="truncate mr-2">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">{key}</span>
              <span className="text-xs text-foreground truncate block font-medium">
                {val || <span className="text-muted-foreground/50 italic">Not provided</span>}
              </span>
            </div>
            <span className="text-muted-foreground p-1 shrink-0">
              {copiedKey === key ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
