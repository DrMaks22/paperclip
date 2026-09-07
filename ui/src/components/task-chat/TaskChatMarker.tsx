import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { taskChatDisplayLabel, taskThreadMarkerDetailDisplay } from "./task-chat-display";
import { CircleDot, OctagonX, Flag } from "lucide-react";
import type { TaskChatMarkerItem } from "./task-chat-model";

const VARIANT_ICON = {
  session_start: CircleDot,
  interrupted: OctagonX,
  turn_boundary: Flag,
} as const;

/**
 * Lifecycle divider — renders a state boundary (session start, interruption,
 * turn boundary) as a recessed rule, never a bubble. Interruptions use a dashed
 * destructive rule to read as a distinct state.
 */
export function TaskChatMarker({ item, verbatimLabel = false }: { item: TaskChatMarkerItem; verbatimLabel?: boolean }) {
  const { t } = useTranslation();
  const Icon = VARIANT_ICON[item.variant];
  const interrupted = item.variant === "interrupted";
  return (
    <div className="tc-enter-marker flex items-center gap-2 py-1 text-xs text-muted-foreground">
      <span className={cn("h-px flex-1", interrupted ? "border-t border-dashed border-destructive/50" : "bg-border")} />
      <span className={cn("flex items-center gap-1.5", interrupted && "text-destructive")}>
        <Icon className="h-3.5 w-3.5" />
        <span className="font-medium">{verbatimLabel ? item.label : item.label === "Plan created" ? t("stableTaskChat.planCreated") : item.label === "Plan updated" ? t("stableTaskChat.planUpdated") : taskChatDisplayLabel(item.label)}</span>
        {item.detail ? <span className="text-muted-foreground">· {taskThreadMarkerDetailDisplay(item.detail)}</span> : null}
      </span>
      <span className={cn("h-px flex-1", interrupted ? "border-t border-dashed border-destructive/50" : "bg-border")} />
    </div>
  );
}
