import { useState } from "react";
import { type UserProfile, getAutofillFieldMap } from "@/lib/profile";
import { toast } from "sonner";
import { Copy, Check, X, Sparkles, ChevronDown, ChevronUp, Layers } from "lucide-react";

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

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-5 z-40 flex items-center gap-2 rounded-full bg-card border border-border px-3.5 py-2 text-xs font-bold text-foreground shadow-xl hover:bg-secondary transition-all"
        title="Open Quick-Fill Application Helper"
      >
        <Sparkles size={14} className="text-primary" />
        <span>Quick-Fill Helper</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-5 z-40 w-80 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="p-3 bg-secondary/50 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Sparkles size={14} className="text-primary" />
          <span>Quick-Fill Assistant</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1 rounded-md text-muted-foreground hover:bg-secondary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-3 max-h-72 overflow-y-auto space-y-1.5 text-xs">
        <p className="text-[10px] text-muted-foreground mb-2">
          Click any field to copy to clipboard while filling career portal forms:
        </p>
        {Object.entries(fieldMap).map(([key, val]) => (
          <div
            key={key}
            onClick={() => handleCopy(key, val)}
            className="flex items-center justify-between p-2 rounded-lg border border-border/70 bg-background hover:border-primary/50 hover:bg-secondary/30 cursor-pointer transition-colors"
          >
            <div className="truncate mr-2">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">{key}</span>
              <span className="text-xs text-foreground truncate block font-medium">
                {val || <span className="text-muted-foreground/60 italic">Not provided</span>}
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
