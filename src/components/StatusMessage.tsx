import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "./ui/button";

type MessageType = "success" | "warning" | "error" | "status";

const config: Record<
  MessageType,
  { icon: typeof CheckCircle2; wrapper: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    wrapper:
      "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]",
    iconClass: "text-[var(--success-text)]",
  },
  warning: {
    icon: AlertTriangle,
    wrapper:
      "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]",
    iconClass: "text-[var(--warning-text)]",
  },
  error: {
    icon: AlertCircle,
    wrapper:
      "border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-text)]",
    iconClass: "text-[var(--error-text)]",
  },
  status: {
    icon: Info,
    wrapper:
      "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info-text)]",
    iconClass: "text-[var(--info-text)]",
  },
};

export function StatusMessage({
  type,
  message,
  onDismiss,
}: {
  type: MessageType;
  message: string;
  onDismiss: () => void;
}) {
  const Icon = config[type].icon;

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg ${config[type].wrapper}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config[type].iconClass}`} />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-full border-transparent bg-white/70 px-2"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
