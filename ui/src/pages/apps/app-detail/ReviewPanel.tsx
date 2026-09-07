import { useTranslation, t } from "@/i18n";
import { ReviewQueueCard } from "../ReviewQueueCard";
import { QuarantinedActionsReview } from "./SetupPanel";
import type { AppDetailSectionProps } from "./types";

export function ReviewPanel({
  connectionId,
  quarantined = [],
  pending = false,
  onReviewQuarantined,
}: Pick<AppDetailSectionProps, "connectionId"> &
  Partial<Pick<AppDetailSectionProps, "quarantined" | "pending">> & {
    onReviewQuarantined?: (enabledIds: string[]) => void;
  }) {
  useTranslation();
  const showsQuarantinedActions = quarantined.length > 0 && !!onReviewQuarantined;

  return (
    <div className="space-y-4">
      {showsQuarantinedActions ? (
        <QuarantinedActionsReview
          entries={quarantined}
          disabled={pending}
          onSubmit={onReviewQuarantined}
        />
      ) : null}
      <ReviewQueueCard
        connectionId={connectionId}
        heading={t("pages.apps.review.queueTitle")}
        emptyState={showsQuarantinedActions ? "hidden" : "reassure"}
      />
    </div>
  );
}
